import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';

export function useDocuments(askConfirm) {
  const { email, setStatus } = useApp();
  const [docs, setDocs]           = useState([]);
  const [currentDoc, setCurrentDoc] = useState(null); // { id, title, code, stdin }

  const loadDocs = useCallback(async (forEmail) => {
    if (!forEmail) return;
    try {
      const resp = await fetch(`/documents/${encodeURIComponent(forEmail)}`);
      if (!resp.ok) throw new Error('fetch failed');
      setDocs(await resp.json());
    } catch (err) {
      setStatus('Error loading documents: ' + err.message);
    }
  }, [setStatus]);

  const saveDoc = useCallback(async (title, code, stdin) => {
    if (!email) return null;
    try {
      if (currentDoc?.id) {
        const resp = await fetch(`/documents/${currentDoc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, code, stdin }),
        });
        if (!resp.ok) { const e = await resp.json(); throw new Error(e.detail || 'Update failed'); }
        const updated = await resp.json();
        setDocs(prev => prev.map(d => d.id === currentDoc.id ? updated : d));
        setCurrentDoc(prev => ({ ...prev, title: updated.title }));
        setStatus(`Saved: ${updated.title}`);
        return updated;
      } else {
        const resp = await fetch('/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, title, code, stdin }),
        });
        if (!resp.ok) { const e = await resp.json(); throw new Error(e.detail || 'Save failed'); }
        const doc = await resp.json();
        setCurrentDoc({ id: doc.id, title: doc.title, code, stdin });
        await loadDocs(email);
        setStatus(`Saved: ${doc.title}`);
        return doc;
      }
    } catch (err) {
      setStatus('Save error: ' + err.message);
      return null;
    }
  }, [email, currentDoc, loadDocs, setStatus]);

  const deleteDoc = useCallback(async (docId) => {
    const ok = await askConfirm({
      message: 'Delete this document?',
      detail: 'This action cannot be undone.',
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const resp = await fetch(`/documents/${docId}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Delete failed');
      if (currentDoc?.id === docId) setCurrentDoc(null);
      await loadDocs(email);
      setStatus('Document deleted.');
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  }, [email, currentDoc, loadDocs, setStatus]);

  return { docs, loadDocs, saveDoc, deleteDoc, currentDoc, setCurrentDoc };
}
