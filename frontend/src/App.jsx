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

// ── Saved toast ────────────────────────────────────────────────
function SavedToast({ show }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        right: 28,
        background: '#22c55e',
        color: '#fff',
        fontFamily: '"Syne", sans-serif',
        fontWeight: 700,
        fontSize: 13,
        padding: '8px 16px',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 20px #0006',
        transition: 'opacity 0.3s, transform 0.3s',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <span style={{ fontSize: 16 }}>✓</span> Code saved
    </div>
  );
}

// ── Drag handle (vertical divider between panes) ───────────────
function DragHandle({ onDrag }) {
  const dragging = useRef(false);

  function onMouseDown(e) {
    e.preventDefault();
    dragging.current = true;
    function move(e) { if (dragging.current) onDrag(e.clientX); }
    function up()   { dragging.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 5,
        cursor: 'col-resize',
        background: 'var(--border)',
        flexShrink: 0,
        transition: 'background 0.15s',
        zIndex: 10,
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--border)'}
    />
  );
}

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
  const editorRef = useRef(null);
  const stdinRef  = useRef(null);

  // UI state
  const [showSaveModal, setShowSaveModal]   = useState(false);
  const [saveModalCb,   setSaveModalCb]     = useState(null);
  const [shareLink,     setShareLink]       = useState('');
  const [showLobby,     setShowLobby]       = useState(false);
  const [lobbyStatus,   setLobbyStatus]     = useState('');
  const [sessionModal,  setSessionModal]    = useState(null);

  // Panel layout state
  // sidebarW: px width of sidebar (null = collapsed)
  // outputW: px width of output pane (null = collapsed)
  const [sidebarW,   setSidebarW]   = useState(220);
  const [outputW,    setOutputW]    = useState(null); // start: auto (percentage via CSS)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [outputOpen,  setOutputOpen]  = useState(true);
  const mainRef = useRef(null);

  // Auto-save toast
  const [showToast,  setShowToast]  = useState(false);
  const toastTimer = useRef(null);

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
    if (email) document.body.classList.remove('locked');
    else       document.body.classList.add('locked');
  }, [email]);

  // body.running management
  useEffect(() => {
    if (isRunning) document.body.classList.add('running');
    else           document.body.classList.remove('running');
  }, [isRunning]);

  // Init: restore session from localStorage, check URL
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
      if (sid) { setSessionId(sid); setShowLobby(true); }
    }
  }, []); // mount only

  useEffect(() => {
    if (email) loadDocs(email);
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save every 5 s ────────────────────────────────────
  const autoSaveRef = useRef(null);
  const currentDocRef = useRef(currentDoc);
  const emailRef = useRef(email);
  useEffect(() => { currentDocRef.current = currentDoc; }, [currentDoc]);
  useEffect(() => { emailRef.current = email; }, [email]);

  useEffect(() => {
    autoSaveRef.current = setInterval(async () => {
      const doc  = currentDocRef.current;
      const em   = emailRef.current;
      if (!em || !doc?.id) return; // only save existing docs
      const code  = editorRef.current?.getCode() ?? '';
      const stdin = stdinRef.current?.getValue() ?? '';
      const title = doc.title || 'Untitled';
      const result = await saveDoc(title, code, stdin);
      if (result) {
        clearTimeout(toastTimer.current);
        setShowToast(true);
        toastTimer.current = setTimeout(() => setShowToast(false), 2000);
      }
    }, 5000);
    return () => clearInterval(autoSaveRef.current);
  }, [saveDoc]);

  // ── Lobby ──────────────────────────────────────────────────
  async function openLobby(sid, forEmail) {
    setSessionId(sid);
    setShowLobby(true);
    setLobbyStatus('Connecting...');
    if (!forEmail) return;
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
      const result = await saveDoc(title || 'Untitled', code, stdin);
      if (result) {
        clearTimeout(toastTimer.current);
        setShowToast(true);
        toastTimer.current = setTimeout(() => setShowToast(false), 2000);
      }
    } else if (title) {
      await saveDoc(title, code, stdin);
    } else {
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

  // ── Panel resize via drag ──────────────────────────────────
  function handleSidebarDrag(clientX) {
    if (!mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const w = Math.max(160, Math.min(400, clientX - rect.left));
    setSidebarW(w);
    setSidebarOpen(true);
  }

  function handleOutputDrag(clientX) {
    if (!mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const w = Math.max(180, Math.min(rect.width * 0.6, rect.right - clientX));
    setOutputW(w);
    setOutputOpen(true);
  }

  // ── Ctrl+B: toggle sidebar + output collapse ───────────────
  useEffect(() => {
    function handler(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') { e.preventDefault(); handleRun(); }
      if (mod && e.key === 's')     { e.preventDefault(); handleSave(); }
      if (mod && e.key === 'b')     {
        e.preventDefault();
        const anyOpen = sidebarOpen || outputOpen;
        setSidebarOpen(!anyOpen);
        setOutputOpen(!anyOpen);
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [email, currentDoc, sessionStarted, sidebarOpen, outputOpen]);

  // ── Sidebar computed width ─────────────────────────────────
  const sidebarStyle = sidebarOpen
    ? { width: sidebarW, flexShrink: 0 }
    : { width: 0, overflow: 'hidden', flexShrink: 0 };

  const outputStyle = outputOpen
    ? { width: outputW ?? '38%', minWidth: 180, flexShrink: 0 }
    : { width: 0, overflow: 'hidden', flexShrink: 0 };

  return (
    <>
      {!email && <EmailGate />}

      <Toolbar
        email={email}
        currentDocId={currentDoc?.id}
        sessionStarted={sessionStarted}
        isRunning={isRunning}
        sidebarOpen={sidebarOpen}
        outputOpen={outputOpen}
        onRun={handleRun}
        onSave={handleSave}
        onShare={handleShare}
        onLeave={handleLeave}
        onNew={handleNew}
        onChangeEmail={handleChangeEmail}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        onToggleOutput={() => setOutputOpen(o => !o)}
      />

      <div id="main" ref={mainRef}>
        {/* Sidebar */}
        <div style={{ ...sidebarStyle, display: 'flex', flexDirection: 'column', transition: 'width 0.18s' }}>
          {sidebarOpen && (
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
          )}
        </div>

        {/* Drag handle: sidebar ↔ editor */}
        <DragHandle onDrag={handleSidebarDrag} />

        <div id="editor-area">
          <div id="doc-title-bar">
            <input
              id="doc-title-input"
              type="text"
              placeholder="Untitled"
              maxLength={120}
              value={currentDoc?.title || ''}
              onChange={e => setCurrentDoc(prev => prev
                ? { ...prev, title: e.target.value }
                : { id: null, title: e.target.value, code: '', stdin: '' }
              )}
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

            {/* Drag handle: editor ↔ output */}
            <DragHandle onDrag={handleOutputDrag} />

            {/* Output pane */}
            <div style={{ ...outputStyle, display: 'flex', flexDirection: 'column', transition: 'width 0.18s' }}>
              {outputOpen && (
                <OutputPane runResult={runResult} isRunning={isRunning} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div id="statusbar">
        {status}
        {/* Panel toggle buttons in statusbar */}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            title="Toggle sidebar (Ctrl+B)"
            style={{ background: 'none', border: 'none', color: sidebarOpen ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
          >⊞ Docs</button>
          <button
            onClick={() => setOutputOpen(o => !o)}
            title="Toggle output (Ctrl+B)"
            style={{ background: 'none', border: 'none', color: outputOpen ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
          >⊞ Output</button>
        </span>
      </div>

      <SavedToast show={showToast} />

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
