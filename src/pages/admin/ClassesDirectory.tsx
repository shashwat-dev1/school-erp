import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { ClassSection } from '../../domain/types';
import {
  BookOpen,
  Users,
  Search,
  UserCheck,
  Building,
} from 'lucide-react';

export const ClassesDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [wingFilter, setWingFilter] = useState<'all' | 'senior' | 'middle' | 'primary'>('all');

  useEffect(() => {
    let isMounted = true;
    async function loadClasses() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await provider.getClasses();
        if (!isMounted) return;
        setClasses(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load classes.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadClasses();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  const filteredClasses = useMemo(() => {
    return classes.filter(cls => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cls.label.toLowerCase().includes(q) ||
        cls.classTeacherName.toLowerCase().includes(q) ||
        cls.roomNumber.toLowerCase().includes(q);

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
    return classes.reduce((acc, c) => acc + c.studentCount, 0);
  }, [classes]);

  if (isLoading) {
    return <LoadingState message="Loading classes & sections..." />;
  }

  const role = currentUser?.role || 'principal';

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Classes & Sections Master Directory"
        subtitle="Roster configurations, room assignments, and class educator allocations for Academic Session 2025–26."
        roleScope="Academic Structure"
        breadcrumbs={[
          { label: 'Operations Hub', to: '/' },
          { label: 'Classes & Sections', to: '/classes' },
        ]}
        actions={
          (role === 'principal' || role === 'office_admin') ? (
            <button
              onClick={() => navigate('/admin/class-teachers')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserCheck size={16} />
              <span>Manage Class Tutors</span>
            </button>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Metrics Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Active Sections</div>
          <div className="hhs-metric-value">{classes.length} Sections</div>
          <div className="hhs-metric-sub">Classes 1 to 10 (A &amp; B)</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Total Student Roster</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {totalEnrollment} Students
          </div>
          <div className="hhs-metric-sub">Max Capacity: 800 (40/sec)</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Class Educators Assigned</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            100% Quorum
          </div>
          <div className="hhs-metric-sub">All 20 sections assigned</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Board Affiliation</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.15rem' }}>
            CBSE #1730249
          </div>
          <div className="hhs-metric-sub">Jaipur Central Zone</div>
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
            placeholder="Search class (e.g. 10-A), tutor name, room number..."
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
          const is10A = cls.id === 'class-10-a';
          const maxCapacity = 40;
          const pctCapacity = Math.round((cls.studentCount / maxCapacity) * 100);

          return (
            <div
              key={cls.id}
              className="hhs-panel"
              style={{
                borderLeft: is10A ? '4px solid var(--hhs-primary)' : '1px solid var(--hhs-border)',
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Building size={13} style={{ color: 'var(--hhs-text-muted)' }} />
                      <span>{cls.roomNumber}</span>
                    </div>
                  </div>
                  <span className="hhs-badge hhs-badge-primary">
                    {(cls.gradeLevel ?? cls.grade ?? 1) >= 9 ? 'Senior Wing' : (cls.gradeLevel ?? cls.grade ?? 1) >= 6 ? 'Middle Wing' : 'Primary Wing'}
                  </span>
                </div>

                <div style={{ marginTop: '12px', fontSize: '0.84rem' }}>
                  <div style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    Class Educator / Tutor
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                    {cls.classTeacherName}
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', marginBottom: '3px' }}>
                    <span>Enrollment Load</span>
                    <span style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                      {cls.studentCount} / {maxCapacity} ({pctCapacity}%)
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

              {/* Action Buttons */}
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
                  style={{ fontSize: '0.78rem', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Users size={14} />
                  <span>Roster</span>
                </button>
                <button
                  onClick={() => navigate(`/classes/${cls.id}/performance`)}
                  className="hhs-btn hhs-btn-primary"
                  style={{ fontSize: '0.78rem', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <BookOpen size={14} />
                  <span>Marks</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
