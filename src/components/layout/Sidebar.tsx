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
} from 'lucide-react';
import logoSvg from '../../assets/logo.svg';

export const Sidebar: React.FC = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.role || 'principal';

  return (
    <aside
      style={{
        width: 'var(--hhs-sidebar-width)',
        height: '100vh',
        backgroundColor: 'var(--hhs-surface)',
        borderRight: '1px solid var(--hhs-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 40,
      }}
    >
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
            ? 'Class 10-A Tutor'
            : 'Subject Faculty'}
        </span>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          
          {/* Operations Hub (All) */}
          <li>
            <SidebarItem to="/" icon={<LayoutDashboard size={16} />} label="Operations Hub" end />
          </li>

          {/* Classes & Sections (Principal, Admin, Class Teacher) */}
          {role !== 'subject_teacher' && (
            <li>
              <SidebarItem to="/classes" icon={<BookOpen size={16} />} label="Classes & Sections" />
            </li>
          )}

          {/* Class Teacher Specific: Section Roster & Cross-Subject Performance */}
          {role === 'class_teacher' && (
            <>
              <li>
                <SidebarItem
                  to="/classes/class-10-a/students"
                  icon={<Users size={16} />}
                  label="10-A Roll Roster"
                />
              </li>
              <li>
                <SidebarItem
                  to="/classes/class-10-a/performance"
                  icon={<FileCheck2 size={16} />}
                  label="10-A Performance"
                />
              </li>
            </>
          )}

          {/* Student Directory (All) */}
          <li>
            <SidebarItem to="/students" icon={<GraduationCap size={16} />} label="Student Records" />
          </li>

          {/* Daily Attendance (Principal, Office Admin, Class Teacher) */}
          {role !== 'subject_teacher' && (
            <li>
              <SidebarItem
                to={role === 'class_teacher' ? '/attendance/register/class-10-a' : '/attendance'}
                icon={<CalendarCheck size={16} />}
                label={role === 'class_teacher' ? 'Mark 10-A Roll' : 'Attendance Register'}
              />
            </li>
          )}

          {/* Attendance Late Corrections (Principal, Class Teacher) */}
          {(role === 'principal' || role === 'class_teacher') && (
            <li>
              <SidebarItem
                to="/attendance/corrections"
                icon={<UserCheck size={16} />}
                label="Late Corrections"
              />
            </li>
          )}

          {/* Assessments & Marks Entry */}
          <li>
            <SidebarItem
              to={role === 'subject_teacher' ? '/academics/marks/assess-ut2-2025' : '/assessments'}
              icon={<FileCheck2 size={16} />}
              label={role === 'subject_teacher' ? 'Enter Marks (Math)' : 'Assessment Cycles'}
            />
          </li>

          {/* Risk Watchlist (Principal, Office Admin, Class Teacher) */}
          {role !== 'subject_teacher' && (
            <li>
              <SidebarItem
                to="/risk-watchlist"
                icon={<AlertTriangle size={16} />}
                label="Risk Watchlist"
              />
            </li>
          )}

          {/* Behaviour & Discipline */}
          <li>
            <SidebarItem to="/behaviour" icon={<AlertOctagon size={16} />} label="Incident & Care Log" />
          </li>

          {/* Institutional Reports */}
          <li>
            <SidebarItem to="/reports" icon={<FileText size={16} />} label="Institutional Reports" />
          </li>

          {/* Administration & Governance (Principal & Office Admin) */}
          {(role === 'principal' || role === 'office_admin') && (
            <>
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
              {role === 'principal' && (
                <>
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
