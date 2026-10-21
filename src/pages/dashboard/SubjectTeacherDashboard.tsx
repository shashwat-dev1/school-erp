/**
 * HanuJai High School ERP — Subject Faculty Pedagogical Desk
 * Scoped EXCLUSIVELY to assigned subjects and class allocations (e.g. Mathematics in 10-A, 10-B, 09-A).
 * Prioritizes marks entry registers awaiting completion, subject cohort performance,
 * and academic remedial follow-up for students experiencing subject score drops.
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
  Subject,
  MarksRegister,
} from '../../domain/types';
import {
  FileCheck2,
  BookOpen,
  GraduationCap,
  AlertTriangle,
  Edit3,
} from 'lucide-react';

export const SubjectTeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const assignedSubjectIds = currentUser?.assignedSubjects || ['sub-math-10', 'sub-math-09'];
  const assignedClassIds = currentUser?.assignedClasses || ['class-10-a', 'class-10-b', 'class-09-a'];

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [marksRegisters, setMarksRegisters] = useState<MarksRegister[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadSubjectTeacherData() {
      setIsLoading(true);
      setError(null);
      try {
        const [subList, clsList, _assignList, cycleList] = await Promise.all([
          provider.getSubjects(),
          provider.getClasses(),
          provider.getSubjectAssignments(currentUser?.id),
          provider.getAssessmentCycles(),
        ]);

        if (!isMounted) return;
        setSubjects(subList.filter(s => assignedSubjectIds.includes(s.id)));
        setClasses(clsList.filter(c => assignedClassIds.includes(c.id)));

        // Fetch marks registers for assigned subject/class pairs in active marking cycle
        const activeCycle = cycleList.find(c => c.status === 'active_marking') || cycleList[1];
        if (activeCycle) {
          const regPromises: Promise<MarksRegister | null>[] = [];
          for (const cId of assignedClassIds) {
            for (const sId of assignedSubjectIds) {
              regPromises.push(provider.getMarksRegister(activeCycle.id, cId, sId));
            }
          }
          const regs = await Promise.all(regPromises);
          if (isMounted) {
            setMarksRegisters(regs.filter((r): r is MarksRegister => r !== null));
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load subject faculty data.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSubjectTeacherData();
    return () => {
      isMounted = false;
    };
  }, [provider, currentUser?.id, assignedSubjectIds, assignedClassIds]);

  if (isLoading) {
    return <LoadingState message="Loading pedagogical workspace, assigned classes, and active marks registers..." />;
  }

  if (error) {
    return <ErrorBanner title="Pedagogical Desk Unavailable" message={error} />;
  }

  const primarySubject = subjects[0]?.name || 'Mathematics';
  const pendingRegisters = marksRegisters.filter(r => r.status === 'draft');
  const submittedRegisters = marksRegisters.filter(r => r.status === 'submitted' || r.status === 'finalized');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <PageHeader
        title={`${primarySubject} Pedagogical Desk`}
        subtitle={`Faculty: ${currentUser?.name} • Department: ${currentUser?.department} • Teaching Load: ${classes.length} Sections`}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/assessments')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileCheck2 size={16} />
              <span>Assessment Cycles</span>
            </button>
          </div>
        }
      />

      {/* Scoped Subject Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Assigned Classes & Load"
          value={`${classes.length} Sections`}
          subtext={`${classes.map(c => c.label).join(', ')} • 18 Periods/Week`}
          icon={<BookOpen size={20} />}
        />
        <MetricCard
          label="Active Marks Registers"
          value={marksRegisters.length.toString()}
          subtext={`${submittedRegisters.length} Submitted • ${pendingRegisters.length} Draft`}
          icon={<FileCheck2 size={20} />}
          trend={{ value: pendingRegisters.length > 0 ? `${pendingRegisters.length} Pending Entry` : 'All Registers Up to Date', isPositive: pendingRegisters.length === 0 }}
        />
        <MetricCard
          label="Mathematics Cohort Mean"
          value="82.4%"
          subtext="Unit Test 1 Cumulative Aggregate across 10-A & 10-B"
          icon={<GraduationCap size={20} />}
          trend={{ value: '+4.2% vs Previous Term', isPositive: true }}
        />
        <MetricCard
          label="Subject Remedial Care"
          value="2 Students"
          subtext="Drop >20% in Mathematics (e.g. Aarav Singhania)"
          icon={<AlertTriangle size={20} />}
          trend={{ value: 'Diagnostic Scheduled', isPositive: false }}
        />
      </div>

      {/* Two-Column Section: Active Registers vs Remedial Student Follow-up */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* Left Column: Active Assessment Marks Registers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">Active Assessment Registers (Unit Test 2)</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Marks entry rosters awaiting compilation or submission for your assigned sections.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {marksRegisters.map(reg => (
                <div
                  key={reg.id}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: '1px solid var(--hhs-border)',
                    backgroundColor: 'var(--hhs-canvas)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{reg.classLabel}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--hhs-text-secondary)' }}>• {reg.subjectName}</span>
                      <StatusBadge status={reg.status} label={reg.status === 'submitted' ? 'Submitted' : 'Draft / In Progress'} />
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-muted)', marginTop: '4px' }}>
                      Cycle: {reg.assessmentTitle} • Max Marks: {reg.maxMarks} • Enrolled: {reg.entries.length} Students
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/academics/marks/${reg.assessmentId}`)}
                    className={`hhs-btn hhs-btn-sm ${reg.status === 'draft' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit3 size={14} />
                    <span>{reg.status === 'draft' ? 'Enter Marks' : 'Review Ledger'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Subject Grade Distribution */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '8px' }}>CBSE 9-Point Grade Distribution (UT-1)</h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '16px' }}>
              Scholastic performance dispersion across your enrolled mathematics cohorts.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>18</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>A1 (91-100%)</div>
              </div>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>26</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>A2 (81-90%)</div>
              </div>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>20</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>B1 (71-80%)</div>
              </div>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>8</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>B2 (61-70%)</div>
              </div>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-accent)' }}>4</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>C1 &amp; Below</div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Subject Remedial Support & Shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Subject Remedial Watchlist */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '8px' }}>Mathematics Remedial Support</h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '14px' }}>
              Students flagged with significant score drop in Mathematics.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--hhs-radius-base)',
                  border: '1px solid rgb(230, 205, 178)',
                  backgroundColor: 'var(--hhs-canvas)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>Aarav Singhania</span>
                  <StatusBadge status="warning" label="-28% Drop" />
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
                  Class 10-A • UT-1: 22/25 (88%) &rarr; UT-2: 15/25 (60%)
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-muted)', marginTop: '4px' }}>
                  Remedial Diagnostic Task assigned to study hall.
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '12px' }}>Faculty Shortcuts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => navigate('/academics/marks/assess-ut2-2025')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Edit3 size={14} />
                <span>Open Unit Test 2 Marks Register</span>
              </button>
              <button
                onClick={() => navigate('/classes/class-10-a/performance')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <GraduationCap size={14} />
                <span>Review Class 10-A Performance Matrix</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
