import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  ChevronDown,
  Menu,
  Search,
  Calendar,
  Clock,
  Bell,
  Shield,
  Check,
} from 'lucide-react';
import type { StaffRole, StudentRecord } from '../../domain/types';

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const { currentUser, switchDemoRole } = useAuth();
  const { provider } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Quick Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);

  // Load students for quick search
  useEffect(() => {
    let isMounted = true;
    provider.getStudents({ limit: 300 }).then((res) => {
      if (isMounted) setAllStudents(res.items);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [provider]);

  // Handle search typing
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length >= 2) {
      setIsSearching(true);
      const matches = allStudents.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          (s.rollNumber && s.rollNumber.toString() === q)
      ).slice(0, 5);
      setSearchResults(matches);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery, allStudents]);

  const roles: Array<{ key: StaffRole; label: string; badge: string }> = [
    { key: 'principal', label: 'Principal (Executive View)', badge: 'Principal' },
    { key: 'class_teacher', label: 'Class Teacher (Class 10-A)', badge: 'Class 10-A' },
    { key: 'subject_teacher', label: 'Subject Teacher (Mathematics)', badge: 'Faculty' },
  ];

  const getRoleDisplayName = (r?: StaffRole) => {
    switch (r) {
      case 'principal':
        return 'Principal View';
      case 'class_teacher':
        return 'Class Teacher (10-A)';
      case 'subject_teacher':
        return 'Subject Faculty';
      default:
        return 'Authorized Staff';
    }
  };

  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/') return 'Overview • Executive Dashboard';
    if (path.startsWith('/attendance/register')) return 'Attendance • Daily Classroom Register';
    if (path.startsWith('/attendance')) return 'Attendance • Whole-School Oversight';
    if (path.startsWith('/students/')) return 'Master Dossiers • Student Profile';
    if (path.startsWith('/students')) return 'Master Dossiers • Student Directory';
    if (path.startsWith('/staff')) return 'Administration • Faculty & Staff Directory';
    if (path.startsWith('/academics') || path.startsWith('/assessments')) return 'Academics • Marks Entry Register';
    if (path.startsWith('/reports')) return 'Analytics • Performance & Attendance Reports';
    if (path.startsWith('/admin/whatsapp') || path.startsWith('/whatsapp')) return 'Operations • WhatsApp Hub';
    if (path.startsWith('/settings')) return 'Governance • Institutional Settings';
    return 'HanuJai ERP • Operational Platform';
  };

  // Formatted live date for Jaipur IST
  const getLiveDateString = () => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }).format(now);
    } catch {
      return 'Mon, 02 Nov';
    }
  };

  // Click outside handling
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.hhs-topbar-dropdown-container')) {
        setRoleSwitcherOpen(false);
        setNotificationsOpen(false);
      }
      if (!target.closest('.hhs-topbar-search-container')) {
        setIsSearching(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoleSwitcherOpen(false);
        setNotificationsOpen(false);
        setIsSearching(false);
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
        height: 'var(--hhs-topbar-height, 60px)',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(12px, 2vw, 24px)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: '0 1px 2px 0 rgba(10, 25, 49, 0.03)',
      }}
    >
      {/* Left: Mobile Toggle & Breadcrumbs & Universal Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hhs-btn hhs-mobile-nav-toggle"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              height: '36px',
              width: '36px',
              flexShrink: 0,
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            aria-label="Toggle navigation"
          >
            <Menu size={18} color="#0A1931" />
          </button>
        )}

        {/* Breadcrumb Title */}
        <div className="hhs-topbar-breadcrumb" style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700,
              fontSize: '0.88rem',
              color: '#0A1931',
              whiteSpace: 'nowrap',
            }}
          >
            {getBreadcrumbs()}
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              color: '#64748B',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            Jaipur Campus • Est. 1998
          </span>
        </div>

        {/* Desktop Universal Search Bar */}
        <div
          className="hhs-topbar-search-container"
          style={{ position: 'relative', display: 'none', minWidth: '260px' }}
        >
          <style>{`
            @media (min-width: 900px) {
              .hhs-topbar-search-container {
                display: block !important;
              }
            }
          `}</style>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '0 10px',
              height: '36px',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <Search size={15} color="#94A3B8" />
            <input
              type="text"
              placeholder="Search student by name, roll, or GRN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setIsSearching(true);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.82rem',
                color: '#0F172A',
                width: '100%',
              }}
            />
          </div>

          {/* Quick Search Dropdown */}
          {isSearching && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '6px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(10, 25, 49, 0.1)',
                padding: '4px',
                zIndex: 60,
              }}
            >
              {searchResults.map((stu) => (
                <div
                  key={stu.id}
                  onClick={() => {
                    navigate(`/students/${stu.id}`);
                    setSearchQuery('');
                    setIsSearching(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ color: '#0A1931' }}>{stu.fullName}</strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      Roll #{stu.rollNumber || '—'} • {stu.classLabel}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#EEF2FF',
                      color: '#4F46E5',
                    }}
                  >
                    View
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Academic Status Pills, Role Switcher & Notifications */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        
        {/* Session Badge Pill */}
        <div
          className="hhs-session-pill"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '9999px',
            padding: '4px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#334155',
          }}
        >
          <style>{`
            @media (min-width: 680px) {
              .hhs-session-pill { display: inline-flex !important; }
            }
          `}</style>
          <Calendar size={13} color="#4F46E5" />
          <span>2025–2026 Term 1</span>
        </div>

        {/* Live Date Pill */}
        <div
          className="hhs-date-pill"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '9999px',
            padding: '4px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#334155',
          }}
        >
          <style>{`
            @media (min-width: 768px) {
              .hhs-date-pill { display: inline-flex !important; }
            }
          `}</style>
          <Clock size={13} color="#0D9488" />
          <span>{getLiveDateString()}</span>
        </div>

        {/* Regal Gold Role Badge / Switcher */}
        <div className="hhs-topbar-dropdown-container" style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setRoleSwitcherOpen(!roleSwitcherOpen);
              setNotificationsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 12px',
              borderRadius: '9999px',
              backgroundColor: '#FEF3C7',
              border: '1px solid #F5A623',
              color: '#92400E',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Switch Demo Persona"
          >
            <Shield size={14} color="#92400E" />
            <span style={{ whiteSpace: 'nowrap' }}>{getRoleDisplayName(currentUser?.role)}</span>
            <ChevronDown size={13} color="#92400E" />
          </button>

          {roleSwitcherOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                width: '240px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(10, 25, 49, 0.15)',
                padding: '6px',
                zIndex: 50,
              }}
            >
              <div
                style={{
                  padding: '8px 10px',
                  fontSize: '0.68rem',
                  color: '#64748B',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #F1F5F9',
                }}
              >
                Switch Authorized Persona
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
                      padding: '8px 10px',
                      border: 'none',
                      backgroundColor: isSelected ? '#FEF3C7' : 'transparent',
                      color: isSelected ? '#92400E' : '#0F172A',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '2px',
                    }}
                  >
                    <span>{r.label}</span>
                    {isSelected && <Check size={14} color="#92400E" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="hhs-topbar-dropdown-container" style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setRoleSwitcherOpen(false);
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#334155',
              position: 'relative',
            }}
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '7px',
                height: '7px',
                borderRadius: '9999px',
                backgroundColor: '#10B981',
              }}
            />
          </button>

          {notificationsOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                width: '280px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(10, 25, 49, 0.15)',
                padding: '12px',
                zIndex: 50,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <strong style={{ fontSize: '0.84rem', color: '#0A1931' }}>Notifications</strong>
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#10B981',
                    fontWeight: 700,
                  }}
                >
                  Worker Live
                </span>
              </div>
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#ECFDF5',
                  borderRadius: '6px',
                  border: '1px solid #A7F3D0',
                  fontSize: '0.75rem',
                  color: '#065F46',
                  lineHeight: 1.35,
                }}
              >
                <strong>WhatsApp Service:</strong> Attendance notification queue active and verified.
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
