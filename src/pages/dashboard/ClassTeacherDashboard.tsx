/**
 * HanuJai High School ERP — Class Teacher Desk
 * Scoped EXCLUSIVELY to the assigned class section (e.g. Class 10-A).
 * Prioritizes daily roll-call, absent follow-up with parent phones,
 * dual-custody attendance corrections, and consolidated class subject progress.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type {
  ClassSection,
  StudentRecord,
  AttendanceSession,
  AttendanceCorrection,
} from '../../domain/types';
import type { RiskWatchlistItem, ConsolidatedClassMarks } from '../../data/provider';
import {
  CalendarCheck,
  Users,
  AlertTriangle,
  Phone,
  FileCheck2,
  Clock,
  ArrowRight,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

export const ClassTeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const assignedClassId = currentUser?.assignedClassId || 'class-10-a';
  const assignedClassLabel = currentUser?.assignedClassLabel || 'Class 10-A';

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [classSection, setClassSection] = useState<ClassSection | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [todaySession, setTodaySession] = useState<AttendanceSession | null>(null);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [classWatchlist, setClassWatchlist] = useState<RiskWatchlistItem[]>([]);
  const [consolidatedMarks, setConsolidatedMarks] = useState<ConsolidatedClassMarks | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadClassTeacherData() {
      setIsLoading(true);
      setError(null);
      try {
        const today = '2026-10-21';
        const [cls, stuList, session, corrList, watchlist, marks] = await Promise.all([
          provider.getClassById(assignedClassId),
          provider.getClassStudents(assignedClassId),
          provider.getAttendanceSession(assignedClassId, today),
          provider.getAttendanceCorrections(assignedClassId),
          provider.getRiskWatchlist(assignedClassId),
          provider.getConsolidatedClassMarks(assignedClassId, 'assess-ut1-2025'),
        ]);

        if (!isMounted) return;
        setClassSection(cls);
        setStudents(stuList);
        setTodaySession(session);
        setCorrections(corrList);
        setClassWatchlist(watchlist);
        setConsolidatedMarks(marks);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load assigned section data.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadClassTeacherData();
    return () => {
      isMounted = false;
    };
  }, [provider, assignedClassId]);

  if (isLoading) {
    return <LoadingState message={`Retrieving ${assignedClassLabel} classroom records, roll muster, and pastoral care ledger...`} />;
  }

  if (error || !classSection) {
    return <ErrorBanner title="Classroom Workspace Unavailable" message={error || 'Assigned class not found.'} />;
  }

  const totalStudents = students.length;
  const presentCount = todaySession ? todaySession.presentCount : 0;
  const absentCount = todaySession ? todaySession.absentCount : 0;
  const lateCount = todaySession ? todaySession.lateCount : 0;
  const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Filter absent students from today's session
  const absentRecords = todaySession?.records.filter(r => r.state === 'absent') || [];
  const absentStudents = absentRecords.map(r => {
    const stu = students.find(s => s.id === r.studentId);
    return { record: r, student: stu };
  });

  const pendingCorrections = corrections.filter(c => c.status === 'pending_principal');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <PageHeader
        title={`${assignedClassLabel} Classroom Desk`}
        subtitle={`Class Tutor: ${currentUser?.name} • Room: ${classSection.roomNumber} • Academic Session 2025–2026`}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate(`/attendance/register/${assignedClassId}`)}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CalendarCheck size={16} />
              <span>{todaySession?.status === 'submitted' ? 'Review Today’s Roll' : 'Mark Daily Attendance'}</span>
            </button>
            <button
              onClick={() => navigate(`/classes/${assignedClassId}/performance`)}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileCheck2 size={16} />
              <span>Performance Matrix</span>
            </button>
          </div>
        }
      />

      {/* Scoped Class Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <MetricCard
          label={`${assignedClassLabel} Enrolment`}
          value={`${totalStudents} Students`}
          subtext={`Room: ${classSection.roomNumber} • Max Capacity: ${classSection.maxCapacity}`}
          icon={<Users size={20} />}
        />
        <MetricCard
          label="Today's Roll Turnout"
          value={`${attendanceRate}%`}
          subtext={`${presentCount} Present • ${absentCount} Absent • ${lateCount} Late`}
          icon={<CalendarCheck size={20} />}
          trend={{ value: todaySession?.status === 'submitted' ? 'Session Submitted' : 'Pending Submission', isPositive: todaySession?.status === 'submitted' }}
        />
        <MetricCard
          label="Pending Late Corrections"
          value={pendingCorrections.length.toString()}
          subtext="Awaiting Principal counter-authorization"
          icon={<UserCheck size={20} />}
          trend={{ value: pendingCorrections.length > 0 ? 'Dual-Custody Queue' : 'Queue Clear', isPositive: pendingCorrections.length === 0 }}
        />
        <MetricCard
          label={`${assignedClassLabel} Care Watchlist`}
          value={classWatchlist.length.toString()}
          subtext="Students flagged in your section"
          icon={<AlertTriangle size={20} />}
          trend={{ value: `${classWatchlist.length} Students`, isPositive: classWatchlist.length === 0 }}
        />
      </div>

      {/* Two Column Layout: Daily Roll / Absent Follow-up vs Performance & Care */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* Left Column: Today's Roll & Absent Follow-up */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Absent Students Outreach Panel */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">Today&rsquo;s Absent Follow-Up ({absentStudents.length})</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Unmarked or absent students in {assignedClassLabel} requiring tutor outreach or parent check.
                </p>
              </div>
              <button
                onClick={() => navigate(`/attendance/register/${assignedClassId}`)}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              >
                <span>Open Register</span>
              </button>
            </div>

            {absentStudents.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-secondary)', backgroundColor: 'var(--hhs-canvas)', borderRadius: 'var(--hhs-radius-base)' }}>
                Excellent! All {totalStudents} students in {assignedClassLabel} are marked present or excused today.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {absentStudents.map(({ record, student }) => (
                  <div
                    key={record.studentId}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--hhs-radius-base)',
                      border: '1px solid var(--hhs-border)',
                      backgroundColor: 'var(--hhs-canvas)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        Roll #{record.rollNumber} — {record.studentName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Phone size={12} />
                        <span>Guardian: {student?.guardianName || 'Parent'} ({student?.primaryPhone || 'No Phone'})</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => navigate('/attendance/corrections')}
                        className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                        style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                      >
                        Request Late Correction
                      </button>
                      <button
                        onClick={() => navigate(`/students/${record.studentId}`)}
                        className="hhs-btn hhs-btn-text hhs-btn-sm"
                        style={{ fontSize: '0.76rem' }}
                      >
                        Dossier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consolidated Subject Performance for 10-A */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">{assignedClassLabel} Subject Performance Snapshot</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Unit Test 1 cohort averages across curriculum subjects for your class.
                </p>
              </div>
              <button
                onClick={() => navigate(`/classes/${assignedClassId}/performance`)}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Full Ledger</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {consolidatedMarks && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                {consolidatedMarks.subjects.map(sub => {
                  const avg = consolidatedMarks.subjectAverages[sub.id] || 0;
                  return (
                    <div
                      key={sub.id}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--hhs-radius-base)',
                        backgroundColor: 'var(--hhs-surface-muted)',
                        border: '1px solid var(--hhs-border)',
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {sub.code}
                      </div>
                      <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--hhs-primary)', marginTop: '4px' }}>
                        {avg}/25
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
                        {sub.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Class Care Watchlist & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Class Care Watchlist */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 className="hhs-headline-sm">{assignedClassLabel} Pastoral Watchlist</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Students requiring attention in your assigned section.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {classWatchlist.map(item => (
                <div
                  key={item.student.id}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: '1px solid var(--hhs-border)',
                    backgroundColor: 'var(--hhs-canvas)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                      Roll #{item.student.rollNumber} — {item.student.fullName}
                    </span>
                    <button
                      onClick={() => navigate(`/students/${item.student.id}`)}
                      className="hhs-btn hhs-btn-text hhs-btn-sm"
                      style={{ fontSize: '0.74rem', padding: '0 4px' }}
                    >
                      Profile
                    </button>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--hhs-accent)', fontWeight: 600, marginTop: '4px' }}>
                    {item.primaryTrigger}
                  </div>
                  <div className="tnum" style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                    Attendance: {item.attendanceRate}% • Academic Avg: {item.student.academicAverage}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Class Tutor Operational Shortcuts */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '12px' }}>Classroom Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => navigate(`/classes/${assignedClassId}/students`)}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Users size={14} />
                <span>View {assignedClassLabel} Nominal Roll</span>
              </button>
              <button
                onClick={() => navigate('/behaviour')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <ShieldAlert size={14} />
                <span>Log Pastoral Care Observation</span>
              </button>
              <button
                onClick={() => navigate('/attendance/corrections')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Clock size={14} />
                <span>Attendance Correction History</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
