import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, ChevronDown, User, Menu } from 'lucide-react';
import type { StaffRole } from '../../domain/types';
import hanujaiLogo from '../../assets/hanujai_logo.png';

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const { currentUser, logout, switchDemoRole } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const roles: Array<{ key: StaffRole; label: string }> = [
    { key: 'principal', label: 'Principal' },
    { key: 'class_teacher', label: 'Class Teacher (10-A)' },
    { key: 'subject_teacher', label: 'Subject Teacher (Math)' },
  ];

  const getRoleDisplayName = (r?: StaffRole) => {
    switch (r) {
      case 'principal':
        return 'Principal';
      case 'class_teacher':
        return 'Class Teacher';
      case 'subject_teacher':
        return 'Subject Teacher';
      default:
        return 'Staff';
    }
  };

  // Click outside & Escape handling for menus
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.hhs-topbar-dropdown-container')) {
        setUserMenuOpen(false);
        setRoleSwitcherOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setRoleSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header
      className="hhs-topbar"
      style={{
        height: 'var(--hhs-topbar-height)',
        backgroundColor: 'var(--hhs-surface)',
        borderBottom: '1px solid var(--hhs-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(10px, 2.5vw, 20px)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left: Mobile hamburger & School Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hhs-btn hhs-btn-secondary hhs-mobile-nav-toggle"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              height: '36px',
              width: '36px',
              flexShrink: 0,
            }}
            aria-label="Toggle navigation"
          >
            <Menu size={18} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src={hanujaiLogo}
            alt="HanuJai High School Crest"
            style={{
              height: '34px',
              width: '34px',
              objectFit: 'contain',
              display: 'block',
              flexShrink: 0,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              className="hhs-topbar-title"
              style={{
                fontSize: '0.86rem',
                fontWeight: 800,
                color: 'var(--hhs-text-primary)',
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
              }}
            >
              HanuJai High School
            </span>
            <span
              className="hhs-topbar-session"
              style={{
                fontSize: '0.70rem',
                fontWeight: 600,
                color: 'var(--hhs-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              Session 2025–2026
            </span>
          </div>
        </div>
      </div>

      {/* Right: Role Switcher & User Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Subtle Role Switcher */}
        <div className="hhs-topbar-dropdown-container" style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setRoleSwitcherOpen(!roleSwitcherOpen);
              setUserMenuOpen(false);
            }}
            className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '32px',
              padding: '0 8px',
              fontWeight: 600,
              fontSize: '0.78rem',
            }}
          >
            <span>Role: <span className="hhs-role-text">{getRoleDisplayName(currentUser?.role)}</span></span>
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
                const isSelected = currentUser?.role === r.key;
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

        {/* User Account Menu */}
        <div className="hhs-topbar-dropdown-container" style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setRoleSwitcherOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              minHeight: '32px',
              borderRadius: 'var(--hhs-radius-base)',
              border: '1px solid var(--hhs-border)',
              backgroundColor: 'var(--hhs-surface)',
              cursor: 'pointer',
            }}
            aria-label="User account menu"
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: 'var(--pop-deep-violet)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {currentUser?.name ? currentUser.name.charAt(0) : <User size={12} />}
            </div>
            <div className="hhs-topbar-user-name" style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                {currentUser?.name || 'Staff User'}
              </div>
            </div>
            <ChevronDown size={12} color="var(--hhs-text-secondary)" style={{ flexShrink: 0 }} />
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
