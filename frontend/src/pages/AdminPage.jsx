import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Shield, Users, FileText, CreditCard } from 'lucide-react';

export const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [uRes, sRes] = await Promise.all([
          apiClient.get('/admin/users'),
          apiClient.get('/admin/stats')
        ]);
        setUsers(uRes.data);
        setStats(sRes.data);
      } catch (err) {
        console.error('Failed to load admin overview:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading Admin Portal...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield color="var(--accent-primary)" /> Admin Management Console
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          System metrics and registered user directory.
        </p>
      </div>

      {stats && (
        <div className="grid-3" style={{ marginBottom: '2rem' }}>
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Registered Users</span>
              <Users size={20} color="var(--accent-primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>{stats.total_users}</div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Uploaded PDFs</span>
              <FileText size={20} color="var(--accent-success)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>{stats.total_documents}</div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total System Transactions</span>
              <CreditCard size={20} color="var(--accent-warning)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>{stats.total_transactions}</div>
          </div>
        </div>
      )}

      <div className="glass-card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>User Directory</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem' }}>Full Name</th>
                <th style={{ padding: '0.75rem' }}>Email</th>
                <th style={{ padding: '0.75rem' }}>Role</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
                <th style={{ padding: '0.75rem' }}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.85rem', fontWeight: 600 }}>{u.full_name || 'N/A'}</td>
                  <td style={{ padding: '0.85rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={{ padding: '0.85rem' }}>
                    <span className={u.role === 'admin' ? 'badge badge-warning' : 'badge badge-info'}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem' }}>
                    <span className="badge badge-success">Active</span>
                  </td>
                  <td style={{ padding: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
