import { useState, useEffect, useRef } from 'react';
import { isValidEmail, saveSession } from '../utils.js';
import { useApp } from '../context/AppContext.jsx';

export default function EmailGate() {
  const { setEmail, setStatus } = useApp();
  const [value, setValue]   = useState('');
  const [error, setError]   = useState(false);
  const inputRef            = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  function attempt() {
    const trimmed = value.trim();
    if (!isValidEmail(trimmed)) {
      setError(true);
      return;
    }
    setError(false);
    saveSession(trimmed);
    setEmail(trimmed);
    setStatus('Ready');
  }

  return (
    <div id="email-gate">
      <div id="gate-card">
        <div className="gate-wordmark">PyIDE</div>
        <h2>Welcome back</h2>
        <p>Enter your email to access your workspace</p>
        <input
          ref={inputRef}
          id="gate-email-input"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          className={error ? 'error' : ''}
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onKeyDown={e => { if (e.key === 'Enter') attempt(); }}
        />
        <div id="gate-email-error" className={error ? 'show' : ''}>
          Please enter a valid email address
        </div>
        <button id="gate-continue-btn" onClick={attempt}>Continue →</button>
      </div>
    </div>
  );
}
