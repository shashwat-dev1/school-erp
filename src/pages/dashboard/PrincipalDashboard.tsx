/**
 * HanuJai High School ERP — Principal Dashboard
 * Minimal, crisp, scannable institutional overview.
 * Answers: Where am I? What do I need to know? What should I do next?
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type {
  ClassSection,
  StudentRecord,
  AttendanceSession,
} from '../../domain/types';
import type { RiskWatchlistItem } from '../../data/provider';
import {
  Users,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Search,
  ArrowRight,
  User,
  Calendar,
} from 'lucide-react';

export const PrincipalDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [watchlist, setWatchlist] = useState<RiskWatchlistItem[]>([]);

  // Fast Student Search state
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    async function loadPrincipalData() {
      setIsLoading(true);
      setError(null);
      try {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const [clsRes, stuRes, attRes, watchRes] = await Promise.all([
          provider.getClasses(),
          provider.getStudents({ limit: 1000 }),
          provider.getAttendanceSessions(today),
          provider.getRiskWatchlist(),
        ]);

        if (!isMounted) return;
        setClasses(clsRes);
        setAllStudents(stuRes.items);
        setAttendanceSessions(attRes);
        setWatchlist(watchRes);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Could not load school dashboard data.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPrincipalData();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  if (isLoading) {
    return <LoadingState message="Loading school overview..." />;
  }

  if (error) {
    return <ErrorBanner title="Could not load dashboard" message={error} />;
  }

  // Calculated Real KPIs
  const totalEnrolment = allStudents.length;

  let totalExpectedAttendance = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;

  attendanceSessions.forEach(s => {
    totalExpectedAttendance += s.totalStudents;
    totalPresent += s.presentCount;
    totalAbsent += s.absentCount;
    totalLate += s.lateCount;
  });

  const attendanceTurnoutPct = totalExpectedAttendance > 0
    ? Math.round((totalPresent / totalExpectedAttendance) * 1000) / 10
    : 0;

  // Filter students for fast search
  const matchingStudents = searchQuery.trim().length >= 2
    ? allStudents.filter(s =>
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        s.classLabel.toLowerCase().includes(searchQuery.toLowerCase().trim())
      ).slice(0, 5)
    : [];

  // Plain-language trigger translation
  const translateTrigger = (trigger: string): string => {
    if (trigger.includes('ATT-01') || trigger.toLowerCase().includes('consecutive')) {
      return '3 consecutive absences';
    }
    if (trigger.includes('ATT-03') || trigger.includes('<75') || trigger.toLowerCase().includes('turnout')) {
      return 'Attendance below 75%';
    }
    if (trigger.includes('ACAD-04') || trigger.toLowerCase().includes('drop')) {
      return 'Subject marks dropped >20%';
    }
    if (trigger.includes('DISC') || trigger.toLowerCase().includes('incident')) {
      return 'Teacher observation flagged';
    }
    return trigger.replace(/#[A-Z]+-[0-9]+/g, '').trim() || 'Needs academic follow-up';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <PageHeader
        title="Home"
        subtitle={`Session 2025–2026 • HanuJai High School • Welcome, ${currentUser?.name || 'Principal'}`}
        roleScope="Principal"
        breadcrumbs={[{ label: 'Home' }]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate('/attendance')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={15} />
              <span>Attendance Muster</span>
            </button>
            <button
              onClick={() => navigate('/students')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={15} />
              <span>All Students</span>
            </button>
          </div>
        }
      />

      {/* School-wide Fast Student Search */}
      <div
        className="hhs-card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          border: '1px solid var(--hhs-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={18} style={{ color: 'var(--hhs-text-secondary)', flexShrink: 0 }} />
          <input
            type="text"
            className="hhs-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search any student by name, admission number, or class..."
            style={{
              border: 'none',
              padding: '6px 0',
              fontSize: '0.9rem',
              backgroundColor: 'transparent',
              boxShadow: 'none',
              flex: 1,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="hhs-btn hhs-btn-text hhs-btn-sm"
              style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {matchingStudents.length > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--hhs-border)',
              paddingTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {matchingStudents.map(student => (
              <div
                key={student.id}
                onClick={() => navigate(`/students/${student.id}`)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 'var(--hhs-radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: 'var(--hhs-surface-muted)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <User size={16} style={{ color: 'var(--hhs-primary)' }} />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{student.fullName}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginLeft: '8px' }}>
                      {student.classLabel} • Roll #{student.rollNumber} • Adm #{student.admissionNumber}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--hhs-primary)' }}>
                  <span>View Summary</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exactly 4 Compact Scannable Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Total Students"
          value={totalEnrolment.toString()}
          subtext={`Enrolled across ${classes.length} classes`}
          icon={<Users size={20} />}
          accent="primary"
        />
        <MetricCard
          label="Present Today"
          value={totalPresent.toString()}
          subtext={`${attendanceTurnoutPct}% turnout today`}
          icon={<CheckCircle size={20} />}
          accent="info"
        />
        <MetricCard
          label="Absent Today"
          value={totalAbsent.toString()}
          subtext={`${totalLate} marked late`}
          icon={<AlertCircle size={20} />}
          accent="danger"
        />
        <MetricCard
          label="Students Needing Attention"
          value={watchlist.length.toString()}
          subtext="Attendance or academic follow-up"
          icon={<AlertTriangle size={20} />}
          accent="accent"
        />
      </div>

      {/* Exactly 2 Supporting Areas: Attendance by Class & Students Needing Attention */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
        
        {/* Supporting Area 1: Attendance by Class */}
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 className="hhs-headline-sm">Attendance by Class (Today)</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Click any class to open its attendance register.
              </p>
            </div>
            <button
              onClick={() => navigate('/attendance')}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="hhs-table" style={{ width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Class Teacher</th>
                  <th className="tnum" style={{ textAlign: 'center' }}>Present</th>
                  <th className="tnum" style={{ textAlign: 'center' }}>Absent</th>
                  <th className="tnum" style={{ textAlign: 'center' }}>Turnout</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {classes.slice(0, 10).map(cls => {
                  const session = attendanceSessions.find(s => s.classId === cls.id);
                  const present = session ? session.presentCount : 0;
                  const absent = session ? session.absentCount : 0;
                  const total = session ? session.totalStudents : cls.studentCount;
                  const turnout = total > 0 ? Math.round((present / total) * 100) : 0;
                  const isSubmitted = session?.status === 'submitted';

                  return (
                    <tr
                      key={cls.id}
                      onClick={() => navigate(`/attendance/register/${cls.id}`)}
                      style={{ cursor: 'pointer' }}
                      title={`Open register for ${cls.label}`}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--hhs-primary)' }}>{cls.label}</td>
                      <td style={{ color: 'var(--hhs-text-secondary)' }}>{cls.classTeacherName}</td>
                      <td className="tnum" style={{ textAlign: 'center' }}>{present}</td>
                      <td
                        className="tnum"
                        style={{
                          textAlign: 'center',
                          color: absent > 0 ? 'var(--hhs-danger)' : 'inherit',
                          fontWeight: absent > 0 ? 600 : 'normal',
                        }}
                      >
                        {absent}
                      </td>
                      <td className="tnum" style={{ textAlign: 'center', fontWeight: 600 }}>
                        {turnout}%
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <StatusBadge
                          status={isSubmitted ? 'submitted' : 'draft'}
                          label={isSubmitted ? 'Marked' : 'Pending'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Supporting Area 2: Students Needing Attention */}
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 className="hhs-headline-sm">Students Needing Attention</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Based on attendance and academic records.
              </p>
            </div>
            <button
              onClick={() => navigate('/risk-watchlist')}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            >
              <span>View All ({watchlist.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {watchlist.slice(0, 5).map(item => (
              <div
                key={item.student.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--hhs-radius-base)',
                  border: '1px solid var(--hhs-border)',
                  backgroundColor: 'var(--hhs-canvas)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{item.student.fullName}</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                      {item.student.classLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--hhs-accent)', marginTop: '2px', fontWeight: 500 }}>
                    {translateTrigger(item.primaryTrigger)}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                    Attendance: <strong className="tnum">{item.attendanceRate}%</strong>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/students/${item.student.id}`)}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  style={{ flexShrink: 0, padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  <span>View Student</span>
                </button>
              </div>
            ))}

            {watchlist.length === 0 && (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.86rem' }}>
                No students currently flagged for follow-up.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
