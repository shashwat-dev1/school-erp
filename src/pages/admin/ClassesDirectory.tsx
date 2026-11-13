import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { getSchoolLocalDate } from '../../domain/policy';
import type { ClassSection, AttendanceSession } from '../../domain/types';
import {
  Users,
  Search,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const ClassesDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [todaySessions, setTodaySessions] = useState<AttendanceSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [wingFilter, setWingFilter] = useState<'all' | 'senior' | 'middle' | 'primary'>('all');
  const today = getSchoolLocalDate();

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [classData, sessionData] = await Promise.all([
          provider.getClasses(),
          provider.getAttendanceSessions(today).catch(() => []),
        ]);
        if (!isMounted) return;
        setClasses(classData);
        setTodaySessions(sessionData || []);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load classes.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [provider, today]);

  const filteredClasses = useMemo(() => {
    return classes.filter(cls => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cls.label.toLowerCase().includes(q) ||
        (cls.roomNumber && cls.roomNumber.toLowerCase().includes(q));

      let matchesWing = true;
      const grade = cls.gradeLevel ?? cls.grade ?? 1;
      if (wingFilter === 'senior') {
        matchesWing = grade >= 9;
      } else if (wingFilter === 'middle') {
        matchesWing = grade >= 6 && grade <= 8;
      } else if (wingFilter === 'primary') {
        matchesWing = grade <= 5;
      }

      return matchesSearch && matchesWing;
    });
  }, [classes, searchQuery, wingFilter]);

  const totalEnrollment = useMemo(() => {
    return classes.reduce((acc, c) => acc + (c.studentCount || 0), 0);
  }, [classes]);

  const sessionMap = useMemo(() => {
    const map = new Map<string, AttendanceSession>();
    todaySessions.forEach(s => map.set(s.classId, s));
    return map;
  }, [todaySessions]);

  if (isLoading) {
    return <LoadingState message="Loading classes & sections..." />;
  }

  const role = currentUser?.role;

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Classes & Sections Directory"
        subtitle="School-wide roster configurations and daily class attendance access."
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Classes & Sections', to: '/classes' },
        ]}
      />

      {error && <ErrorBanner message={error} />}

      {/* Metrics Strip — Genuinely useful operational summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Total Classes &amp; Sections</div>
          <div className="hhs-metric-value">{classes.length} Classes</div>
          <div className="hhs-metric-sub">Classes 1 to 10 (Sections A &amp; B)</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Total Enrolled Students</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {totalEnrollment.toLocaleString('en-IN')} Students
          </div>
          <div className="hhs-metric-sub">Active Student Roll Roster</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div
        className="hhs-panel"
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          backgroundColor: 'var(--hhs-surface)',
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--hhs-text-muted)' }}
          />
          <input
            type="text"
            className="hhs-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search class (e.g. 10-A), room number..."
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>Wing Division:</label>
          <select
            className="hhs-select"
            value={wingFilter}
            onChange={e => setWingFilter(e.target.value as 'all' | 'senior' | 'middle' | 'primary')}
            style={{ width: 'auto' }}
          >
            <option value="all">All Wings (1–10)</option>
            <option value="senior">Senior Wing (Classes 9–10)</option>
            <option value="middle">Middle Wing (Classes 6–8)</option>
            <option value="primary">Primary Wing (Classes 1–5)</option>
          </select>
        </div>
      </div>

      {/* Class Section Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {filteredClasses.map(cls => {
          const session = sessionMap.get(cls.id);
          const isSubmitted = session && (session.status === 'submitted' || session.status === 'corrected');
          const maxCapacity = 50;
          const studentCount = cls.studentCount || 0;
          const pctCapacity = Math.round((studentCount / maxCapacity) * 100);

          return (
            <div
              key={cls.id}
              className="hhs-panel"
              style={{
                borderLeft: isSubmitted ? '4px solid #10B981' : '1px solid var(--hhs-border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '16px',
                gap: '14px',
                backgroundColor: 'var(--hhs-surface)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                      {cls.label}
                    </h3>
                    {cls.roomNumber && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Building size={13} style={{ color: 'var(--hhs-text-muted)' }} />
                        <span>{cls.roomNumber}</span>
                      </div>
                    )}
                  </div>
                  <span className="hhs-badge hhs-badge-primary">
                    {(cls.gradeLevel ?? cls.grade ?? 1) >= 9 ? 'Senior Wing' : (cls.gradeLevel ?? cls.grade ?? 1) >= 6 ? 'Middle Wing' : 'Primary Wing'}
                  </span>
                </div>

                {/* Attendance Status Today */}
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isSubmitted ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#065F46',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        padding: '3px 10px',
                        borderRadius: '6px',
                      }}
                    >
                      <CheckCircle2 size={13} color="#10B981" />
                      <span>Submitted Today ({session.presentCount || 0} P / {session.absentCount || 0} A)</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#92400E',
                        backgroundColor: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        padding: '3px 10px',
                        borderRadius: '6px',
                      }}
                    >
                      <Clock size={13} color="#D97706" />
                      <span>Pending Register</span>
                    </span>
                  )}
                </div>

                {/* Capacity Progress Bar */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', marginBottom: '3px' }}>
                    <span>Enrolled Students</span>
                    <span style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                      {studentCount} / {maxCapacity} ({pctCapacity}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--hhs-surface-muted)', borderRadius: 'var(--hhs-radius-pill)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(pctCapacity, 100)}%`,
                        backgroundColor: 'var(--hhs-primary)',
                        borderRadius: 'var(--hhs-radius-pill)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons: Only View Students & Attendance */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  borderTop: '1px solid var(--hhs-border)',
                  paddingTop: '12px',
                }}
              >
                <button
                  onClick={() => navigate(`/classes/${cls.id}/students`)}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ fontSize: '0.78rem', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  title={`View student roster for ${cls.label}`}
                >
                  <Users size={14} />
                  <span>View Students</span>
                </button>
                <button
                  onClick={() => navigate(`/attendance/register/${cls.id}`)}
                  className="hhs-btn hhs-btn-primary"
                  style={{ fontSize: '0.78rem', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  title={role === 'principal' ? `View attendance register for ${cls.label}` : `Enter attendance register for ${cls.label}`}
                >
                  <Calendar size={14} />
                  <span>Attendance</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
