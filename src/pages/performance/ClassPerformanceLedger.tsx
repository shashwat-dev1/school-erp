import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { AccessDenied } from '../error/AccessDenied';
import type {
  ClassSection,
  AssessmentCycle,
  Subject,
  StudentRecord,
  StudentMarkEntry,
} from '../../domain/types';
import {
  Download,
  BookOpen,
  Edit3,
  Eye,
} from 'lucide-react';

export const ClassPerformanceLedger: React.FC = () => {
  const { classId } = useParams<{ classId?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const activeClassId = classId || currentUser?.assignedClassId || currentUser?.assignedClasses?.[0];

  const [selectedCycleId, setSelectedCycleId] = useState<string>('assess-ut2-2025');
  const [filterMode, setFilterMode] = useState<'all' | 'review'>('all');
  const [cycles, setCycles] = useState<AssessmentCycle[]>([]);
  const [activeClass, setActiveClass] = useState<ClassSection | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, StudentMarkEntry | null>>>({});
  const [subjectAverages, setSubjectAverages] = useState<Record<string, number>>({});

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isSubjectTeacher = currentUser?.role === 'subject_teacher';

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
        if (cList.length > 0 && !cList.some(c => c.id === selectedCycleId)) {
          setSelectedCycleId(cList[0].id);
        }
      } catch (err: unknown) {
        console.error('Error fetching performance metadata:', err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [provider, activeClassId]);

  // Fetch marks matrix for active class and cycle
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
        setError(err instanceof Error ? err.message : 'Failed to load class performance data.');
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

  // Clearance check: Subject teachers can ONLY see their assigned subjects
  const isFullMatrixAuthorized =
    currentUser?.role === 'principal' ||
    (currentUser?.role === 'class_teacher' && currentUser.assignedClassId === activeClassId);

  const visibleSubjects = useMemo(() => {
    if (isFullMatrixAuthorized) return subjects;
    const teacherSubIds = currentUser?.assignedSubjects || [];
    return subjects.filter(s => teacherSubIds.includes(s.id));
  }, [subjects, isFullMatrixAuthorized, currentUser]);

  // Single assigned subject for subject teacher view
  const primarySubject = visibleSubjects[0] || subjects.find(s => s.name.toLowerCase().includes('math')) || subjects[0];

  // Computations for Subject Teacher view
  const subjectTeacherMetrics = useMemo(() => {
    if (!primarySubject) return { averagePct: '—', totalStudents: students.length, reviewStudents: [] };

    let totalScore = 0;
    let counted = 0;
    const reviewList: StudentRecord[] = [];

    students.forEach(s => {
      const entry = matrixData[s.id]?.[primarySubject.id];
      if (entry?.isAbsent) {
        reviewList.push(s);
      } else if (entry && entry.marksObtained !== null) {
        totalScore += entry.marksObtained;
        counted++;
        if (entry.marksObtained < passMarks) {
          reviewList.push(s);
        }
      }
    });

    const averagePct = counted > 0 ? ((totalScore / (counted * maxMarks)) * 100).toFixed(1) : '—';

    return {
      averagePct,
      totalStudents: students.length,
      reviewStudents: reviewList,
    };
  }, [primarySubject, students, matrixData, maxMarks, passMarks]);

  // Summary computations for School / Class Teacher view
  const summaryStats = useMemo(() => {
    let totalScore = 0;
    let maxPossible = 0;
    let supportCount = 0;
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
        totalScore += studentScore;
        maxPossible += count * maxMarks;
        const pct = (studentScore / (count * maxMarks)) * 100;
        if (pct < 33) supportCount++;
        if (pct >= 75) distinctionCount++;
      }
    });

    const averagePct = maxPossible > 0 ? ((totalScore / maxPossible) * 100).toFixed(1) : '—';

    return {
      averagePct,
      supportCount,
      distinctionCount,
      totalStudents: students.length,
    };
  }, [students, visibleSubjects, matrixData, maxMarks]);

  // Filtered students for display
  const displayedStudents = useMemo(() => {
    if (filterMode === 'review') {
      if (isSubjectTeacher) {
        const reviewIds = new Set(subjectTeacherMetrics.reviewStudents.map(s => s.id));
        return students.filter(s => reviewIds.has(s.id));
      } else {
        return students.filter(s => {
          let score = 0;
          let count = 0;
          visibleSubjects.forEach(sub => {
            const e = matrixData[s.id]?.[sub.id];
            if (e && e.marksObtained !== null && e.marksObtained !== undefined && !e.isAbsent) {
              score += e.marksObtained;
              count++;
            }
          });
          return count > 0 && (score / (count * maxMarks)) * 100 < 33;
        });
      }
    }
    return students;
  }, [filterMode, isSubjectTeacher, subjectTeacherMetrics, students, visibleSubjects, matrixData, maxMarks]);

  // Export CSV
  const handleExportCSV = () => {
    if (!activeClass || !activeCycle) return;
    const exportSubjects = isSubjectTeacher && primarySubject ? [primarySubject] : visibleSubjects;

    const headers = [
      'Roll #',
      'Admission #',
      'Student Name',
      ...exportSubjects.map(s => `"${s.name} (${maxMarks})"`),
      ...(isSubjectTeacher ? ['Status'] : ['Total Marks', 'Max Total', 'Percentage', 'Grade']),
    ];

    const rows = students.map(s => {
      let tot = 0;
      let cnt = 0;
      const subjVals = exportSubjects.map(sub => {
        const e = matrixData[s.id]?.[sub.id];
        if (e?.isAbsent) return 'Absent';
        if (e && e.marksObtained !== null) {
          tot += e.marksObtained;
          cnt++;
          return e.marksObtained;
        }
        return '—';
      });

      if (isSubjectTeacher) {
        const e = primarySubject ? matrixData[s.id]?.[primarySubject.id] : null;
        const status = e?.isAbsent
          ? 'Absent'
          : e?.marksObtained !== null && e?.marksObtained !== undefined
          ? e.marksObtained >= passMarks
            ? 'Pass'
            : 'Needs Review'
          : 'Pending';
        return [s.rollNumber, s.admissionNumber, `"${s.firstName} ${s.lastName}"`, ...subjVals, status].join(',');
      }

      const maxTot = exportSubjects.length * maxMarks;
      const pct = cnt > 0 ? ((tot / maxTot) * 100).toFixed(1) + '%' : '—';
      const grade = cnt > 0 ? (tot / maxTot >= 0.8 ? 'A1' : tot / maxTot >= 0.6 ? 'B1' : tot / maxTot >= 0.33 ? 'C1' : 'E') : '—';

      return [
        s.rollNumber,
        s.admissionNumber,
        `"${s.firstName} ${s.lastName}"`,
        ...subjVals,
        tot,
        maxTot,
        pct,
        grade,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(activeClass.label || 'Class').replace(/\s+/g, '_')}_Results_${activeCycle?.name || 'Cycle'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Permission guards
  if (currentUser?.role === 'subject_teacher' && !currentUser.assignedClasses?.includes(activeClassId || '')) {
    return (
      <AccessDenied
        title="Class Results Access"
        message="You do not have teaching assignments in this class section."
      />
    );
  }

  if (currentUser?.role === 'subject_teacher' && visibleSubjects.length === 0) {
    return (
      <AccessDenied
        title="Subject Results Access"
        message="You do not teach any subjects in this class section."
      />
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading class results..." />;
  }

  // =========================================================================
  // VIEW A: SUBJECT TEACHER VIEW (SCOPED STRICTLY TO ASSIGNED SUBJECT & CLASS)
  // =========================================================================
  if (isSubjectTeacher) {
    const subjectName = primarySubject?.name || 'Mathematics';
    const registerId = `reg-${selectedCycleId}-${activeClassId}-${primarySubject?.id || 'sub-math-10'}`;

    return (
      <div className="hhs-page-container">
        <PageHeader
          title={`${subjectName} Results — ${activeClass?.label || 'Class'}`}
          subtitle={`${activeCycle?.name || 'Examination'} • Session 2025–2026`}
          roleScope={subjectName}
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: activeClass?.label ? `${activeClass.label} Results` : 'Results' },
          ]}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/academics/assessments/marks/${registerId}`)}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit3 size={15} />
                <span>Enter Marks</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={15} />
                <span>Export CSV</span>
              </button>
            </div>
          }
        />

        {error && <ErrorBanner message={error} />}

        {/* Toolbar: Assessment Cycle & View Filter */}
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
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--hhs-surface)', padding: '3px', borderRadius: 'var(--hhs-radius-base)', border: '1px solid var(--hhs-border)' }}>
            <button
              onClick={() => setFilterMode('all')}
              style={{
                padding: '6px 14px',
                fontSize: '0.84rem',
                fontWeight: filterMode === 'all' ? 700 : 500,
                backgroundColor: filterMode === 'all' ? 'var(--hhs-primary)' : 'transparent',
                color: filterMode === 'all' ? '#FFFFFF' : 'var(--hhs-text-primary)',
                border: 'none',
                borderRadius: 'var(--hhs-radius-sm)',
                cursor: 'pointer',
              }}
            >
              All Students ({students.length})
            </button>
            <button
              onClick={() => setFilterMode('review')}
              style={{
                padding: '6px 14px',
                fontSize: '0.84rem',
                fontWeight: filterMode === 'review' ? 700 : 500,
                backgroundColor: filterMode === 'review' ? 'var(--hhs-primary)' : 'transparent',
                color: filterMode === 'review' ? '#FFFFFF' : 'var(--hhs-text-primary)',
                border: 'none',
                borderRadius: 'var(--hhs-radius-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Marks to Review</span>
              {subjectTeacherMetrics.reviewStudents.length > 0 && (
                <span
                  style={{
                    backgroundColor: filterMode === 'review' ? 'rgba(255,255,255,0.25)' : 'var(--hhs-danger)',
                    color: '#FFFFFF',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 'var(--hhs-radius-pill)',
                  }}
                >
                  {subjectTeacherMetrics.reviewStudents.length}
                </span>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="hhs-label" style={{ margin: 0 }}>
              Assessment:
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

        {/* 3 Metric Cards for Subject Teacher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px',
            marginBottom: '20px',
          }}
        >
          <div className="hhs-metric-card primary">
            <div className="hhs-metric-label">Class Average</div>
            <div className="hhs-metric-value">{subjectTeacherMetrics.averagePct}%</div>
            <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
              {subjectName} • {activeCycle?.name}
            </div>
          </div>

          <div className="hhs-metric-card info">
            <div className="hhs-metric-label">Enrolled Students</div>
            <div className="hhs-metric-value">{subjectTeacherMetrics.totalStudents}</div>
            <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
              {activeClass?.label || 'Class'} Nominal Roll
            </div>
          </div>

          <div className="hhs-metric-card accent">
            <div className="hhs-metric-label">Marks to Review</div>
            <div className="hhs-metric-value" style={{ color: subjectTeacherMetrics.reviewStudents.length > 0 ? 'var(--hhs-danger-text)' : 'inherit' }}>
              {subjectTeacherMetrics.reviewStudents.length} Students
            </div>
            <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
              Scored below passing ({passMarks}/{maxMarks}) or absent
            </div>
          </div>
        </div>

        {/* Subject Results Table */}
        <div className="hhs-card">
          <div className="hhs-table-container">
            <table className="hhs-table">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>Roll #</th>
                  <th style={{ width: '130px' }}>Admission #</th>
                  <th>Student Name</th>
                  <th className="numeric" style={{ width: '140px' }}>
                    Marks (Out of {maxMarks})
                  </th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--hhs-text-secondary)' }}>
                      No students found matching this view.
                    </td>
                  </tr>
                ) : (
                  displayedStudents.map(s => {
                    const entry = primarySubject ? matrixData[s.id]?.[primarySubject.id] : null;
                    const isAbsent = entry?.isAbsent;
                    const marks = entry?.marksObtained;
                    const isReview = isAbsent || (marks !== null && marks !== undefined && marks < passMarks);

                    return (
                      <tr key={s.id} style={{ backgroundColor: isReview ? 'var(--hhs-accent-light)' : undefined }}>
                        <td className="numeric" style={{ fontWeight: 600 }}>{s.rollNumber}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                          {s.admissionNumber}
                        </td>
                        <td>
                          <button
                            onClick={() => navigate(`/students/${s.id}`)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              font: 'inherit',
                              fontWeight: 600,
                              color: 'var(--hhs-text-primary)',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {s.firstName} {s.lastName}
                          </button>
                        </td>
                        <td className="numeric" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {isAbsent ? (
                            <span style={{ color: 'var(--hhs-danger)', fontWeight: 700 }}>Absent</span>
                          ) : marks !== null && marks !== undefined ? (
                            <span style={{ color: marks < passMarks ? 'var(--hhs-danger-text)' : 'inherit' }}>
                              {marks}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--hhs-text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isAbsent ? (
                            <span className="hhs-badge hhs-badge-danger">Absent</span>
                          ) : marks !== null && marks !== undefined ? (
                            marks >= passMarks ? (
                              <span className="hhs-badge hhs-badge-success">Passing</span>
                            ) : (
                              <span className="hhs-badge hhs-badge-danger">Review</span>
                            )
                          ) : (
                            <span className="hhs-badge hhs-badge-neutral">Pending</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => navigate(`/students/${s.id}`)}
                            className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                            style={{ padding: '0 8px', fontSize: '0.74rem' }}
                            title="View Student Summary"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: CLASS TEACHER / PRINCIPAL / OFFICE VIEW (CONSOLIDATED MARKS)
  // =========================================================================
  return (
    <div className="hhs-page-container">
      <PageHeader
        title={`Class Results — ${activeClass?.label || 'Class'}`}
        subtitle={`${activeCycle?.name || 'Assessment'} • Consolidated Subject Performance`}
        roleScope={activeClass?.label || 'Class Results'}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: activeClass?.label ? `${activeClass.label} Results` : 'Class Results' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExportCSV}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => navigate('/reports/academic-comparison')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <BookOpen size={15} />
              <span>Class Comparison</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Cycle Selector & Filter */}
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
        <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--hhs-surface)', padding: '3px', borderRadius: 'var(--hhs-radius-base)', border: '1px solid var(--hhs-border)' }}>
          <button
            onClick={() => setFilterMode('all')}
            style={{
              padding: '6px 14px',
              fontSize: '0.84rem',
              fontWeight: filterMode === 'all' ? 700 : 500,
              backgroundColor: filterMode === 'all' ? 'var(--hhs-primary)' : 'transparent',
              color: filterMode === 'all' ? '#FFFFFF' : 'var(--hhs-text-primary)',
              border: 'none',
              borderRadius: 'var(--hhs-radius-sm)',
              cursor: 'pointer',
            }}
          >
            All Students ({students.length})
          </button>
          <button
            onClick={() => setFilterMode('review')}
            style={{
              padding: '6px 14px',
              fontSize: '0.84rem',
              fontWeight: filterMode === 'review' ? 700 : 500,
              backgroundColor: filterMode === 'review' ? 'var(--hhs-primary)' : 'transparent',
              color: filterMode === 'review' ? '#FFFFFF' : 'var(--hhs-text-primary)',
              border: 'none',
              borderRadius: 'var(--hhs-radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Needs Support</span>
            {summaryStats.supportCount > 0 && (
              <span
                style={{
                  backgroundColor: filterMode === 'review' ? 'rgba(255,255,255,0.25)' : 'var(--hhs-danger)',
                  color: '#FFFFFF',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--hhs-radius-pill)',
                }}
              >
                {summaryStats.supportCount}
              </span>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>
            Assessment:
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
        <div className="hhs-metric-card primary">
          <div className="hhs-metric-label">Class Average</div>
          <div className="hhs-metric-value">{summaryStats.averagePct}%</div>
          <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
            {activeCycle?.name}
          </div>
        </div>

        <div className="hhs-metric-card success">
          <div className="hhs-metric-label">Distinction (≥75%)</div>
          <div className="hhs-metric-value">{summaryStats.distinctionCount} Students</div>
          <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
            High academic progress
          </div>
        </div>

        <div className="hhs-metric-card accent">
          <div className="hhs-metric-label">Academic Support (&lt;33%)</div>
          <div className="hhs-metric-value" style={{ color: summaryStats.supportCount > 0 ? 'var(--hhs-danger-text)' : 'inherit' }}>
            {summaryStats.supportCount} Students
          </div>
          <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
            Eligible for remedial sessions
          </div>
        </div>

        <div className="hhs-metric-card info">
          <div className="hhs-metric-label">Total Students</div>
          <div className="hhs-metric-value">{summaryStats.totalStudents}</div>
          <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
            Enrolled in {activeClass?.label}
          </div>
        </div>
      </div>

      {/* Consolidated Table */}
      <div className="hhs-card">
        <div className="hhs-table-container">
          <table className="hhs-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Roll #</th>
                <th style={{ width: '120px' }}>Admission #</th>
                <th style={{ minWidth: '160px' }}>Student Name</th>
                {visibleSubjects.map(sub => (
                  <th key={sub.id} className="numeric" style={{ minWidth: '85px' }}>
                    {sub.name}
                  </th>
                ))}
                <th className="numeric" style={{ minWidth: '85px' }}>Total</th>
                <th className="numeric" style={{ minWidth: '70px' }}>%</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.map(s => {
                let studentTotal = 0;
                let counted = 0;

                return (
                  <tr key={s.id}>
                    <td className="numeric" style={{ fontWeight: 600 }}>{s.rollNumber}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                      {s.admissionNumber}
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/students/${s.id}`)}
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: 0,
                          font: 'inherit',
                          fontWeight: 600,
                          color: 'var(--hhs-text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {s.firstName} {s.lastName}
                      </button>
                    </td>

                    {visibleSubjects.map(sub => {
                      const entry = matrixData[s.id]?.[sub.id];
                      if (entry?.isAbsent) {
                        return (
                          <td key={sub.id} className="numeric" style={{ color: 'var(--hhs-danger)', fontWeight: 600 }}>
                            Abs
                          </td>
                        );
                      }
                      if (entry && entry.marksObtained !== null) {
                        studentTotal += entry.marksObtained;
                        counted++;
                        return (
                          <td key={sub.id} className="numeric" style={{ fontWeight: 600 }}>
                            {entry.marksObtained}
                          </td>
                        );
                      }
                      return (
                        <td key={sub.id} className="numeric" style={{ color: 'var(--hhs-text-muted)' }}>
                          —
                        </td>
                      );
                    })}

                    <td className="numeric" style={{ fontWeight: 700 }}>
                      {studentTotal}
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {counted > 0 ? `${((studentTotal / (counted * maxMarks)) * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {counted > 0 ? (
                        <span
                          className="hhs-badge"
                          style={{
                            backgroundColor: 'var(--hhs-surface-muted)',
                            color: 'var(--hhs-primary)',
                            fontWeight: 700,
                          }}
                        >
                          {(studentTotal / (counted * maxMarks)) * 100 >= 80
                            ? 'A1'
                            : (studentTotal / (counted * maxMarks)) * 100 >= 60
                            ? 'B1'
                            : (studentTotal / (counted * maxMarks)) * 100 >= 33
                            ? 'C1'
                            : 'E'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Class Average Row */}
              <tr style={{ backgroundColor: 'var(--hhs-surface-muted)', fontWeight: 700 }}>
                <td colSpan={3} style={{ textAlign: 'right', paddingRight: '16px' }}>
                  Subject Class Average:
                </td>
                {visibleSubjects.map(sub => {
                  const avg = subjectAverages[sub.id] || 0;
                  return (
                    <td key={sub.id} className="numeric" style={{ color: 'var(--hhs-primary)' }}>
                      {avg.toFixed(1)}
                    </td>
                  );
                })}
                <td colSpan={3} style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
                  Class Benchmark
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
