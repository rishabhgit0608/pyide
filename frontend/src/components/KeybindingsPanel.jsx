import { useEffect } from 'react';

const GROUPS = [
  {
    title: 'Editor',
    bindings: [
      { keys: ['Ctrl', 'Enter'],  desc: 'Run code' },
      { keys: ['Ctrl', 'S'],      desc: 'Save document' },
      { keys: ['Tab'],            desc: 'Indent / insert spaces' },
      { keys: ['Shift', 'Tab'],   desc: 'Dedent' },
      { keys: ['Ctrl', 'Z'],      desc: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
      { keys: ['Ctrl', '/'],      desc: 'Toggle line comment' },
    ],
  },
  {
    title: 'Layout',
    bindings: [
      { keys: ['Ctrl', 'B'],  desc: 'Toggle sidebar + output' },
      { keys: ['Ctrl', 'K'],  desc: 'Open keyboard shortcuts' },
    ],
  },
  {
    title: 'Session',
    bindings: [
      { keys: ['Ctrl', 'Shift', 'C'], desc: 'Copy share link (when session active)' },
    ],
  },
];

export default function KeybindingsPanel({ onClose }) {
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="overlay show" style={{ zIndex: 300 }} onClick={onClose}>
      <div className="kb-panel" onClick={e => e.stopPropagation()}>
        <div className="kb-header">
          <span className="kb-title">Keyboard Shortcuts</span>
          <button className="kb-close" onClick={onClose}>✕</button>
        </div>
        <div className="kb-body">
          {GROUPS.map(group => (
            <div key={group.title} className="kb-group">
              <div className="kb-group-label">{group.title}</div>
              {group.bindings.map(b => (
                <div key={b.desc} className="kb-row">
                  <span className="kb-desc">{b.desc}</span>
                  <span className="kb-keys">
                    {b.keys.map((k, i) => (
                      <span key={i}>
                        <kbd>{k}</kbd>
                        {i < b.keys.length - 1 && <span className="kb-plus">+</span>}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="kb-footer">Press <kbd>Esc</kbd> or click outside to close</div>
      </div>
    </div>
  );
}
