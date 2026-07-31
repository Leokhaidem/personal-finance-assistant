import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { 
  TrendingUp, TrendingDown, Wallet, Target, Calendar, Sparkles, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

export const DashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, insRes] = await Promise.all([
          apiClient.get('/dashboard/summary'),
          apiClient.post('/ai/spending-insights')
        ]);
        setSummary(sumRes.data);
        setInsights(insRes.data.insights || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Loading financial dashboard...</div>;
  }

  if (!summary) {
    return <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Failed to load financial summary.</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Financial Overview</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Real-time income, expense trends, active goals & AI spending insights.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Monthly Income</span>
            <div style={{ background: 'rgba(16,185,129,0.15)', padding: '0.5rem', borderRadius: '8px' }}>
              <TrendingUp size={20} color="var(--accent-success)" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
            ₹{summary.monthly_income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-success)' }}>This Month</span>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Monthly Expenses</span>
            <div style={{ background: 'rgba(239,68,68,0.15)', padding: '0.5rem', borderRadius: '8px' }}>
              <TrendingDown size={20} color="var(--accent-danger)" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
            ₹{summary.monthly_expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Categorized Expenditure</span>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Total Accounts Balance</span>
            <div style={{ background: 'rgba(99,102,241,0.15)', padding: '0.5rem', borderRadius: '8px' }}>
              <Wallet size={20} color="var(--accent-primary)" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
            ₹{summary.total_savings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
            Savings Rate: {summary.savings_rate}%
          </span>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Upcoming Bills (30d)</span>
            <div style={{ background: 'rgba(245,158,11,0.15)', padding: '0.5rem', borderRadius: '8px' }}>
              <Calendar size={20} color="var(--accent-warning)" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
            {summary.upcoming_bills_count} Due
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-warning)' }}>Action Required</span>
        </div>
      </div>

      {/* AI Insights Card */}
      <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--accent-primary)', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(17,24,39,0.8))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Sparkles size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem' }}>Gemini AI Spending Insights</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.88rem', border: '1px solid var(--border-color)', color: '#e5e7eb' }}>
              {ins}
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        {/* Income vs Expense Line Trend */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>6-Month Income vs Expense Trend</h3>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.income_vs_expense_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} name="Income (₹)" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} name="Expenses (₹)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Category Pie */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Expense Breakdown by Category</h3>
          <div style={{ width: '100%', height: '280px' }}>
            {summary.expense_by_category.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                No expense transactions recorded this month.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.expense_by_category}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={4}
                  >
                    {summary.expense_by_category.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Goals Progress */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem' }}>Active Savings Goals</h3>
          </div>
        </div>

        <div className="grid-3">
          {summary.goals_progress.map((g) => {
            const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
            return (
              <div key={g.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  <span>{g.name}</span>
                  <span style={{ color: 'var(--accent-success)' }}>{pct}%</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  ₹{g.saved_amount.toLocaleString('en-IN')} of ₹{g.target_amount.toLocaleString('en-IN')}
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
