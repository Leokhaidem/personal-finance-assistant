import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, StickyNote, Trash2, CheckCircle, Sparkles, Search, Copy, Check, FileText } from 'lucide-react';

const NOTE_TEMPLATES = [
  {
    title: '📝 Section 80C Tax Deduction Plan',
    content: '1. EPF Contribution: ₹1,50,000 max limit.\n2. ELSS Mutual Funds: Tax saving equity scheme.\n3. PPF: Public Provident Fund 15yr lock-in.\n4. Term Life Insurance Premium Receipts.'
  },
  {
    title: '🏥 Health Insurance Policy Summary',
    content: 'Policy No: HDFCERGO-987654\nSum Insured: ₹10,00,000\nNo Claim Bonus: 20%\nCovered: Day care procedures, cashless hospitalization at Apollo & Fortis.'
  },
  {
    title: '📋 Monthly Financial Review Checklist',
    content: '• Review monthly salary credits & budget targets.\n• Verify credit card statement line items.\n• Transfer surplus funds to Emergency Fund.\n• Check upcoming bill due dates.'
  }
];

const GRADIENT_ACCENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #ec4899, #db2777)',
  'linear-gradient(135deg, #3b82f6, #2563eb)'
];

export const NotesPage = () => {
  const [notes, setNotes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Form states
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

  const applyTemplate = (tpl) => {
    setTitle(tpl.title);
    setContent(tpl.content);
    setShowModal(true);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  const filteredNotes = notes.filter((n) => {
    const q = searchQuery.toLowerCase();
    return (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q);
  });

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <StickyNote size={28} color="var(--accent-primary)" /> Free-Text Financial Notes
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Store financial notes, tax plans, & insurance policies.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
          <Plus size={18} /> New Financial Note
        </button>
      </div>

      {/* Filter & Templates Bar */}
      <div className="glass-card" style={{ marginBottom: '2rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 260px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search notes or policy terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Templates */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Templates:</span>
            {NOTE_TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                onClick={() => applyTemplate(tpl)}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', borderRadius: '16px' }}
              >
                + {tpl.title.split(' ')[1]} {tpl.title.split(' ')[2]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid-2">
        {filteredNotes.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <StickyNote size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h3>No Financial Notes Found</h3>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '1.25rem' }}>
              Create a free-text note or select a template above to add knowledge to your assistant.
            </p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus size={16} /> Create First Note
            </button>
          </div>
        ) : (
          filteredNotes.map((n, idx) => {
            const gradient = GRADIENT_ACCENTS[idx % GRADIENT_ACCENTS.length];
            const wordCount = (n.content || '').split(/\s+/).filter(Boolean).length;

            return (
              <div
                key={n.id}
                className="glass-card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {/* Header Gradient Accent Strip */}
                <div style={{ background: gradient, padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StickyNote size={20} color="#fff" />
                    <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>{n.title}</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleCopy(n.id, `${n.title}\n\n${n.content}`)}
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.5rem', background: 'rgba(0,0,0,0.3)', border: 'none' }}
                      title="Copy Note Text"
                    >
                      {copiedId === n.id ? <Check size={14} color="#10b981" /> : <Copy size={14} color="#fff" />}
                    </button>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="btn btn-danger"
                      style={{ padding: '0.3rem 0.5rem', background: 'rgba(239,68,68,0.3)', border: 'none' }}
                      title="Delete Note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '1.25rem' }}>
                  <p style={{ color: '#e5e7eb', fontSize: '0.9rem', whiteSpace: 'pre-line', marginBottom: '1.25rem', lineHeight: '1.5', background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {n.content}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span className="badge badge-success" style={{ gap: '4px' }}>
                      <Sparkles size={12} /> Indexed in RAG Vector DB
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {wordCount} words • {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StickyNote size={20} color="var(--accent-primary)" /> Create RAG Financial Note
            </h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Note Title</label>
                <input type="text" className="input-field" placeholder="e.g. Tax Saving 80C Summary / Health Insurance Terms" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Content</label>
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
