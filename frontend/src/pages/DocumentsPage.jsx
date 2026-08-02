import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Upload, FileText, Trash2, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

export const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchDocuments = async () => {
    try {
      const res = await apiClient.get('/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported for automated statement/policy scanning.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMsg(`Document "${file.name}" uploaded successfully! PyMuPDF text extraction & vector indexing in progress.`);
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload PDF document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document and remove its indexed vector chunks?')) return;
    try {
      await apiClient.delete(`/documents/${id}`);
      fetchDocuments();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Financial Documents & Statements</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Upload PDF bank statements, insurance policies, tax notes & bill receipts for automated text extraction & RAG indexing.
          </p>
        </div>
        <button onClick={fetchDocuments} className="btn btn-secondary">
          <RefreshCw size={16} /> Refresh Status
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-danger)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} /> <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} /> <span>{successMsg}</span>
        </div>
      )}

      {/* File Upload Box */}
      <div className="glass-card" style={{ border: '2px dashed var(--border-glow)', textAlign: 'center', padding: '2.5rem', marginBottom: '2rem', cursor: 'pointer', position: 'relative' }}>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          disabled={uploading}
        />
        <div style={{ display: 'inline-flex', background: 'rgba(99,102,241,0.15)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
          <Upload size={36} color="var(--accent-primary)" />
        </div>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>
          {uploading ? 'Processing PDF & Extracting Text...' : 'Click or Drag & Drop PDF Document'}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Supports PDF Bank Statements, Policy Terms, Tax Documents (up to 50MB)
        </p>
      </div>

      {/* Document List */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Uploaded & Indexed Documents ({documents.length})</h3>

        {documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No financial documents uploaded yet. Upload a PDF statement or policy document above to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Document Name</th>
                  <th style={{ padding: '0.75rem' }}>File Size</th>
                  <th style={{ padding: '0.75rem' }}>Pages</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Uploaded Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <FileText size={18} color="var(--accent-primary)" />
                      {doc.title}
                    </td>
                    <td style={{ padding: '0.85rem', color: 'var(--text-secondary)' }}>
                      {(doc.file_size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td style={{ padding: '0.85rem', color: 'var(--text-secondary)' }}>
                      {doc.num_pages} Page{doc.num_pages > 1 ? 's' : ''}
                    </td>
                    <td style={{ padding: '0.85rem' }}>
                      {doc.status === 'ready' && (
                        <span className="badge badge-success">
                          <CheckCircle size={12} style={{ marginRight: '4px' }} /> Indexed (RAG Ready)
                        </span>
                      )}
                      {doc.status === 'processing' && (
                        <span className="badge badge-warning">
                          <Clock size={12} style={{ marginRight: '4px' }} /> Processing Text...
                        </span>
                      )}
                      {doc.status === 'failed' && (
                        <span className="badge badge-danger">
                          <AlertCircle size={12} style={{ marginRight: '4px' }} /> Extraction Failed
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.85rem', textAlign: 'right' }}>
                      <button onClick={() => handleDelete(doc.id)} className="btn btn-danger" style={{ padding: '0.4rem 0.6rem' }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
