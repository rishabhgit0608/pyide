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
