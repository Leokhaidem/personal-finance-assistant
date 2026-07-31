import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Filter, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form states
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
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryFilter, typeFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
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
    if (!window.confirm('Delete transaction record?')) return;
    try {
      await apiClient.delete(`/transactions/${id}`);
      fetchData();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Transaction Ledger</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Record and categorize your income and expense transactions.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> Add Transaction
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <Filter size={16} /> Filters:
          </div>
          <select className="input-field" style={{ width: '180px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            <option value="Food & Dining">Food & Dining</option>
            <option value="Shopping">Shopping</option>
            <option value="Rent & Utilities">Rent & Utilities</option>
            <option value="Travel & Transit">Travel & Transit</option>
            <option value="Income">Income</option>
          </select>
          <select className="input-field" style={{ width: '160px' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="income">Income Only</option>
            <option value="expense">Expense Only</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
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
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No transactions found matching criteria.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem', color: 'var(--text-secondary)' }}>{tx.date}</td>
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
                      <button onClick={() => handleDelete(tx.id)} className="btn btn-danger" style={{ padding: '0.35rem 0.5rem' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
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
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Account</label>
                <select className="input-field" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>

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
                <button type="submit" className="btn btn-primary">Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
