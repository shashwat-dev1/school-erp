import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { AssessmentCycle } from '../../domain/types';
import {
  FileCheck2,
  Calendar,
  BookOpen,
} from 'lucide-react';

export const AssessmentList: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [cycles, setCycles] = useState<AssessmentCycle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCycles() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await provider.getAssessmentCycles();
        if (!isMounted) return;
        setCycles(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load assessment cycles.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadCycles();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  if (isLoading) {
    return <LoadingState message="Loading assessment cycles..." />;
  }

  const role = currentUser?.role;
  const isSubjectTeacher = role === 'subject_teacher';

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Assessment Cycles & Marks Entry"
        subtitle="Manage term examination milestones, maximum marks rules, and subject-wise score registration."
        roleScope="Academic Operations"
        breadcrumbs={[
          { label: currentUser?.role === 'principal' ? 'Academic Oversight' : 'My Teaching', to: '/' },
          { label: 'Assessments', to: '/assessments' },
        ]}
        actions={undefined}
      />

      {error && <ErrorBanner message={error} />}

      {/* Institutional Operational Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Assessment Cycles</div>
          <div className="hhs-metric-value">{cycles.length} Cycles</div>
          <div className="hhs-metric-sub">Academic Session 2025–26</div>
        </div>
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Current Entry Window</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            Unit Test 2
          </div>
          <div className="hhs-metric-sub">Open for marks entry</div>
        </div>
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Finalized Registers</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-text-primary)' }}>
            Unit Test 1
          </div>
          <div className="hhs-metric-sub">Locked &amp; signed off</div>
        </div>
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Evaluation Standard</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-text-primary)' }}>
            33% Passing
          </div>
          <div className="hhs-metric-sub">Institutional standard criteria</div>
        </div>
      </div>

      {/* Cycles Master Table */}
      <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--hhs-border)',
            backgroundColor: 'var(--hhs-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--hhs-text-primary)' }}>
              Examination & Evaluation Schedule
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', margin: '2px 0 0' }}>
              Official evaluation milestones registered for HanuJai High School.
            </p>
          </div>
          <span className="hhs-badge hhs-badge-primary">Session 2025–26</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Assessment Cycle</th>
                <th>Academic Term</th>
                <th className="numeric">Max Marks</th>
                <th className="numeric">Pass Mark (33%)</th>
                <th className="numeric">Weightage</th>
                <th>Window Schedule</th>
                <th>Registry Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle, index) => {
                return (
                  <tr key={cycle.id}>
                    <td className="numeric" style={{ color: 'var(--hhs-text-muted)' }}>
                      {index + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                        {cycle.name || cycle.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                        ID: {cycle.id}
                      </div>
                    </td>
                    <td>
                      <span className="hhs-badge hhs-badge-neutral">
                        {cycle.term === 'term1' ? 'Term I (Apr–Sep)' : 'Term II (Oct–Mar)'}
                      </span>
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {cycle.maxMarks}
                    </td>
                    <td className="numeric" style={{ color: 'var(--hhs-text-secondary)' }}>
                      {cycle.passingMarks}
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {cycle.weightagePercent}%
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} style={{ color: 'var(--hhs-text-muted)' }} />
                        <span>
                          {cycle.startDate} to {cycle.endDate}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        status={
                          cycle.status === 'published'
                            ? 'active'
                            : cycle.status === 'locked'
                            ? 'inactive'
                            : 'pending'
                        }
                        label={
                          cycle.status === 'published'
                            ? 'Published'
                            : cycle.status === 'locked'
                            ? 'Locked'
                            : 'In Draft'
                        }
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => navigate(`/academics/marks/${cycle.id}`)}
                          className="hhs-btn hhs-btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px', height: '30px' }}
                          title="Open Marks Entry Register"
                        >
                          <FileCheck2 size={14} />
                          <span>{isSubjectTeacher ? 'Enter Marks' : 'Marks Sheet'}</span>
                        </button>

                        <button
                          onClick={() => {
                            const targetClass = currentUser?.assignedClassId || currentUser?.assignedClasses?.[0] || 'class-10-a';
                            navigate(`/performance/classes/${targetClass}`);
                          }}
                          className="hhs-btn hhs-btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '5px 8px', height: '30px' }}
                          title="View Consolidated Results"
                        >
                          <BookOpen size={14} />
                        </button>


                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
