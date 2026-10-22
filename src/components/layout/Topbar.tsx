import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { LogOut, RotateCcw, ChevronDown, User, Menu } from 'lucide-react';
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
    { key: 'principal', label: 'Principal' },
    { key: 'office_staff', label: 'Office Staff' },
    { key: 'class_teacher', label: 'Class Teacher (10-A)' },
    { key: 'subject_teacher', label: 'Subject Teacher (Math)' },
  ];

  const handleReset = async () => {
    if (confirm('Reset sample data back to original state?')) {
      await resetDemoData();
    }
  };

  const getRoleDisplayName = (r?: StaffRole) => {
    switch (r) {
      case 'principal':
      case 'admin':
        return 'Principal';
      case 'office_admin':
      case 'office_staff':
        return 'Office Staff';
      case 'class_teacher':
        return 'Class Teacher';
      case 'subject_teacher':
        return 'Subject Teacher';
      default:
        return 'Staff';
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
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left: Mobile hamburger & Session */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            aria-label="Toggle navigation"
          >
            <Menu size={18} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--hhs-text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            Session 2025–2026
          </span>
          <span
            className="hhs-badge hhs-badge-primary"
            style={{ fontSize: '0.68rem', height: '18px', padding: '0 6px' }}
          >
            Active
          </span>
        </div>
      </div>

      {/* Right: Demo tools & User Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {dataMode === 'demo' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              className="hhs-badge hhs-badge-accent"
              style={{ fontSize: '0.7rem', height: '20px' }}
              title="Running in local demonstration mode"
            >
              Sample Data
            </span>

            <button
              onClick={handleReset}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              title="Reset sample data back to start"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px', padding: '0 8px' }}
            >
              <RotateCcw size={12} />
              <span className="no-mobile-text">Reset</span>
            </button>

            {/* Role Switcher */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '28px',
                  padding: '0 10px',
                  fontWeight: 600,
                }}
              >
                <span>Role: {getRoleDisplayName(currentUser?.role)}</span>
                <ChevronDown size={12} />
              </button>

              {roleSwitcherOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    width: '210px',
                    backgroundColor: 'var(--hhs-surface)',
                    border: '1px solid var(--hhs-border)',
                    borderRadius: 'var(--hhs-radius-container)',
                    boxShadow: 'var(--hhs-shadow-level-3)',
                    padding: '4px',
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      padding: '6px 8px',
                      fontSize: '0.68rem',
                      color: 'var(--hhs-text-secondary)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Switch Demo View:
                  </div>
                  {roles.map((r) => {
                    const isSelected =
                      currentUser?.role === r.key ||
                      (r.key === 'principal' && currentUser?.role === 'admin') ||
                      (r.key === 'office_staff' && currentUser?.role === 'office_admin');
                    return (
                      <button
                        key={r.key}
                        onClick={() => {
                          switchDemoRole(r.key);
                          setRoleSwitcherOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '7px 10px',
                          border: 'none',
                          background: isSelected ? 'var(--hhs-primary-light)' : 'transparent',
                          color: isSelected ? 'var(--hhs-primary)' : 'var(--hhs-text-primary)',
                          fontSize: '0.8rem',
                          fontWeight: isSelected ? 600 : 500,
                          borderRadius: 'var(--hhs-radius-base)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{r.label}</span>
                        {isSelected && <span style={{ fontSize: '11px', fontWeight: 700 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <span className="hhs-badge hhs-badge-primary">Cloud Mode</span>
        )}

        {/* User Account Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '3px 8px',
              borderRadius: 'var(--hhs-radius-base)',
              border: '1px solid var(--hhs-border)',
              backgroundColor: 'var(--hhs-surface)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: 'var(--hhs-primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              {currentUser?.name ? currentUser.name.charAt(0) : <User size={12} />}
            </div>
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                {currentUser?.name || 'Staff User'}
              </div>
            </div>
            <ChevronDown size={12} color="var(--hhs-text-secondary)" />
          </button>

          {userMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                width: '200px',
                backgroundColor: 'var(--hhs-surface)',
                border: '1px solid var(--hhs-border)',
                borderRadius: 'var(--hhs-radius-container)',
                boxShadow: 'var(--hhs-shadow-level-3)',
                padding: '6px',
                zIndex: 50,
              }}
            >
              <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--hhs-border)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                  {currentUser?.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  {currentUser?.email}
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
                  padding: '8px',
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
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
