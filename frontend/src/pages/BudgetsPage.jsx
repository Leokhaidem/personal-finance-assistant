import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Trash2, PieChart, AlertCircle, Utensils, Home, ShoppingBag, Car, HeartPulse, Film, DollarSign, Sparkles, TrendingUp, ShieldAlert, CheckCircle2 } from 'lucide-react';

const CATEGORY_ICONS = {
  'Food & Dining': Utensils,
  'Rent & Utilities': Home,
  'Shopping': ShoppingBag,
  'Travel & Transit': Car,
  'Healthcare': HeartPulse,
  'Entertainment': Film,
  'Income': DollarSign,
  'Other': PieChart
};

const CATEGORY_COLORS = {
  'Food & Dining': '#10b981',
  'Rent & Utilities': '#6366f1',
  'Shopping': '#ec4899',
  'Travel & Transit': '#f59e0b',
  'Healthcare': '#ef4444',
  'Entertainment': '#8b5cf6',
  'Income': '#10b981',
  'Other': '#3b82f6'
};

const QUICK_PRESETS = [
  { category: 'Food & Dining', limit: 15000 },
  { category: 'Rent & Utilities', limit: 25000 },
  { category: 'Shopping', limit: 10000 },
  { category: 'Travel & Transit', limit: 8000 },
  { category: 'Entertainment', limit: 5000 },
];

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

  const applyPreset = (preset) => {
    setCategory(preset.category);
    setMonthlyLimit(preset.limit.toString());
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete category budget limit?')) return;
    try {
      await apiClient.delete(`/budgets/${id}`);
      fetchBudgets();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  };

  const totalBudgeted = budgets.reduce((acc, b) => acc + (b.monthly_limit || 0), 0);
  const totalSpent = budgets.reduce((acc, b) => acc + (b.spent || 0), 0);
  const overallPct = totalBudgeted > 0 ? Math.min(100, Math.round((totalSpent / totalBudgeted) * 100)) : 0;
  const isOverallOver = totalSpent > totalBudgeted && totalBudgeted > 0;

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <PieChart size={28} color="var(--accent-primary)" /> Monthly Category Budgets
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Configure spending limits per category, track live expenditure, and receive automatic over-budget alerts.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
          <Plus size={18} /> Set Category Budget
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid-kpi" style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(17,24,39,0.8))' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>Total Budget Configured</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>₹{totalBudgeted.toLocaleString('en-IN')}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>Across {budgets.length} Categories</span>
        </div>

        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(17,24,39,0.8))' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>Total Spent This Month</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: isOverallOver ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
            ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Live Transaction Aggregate</span>
        </div>

        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(17,24,39,0.8))' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>Overall Budget Utilization</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{overallPct}%</div>
          <div className="progress-bar-bg" style={{ marginTop: '0.4rem', height: '6px' }}>
            <div className="progress-bar-fill" style={{ width: `${overallPct}%`, background: isOverallOver ? 'var(--accent-danger)' : overallPct > 80 ? 'var(--accent-warning)' : 'var(--accent-success)' }}></div>
          </div>
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div className="glass-card" style={{ marginBottom: '2rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
            <Sparkles size={18} color="var(--accent-primary)" /> Quick Budget Presets:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {QUICK_PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => applyPreset(p)}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: '20px' }}
              >
                + {p.category} (₹{p.limit.toLocaleString()})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Budgets Grid */}
      <div className="grid-3">
        {budgets.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <PieChart size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h3>No Category Budgets Configured</h3>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '1.25rem' }}>
              Click "+ Set Category Budget" or select a Quick Preset above to set monthly spending limits.
            </p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus size={16} /> Set First Budget
            </button>
          </div>
        ) : (
          budgets.map((b) => {
            const Icon = CATEGORY_ICONS[b.category] || PieChart;
            const color = CATEGORY_COLORS[b.category] || 'var(--accent-primary)';
            const spent = b.spent || 0;
            const pct = Math.min(100, Math.round((spent / b.monthly_limit) * 100));
            const isOver = spent > b.monthly_limit;
            const remaining = b.monthly_limit - spent;

            return (
              <div
                key={b.id}
                className="glass-card"
                style={{
                  borderColor: isOver ? 'rgba(239,68,68,0.5)' : pct > 80 ? 'rgba(245,158,11,0.5)' : 'var(--border-color)',
                  background: isOver ? 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(17,24,39,0.9))' : 'var(--bg-card)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: `${color}20`, padding: '0.6rem', borderRadius: '12px', border: `1px solid ${color}40` }}>
                      <Icon size={22} color={color} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.15rem' }}>{b.category}</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Month: {b.month}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(b.id)} className="btn btn-danger" style={{ padding: '0.35rem 0.55rem' }} title="Delete Budget">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Spent: <strong style={{ color: '#fff' }}>₹{spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                    <span style={{ fontWeight: 700, color: isOver ? 'var(--accent-danger)' : '#fff' }}>Limit: ₹{b.monthly_limit.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="progress-bar-bg" style={{ height: '8px' }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: isOver ? 'var(--accent-danger)' : pct > 80 ? 'var(--accent-warning)' : `linear-gradient(90deg, ${color}, #10b981)`
                      }}
                    ></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  {isOver ? (
                    <span style={{ color: 'var(--accent-danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <ShieldAlert size={14} /> Over by ₹{(spent - b.monthly_limit).toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--accent-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle2 size={14} /> ₹{remaining.toLocaleString('en-IN')} Remaining
                    </span>
                  )}
                  <span className="badge badge-info">{pct}% Used</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PieChart size={20} color="var(--accent-primary)" /> Configure Category Budget
            </h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Category</label>
                <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)} required>
                  <option value="Food & Dining">Food & Dining</option>
                  <option value="Rent & Utilities">Rent & Utilities</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Travel & Transit">Travel & Transit</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Monthly Spending Limit (₹)</label>
                <input type="number" step="100" className="input-field" placeholder="e.g. 15000" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Month (YYYY-MM)</label>
                <input type="month" className="input-field" value={month} onChange={(e) => setMonth(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Category Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
