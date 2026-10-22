import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { LogOut, RotateCcw, ShieldCheck, ChevronDown, User, Menu } from 'lucide-react';
import type { StaffRole } from '../../domain/types';

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const { currentUser, logout, switchDemoRole } = useAuth();
  const { dataMode, resetDemoData } = useData();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const roles: Array<{ key: StaffRole; label: string }> = [
    { key: 'principal', label: 'Principal / Admin' },
    { key: 'office_staff', label: 'Office Staff (Registrar)' },
    { key: 'class_teacher', label: 'Class Teacher (Class 10-A)' },
    { key: 'subject_teacher', label: 'Subject Teacher (Mathematics)' },
  ];

  const handleReset = async () => {
    if (confirm('Reset all sample data back to the original deterministic state?')) {
      await resetDemoData();
    }
  };

  return (
    <header
      style={{
        height: 'var(--hhs-topbar-height)',
        backgroundColor: 'var(--hhs-surface)',
        borderBottom: '1px solid var(--hhs-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left: Mobile hamburger & Active Academic Session */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hhs-btn hhs-btn-secondary hhs-mobile-nav-toggle"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              height: '32px',
              width: '32px',
              flexShrink: 0,
            }}
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>
        )}
        <span
          className="hhs-badge hhs-badge-primary"
          style={{ fontSize: '0.72rem', padding: '4px 10px', height: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Session 2025–2026 (Active)
        </span>
        <span className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', display: 'none' }}>
          Jaipur Campus
        </span>
      </div>

      {/* Right: Data Mode Indicator, Role Switcher (in demo), & User Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {dataMode === 'demo' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="hhs-badge hhs-badge-accent"
              style={{ fontWeight: 600, fontSize: '0.72rem' }}
              title="Running on local deterministic sample data"
            >
              Demo Mode — Sample Data
            </span>

            <button
              onClick={handleReset}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              title="Reset in-browser sample data to original seed baseline"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RotateCcw size={13} />
              <span>Reset Data</span>
            </button>

            {/* Demo Role Switcher */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ShieldCheck size={13} />
                <span>Role: {currentUser?.role.replace('_', ' ').toUpperCase()}</span>
                <ChevronDown size={12} />
              </button>

              {roleSwitcherOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    width: '240px',
                    backgroundColor: 'var(--hhs-surface)',
                    border: '1px solid var(--hhs-border)',
                    borderRadius: 'var(--hhs-radius-container)',
                    boxShadow: 'var(--hhs-shadow-level-2)',
                    padding: '4px',
                    zIndex: 50,
                  }}
                >
                  <div style={{ padding: '6px 10px', fontSize: '0.7rem', color: 'var(--hhs-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Simulate Staff Role:
                  </div>
                  {roles.map(r => (
                    <button
                      key={r.key}
                      onClick={() => {
                        switchDemoRole(r.key);
                        setRoleSwitcherOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        border: 'none',
                        background: currentUser?.role === r.key ? 'var(--hhs-primary-light)' : 'transparent',
                        color: currentUser?.role === r.key ? 'var(--hhs-primary-text)' : 'var(--hhs-text-primary)',
                        fontSize: '0.8rem',
                        fontWeight: currentUser?.role === r.key ? 700 : 500,
                        borderRadius: 'var(--hhs-radius-base)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{r.label}</span>
                      {currentUser?.role === r.key && <span style={{ fontSize: '10px' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <span className="hhs-badge hhs-badge-primary">
            Connected to Cloud Firestore
          </span>
        )}

        {/* User Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 8px',
              borderRadius: 'var(--hhs-radius-base)',
              border: '1px solid var(--hhs-border)',
              backgroundColor: 'var(--hhs-surface)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--hhs-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {currentUser?.name.slice(0, 1) || <User size={14} />}
            </div>
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                {currentUser?.name || 'Staff User'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                {currentUser?.designation || 'Faculty'}
              </div>
            </div>
            <ChevronDown size={14} color="var(--hhs-text-secondary)" />
          </button>

          {userMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                width: '220px',
                backgroundColor: 'var(--hhs-surface)',
                border: '1px solid var(--hhs-border)',
                borderRadius: 'var(--hhs-radius-container)',
                boxShadow: 'var(--hhs-shadow-level-2)',
                padding: '6px',
                zIndex: 50,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--hhs-border)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                  {currentUser?.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  {currentUser?.email}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--hhs-primary)', fontWeight: 600, marginTop: '2px' }}>
                  Code: {currentUser?.employeeCode}
                </div>
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--hhs-danger)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: 'var(--hhs-radius-base)',
                  marginTop: '4px',
                }}
              >
                <LogOut size={14} />
                <span>Sign Out of ERP</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
