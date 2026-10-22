import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { AccessDenied } from '../error/AccessDenied';
import type {
  AssessmentCycle,
  ClassSection,
  Subject,
} from '../../domain/types';
import { Permissions } from '../../domain/permissions';
import {
  Save,
  CheckCircle2,
  Download,
  ShieldCheck,
  Lock,
  BookOpen,
} from 'lucide-react';

interface MarkRowDraft {
  studentId: string;
  rollNumber: number;
  name: string;
  admissionNumber: string;
  marksObtained: number | null;
  isAbsent: boolean;
  remarks: string;
}

export const MarksEntryRegister: React.FC = () => {
  const { assessmentId, registerId, classId, subjectId } = useParams<{
    assessmentId?: string;
    registerId?: string;
    classId?: string;
    subjectId?: string;
  }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  // Pickers state
  const [cycles, setCycles] = useState<AssessmentCycle[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Parse route parameters or registerId
  const parsedParams = useMemo(() => {
    let cCycle = assessmentId;
    let cClass = classId;
    let cSub = subjectId;

    if (registerId) {
      // Pattern: reg-{cycleId}-{classId}-{subjectId}
      // Example: reg-assess-ut2-2025-class-10-b-sub-math-10
      const match = registerId.match(/^reg-(assess-[a-zA-Z0-9_-]+)-(class-[a-zA-Z0-9_-]+)-(sub-[a-zA-Z0-9_-]+)$/);
      if (match) {
        cCycle = match[1];
        cClass = match[2];
        cSub = match[3];
      } else {
        cCycle = registerId;
      }
    }

    return { cycleId: cCycle, classId: cClass, subjectId: cSub };
  }, [assessmentId, registerId, classId, subjectId]);

  const initialClassId =
    parsedParams.classId ||
    currentUser?.assignedClassId ||
    currentUser?.assignedClasses?.[0] ||
    (currentUser?.role === 'principal' ? 'class-10-a' : '');
  const initialSubjectId =
    parsedParams.subjectId ||
    currentUser?.assignedSubjects?.[0] ||
    (currentUser?.role === 'principal' ? 'sub-math-10' : '');

  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    parsedParams.cycleId || 'assess-ut2-2025'
  );
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId);

  // Active register state
  const [activeCycle, setActiveCycle] = useState<AssessmentCycle | null>(null);
  const [activeClass, setActiveClass] = useState<ClassSection | null>(null);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [marksRows, setMarksRows] = useState<MarkRowDraft[]>([]);
  const [isFinalized, setIsFinalized] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Sync route param
  useEffect(() => {
    if (parsedParams.cycleId && parsedParams.cycleId !== selectedCycleId) {
      setSelectedCycleId(parsedParams.cycleId);
    }
    if (parsedParams.classId && parsedParams.classId !== selectedClassId) {
      setSelectedClassId(parsedParams.classId);
    }
    if (parsedParams.subjectId && parsedParams.subjectId !== selectedSubjectId) {
      setSelectedSubjectId(parsedParams.subjectId);
    }
  }, [parsedParams, selectedCycleId, selectedClassId, selectedSubjectId]);

  // Load Metadata (Cycles, Classes, Subjects)
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const [cList, clsList, sList] = await Promise.all([
          provider.getAssessmentCycles(),
          provider.getClasses(),
          provider.getSubjects(),
        ]);
        if (!isMounted) return;
        setCycles(cList);
        setClasses(clsList);
        setSubjects(sList);
      } catch (err: unknown) {
        console.error('Error fetching marks register metadata:', err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  // Scoped classes & subjects based on user assignment
  const availableClasses = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'principal' || currentUser.role === 'admin' || currentUser.role === 'office_staff') {
      return classes;
    }
    const permittedIds = new Set<string>();
    if (currentUser.assignedClassId) permittedIds.add(currentUser.assignedClassId);
    if (currentUser.assignedClasses) currentUser.assignedClasses.forEach(id => permittedIds.add(id));
    return classes.filter(c => permittedIds.has(c.id));
  }, [classes, currentUser]);

  const availableSubjects = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'principal' || currentUser.role === 'admin') {
      return subjects;
    }
    if (currentUser.role === 'subject_teacher') {
      const permittedIds = new Set(currentUser.assignedSubjects || []);
      return subjects.filter(s => permittedIds.has(s.id));
    }
    return subjects;
  }, [subjects, currentUser]);

  // Adjust selection when available options change
  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.some(c => c.id === selectedClassId)) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.some(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId(availableSubjects[0].id);
    }
  }, [availableSubjects, selectedSubjectId]);

  const canAccess = useMemo(() => {
    return Permissions.canAccessSubjectMarks(currentUser, selectedClassId, selectedSubjectId);
  }, [currentUser, selectedClassId, selectedSubjectId]);

  const canEdit = useMemo(() => {
    return Permissions.canEditMarks(currentUser, selectedClassId, selectedSubjectId);
  }, [currentUser, selectedClassId, selectedSubjectId]);

  // Load Register & Students for selected tuple (Cycle, Class, Subject)
  useEffect(() => {
    let isMounted = true;
    async function loadRegister() {
      setIsLoading(true);
      setError(null);
      setSuccessMsg(null);

      if (!canAccess) {
        setIsLoading(false);
        setError('Access Restricted: You are not assigned to evaluate or view marks for this class/subject combination.');
        setMarksRows([]);
        return;
      }

      try {
        const [cycle, cls, subj, studList, existingReg] = await Promise.all([
          provider.getAssessmentCycleById(selectedCycleId),
          provider.getClassById(selectedClassId),
          provider.getSubjects().then(list => list.find(s => s.id === selectedSubjectId) || null),
          provider.getClassStudents(selectedClassId),
          provider.getMarksRegister(selectedCycleId, selectedClassId, selectedSubjectId),
        ]);

        if (!isMounted) return;
        setActiveCycle(cycle);
        setActiveClass(cls);
        setActiveSubject(subj);
        setIsFinalized(existingReg?.status === 'finalized');

        // Map students to draft rows
        const rows: MarkRowDraft[] = studList.map(s => {
          const entry = existingReg?.entries.find(e => e.studentId === s.id);
          return {
            studentId: s.id,
            rollNumber: s.rollNumber,
            name: `${s.firstName} ${s.lastName}`,
            admissionNumber: s.admissionNumber,
            marksObtained: entry?.marksObtained !== undefined ? entry.marksObtained : null,
            isAbsent: entry?.isAbsent || false,
            remarks: entry?.remarks || '',
          };
        });

        setMarksRows(rows);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load marks register.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRegister();
    return () => {
      isMounted = false;
    };
  }, [provider, selectedCycleId, selectedClassId, selectedSubjectId, canAccess]);

  const maxMarks = activeCycle?.maxMarks || 25;
  const passMarks = Math.round(maxMarks * 0.33);

  // Computed metrics
  const stats = useMemo(() => {
    let scoredCount = 0;
    let absentCount = 0;
    let totalMarks = 0;
    let passCount = 0;
    let remedialCount = 0;
    let invalidCount = 0;

    marksRows.forEach(row => {
      if (row.isAbsent) {
        absentCount++;
      } else if (row.marksObtained !== null && row.marksObtained !== undefined) {
        if (row.marksObtained > maxMarks || row.marksObtained < 0) {
          invalidCount++;
        } else {
          scoredCount++;
          totalMarks += row.marksObtained;
          if (row.marksObtained >= passMarks) {
            passCount++;
          } else {
            remedialCount++;
          }
        }
      }
    });

    const average = scoredCount > 0 ? (totalMarks / scoredCount).toFixed(1) : '—';
    const percentScored = marksRows.length > 0 ? Math.round(((scoredCount + absentCount) / marksRows.length) * 100) : 0;

    return {
      total: marksRows.length,
      scoredCount,
      absentCount,
      unscoredCount: marksRows.length - (scoredCount + absentCount),
      average,
      passCount,
      remedialCount,
      invalidCount,
      percentScored,
    };
  }, [marksRows, maxMarks, passMarks]);

  // Handle row changes
  const handleMarkChange = (studentId: string, valStr: string) => {
    if (isFinalized) return;
    const val = valStr === '' ? null : Number(valStr);
    setMarksRows(prev =>
      prev.map(r => (r.studentId === studentId ? { ...r, marksObtained: val } : r))
    );
  };

  const handleAbsentToggle = (studentId: string, isAbsent: boolean) => {
    if (isFinalized) return;
    setMarksRows(prev =>
      prev.map(r =>
        r.studentId === studentId
          ? {
              ...r,
              isAbsent,
              marksObtained: isAbsent ? null : r.marksObtained,
            }
          : r
      )
    );
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    if (isFinalized) return;
    setMarksRows(prev =>
      prev.map(r => (r.studentId === studentId ? { ...r, remarks } : r))
    );
  };

  // Grade helper
  const getGradeInfo = (obtained: number | null, isAbsent: boolean) => {
    if (isAbsent) return { grade: 'ABS', label: 'Absent', color: 'var(--hhs-danger-text)' };
    if (obtained === null || obtained === undefined) return { grade: '—', label: 'Pending', color: 'var(--hhs-text-muted)' };
    const pct = (obtained / maxMarks) * 100;
    if (pct >= 91) return { grade: 'A1', label: 'Outstanding', color: 'var(--hhs-primary)' };
    if (pct >= 81) return { grade: 'A2', label: 'Excellent', color: 'var(--hhs-primary)' };
    if (pct >= 71) return { grade: 'B1', label: 'Very Good', color: 'var(--hhs-primary)' };
    if (pct >= 61) return { grade: 'B2', label: 'Good', color: 'var(--hhs-primary-text)' };
    if (pct >= 51) return { grade: 'C1', label: 'Fair', color: 'var(--hhs-text-primary)' };
    if (pct >= 41) return { grade: 'C2', label: 'Average', color: 'var(--hhs-accent-text)' };
    if (pct >= 33) return { grade: 'D', label: 'Pass', color: 'var(--hhs-accent-text)' };
    return { grade: 'E', label: 'Needs Review', color: 'var(--hhs-danger-text)' };
  };

  // Save / Finalize submission
  const executeSave = async (asFinalized: boolean) => {
    if (!currentUser) return;
    if (stats.invalidCount > 0) {
      alert(`Validation Error: ${stats.invalidCount} score(s) exceed the maximum permitted of ${maxMarks}. Please correct before submitting.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await provider.saveMarksRegister(
        {
          assessmentId: selectedCycleId,
          classId: selectedClassId,
          subjectId: selectedSubjectId,
          isDraft: !asFinalized,
          entries: marksRows.map(r => ({
            studentId: r.studentId,
            marksObtained: r.marksObtained,
            isAbsent: r.isAbsent,
            remarks: r.remarks,
          })),
        },
        currentUser
      );

      if (asFinalized) {
        setIsFinalized(true);
        setIsConfirmModalOpen(false);
        setSuccessMsg('Marks Register successfully signed off and finalized for Term Record.');
      } else {
        setSuccessMsg(`Draft saved at ${new Date().toLocaleTimeString()} IST.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save marks register.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!activeClass || !activeCycle || !activeSubject) return;
    const headers = ['Roll #', 'Admission #', 'Student Name', 'Marks Obtained', 'Max Marks', 'Status', 'Grade', 'Remarks'];
    const rows = marksRows.map(r => {
      const g = getGradeInfo(r.marksObtained, r.isAbsent);
      return [
        r.rollNumber,
        r.admissionNumber,
        `"${r.name}"`,
        r.isAbsent ? 'ABS' : r.marksObtained !== null ? r.marksObtained : '',
        maxMarks,
        r.isAbsent ? 'Absent' : r.marksObtained !== null ? 'Present' : 'Pending',
        g.grade,
        `"${r.remarks}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Marks_${activeClass.name}_${activeSubject.name}_${activeCycle.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentUser || (availableClasses.length === 0 && currentUser.role !== 'principal')) {
    return (
      <AccessDenied
        title="Faculty Assignment Required"
        message="You do not have any teaching section assignments registered to enter or review marks."
      />
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading marks entry register..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Enter Marks"
        subtitle={`Enter and review student marks for ${activeClass?.label || 'class'} • ${activeSubject?.name || 'subject'}`}
        roleScope={activeSubject?.name || 'Marks'}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Assessments', to: '/assessments' },
          { label: activeClass ? `${activeClass.label} Marks` : 'Enter Marks' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {selectedClassId && (
              <button
                onClick={() => navigate(`/performance/classes/${selectedClassId}`)}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="View Results for this class"
              >
                <BookOpen size={15} />
                <span>View Results</span>
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Download CSV Mark Sheet"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
            {!canEdit ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--hhs-radius-base)',
                  backgroundColor: 'var(--hhs-surface-muted)',
                  color: 'var(--hhs-text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  border: '1px solid var(--hhs-border-subtle)',
                }}
              >
                <Lock size={15} />
                <span>Read-Only Archive</span>
              </div>
            ) : !isFinalized ? (
              <>
                <button
                  onClick={() => executeSave(false)}
                  disabled={isSaving}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={15} />
                  <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  disabled={isSaving || stats.invalidCount > 0}
                  className="hhs-btn hhs-btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ShieldCheck size={15} />
                  <span>Finalize & Submit</span>
                </button>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--hhs-radius-base)',
                  backgroundColor: 'var(--hhs-primary-light)',
                  color: 'var(--hhs-primary-text)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                }}
              >
                <CheckCircle2 size={16} />
                <span>Finalized & Locked</span>
              </div>
            )}
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}
      {successMsg && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--hhs-primary-light)',
            color: 'var(--hhs-primary-text)',
            borderRadius: 'var(--hhs-radius-base)',
            border: '1px solid var(--hhs-primary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Selectors Bar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Class & Section:
          </label>
          <select
            className="hhs-select"
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            style={{ width: 'auto', minWidth: '140px' }}
          >
            {availableClasses.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Subject:
          </label>
          <select
            className="hhs-select"
            value={selectedSubjectId}
            onChange={e => setSelectedSubjectId(e.target.value)}
            style={{ width: 'auto', minWidth: '160px' }}
          >
            {availableSubjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
          Max Marks: <strong>{maxMarks}</strong> • Passing Threshold (33%): <strong>{passMarks}</strong>
        </div>
      </div>

      {/* Operational Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Registry Progress</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {stats.percentScored}%
          </div>
          <div className="hhs-metric-sub">
            {stats.scoredCount + stats.absentCount} of {stats.total} logged
          </div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Class Mean Aggregate</div>
          <div className="hhs-metric-value">
            {stats.average} <span style={{ fontSize: '0.85rem', color: 'var(--hhs-text-muted)' }}>/ {maxMarks}</span>
          </div>
          <div className="hhs-metric-sub">Active scored cohort</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Performance Breakdown</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.25rem' }}>
            <span style={{ color: 'var(--hhs-primary)' }}>{stats.passCount} Pass</span>
            <span style={{ color: 'var(--hhs-text-muted)', margin: '0 6px' }}>•</span>
            <span style={{ color: 'var(--hhs-danger-text)' }}>{stats.remedialCount} Needs Support</span>
          </div>
          <div className="hhs-metric-sub">{stats.absentCount} Absent students</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Validation Status</div>
          <div
            className="hhs-metric-value"
            style={{
              color: stats.invalidCount > 0 ? 'var(--hhs-danger-text)' : 'var(--hhs-primary)',
            }}
          >
            {stats.invalidCount > 0 ? `${stats.invalidCount} Invalid` : 'All Valid'}
          </div>
          <div className="hhs-metric-sub">
            {stats.invalidCount > 0 ? 'Scores exceed maximum' : 'Ready for sign-off'}
          </div>
        </div>
      </div>

      {/* Marks Register Grid Table */}
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
              Student Marks Sheet — {activeClass?.label} — {activeSubject?.name}
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Evaluation cycle: {activeCycle?.name} • Passing: {passMarks}/{maxMarks}
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">
            {isFinalized ? 'Record Finalized' : 'Edit Mode'}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '45px' }} className="numeric">Roll</th>
                <th style={{ width: '110px' }}>Admission #</th>
                <th>Student Name</th>
                <th style={{ width: '140px' }} className="numeric">Marks Obtained</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Absent</th>
                <th style={{ width: '80px' }} className="numeric">% Score</th>
                <th style={{ width: '90px', textAlign: 'center' }}>CBSE Grade</th>
                <th>Tutor Remarks & Action Flag</th>
              </tr>
            </thead>
            <tbody>
              {marksRows.map(row => {
                const isOverMax = row.marksObtained !== null && row.marksObtained > maxMarks;
                const isNegative = row.marksObtained !== null && row.marksObtained < 0;
                const isError = isOverMax || isNegative;
                const gradeInfo = getGradeInfo(row.marksObtained, row.isAbsent);
                const pct = row.marksObtained !== null ? ((row.marksObtained / maxMarks) * 100).toFixed(1) : '—';

                return (
                  <tr
                    key={row.studentId}
                    style={{
                      backgroundColor: isError
                        ? 'var(--hhs-danger-light)'
                        : row.isAbsent
                        ? 'var(--hhs-surface-muted)'
                        : undefined,
                    }}
                  >
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {row.rollNumber}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                        {row.admissionNumber}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/students/${row.studentId}`)}
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
                        {row.name}
                      </button>
                    </td>
                    <td className="numeric">
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          disabled={!canEdit || row.isAbsent || isFinalized}
                          min={0}
                          max={maxMarks}
                          step="0.5"
                          className="hhs-input"
                          value={row.marksObtained !== null ? row.marksObtained : ''}
                          onChange={e => handleMarkChange(row.studentId, e.target.value)}
                          placeholder="—"
                          style={{
                            width: '75px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isError ? 'var(--hhs-danger-text)' : 'inherit',
                            borderColor: isError ? 'var(--hhs-danger)' : undefined,
                            backgroundColor: row.isAbsent || !canEdit ? 'var(--hhs-surface-muted)' : 'var(--hhs-surface)',
                          }}
                        />
                        <span style={{ fontSize: '0.78rem', color: 'var(--hhs-text-muted)' }}>
                          / {maxMarks}
                        </span>
                      </div>
                      {isOverMax && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--hhs-danger-text)', fontWeight: 600 }}>
                          Exceeds {maxMarks}!
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        disabled={!canEdit || isFinalized}
                        checked={row.isAbsent}
                        onChange={e => handleAbsentToggle(row.studentId, e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: (!canEdit || isFinalized) ? 'not-allowed' : 'pointer' }}
                        title="Mark student as Absent (ABS)"
                      />
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {row.isAbsent ? (
                        <span style={{ color: 'var(--hhs-danger-text)' }}>ABS</span>
                      ) : (
                        `${pct}%`
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 'var(--hhs-radius-pill)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: gradeInfo.color,
                          backgroundColor: row.isAbsent
                            ? 'var(--hhs-danger-light)'
                            : gradeInfo.grade === 'E'
                            ? 'var(--hhs-danger-light)'
                            : 'var(--hhs-surface-muted)',
                        }}
                      >
                        {gradeInfo.grade}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        disabled={!canEdit || isFinalized}
                        className="hhs-input"
                        value={row.remarks}
                        onChange={e => handleRemarksChange(row.studentId, e.target.value)}
                        placeholder="Optional remarks (e.g. Needs extra practice)"
                        style={{ fontSize: '0.8rem', height: '30px' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Finalize & Submit Marks"
        subtitle="This action saves the marks sheet and submits it for review."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--hhs-accent-light)',
              border: '1px solid var(--hhs-accent)',
              borderRadius: 'var(--hhs-radius-base)',
              fontSize: '0.82rem',
              color: 'var(--hhs-accent-text)',
            }}
          >
            <strong>Submission Notice:</strong> Submitting this marks sheet will lock marks from accidental edits. Any subsequent correction will require Principal sign-off.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
            <div>Assessment: <strong>{activeCycle?.name}</strong></div>
            <div>Class: <strong>{activeClass?.label}</strong></div>
            <div>Subject: <strong>{activeSubject?.name}</strong></div>
            <div>Total Students: <strong>{stats.total}</strong></div>
            <div>Scored: <strong>{stats.scoredCount}</strong></div>
            <div>Absent (ABS): <strong>{stats.absentCount}</strong></div>
            <div>Class Average: <strong>{stats.average} / {maxMarks}</strong></div>
            <div>Needs Support: <strong>{stats.remedialCount}</strong></div>
          </div>

          {stats.unscoredCount > 0 && (
            <div style={{ color: 'var(--hhs-danger-text)', fontSize: '0.82rem', fontWeight: 600 }}>
              Warning: {stats.unscoredCount} student(s) remain unscored without an Absent marker.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="hhs-btn hhs-btn-secondary"
            >
              Back to Editing
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => executeSave(true)}
              className="hhs-btn hhs-btn-primary"
            >
              {isSaving ? 'Submitting...' : 'Confirm & Finalize Record'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
