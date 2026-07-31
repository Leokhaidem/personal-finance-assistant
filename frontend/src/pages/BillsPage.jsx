import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Calendar, Trash2, Clock, CheckCircle2 } from 'lucide-react';

export const BillsPage = () => {
  const [bills, setBills] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('Utilities');
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

  const handleDelete = async (id) => {
    if (!window.confirm('Delete bill reminder?')) return;
    try {
      await apiClient.delete(`/bills/${id}`);
      fetchBills();
    } catch (err) {
      console.error('Failed to delete bill:', err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Bills & Recurring Reminders</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage upcoming utility bills, subscription renewals, and credit card payments.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> Add Bill Reminder
        </button>
      </div>

      <div className="grid-3">
        {bills.map((b) => {
          const daysLeft = Math.ceil((new Date(b.due_date) - new Date()) / (1000 * 60 * 60 * 24));
          const isUrgent = daysLeft >= 0 && daysLeft <= 7;

          return (
            <div key={b.id} className="glass-card" style={{ borderColor: isUrgent ? 'rgba(245,158,11,0.5)' : 'var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>{b.name}</h3>
                  <span className="badge badge-info">{b.category}</span>
                </div>
                <button onClick={() => handleDelete(b.id)} className="btn btn-danger" style={{ padding: '0.35rem' }}>
                  <Trash2 size={14} />
                </button>
              </div>

              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
                ₹{b.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} /> Due: {b.due_date}
                </span>
                {daysLeft < 0 ? (
                  <span style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>Past Due</span>
                ) : (
                  <span style={{ color: isUrgent ? 'var(--accent-warning)' : 'var(--accent-success)', fontWeight: 600 }}>
                    {daysLeft === 0 ? 'Due Today' : `${daysLeft} Days Left`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.25rem' }}>Add Bill Reminder</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Bill Name</label>
                <input type="text" className="input-field" placeholder="e.g. BESCOM Electricity / Fiber Broadband" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="grid-2" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Amount (₹)</label>
                  <input type="number" step="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Due Date</label>
                  <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Category</label>
                  <input type="text" className="input-field" value={category} onChange={(e) => setCategory(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Recurring Monthly
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
