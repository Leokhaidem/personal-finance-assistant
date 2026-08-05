import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Landmark, FileText, CreditCard, PieChart, Target,
  Calendar, StickyNote, MessageSquare, Shield, LogOut, Wallet, X
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', padding: '0 0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)', padding: '0.5rem', borderRadius: '10px' }}>
              <Wallet size={24} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', color: '#fff' }}>FinAssist AI</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gemini RAG Engine</span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-secondary mobile-close-btn"
              style={{ padding: '0.4rem', borderRadius: '8px' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav style={{ flex: 1 }}>
          <NavLink to="/" end onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/accounts" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Landmark size={18} />
            <span>Accounts</span>
          </NavLink>

          <NavLink to="/documents" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={18} />
            <span>Documents & Statements</span>
          </NavLink>

          <NavLink to="/transactions" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <CreditCard size={18} />
            <span>Transactions</span>
          </NavLink>

          <NavLink to="/budgets" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <PieChart size={18} />
            <span>Budgets</span>
          </NavLink>

          <NavLink to="/goals" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Target size={18} />
            <span>Savings Goals</span>
          </NavLink>

          <NavLink to="/bills" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Calendar size={18} />
            <span>Bills & Reminders</span>
          </NavLink>

          <NavLink to="/notes" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <StickyNote size={18} />
            <span>Free-Text Notes</span>
          </NavLink>

          <NavLink to="/chat" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <MessageSquare size={18} />
            <span>AI Assistant</span>
          </NavLink>

          {user?.role === 'admin' && (
            <NavLink to="/admin" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Shield size={18} />
              <span>Admin Overview</span>
            </NavLink>
          )}
        </nav>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.full_name || 'User'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.email}
              </div>
            </div>
          </div>

          <button onClick={logout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
