import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Trash2, Landmark, CreditCard, Wallet, TrendingUp, Edit3 } from 'lucide-react';

export const AccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('');

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/accounts');
      setAccounts(res.data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openAddModal = () => {
    setEditingAccount(null);
    setName('');
    setType('bank');
    setBalance('0');
    setShowModal(true);
  };

  const openEditModal = (acc) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.balance.toString());
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await apiClient.put(`/accounts/${editingAccount.id}`, {
          name,
          type,
          balance: parseFloat(balance || 0)
        });
      } else {
        await apiClient.post('/accounts', {
          name,
          type,
          balance: parseFloat(balance || 0)
        });
      }
      setShowModal(false);
      fetchAccounts();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save account');
    }
  };

  const handleDelete = async (id, accName) => {
    if (!window.confirm(`Are you sure you want to delete account "${accName}"?`)) return;
    try {
      await apiClient.delete(`/accounts/${id}`);
      fetchAccounts();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete account');
    }
  };

  const getAccountIcon = (accType) => {
    switch (accType) {
      case 'credit_card':
        return <CreditCard size={22} color="#ec4899" />;
      case 'cash':
        return <Wallet size={22} color="#10b981" />;
      case 'investment':
        return <TrendingUp size={22} color="#f59e0b" />;
      case 'bank':
      default:
        return <Landmark size={22} color="#6366f1" />;
    }
  };

  const getAccountTypeBadge = (accType) => {
    switch (accType) {
      case 'credit_card':
        return <span className="badge badge-warning">Credit Card</span>;
      case 'cash':
        return <span className="badge badge-success">Cash</span>;
      case 'investment':
        return <span className="badge badge-info">Investment</span>;
      case 'bank':
      default:
        return <span className="badge badge-info" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>Bank</span>;
    }
  };

  const totalBalance = accounts.reduce((acc, curr) => acc + (curr.balance || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Financial Accounts</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage your bank accounts, credit cards, wallets, and investments.
          </p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">
          <Plus size={18} /> Add Account
        </button>
      </div>

      {/* Overview Banner */}
      <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Total Accounts Net Balance
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
              ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {accounts.length} Active {accounts.length === 1 ? 'Account' : 'Accounts'}
            </span>
          </div>
        </div>
      </div>

      {/* Accounts List Grid */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Landmark size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Financial Accounts Added</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            Add your bank account, credit card, or cash wallet to start recording transactions and tracking your financial health.
          </p>
          <button onClick={openAddModal} className="btn btn-primary">
            <Plus size={18} /> Add Your First Account
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '10px', display: 'flex' }}>
                      {getAccountIcon(acc.type)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>{acc.name}</div>
                      <div style={{ marginTop: '0.2rem' }}>{getAccountTypeBadge(acc.type)}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Current Balance</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: acc.balance < 0 ? 'var(--accent-danger)' : '#fff' }}>
                    ₹{acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <button onClick={() => openEditModal(acc)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
                  <Edit3 size={14} /> Edit
                </button>
                <button onClick={() => handleDelete(acc.id, acc.name)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.25rem' }}>
              {editingAccount ? 'Edit Account' : 'Add Financial Account'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Account Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. HDFC Salary Account / Cash Wallet"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Account Type</label>
                  <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="bank">Bank Account</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="cash">Cash Wallet</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Initial Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="0.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAccount ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
