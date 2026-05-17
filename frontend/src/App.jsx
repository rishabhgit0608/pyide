import { useRef, useState, useEffect } from 'react';
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

  // Fetch docs when email is set (covers EmailGate submit)
  useEffect(() => {
    if (email) loadDocs(email);
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps

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
