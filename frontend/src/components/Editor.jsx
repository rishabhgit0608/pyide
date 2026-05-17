import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorView, keymap, Decoration, WidgetType } from '@codemirror/view';
import { EditorState, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { useApp } from '../context/AppContext.jsx';

// ── Remote cursor CM6 primitives ────────────────────────────
export const addCursorEffect    = StateEffect.define();
export const removeCursorEffect = StateEffect.define();

class RemoteCursorWidget extends WidgetType {
  constructor(color, name) { super(); this.color = color; this.name = name; }
  eq(other) { return other.color === this.color && other.name === this.name; }
  toDOM() {
    const beam  = document.createElement('span');
    beam.className = 'cm-remote-cursor';
    beam.style.setProperty('--rc', this.color);
    const label = document.createElement('span');
    label.className   = 'cm-remote-cursor-name';
    label.textContent = this.name;
    beam.appendChild(label);
    return beam;
  }
  ignoreEvent() { return true; }
}

const remoteCursorField = StateField.define({
  create() { return new Map(); },
  update(map, tr) {
    const next = new Map(map);
    for (const e of tr.effects) {
      if (e.is(addCursorEffect))          next.set(e.value.email, e.value);
      else if (e.is(removeCursorEffect))  next.delete(e.value);
    }
    return next;
  },
  provide(f) {
    return EditorView.decorations.from(f, map => {
      if (!map.size) return Decoration.none;
      const sorted = [...map.values()].sort((a, b) => a.pos - b.pos);
      const builder = new RangeSetBuilder();
      for (const c of sorted)
        builder.add(c.pos, c.pos,
          Decoration.widget({ widget: new RemoteCursorWidget(c.color, c.name), side: 1 }));
      return builder.finish();
    });
  },
});

const INITIAL_CODE = `# Welcome to PyIDE\nname = input("Enter your name: ")\nprint(f"Hello, {name}!")\n`;

const Editor = forwardRef(function Editor(
  { isInSession, sessionMembers, sendMessage, email },
  ref
) {
  const wrapperRef      = useRef(null);
  const viewRef         = useRef(null);
  const suppressSyncRef = useRef(false);
  const codeTimerRef    = useRef(null);
  const cursorTimerRef  = useRef(null);
  const { setStatus }   = useApp();

  // Expose API to parent (App.jsx)
  useImperativeHandle(ref, () => ({
    getCode:        () => viewRef.current?.state.doc.toString() ?? '',
    setCode:        (code) => {
      if (!viewRef.current) return;
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: code },
      });
    },
    dispatch:       (tr) => viewRef.current?.dispatch(tr),
    suppressSyncRef,
    addCursorEffect,
    removeCursorEffect,
    remoteCursorField,
    lineColToOffset: (line, col) => {
      const doc = viewRef.current?.state.doc;
      if (!doc || line < 1 || line > doc.lines) return 0;
      const ln = doc.line(line);
      return ln.from + Math.min(col, ln.length);
    },
    getSessionMembers: () => sessionMembersRef.current,
    clearCursors: () => {
      if (!viewRef.current) return;
      const map = viewRef.current.state.field(remoteCursorField);
      const effects = [...map.keys()].map(em => removeCursorEffect.of(em));
      if (effects.length) viewRef.current.dispatch({ effects });
    },
  }), []);

  // Keep refs fresh so updateListener closure never goes stale
  const sessionMembersRef = useRef(sessionMembers);
  const isInSessionRef    = useRef(isInSession);
  const emailRef          = useRef(email);
  const sendMessageRef    = useRef(sendMessage);
  useEffect(() => { sessionMembersRef.current = sessionMembers; }, [sessionMembers]);
  useEffect(() => { isInSessionRef.current = isInSession; }, [isInSession]);
  useEffect(() => { emailRef.current = email; }, [email]);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // Create editor once on mount
  useEffect(() => {
    const view = new EditorView({
      doc: INITIAL_CODE,
      extensions: [
        basicSetup,
        python(),
        oneDark,
        keymap.of([indentWithTab]),
        EditorView.theme({
          '.cm-scroller': { fontFamily: '"JetBrains Mono","Fira Code",monospace' },
        }),
        remoteCursorField,
        EditorView.updateListener.of((update) => {
          if (!isInSessionRef.current || suppressSyncRef.current) return;
          if (update.docChanged) {
            clearTimeout(codeTimerRef.current);
            codeTimerRef.current = setTimeout(() => {
              sendMessageRef.current({
                type: 'code_change',
                code: view.state.doc.toString(),
                email: emailRef.current,
              });
            }, 300);
          }
          if (update.selectionSet) {
            clearTimeout(cursorTimerRef.current);
            cursorTimerRef.current = setTimeout(() => {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              sendMessageRef.current({
                type: 'cursor',
                line: line.number,
                col: head - line.from,
                email: emailRef.current,
              });
            }, 80);
          }
        }),
      ],
      parent: wrapperRef.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []); // mount only — intentional empty deps

  return (
    // Editor renders only the CM6 wrapper — App.jsx owns the outer #editor-pane shell
    <div id="editor-wrapper" ref={wrapperRef} />
  );
});

export default Editor;
