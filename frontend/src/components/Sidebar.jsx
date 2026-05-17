import { useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatDate, initials, memberColor } from '../utils.js';

export default function Sidebar({
  docs, currentDocId, onLoad, onDelete, loadDocs,
  sessionMembers, sessionStarted, isOwner, email,
  sendMessage, askConfirm,
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

  async function kickMember(memberEmail) {
    const ok = await askConfirm({
      message: `Kick ${memberEmail}?`,
      detail: 'They will be removed from the session immediately.',
      confirm: 'Kick',
      danger: true,
    });
    if (!ok) return;
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
