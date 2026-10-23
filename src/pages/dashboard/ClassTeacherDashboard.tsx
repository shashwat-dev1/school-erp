/**
 * HanuJai High School ERP — Class Teacher Workspace
 * Clean, focused view for the assigned class (e.g. Class 10-A).
 * Prioritizes daily roll call, absent follow-up, and class performance.
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
} from '../../domain/types';
import type { RiskWatchlistItem } from '../../data/provider';
import {
  CalendarCheck,
  Users,
  AlertTriangle,
  Phone,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';

export const ClassTeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const assignedClassId = currentUser?.assignedClassId;
  const assignedClassLabel = currentUser?.assignedClassLabel || (assignedClassId ? `Class ${assignedClassId.toUpperCase()}` : 'Assigned Class');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [classSection, setClassSection] = useState<ClassSection | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [todaySession, setTodaySession] = useState<AttendanceSession | null>(null);
  const [classWatchlist, setClassWatchlist] = useState<RiskWatchlistItem[]>([]);

  useEffect(() => {
    if (!assignedClassId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadClassTeacherData() {
      setIsLoading(true);
      setError(null);
      try {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const [cls, stuList, session, watchlist] = await Promise.all([
          provider.getClassById(assignedClassId!),
          provider.getClassStudents(assignedClassId!),
          provider.getAttendanceSession(assignedClassId!, today),
          provider.getRiskWatchlist(assignedClassId!),
        ]);

        if (!isMounted) return;
        setClassSection(cls);
        setStudents(stuList);
        setTodaySession(session);
        setClassWatchlist(watchlist);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Could not load class records.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadClassTeacherData();
    return () => {
      isMounted = false;
    };
  }, [provider, assignedClassId]);

  if (!assignedClassId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PageHeader
          title="My Class"
          subtitle="Class Teacher Workspace"
        />
        <ErrorBanner
          title="No Class Assigned"
          message="Your account is not assigned to a class section yet. Please ask the Principal to assign your class."
        />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState message={`Loading ${assignedClassLabel} records...`} />;
  }

  if (error || !classSection) {
    return <ErrorBanner title="Could not load class" message={error || 'Class not found.'} />;
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

  const isAttendanceSubmitted = todaySession?.status === 'submitted';

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
    return trigger.replace(/#[A-Z]+-[0-9]+/g, '').trim() || 'Needs academic follow-up';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <PageHeader
        title={`My Class (${assignedClassLabel})`}
        subtitle={`Class Teacher: ${currentUser?.name} • Room ${classSection.roomNumber} • Session 2025–2026`}
        roleScope={assignedClassLabel}
        breadcrumbs={[{ label: 'My Class' }]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate(`/attendance/register/${assignedClassId}`)}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CalendarCheck size={15} />
              <span>{isAttendanceSubmitted ? 'Review Attendance' : 'Mark Today’s Attendance'}</span>
            </button>
            <button
              onClick={() => navigate(`/performance/classes/${assignedClassId}`)}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <GraduationCap size={15} />
              <span>Class Results</span>
            </button>
          </div>
        }
      />

      {/* Prominent Call to Action with Canary Yellow Alert Pop Banner */}
      {!isAttendanceSubmitted && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--hhs-radius-container)',
            backgroundColor: 'var(--pop-canary-yellow-tint)',
            border: '1.5px solid var(--pop-canary-yellow)',
            borderLeft: '5px solid var(--pop-canary-yellow)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: 'var(--hhs-shadow-level-1)',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: '#202033', fontSize: '0.94rem' }}>
              Today&apos;s Attendance is Pending
            </div>
            <div style={{ fontSize: '0.82rem', color: '#45455E', marginTop: '2px' }}>
              Please take roll call for {assignedClassLabel} and submit the register.
            </div>
          </div>
          <button
            onClick={() => navigate(`/attendance/register/${assignedClassId}`)}
            className="hhs-btn hhs-btn-primary"
          >
            Take Attendance Now
          </button>
        </div>
      )}

      {/* 4 Focused Scoped Metrics with Vibrant Pop Accents */}
      <div className="hhs-metrics-grid">
        <MetricCard
          label="Total Students"
          value={totalStudents.toString()}
          subtext={`Room ${classSection.roomNumber}`}
          icon={<Users size={20} />}
          accent="primary"
        />
        <MetricCard
          label="Present Today"
          value={presentCount.toString()}
          subtext={`${attendanceRate}% turnout today`}
          icon={<CheckCircle size={20} />}
          accent="success"
        />
        <MetricCard
          label="Absent Today"
          value={absentCount.toString()}
          subtext={`${lateCount} marked late`}
          icon={<AlertCircle size={20} />}
          accent="danger"
        />
        <MetricCard
          label="Students Needing Attention"
          value={classWatchlist.length.toString()}
          subtext="In your class"
          icon={<AlertTriangle size={20} />}
          accent="warning"
        />
      </div>

      {/* 2 Supporting Areas: Absent Students Follow-up & Class Performance Summary */}
      <div className="hhs-grid-2col">
        
        {/* Supporting Area 1: Absent Students & Parent Contacts */}
        <div className="hhs-card" style={{ padding: 'clamp(14px, 2vw, 20px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 className="hhs-headline-sm">Absent Students Today ({absentStudents.length})</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Guardian contact numbers for parent check.
              </p>
            </div>
            <button
              onClick={() => navigate(`/attendance/register/${assignedClassId}`)}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            >
              <span>Attendance Register</span>
            </button>
          </div>

          {absentStudents.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--hhs-text-secondary)', backgroundColor: 'var(--hhs-canvas)', borderRadius: 'var(--hhs-radius-base)' }}>
              {isAttendanceSubmitted
                ? `All ${totalStudents} students in ${assignedClassLabel} are present today.`
                : 'Attendance has not been taken yet today.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {absentStudents.map(({ record, student }) => (
                <div
                  key={record.studentId}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: '1px solid var(--hhs-border)',
                    backgroundColor: 'var(--hhs-canvas)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      Roll #{record.rollNumber} — {record.studentName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={12} />
                      <span>Guardian: {student?.guardianName || 'Parent'} ({student?.primaryPhone || 'No Phone'})</span>
                    </div>
                  </div>

                  {student && (
                    <button
                      onClick={() => navigate(`/students/${student.id}`)}
                      className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                      style={{ flexShrink: 0, padding: '4px 8px', fontSize: '0.76rem' }}
                    >
                      <span>View</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supporting Area 2: Class Performance & Attention List */}
        <div className="hhs-card" style={{ padding: 'clamp(14px, 2vw, 20px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 className="hhs-headline-sm">Students Needing Follow-up</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Academic or attendance flags.
              </p>
            </div>
            <button
              onClick={() => navigate('/behaviour')}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            >
              <span>Teacher notes</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {classWatchlist.slice(0, 4).map(item => (
              <div
                key={item.student.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--hhs-radius-base)',
                  border: '1px solid var(--hhs-border)',
                  backgroundColor: 'var(--hhs-canvas)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                    Roll #{item.student.rollNumber} — {item.student.fullName}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--hhs-accent)', marginTop: '2px' }}>
                    {translateTrigger(item.primaryTrigger)}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                    Attendance: <strong className="tnum">{item.attendanceRate}%</strong>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/students/${item.student.id}`)}
                  className="hhs-btn hhs-btn-text hhs-btn-sm"
                  style={{ color: 'var(--hhs-primary)', padding: '2px 6px' }}
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}

            {classWatchlist.length === 0 && (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                No students currently flagged in your class.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
