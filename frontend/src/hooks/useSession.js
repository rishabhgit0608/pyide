import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { memberColor } from '../utils.js';

// editorRef: ref returned from Editor (exposes getCode/setCode/dispatch/suppressSyncRef etc.)
// stdinRef:  ref returned from StdinPane (exposes getValue/setValue)
// onSessionModal: (type: 'ended'|'kicked') => void
export function useSession(editorRef, stdinRef, onSessionModal) {
  const {
    email, sessionId, setSessionMembers, setSessionStarted, setStatus,
  } = useApp();

  const [runResult, setRunResult] = useState(null);
  const wsRef      = useRef(null);
  const destroyedRef = useRef(false);

  const sendMessage = useCallback((obj) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !email) return;
    destroyedRef.current = false;

    function connect() {
      if (destroyedRef.current) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${proto}//${window.location.host}/ws/${sessionId}/${encodeURIComponent(email)}`
      );
      wsRef.current = ws;

      ws.onclose = () => {
        wsRef.current = null;
        // Auto-reconnect only while session is active
        setTimeout(() => {
          if (!destroyedRef.current) connect();
        }, 3000);
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        handleMessage(msg);
      };
    }

    function handleMessage(msg) {
      const editor = editorRef.current;
      const stdin  = stdinRef.current;

      switch (msg.type) {
        case 'lobby_update': {
          const members = msg.members.map((em, i) => ({ email: em, color: memberColor(i) }));
          setSessionMembers(members);
          break;
        }

        case 'session_started': {
          setSessionStarted(true);
          if (editor) {
            editor.suppressSyncRef.current = true;
            editor.setCode(msg.code || '');
            if (stdin) stdin.setValue(msg.stdin || '');
            editor.suppressSyncRef.current = false;
          }
          history.replaceState({}, '', `?session=${sessionId}`);
          setStatus('🟢 Live session — changes sync to all members');
          break;
        }

        case 'code_change': {
          if (msg.email !== email && editor) {
            // Remove remote cursor for this member (re-appears on next cursor msg)
            editor.dispatch({ effects: editor.removeCursorEffect.of(msg.email) });
            editor.suppressSyncRef.current = true;
            editor.setCode(msg.code);
            editor.suppressSyncRef.current = false;
          }
          break;
        }

        case 'stdin_change': {
          if (msg.email !== email && stdin) {
            stdin.setValue(msg.stdin);
          }
          break;
        }

        case 'run_result': {
          setRunResult(msg);
          setStatus(`Run by ${msg.triggered_by} — exit ${msg.exit_code}`);
          break;
        }

        case 'cursor': {
          if (msg.email !== email && editor) {
            const pos = editor.lineColToOffset(msg.line, msg.col);
            const members = editor.getSessionMembers();
            const idx = members.findIndex(m => m.email === msg.email);
            const color = memberColor(idx >= 0 ? idx : 0);
            editor.dispatch({
              effects: editor.addCursorEffect.of({
                email: msg.email,
                pos,
                color,
                name: msg.email.split('@')[0],
              }),
            });
          }
          break;
        }

        case 'member_disconnected': {
          setSessionMembers(prev => {
            const next = prev.filter(m => m.email !== msg.email);
            return next.map((m, i) => ({ ...m, color: memberColor(i) }));
          });
          if (editor) {
            editor.dispatch({ effects: editor.removeCursorEffect.of(msg.email) });
          }
          break;
        }

        case 'session_ended': {
          cleanup();
          onSessionModal('ended');
          // URL cleared by SessionModal on dismiss (spec ownership table)
          break;
        }

        case 'kicked': {
          cleanup();
          onSessionModal('kicked');
          // URL cleared by SessionModal on dismiss (spec ownership table)
          break;
        }

        case 'error': {
          setStatus('Session error: ' + msg.message);
          break;
        }
      }
    }

    function cleanup() {
      setSessionStarted(false);
      setSessionMembers([]);
      // Clear all remote cursor decorations via the helper exposed in Editor's useImperativeHandle
      editorRef.current?.clearCursors();
    }

    connect();

    return () => {
      destroyedRef.current = true;
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionId, email]); // reconnect if sessionId or email changes

  return { sendMessage, runResult, setRunResult };
}
