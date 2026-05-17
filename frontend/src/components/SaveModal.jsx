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
