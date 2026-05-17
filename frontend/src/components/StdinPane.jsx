import { useState, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';

const StdinPane = forwardRef(function StdinPane({ isInSession, sendMessage, email }, ref) {
  const [value, setValue] = useState('');
  const timerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    setValue: (v) => setValue(v),
  }), [value]);

  // Clear pending debounce on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleChange(e) {
    const v = e.target.value;
    setValue(v);
    if (!isInSession) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      sendMessage({ type: 'stdin_change', stdin: v, email });
    }, 300);
  }

  return (
    <div id="stdin-section">
      <div id="stdin-label">Stdin</div>
      <textarea
        id="stdin-input"
        placeholder="Program input..."
        value={value}
        onChange={handleChange}
      />
    </div>
  );
});

export default StdinPane;
