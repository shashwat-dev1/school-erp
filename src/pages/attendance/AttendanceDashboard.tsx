import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { ClassSection, AttendanceSession, AttendanceCorrection } from '../../domain/types';
import { getSchoolLocalDate } from '../../domain/policy';
import { PHASE_CONFIG } from '../../config/phase';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

export const AttendanceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getSchoolLocalDate());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [clsList, sessList, corrList] = await Promise.all([
          provider.getClasses(),
          provider.getAttendanceSessions(selectedDate),
          provider.getAttendanceCorrections(),
        ]);
        if (!isMounted) return;
        setClasses(clsList);
        setSessions(sessList);
        setCorrections(corrList);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load attendance dashboard.';
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [provider, selectedDate]);

  if (isLoading) {
    return <LoadingState message="Reconciling campus morning roll call status & registers..." />;
  }

  const role = currentUser?.role;
  const pendingCorrectionsCount = corrections.filter(c => c.status === 'pending_principal').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="Class Attendance Registers"
        subtitle="HanuJai High School, Jaipur • Morning roll call monitoring (07:45 – 09:15 IST) and dual-custody audit reconciliation."
        breadcrumbs={[
          { label: 'Campus' },
          { label: 'Attendance' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            {!PHASE_CONFIG.phase1Only && (
              <button
                onClick={() => navigate('/attendance/corrections')}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <UserCheck size={15} />
                <span>Late Corrections Queue</span>
                {pendingCorrectionsCount > 0 && (
                  <span className="hhs-badge hhs-badge-accent" style={{ marginLeft: '4px' }}>
                    {pendingCorrectionsCount} Pending
                  </span>
                )}
              </button>
            )}
            {role === 'class_teacher' && currentUser?.assignedClassId && (
              <button
                onClick={() => navigate(`/attendance/register/${currentUser.assignedClassId}`)}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CalendarCheck size={15} />
                <span>Mark My Section Attendance</span>
              </button>
            )}
          </div>
        }
      />

      {error && <ErrorBanner title="Attendance Error" message={error} />}

      {/* Date Filter & Summary Banner */}
      <div
        className="hhs-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <label className="hhs-label" htmlFor="dash-date" style={{ marginBottom: 0 }}>
              Operational Date:
            </label>
          </div>
          <input
            id="dash-date"
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="hhs-input tnum"
            style={{ width: '160px' }}
          />
          <span className="hhs-badge hhs-badge-primary">Window: 07:45 – 09:15 AM</span>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '0.82rem' }}>
          <div>
            Total Sections: <strong className="tnum">{classes.length}</strong>
          </div>
          <div>
            Finalized Today: <strong className="tnum" style={{ color: 'var(--hhs-primary)' }}>{sessions.length}</strong>
          </div>
          <div>
            Pending Roll Call:{' '}
            <strong className="tnum" style={{ color: 'var(--hhs-accent)' }}>
              {Math.max(0, classes.length - sessions.length)}
            </strong>
          </div>
        </div>
      </div>

      {/* Grid of Class Section Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {classes.map(cls => {
          const session = sessions.find(s => s.classId === cls.id);
          const isSubmitted = session && (session.status === 'submitted' || session.status === 'corrected');
          const isAssigned = currentUser?.assignedClassId === cls.id;

          return (
            <div
              key={cls.id}
              className="hhs-card"
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: isSubmitted
                  ? '4px solid var(--hhs-primary)'
                  : '4px solid var(--hhs-accent)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="hhs-headline-sm" style={{ fontSize: '1.05rem', margin: 0 }}>
                      {cls.label}
                    </span>
                    {isAssigned && (
                      <span className="hhs-badge hhs-badge-secondary" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                        Your Section
                      </span>
                    )}
                  </div>
                  {isSubmitted ? (
                    <span className="hhs-badge hhs-badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={11} /> Finalized
                    </span>
                  ) : (
                    <span className="hhs-badge hhs-badge-accent" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> Window Open
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginBottom: '12px' }}>
                  Tutor: <strong>{cls.classTeacherName}</strong> • Room: {cls.roomNumber}
                </div>

                {session ? (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--hhs-canvas)',
                      borderRadius: 'var(--hhs-radius-base)',
                      border: '1px solid var(--hhs-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div>
                      Present: <strong className="tnum" style={{ color: 'var(--pop-apple-green)' }}>{session.presentCount}</strong>
                    </div>
                    <div>
                      Absent: <strong className="tnum" style={{ color: 'var(--pop-coral-red)' }}>{session.absentCount}</strong>
                    </div>
                    <div>
                      Total: <strong className="tnum">{session.totalStudents}</strong>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--hhs-surface-hover)',
                      borderRadius: 'var(--hhs-radius-base)',
                      border: '1px solid var(--hhs-border)',
                      marginBottom: '12px',
                      fontSize: '0.78rem',
                      color: 'var(--hhs-text-secondary)',
                    }}
                  >
                    Strength: <strong className="tnum">{cls.studentCount} students</strong> • Roll call pending
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate(`/attendance/register/${cls.id}`)}
                className={isSubmitted || role === 'principal' ? 'hhs-btn hhs-btn-secondary' : 'hhs-btn hhs-btn-primary'}
                style={{
                  width: '100%',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>
                  {isSubmitted
                    ? 'View Completed Register'
                    : role === 'principal'
                    ? 'View Attendance Register'
                    : 'Mark Daily Roll Call'}
                </span>
                <ArrowRight size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
