/**
 * HanuJai High School ERP — Principal & Executive Dashboard
 * Comprehensive institutional oversight across all 20 sections, attendance muster,
 * academic assessment completion, school-wide care watchlist, and audit ledger.
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
import { RiskEvidenceDrawer } from '../../features/risk/RiskEvidenceDrawer';
import type {
  ClassSection,
  StudentRecord,
  AttendanceSession,
  AuditEvent,
  AttendanceCorrection,
} from '../../domain/types';
import type { RiskWatchlistItem } from '../../data/provider';
import {
  Users,
  CalendarCheck,
  GraduationCap,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Eye,
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
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [watchlist, setWatchlist] = useState<RiskWatchlistItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  // Selected student for risk evidence drawer
  const [selectedRiskStudent, setSelectedRiskStudent] = useState<StudentRecord | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadPrincipalData() {
      setIsLoading(true);
      setError(null);
      try {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const [clsRes, stuRes, attRes, corrRes, watchRes, auditRes] = await Promise.all([
          provider.getClasses(),
          provider.getStudents({ limit: 1000 }),
          provider.getAttendanceSessions(today),
          provider.getAttendanceCorrections(),
          provider.getRiskWatchlist(),
          provider.getAuditEvents({ limit: 6 }),
        ]);

        if (!isMounted) return;
        setClasses(clsRes);
        setAllStudents(stuRes.items);
        setAttendanceSessions(attRes);
        setCorrections(corrRes);
        setWatchlist(watchRes);
        setAuditEvents(auditRes);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load executive dashboard data.');
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
    return <LoadingState message="Aggregating school-wide enrollment, attendance muster, and academic telemetry..." />;
  }

  if (error) {
    return <ErrorBanner title="Executive Telemetry Unavailable" message={error} />;
  }

  // Calculated Real KPIs
  const totalEnrolment = allStudents.length;
  
  // Real Attendance metrics from today's sessions
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

  const cohortAcademicMean = allStudents.length > 0
    ? Math.round((allStudents.reduce((acc, s) => acc + (s.academicAverage || 0), 0) / allStudents.length) * 10) / 10
    : 0;

  const completedSessionsCount = attendanceSessions.filter(s => s.status === 'submitted').length;
  const pendingCorrectionsCount = corrections.filter(c => c.status === 'pending_principal').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <PageHeader
        title="Institutional Executive Desk (Operations Hub)"
        subtitle={`Academic Session 2025–2026 • Whole-School Governance Overview • ${currentUser?.name}`}
        roleScope="Principal Desk"
        breadcrumbs={[{ label: 'Principal Desk' }]}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            {pendingCorrectionsCount > 0 && (
              <button
                onClick={() => navigate('/attendance/corrections')}
                className="hhs-btn hhs-btn-danger"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ShieldCheck size={16} />
                <span>Dual-Custody Approvals ({pendingCorrectionsCount})</span>
              </button>
            )}
            <button
              onClick={() => navigate('/reports')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={16} />
              <span>Statutory Reports</span>
            </button>
          </div>
        }
      />

      {/* Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Total Student Enrollment"
          value={totalEnrolment.toString()}
          subtext={`Across 20 Sections (${classes.length} Nominal Classes)`}
          icon={<Users size={20} />}
        />
        <MetricCard
          label="Today's Attendance Turnout"
          value={`${attendanceTurnoutPct}%`}
          subtext={`${totalPresent} Present • ${totalAbsent} Absent • ${totalLate} Late`}
          icon={<CalendarCheck size={20} />}
          trend={{ value: `${completedSessionsCount}/20 Marked`, isPositive: completedSessionsCount >= 16 }}
        />
        <MetricCard
          label="Academic Health (Cohort Mean)"
          value={`${cohortAcademicMean}%`}
          subtext="Cohort Mean Score across Active Sections"
          icon={<GraduationCap size={20} />}
          trend={{ value: 'Target: 75%+', isPositive: cohortAcademicMean >= 75 }}
        />
        <MetricCard
          label="Care Watchlist"
          value={watchlist.length.toString()}
          subtext="Students flagged by #ATT-01, #ATT-03 or #ACAD-04"
          icon={<AlertTriangle size={20} />}
          trend={{ value: `${watchlist.length} Pending Actions`, isPositive: false }}
        />
      </div>

      {/* Two-Column Primary Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* Left Column: Attendance Muster & Section Completion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">Class-Wise Roll-Call Completion (Today)</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Morning muster tracking for 07:45–09:15 window across all 20 sections.
                </p>
              </div>
              <button
                onClick={() => navigate('/attendance')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>View Full Register</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="hhs-table" style={{ width: '100%', fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th>Class Section</th>
                    <th>Class Tutor</th>
                    <th className="tnum" style={{ textAlign: 'center' }}>Present</th>
                    <th className="tnum" style={{ textAlign: 'center' }}>Absent</th>
                    <th className="tnum" style={{ textAlign: 'center' }}>Turnout</th>
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.slice(0, 8).map(cls => {
                    const session = attendanceSessions.find(s => s.classId === cls.id);
                    const present = session ? session.presentCount : 0;
                    const absent = session ? session.absentCount : 0;
                    const total = session ? session.totalStudents : cls.studentCount;
                    const turnout = total > 0 ? Math.round((present / total) * 100) : 0;
                    const isSubmitted = session?.status === 'submitted';

                    return (
                      <tr key={cls.id}>
                        <td style={{ fontWeight: 600 }}>{cls.label}</td>
                        <td style={{ color: 'var(--hhs-text-secondary)' }}>{cls.classTeacherName}</td>
                        <td className="tnum" style={{ textAlign: 'center' }}>{present}</td>
                        <td className="tnum" style={{ textAlign: 'center', color: absent > 0 ? 'var(--hhs-accent)' : 'inherit' }}>
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

            {classes.length > 8 && (
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <button
                  onClick={() => navigate('/attendance')}
                  className="hhs-btn hhs-btn-text hhs-btn-sm"
                >
                  View all 20 sections in Attendance Muster &rarr;
                </button>
              </div>
            )}
          </div>

          {/* Academic Assessment Progress */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">Active Academic Cycles</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Continuous scholastic assessments and marks compilation status.
                </p>
              </div>
              <button
                onClick={() => navigate('/assessments')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Assessment Cycles</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', border: '1px solid var(--hhs-border)', backgroundColor: 'var(--hhs-canvas)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Unit Test 1</span>
                  <StatusBadge status="locked" label="Finalized" />
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '6px' }}>
                  Max Marks: 25 • Weight: 10%
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.84rem', marginTop: '8px', color: 'var(--hhs-primary)' }}>
                  100% Registers Published
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', border: '1px solid var(--hhs-accent)', backgroundColor: 'var(--hhs-canvas)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Unit Test 2</span>
                  <StatusBadge status="pending" label="Active Marking" />
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '6px' }}>
                  Max Marks: 25 • Weight: 10%
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.84rem', marginTop: '8px', color: 'var(--hhs-accent)' }}>
                  Marks Registers in Progress
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Care Watchlist & System Audit Stream */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Care Watchlist */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">Explainable Student Care Flags</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Quantitative rule-based triggers requiring pastoral follow-up.
                </p>
              </div>
              <button
                onClick={() => navigate('/risk-watchlist')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              >
                <span>All Flags</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {watchlist.slice(0, 4).map(item => (
                <div
                  key={item.student.id}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: '1px solid var(--hhs-border)',
                    backgroundColor: 'var(--hhs-canvas)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{item.student.fullName}</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>{item.student.classLabel}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                    Trigger: <span style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>{item.primaryTrigger}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span className="tnum" style={{ fontSize: '0.76rem', color: 'var(--hhs-text-muted)' }}>
                      Turnout: {item.attendanceRate}%
                    </span>
                    <button
                      onClick={() => setSelectedRiskStudent(item.student)}
                      className="hhs-btn hhs-btn-text hhs-btn-sm"
                      style={{ padding: '2px 6px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Eye size={12} />
                      <span>Inspect Evidence</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Immutable Audit Ledger Feed */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">Recent Audit Stream</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Non-repudiable operational change log.
                </p>
              </div>
              <button
                onClick={() => navigate('/audit-log')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              >
                <span>Full Audit</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {auditEvents.slice(0, 5).map(event => (
                <div
                  key={event.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--hhs-radius-base)',
                    backgroundColor: 'var(--hhs-surface-muted)',
                    fontSize: '0.8rem',
                    borderLeft: '3px solid var(--hhs-primary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hhs-text-muted)', fontSize: '0.72rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>{event.actorName}</span>
                    <span className="tnum">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                    {event.summary}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Evidence Drawer Modal */}
      {selectedRiskStudent && (
        <RiskEvidenceDrawer
          isOpen={Boolean(selectedRiskStudent)}
          student={selectedRiskStudent}
          onClose={() => setSelectedRiskStudent(null)}
        />
      )}
    </div>
  );
};
