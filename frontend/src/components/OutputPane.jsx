import { useEffect, useRef } from 'react';

export default function OutputPane({ runResult, isRunning }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [runResult]);

  let content;
  if (isRunning) {
    content = <span className="out-placeholder">Running...</span>;
  } else if (!runResult) {
    content = <span className="out-placeholder">Run your code to see output.</span>;
  } else {
    const parts = [];
    if (runResult.triggered_by) {
      parts.push(
        <span key="by" className="out-run-by">▶ Run by: {runResult.triggered_by}</span>
      );
    }
    if (runResult.timed_out) {
      parts.push(
        <span key="timeout" className="out-timeout">⏱ Timed out after 10 seconds{'\n'}</span>
      );
    }
    if (runResult.stdout) {
      parts.push(<span key="stdout" className="out-stdout">{runResult.stdout}</span>);
    }
    if (runResult.stderr) {
      parts.push(<span key="stderr" className="out-stderr">{runResult.stderr}</span>);
    }
    parts.push(
      <span key="exit" className="out-exit">{'\n'}─── exit {runResult.exit_code} ───</span>
    );
    content = parts;
  }

  return (
    <div id="output-pane">
      <div id="output-label">Output</div>
      <div id="output-content" ref={scrollRef}>
        {content}
      </div>
    </div>
  );
}
