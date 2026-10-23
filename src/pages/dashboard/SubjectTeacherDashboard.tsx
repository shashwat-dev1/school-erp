/**
 * HanuJai High School ERP — Subject Teacher Workspace
 * Clean, focused view for assigned subjects and classes (e.g. Mathematics for Class 10-A, 10-B, 9-A).
 * Prioritizes marks entry, assessment completion, and class-specific assessment drilldown.
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
  Eye,
  Lock,
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
  const [allCycles, setAllCycles] = useState<AssessmentCycle[]>([]);
  const [marksRegisters, setMarksRegisters] = useState<MarksRegister[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

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

        setAllCycles(cycleList);

        // Deduplicate and filter teacher's actual assignments
        const teacherAssignments = assignments.filter(
          assignment => assignment.teacherId === currentUser?.id &&
            assignedClassIds.includes(assignment.classId) &&
            assignedSubjectIds.includes(assignment.subjectId)
        );

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

        const teacherClasses = clsList.filter(c => uniqueClassIds.includes(c.id));
        setSubjects(subList.filter(s => uniqueSubjectIds.includes(s.id)));
        setClasses(teacherClasses);
        if (teacherClasses.length > 0) {
          setSelectedClassId(prev => prev || teacherClasses[0].id);
        }

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
  }, [provider, assignedSubjectIds, assignedClassIds, currentUser]);

  if (assignedSubjectIds.length === 0 || assignedClassIds.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PageHeader
          title="My Classes"
          subtitle="Subject Teacher Workspace"
        />
        <ErrorBanner
          message="Your account has no subjects or classes assigned yet. Please contact the Principal to assign your teaching schedule."
        />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading your classes and marks registers..." />;
  }

  if (error) {
    return <ErrorBanner message={error} />;
  }

  if (classes.length === 0 || subjects.length === 0) {
    return <ErrorBanner message="No valid subject and class assignments were found for this account. Ask the school administrator to confirm the teaching assignments." />;
  }

  const primarySubject = subjects[0]?.name || 'Assigned Subject';
  const completedRegisters = marksRegisters.filter(r => r.status === 'submitted' || r.status === 'finalized');
  const draftRegisters = marksRegisters.filter(r => r.status === 'draft');
  const totalPossibleRegisters = classes.length * (allCycles.length || 4);
  const futureRegistersCount = Math.max(0, totalPossibleRegisters - marksRegisters.length);

  // Compute normalized mean across finalized registers
  let finalizedScore = 0;
  let finalizedMax = 0;
  completedRegisters.forEach(r => {
    r.entries.forEach(e => {
      if (e.marksObtained !== null && !e.isAbsent) {
        finalizedScore += e.marksObtained;
        finalizedMax += r.maxMarks;
      }
    });
  });

  const overallFinalizedAverage = finalizedMax > 0
    ? Math.round((finalizedScore / finalizedMax) * 1000) / 10
    : null;

  // Selected class for drilldown
  const currentClass = classes.find(c => c.id === selectedClassId) || classes[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <PageHeader
        title={`My Classes (${primarySubject})`}
        subtitle={`Teacher: ${currentUser?.displayName} • Session 2025–2026 • ${classes.length} Unique Assigned Classes`}
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

      {/* Prominent notification with Canary Yellow Pop Alert Banner */}
      {draftRegisters.length > 0 && (
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
              Marks Entry in Progress ({draftRegisters.length} Draft Registers)
            </div>
            <div style={{ fontSize: '0.82rem', color: '#45455E', marginTop: '2px' }}>
              Please finalize marks for {Array.from(new Set(draftRegisters.map(r => r.classLabel))).join(', ')}.
            </div>
          </div>
          <button
            onClick={() => navigate('/academics/assessments')}
            className="hhs-btn hhs-btn-primary"
          >
            Open Marks Registers
          </button>
        </div>
      )}

      {/* 4 Focused Scoped Metrics with Vibrant Pop Accents */}
      <div className="hhs-metrics-grid">
        <MetricCard
          label="Unique Assigned Classes"
          value={`${classes.length} Classes`}
          subtext={classes.map(c => c.label).join(', ')}
          icon={<BookOpen size={20} />}
          accent="primary"
        />
        <MetricCard
          label="Total Marks Registers"
          value={`${totalPossibleRegisters} Registers`}
          subtext={`${completedRegisters.length} completed • ${draftRegisters.length} draft • ${futureRegistersCount} upcoming`}
          icon={<CheckCircle size={20} />}
          accent="info"
        />
        <MetricCard
          label={`${primarySubject} Performance`}
          value={overallFinalizedAverage !== null ? `${overallFinalizedAverage}%` : 'Pending'}
          subtext="Based on finalized assessments"
          icon={<GraduationCap size={20} />}
          accent="success"
        />
        <div
          onClick={() => navigate('/reports/student-followup')}
          style={{ cursor: 'pointer' }}
          title="Click to view student follow-up details"
        >
          <MetricCard
            label="Needs Academic Follow-up"
            value="1 Student"
            subtext="Click to review Aarav Singhania (-28% drop)"
            icon={<AlertTriangle size={20} />}
            accent="accent"
          />
        </div>
      </div>

      {/* Class Assessment Drilldown Section */}
      <div className="hhs-card" style={{ padding: 'clamp(14px, 2vw, 20px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 className="hhs-headline-sm" style={{ margin: 0 }}>
              Class Assessment Performance &amp; History
            </h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', margin: '2px 0 0' }}>
              Select an assigned class to view its assessment cycles, maximum marks, and current status.
            </p>
          </div>

          {/* Class Selector Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {classes.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id)}
                className={`hhs-btn ${selectedClassId === c.id ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Class Cycles Breakdown */}
        {currentClass && (
          <div className="hhs-table-responsive" style={{ border: 'none', borderRadius: 0, margin: 0 }}>
            <table className="hhs-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Assessment Cycle</th>
                  <th className="numeric">Max Marks</th>
                  <th className="numeric">Pass Mark</th>
                  <th className="numeric">Class Average</th>
                  <th className="numeric">Normalized %</th>
                  <th>Lifecycle Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {allCycles.map(cycle => {
                  const reg = marksRegisters.find(r => r.assessmentId === cycle.id && r.classId === currentClass.id);
                  const isLocked = cycle.status === 'locked' || reg?.status === 'finalized';
                  const isDraft = reg?.status === 'draft';
                  const isSubmitted = reg?.status === 'submitted';

                  // Compute average for this register if scores exist
                  let avgScore: number | null = null;
                  let normPct: number | null = null;
                  if (reg && reg.entries.length > 0) {
                    const scored = reg.entries.filter(e => e.marksObtained !== null && !e.isAbsent);
                    if (scored.length > 0) {
                      const sum = scored.reduce((acc, e) => acc + (e.marksObtained || 0), 0);
                      avgScore = Math.round((sum / scored.length) * 10) / 10;
                      normPct = Math.round((avgScore / reg.maxMarks) * 1000) / 10;
                    }
                  }

                  let statusLabel = 'Not Open Yet';
                  let statusType: 'active' | 'inactive' | 'pending' | 'draft' = 'inactive';
                  if (isLocked) {
                    statusLabel = 'Locked & Finalized';
                    statusType = 'active';
                  } else if (isSubmitted) {
                    statusLabel = 'Submitted';
                    statusType = 'active';
                  } else if (isDraft) {
                    statusLabel = 'Draft (Open)';
                    statusType = 'draft';
                  } else if (cycle.status === 'active_marking') {
                    statusLabel = 'Open for Marks';
                    statusType = 'pending';
                  }

                  return (
                    <tr key={cycle.id}>
                      <td style={{ fontWeight: 600 }}>
                        {cycle.title || cycle.name}
                      </td>
                      <td className="numeric">{cycle.maxMarks}</td>
                      <td className="numeric" style={{ color: 'var(--hhs-text-secondary)' }}>{cycle.passingMarks}</td>
                      <td className="numeric" style={{ fontWeight: avgScore !== null ? 700 : 400 }}>
                        {avgScore !== null ? `${avgScore} / ${cycle.maxMarks}` : '—'}
                      </td>
                      <td className="numeric" style={{ fontWeight: normPct !== null ? 700 : 400 }}>
                        {normPct !== null ? `${normPct}%` : '—'}
                      </td>
                      <td>
                        <StatusBadge
                          status={statusType}
                          label={statusLabel}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isLocked || isSubmitted ? (
                          <button
                            onClick={() => {
                              if (reg) {
                                navigate(`/academics/assessments/marks/${reg.id}`);
                              } else {
                                navigate(`/performance/classes/${currentClass.id}`);
                              }
                            }}
                            className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={13} />
                            <span>View Results</span>
                          </button>
                        ) : isDraft || cycle.status === 'active_marking' ? (
                          <button
                            onClick={() => {
                              if (reg) {
                                navigate(`/academics/assessments/marks/${reg.id}`);
                              } else {
                                navigate(`/academics/marks/${cycle.id}?classId=${currentClass.id}&subjectId=${subjects[0]?.id || ''}`);
                              }
                            }}
                            className="hhs-btn hhs-btn-primary hhs-btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit3 size={13} />
                            <span>Enter Marks</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--hhs-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Lock size={12} />
                            <span>Not Open</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Registers Master List */}
      <div className="hhs-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 className="hhs-headline-sm" style={{ margin: 0 }}>All Marks Registers</h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', margin: '2px 0 0' }}>
              Registry of marks entries across your assigned classes and active assessment cycles.
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
              const isLockedOrFinal = reg.status === 'submitted' || reg.status === 'finalized';

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
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{reg.classLabel}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                        • {reg.assessmentTitle || (reg.assessmentId === 'assess-ut1-2025' ? 'Unit Test 1' : 'Unit Test 2')}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>• {reg.subjectName}</span>
                      <StatusBadge
                        status={isLockedOrFinal ? 'submitted' : 'draft'}
                        label={reg.status === 'finalized' ? 'Finalized' : isLockedOrFinal ? 'Submitted' : 'Draft'}
                      />
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)', marginTop: '3px' }}>
                      Max Marks: {reg.maxMarks} • {filledCount} of {reg.entries.length} students entered
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/academics/assessments/marks/${reg.id}`)}
                    className={`hhs-btn ${isLockedOrFinal ? 'hhs-btn-secondary' : 'hhs-btn-primary'} hhs-btn-sm`}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    {isLockedOrFinal ? <Eye size={13} /> : <Edit3 size={13} />}
                    <span>{isLockedOrFinal ? 'View Results' : 'Enter Marks'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
