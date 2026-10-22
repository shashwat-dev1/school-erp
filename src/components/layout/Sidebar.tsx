import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  Users,
  CalendarCheck,
  Award,
  FileCheck2,
  BookOpen,
  MessageSquare,
  X,
} from 'lucide-react';
import logoSvg from '../../assets/logo.svg';

interface SidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onClose }) => {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const assignedClassId = currentUser?.assignedClassId;
  const assignedClassLabel = currentUser?.assignedClassLabel || (assignedClassId ? `Class ${assignedClassId.toUpperCase()}` : '');
  const primaryClass = currentUser?.assignedClasses?.[0] || 'class-10-a';

  // Role label in plain everyday English
  const roleLabel =
    role === 'principal'
      ? 'Principal'
      : role === 'class_teacher'
      ? (assignedClassLabel ? `${assignedClassLabel} Teacher` : 'Class Teacher')
      : role === 'subject_teacher'
      ? 'Subject Teacher'
      : 'School Staff';

  return (
    <>
      {isMobileOpen && <div className="hhs-sidebar-backdrop" onClick={onClose} />}
      <aside className={`hhs-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--hhs-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            minHeight: '56px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src={logoSvg}
              alt="HanuJai High School"
              style={{ height: '34px', maxWidth: '160px', objectFit: 'contain', display: 'block' }}
            />
            <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>
              HanuJai High School
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="hhs-btn hhs-btn-secondary hhs-sidebar-close-btn"
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                width: '28px',
                height: '28px',
                flexShrink: 0,
              }}
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* User Context Banner */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--hhs-surface-muted)',
            borderBottom: '1px solid var(--hhs-border)',
            fontSize: '0.72rem',
            color: 'var(--hhs-text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Role:</span>
          <span style={{ color: 'var(--hhs-primary)', fontWeight: 600 }}>{roleLabel}</span>
        </div>

        {/* Clean, Role-Specific Task Navigation (Max 4-5 items per role) */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            
            {/* 1. PRINCIPAL WORKSPACE (4 items: Home, Students, Attendance, Results & Reports) */}
            {role === 'principal' && (
              <>
                <li>
                  <SidebarItem to="/" icon={<Home size={16} />} label="Home" end />
                </li>
                <li>
                  <SidebarItem to="/students" icon={<Users size={16} />} label="Students" />
                </li>
                <li>
                  <SidebarItem to="/attendance" icon={<CalendarCheck size={16} />} label="Attendance" />
                </li>
                <li>
                  <SidebarItem to="/reports" icon={<Award size={16} />} label="Results & Reports" />
                </li>
              </>
            )}

            {/* 3. CLASS TEACHER WORKSPACE (4 items) */}
            {role === 'class_teacher' && (
              <>
                <li>
                  <SidebarItem to="/" icon={<Home size={16} />} label="My Class" end />
                </li>
                {assignedClassId ? (
                  <>
                    <li>
                      <SidebarItem
                        to={`/attendance/register/${assignedClassId}`}
                        icon={<CalendarCheck size={16} />}
                        label="Attendance"
                      />
                    </li>
                    <li>
                      <SidebarItem
                        to={`/performance/classes/${assignedClassId}`}
                        icon={<Award size={16} />}
                        label="Results"
                      />
                    </li>
                  </>
                ) : (
                  <li>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 12px',
                        fontSize: '0.82rem',
                        color: 'var(--hhs-text-muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      No Class Assigned
                    </span>
                  </li>
                )}
                <li>
                  <SidebarItem to="/behaviour" icon={<MessageSquare size={16} />} label="Student Notes" />
                </li>
              </>
            )}

            {/* 4. SUBJECT TEACHER WORKSPACE (4 items) */}
            {role === 'subject_teacher' && (
              <>
                <li>
                  <SidebarItem to="/" icon={<BookOpen size={16} />} label="My Classes" end />
                </li>
                <li>
                  <SidebarItem to="/academics/assessments" icon={<FileCheck2 size={16} />} label="Enter Marks" />
                </li>
                {primaryClass ? (
                  <li>
                    <SidebarItem
                      to={`/performance/classes/${primaryClass}`}
                      icon={<Award size={16} />}
                      label="Results"
                    />
                  </li>
                ) : null}
                <li>
                  <SidebarItem to="/behaviour" icon={<MessageSquare size={16} />} label="Student Notes" />
                </li>
              </>
            )}

          </ul>
        </nav>

        {/* Clean Footer Info */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--hhs-border)',
            backgroundColor: 'var(--hhs-surface)',
            fontSize: '0.72rem',
            color: 'var(--hhs-text-secondary)',
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>HanuJai High School ERP</div>
          <div>Session 2025–2026</div>
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
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, end }) => {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: 'var(--hhs-radius-base)',
        fontSize: '0.84rem',
        fontWeight: isActive ? 600 : 500,
        textDecoration: 'none',
        color: isActive ? 'var(--hhs-primary)' : 'var(--hhs-text-secondary)',
        backgroundColor: isActive ? 'var(--hhs-primary-light)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--hhs-primary)' : '3px solid transparent',
        transition: 'all 0.15s ease',
      })}
    >
      <span style={{ display: 'inline-flex', opacity: 0.9 }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
};
