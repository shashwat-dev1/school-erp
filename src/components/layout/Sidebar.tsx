import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarCheck,
  FileCheck2,
  AlertOctagon,
  FileText,
  ShieldAlert,
  Settings,
  BookOpen,
  UserCheck,
  Layers,
  AlertTriangle,
  X,
} from 'lucide-react';
import logoSvg from '../../assets/logo.svg';

interface SidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onClose }) => {
  const { currentUser } = useAuth();
  const role = currentUser?.role || 'principal';
  const assignedClassId = currentUser?.assignedClassId || 'class-10-a';
  const assignedClassLabel = currentUser?.assignedClassLabel || 'Class 10-A';
  const primaryClass = currentUser?.assignedClasses?.[0] || 'class-10-a';

  return (
    <>
      {isMobileOpen && <div className="hhs-sidebar-backdrop" onClick={onClose} />}
      <aside className={`hhs-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Institutional Brand Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--hhs-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <img
            src={logoSvg}
            alt="HanuJai High School Crest"
            style={{ height: '40px', width: 'auto', display: 'block' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--hhs-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              HanuJai ERP
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Jaipur Central
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="hhs-btn hhs-btn-secondary"
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                width: '28px',
                height: '28px',
              }}
              aria-label="Close navigation"
            >
              <X size={16} />
            </button>
          )}
        </div>

      {/* Role Scope Banner */}
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: 'var(--hhs-surface-muted)',
          borderBottom: '1px solid var(--hhs-border)',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 700,
          color: 'var(--hhs-text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Desk:</span>
        <span style={{ color: 'var(--hhs-primary)' }}>
          {role === 'principal'
            ? 'Principal Desk'
            : role === 'office_admin'
            ? 'Office Registrar'
            : role === 'class_teacher'
            ? `${assignedClassLabel} Tutor`
            : 'Subject Faculty'}
        </span>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          
          {/* Operations Hub (All roles land on their dedicated workspace) */}
          <li>
            <SidebarItem
              to="/"
              icon={<LayoutDashboard size={16} />}
              label={
                role === 'principal'
                  ? 'Operations Hub'
                  : role === 'office_admin'
                  ? 'Office Desk'
                  : role === 'class_teacher'
                  ? `${assignedClassLabel} Desk`
                  : 'Teaching Desk'
              }
              end
            />
          </li>

          {/* 1. PRINCIPAL WORKSPACE */}
          {role === 'principal' && (
            <>
              <li>
                <SidebarItem to="/students" icon={<GraduationCap size={16} />} label="Student Records" />
              </li>
              <li>
                <SidebarItem to="/attendance" icon={<CalendarCheck size={16} />} label="Attendance Register" />
              </li>
              <li>
                <SidebarItem to="/attendance/corrections" icon={<UserCheck size={16} />} label="Dual-Custody Approvals" />
              </li>
              <li>
                <SidebarItem to="/classes" icon={<BookOpen size={16} />} label="Classes &amp; Sections" />
              </li>
              <li>
                <SidebarItem to="/assessments" icon={<FileCheck2 size={16} />} label="Assessment Cycles" />
              </li>
              <li>
                <SidebarItem to="/risk-watchlist" icon={<AlertTriangle size={16} />} label="Risk Watchlist" />
              </li>
              <li>
                <SidebarItem to="/behaviour" icon={<AlertOctagon size={16} />} label="Incident &amp; Care Log" />
              </li>
              <li>
                <SidebarItem to="/reports" icon={<FileText size={16} />} label="Institutional Reports" />
              </li>

              <div
                style={{
                  padding: '16px 12px 6px',
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--hhs-text-muted)',
                  fontWeight: 700,
                }}
              >
                Governance &amp; Setup
              </div>
              <li>
                <SidebarItem to="/staff" icon={<Users size={16} />} label="Staff Directory" />
              </li>
              <li>
                <SidebarItem to="/admin/class-teachers" icon={<UserCheck size={16} />} label="Class Tutors" />
              </li>
              <li>
                <SidebarItem to="/admin/subject-teachers" icon={<Layers size={16} />} label="Subject Matrix" />
              </li>
              <li>
                <SidebarItem to="/admin/roles" icon={<BookOpen size={16} />} label="RBAC Policy Matrix" />
              </li>
              <li>
                <SidebarItem to="/audit-log" icon={<ShieldAlert size={16} />} label="System Audit Log" />
              </li>
              <li>
                <SidebarItem to="/settings/system-config" icon={<Settings size={16} />} label="School Identity &amp; Setup" />
              </li>
              <li>
                <SidebarItem to="/settings/attendance-policy" icon={<CalendarCheck size={16} />} label="Attendance Policy" />
              </li>
            </>
          )}

          {/* 2. OFFICE ADMINISTRATOR WORKSPACE */}
          {role === 'office_admin' && (
            <>
              <li>
                <SidebarItem to="/students" icon={<GraduationCap size={16} />} label="Student Directory &amp; Admissions" />
              </li>
              <li>
                <SidebarItem to="/attendance" icon={<CalendarCheck size={16} />} label="School Attendance Muster" />
              </li>
              <li>
                <SidebarItem to="/classes" icon={<BookOpen size={16} />} label="Classes &amp; Section Rosters" />
              </li>
              <li>
                <SidebarItem to="/reports" icon={<FileText size={16} />} label="Official School Reports" />
              </li>
              <li>
                <SidebarItem to="/behaviour" icon={<AlertOctagon size={16} />} label="Pastoral Care Directory" />
              </li>

              <div
                style={{
                  padding: '16px 12px 6px',
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--hhs-text-muted)',
                  fontWeight: 700,
                }}
              >
                Administrative Registry
              </div>
              <li>
                <SidebarItem to="/staff" icon={<Users size={16} />} label="Faculty &amp; Staff Directory" />
              </li>
              <li>
                <SidebarItem to="/admin/class-teachers" icon={<UserCheck size={16} />} label="Class Tutor Allocations" />
              </li>
              <li>
                <SidebarItem to="/admin/subject-teachers" icon={<Layers size={16} />} label="Subject Matrix" />
              </li>
              <li>
                <SidebarItem to="/admin/roles" icon={<BookOpen size={16} />} label="RBAC Clearance Matrix" />
              </li>
            </>
          )}

          {/* 3. CLASS TEACHER WORKSPACE */}
          {role === 'class_teacher' && (
            <>
              <li>
                <SidebarItem
                  to={`/attendance/register/${assignedClassId}`}
                  icon={<CalendarCheck size={16} />}
                  label={`Mark ${assignedClassLabel} Roll`}
                />
              </li>
              <li>
                <SidebarItem
                  to={`/classes/${assignedClassId}/students`}
                  icon={<Users size={16} />}
                  label={`${assignedClassLabel} Roll Roster`}
                />
              </li>
              <li>
                <SidebarItem
                  to={`/classes/${assignedClassId}/performance`}
                  icon={<FileCheck2 size={16} />}
                  label={`${assignedClassLabel} Performance`}
                />
              </li>
              <li>
                <SidebarItem to="/attendance/corrections" icon={<UserCheck size={16} />} label="Late Corrections" />
              </li>
              <li>
                <SidebarItem to="/risk-watchlist" icon={<AlertTriangle size={16} />} label={`${assignedClassLabel} Watchlist`} />
              </li>
              <li>
                <SidebarItem to="/behaviour" icon={<AlertOctagon size={16} />} label="Pastoral Care Log" />
              </li>
              <li>
                <SidebarItem to="/students" icon={<GraduationCap size={16} />} label="Student Dossiers" />
              </li>
              <li>
                <SidebarItem to="/reports" icon={<FileText size={16} />} label="Class Reports" />
              </li>
            </>
          )}

          {/* 4. SUBJECT TEACHER WORKSPACE */}
          {role === 'subject_teacher' && (
            <>
              <li>
                <SidebarItem to="/assessments" icon={<FileCheck2 size={16} />} label="Marks Entry Registers" />
              </li>
              <li>
                <SidebarItem
                  to={`/classes/${primaryClass}/performance`}
                  icon={<Layers size={16} />}
                  label="Subject Performance"
                />
              </li>
              <li>
                <SidebarItem to="/students" icon={<GraduationCap size={16} />} label="Enrolled Students" />
              </li>
              <li>
                <SidebarItem to="/behaviour" icon={<AlertOctagon size={16} />} label="Pastoral Observations" />
              </li>
              <li>
                <SidebarItem to="/reports" icon={<FileText size={16} />} label="Subject Reports" />
              </li>
            </>
          )}

        </ul>
      </nav>

      {/* Footer Identity */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--hhs-border)',
          backgroundColor: 'var(--hhs-surface)',
          fontSize: '0.72rem',
          color: 'var(--hhs-text-secondary)',
          lineHeight: 1.3,
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>HanuJai ERP v1.0</span>
        <br />
        Single-School Deployment
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
        padding: '9px 12px',
        borderRadius: 'var(--hhs-radius-base)',
        fontSize: '0.84rem',
        fontWeight: isActive ? 700 : 500,
        textDecoration: 'none',
        color: isActive ? 'var(--hhs-primary)' : 'var(--hhs-text-primary)',
        backgroundColor: isActive ? 'var(--hhs-primary-light)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--hhs-primary)' : '3px solid transparent',
        transition: 'background-color 0.15s ease, color 0.15s ease',
      })}
    >
      <span style={{ display: 'inline-flex', opacity: 0.85 }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
};
