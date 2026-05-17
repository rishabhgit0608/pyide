export default function SessionModal({ type, onDismiss }) {
  const isEnded = type === 'ended';

  return (
    <div className="overlay show" id={isEnded ? 'session-ended-overlay' : 'kicked-overlay'}>
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
