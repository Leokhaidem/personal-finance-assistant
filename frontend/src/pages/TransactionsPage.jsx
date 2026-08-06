import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { Plus, Filter, Trash2, ArrowUpRight, ArrowDownLeft, Landmark, Sparkles, Upload, FileText, Check, X, AlertCircle } from 'lucide-react';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  // PDF Extract state
  const [parsingPdf, setParsingPdf] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [extractedTxs, setExtractedTxs] = useState([]);
  const [selectedTxIndexes, setSelectedTxIndexes] = useState({});
  const [importing, setImporting] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const fileInputRef = useRef(null);

  // Quick account creation inside modal
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState('bank');
  const [newAccBalance, setNewAccBalance] = useState('0');

  // Transaction form states
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [description, setDescription] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txType, setTxType] = useState('expense');

  const fetchData = async () => {
    try {
      let url = '/transactions?page=1&page_size=50';
      if (categoryFilter) url += `&category=${encodeURIComponent(categoryFilter)}`;
      if (typeFilter) url += `&type=${typeFilter}`;

      const [txRes, accRes] = await Promise.all([
        apiClient.get(url),
        apiClient.get('/accounts')
      ]);
      setTransactions(txRes.data);
      setAccounts(accRes.data);
      if (accRes.data.length > 0 && !accountId) {
        setAccountId(accRes.data[0].id);
      }
      setSelectedTxIds(new Set());
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryFilter, typeFilter]);

  const toggleSelectTx = (id) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.size === transactions.length && transactions.length > 0) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedTxIds);
    if (ids.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${ids.length} selected transaction(s)? Account balances will be updated accordingly.`)) {
      return;
    }

    setDeleting(true);
    try {
      await apiClient.post('/transactions/bulk-delete', { transaction_ids: ids });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete selected transactions.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateAccountInline = async (e) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    try {
      const res = await apiClient.post('/accounts', {
        name: newAccName,
        type: newAccType,
        balance: parseFloat(newAccBalance || 0)
      });
      const updatedAccs = [...accounts, res.data];
      setAccounts(updatedAccs);
      setAccountId(res.data.id);
      setShowAccountForm(false);
      setNewAccName('');
      setNewAccBalance('0');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create account');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!accountId) {
      alert('Please select or create an account first.');
      return;
    }
    try {
      await apiClient.post('/transactions', {
        account_id: accountId,
        amount: parseFloat(amount),
        category,
        description,
        date: txDate,
        type: txType
      });
      setShowModal(false);
      setAmount('');
      setDescription('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create transaction');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete transaction record? Account balance will be updated.')) return;
    try {
      await apiClient.delete(`/transactions/${id}`);
      fetchData();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF bank/credit card statements and financial bills are supported.');
      return;
    }

    setPdfError('');
    setParsingPdf(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      apiClient.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(() => {});

      const res = await apiClient.post('/documents/parse-pdf-direct', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!res.data || res.data.length === 0) {
        alert('No transaction entries or bill totals could be extracted from this PDF. Please check the document format.');
      } else {
        setExtractedTxs(res.data);
        const initialSelected = {};
        res.data.forEach((_, idx) => { initialSelected[idx] = true; });
        setSelectedTxIndexes(initialSelected);
        setShowPreviewModal(true);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to parse statement/bill PDF.');
    } finally {
      setParsingPdf(false);
      e.target.value = '';
    }
  };

  const toggleSelectTxIndex = (index) => {
    setSelectedTxIndexes((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleSelectAllPdf = () => {
    const allSelected = Object.keys(selectedTxIndexes).length === extractedTxs.length && Object.values(selectedTxIndexes).every(Boolean);
    const newSelected = {};
    extractedTxs.forEach((_, idx) => {
      newSelected[idx] = !allSelected;
    });
    setSelectedTxIndexes(newSelected);
  };

  const handleConfirmPdfImport = async () => {
    const approvedTransactions = extractedTxs.filter((_, idx) => selectedTxIndexes[idx]);
    if (approvedTransactions.length === 0) {
      alert('Please select at least one transaction to import.');
      return;
    }

    const targetAccId = accountId || (accounts.length > 0 ? accounts[0].id : '');
    if (!targetAccId) {
      alert('Please select or create a target account first.');
      return;
    }

    setImporting(true);
    try {
      const res = await apiClient.post('/documents/confirm-transactions', {
        account_id: targetAccId,
        transactions: approvedTransactions
      });

      setShowPreviewModal(false);
      alert(`Successfully imported ${res.data.imported_count} transaction(s) into "${res.data.account_name}"! Updated Balance: ₹${res.data.new_balance.toLocaleString('en-IN')}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to import transactions.');
    } finally {
      setImporting(false);
    }
  };

  const isAllSelected = transactions.length > 0 && selectedTxIds.size === transactions.length;

  const selectedTxs = transactions.filter((t) => selectedTxIds.has(t.id));
  const selectedIncomeSum = selectedTxs.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const selectedExpenseSum = selectedTxs.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const selectedPdfCount = Object.values(selectedTxIndexes).filter(Boolean).length;
  const targetAccountObj = accounts.find((a) => a.id === accountId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Transaction Ledger</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Record, select one-by-one or in bulk, and manage your income and expense transactions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedTxIds.size > 0 && (
            <button onClick={handleDeleteSelected} className="btn btn-danger" disabled={deleting}>
              <Trash2 size={16} /> Delete Selected ({selectedTxIds.size})
            </button>
          )}
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handlePdfUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            disabled={parsingPdf}
            title="Upload PDF statement or bill for automatic AI transaction extraction"
          >
            <Sparkles size={16} color="var(--accent-primary)" />
            {parsingPdf ? 'Scanning PDF...' : 'Import PDF Statement / Bill'}
          </button>
          <button onClick={() => { setShowAccountForm(false); setShowModal(true); }} className="btn btn-primary">
            <Plus size={18} /> Add Transaction
          </button>
        </div>
      </div>

      {/* Floating/Prominent Selective Deletion Bar */}
      {selectedTxIds.size > 0 && (
        <div
          className="glass-card"
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(239, 68, 68, 0.15))',
            border: '1px solid var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              ✓ {selectedTxIds.size} transaction{selectedTxIds.size > 1 ? 's' : ''} selected
            </span>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.8rem' }}>
              {selectedIncomeSum > 0 && <span style={{ color: 'var(--accent-success)' }}>Income: +₹{selectedIncomeSum.toLocaleString('en-IN')}</span>}
              {selectedExpenseSum > 0 && <span style={{ color: 'var(--accent-danger)' }}>Expenses: -₹{selectedExpenseSum.toLocaleString('en-IN')}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={() => setSelectedTxIds(new Set())} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
              Deselect All
            </button>
            <button onClick={handleDeleteSelected} className="btn btn-danger" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }} disabled={deleting}>
              <Trash2 size={14} /> Delete Selected ({selectedTxIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <Filter size={16} /> Filters:
            </div>
            <select className="input-field" style={{ minWidth: '150px', flex: '1 1 150px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              <option value="Food & Dining">Food & Dining</option>
              <option value="Shopping">Shopping</option>
              <option value="Rent & Utilities">Rent & Utilities</option>
              <option value="Travel & Transit">Travel & Transit</option>
              <option value="Income">Income</option>
            </select>
            <select className="input-field" style={{ minWidth: '140px', flex: '1 1 140px' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expense Only</option>
            </select>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {selectedTxIds.size > 0 ? (
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                {selectedTxIds.size} of {transactions.length} selected
              </span>
            ) : (
              `Total Visible: ${transactions.length}`
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-card" style={{ padding: '0.5rem' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '640px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem', width: '44px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                    title="Select All / Deselect All"
                  />
                </th>
                <th style={{ padding: '0.75rem' }}>Date</th>
                <th style={{ padding: '0.75rem' }}>Description</th>
                <th style={{ padding: '0.75rem' }}>Category</th>
                <th style={{ padding: '0.75rem' }}>Type</th>
                <th style={{ padding: '0.75rem' }}>Amount</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No transactions found matching criteria.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isSelected = selectedTxIds.has(tx.id);
                  return (
                    <tr
                      key={tx.id}
                      onClick={(e) => {
                        // Prevent toggling row if user clicked directly on delete button
                        if (e.target.closest('button')) return;
                        toggleSelectTx(tx.id);
                      }}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '0.85rem', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelectTx(tx.id)}
                          style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                        />
                      </td>
                      <td style={{ padding: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{tx.date}</td>
                      <td style={{ padding: '0.85rem', fontWeight: 500 }}>{tx.description || 'Transaction'}</td>
                      <td style={{ padding: '0.85rem' }}>
                        <span className="badge badge-info">{tx.category}</span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
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
                      <td style={{ padding: '0.85rem', fontWeight: 700, color: tx.type === 'income' ? 'var(--accent-success)' : '#fff' }}>
                        {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tx.id);
                          }}
                          className="btn btn-danger"
                          style={{ padding: '0.35rem 0.55rem' }}
                          title="Delete Transaction"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.25rem' }}>Record New Transaction</h3>

            {/* Account selection / Inline Creation */}
            <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Account</label>
                <button
                  type="button"
                  onClick={() => setShowAccountForm(!showAccountForm)}
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <Plus size={12} /> {showAccountForm ? 'Cancel New Account' : '+ Add New Account'}
                </button>
              </div>

              {showAccountForm || accounts.length === 0 ? (
                <div style={{ marginTop: '0.75rem' }}>
                  {accounts.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-warning)', marginBottom: '0.75rem' }}>
                      ⚠️ No accounts found. Please create an account below first:
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Account Name (e.g. SBI Bank)"
                      value={newAccName}
                      onChange={(e) => setNewAccName(e.target.value)}
                    />
                    <select className="input-field" value={newAccType} onChange={(e) => setNewAccType(e.target.value)}>
                      <option value="bank">Bank Account</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="cash">Cash Wallet</option>
                      <option value="investment">Investment</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="Initial Balance (₹)"
                      value={newAccBalance}
                      onChange={(e) => setNewAccBalance(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleCreateAccountInline}
                      className="btn btn-primary"
                      style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                    >
                      <Landmark size={14} /> Create Account
                    </button>
                  </div>
                </div>
              ) : (
                <select className="input-field" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</option>
                  ))}
                </select>
              )}
            </div>

            <form onSubmit={handleCreate}>
              <div className="grid-2" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Type</label>
                  <select className="input-field" value={txType} onChange={(e) => setTxType(e.target.value)}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Amount (₹)</label>
                  <input type="number" step="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Category</label>
                  <input type="text" className="input-field" value={category} onChange={(e) => setCategory(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Date</label>
                  <input type="date" className="input-field" value={txDate} onChange={(e) => setTxDate(e.target.value)} required />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Description</label>
                <input type="text" className="input-field" placeholder="e.g. Swiggy order / Salary" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={accounts.length === 0}>Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Extracted Preview & Confirm Modal */}
      {showPreviewModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                  Preview PDF Extracted Transactions & Bills
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
              <button type="button" onClick={toggleSelectAllPdf} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                {Object.values(selectedTxIndexes).every(Boolean) ? 'Deselect All' : 'Select All'}
              </button>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {selectedPdfCount} of {extractedTxs.length} selected for import
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
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelectTxIndex(idx)}
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
              <button type="button" onClick={handleConfirmPdfImport} className="btn btn-primary" disabled={importing || selectedPdfCount === 0}>
                {importing ? 'Importing Transactions...' : `Confirm & Import ${selectedPdfCount} Transaction(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
