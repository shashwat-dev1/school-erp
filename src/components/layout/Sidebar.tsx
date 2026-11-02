import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarCheck,
  FileSpreadsheet,
  Award,
  MessageSquare,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import hanujaiLogo from '../../assets/hanujai_logo.png';

interface SidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onClose }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const role = currentUser?.role;
  const assignedClassId = currentUser?.assignedClassId || 'class-10-a';
  const primaryClass = currentUser?.assignedClasses?.[0] || 'class-10-a';

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen && onClose) {
        onClose();
      }
    };
    if (isMobileOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onClose]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'principal':
        return 'Principal / Administrator';
      case 'class_teacher':
        return `Class Teacher (${assignedClassId.replace('class-', '').toUpperCase()})`;
      case 'subject_teacher':
        return 'Subject Faculty';
      default:
        return 'Staff Member';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'HJ';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="hhs-sidebar-backdrop"
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label="Close menu backdrop"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClose?.();
          }}
        />
      )}
      <aside
        className={`hhs-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: 'var(--hhs-sidebar-width, 260px)',
          backgroundColor: '#0A1931',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 40,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            minHeight: '68px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={hanujaiLogo}
              alt="HanuJai High School Crest"
              style={{
                height: '44px',
                width: '44px',
                objectFit: 'contain',
                display: 'block',
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 800,
                  fontSize: '0.96rem',
                  color: '#FFFFFF',
                  lineHeight: 1.2,
                  letterSpacing: '0.01em',
                }}
              >
                HanuJai High School
              </span>
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: '#F5A623',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginTop: '2px',
                }}
              >
                Endeavor to Excel
              </span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="hhs-btn hhs-sidebar-close-btn"
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                width: '32px',
                height: '32px',
                flexShrink: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '6px',
              }}
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Section Heading */}
        <div
          style={{
            padding: '16px 18px 8px 18px',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Operational Modules
        </div>

        {/* Clean, Role-Specific Task Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px 12px' }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            
            {/* 1. PRINCIPAL WORKSPACE */}
            {role === 'principal' && (
              <>
                <li>
                  <SidebarItem to="/" icon={<LayoutDashboard size={18} />} label="Executive Overview" end onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/students" icon={<Users size={18} />} label="Student Master Dossiers" onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/staff" icon={<GraduationCap size={18} />} label="Faculty & Staff" onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/attendance" icon={<CalendarCheck size={18} />} label="Attendance Oversight" onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/academics/assessments" icon={<FileSpreadsheet size={18} />} label="Marks & Academics" onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/reports" icon={<Award size={18} />} label="Results & Analytics" onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/admin/whatsapp" icon={<MessageSquare size={18} />} label="WhatsApp Hub" onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/settings/system-config" icon={<Settings size={18} />} label="Institutional Settings" onClick={onClose} />
                </li>
              </>
            )}

            {/* 2. CLASS TEACHER WORKSPACE */}
            {role === 'class_teacher' && (
              <>
                <li>
                  <SidebarItem to="/" icon={<LayoutDashboard size={18} />} label="Class Dashboard" end onClick={onClose} />
                </li>
                <li>
                  <SidebarItem
                    to={`/attendance/register/${assignedClassId}`}
                    icon={<CalendarCheck size={18} />}
                    label="Daily Register"
                    onClick={onClose}
                  />
                </li>
                <li>
                  <SidebarItem
                    to="/students"
                    icon={<Users size={18} />}
                    label="Class Roster"
                    onClick={onClose}
                  />
                </li>
                <li>
                  <SidebarItem
                    to="/reports/attendance"
                    icon={<Award size={18} />}
                    label="Attendance Records"
                    onClick={onClose}
                  />
                </li>
                <li>
                  <SidebarItem
                    to="/admin/whatsapp"
                    icon={<MessageSquare size={18} />}
                    label="WhatsApp Delivery"
                    onClick={onClose}
                  />
                </li>
              </>
            )}

            {/* 3. SUBJECT TEACHER WORKSPACE */}
            {role === 'subject_teacher' && (
              <>
                <li>
                  <SidebarItem to="/" icon={<LayoutDashboard size={18} />} label="Faculty Workspace" end onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/academics/assessments" icon={<FileSpreadsheet size={18} />} label="Marks Entry Register" onClick={onClose} />
                </li>
                <li>
                  <SidebarItem
                    to={`/performance/classes/${primaryClass}`}
                    icon={<Award size={18} />}
                    label="Performance Ledger"
                    onClick={onClose}
                  />
                </li>
                <li>
                  <SidebarItem to="/students" icon={<Users size={18} />} label="Student Directory" onClick={onClose} />
                </li>
              </>
            )}

          </ul>
        </nav>

        {/* User Profile Card & Sign Out Footer */}
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#071224',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9999px',
                backgroundColor: '#F5A623',
                color: '#0A1931',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                flexShrink: 0,
              }}
            >
              {getInitials(currentUser?.name)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentUser?.name || 'Authorized Staff'}
              </span>
              <span
                style={{
                  color: '#94A3B8',
                  fontSize: '0.70rem',
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {getRoleLabel()}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              color: '#94A3B8',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Sign Out"
            aria-label="Sign Out"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = '#EF4444';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = '#94A3B8';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
};

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, end, onClick }) => {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        minHeight: '42px',
        borderRadius: '8px',
        fontSize: '0.86rem',
        fontWeight: isActive ? 700 : 500,
        textDecoration: 'none',
        color: isActive ? '#0A1931' : '#94A3B8',
        backgroundColor: isActive ? '#F5A623' : 'transparent',
        boxShadow: isActive ? '0 2px 8px rgba(245, 166, 35, 0.35)' : 'none',
        transition: 'all 0.15s ease',
      })}
      onMouseEnter={(e) => {
        const target = e.currentTarget;
        if (!target.classList.contains('active')) {
          target.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          target.style.color = '#FFFFFF';
        }
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget;
        if (!target.classList.contains('active')) {
          target.style.backgroundColor = 'transparent';
          target.style.color = '#94A3B8';
        }
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          color: 'inherit',
          transition: 'color 0.15s ease',
        }}
      >
        {icon}
      </span>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
    </NavLink>
  );
};
