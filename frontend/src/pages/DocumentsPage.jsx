import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Upload, FileText, Trash2, CheckCircle, Clock, AlertCircle, RefreshCw, Sparkles, Landmark, Check, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Target Account selection for statement extraction
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Preview & Confirm Modal states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [extractedTxs, setExtractedTxs] = useState([]);
  const [selectedTxIndexes, setSelectedTxIndexes] = useState({});
  const [importing, setImporting] = useState(false);

  const fetchData = async () => {
    try {
      const [docsRes, accsRes] = await Promise.all([
        apiClient.get('/documents'),
        apiClient.get('/accounts')
      ]);
      setDocuments(docsRes.data);
      setAccounts(accsRes.data);
      if (accsRes.data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accsRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch page data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMsg(`Document "${file.name}" uploaded successfully! PyMuPDF text extraction & vector indexing in progress.`);

      if (res.data?.extracted_transactions && res.data.extracted_transactions.length > 0) {
        setExtractedTxs(res.data.extracted_transactions);
        const initialSelected = {};
        res.data.extracted_transactions.forEach((_, idx) => { initialSelected[idx] = true; });
        setSelectedTxIndexes(initialSelected);
        setShowPreviewModal(true);
      }
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload PDF document.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleStatementExtractUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF bank/credit card statements & financial bills are supported.');
      return;
    }

    if (!selectedAccountId) {
      setError('Please select a target account to link extracted transactions.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setParsing(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Upload for document storage & RAG indexing
      apiClient.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(() => {});

      // 2. Parse transactions semantically via AI / Heuristic engine
      const res = await apiClient.post('/documents/parse-pdf-direct', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!res.data || res.data.length === 0) {
        setError('No transaction entries or bill totals could be extracted from this PDF. Please verify document content.');
      } else {
        setExtractedTxs(res.data);
        const initialSelected = {};
        res.data.forEach((_, idx) => { initialSelected[idx] = true; });
        setSelectedTxIndexes(initialSelected);
        setShowPreviewModal(true);
      }
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse statement PDF.');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const toggleSelectTx = (index) => {
    setSelectedTxIndexes((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleSelectAll = () => {
    const allSelected = Object.keys(selectedTxIndexes).length === extractedTxs.length && Object.values(selectedTxIndexes).every(Boolean);
    const newSelected = {};
    extractedTxs.forEach((_, idx) => {
      newSelected[idx] = !allSelected;
    });
    setSelectedTxIndexes(newSelected);
  };

  const handleConfirmImport = async () => {
    const approvedTransactions = extractedTxs.filter((_, idx) => selectedTxIndexes[idx]);
    if (approvedTransactions.length === 0) {
      alert('Please select at least one transaction to import.');
      return;
    }

    const targetAccId = selectedAccountId || (accounts.length > 0 ? accounts[0].id : '');
    if (!targetAccId) {
      alert('Please select or create a target account to link extracted transactions.');
      return;
    }

    setImporting(true);
    try {
      const res = await apiClient.post('/documents/confirm-transactions', {
        account_id: targetAccId,
        transactions: approvedTransactions
      });

      setShowPreviewModal(false);
      setSuccessMsg(`Successfully imported ${res.data.imported_count} transaction(s) into "${res.data.account_name}". Updated Account Balance: ₹${res.data.new_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Dashboard Money Overview & Expenses updated!`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to import transactions.');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document and remove its indexed vector chunks?')) return;
    try {
      await apiClient.delete(`/documents/${id}`);
      fetchData();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const selectedCount = Object.values(selectedTxIndexes).filter(Boolean).length;
  const targetAccountObj = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Financial Documents & Statement Extractor</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Upload PDF bank statements, credit card bills & receipts for automated AI transaction extraction & RAG indexing.
          </p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary">
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

      {/* Target Account Link Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Landmark size={20} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>Target Account for PDF Statement Import:</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <select
              className="input-field"
              style={{ width: '260px' }}
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type.toUpperCase()} - ₹{acc.balance.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Unified PDF Upload Card */}
      <div className="glass-card" style={{ border: '2px dashed var(--accent-primary)', textAlign: 'center', padding: '2.5rem', position: 'relative', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(16,185,129,0.06))', marginBottom: '2rem' }}>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          disabled={uploading || parsing}
        />
        <div style={{ display: 'inline-flex', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.2))', padding: '1.25rem', borderRadius: '50%', marginBottom: '1rem', border: '1px solid var(--accent-primary)' }}>
          <Sparkles size={36} color="var(--accent-primary)" />
        </div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#fff' }}>
          {uploading || parsing ? 'Processing PDF & Extracting Financial Data...' : 'Upload Financial Bill or Statement PDF'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto 1rem' }}>
          Drag & drop or click to upload PDF bank statements, utility bills, receipts, or insurance policies. Automatic AI & heuristic extraction will index text for RAG AI chat and detect line-item transactions & bill totals.
        </p>
        <button className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem', pointerEvents: 'none' }}>
          <Upload size={18} /> Select PDF Document
        </button>
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

      {/* Preview & Confirm Transactions Modal */}
      {showPreviewModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                  Preview Extracted Transactions
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Target Account: <strong style={{ color: '#fff' }}>{targetAccountObj?.name || 'Selected Account'}</strong>
                </p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="btn btn-secondary" style={{ padding: '0.35rem 0.5rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px' }}>
              <button type="button" onClick={toggleSelectAll} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                {Object.values(selectedTxIndexes).every(Boolean) ? 'Deselect All' : 'Select All'}
              </button>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {selectedCount} of {extractedTxs.length} selected for import
              </div>
            </div>

            <div style={{ maxHeight: '360px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', width: '40px' }}>Import</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Date</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Description</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Category</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Type</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedTxs.map((tx, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: selectedTxIndexes[idx] ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!selectedTxIndexes[idx]}
                          onChange={() => toggleSelectTx(idx)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{tx.date}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{tx.description}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <span className="badge badge-info">{tx.category}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        {tx.type === 'income' ? (
                          <span className="badge badge-success" style={{ gap: '4px' }}>
                            <ArrowUpRight size={12} /> Income
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ gap: '4px' }}>
                            <ArrowDownLeft size={12} /> Expense
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: tx.type === 'income' ? 'var(--accent-success)' : '#fff' }}>
                        {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowPreviewModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmImport} className="btn btn-primary" disabled={importing || selectedCount === 0}>
                {importing ? 'Importing Transactions...' : `Confirm & Import ${selectedCount} Transaction(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
