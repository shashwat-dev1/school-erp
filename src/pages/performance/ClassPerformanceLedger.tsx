import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { AccessDenied } from '../error/AccessDenied';
import { RiskEvidenceDrawer } from '../../features/risk/RiskEvidenceDrawer';
import type {
  ClassSection,
  AssessmentCycle,
  Subject,
  StudentRecord,
  StudentMarkEntry,
} from '../../domain/types';
import {
  Download,
  AlertTriangle,
  BookOpen,
  Printer,
} from 'lucide-react';

export const ClassPerformanceLedger: React.FC = () => {
  const { classId } = useParams<{ classId?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const activeClassId = classId || currentUser?.assignedClassId || currentUser?.assignedClasses?.[0];

  const [activeTab, setActiveTab] = useState<'matrix' | 'watchlist'>('matrix');
  const [selectedCycleId, setSelectedCycleId] = useState<string>('assess-ut1-2025');
  const [cycles, setCycles] = useState<AssessmentCycle[]>([]);
  const [activeClass, setActiveClass] = useState<ClassSection | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, StudentMarkEntry | null>>>({});
  const [subjectAverages, setSubjectAverages] = useState<Record<string, number>>({});

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Evidence Drawer state
  const [drawerStudent, setDrawerStudent] = useState<StudentRecord | null>(null);

  // Fetch cycles and class
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      if (!activeClassId) return;
      try {
        const [cList, cls] = await Promise.all([
          provider.getAssessmentCycles(),
          provider.getClassById(activeClassId),
        ]);
        if (!isMounted) return;
        setCycles(cList);
        setActiveClass(cls);
      } catch (err: unknown) {
        console.error('Error fetching performance metadata:', err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [provider, activeClassId]);

  // Fetch consolidated matrix for active class and cycle
  useEffect(() => {
    if (!activeClassId) return;
    let isMounted = true;
    async function loadConsolidated() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await provider.getConsolidatedClassMarks(activeClassId!, selectedCycleId);
        if (!isMounted) return;
        setSubjects(res.subjects);
        setStudents(res.students);
        setMatrixData(res.matrix);
        setSubjectAverages(res.subjectAverages);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load consolidated performance ledger.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadConsolidated();
    return () => {
      isMounted = false;
    };
  }, [provider, activeClassId, selectedCycleId]);

  const activeCycle = cycles.find(c => c.id === selectedCycleId) || cycles[0];
  const maxMarks = activeCycle?.maxMarks || 25;
  const passMarks = Math.round(maxMarks * 0.33);

  // Clearance calculation: Subject teachers can ONLY see their assigned subjects
  const isFullMatrixAuthorized =
    currentUser?.role === 'principal' ||
    currentUser?.role === 'office_admin' ||
    (currentUser?.role === 'class_teacher' && currentUser.assignedClassId === activeClassId);

  const visibleSubjects = useMemo(() => {
    if (isFullMatrixAuthorized) return subjects;
    const teacherSubIds = currentUser?.assignedSubjects || currentUser?.assignedSubjectIds || [];
    return subjects.filter(s => teacherSubIds.includes(s.id));
  }, [subjects, isFullMatrixAuthorized, currentUser]);

  // Summary computations
  const summaryStats = useMemo(() => {
    let cohortTotalScore = 0;
    let cohortMaxPossible = 0;
    let remedialCount = 0;
    let distinctionCount = 0;

    students.forEach(s => {
      let studentScore = 0;
      let count = 0;
      visibleSubjects.forEach(sub => {
        const entry = matrixData[s.id]?.[sub.id];
        if (entry && !entry.isAbsent && entry.marksObtained !== null) {
          studentScore += entry.marksObtained;
          count++;
        }
      });

      if (count > 0) {
        cohortTotalScore += studentScore;
        cohortMaxPossible += count * maxMarks;
        const pct = (studentScore / (count * maxMarks)) * 100;
        if (pct < 33) remedialCount++;
        if (pct >= 75) distinctionCount++;
      }
    });

    const cohortAveragePct = cohortMaxPossible > 0 ? ((cohortTotalScore / cohortMaxPossible) * 100).toFixed(1) : '—';

    return {
      cohortAveragePct,
      remedialCount,
      distinctionCount,
      totalStudents: students.length,
    };
  }, [students, visibleSubjects, matrixData, maxMarks]);

  // Export CSV
  const handleExportCSV = () => {
    if (!activeClass || !activeCycle) return;
    const headers = [
      'Roll #',
      'Admission #',
      'Student Name',
      ...visibleSubjects.map(s => `"${s.name} (${maxMarks})"`),
      'Total Marks',
      'Max Total',
      'Percentage',
      'CBSE Grade',
      'Care Flag',
    ];

    const rows = students.map(s => {
      let tot = 0;
      let cnt = 0;
      const subjVals = visibleSubjects.map(sub => {
        const e = matrixData[s.id]?.[sub.id];
        if (e?.isAbsent) return 'ABS';
        if (e && e.marksObtained !== null) {
          tot += e.marksObtained;
          cnt++;
          return e.marksObtained;
        }
        return '—';
      });

      const maxTot = visibleSubjects.length * maxMarks;
      const pct = cnt > 0 ? ((tot / (cnt * maxMarks)) * 100).toFixed(1) + '%' : '—';
      const flags = s.careFlags?.map(f => f.code).join(' ') || (s.activeFlags ? s.activeFlags.map(f => f.code).join(' ') : 'None');

      return [
        s.rollNumber,
        s.admissionNumber,
        `"${s.firstName} ${s.lastName}"`,
        ...subjVals,
        tot,
        maxTot,
        pct,
        'Auto',
        `"${flags}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(activeClass.label || 'Class').replace(/\s+/g, '_')}_Performance_${activeCycle?.title || activeCycle?.name || 'Cycle'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (currentUser?.role === 'subject_teacher' && !currentUser.assignedClasses?.includes(activeClassId || '')) {
    return (
      <AccessDenied
        title="Section Performance Authorization"
        message="You do not have instructional duties assigned to this section."
      />
    );
  }

  if (currentUser?.role === 'subject_teacher' && visibleSubjects.length === 0) {
    return (
      <AccessDenied
        title="Subject Performance Authorization"
        message="You do not teach any subjects in this class section."
      />
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading class performance matrix..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title={`${activeClass?.label || 'Class Section'} — ${isFullMatrixAuthorized ? 'Consolidated Subject Performance Matrix' : 'Subject Faculty Performance'}`}
        subtitle="Cross-subject grade verification, deficiency identification, and parent conference inspection."
        roleScope={isFullMatrixAuthorized ? 'Consolidated Scholastic Ledger' : 'Subject Faculty Performance'}
        breadcrumbs={[
          { label: currentUser?.role === 'class_teacher' ? 'My Section' : currentUser?.role === 'subject_teacher' ? 'My Teaching' : 'Operations Hub', to: '/' },
          { label: activeClass?.label || 'Class Performance' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExportCSV}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              <span>Export Ledger CSV</span>
            </button>
            <button
              onClick={() => navigate('/reports/academic-comparison')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <BookOpen size={15} />
              <span>Section Comparison Report</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Cycle Selector & Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--hhs-surface)', padding: '3px', borderRadius: 'var(--hhs-radius-base)', border: '1px solid var(--hhs-border)' }}>
          <button
            onClick={() => setActiveTab('matrix')}
            style={{
              padding: '6px 14px',
              fontSize: '0.84rem',
              fontWeight: activeTab === 'matrix' ? 700 : 500,
              backgroundColor: activeTab === 'matrix' ? 'var(--hhs-primary)' : 'transparent',
              color: activeTab === 'matrix' ? '#ffffff' : 'var(--hhs-text-primary)',
              border: 'none',
              borderRadius: 'var(--hhs-radius-sm)',
              cursor: 'pointer',
            }}
          >
            Subject Marks Matrix
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            style={{
              padding: '6px 14px',
              fontSize: '0.84rem',
              fontWeight: activeTab === 'watchlist' ? 700 : 500,
              backgroundColor: activeTab === 'watchlist' ? 'var(--hhs-primary)' : 'transparent',
              color: activeTab === 'watchlist' ? '#ffffff' : 'var(--hhs-text-primary)',
              border: 'none',
              borderRadius: 'var(--hhs-radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Tutor Follow-Up List</span>
            <span
              style={{
                backgroundColor: activeTab === 'watchlist' ? 'rgba(255,255,255,0.25)' : 'var(--hhs-danger)',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 'var(--hhs-radius-pill)',
              }}
            >
              3
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>
            Assessment Cycle:
          </label>
          <select
            className="hhs-select"
            value={selectedCycleId}
            onChange={e => setSelectedCycleId(e.target.value)}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            {cycles.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} (Max {c.maxMarks})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Cohort Aggregate Mean</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {summaryStats.cohortAveragePct}%
          </div>
          <div className="hhs-metric-sub">Session 2025–26 • {activeCycle?.name}</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Distinction Cohort (≥75%)</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {summaryStats.distinctionCount} <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-muted)' }}>/ {summaryStats.totalStudents}</span>
          </div>
          <div className="hhs-metric-sub">High academic progress</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Remedial Flagged (&lt;33%)</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-danger-text)' }}>
            {summaryStats.remedialCount} Candidates
          </div>
          <div className="hhs-metric-sub">Below passing threshold</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Assigned Class Tutor</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.05rem', paddingTop: '4px' }}>
            Mrs. Ananya Sharma
          </div>
          <div className="hhs-metric-sub">Senior Secondary Wing</div>
        </div>
      </div>

      {activeTab === 'matrix' ? (
        /* Consolidated Marks Matrix View */
        <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--hhs-border)',
              backgroundColor: 'var(--hhs-surface-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                Multi-Subject Cross Verification Matrix — {activeCycle?.name}
              </h4>
              <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
                Max per subject: {maxMarks} marks • Passing threshold: {passMarks} (33%)
              </div>
            </div>
            <span className="hhs-badge hhs-badge-primary">{students.length} Candidates Enrolled</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="hhs-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '45px' }} className="numeric">Roll</th>
                  <th style={{ minWidth: '150px' }}>Student Candidate</th>
                  {visibleSubjects.map(s => (
                    <th key={s.id} className="numeric" style={{ minWidth: '95px' }}>
                      {s.name}
                      <div style={{ fontSize: '0.68rem', fontWeight: 'normal', color: 'var(--hhs-text-muted)' }}>
                        ({s.code})
                      </div>
                    </th>
                  ))}
                  <th className="numeric" style={{ width: '80px' }}>Total</th>
                  <th className="numeric" style={{ width: '75px' }}>%</th>
                  <th style={{ width: '75px', textAlign: 'center' }}>Grade</th>
                  <th style={{ width: '110px' }}>Care Flag</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  let studentTotal = 0;
                  let countedSubjects = 0;

                  return (
                    <tr key={s.id}>
                      <td className="numeric" style={{ fontWeight: 600 }}>
                        {s.rollNumber}
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/students/${s.id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            fontWeight: 600,
                            color: 'var(--hhs-primary)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          {s.firstName} {s.lastName}
                        </button>
                        <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', fontFamily: 'monospace' }}>
                          {s.admissionNumber}
                        </div>
                      </td>

                      {visibleSubjects.map(sub => {
                        const entry = matrixData[s.id]?.[sub.id];
                        const isAbsent = entry?.isAbsent;
                        const score = entry?.marksObtained;

                        if (isAbsent) {
                          return (
                            <td key={sub.id} className="numeric" style={{ color: 'var(--hhs-danger-text)', fontWeight: 700 }}>
                              ABS
                            </td>
                          );
                        }

                        if (score !== undefined && score !== null) {
                          studentTotal += score;
                          countedSubjects++;
                          const isFailing = score < passMarks;
                          const isHigh = score >= maxMarks * 0.85;

                          return (
                            <td
                              key={sub.id}
                              className="numeric"
                              style={{
                                fontWeight: 600,
                                color: isFailing
                                  ? 'var(--hhs-danger-text)'
                                  : isHigh
                                  ? 'var(--hhs-primary)'
                                  : 'inherit',
                                backgroundColor: isFailing ? 'var(--hhs-danger-light)' : undefined,
                              }}
                            >
                              {score}
                            </td>
                          );
                        }

                        return (
                          <td key={sub.id} className="numeric" style={{ color: 'var(--hhs-text-muted)' }}>
                            —
                          </td>
                        );
                      })}

                      {/* Total & Percentage */}
                      <td className="numeric" style={{ fontWeight: 700 }}>
                        {studentTotal}
                        <span style={{ fontSize: '0.7rem', color: 'var(--hhs-text-muted)' }}>
                          /{countedSubjects * maxMarks}
                        </span>
                      </td>
                      <td className="numeric" style={{ fontWeight: 600 }}>
                        {countedSubjects > 0
                          ? `${((studentTotal / (countedSubjects * maxMarks)) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {countedSubjects > 0 ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 'var(--hhs-radius-pill)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: 'var(--hhs-surface-muted)',
                              color: 'var(--hhs-primary)',
                            }}
                          >
                            {((studentTotal / (countedSubjects * maxMarks)) * 100) >= 80
                              ? 'A1'
                              : ((studentTotal / (countedSubjects * maxMarks)) * 100) >= 60
                              ? 'B1'
                              : ((studentTotal / (countedSubjects * maxMarks)) * 100) >= 33
                              ? 'C1'
                              : 'E'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {s.careFlags && s.careFlags.length > 0 ? (
                          <button
                            onClick={() => setDrawerStudent(s)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Inspect Evidence Dossier"
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: 'var(--hhs-radius-sm)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                backgroundColor: 'var(--hhs-danger-light)',
                                color: 'var(--hhs-danger-text)',
                              }}
                            >
                              {s.careFlags[0].code}
                            </span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--hhs-text-muted)' }}>None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Cohort Mean Bottom Row */}
                <tr style={{ backgroundColor: 'var(--hhs-surface-muted)', fontWeight: 700 }}>
                  <td colSpan={2} style={{ textAlign: 'right', paddingRight: '16px' }}>
                    Subject Aggregate Average:
                  </td>
                  {visibleSubjects.map(sub => {
                    const avg = subjectAverages[sub.id] || 0;
                    return (
                      <td key={sub.id} className="numeric" style={{ color: 'var(--hhs-primary)' }}>
                        {avg.toFixed(1)}
                      </td>
                    );
                  })}
                  <td colSpan={4} style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
                    Standard Class Benchmark
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Class Teacher Assigned Student Follow-Up List View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--hhs-surface)',
              border: '1px solid var(--hhs-border)',
              borderRadius: 'var(--hhs-radius-container)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>
                Class 10-A Priority Intervention Watchlist
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                Tutor-monitored candidates flagged under deterministic rules for attendance, academic decline, or conduct.
              </p>
            </div>
            <span className="hhs-badge hhs-badge-accent">3 Candidates Require Review</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
            {/* Student 1: Aarav Singhania */}
            <div
              className="hhs-panel"
              style={{
                borderLeft: '4px solid var(--hhs-danger)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                      Aarav Singhania (Roll 1)
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', fontFamily: 'monospace' }}>
                      Admission #HJ-2025-1042
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span className="hhs-badge hhs-badge-danger">#ATT-01</span>
                    <span className="hhs-badge hhs-badge-danger">#ACAD-04</span>
                  </div>
                </div>

                <p style={{ margin: '10px 0 0', fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.45 }}>
                  <strong>Trigger Evidence:</strong> 3 consecutive unexcused operational absences, coupled with a 28% drop in Mathematics from UT-1 (22/25) to UT-2 (15/25).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--hhs-border)', paddingTop: '10px' }}>
                <button
                  onClick={() => {
                    const st = students.find(s => s.id === 'stu-10a-01') || students[0];
                    setDrawerStudent(st);
                  }}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ flex: 1, fontSize: '0.78rem', height: '32px' }}
                >
                  <AlertTriangle size={14} />
                  <span>Inspect Evidence</span>
                </button>
                <button
                  onClick={() => navigate('/reports/ptm-slip/stu-10a-01')}
                  className="hhs-btn hhs-btn-primary"
                  style={{ fontSize: '0.78rem', height: '32px' }}
                >
                  <Printer size={14} />
                  <span>PTM Slip</span>
                </button>
              </div>
            </div>

            {/* Student 2: Rohan Verma */}
            <div
              className="hhs-panel"
              style={{
                borderLeft: '4px solid var(--hhs-accent)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                      Rohan Verma (Roll 3)
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', fontFamily: 'monospace' }}>
                      Admission #HJ-2025-1044
                    </div>
                  </div>
                  <span className="hhs-badge hhs-badge-accent">#DISC-02</span>
                </div>

                <p style={{ margin: '10px 0 0', fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.45 }}>
                  <strong>Trigger Evidence:</strong> Punctuality notice and classroom conduct observation logged during Physics laboratory session.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--hhs-border)', paddingTop: '10px' }}>
                <button
                  onClick={() => navigate('/students/stu-10a-03')}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ flex: 1, fontSize: '0.78rem', height: '32px' }}
                >
                  <span>Student Dossier</span>
                </button>
                <button
                  onClick={() => navigate('/behaviour')}
                  className="hhs-btn hhs-btn-primary"
                  style={{ fontSize: '0.78rem', height: '32px' }}
                >
                  <span>Care Log</span>
                </button>
              </div>
            </div>

            {/* Student 3: Ananya Gupta */}
            <div
              className="hhs-panel"
              style={{
                borderLeft: '4px solid var(--hhs-danger)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                      Ananya Gupta (Roll 4)
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', fontFamily: 'monospace' }}>
                      Admission #HJ-2025-1045
                    </div>
                  </div>
                  <span className="hhs-badge hhs-badge-danger">#ATT-03</span>
                </div>

                <p style={{ margin: '10px 0 0', fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.45 }}>
                  <strong>Trigger Evidence:</strong> Aggregate instruction days at 71.4%, falling below the mandatory CBSE 75.0% statutory threshold.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--hhs-border)', paddingTop: '10px' }}>
                <button
                  onClick={() => {
                    const st = students.find(s => s.id === 'stu-10a-04') || students[0];
                    setDrawerStudent(st);
                  }}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ flex: 1, fontSize: '0.78rem', height: '32px' }}
                >
                  <AlertTriangle size={14} />
                  <span>Inspect Evidence</span>
                </button>
                <button
                  onClick={() => navigate('/reports/attendance')}
                  className="hhs-btn hhs-btn-primary"
                  style={{ fontSize: '0.78rem', height: '32px' }}
                >
                  <span>Attendance Audit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Drawer */}
      <RiskEvidenceDrawer
        isOpen={Boolean(drawerStudent)}
        onClose={() => setDrawerStudent(null)}
        student={drawerStudent}
      />
    </div>
  );
};
