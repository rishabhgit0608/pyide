import { useState } from 'react';
import { isValidEmail, saveSession } from '../utils.js';
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
