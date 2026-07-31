import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, StickyNote, Trash2, CheckCircle, Sparkles } from 'lucide-react';

export const NotesPage = () => {
  const [notes, setNotes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const fetchNotes = async () => {
    try {
      const res = await apiClient.get('/notes');
      setNotes(res.data);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/notes', { title, content });
      setShowModal(false);
      setTitle('');
      setContent('');
      fetchNotes();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create note');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete note and purge vector embeddings?')) return;
    try {
      await apiClient.delete(`/notes/${id}`);
      fetchNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Free-Text Financial Notes</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Store financial notes, policy terms, & tax notes. Automatically chunked & indexed for RAG search.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> New Note
        </button>
      </div>

      <div className="grid-2">
        {notes.map((n) => (
          <div key={n.id} className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <StickyNote size={20} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.15rem' }}>{n.title}</h3>
              </div>
              <button onClick={() => handleDelete(n.id)} className="btn btn-danger" style={{ padding: '0.35rem' }}>
                <Trash2 size={14} />
              </button>
            </div>

            <p style={{ color: '#d1d5db', fontSize: '0.9rem', whiteSpace: 'pre-line', marginBottom: '1rem', background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '8px' }}>
              {n.content}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span className="badge badge-success">
                <Sparkles size={12} style={{ marginRight: '4px' }} /> Indexed in Vector DB
              </span>
              <span>{new Date(n.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Create RAG Financial Note</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Note Title</label>
                <input type="text" className="input-field" placeholder="e.g. Tax Saving 80C Summary / Health Insurance Terms" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Content</label>
                <textarea 
                  className="input-field" 
                  rows={6} 
                  placeholder="Paste policy terms, goal notes, or tax details here..." 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save & Vector Index</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
