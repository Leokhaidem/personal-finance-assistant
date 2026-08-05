import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Calendar, Trash2, Clock, CheckCircle2, AlertTriangle, Bell, Zap, Wifi, Home, CreditCard, Sparkles, Filter } from 'lucide-react';

const BILL_PRESETS = [
  { name: '⚡ BESCOM Electricity Bill', amount: 2100, category: 'Rent & Utilities', recurring: true },
  { name: '🌐 Airtel Fiber Broadband', amount: 999, category: 'Rent & Utilities', recurring: true },
  { name: '🏠 Apartment House Rent', amount: 25000, category: 'Rent & Utilities', recurring: true },
  { name: '💳 HDFC Credit Card Bill', amount: 8500, category: 'Rent & Utilities', recurring: true },
];

export const BillsPage = () => {
  const [bills, setBills] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('Rent & Utilities');
  const [recurring, setRecurring] = useState(true);

  const fetchBills = async () => {
    try {
      const res = await apiClient.get('/bills');
      setBills(res.data);
    } catch (err) {
      console.error('Failed to fetch bills:', err);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/bills', {
        name,
        amount: parseFloat(amount),
        due_date: dueDate,
        category,
        recurring
      });
      setShowModal(false);
      setName('');
      setAmount('');
      setDueDate('');
      fetchBills();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add bill');
    }
  };

  const applyPreset = (preset) => {
    setName(preset.name);
    setAmount(preset.amount.toString());
    setCategory(preset.category);
    setRecurring(preset.recurring);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setDueDate(nextWeek.toISOString().split('T')[0]);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete bill reminder?')) return;
    try {
      await apiClient.delete(`/bills/${id}`);
      fetchBills();
    } catch (err) {
      console.error('Failed to delete bill:', err);
    }
  };

  const totalBillAmount = bills.reduce((acc, b) => acc + (b.amount || 0), 0);
  const urgentBills = bills.filter((b) => {
    const d = Math.ceil((new Date(b.due_date) - new Date()) / (1000 * 60 * 60 * 24));
    return d >= 0 && d <= 7;
  });
  const pastDueBills = bills.filter((b) => {
    const d = Math.ceil((new Date(b.due_date) - new Date()) / (1000 * 60 * 60 * 24));
    return d < 0;
  });

  const filteredBills = bills.filter((b) => {
    const d = Math.ceil((new Date(b.due_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (statusFilter === 'urgent') return d >= 0 && d <= 7;
    if (statusFilter === 'past_due') return d < 0;
    if (statusFilter === 'recurring') return b.recurring;
    return true;
  });

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Bell size={28} color="var(--accent-warning)" /> Bills & Recurring Reminders
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage upcoming utility bills, subscription renewals, & credit card payment schedules with instant alerts.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
          <Plus size={18} /> Add Bill Reminder
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid-kpi" style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(17,24,39,0.8))' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>Total Active Reminders</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{bills.length} Bills</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-warning)' }}>Scheduled Payments</span>
        </div>

        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(17,24,39,0.8))' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>Total Monthly Payable</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-danger)' }}>₹{totalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recurring Commitment</span>
        </div>

        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(17,24,39,0.8))' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>Due Within 7 Days</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: urgentBills.length > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
            {urgentBills.length} Urgent
          </div>
          <span style={{ fontSize: '0.75rem', color: pastDueBills.length > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
            {pastDueBills.length > 0 ? `⚠️ ${pastDueBills.length} Past Due` : '✅ All Payments Current'}
          </span>
        </div>
      </div>

      {/* Quick Presets & Filter Bar */}
      <div className="glass-card" style={{ marginBottom: '2rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusFilter('all')}
              className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', borderRadius: '20px' }}
            >
              All ({bills.length})
            </button>
            <button
              onClick={() => setStatusFilter('urgent')}
              className={`btn ${statusFilter === 'urgent' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', borderRadius: '20px' }}
            >
              ⚡ Urgent (7d) ({urgentBills.length})
            </button>
            <button
              onClick={() => setStatusFilter('past_due')}
              className={`btn ${statusFilter === 'past_due' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', borderRadius: '20px' }}
            >
              ⚠️ Past Due ({pastDueBills.length})
            </button>
            <button
              onClick={() => setStatusFilter('recurring')}
              className={`btn ${statusFilter === 'recurring' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', borderRadius: '20px' }}
            >
              🔄 Recurring
            </button>
          </div>

          {/* Quick Presets */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Add:</span>
            {BILL_PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => applyPreset(p)}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', borderRadius: '16px' }}
              >
                + {p.name.split(' ')[0]} {p.name.split(' ')[1]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bills Grid */}
      <div className="grid-3">
        {filteredBills.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Bell size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h3>No Bill Reminders Found</h3>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '1.25rem' }}>
              Add upcoming utility bills or select a Quick Add preset above.
            </p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus size={16} /> Add First Bill Reminder
            </button>
          </div>
        ) : (
          filteredBills.map((b) => {
            const daysLeft = Math.ceil((new Date(b.due_date) - new Date()) / (1000 * 60 * 60 * 24));
            const isUrgent = daysLeft >= 0 && daysLeft <= 7;
            const isPastDue = daysLeft < 0;

            return (
              <div
                key={b.id}
                className="glass-card"
                style={{
                  borderColor: isPastDue ? 'rgba(239,68,68,0.6)' : isUrgent ? 'rgba(245,158,11,0.6)' : 'var(--border-color)',
                  background: isPastDue
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(17,24,39,0.9))'
                    : isUrgent
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(17,24,39,0.9))'
                    : 'var(--bg-card)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem', color: '#fff' }}>{b.name}</h3>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span className="badge badge-info">{b.category}</span>
                      {b.recurring && <span className="badge badge-warning">Monthly</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(b.id)} className="btn btn-danger" style={{ padding: '0.35rem 0.55rem' }} title="Delete Reminder">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '0.85rem' }}>
                  ₹{b.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.25)', padding: '0.65rem 0.85rem', borderRadius: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} color="var(--accent-primary)" /> Due: {b.due_date}
                  </span>
                  {isPastDue ? (
                    <span style={{ color: 'var(--accent-danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <AlertTriangle size={14} /> Past Due
                    </span>
                  ) : (
                    <span style={{ color: isUrgent ? 'var(--accent-warning)' : 'var(--accent-success)', fontWeight: 700 }}>
                      {daysLeft === 0 ? '⚡ Due Today' : `${daysLeft} Days Left`}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} color="var(--accent-warning)" /> Add Bill Reminder
            </h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Bill / Service Name</label>
                <input type="text" className="input-field" placeholder="e.g. BESCOM Electricity / Fiber Broadband" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="grid-2" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Amount (₹)</label>
                  <input type="number" step="0.01" className="input-field" placeholder="2100" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Due Date</label>
                  <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Category</label>
                  <input type="text" className="input-field" value={category} onChange={(e) => setCategory(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Recurring Monthly
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Bill Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
