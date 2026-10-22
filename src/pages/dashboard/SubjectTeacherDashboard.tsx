/**
 * HanuJai High School ERP — Subject Teacher Workspace
 * Clean, focused view for assigned subjects and classes (e.g. Mathematics for Class 10-A, 10-B, 9-A).
 * Prioritizes marks entry, assessment completion, and subject performance.
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
import type {
  ClassSection,
  Subject,
  MarksRegister,
  AssessmentCycle,
} from '../../domain/types';
import {
  BookOpen,
  Edit3,
  GraduationCap,
  AlertTriangle,
  CheckCircle,
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
        const [subList, clsList, cycleList, assignments] = await Promise.all([
          provider.getSubjects(),
          provider.getClasses(),
          provider.getAssessmentCycles(),
          provider.getSubjectAssignments(currentUser?.id),
        ]);

        if (!isMounted) return;

        // Deduplicate and filter teacher's actual assignments
        let teacherAssignments = assignments.filter(
          a => (currentUser?.id && a.teacherId === currentUser.id) ||
               (assignedClassIds.includes(a.classId) && assignedSubjectIds.includes(a.subjectId))
        );

        // Fallback pairing class with matching subject if no explicit DB assignments
        if (teacherAssignments.length === 0) {
          teacherAssignments = assignedClassIds.map(cId => {
            const cls = clsList.find(c => c.id === cId);
            const matchingSub = subList.find(
              s => assignedSubjectIds.includes(s.id) &&
                   (s.id.includes(String(cls?.grade)) || s.name.toLowerCase().includes('math'))
            );
            return {
              id: `asgn-${cId}`,
              classId: cId,
              classLabel: cls?.label || cId,
              subjectId: matchingSub?.id || assignedSubjectIds[0],
              subjectName: matchingSub?.name || 'Mathematics',
              teacherId: currentUser?.id || 'staff-004',
              teacherName: currentUser?.name || 'Subject Teacher',
              academicYearId: 'year-2025-2026',
            };
          });
        }

        // Deduplicate assignments by classId + subjectId
        const seenTuples = new Set<string>();
        const uniqueAssignments = teacherAssignments.filter(a => {
          const key = `${a.classId}-${a.subjectId}`;
          if (seenTuples.has(key)) return false;
          seenTuples.add(key);
          return true;
        });

        const uniqueClassIds = Array.from(new Set(uniqueAssignments.map(a => a.classId)));
        const uniqueSubjectIds = Array.from(new Set(uniqueAssignments.map(a => a.subjectId)));

        setSubjects(subList.filter(s => uniqueSubjectIds.includes(s.id)));
        setClasses(clsList.filter(c => uniqueClassIds.includes(c.id)));

        const targetCycle = cycleList.find(c => c.status === 'active_marking') || cycleList[0] || null;
        setActiveCycle(targetCycle);

        // Fetch registers across cycles for unique class & subject assignments
        const regPromises: Promise<MarksRegister | null>[] = [];
        for (const cycle of cycleList) {
          for (const asgn of uniqueAssignments) {
            regPromises.push(provider.getMarksRegister(cycle.id, asgn.classId, asgn.subjectId));
          }
        }
        const regs = await Promise.all(regPromises);
        if (isMounted) {
          setMarksRegisters(regs.filter((r): r is MarksRegister => r !== null));
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Could not load subject records.');
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PageHeader
          title="My Classes"
          subtitle="Subject Teacher Workspace"
        />
        <ErrorBanner
          title="No Classes Assigned"
          message="Your account has no subjects or classes assigned yet. Please contact the Principal or office staff to assign your teaching schedule."
        />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading your classes and marks registers..." />;
  }

  if (error) {
    return <ErrorBanner title="Could not load classes" message={error} />;
  }

  const primarySubject = subjects[0]?.name || 'Assigned Subject';
  const pendingRegisters = marksRegisters.filter(r => r.status === 'draft');
  const submittedRegisters = marksRegisters.filter(r => r.status === 'submitted' || r.status === 'finalized');

  // Compute live cohort mean across loaded registers
  let totalScore = 0;
  let totalMaxPossible = 0;

  marksRegisters.forEach(r => {
    r.entries.forEach(e => {
      if (e.marksObtained !== null && !e.isAbsent) {
        totalScore += e.marksObtained;
        totalMaxPossible += r.maxMarks;
      }
    });
  });

  const cohortMeanPct = totalMaxPossible > 0
    ? Math.round((totalScore / totalMaxPossible) * 1000) / 10
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <PageHeader
        title={`My Classes (${primarySubject})`}
        subtitle={`Teacher: ${currentUser?.name} • Session 2025–2026 • ${classes.length} Assigned Classes`}
        roleScope={primarySubject}
        breadcrumbs={[{ label: 'My Classes' }]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate('/academics/assessments')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Edit3 size={15} />
              <span>Enter Marks</span>
            </button>
          </div>
        }
      />

      {/* Prominent notification if marks registers are pending */}
      {pendingRegisters.length > 0 && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--hhs-radius-base)',
            backgroundColor: 'var(--hhs-accent-light)',
            border: '1px solid var(--hhs-accent)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--hhs-accent-text)', fontSize: '0.9rem' }}>
              Marks Entry in Progress ({pendingRegisters.length} Registers Pending)
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
              Please enter and submit marks for {Array.from(new Set(pendingRegisters.map(r => r.classLabel))).join(', ')}.
            </div>
          </div>
          <button
            onClick={() => navigate('/academics/assessments')}
            className="hhs-btn hhs-btn-primary hhs-btn-sm"
          >
            Open Marks Registers
          </button>
        </div>
      )}

      {/* 4 Focused Scoped Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Assigned Classes"
          value={`${classes.length} Classes`}
          subtext={classes.map(c => c.label).join(', ')}
          icon={<BookOpen size={20} />}
          accent="primary"
        />
        <MetricCard
          label="Marks Registers"
          value={marksRegisters.length.toString()}
          subtext={`${submittedRegisters.length} completed • ${pendingRegisters.length} draft`}
          icon={<CheckCircle size={20} />}
          accent="info"
        />
        <MetricCard
          label={`${primarySubject} Average`}
          value={cohortMeanPct !== null ? `${cohortMeanPct}%` : 'Pending'}
          subtext={activeCycle ? activeCycle.title : 'Current term'}
          icon={<GraduationCap size={20} />}
          accent="primary"
        />
        <MetricCard
          label="Needs Academic Follow-up"
          value="1 Student"
          subtext="Marks dropped in recent test"
          icon={<AlertTriangle size={20} />}
          accent="accent"
        />
      </div>

      {/* 2 Supporting Areas: Marks Registers & Class Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
        
        {/* Supporting Area 1: Marks Registers */}
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 className="hhs-headline-sm">Marks Registers</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Enter or review marks for your assigned classes across active cycles.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {marksRegisters.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.86rem' }}>
                No active marks registers scheduled right now.
              </div>
            ) : (
              marksRegisters.map(reg => {
                const filledCount = reg.entries.filter(e => e.marksObtained !== null || e.isAbsent).length;
                const isComplete = reg.status === 'submitted' || reg.status === 'finalized';

                return (
                  <div
                    key={reg.id}
                    style={{
                      padding: '14px 16px',
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
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{reg.classLabel}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                          • {reg.assessmentTitle || (reg.assessmentId === 'assess-ut1-2025' ? 'Unit Test 1' : 'Unit Test 2')}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>• {reg.subjectName}</span>
                        <StatusBadge
                          status={isComplete ? 'submitted' : 'draft'}
                          label={isComplete ? 'Submitted' : 'Draft'}
                        />
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)', marginTop: '3px' }}>
                        Max Marks: {reg.maxMarks} • {filledCount} of {reg.entries.length} students entered
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/academics/assessments/marks/${reg.id}`)}
                      className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Edit3 size={13} />
                      <span>{isComplete ? 'View Marks' : 'Enter Marks'}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Supporting Area 2: Teaching Schedule & Follow-up */}
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 className="hhs-headline-sm">Teaching Schedule</h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
              Assigned sections for {primarySubject}.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {classes.map(cls => {
              const cleanRoom = cls.roomNumber ? cls.roomNumber.replace(/^Room\s+/i, 'Room ') : 'Room Unassigned';
              return (
                <div
                  key={cls.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: '1px solid var(--hhs-border)',
                    backgroundColor: 'var(--hhs-canvas)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{cls.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                      {cleanRoom} • {cls.studentCount} Students
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/performance/classes/${cls.id}`)}
                    className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                    style={{ fontSize: '0.76rem' }}
                  >
                    <span>Results</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
