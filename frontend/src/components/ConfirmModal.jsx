import { useEffect, useRef } from 'react';

/**
 * ConfirmModal — replaces window.confirm()
 *
 * Props:
 *   message  string          Body text
 *   detail   string?         Optional sub-text (smaller, muted)
 *   confirm  string          Label for the destructive / confirm button (default "Confirm")
 *   danger   boolean         If true, confirm button is red (default false)
 *   onConfirm () => void
 *   onCancel  () => void
 */
export default function ConfirmModal({ message, detail, confirm = 'Confirm', danger = false, onConfirm, onCancel }) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    // Focus confirm button so Enter submits, Escape cancels
    confirmBtnRef.current?.focus();
    function handler(e) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="overlay show" style={{ zIndex: 300 }}>
      <div className="confirm-modal-box">
        <p className="confirm-modal-message">{message}</p>
        {detail && <p className="confirm-modal-detail">{detail}</p>}
        <div className="confirm-modal-btns">
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button
            ref={confirmBtnRef}
            className={danger ? 'danger-btn' : 'confirm-btn'}
            onClick={onConfirm}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
