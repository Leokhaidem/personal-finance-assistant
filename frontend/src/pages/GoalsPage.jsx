import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Target, Trash2, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Financial & Savings Goals</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Track emergency funds, vehicle purchases, and retirement targets with AI feasibility analysis.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> Add Savings Goal
        </button>
      </div>

      <div className="grid-3">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));

          return (
            <div key={g.id} className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>{g.name}</h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Target Date: {g.target_date}</span>
                </div>
                <button onClick={() => handleDelete(g.id)} className="btn btn-danger" style={{ padding: '0.35rem' }}>
                  <Trash2 size={14} />
                </button>
              </div>

              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-success)', marginBottom: '0.5rem' }}>
                ₹{g.saved_amount.toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>of ₹{g.target_amount.toLocaleString()}</span>
              </div>

              <div className="progress-bar-bg" style={{ marginBottom: '1rem' }}>
                <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
              </div>

              <button 
                onClick={() => handleCheckFeasibility(g.id)} 
                className="btn btn-secondary" 
                style={{ width: '100%', fontSize: '0.85rem' }}
                disabled={checkingGoalId === g.id}
              >
                <Sparkles size={16} color="var(--accent-primary)" />
                {checkingGoalId === g.id ? 'Analyzing...' : 'AI Feasibility Check'}
              </button>
            </div>
          );
        })}
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
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.25rem' }}>Set New Savings Goal</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Goal Title</label>
                <input type="text" className="input-field" placeholder="e.g. Emergency Fund / EV Scooter" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="grid-2" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Target Amount (₹)</label>
                  <input type="number" step="1000" className="input-field" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Already Saved (₹)</label>
                  <input type="number" step="1000" className="input-field" value={savedAmount} onChange={(e) => setSavedAmount(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Target Completion Date</label>
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
