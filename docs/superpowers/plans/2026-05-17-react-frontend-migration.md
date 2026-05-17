# React Frontend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 2200-line `frontend/index.html` vanilla JS SPA to a Vite + React app with the same UI and behavior, outputting a static build to `frontend/dist/` served by FastAPI.

**Architecture:** React 18 with Context for shared session metadata. CodeMirror 6 runs as an uncontrolled component via `useRef` — remote updates are applied via CM6 `dispatch()` directly, never through React state. All refs that cross component/hook boundaries are created in `App.jsx` and passed down.

**Tech Stack:** Vite 5, React 18, CodeMirror 6 (`codemirror`, `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`, `@codemirror/lang-python`, `@codemirror/theme-one-dark`), plain CSS.

---

## File Map

| File | Role |
|---|---|
| `vite.config.js` | Repo root. Vite config: root=frontend, outDir=dist, dev proxy to :8000 |
| `package.json` | Repo root. React + CM6 + Vite deps |
| `frontend/index.html` | Minimal Vite shell (replaces old monolith) |
| `frontend/src/main.jsx` | React entry: renders `<App/>` into `#root` |
| `frontend/src/index.css` | All styles (migrated from old `<style>` tag) |
| `frontend/src/utils.js` | `MEMBER_COLORS`, `memberColor()`, `initials()`, `formatDate()`, `isValidEmail()`, `SESSION_KEY`, `SESSION_TTL`, `saveSession()`, `loadSession()`, `clearSession()` |
| `frontend/src/context/AppContext.jsx` | Email, session metadata, isRunning, status, modal state |
| `frontend/src/hooks/useDocuments.js` | CRUD for `/documents` |
| `frontend/src/hooks/useSession.js` | WebSocket lifecycle, incoming message dispatch |
| `frontend/src/components/EmailGate.jsx` | Email input overlay |
| `frontend/src/components/Sidebar.jsx` | Doc list, member avatars, kick popover |
| `frontend/src/components/Editor.jsx` | CM6 instance (uncontrolled), remote cursors, title input |
| `frontend/src/components/StdinPane.jsx` | Stdin textarea with session sync |
| `frontend/src/components/OutputPane.jsx` | Stdout/stderr/exit display |
| `frontend/src/components/Toolbar.jsx` | Run/Save/Share/Leave/New buttons |
| `frontend/src/components/SaveModal.jsx` | Title prompt on first save |
| `frontend/src/components/ShareModal.jsx` | Session link + copy |
| `frontend/src/components/LobbyOverlay.jsx` | Waiting room UI |
| `frontend/src/components/SessionModal.jsx` | Session ended / kicked dialogs |
| `frontend/src/App.jsx` | Root: creates shared refs, coordinates all hooks, renders layout |
| `backend/main.py` | 1-line change: StaticFiles path → `frontend/dist` |

---

## Task 1: Scaffold — Vite + React project

**Files:**
- Create: `vite.config.js` (repo root)
- Create: `package.json` (repo root)
- Create: `frontend/index.html` (new minimal shell)
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json` at repo root**

```json
{
  "name": "pyide",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@codemirror/commands": "^6.10.3",
    "@codemirror/lang-python": "^6.2.1",
    "@codemirror/state": "^6.6.0",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@codemirror/view": "^6.42.1",
    "codemirror": "^6.0.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.2"
  }
}
```

- [ ] **Step 2: Create `vite.config.js` at repo root**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  build: {
    outDir: 'dist',      // resolves to frontend/dist/
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/documents': 'http://localhost:8000',
      '/sessions':  'http://localhost:8000',
      '/run':       'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
```

- [ ] **Step 3: Create `frontend/index.html` (Vite shell)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PyIDE</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body class="locked">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Add `frontend/dist/` to `.gitignore`**

Open `.gitignore` and add:
```
frontend/dist/
node_modules/
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Verify Vite starts**

```bash
npm run dev
```

Expected: `VITE v5.x.x  ready in Xms` at `http://localhost:5173`. Browser shows blank page (no src/main.jsx yet). Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add package.json vite.config.js frontend/index.html .gitignore
git commit -m "feat: scaffold Vite + React project"
```

---

## Task 2: CSS Migration

**Files:**
- Create: `frontend/src/index.css`

- [ ] **Step 1: Create `frontend/src/` directory and copy all CSS**

Create `frontend/src/index.css` and paste the entire contents of the `<style>` block from the old `frontend/index.html` (lines 9–839) verbatim. Do not modify any selectors or properties.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: migrate CSS to src/index.css"
```

---

## Task 3: Utilities

**Files:**
- Create: `frontend/src/utils.js`

- [ ] **Step 1: Create `frontend/src/utils.js`**

```js
export const MEMBER_COLORS = ["#7c6af7", "#4ade80", "#fb923c", "#a78bfa", "#f87171"];
export const SESSION_KEY = "pyide_session";
export const SESSION_TTL = 24 * 60 * 60 * 1000; // 24h

export function memberColor(idx) {
  return MEMBER_COLORS[idx % MEMBER_COLORS.length];
}

export function initials(email) {
  return (email || "?")[0].toUpperCase();
}

export function formatDate(iso) {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "";
  }
}

export function isValidEmail(e) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e);
}

export function saveSession(email) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email, ts: Date.now() }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { email, ts } = JSON.parse(raw);
    if (Date.now() - ts > SESSION_TTL) {
      clearSession();
      return null;
    }
    return email;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils.js
git commit -m "feat: add utils (colors, session storage, helpers)"
```

---

## Task 4: AppContext

**Files:**
- Create: `frontend/src/context/AppContext.jsx`

- [ ] **Step 1: Create `frontend/src/context/AppContext.jsx`**

```jsx
import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [email, setEmail]                   = useState(null);
  const [sessionId, setSessionId]           = useState(null);
  const [sessionMembers, setSessionMembers] = useState([]);   // [{ email, color }]
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isOwner, setIsOwner]               = useState(false);
  const [isRunning, setIsRunning]           = useState(false);
  const [status, setStatus]                 = useState('Ready');

  return (
    <AppContext.Provider value={{
      email, setEmail,
      sessionId, setSessionId,
      sessionMembers, setSessionMembers,
      sessionStarted, setSessionStarted,
      isOwner, setIsOwner,
      isRunning, setIsRunning,
      status, setStatus,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/context/AppContext.jsx
git commit -m "feat: add AppContext (email, session metadata, status)"
```

---

## Task 5: main.jsx

**Files:**
- Create: `frontend/src/main.jsx`

- [ ] **Step 1: Create `frontend/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
```

- [ ] **Step 2: Create a stub `frontend/src/App.jsx` so Vite can render**

```jsx
export default function App() {
  return <div>Loading...</div>
}
```

- [ ] **Step 3: Verify Vite renders without error**

```bash
npm run dev
```

Open `http://localhost:5173`. Expected: page shows "Loading..." with no console errors. Stop server.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/main.jsx frontend/src/App.jsx
git commit -m "feat: add main.jsx entry and App stub"
```

---

## Task 6: EmailGate component

**Files:**
- Create: `frontend/src/components/EmailGate.jsx`

- [ ] **Step 1: Create `frontend/src/components/EmailGate.jsx`**

```jsx
import { useState, useEffect, useRef } from 'react';
import { isValidEmail, saveSession } from '../utils.js';
import { useApp } from '../context/AppContext.jsx';

export default function EmailGate() {
  const { setEmail, setStatus } = useApp();
  const [value, setValue]   = useState('');
  const [error, setError]   = useState(false);
  const inputRef            = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  function attempt() {
    const trimmed = value.trim();
    if (!isValidEmail(trimmed)) {
      setError(true);
      return;
    }
    setError(false);
    saveSession(trimmed);
    setEmail(trimmed);
    setStatus('Ready');
  }

  return (
    <div id="email-gate">
      <div id="gate-card">
        <div className="gate-wordmark">PyIDE</div>
        <h2>Welcome back</h2>
        <p>Enter your email to access your workspace</p>
        <input
          ref={inputRef}
          id="gate-email-input"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          className={error ? 'error' : ''}
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onKeyDown={e => { if (e.key === 'Enter') attempt(); }}
        />
        <div id="gate-email-error" className={error ? 'show' : ''}>
          Please enter a valid email address
        </div>
        <button id="gate-continue-btn" onClick={attempt}>Continue →</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/EmailGate.jsx
git commit -m "feat: EmailGate component"
```

---

## Task 7: useDocuments hook

**Files:**
- Create: `frontend/src/hooks/useDocuments.js`

- [ ] **Step 1: Create `frontend/src/hooks/useDocuments.js`**

```js
import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';

export function useDocuments() {
  const { email, setStatus } = useApp();
  const [docs, setDocs]           = useState([]);
  const [currentDoc, setCurrentDoc] = useState(null); // { id, title, code, stdin }

  const loadDocs = useCallback(async (forEmail) => {
    if (!forEmail) return;
    try {
      const resp = await fetch(`/documents/${encodeURIComponent(forEmail)}`);
      if (!resp.ok) throw new Error('fetch failed');
      setDocs(await resp.json());
    } catch (err) {
      setStatus('Error loading documents: ' + err.message);
    }
  }, [setStatus]);

  const saveDoc = useCallback(async (title, code, stdin) => {
    if (!email) return null;
    try {
      if (currentDoc?.id) {
        const resp = await fetch(`/documents/${currentDoc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, code, stdin }),
        });
        if (!resp.ok) { const e = await resp.json(); throw new Error(e.detail || 'Update failed'); }
        const updated = await resp.json();
        setDocs(prev => prev.map(d => d.id === currentDoc.id ? updated : d));
        setCurrentDoc(prev => ({ ...prev, title: updated.title }));
        setStatus(`Saved: ${updated.title}`);
        return updated;
      } else {
        const resp = await fetch('/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, title, code, stdin }),
        });
        if (!resp.ok) { const e = await resp.json(); throw new Error(e.detail || 'Save failed'); }
        const doc = await resp.json();
        setCurrentDoc({ id: doc.id, title: doc.title, code, stdin });
        await loadDocs(email);
        setStatus(`Saved: ${doc.title}`);
        return doc;
      }
    } catch (err) {
      setStatus('Save error: ' + err.message);
      return null;
    }
  }, [email, currentDoc, loadDocs, setStatus]);

  const deleteDoc = useCallback(async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      const resp = await fetch(`/documents/${docId}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Delete failed');
      if (currentDoc?.id === docId) setCurrentDoc(null);
      await loadDocs(email);
      setStatus('Document deleted.');
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  }, [email, currentDoc, loadDocs, setStatus]);

  return { docs, loadDocs, saveDoc, deleteDoc, currentDoc, setCurrentDoc };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useDocuments.js
git commit -m "feat: useDocuments hook (CRUD)"
```

---

## Task 8: SaveModal component

**Files:**
- Create: `frontend/src/components/SaveModal.jsx`

- [ ] **Step 1: Create `frontend/src/components/SaveModal.jsx`**

```jsx
import { useState, useEffect, useRef } from 'react';

export default function SaveModal({ onConfirm, onCancel }) {
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  function confirm() {
    onConfirm(title.trim() || 'Untitled');
  }

  return (
    <div id="modal-overlay" className="overlay show">
      <div id="modal">
        <h3>Save Document</h3>
        <input
          ref={inputRef}
          id="modal-title-input"
          type="text"
          placeholder="Enter a title..."
          maxLength={120}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="modal-btns">
          <button className="cancel-btn" id="modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-btn" id="modal-confirm" onClick={confirm}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SaveModal.jsx
git commit -m "feat: SaveModal component"
```

---

## Task 9: ShareModal component

**Files:**
- Create: `frontend/src/components/ShareModal.jsx`

- [ ] **Step 1: Create `frontend/src/components/ShareModal.jsx`**

```jsx
import { useState } from 'react';

export default function ShareModal({ link, onClose }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div id="share-modal-overlay" className="overlay show">
      <div id="share-modal">
        <h3>Share Session</h3>
        <p>Send this link to collaborators — up to 4 others can join</p>
        <div className="share-note">⚡ Changes in the session are not auto-saved. Use Save to persist them.</div>
        <div id="share-link-row">
          <input id="share-link-input" type="text" readOnly value={link} onChange={() => {}} />
          <button id="share-copy-btn" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
        <div className="share-btns">
          <button id="share-close-btn" onClick={onClose}>Done — Open Lobby</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ShareModal.jsx
git commit -m "feat: ShareModal component"
```

---

## Task 10: SessionModal component

**Files:**
- Create: `frontend/src/components/SessionModal.jsx`

- [ ] **Step 1: Create `frontend/src/components/SessionModal.jsx`**

```jsx
export default function SessionModal({ type, onDismiss }) {
  // type: 'ended' | 'kicked'
  const isEnded = type === 'ended';

  return (
    <div className={`overlay show`} id={isEnded ? 'session-ended-overlay' : 'kicked-overlay'}>
      <div id={isEnded ? 'session-ended-modal' : 'kicked-modal'}>
        <div className="end-icon">{isEnded ? '🔌' : '🚫'}</div>
        <h3>{isEnded ? 'Session Ended' : 'Removed from Session'}</h3>
        <p>
          {isEnded
            ? 'The owner disconnected and the session has ended.'
            : 'The host removed you from this session.'}
        </p>
        <button
          id={isEnded ? 'session-ended-ok' : 'kicked-ok'}
          onClick={onDismiss}
        >
          Back to Editor
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SessionModal.jsx
git commit -m "feat: SessionModal component (ended/kicked)"
```

---

## Task 11: OutputPane component

**Files:**
- Create: `frontend/src/components/OutputPane.jsx`

- [ ] **Step 1: Create `frontend/src/components/OutputPane.jsx`**

```jsx
import { useEffect, useRef } from 'react';

// runResult: { stdout, stderr, exit_code, timed_out, triggered_by } | null
// isRunning: boolean
export default function OutputPane({ runResult, isRunning }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [runResult]);

  let content;
  if (isRunning) {
    content = <span className="out-placeholder">Running...</span>;
  } else if (!runResult) {
    content = <span className="out-placeholder">Run your code to see output.</span>;
  } else {
    const parts = [];
    if (runResult.triggered_by) {
      parts.push(
        <span key="by" className="out-run-by">▶ Run by: {runResult.triggered_by}</span>
      );
    }
    if (runResult.timed_out) {
      parts.push(
        <span key="timeout" className="out-timeout">⏱ Timed out after 10 seconds{'\n'}</span>
      );
    }
    if (runResult.stdout) {
      parts.push(<span key="stdout" className="out-stdout">{runResult.stdout}</span>);
    }
    if (runResult.stderr) {
      parts.push(<span key="stderr" className="out-stderr">{runResult.stderr}</span>);
    }
    parts.push(
      <span key="exit" className="out-exit">{'\n'}─── exit {runResult.exit_code} ───</span>
    );
    content = parts;
  }

  return (
    <div id="output-pane">
      <div id="output-label">Output</div>
      <div id="output-content" ref={scrollRef}>
        {content}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/OutputPane.jsx
git commit -m "feat: OutputPane component"
```

---

## Task 12: StdinPane component

**Files:**
- Create: `frontend/src/components/StdinPane.jsx`

- [ ] **Step 1: Create `frontend/src/components/StdinPane.jsx`**

```jsx
import { useState, useImperativeHandle, forwardRef, useRef } from 'react';

// stdinRef exposes { getValue, setValue } to parent
// sendMessage from useSession — called when stdin changes in a session
const StdinPane = forwardRef(function StdinPane({ isInSession, sendMessage, email }, ref) {
  const [value, setValue] = useState('');
  const timerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    setValue: (v) => setValue(v),
  }), [value]);

  function handleChange(e) {
    const v = e.target.value;
    setValue(v);
    if (!isInSession) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      sendMessage({ type: 'stdin_change', stdin: v, email });
    }, 300);
  }

  return (
    <div id="stdin-section">
      <div id="stdin-label">Stdin</div>
      <textarea
        id="stdin-input"
        placeholder="Program input..."
        value={value}
        onChange={handleChange}
      />
    </div>
  );
});

export default StdinPane;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/StdinPane.jsx
git commit -m "feat: StdinPane component with session sync"
```

---

## Task 13: Editor component (CodeMirror 6 — most complex)

**Files:**
- Create: `frontend/src/components/Editor.jsx`

- [ ] **Step 1: Create `frontend/src/components/Editor.jsx`**

```jsx
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorView, keymap, Decoration, WidgetType } from '@codemirror/view';
import { EditorState, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { indentWithTab, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { useApp } from '../context/AppContext.jsx';

// ── Remote cursor CM6 primitives ────────────────────────────
export const addCursorEffect    = StateEffect.define();
export const removeCursorEffect = StateEffect.define();

class RemoteCursorWidget extends WidgetType {
  constructor(color, name) { super(); this.color = color; this.name = name; }
  eq(other) { return other.color === this.color && other.name === this.name; }
  toDOM() {
    const beam  = document.createElement('span');
    beam.className = 'cm-remote-cursor';
    beam.style.setProperty('--rc', this.color);
    const label = document.createElement('span');
    label.className   = 'cm-remote-cursor-name';
    label.textContent = this.name;
    beam.appendChild(label);
    return beam;
  }
  ignoreEvent() { return true; }
}

const remoteCursorField = StateField.define({
  create() { return new Map(); },
  update(map, tr) {
    const next = new Map(map);
    for (const e of tr.effects) {
      if (e.is(addCursorEffect))          next.set(e.value.email, e.value);
      else if (e.is(removeCursorEffect))  next.delete(e.value);
    }
    return next;
  },
  provide(f) {
    return EditorView.decorations.from(f, map => {
      if (!map.size) return Decoration.none;
      const sorted = [...map.values()].sort((a, b) => a.pos - b.pos);
      const builder = new RangeSetBuilder();
      for (const c of sorted)
        builder.add(c.pos, c.pos,
          Decoration.widget({ widget: new RemoteCursorWidget(c.color, c.name), side: 1 }));
      return builder.finish();
    });
  },
});

const INITIAL_CODE = `# Welcome to PyIDE\nname = input("Enter your name: ")\nprint(f"Hello, {name}!")\n`;

// Editor exposes { getCode, setCode, dispatch, view } via ref
// suppressSyncRef is created here and also passed to useSession via editorRef.suppressSyncRef
const Editor = forwardRef(function Editor(
  { isInSession, sessionMembers, sendMessage, email },
  ref
) {
  const wrapperRef      = useRef(null);
  const viewRef         = useRef(null);
  const suppressSyncRef = useRef(false);
  const codeTimerRef    = useRef(null);
  const cursorTimerRef  = useRef(null);
  const { setStatus }   = useApp();

  // Expose API to parent (App.jsx)
  useImperativeHandle(ref, () => ({
    getCode:        () => viewRef.current?.state.doc.toString() ?? '',
    setCode:        (code) => {
      if (!viewRef.current) return;
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: code },
      });
    },
    dispatch:       (tr) => viewRef.current?.dispatch(tr),
    suppressSyncRef,                    // shared with useSession
    addCursorEffect,
    removeCursorEffect,
    remoteCursorField,
    lineColToOffset: (line, col) => {
      const doc = viewRef.current?.state.doc;
      if (!doc || line < 1 || line > doc.lines) return 0;
      const ln = doc.line(line);
      return ln.from + Math.min(col, ln.length);
    },
    getSessionMembers: () => sessionMembersRef.current,
    clearCursors: () => {
      if (!viewRef.current) return;
      const map = viewRef.current.state.field(remoteCursorField);
      const effects = [...map.keys()].map(em => removeCursorEffect.of(em));
      if (effects.length) viewRef.current.dispatch({ effects });
    },
  }), []);

  // Keep a ref to sessionMembers so updateListener closure stays fresh
  const sessionMembersRef   = useRef(sessionMembers);
  const isInSessionRef      = useRef(isInSession);
  const emailRef            = useRef(email);
  const sendMessageRef      = useRef(sendMessage);
  useEffect(() => { sessionMembersRef.current = sessionMembers; }, [sessionMembers]);
  useEffect(() => { isInSessionRef.current = isInSession; }, [isInSession]);
  useEffect(() => { emailRef.current = email; }, [email]);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // Create editor once on mount
  useEffect(() => {
    const view = new EditorView({
      doc: INITIAL_CODE,
      extensions: [
        basicSetup,
        python(),
        oneDark,
        keymap.of([indentWithTab]),
        EditorView.theme({
          '.cm-scroller': { fontFamily: '"JetBrains Mono","Fira Code",monospace' },
        }),
        remoteCursorField,
        EditorView.updateListener.of((update) => {
          if (!isInSessionRef.current || suppressSyncRef.current) return;
          if (update.docChanged) {
            clearTimeout(codeTimerRef.current);
            codeTimerRef.current = setTimeout(() => {
              sendMessageRef.current({
                type: 'code_change',
                code: view.state.doc.toString(),
                email: emailRef.current,
              });
            }, 300);
          }
          if (update.selectionSet) {
            clearTimeout(cursorTimerRef.current);
            cursorTimerRef.current = setTimeout(() => {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              sendMessageRef.current({
                type: 'cursor',
                line: line.number,
                col: head - line.from,
                email: emailRef.current,
              });
            }, 80);
          }
        }),
      ],
      parent: wrapperRef.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []); // mount only — intentional empty deps

  return (
    // Editor renders only the CM6 wrapper — App.jsx owns the outer #editor-pane shell
    <div id="editor-wrapper" ref={wrapperRef} />
  );
});

export default Editor;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Editor.jsx
git commit -m "feat: Editor component — CM6 uncontrolled with remote cursors"
```

---

## Task 14: useSession hook

**Files:**
- Create: `frontend/src/hooks/useSession.js`

- [ ] **Step 1: Create `frontend/src/hooks/useSession.js`**

```js
import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { memberColor } from '../utils.js';

// editorRef: ref returned from Editor (exposes getCode/setCode/dispatch/suppressSyncRef etc.)
// stdinRef:  ref returned from StdinPane (exposes getValue/setValue)
// onSessionModal: (type: 'ended'|'kicked') => void
export function useSession(editorRef, stdinRef, onSessionModal) {
  const {
    email, sessionId, setSessionMembers, setSessionStarted, setStatus,
  } = useApp();

  const [runResult, setRunResult] = useState(null);
  const wsRef      = useRef(null);
  const destroyedRef = useRef(false);

  const sendMessage = useCallback((obj) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !email) return;
    destroyedRef.current = false;

    function connect() {
      if (destroyedRef.current) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${proto}//${window.location.host}/ws/${sessionId}/${encodeURIComponent(email)}`
      );
      wsRef.current = ws;

      ws.onclose = () => {
        wsRef.current = null;
        // Auto-reconnect only while session is active
        setTimeout(() => {
          if (!destroyedRef.current) connect();
        }, 3000);
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        handleMessage(msg);
      };
    }

    function handleMessage(msg) {
      const editor = editorRef.current;
      const stdin  = stdinRef.current;

      switch (msg.type) {
        case 'lobby_update': {
          const members = msg.members.map((em, i) => ({ email: em, color: memberColor(i) }));
          setSessionMembers(members);
          break;
        }

        case 'session_started': {
          setSessionStarted(true);
          if (editor) {
            editor.suppressSyncRef.current = true;
            editor.setCode(msg.code || '');
            if (stdin) stdin.setValue(msg.stdin || '');
            editor.suppressSyncRef.current = false;
          }
          history.replaceState({}, '', `?session=${sessionId}`);
          setStatus('🟢 Live session — changes sync to all members');
          break;
        }

        case 'code_change': {
          if (msg.email !== email && editor) {
            // Remove remote cursor for this member (re-appears on next cursor msg)
            editor.dispatch({ effects: editor.removeCursorEffect.of(msg.email) });
            editor.suppressSyncRef.current = true;
            editor.setCode(msg.code);
            editor.suppressSyncRef.current = false;
          }
          break;
        }

        case 'stdin_change': {
          if (msg.email !== email && stdin) {
            stdin.setValue(msg.stdin);
          }
          break;
        }

        case 'run_result': {
          setRunResult(msg);
          setStatus(`Run by ${msg.triggered_by} — exit ${msg.exit_code}`);
          break;
        }

        case 'cursor': {
          if (msg.email !== email && editor) {
            const pos = editor.lineColToOffset(msg.line, msg.col);
            const members = editor.getSessionMembers();
            const idx = members.findIndex(m => m.email === msg.email);
            const color = memberColor(idx >= 0 ? idx : 0);
            editor.dispatch({
              effects: editor.addCursorEffect.of({
                email: msg.email,
                pos,
                color,
                name: msg.email.split('@')[0],
              }),
            });
          }
          break;
        }

        case 'member_disconnected': {
          setSessionMembers(prev => {
            const next = prev.filter(m => m.email !== msg.email);
            return next.map((m, i) => ({ ...m, color: memberColor(i) }));
          });
          if (editor) {
            editor.dispatch({ effects: editor.removeCursorEffect.of(msg.email) });
          }
          break;
        }

        case 'session_ended': {
          cleanup();
          onSessionModal('ended');
          // URL cleared by SessionModal on dismiss (spec ownership table)
          break;
        }

        case 'kicked': {
          cleanup();
          onSessionModal('kicked');
          // URL cleared by SessionModal on dismiss (spec ownership table)
          break;
        }

        case 'error': {
          setStatus('Session error: ' + msg.message);
          break;
        }
      }
    }

    function cleanup() {
      setSessionStarted(false);
      setSessionMembers([]);
      // Clear all remote cursor decorations via the helper exposed in Editor's useImperativeHandle
      editorRef.current?.clearCursors();
    }

    connect();

    return () => {
      destroyedRef.current = true;
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionId, email]); // reconnect if sessionId or email changes

  return { sendMessage, runResult, setRunResult };
}
```

**Note:** The `cleanup()` inside `handleMessage` for `session_ended` and `kicked` clears session state. Remote cursors are automatically gone since `setSessionStarted(false)` will hide the session UI. The `destroyedRef` ensures the reconnect timer doesn't fire after `sessionId` is cleared.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useSession.js
git commit -m "feat: useSession hook — WebSocket lifecycle + message dispatch"
```

---

## Task 15: Sidebar component

**Files:**
- Create: `frontend/src/components/Sidebar.jsx`

- [ ] **Step 1: Create `frontend/src/components/Sidebar.jsx`**

```jsx
import { useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatDate, initials, memberColor } from '../utils.js';

export default function Sidebar({
  docs, currentDocId, onLoad, onDelete, loadDocs,
  sessionMembers, sessionStarted, isOwner, email,
  sendMessage,
}) {
  const { setStatus } = useApp();

  // Close popovers on outside click
  useEffect(() => {
    function handler() {
      document.querySelectorAll('.avatar-popover.show')
        .forEach(p => p.classList.remove('show'));
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  function kickMember(memberEmail) {
    if (!confirm(`Kick ${memberEmail} from the session?`)) return;
    sendMessage({ type: 'kick_member', email: memberEmail });
  }

  return (
    <div id="sidebar">
      <div id="sidebar-header">
        <span>Documents</span>
      </div>
      <div id="doc-list">
        {!docs.length ? (
          <div id="sidebar-empty">
            {email ? 'No documents yet. Save to create one.' : 'Enter email to load documents'}
          </div>
        ) : (
          docs.map(doc => (
            <div
              key={doc.id}
              className={`doc-card${doc.id === currentDocId ? ' active' : ''}`}
              onClick={() => onLoad(doc)}
            >
              <div className="doc-info">
                <div className="doc-title">{doc.title}</div>
                <div className="doc-date">{formatDate(doc.updated_at)}</div>
              </div>
              <button
                className="delete-btn"
                title="Delete"
                onClick={e => { e.stopPropagation(); onDelete(doc.id); }}
              >✕</button>
            </div>
          ))
        )}
      </div>

      {/* Session member avatars (shown during live session) */}
      {sessionStarted && (
        <div id="session-badge" className="show">
          <span className="live-dot" />
          Live Session
          <div id="member-avatars">
            {sessionMembers.map((member, i) => {
              const canKick = isOwner && member.email !== email;
              const showPopover = canKick || !isOwner;
              return (
                <div key={member.email} className="avatar-wrap">
                  <div
                    className="member-avatar"
                    style={{ background: member.color }}
                    title={member.email}
                    onClick={e => {
                      if (!showPopover) return;
                      e.stopPropagation();
                      document.querySelectorAll('.avatar-popover.show')
                        .forEach(p => p.classList.remove('show'));
                      e.currentTarget.nextSibling?.classList.toggle('show');
                    }}
                  >
                    {initials(member.email)}
                  </div>
                  {showPopover && (
                    <div className="avatar-popover">
                      <div className="pop-name">{member.email}</div>
                      {canKick && (
                        <button
                          className="kick-btn"
                          onClick={e => { e.stopPropagation(); kickMember(member.email); }}
                        >
                          Kick from session
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.jsx
git commit -m "feat: Sidebar component with doc list and session avatars"
```

---

## Task 16: Toolbar component

**Files:**
- Create: `frontend/src/components/Toolbar.jsx`

- [ ] **Step 1: Create `frontend/src/components/Toolbar.jsx`**

```jsx
import { useApp } from '../context/AppContext.jsx';
import { clearSession } from '../utils.js';

export default function Toolbar({
  email, currentDocId, sessionStarted, isRunning,
  onRun, onSave, onShare, onLeave, onNew, onChangeEmail,
}) {
  const { setStatus } = useApp();

  return (
    <div id="topbar">
      <span className="logo">PyIDE</span>

      {email && (
        <div id="email-display" className="show">
          <span id="email-display-text">{email}</span>
          <a
            id="email-change-link"
            href="#"
            onClick={e => { e.preventDefault(); onChangeEmail(); }}
          >
            change
          </a>
        </div>
      )}

      <div className="topbar-spacer" />

      <div className="topbar-actions">
        {sessionStarted && (
          <button id="leave-session-btn" onClick={onLeave}>Leave</button>
        )}
        {!sessionStarted && (
          <button id="new-doc-btn" onClick={onNew}>New</button>
        )}
        {!sessionStarted && (
          <button
            id="share-btn"
            disabled={!currentDocId}
            onClick={onShare}
          >
            Share
          </button>
        )}
        <button
          id="run-btn"
          disabled={isRunning}
          onClick={onRun}
        >
          &#9654; Run
        </button>
        <button id="save-btn" onClick={onSave}>&#128190; Save</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Toolbar.jsx
git commit -m "feat: Toolbar component"
```

---

## Task 17: LobbyOverlay component

**Files:**
- Create: `frontend/src/components/LobbyOverlay.jsx`

- [ ] **Step 1: Create `frontend/src/components/LobbyOverlay.jsx`**

```jsx
import { useState } from 'react';
import { isValidEmail, saveSession } from '../utils.js';
import { useApp } from '../context/AppContext.jsx';
import { initials, memberColor } from '../utils.js';

export default function LobbyOverlay({
  sessionId, sessionMembers, isOwner, email,
  lobbyStatus, onStart, onJoinWithEmail,
}) {
  const [lobbyEmail, setLobbyEmail] = useState('');
  const [emailError, setEmailError] = useState(false);

  function handleJoin() {
    const trimmed = lobbyEmail.trim();
    if (!isValidEmail(trimmed)) { setEmailError(true); return; }
    setEmailError(false);
    onJoinWithEmail(trimmed);
  }

  const canStart = isOwner && sessionMembers.length >= 2;

  return (
    <div id="lobby-overlay" className="overlay show">
      <div id="lobby-card">
        <div className="lobby-wordmark">PyIDE — Collab</div>
        <h2 id="lobby-title">
          {!email ? 'Join Session' : isOwner ? 'Your Session' : 'Joining Session'}
        </h2>
        <div className="lobby-sub" id="lobby-sub">
          {!email
            ? 'Enter your email to join'
            : isOwner
            ? 'Share the link, then start when ready'
            : 'Waiting for owner to start...'}
        </div>

        {/* Email input for unauthenticated join */}
        {!email && (
          <div id="lobby-email-section">
            <input
              id="lobby-email-input"
              type="email"
              placeholder="your@email.com"
              autoComplete="email"
              value={lobbyEmail}
              onChange={e => { setLobbyEmail(e.target.value); setEmailError(false); }}
              style={emailError ? { borderColor: 'var(--red)' } : {}}
            />
            <button id="lobby-join-btn" onClick={handleJoin}>Join →</button>
          </div>
        )}

        <div className="lobby-section-label">Members <span /></div>
        <div className="lobby-count-row">
          <span className="lobby-member-count" id="lobby-count">
            {sessionMembers.length} / 5 joined
          </span>
        </div>

        <div id="lobby-members">
          {sessionMembers.map((member, i) => {
            const memberIsOwner = i === 0;
            const isYou    = member.email === email;
            const canKick  = isOwner && !memberIsOwner && !isYou;
            return (
              <div key={member.email} className="member-pill online">
                <div className="pill-avatar" style={{ background: member.color }}>
                  {initials(member.email)}
                </div>
                <span className="pill-name">{member.email}</span>
                {memberIsOwner && <span className="pill-tag owner-tag">Owner</span>}
                {isYou         && <span className="pill-tag you-tag">You</span>}
                <span className="pill-status" />
              </div>
            );
          })}
        </div>

        <div id="lobby-status">{lobbyStatus}</div>

        {isOwner && (
          <button
            id="lobby-start-btn"
            style={{ display: 'block' }}
            disabled={!canStart}
            onClick={onStart}
          >
            Start Session →
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/LobbyOverlay.jsx
git commit -m "feat: LobbyOverlay component"
```

---

## Task 18: App.jsx — wire everything together

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Rewrite `frontend/src/App.jsx`**

```jsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { useApp } from './context/AppContext.jsx';
import { loadSession, clearSession, saveSession } from './utils.js';
import { useDocuments } from './hooks/useDocuments.js';
import { useSession } from './hooks/useSession.js';
import EmailGate from './components/EmailGate.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toolbar from './components/Toolbar.jsx';
import Editor from './components/Editor.jsx';
import StdinPane from './components/StdinPane.jsx';
import OutputPane from './components/OutputPane.jsx';
import SaveModal from './components/SaveModal.jsx';
import ShareModal from './components/ShareModal.jsx';
import LobbyOverlay from './components/LobbyOverlay.jsx';
import SessionModal from './components/SessionModal.jsx';

export default function App() {
  const {
    email, setEmail,
    sessionId, setSessionId,
    sessionMembers, setSessionMembers,
    sessionStarted, setSessionStarted,
    isOwner, setIsOwner,
    isRunning, setIsRunning,
    status, setStatus,
  } = useApp();

  // Shared imperative refs
  const editorRef = useRef(null);   // Editor component ref
  const stdinRef  = useRef(null);   // StdinPane component ref

  // UI state
  const [showSaveModal, setShowSaveModal]   = useState(false);
  const [saveModalCb,   setSaveModalCb]     = useState(null);
  const [shareLink,     setShareLink]       = useState('');
  const [showLobby,     setShowLobby]       = useState(false);
  const [lobbyStatus,   setLobbyStatus]     = useState('');
  const [sessionModal,  setSessionModal]    = useState(null); // 'ended' | 'kicked' | null

  // Document state
  const { docs, loadDocs, saveDoc, deleteDoc, currentDoc, setCurrentDoc } = useDocuments();

  // Session
  const { sendMessage, runResult, setRunResult } = useSession(
    editorRef, stdinRef,
    (type) => {
      setShowLobby(false);
      setSessionStarted(false);
      setSessionId(null);
      setIsOwner(false);
      setSessionMembers([]);
      setSessionModal(type);
    }
  );

  // body.locked management
  useEffect(() => {
    if (email) {
      document.body.classList.remove('locked');
    } else {
      document.body.classList.add('locked');
    }
  }, [email]);

  // body.running management
  useEffect(() => {
    if (isRunning) document.body.classList.add('running');
    else document.body.classList.remove('running');
  }, [isRunning]);

  // Init: restore session from localStorage, check URL for ?session=
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setEmail(saved);
      setStatus('Ready');
      loadDocs(saved);
      const sid = new URLSearchParams(window.location.search).get('session');
      if (sid) openLobby(sid, saved);
    } else {
      const sid = new URLSearchParams(window.location.search).get('session');
      if (sid) {
        setSessionId(sid);
        setShowLobby(true);
      }
    }
  }, []); // mount only

  // Fetch docs when email is set
  useEffect(() => {
    if (email) loadDocs(email);
  }, [email]);

  // ── Lobby ──────────────────────────────────────────────────
  async function openLobby(sid, forEmail) {
    setSessionId(sid);
    setShowLobby(true);
    setLobbyStatus('Connecting...');
    if (!forEmail) return; // unauthenticated — show email input in lobby
    try {
      const meta = await fetch(`/sessions/${sid}`).then(r => r.json());
      const owner = meta.owner_email === forEmail;
      setIsOwner(owner);
      setLobbyStatus(owner ? 'Waiting for others to join...' : 'Waiting for owner to start...');
    } catch {
      setLobbyStatus('Could not load session info.');
    }
  }

  function handleLobbyJoinWithEmail(newEmail) {
    saveSession(newEmail);
    setEmail(newEmail);
    loadDocs(newEmail);
    setLobbyStatus('Connecting...');
    // useSession will connect now that sessionId + email are both set
  }

  function handleStartSession() {
    sendMessage({ type: 'start_session', email });
  }

  // ── Share ──────────────────────────────────────────────────
  async function handleShare() {
    if (!currentDoc?.id) return;
    try {
      const resp = await fetch('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_email: email, doc_id: currentDoc.id }),
      });
      if (!resp.ok) throw new Error('Failed to create session');
      const { session_id } = await resp.json();
      setSessionId(session_id);
      setIsOwner(true);
      const link = `${window.location.origin}${window.location.pathname}?session=${session_id}`;
      setShareLink(link);
    } catch (err) {
      setStatus('Error creating session: ' + err.message);
    }
  }

  function handleShareClose() {
    setShareLink('');
    if (sessionId && isOwner) openLobby(sessionId, email);
  }

  // ── Run ────────────────────────────────────────────────────
  async function handleRun() {
    const code  = editorRef.current?.getCode() ?? '';
    const stdin = stdinRef.current?.getValue() ?? '';
    setRunResult(null);
    setIsRunning(true);
    setStatus('Running...');
    try {
      const resp = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, stdin }),
      });
      const data = await resp.json();
      if (sessionStarted) {
        sendMessage({ type: 'run_result', ...data, triggered_by: email });
      } else {
        setRunResult(data);
        setStatus(`Done — exit code ${data.exit_code}${data.timed_out ? ' (timed out)' : ''}`);
      }
    } catch (err) {
      setRunResult({ stdout: '', stderr: `Error: ${err.message}`, exit_code: 1, timed_out: false, triggered_by: null });
      setStatus('Run failed');
    } finally {
      setIsRunning(false);
    }
  }

  // ── Save ───────────────────────────────────────────────────
  async function handleSave() {
    if (!email) return;
    const code  = editorRef.current?.getCode() ?? '';
    const stdin = stdinRef.current?.getValue() ?? '';
    const title = currentDoc?.title || '';

    if (currentDoc?.id) {
      await saveDoc(title || 'Untitled', code, stdin);
    } else if (title) {
      await saveDoc(title, code, stdin);
    } else {
      // Prompt for title
      setSaveModalCb(() => async (t) => {
        setShowSaveModal(false);
        const doc = await saveDoc(t, code, stdin);
        if (doc) setCurrentDoc({ id: doc.id, title: doc.title, code, stdin });
      });
      setShowSaveModal(true);
    }
  }

  // ── Load document ──────────────────────────────────────────
  function handleLoadDoc(doc) {
    if (sessionStarted) { setStatus('Leave the session before switching documents.'); return; }
    setCurrentDoc({ id: doc.id, title: doc.title, code: doc.code, stdin: doc.stdin || '' });
    editorRef.current?.setCode(doc.code);
    stdinRef.current?.setValue(doc.stdin || '');
    setStatus(`Loaded: ${doc.title}`);
  }

  // ── New document ───────────────────────────────────────────
  function handleNew() {
    setCurrentDoc(null);
    editorRef.current?.setCode(`# Welcome to PyIDE\nname = input("Enter your name: ")\nprint(f"Hello, {name}!")\n`);
    stdinRef.current?.setValue('');
    setStatus('New document');
  }

  // ── Leave session ──────────────────────────────────────────
  function handleLeave() {
    if (!confirm('Leave the session?')) return;
    setSessionStarted(false);
    setSessionId(null);
    setIsOwner(false);
    setSessionMembers([]);
    setShowLobby(false);
    history.replaceState({}, '', window.location.pathname);
    setStatus('Left session.');
  }

  // ── Change email ───────────────────────────────────────────
  function handleChangeEmail() {
    clearSession();
    setEmail(null);
    setCurrentDoc(null);
    setSessionId(null);
    setSessionStarted(false);
    setSessionMembers([]);
    setShowLobby(false);
    if (stdinRef.current) stdinRef.current.setValue('');
  }

  // ── Session modal dismiss ──────────────────────────────────
  function handleSessionModalDismiss() {
    setSessionModal(null);
    handleNew();
    history.replaceState({}, '', window.location.pathname);
  }

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    function handler(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') { e.preventDefault(); handleRun(); }
      if (mod && e.key === 's')     { e.preventDefault(); handleSave(); }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [email, currentDoc, sessionStarted]); // re-register when these change

  return (
    <>
      {!email && <EmailGate />}

      <Toolbar
        email={email}
        currentDocId={currentDoc?.id}
        sessionStarted={sessionStarted}
        isRunning={isRunning}
        onRun={handleRun}
        onSave={handleSave}
        onShare={handleShare}
        onLeave={handleLeave}
        onNew={handleNew}
        onChangeEmail={handleChangeEmail}
      />

      <div id="main">
        <Sidebar
          docs={docs}
          currentDocId={currentDoc?.id}
          onLoad={handleLoadDoc}
          onDelete={deleteDoc}
          loadDocs={loadDocs}
          sessionMembers={sessionMembers}
          sessionStarted={sessionStarted}
          isOwner={isOwner}
          email={email}
          sendMessage={sendMessage}
        />

        <div id="editor-area">
          <div id="doc-title-bar">
            <input
              id="doc-title-input"
              type="text"
              placeholder="Untitled"
              maxLength={120}
              value={currentDoc?.title || ''}
              onChange={e => setCurrentDoc(prev => prev ? { ...prev, title: e.target.value } : { id: null, title: e.target.value, code: '', stdin: '' })}
            />
          </div>
          <div id="panes">
            <div id="editor-pane">
              <div id="editor-label">Code</div>
              <Editor
                ref={editorRef}
                isInSession={sessionStarted}
                sessionMembers={sessionMembers}
                sendMessage={sendMessage}
                email={email}
              />
              <StdinPane
                ref={stdinRef}
                isInSession={sessionStarted}
                sendMessage={sendMessage}
                email={email}
              />
            </div>
            <OutputPane runResult={runResult} isRunning={isRunning} />
          </div>
        </div>
      </div>

      <div id="statusbar">{status}</div>

      {showLobby && (
        <LobbyOverlay
          sessionId={sessionId}
          sessionMembers={sessionMembers}
          isOwner={isOwner}
          email={email}
          lobbyStatus={lobbyStatus}
          onStart={handleStartSession}
          onJoinWithEmail={handleLobbyJoinWithEmail}
        />
      )}

      {showSaveModal && (
        <SaveModal
          onConfirm={saveModalCb}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      {shareLink && (
        <ShareModal link={shareLink} onClose={handleShareClose} />
      )}

      {sessionModal && (
        <SessionModal type={sessionModal} onDismiss={handleSessionModalDismiss} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: App.jsx — wires all components and hooks"
```

---

## Task 19: Backend StaticFiles path update

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update StaticFiles mount in `backend/main.py`**

Find the line:
```python
_frontend = pathlib.Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=_frontend, html=True), name="frontend")
```

Change to:
```python
_frontend = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
app.mount("/", StaticFiles(directory=_frontend, html=True), name="frontend")
```

If the current code uses a string instead of pathlib, change it to:
```python
import pathlib
_frontend = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
app.mount("/", StaticFiles(directory=_frontend, html=True), name="frontend")
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "fix: serve frontend/dist instead of frontend/"
```

---

## Task 20: Remove old files

**Files:**
- Delete: `frontend/codemirror-bundle.js`
- Delete: `bundler/` directory
- Keep: old `frontend/index.html` — **DO NOT delete yet** (keep until smoke test passes)

- [ ] **Step 1: Remove the bundler directory**

```bash
rm -rf bundler/
```

- [ ] **Step 2: Remove the old CodeMirror bundle**

```bash
rm frontend/codemirror-bundle.js
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove bundler/ and codemirror-bundle.js"
```

---

## Task 21: Build verification and smoke test

- [ ] **Step 1: Run the production build**

```bash
npm run build
```

Expected output:
```
vite v5.x.x building for production...
✓ X modules transformed.
frontend/dist/index.html       X kB
frontend/dist/assets/index-XXX.js   XXX kB
✓ built in Xs
```

No errors. Verify `frontend/dist/` exists and contains `index.html` and `assets/`.

- [ ] **Step 2: Start the backend and verify it serves the React app**

```bash
cd backend && uvicorn main:app --reload
```

Open `http://localhost:8000`. Expected: email gate overlay visible, fonts loaded, no JS console errors.

- [ ] **Step 3: Smoke test — email gate**

Enter a valid email (e.g. `test@example.com`) and click Continue. Expected: gate disappears, sidebar shows "No documents yet", statusbar shows "Ready".

- [ ] **Step 4: Smoke test — document save and load**

Type some code in the editor, click Save (💾), enter title "Test Doc", click Save. Expected: document appears in sidebar. Click on it to reload. Expected: code restores.

- [ ] **Step 5: Smoke test — code execution**

With code in editor, press Ctrl+Enter. Expected: output pane shows stdout/stderr/exit code.

- [ ] **Step 6: Smoke test — session**

Click Share (with a document loaded). Expected: share modal appears with URL. Open URL in a second browser tab. Expected: lobby appears. Start session. Expected: code syncs between tabs.

- [ ] **Step 7: Remove old frontend/index.html**

Only after smoke tests pass:

```bash
rm frontend/index.html.old  # if it was renamed
# The new frontend/index.html (Vite shell) should already be in place
```

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete React frontend migration"
```

---

## Self-Review Checklist

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Vite + React, outDir: dist | Task 1 |
| CSS migrated verbatim | Task 2 |
| utils (colors, session storage) | Task 3 |
| AppContext (email, session, isRunning, status) | Task 4 |
| EmailGate with localStorage 24h TTL | Task 6 |
| useDocuments CRUD | Task 7 |
| body.locked class management | Task 18 (App.jsx useEffect) |
| body.running class management | Task 18 (App.jsx useEffect) |
| CM6 uncontrolled editor | Task 13 |
| suppressSyncRef shared via editorRef | Task 13 + 14 |
| Echo suppression | Task 13 (updateListener) + Task 14 (code_change handler) |
| Remote cursors (StateField + effects) | Task 13 |
| useSession WebSocket + 3s reconnect | Task 14 |
| error WS message type | Task 14 |
| session_started → replaceState | Task 14 |
| session_ended/kicked → replaceState | Task 14 |
| Sidebar with session avatars + kick popover | Task 15 |
| Non-owner popover (email display only) | Task 15 |
| loadDocument guard while in session | Task 18 (handleLoadDoc) |
| Toolbar hide Share + New during session | Task 16 |
| run in session broadcasts run_result | Task 18 (handleRun) |
| SaveModal title prompt | Task 8 |
| ShareModal copy link | Task 9 |
| LobbyOverlay with email input for unauthed join | Task 17 |
| Lobby email submit triggers fetchDocuments | Task 18 (handleLobbyJoinWithEmail) |
| SessionModal ended + kicked | Task 10 |
| SessionModal dismiss clears URL | Task 18 (handleSessionModalDismiss) |
| Leave session clears URL | Task 18 (handleLeave) |
| Keyboard shortcuts Ctrl+Enter, Ctrl+S | Task 18 |
| Title bar input (#doc-title-input) | Task 18 (App.jsx JSX) |
| window.confirm() calls preserved | Tasks 7, 15, 18 |
| Google Fonts in index.html shell | Task 1 |
| Vite proxy replaces API_BASE hack | Task 1 |
| FastAPI pathlib absolute path | Task 19 |
| Old files removed | Task 20 |
