# React Frontend Migration Design

**Date:** 2026-05-17  
**Branch:** feat/react-frontend  
**Scope:** Migrate `frontend/index.html` (2200-line vanilla JS SPA) to Vite + React. Same UI, same behavior, no new features.

---

## Goals

- Replace the monolithic `index.html` with a componentized React app
- Preserve every existing behavior exactly (email gate, CRUD, collab, cursors, modals)
- Output a static build to `frontend/dist/` so FastAPI continues serving it unchanged
- Make the frontend maintainable for future feature additions

## Non-Goals

- No new UI or features
- No design changes
- No backend changes
- No routing library (still a single-page app)
- No state management library (React Context is sufficient)

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Vite | Dev server + build tool (replaces manual esbuild bundler) |
| React 18 | Component model |
| CodeMirror 6 | Editor (same packages, now imported via npm by Vite) |
| React Context | Shared app state (email, session metadata) |

---

## Project Structure

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── EmailGate.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Toolbar.jsx
│   │   ├── Editor.jsx
│   │   ├── StdinPane.jsx
│   │   ├── OutputPane.jsx
│   │   ├── SaveModal.jsx
│   │   ├── ShareModal.jsx
│   │   ├── LobbyOverlay.jsx
│   │   └── SessionModal.jsx
│   ├── hooks/
│   │   ├── useDocuments.js
│   │   └── useSession.js
│   └── context/
│       └── AppContext.jsx
├── index.html
├── vite.config.js
└── package.json

frontend/dist/        ← Vite build output (gitignored, served by FastAPI)
bundler/              ← Deleted (Vite replaces it)
```

The old `frontend/index.html` and `frontend/codemirror-bundle.js` are removed. The `bundler/` directory is removed.

---

## State Architecture

### AppContext (shared session metadata only)

```js
{
  email,            // string | null — from localStorage with 24h TTL
  setEmail,
  sessionId,        // string | null
  sessionMembers,   // [{ email, color }]
  sessionStarted,   // boolean
  isOwner,          // boolean
  setSession,       // setter for session fields
}
```

**What does NOT go in context:** `code`, `stdin`, output. These are local to their components and shared only via WebSocket messages.

### Local state

- `Editor.jsx` — owns CM6 `EditorView` via `useRef`. Code is never stored in React state.
- `StdinPane.jsx` — owns stdin via `useState`.
- `OutputPane.jsx` — owns output display via `useState`.
- `Sidebar.jsx` — owns document list via `useDocuments` hook.

---

## Component Responsibilities

| Component | Responsibility |
|---|---|
| `App.jsx` | Guards email gate. Reads `?session=` from URL to auto-join session. Renders layout. |
| `EmailGate.jsx` | Email input + regex validation. On submit: saves to localStorage, sets context email. |
| `Sidebar.jsx` | Document list. New/load/delete actions. Session member avatars with kick popover. |
| `Toolbar.jsx` | Run, Save, Share buttons. Calls `/run` HTTP, triggers save flow, opens share modal. |
| `Editor.jsx` | CodeMirror 6 instance (uncontrolled). Remote cursor decorations. Debounced session sync. |
| `StdinPane.jsx` | Controlled textarea. Syncs via session if active. |
| `OutputPane.jsx` | Renders stdout/stderr/timeout/exit code with colors. Shows "Run by:" in session. |
| `SaveModal.jsx` | Title input dialog on first save. |
| `ShareModal.jsx` | Session link display + copy button. |
| `LobbyOverlay.jsx` | Member list while waiting. Owner sees Start button. |
| `SessionModal.jsx` | "Session ended" and "You were kicked" dialogs. |

---

## Hook Responsibilities

### `useDocuments(email)`

Wraps all `/documents` API calls. Returns:

```js
{ docs, loadDocs, saveDoc, deleteDoc, currentDoc, setCurrentDoc }
```

- `saveDoc(title, code, stdin)` — POST if no currentDoc.id, PUT otherwise
- `loadDoc(doc)` — sets currentDoc, pushes code/stdin into Editor/Stdin via callback refs

### `useSession(sessionId, email, editorRef)`

Owns the WebSocket lifecycle. Opens on mount when `sessionId` is set, closes on unmount.

Returns:

```js
{ sendMessage, runResult }
```

Incoming message handling:
- `code_change` → dispatch CM6 transaction directly on `editorRef.current` with `suppressSync = true`
- `stdin_change` → call stdin setter via ref
- `cursor` → update CM6 remote cursor StateField
- `lobby_update` → update context `sessionMembers`
- `session_started` → set context `sessionStarted = true`, load code/stdin into editor
- `run_result` → set `runResult` state (OutputPane reads this)
- `session_ended` → show SessionModal "ended"
- `kicked` → show SessionModal "kicked"
- `member_disconnected` → update context `sessionMembers`

---

## Critical Implementation Details

### 1. CodeMirror is uncontrolled

`Editor.jsx` creates one `EditorView` on mount and holds it in a `ref`. It never receives `code` as a prop after mount. Remote updates arrive via `useSession` which calls `editorRef.current.dispatch(transaction)` directly — bypassing React entirely.

### 2. Echo suppression

A `suppressSync` ref (not state, to avoid re-renders) lives in `Editor.jsx` or `useSession`. When a remote `code_change` is applied via dispatch, `suppressSync` is set to `true`. The editor's `updateListener` checks this flag before broadcasting and resets it.

### 3. Vite proxy replaces API_BASE hack

`vite.config.js` proxies `/documents`, `/sessions`, `/run`, `/ws` to `http://localhost:8000` in dev. In production the build is served by FastAPI at the same origin, so no prefix is needed. All fetch calls use relative paths (e.g. `/run`).

```js
// vite.config.js
export default {
  root: 'frontend',
  build: { outDir: '../dist' },  // relative to root
  server: {
    proxy: {
      '/documents': 'http://localhost:8000',
      '/sessions': 'http://localhost:8000',
      '/run': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    }
  }
}
```

FastAPI's `StaticFiles` mount path changes from `frontend/` to `frontend/dist/`.

### 4. React StrictMode + WebSocket

`useSession` cleanup must fully close the WebSocket (`ws.close()`) on unmount. In StrictMode dev, the hook will mount-unmount-remount — this is fine as long as cleanup is correct. Do not suppress StrictMode.

### 5. Member colors

`MEMBER_COLORS` array (5 colors) and color assignment move into `useSession`. Color is assigned when a member joins and stored in `sessionMembers` in context.

### 6. CSS migration

All styles currently in `<style>` tag in `index.html` move to `src/index.css`, imported in `main.jsx`. No CSS modules, no Tailwind — plain CSS to preserve exact styling with minimal changes.

---

## Build & Serve

**Dev:**
```bash
cd frontend && npm run dev   # Vite on :5173, proxies API to :8000
cd backend && uvicorn main:app --reload  # FastAPI on :8000
```

**Production build:**
```bash
cd frontend && npm run build  # outputs to frontend/dist/
# FastAPI serves frontend/dist/ at /
```

**FastAPI change** (`backend/main.py`):
```python
# Before
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
# After
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
```

---

## Files Removed

- `frontend/index.html` (old monolith)
- `frontend/codemirror-bundle.js` (replaced by npm + Vite)
- `bundler/package.json` (entire bundler/ directory)

---

## Files Added / Changed

| File | Action |
|---|---|
| `frontend/src/main.jsx` | New |
| `frontend/src/App.jsx` | New |
| `frontend/src/components/*.jsx` | New (10 files) |
| `frontend/src/hooks/useDocuments.js` | New |
| `frontend/src/hooks/useSession.js` | New |
| `frontend/src/context/AppContext.jsx` | New |
| `frontend/src/index.css` | New (migrated from index.html `<style>`) |
| `frontend/index.html` | New (Vite entry, minimal shell) |
| `frontend/vite.config.js` | New |
| `frontend/package.json` | New |
| `backend/main.py` | 1-line change: StaticFiles path |
