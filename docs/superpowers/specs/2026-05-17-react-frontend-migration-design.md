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
│   ├── index.css                      ← migrated from index.html <style>
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
├── index.html                         ← minimal Vite shell (includes Google Fonts <link> tags)
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
  isRunning,        // boolean — mirrors body.running class; owned here for Toolbar/OutputPane
  setIsRunning,
}
```

**What does NOT go in context:** `code`, `stdin`, output. These are local to their components and shared only via WebSocket messages.

### Local state

- `Editor.jsx` — owns CM6 `EditorView` via `useRef`. Code is never stored in React state.
- `StdinPane.jsx` — owns stdin via `useState`.
- `OutputPane.jsx` — owns output display via `useState`.
- `Sidebar.jsx` — owns document list via `useDocuments` hook.

### Body class management

The existing CSS uses `body.locked` (fades layout before email is set) and `body.running` (disables run button during execution). In React:

- `body.locked` — `App.jsx` adds/removes this class on `document.body` when `email` changes.
- `body.running` — `Toolbar.jsx` adds/removes this class when a run starts/completes, driven by `isRunning` in context.

---

## Component Responsibilities

| Component | Responsibility |
|---|---|
| `App.jsx` | Manages `body.locked`. Reads `?session=` from URL to auto-join. Guards email gate. Renders layout. |
| `EmailGate.jsx` | Email input + regex validation. On submit: saves to localStorage, sets context email. |
| `Sidebar.jsx` | Document list. New/load/delete. Guards `loadDocument` while in session. Session member avatars: owner gets kick popover, non-owners get email-display popover. |
| `Toolbar.jsx` | Run, Save, Share buttons. Manages `body.running`. Share button hidden during active session. New button hidden during active session. On run in session: broadcasts `run_result` via `sendMessage`. |
| `Editor.jsx` | CodeMirror 6 instance (uncontrolled). Inline title input (`#doc-title-input`, max 120 chars). Remote cursor decorations. Debounced session sync. |
| `StdinPane.jsx` | Controlled textarea. Syncs via session if active. |
| `OutputPane.jsx` | Renders stdout/stderr/timeout/exit code as React elements (no innerHTML). Shows "Run by:" in session. |
| `SaveModal.jsx` | Title input dialog on first save. |
| `ShareModal.jsx` | Session link display + copy button. |
| `LobbyOverlay.jsx` | Member list while waiting. Owner sees Start button. If no email on session URL entry: shows email input, on submit calls setEmail + fetchDocuments + connectWS. |
| `SessionModal.jsx` | "Session ended" and "You were kicked" dialogs. On dismiss: clears session from URL via `history.replaceState`. |

---

## Hook Responsibilities

### `useDocuments(email)`

Wraps all `/documents` API calls. Returns:

```js
{ docs, loadDocs, saveDoc, deleteDoc, currentDoc, setCurrentDoc }
```

- `saveDoc(title, code, stdin)` — POST if no currentDoc.id, PUT otherwise
- `loadDoc(doc)` — sets currentDoc, pushes code/stdin into Editor/Stdin via callback refs

### `useSession(sessionId, email, editorRef, suppressSyncRef)`

Owns the WebSocket lifecycle. Opens when `sessionId` is set, closes on unmount. Implements 3-second auto-reconnect on unexpected close (matching current behavior): if `sessionId` is still set after `ws.onclose`, schedules reconnect after 3s. Cleanup on unmount sets a `destroyed` flag that prevents the reconnect timer from firing.

`suppressSyncRef` is created in `Editor.jsx` and passed into `useSession` — both share the **same ref object** so echo suppression works correctly across the hook boundary.

Returns:

```js
{ sendMessage, runResult, setRunResult }
```

Incoming message handling:

| Message type | Action |
|---|---|
| `code_change` | Set `suppressSyncRef.current = true`, dispatch CM6 transaction on `editorRef.current`, reset ref |
| `stdin_change` | Call stdin setter via ref |
| `cursor` | Update CM6 remote cursor StateField |
| `lobby_update` | Update context `sessionMembers` |
| `session_started` | Set context `sessionStarted = true`, update URL via `history.replaceState(?session=...)`, load code/stdin into editor |
| `run_result` | Set `runResult` state (OutputPane reads this) |
| `session_ended` | Show SessionModal "ended" |
| `kicked` | Show SessionModal "kicked" |
| `member_disconnected` | Update context `sessionMembers` |
| `error` | Display error in lobby status area or statusbar depending on session phase |

---

## Critical Implementation Details

### 1. CodeMirror is uncontrolled

`Editor.jsx` creates one `EditorView` on mount and holds it in a `useRef`. It never receives `code` as a prop after mount. Remote updates arrive via `useSession` which calls `editorRef.current.dispatch(transaction)` directly — bypassing React entirely.

### 2. Echo suppression — shared ref

`suppressSyncRef` is a `useRef(false)` created inside `Editor.jsx`. It is passed as a prop to `useSession`. This ensures both the `updateListener` (inside `Editor.jsx`) and the incoming message handler (inside `useSession`) share the exact same ref object. Flow:

1. Remote `code_change` arrives in `useSession`
2. `suppressSyncRef.current = true`
3. `editorRef.current.dispatch(replaceTransaction)` — fires `updateListener` synchronously
4. `updateListener` sees `suppressSyncRef.current === true`, skips broadcast, sets it back to `false`

Because `dispatch()` is synchronous, steps 3 and 4 complete before step 4's reset is needed.

### 3. Vite config — correct outDir and proxy

`vite.config.js` lives at the repo root (not inside `frontend/`). With `root: 'frontend'`, Vite resolves `outDir: 'dist'` relative to `root`, placing output at `frontend/dist/` as intended. The old `window.location.port === "3000"` API_BASE hack is deleted entirely — the Vite proxy makes it unnecessary.

```js
// vite.config.js  (at repo root)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  build: { outDir: 'dist' },   // resolves to frontend/dist/
  server: {
    port: 5173,
    proxy: {
      '/documents': 'http://localhost:8000',
      '/sessions':  'http://localhost:8000',
      '/run':       'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    }
  }
})
```

### 4. FastAPI StaticFiles — absolute path

Use `pathlib.Path` to avoid CWD-dependent failures:

```python
# backend/main.py
import pathlib
_frontend = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
app.mount("/", StaticFiles(directory=_frontend, html=True), name="frontend")
```

### 5. React StrictMode + WebSocket reconnect

`useSession` cleanup sets a `destroyed` ref to `true` and calls `ws.close()`. The 3-second reconnect timer checks `destroyed` before reconnecting. StrictMode double-mount causes connect → close → reconnect in dev — this is acceptable behavior and StrictMode must not be suppressed.

### 6. URL management via history.replaceState

These components own URL updates:

| Event | Who calls replaceState | New URL |
|---|---|---|
| Session started | `useSession` on `session_started` | `?session={id}` |
| Session ended | `SessionModal.jsx` on dismiss | pathname only |
| Kicked | `SessionModal.jsx` on dismiss | pathname only |
| Owner leaves | `Toolbar.jsx` leave action | pathname only |

### 7. CSS and fonts

All styles migrate from `<style>` in the old `index.html` to `src/index.css`, imported in `main.jsx`. The new minimal Vite `frontend/index.html` shell includes the two Google Fonts `<link>` tags (JetBrains Mono + Syne preconnect + stylesheet) exactly as in the original.

### 8. OutputPane renders React elements, not innerHTML

The current code uses `innerHTML +=` with manually constructed `<span>` strings. `OutputPane.jsx` must use React elements (`<span className="...">`) instead. JSX escapes text content automatically, replacing the manual `escHtml()` utility. `dangerouslySetInnerHTML` must not be used.

### 9. Utility functions

`formatDate` (used in document list) and `MEMBER_COLORS` (used in session) move to `src/utils.js`. `escHtml` is deleted (JSX handles escaping).

### 10. window.confirm() calls preserved

`deleteDocument`, `leaveSession`, and `kickMember` all use `window.confirm()`. These are preserved as-is in the React migration.

---

## Build & Serve

**Dev:**
```bash
# Terminal 1
cd backend && uvicorn main:app --reload   # FastAPI on :8000

# Terminal 2
npm run dev   # from repo root, Vite on :5173, proxies API to :8000
```

**Production build:**
```bash
npm run build   # outputs to frontend/dist/
# FastAPI serves frontend/dist/ at /
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
| `frontend/src/index.css` | New (migrated from index.html `<style>`) |
| `frontend/src/components/*.jsx` | New (10 files) |
| `frontend/src/hooks/useDocuments.js` | New |
| `frontend/src/hooks/useSession.js` | New |
| `frontend/src/context/AppContext.jsx` | New |
| `frontend/src/utils.js` | New (formatDate, MEMBER_COLORS) |
| `frontend/index.html` | New (minimal Vite shell with Google Fonts links) |
| `vite.config.js` | New (at repo root) |
| `package.json` | New (at repo root) |
| `backend/main.py` | 1-line change: StaticFiles uses pathlib path to `frontend/dist` |
