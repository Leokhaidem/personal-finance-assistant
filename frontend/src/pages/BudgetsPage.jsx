import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Trash2, PieChart, AlertCircle } from 'lucide-react';

export const BudgetsPage = () => {
  const [budgets, setBudgets] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('Food & Dining');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchBudgets = async () => {
    try {
      const res = await apiClient.get('/budgets');
      setBudgets(res.data);
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/budgets', {
        category,
        monthly_limit: parseFloat(monthlyLimit),
        month
      });
      setShowModal(false);
      setMonthlyLimit('');
      fetchBudgets();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to set budget');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete budget rule?')) return;
    try {
      await apiClient.delete(`/budgets/${id}`);
      fetchBudgets();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Monthly Category Budgets</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Set category expenditure limits and monitor monthly budget health.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> Set Category Budget
        </button>
      </div>

      <div className="grid-3">
        {budgets.map((b) => {
          const spent = b.spent || 0;
          const pct = Math.min(100, Math.round((spent / b.monthly_limit) * 100));
          const isOver = spent > b.monthly_limit;

          return (
            <div key={b.id} className="glass-card" style={{ borderColor: isOver ? 'rgba(239,68,68,0.4)' : 'var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>{b.category}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Month: {b.month}</span>
                </div>
                <button onClick={() => handleDelete(b.id)} className="btn btn-danger" style={{ padding: '0.35rem' }}>
                  <Trash2 size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Spent: ₹{spent.toLocaleString()}</span>
                <span style={{ fontWeight: 700, color: isOver ? 'var(--accent-danger)' : '#fff' }}>Limit: ₹{b.monthly_limit.toLocaleString()}</span>
              </div>

              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill" 
                  style={{ 
                    width: `${pct}%`, 
                    background: isOver ? 'var(--accent-danger)' : pct > 80 ? 'var(--accent-warning)' : 'linear-gradient(90deg, #6366f1, #10b981)' 
                  }}
                ></div>
              </div>

              {isOver && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={14} /> Budget limit exceeded by ₹{(spent - b.monthly_limit).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.25rem' }}>Configure Category Budget</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Category</label>
                <input type="text" className="input-field" placeholder="e.g. Food & Dining / Shopping" value={category} onChange={(e) => setCategory(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Monthly Limit (₹)</label>
                <input type="number" step="100" className="input-field" placeholder="15000" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Month (YYYY-MM)</label>
                <input type="month" className="input-field" value={month} onChange={(e) => setMonth(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
