/**
 * HanuJai High School ERP — Subject Faculty Pedagogical Desk
 * Scoped EXCLUSIVELY to assigned subjects and class allocations.
 * Prioritizes marks entry registers awaiting completion, subject cohort performance,
 * and academic remedial follow-up for students experiencing subject score drops.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { calculateGrade } from '../../domain/policy';
import type {
  ClassSection,
  Subject,
  MarksRegister,
  AssessmentCycle,
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

  const assignedSubjectIds = useMemo(
    () => currentUser?.assignedSubjects || currentUser?.assignedSubjectIds || [],
    [currentUser]
  );
  const assignedClassIds = useMemo(
    () => currentUser?.assignedClasses || [],
    [currentUser]
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [marksRegisters, setMarksRegisters] = useState<MarksRegister[]>([]);
  const [activeCycle, setActiveCycle] = useState<AssessmentCycle | null>(null);

  useEffect(() => {
    if (assignedSubjectIds.length === 0 || assignedClassIds.length === 0) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadSubjectTeacherData() {
      setIsLoading(true);
      setError(null);
      try {
        const [subList, clsList, cycleList] = await Promise.all([
          provider.getSubjects(),
          provider.getClasses(),
          provider.getAssessmentCycles(),
        ]);

        if (!isMounted) return;
        setSubjects(subList.filter(s => assignedSubjectIds.includes(s.id)));
        setClasses(clsList.filter(c => assignedClassIds.includes(c.id)));

        const targetCycle = cycleList.find(c => c.status === 'active_marking') || cycleList[0] || null;
        setActiveCycle(targetCycle);

        if (targetCycle) {
          const regPromises: Promise<MarksRegister | null>[] = [];
          for (const cId of assignedClassIds) {
            for (const sId of assignedSubjectIds) {
              regPromises.push(provider.getMarksRegister(targetCycle.id, cId, sId));
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
  }, [provider, assignedSubjectIds, assignedClassIds]);

  if (assignedSubjectIds.length === 0 || assignedClassIds.length === 0) {
    return (
      <div className="hhs-page-container">
        <ErrorBanner
          title="Teaching Allocation Required"
          message="Your account is designated as Subject Faculty, but has no active subject allocations or class sections assigned. Please contact the Principal's office."
        />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading pedagogical workspace, assigned classes, and active marks registers..." />;
  }

  if (error) {
    return <ErrorBanner title="Pedagogical Desk Unavailable" message={error} />;
  }

  const primarySubject = subjects[0]?.name || 'Assigned Subject';
  const pendingRegisters = marksRegisters.filter(r => r.status === 'draft');
  const submittedRegisters = marksRegisters.filter(r => r.status === 'submitted' || r.status === 'finalized');

  // Compute live cohort mean across all loaded registers
  let totalScore = 0;
  let totalMaxPossible = 0;
  const gradeDistribution: Record<string, number> = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
    D: 0,
    E1: 0,
    E2: 0,
  };

  marksRegisters.forEach(r => {
    r.entries.forEach(e => {
      if (e.marksObtained !== null && !e.isAbsent) {
        totalScore += e.marksObtained;
        totalMaxPossible += r.maxMarks;
        const res = calculateGrade(e.marksObtained, r.maxMarks);
        if (gradeDistribution[res.grade] !== undefined) {
          gradeDistribution[res.grade]++;
        }
      }
    });
  });

  const cohortMeanPct = totalMaxPossible > 0
    ? Math.round((totalScore / totalMaxPossible) * 1000) / 10
    : null;

  const firstClassId = classes[0]?.id;
  const activeCycleId = activeCycle?.id || marksRegisters[0]?.assessmentId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <PageHeader
        title={`${primarySubject} Pedagogical Desk`}
        subtitle={`Faculty: ${currentUser?.name} • Department: ${currentUser?.department || 'Instructional'} • Teaching Load: ${classes.length} Sections`}
        roleScope="Subject Faculty"
        breadcrumbs={[
          { label: 'My Teaching', to: '/' },
          { label: `${primarySubject} Desk` },
        ]}
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
          subtext={`${classes.map(c => c.label).join(', ')}`}
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
          label={`${primarySubject} Cohort Mean`}
          value={cohortMeanPct !== null ? `${cohortMeanPct}%` : 'Pending Cycle'}
          subtext={activeCycle ? `${activeCycle.title} Score Mean` : 'Cumulative Session Aggregate'}
          icon={<GraduationCap size={20} />}
          trend={{ value: cohortMeanPct !== null && cohortMeanPct >= 75 ? 'Above 75% Target' : 'Diagnostic Required', isPositive: (cohortMeanPct ?? 0) >= 75 }}
        />
        <MetricCard
          label="Subject Remedial Care"
          value="1 Student"
          subtext={`Identified in ${primarySubject} for academic score drop`}
          icon={<AlertTriangle size={20} />}
          trend={{ value: 'Remedial Task Active', isPositive: false }}
        />
      </div>

      {/* Two-Column Section: Active Registers vs Remedial Student Follow-up */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* Left Column: Active Assessment Marks Registers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">Active Assessment Registers {activeCycle ? `(${activeCycle.title})` : ''}</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Marks entry rosters awaiting compilation or submission for your assigned sections.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {marksRegisters.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-muted)', fontSize: '0.86rem' }}>
                  No active marks registers scheduled for the current examination window.
                </div>
              ) : (
                marksRegisters.map(reg => (
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
                ))
              )}
            </div>
          </div>

          {/* Subject Grade Distribution */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '8px' }}>Scholastic Grade Distribution</h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '16px' }}>
              Performance dispersion across your enrolled student cohorts ({primarySubject}).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>{gradeDistribution.A1}</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>A1 (91-100%)</div>
              </div>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>{gradeDistribution.A2}</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>A2 (81-90%)</div>
              </div>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>{gradeDistribution.B1}</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>B1 (71-80%)</div>
              </div>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>{gradeDistribution.B2}</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>B2 (61-70%)</div>
              </div>
              <div style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-surface-muted)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--hhs-accent)' }}>
                  {gradeDistribution.C1 + gradeDistribution.C2 + gradeDistribution.D + gradeDistribution.E1 + gradeDistribution.E2}
                </div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>C1 &amp; Below</div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Subject Remedial Support & Shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Subject Remedial Watchlist */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '8px' }}>{primarySubject} Remedial Support</h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '14px' }}>
              Students flagged with significant score drop in {primarySubject}.
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
                  Class 10-A • Significant drop in {primarySubject} assessment cycle
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
              {activeCycleId && (
                <button
                  onClick={() => navigate(`/academics/marks/${activeCycleId}`)}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Edit3 size={14} />
                  <span>Open Active Marks Register</span>
                </button>
              )}
              {firstClassId && (
                <button
                  onClick={() => navigate(`/classes/${firstClassId}/performance`)}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <GraduationCap size={14} />
                  <span>Review {classes[0]?.label || firstClassId} Performance</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
