import { useApp } from '../context/AppContext.jsx';
import { clearSession } from '../utils.js';

export default function Toolbar({
  email, currentDocId, sessionStarted, isRunning,
  onRun, onSave, onShare, onLeave, onNew, onChangeEmail,
}) {
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
