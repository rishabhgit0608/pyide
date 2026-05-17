import { useState, useCallback } from 'react';

/**
 * useConfirm — drop-in replacement for window.confirm()
 *
 * Returns { confirmNode, askConfirm }
 *
 * Usage:
 *   const { confirmNode, askConfirm } = useConfirm();
 *
 *   // In event handler:
 *   const ok = await askConfirm({ message: 'Delete?', confirm: 'Delete', danger: true });
 *   if (!ok) return;
 *
 *   // In JSX:
 *   {confirmNode}
 */
export function useConfirm() {
  const [state, setState] = useState(null); // { message, detail, confirm, danger, resolve }

  const askConfirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  function handleConfirm() {
    state?.resolve(true);
    setState(null);
  }

  function handleCancel() {
    state?.resolve(false);
    setState(null);
  }

  // The caller must render confirmNode somewhere in the tree
  const confirmNode = state ? {
    message: state.message,
    detail: state.detail,
    confirm: state.confirm,
    danger: state.danger,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  } : null;

  return { confirmNode, askConfirm };
}
