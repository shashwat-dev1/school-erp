import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PHASE_CONFIG } from '../../config/phase';
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
import hanujaiLogo from '../../assets/hanujai_logo.png';

interface SidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onClose }) => {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const assignedClassId = currentUser?.assignedClassId;
  const primaryClass = currentUser?.assignedClasses?.[0] || 'class-10-a';
  const isPhase1 = PHASE_CONFIG.phase1Only;

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
      <aside className={`hhs-sidebar ${isMobileOpen ? 'mobile-open' : ''}`} style={{ borderTop: '3px solid var(--pop-deep-violet)' }}>
        {/* Brand Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--hhs-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            minHeight: '64px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={hanujaiLogo}
              alt="HanuJai High School Crest"
              style={{
                height: '42px',
                width: '42px',
                objectFit: 'contain',
                display: 'block',
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  color: 'var(--hhs-text-primary)',
                  lineHeight: 1.15,
                  letterSpacing: '0.01em',
                }}
              >
                HanuJai High School
              </span>
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  color: 'var(--pop-deep-violet)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Jaipur • Staff ERP
              </span>
            </div>
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


        {/* Clean, Role-Specific Task Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            
            {/* 1. PRINCIPAL WORKSPACE (Phase 1: Home, Students, Attendance) */}
            {role === 'principal' && (
              <>
                <li>
                  <SidebarItem to="/" icon={<Home size={16} />} label="Home" end onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/students" icon={<Users size={16} />} label="Students" onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/attendance" icon={<CalendarCheck size={16} />} label="Attendance" onClick={onClose} />
                </li>
                {!isPhase1 && (
                  <li>
                    <SidebarItem to="/reports" icon={<Award size={16} />} label="Results & Reports" onClick={onClose} />
                  </li>
                )}
              </>
            )}

            {/* 2. CLASS TEACHER WORKSPACE (Phase 1: My Class, Attendance, Students) */}
            {role === 'class_teacher' && (
              <>
                <li>
                  <SidebarItem to="/" icon={<Home size={16} />} label="My Class" end onClick={onClose} />
                </li>
                {assignedClassId ? (
                  <>
                    <li>
                      <SidebarItem
                        to={`/attendance/register/${assignedClassId}`}
                        icon={<CalendarCheck size={16} />}
                        label="Daily Register"
                        onClick={onClose}
                      />
                    </li>
                    <li>
                      <SidebarItem
                        to="/students"
                        icon={<Users size={16} />}
                        label="Class Roster"
                        onClick={onClose}
                      />
                    </li>
                    {!isPhase1 && (
                      <li>
                        <SidebarItem
                          to={`/performance/classes/${assignedClassId}`}
                          icon={<Award size={16} />}
                          label="Results"
                          onClick={onClose}
                        />
                      </li>
                    )}
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
                {!isPhase1 && (
                  <li>
                    <SidebarItem to="/behaviour" icon={<MessageSquare size={16} />} label="Teacher notes" onClick={onClose} />
                  </li>
                )}
              </>
            )}

            {/* 3. SUBJECT TEACHER WORKSPACE (Phase 1: My Classes, Attendance, Students) */}
            {role === 'subject_teacher' && (
              <>
                <li>
                  <SidebarItem to="/" icon={<BookOpen size={16} />} label="My Classes" end onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/attendance" icon={<CalendarCheck size={16} />} label="Attendance" onClick={onClose} />
                </li>
                <li>
                  <SidebarItem to="/students" icon={<Users size={16} />} label="Students" onClick={onClose} />
                </li>
                {!isPhase1 && (
                  <>
                    <li>
                      <SidebarItem to="/academics/assessments" icon={<FileCheck2 size={16} />} label="Enter Marks" onClick={onClose} />
                    </li>
                    {primaryClass ? (
                      <li>
                        <SidebarItem
                          to={`/performance/classes/${primaryClass}`}
                          icon={<Award size={16} />}
                          label="Results"
                          onClick={onClose}
                        />
                      </li>
                    ) : null}
                    <li>
                      <SidebarItem to="/behaviour" icon={<MessageSquare size={16} />} label="Teacher notes" onClick={onClose} />
                    </li>
                  </>
                )}
              </>
            )}

          </ul>
        </nav>

        {/* Clean Footer Info with Phase 1 Badge */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--hhs-border)',
            backgroundColor: 'var(--hhs-surface)',
            fontSize: '0.72rem',
            color: 'var(--hhs-text-secondary)',
            lineHeight: 1.45,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, color: 'var(--hhs-text-primary)' }}>HanuJai High School ERP</div>
            {isPhase1 && (
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--pop-electric-blue-tint)',
                  border: '1px solid var(--pop-electric-blue)',
                  color: 'var(--pop-electric-blue)',
                  fontWeight: 800,
                  fontSize: '0.65rem',
                }}
              >
                PHASE 1
              </span>
            )}
          </div>
          <div style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.72rem' }}>
            {isPhase1 ? 'Attendance & WhatsApp Parent Alerts' : 'Session 2025–2026'}
          </div>
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
        padding: '11px 14px',
        minHeight: '44px',
        borderRadius: 'var(--hhs-radius-base)',
        fontSize: '0.86rem',
        fontWeight: isActive ? 700 : 500,
        textDecoration: 'none',
        color: isActive ? 'var(--pop-electric-blue)' : 'var(--hhs-text-primary)',
        backgroundColor: isActive ? 'var(--pop-electric-blue-tint)' : 'transparent',
        borderLeft: isActive ? '4px solid var(--pop-electric-blue)' : '4px solid transparent',
        boxShadow: isActive ? '0 1px 4px rgba(31, 107, 255, 0.16)' : 'none',
        transition: 'all 0.15s ease',
      })}
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
      <span>{label}</span>
    </NavLink>
  );
};
