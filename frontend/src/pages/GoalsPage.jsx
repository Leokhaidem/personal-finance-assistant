import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Target, Trash2, Sparkles, CheckCircle, AlertTriangle, ShieldCheck, Calendar, Clock, DollarSign, Award, ArrowUpRight } from 'lucide-react';

const GOAL_PRESETS = [
  { name: '🛡️ Emergency Fund (6 Months)', target_amount: 120000, saved_amount: 30000, months_ahead: 12 },
  { name: '🛵 EV Electric Scooter', target_amount: 95000, saved_amount: 25000, months_ahead: 6 },
  { name: '✈️ Bali Summer Vacation', target_amount: 150000, saved_amount: 45000, months_ahead: 8 },
  { name: '💻 MacBook Pro Workstation', target_amount: 180000, saved_amount: 60000, months_ahead: 10 },
];

export const GoalsPage = () => {
  const [goals, setGoals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [feasibilityResult, setFeasibilityResult] = useState(null);
  const [checkingGoalId, setCheckingGoalId] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const fetchGoals = async () => {
    try {
      const res = await apiClient.get('/goals');
      setGoals(res.data);
    } catch (err) {
      console.error('Failed to fetch goals:', err);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/goals', {
        name,
        target_amount: parseFloat(targetAmount),
        saved_amount: parseFloat(savedAmount || 0),
        target_date: targetDate
      });
      setShowModal(false);
      setName('');
      setTargetAmount('');
      setSavedAmount('');
      setTargetDate('');
      fetchGoals();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create goal');
    }
  };

  const applyPreset = (preset) => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + preset.months_ahead);
    setName(preset.name);
    setTargetAmount(preset.target_amount.toString());
    setSavedAmount(preset.saved_amount.toString());
    setTargetDate(futureDate.toISOString().split('T')[0]);
    setShowModal(true);
  };

  const handleCheckFeasibility = async (goalId) => {
    setCheckingGoalId(goalId);
    try {
      const res = await apiClient.post(`/ai/goal-feasibility/${goalId}`);
      setFeasibilityResult(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to analyze feasibility');
    } finally {
      setCheckingGoalId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete financial goal?')) return;
    try {
      await apiClient.delete(`/goals/${id}`);
      fetchGoals();
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  };

  const totalTargetSum = goals.reduce((acc, g) => acc + (g.target_amount || 0), 0);
  const totalSavedSum = goals.reduce((acc, g) => acc + (g.saved_amount || 0), 0);
  const overallPct = totalTargetSum > 0 ? Math.min(100, Math.round((totalSavedSum / totalTargetSum) * 100)) : 0;

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Target size={28} color="var(--accent-primary)" /> Financial & Savings Goals
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Track progress towards emergency funds, vehicles, property & vacation targets with AI feasibility analysis.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
          <Plus size={18} /> Add Savings Goal
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid-kpi" style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(17,24,39,0.8))' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>Active Savings Goals</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{goals.length} Goals</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>Target Portfolio</span>
        </div>

        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(17,24,39,0.8))' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>Total Amount Accumulated</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-success)' }}>₹{totalSavedSum.toLocaleString('en-IN')}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: ₹{totalTargetSum.toLocaleString('en-IN')}</span>
        </div>

        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(17,24,39,0.8))' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>Overall Savings Goal Progress</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{overallPct}%</div>
          <div className="progress-bar-bg" style={{ marginTop: '0.4rem', height: '6px' }}>
            <div className="progress-bar-fill" style={{ width: `${overallPct}%`, background: 'linear-gradient(90deg, #6366f1, #10b981)' }}></div>
          </div>
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div className="glass-card" style={{ marginBottom: '2rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
            <Sparkles size={18} color="var(--accent-primary)" /> Quick Goal Templates:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {GOAL_PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => applyPreset(p)}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: '20px' }}
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid-3">
        {goals.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Target size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h3>No Savings Goals Active</h3>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '1.25rem' }}>
              Create your first financial target or select a Quick Goal Template above.
            </p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus size={16} /> Create Savings Goal
            </button>
          </div>
        ) : (
          goals.map((g) => {
            const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
            const daysLeft = Math.ceil((new Date(g.target_date) - new Date()) / (1000 * 60 * 60 * 24));

            return (
              <div
                key={g.id}
                className="glass-card"
                style={{
                  border: '1px solid var(--border-color)',
                  background: pct >= 100 ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(17,24,39,0.9))' : 'var(--bg-card)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem', color: '#fff' }}>{g.name}</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={13} /> Target Date: {g.target_date} {daysLeft > 0 ? `(${daysLeft} days)` : '(Due)'}
                    </span>
                  </div>
                  <button onClick={() => handleDelete(g.id)} className="btn btn-danger" style={{ padding: '0.35rem 0.55rem' }} title="Delete Goal">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-success)', marginBottom: '0.4rem' }}>
                  ₹{g.saved_amount.toLocaleString('en-IN')} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>of ₹{g.target_amount.toLocaleString('en-IN')}</span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div className="progress-bar-bg" style={{ height: '8px' }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #10b981)' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '0.4rem', color: 'var(--text-muted)' }}>
                    <span>{pct}% Completed</span>
                    <span>₹{(g.target_amount - g.saved_amount).toLocaleString('en-IN')} Left</span>
                  </div>
                </div>

                <button
                  onClick={() => handleCheckFeasibility(g.id)}
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem' }}
                  disabled={checkingGoalId === g.id}
                >
                  <Sparkles size={16} color="var(--accent-primary)" />
                  {checkingGoalId === g.id ? 'Analyzing Feasibility...' : 'AI Feasibility Check'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* AI Feasibility Result Modal */}
      {feasibilityResult && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Sparkles size={22} color="var(--accent-primary)" />
              <h3>AI Feasibility Report: {feasibilityResult.goal_name}</h3>
            </div>

            <div style={{ background: feasibilityResult.is_feasible ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${feasibilityResult.is_feasible ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: feasibilityResult.is_feasible ? 'var(--accent-success)' : 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {feasibilityResult.is_feasible ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                Status: {feasibilityResult.is_feasible ? 'On Track & Feasible' : 'Requires Adjustment'}
              </div>

              <div style={{ fontSize: '0.88rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: '#e5e7eb' }}>
                <div>Months Remaining: <b>{feasibilityResult.months_remaining}</b></div>
                <div>Required Monthly: <b>₹{feasibilityResult.required_monthly_savings.toLocaleString()}</b></div>
                <div>Current Monthly Savings: <b>₹{feasibilityResult.current_avg_savings_rate.toLocaleString()}</b></div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px', fontSize: '0.9rem', color: '#d1d5db', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
              <b style={{ color: '#fff', display: 'block', marginBottom: '0.3rem' }}>Gemini AI Recommendation:</b>
              {feasibilityResult.ai_explanation}
            </div>

            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setFeasibilityResult(null)} className="btn btn-primary">Close Report</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={20} color="var(--accent-primary)" /> Set New Savings Goal
            </h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Goal Title</label>
                <input type="text" className="input-field" placeholder="e.g. Emergency Fund / EV Scooter" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="grid-2" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Target Amount (₹)</label>
                  <input type="number" step="1000" className="input-field" placeholder="100000" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Already Saved (₹)</label>
                  <input type="number" step="1000" className="input-field" placeholder="25000" value={savedAmount} onChange={(e) => setSavedAmount(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>Target Completion Date</label>
                <input type="date" className="input-field" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
