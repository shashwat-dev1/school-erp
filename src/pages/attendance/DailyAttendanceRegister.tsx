import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { AccessDenied } from '../error/AccessDenied';
import { Modal } from '../../components/ui/Modal';
import { Permissions } from '../../domain/permissions';
import { getSchoolLocalDate } from '../../domain/policy';
import { downloadAttendanceRegisterXlsx, type AttendanceRegisterExportRow } from '../../utils/exportUtils';
import type { ClassSection, AttendanceState, AttendanceSession, AcademicYear } from '../../domain/types';
import {
  CheckCircle2,
  Save,
  Check,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';

interface AttendanceDraftRow {
  studentId: string;
  rollNumber: number;
  name: string;
  admissionNumber: string;
  enrollmentDate?: string;
  state: AttendanceState;
  remarks: string;
}

type AttendanceRangePreset = '3m' | '6m' | '9m' | 'custom';

export const DailyAttendanceRegister: React.FC = () => {
  const { classId: paramClassId } = useParams<{ classId?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  // Mode: Daily Roll Call vs Period Report & Export
  const [activeMode, setActiveMode] = useState<'daily' | 'history'>('daily');

  // Master Data
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const initialClassId = paramClassId || currentUser?.assignedClassId || (currentUser?.role === 'principal' ? 'class-10-a' : '');
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId);
  const [selectedDate, setSelectedDate] = useState<string>(getSchoolLocalDate());
  const [activeClass, setActiveClass] = useState<ClassSection | null>(null);

  // Single-Day Register State
  const [attendanceRows, setAttendanceRows] = useState<AttendanceDraftRow[]>([]);
  const [existingSession, setExistingSession] = useState<AttendanceSession | null>(null);
  const [originalStates, setOriginalStates] = useState<Record<string, AttendanceState>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // History & Export Workflow State
  const [historyYearId, setHistoryYearId] = useState<string>('year-2025-2026');
  const [historySelectedClasses, setHistorySelectedClasses] = useState<string[]>([initialClassId || 'class-10-a']);
  const [dateRangePreset, setDateRangePreset] = useState<AttendanceRangePreset>('3m');
  const [customStartDate, setCustomStartDate] = useState<string>('2025-07-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2025-09-30');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Loaded Range Data
  const [rangeSessions, setRangeSessions] = useState<AttendanceSession[]>([]);
  const [isLoadingRange, setIsLoadingRange] = useState<boolean>(false);

  // Sync paramClassId if route changes
  useEffect(() => {
    if (paramClassId && paramClassId !== selectedClassId) {
      setSelectedClassId(paramClassId);
      if (!historySelectedClasses.includes(paramClassId)) {
        setHistorySelectedClasses([paramClassId]);
      }
    }
  }, [paramClassId, selectedClassId, historySelectedClasses]);

  // Load Classes & Academic Years
  useEffect(() => {
    let isMounted = true;
    async function fetchMaster() {
      try {
        const [clsList, years] = await Promise.all([
          provider.getClasses(),
          provider.getAcademicYears(),
        ]);
        if (isMounted) {
          setClasses(clsList);
          setAcademicYears(years);
          const currentYear = years.find(y => y.isCurrent) || years[0];
          if (currentYear) setHistoryYearId(currentYear.id);
        }
      } catch (err: unknown) {
        console.error('Error fetching classes:', err);
      }
    }
    fetchMaster();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  // Section clearance check: Class Teacher marks their section; Principal has read-only oversight
  const isPrincipal = currentUser?.role === 'principal';
  const isClassTeacher = currentUser?.role === 'class_teacher' && currentUser.assignedClassId === selectedClassId;
  const canMark = Permissions.canMarkAttendance(currentUser, selectedClassId);
  const canView = isPrincipal || isClassTeacher;

  const availableClasses = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'principal') {
      return classes;
    }
    if (currentUser.role === 'class_teacher' && currentUser.assignedClassId) {
      return classes.filter(c => c.id === currentUser.assignedClassId);
    }
    return [];
  }, [classes, currentUser]);

  // 1. Load Students & existing session for Single-Day Register
  useEffect(() => {
    let isMounted = true;
    async function loadRegister() {
      if (!selectedClassId) return;
      setIsLoading(true);
      setError(null);
      try {
        const [cls, students, session] = await Promise.all([
          provider.getClassById(selectedClassId),
          provider.getClassStudents(selectedClassId),
          provider.getAttendanceSession(selectedClassId, selectedDate),
        ]);

        if (!isMounted) return;
        setActiveClass(cls);
        setExistingSession(session);

        // Map students to rows:
        // CRITICAL BUG FIX: If no saved session exists, do NOT pretend 50 students are saved as 'present'.
        // For teacher, default draft state to 'present' for easy marking, but mark session as uncommitted.
        // For principal (read-only), show actual saved state or unmarked indicator.
        const initialRows: AttendanceDraftRow[] = students.map(s => {
          const rec = session?.records.find(r => r.studentId === s.id);
          return {
            studentId: s.id,
            rollNumber: s.rollNumber,
            name: `${s.firstName} ${s.lastName}`,
            admissionNumber: s.admissionNumber,
            enrollmentDate: s.enrollmentDate,
            state: rec ? rec.state : 'present',
            remarks: rec?.remarks || '',
          };
        });

        initialRows.sort((a, b) => a.rollNumber - b.rollNumber);
        setAttendanceRows(initialRows);

        const origMap: Record<string, AttendanceState> = {};
        if (session) {
          session.records.forEach(r => {
            origMap[r.studentId] = r.state;
          });
        }
        setOriginalStates(origMap);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load class attendance roster.';
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRegister();
    return () => {
      isMounted = false;
    };
  }, [provider, selectedClassId, selectedDate]);

  // Compute Date Boundaries for Range Reporting
  const { rangeStartDate, rangeEndDate, isValidRange } = useMemo(() => {
    // Reference date is either configured session end or active operational date
    const refDateStr = selectedDate || getSchoolLocalDate();
    const refDate = new Date(`${refDateStr}T12:00:00Z`);

    if (dateRangePreset === 'custom') {
      const isValid = customEndDate >= customStartDate;
      return {
        rangeStartDate: customStartDate,
        rangeEndDate: customEndDate,
        isValidRange: isValid,
      };
    }

    const months = dateRangePreset === '3m' ? 3 : dateRangePreset === '6m' ? 6 : 9;
    const start = new Date(refDate);
    start.setMonth(start.getMonth() - months);
    const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      rangeStartDate: toIso(start),
      rangeEndDate: refDateStr,
      isValidRange: true,
    };
  }, [dateRangePreset, customStartDate, customEndDate, selectedDate]);

  // 2. Fetch Sessions for Range Reporting
  useEffect(() => {
    let isMounted = true;
    async function fetchRangeData() {
      if (activeMode !== 'history' || !isValidRange || historySelectedClasses.length === 0) {
        setRangeSessions([]);
        return;
      }
      setIsLoadingRange(true);
      setExportError(null);
      try {
        const sessions = await provider.getAttendanceSessionsInRange(
          rangeStartDate,
          rangeEndDate,
          historySelectedClasses
        );
        if (!isMounted) return;
        setRangeSessions(sessions.filter(s => s.status !== 'draft'));
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load range attendance sessions.';
        setExportError(msg);
      } finally {
        if (isMounted) setIsLoadingRange(false);
      }
    }

    fetchRangeData();
    return () => {
      isMounted = false;
    };
  }, [activeMode, isValidRange, rangeStartDate, rangeEndDate, historySelectedClasses, provider]);

  // Generate All Calendar Dates in Range for Matrix
  const calendarDatesInRange = useMemo(() => {
    if (!isValidRange || !rangeStartDate || !rangeEndDate) return [];
    const dates: string[] = [];
    const curr = new Date(`${rangeStartDate}T12:00:00Z`);
    const end = new Date(`${rangeEndDate}T12:00:00Z`);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [rangeStartDate, rangeEndDate, isValidRange]);

  // Fast action: Mark All Present
  const handleMarkAllPresent = () => {
    setAttendanceRows(prev =>
      prev.map(r => ({ ...r, state: 'present' as AttendanceState }))
    );
  };

  // State toggle for an individual student
  const handleStateChange = (studentId: string, newState: AttendanceState) => {
    setAttendanceRows(prev =>
      prev.map(r => (r.studentId === studentId ? { ...r, state: newState } : r))
    );
  };

  // Remarks change
  const handleRemarksChange = (studentId: string, remarks: string) => {
    setAttendanceRows(prev =>
      prev.map(r => (r.studentId === studentId ? { ...r, remarks } : r))
    );
  };

  // Live counters for Single-Day Register
  const totalCount = attendanceRows.length;
  const isSessionActuallySaved = existingSession && (existingSession.status === 'submitted' || existingSession.status === 'corrected');
  const presentCount = isSessionActuallySaved ? existingSession.presentCount : attendanceRows.filter(r => r.state === 'present').length;
  const absentCount = isSessionActuallySaved ? existingSession.absentCount : attendanceRows.filter(r => r.state === 'absent').length;
  const lateCount = isSessionActuallySaved ? existingSession.lateCount : attendanceRows.filter(r => r.state === 'late').length;
  const excusedCount = isSessionActuallySaved ? existingSession.excusedCount : attendanceRows.filter(r => r.state === 'excused').length;
  const attendanceRate = totalCount > 0 ? ((presentCount + lateCount) / totalCount) * 100 : 0;

  const today = getSchoolLocalDate();
  const daysDiff = useMemo(() => {
    const dToday = new Date(today).getTime();
    const dSel = new Date(selectedDate).getTime();
    return Math.floor((dToday - dSel) / (1000 * 3600 * 24));
  }, [today, selectedDate]);
  const isOlderThanWindow = daysDiff > 2;

  // Submit register
  const handleConfirmSubmit = async () => {
    if (!currentUser || !activeClass) return;

    if (isOlderThanWindow) {
      const changedWithoutReason = attendanceRows.filter(r => {
        const orig = originalStates[r.studentId];
        return orig !== undefined && orig !== r.state && !r.remarks?.trim();
      });

      if (changedWithoutReason.length > 0) {
        setError(`Add a reason to change attendance for an earlier date (${changedWithoutReason.length} modified record(s) need a reason).`);
        setIsConfirmModalOpen(false);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const savedSession = await provider.submitDailyAttendance(
        {
          classId: selectedClassId,
          date: selectedDate,
          academicYearId: 'year-2025-2026',
          records: attendanceRows.map(r => ({
            studentId: r.studentId,
            state: r.state,
            remarks: r.remarks,
          })),
        },
        currentUser
      );

      setExistingSession(savedSession);
      setIsConfirmModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit daily register.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Multi-select helpers for History Mode
  const handleToggleHistoryClass = (cId: string) => {
    if (!isPrincipal) return; // Teachers cannot toggle other sections
    setHistorySelectedClasses(prev =>
      prev.includes(cId) ? (prev.length > 1 ? prev.filter(id => id !== cId) : prev) : [...prev, cId]
    );
  };

  const handleSelectAllHistoryClasses = () => {
    if (!isPrincipal) return;
    setHistorySelectedClasses(availableClasses.map(c => c.id));
  };

  const handleClearHistoryClasses = () => {
    if (!isPrincipal) return;
    setHistorySelectedClasses([initialClassId || 'class-10-a']);
  };

  // Build Export & Matrix Data
  const { matrixStudents, submittedCoverageCount } = useMemo(() => {
    const studentMap = new Map<string, AttendanceRegisterExportRow>();

    // Load student entities for selected history classes
    historySelectedClasses.forEach(cId => {
      const cls = classes.find(c => c.id === cId);
      // If active single-day class is in list, use cached students
      if (cId === selectedClassId && attendanceRows.length > 0) {
        attendanceRows.forEach(row => {
          if (!studentMap.has(row.studentId)) {
            studentMap.set(row.studentId, {
              admissionNumber: row.admissionNumber,
              rollNumber: row.rollNumber,
              studentName: row.name,
              classLabel: cls?.label || cId,
              enrollmentDate: row.enrollmentDate,
              attendanceByDate: {},
            });
          }
        });
      }
    });

    // Populate saved records from rangeSessions
    const submittedSessionDays = new Set<string>();
    rangeSessions.forEach(session => {
      submittedSessionDays.add(session.date);
      session.records.forEach(rec => {
        let st = studentMap.get(rec.studentId);
        if (!st) {
          // Add student on the fly if not already mapped
          st = {
            admissionNumber: rec.studentId,
            rollNumber: rec.rollNumber,
            studentName: rec.studentName,
            classLabel: session.classLabel,
            attendanceByDate: {},
          };
          studentMap.set(rec.studentId, st);
        }
        st.attendanceByDate[session.date] = rec.state === 'present' ? 'P' :
          rec.state === 'absent' ? 'A' :
          rec.state === 'late' ? 'P' :
          rec.state === 'excused' ? 'LEAVE' : 'UNMARKED';
      });
    });

    const studentList = Array.from(studentMap.values()).sort((a, b) => {
      const classComp = a.classLabel.localeCompare(b.classLabel);
      if (classComp !== 0) return classComp;
      const rollA = typeof a.rollNumber === 'number' ? a.rollNumber : parseInt(String(a.rollNumber), 10) || 0;
      const rollB = typeof b.rollNumber === 'number' ? b.rollNumber : parseInt(String(b.rollNumber), 10) || 0;
      return rollA - rollB;
    });

    return {
      matrixStudents: studentList,
      submittedCoverageCount: rangeSessions.length,
    };
  }, [historySelectedClasses, classes, selectedClassId, attendanceRows, rangeSessions]);

  // Export Attendance to Excel (.xlsx) Handler
  const handleExportAttendanceExcel = () => {
    if (!isValidRange) {
      setExportError('Invalid Date Range: End Date cannot be earlier than Start Date.');
      return;
    }
    if (matrixStudents.length === 0 || calendarDatesInRange.length === 0) {
      setExportError('No students or calendar dates found in the selected scope.');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    try {
      const scopeLabel = historySelectedClasses.length === 1
        ? classes.find(c => c.id === historySelectedClasses[0])?.label.replace(/\s+/g, '_') || historySelectedClasses[0]
        : `MultiSection_${historySelectedClasses.length}_Classes`;

      const filename = `Attendance_${scopeLabel}_${rangeStartDate}_to_${rangeEndDate}.xlsx`;

      downloadAttendanceRegisterXlsx(filename, {
        scopeTitle: historySelectedClasses.map(cId => classes.find(c => c.id === cId)?.label || cId).join(', '),
        academicSessionLabel: '2025–2026',
        dateHeaders: calendarDatesInRange,
        students: matrixStudents,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export attendance workbook.';
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentUser || !selectedClassId || !canView) {
    return (
      <AccessDenied
        title="Attendance Register Access Restricted"
        message={
          currentUser?.role === 'subject_teacher'
            ? "Subject teachers can view aggregate attendance totals only. Individual attendance registers and Excel exports are restricted to assigned Class Teachers and Administration."
            : currentUser?.role === 'class_teacher'
            ? `Your assigned class is ${currentUser.assignedClassLabel || currentUser.assignedClassId || 'unassigned'}. You do not have authorization to view or mark attendance for another section.`
            : "You do not have authorization to access this attendance register."
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title={`Daily Attendance Register — ${activeClass?.label || (selectedClassId === 'class-10-a' ? 'Class 10-A' : 'Class Register')}`}
        subtitle={
          canMark
            ? `Class Teacher: ${currentUser.displayName || currentUser.name} • Morning roll call register and period attendance report for ${activeClass?.label || 'assigned section'}.`
            : `Class Teacher: ${activeClass?.classTeacherName || 'Assigned Teacher'} • Read-only administrative oversight for ${activeClass?.label || 'class'}.`
        }
        breadcrumbs={[
          { label: 'Campus' },
          { label: 'Attendance' },
          { label: activeClass?.label || 'Register' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {activeMode === 'daily' && canMark && (
              <>
                <button
                  onClick={handleMarkAllPresent}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={15} />
                  <span>Mark All Present</span>
                </button>
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="hhs-btn hhs-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={15} />
                  <span>Save & Submit Register</span>
                </button>
              </>
            )}
            {activeMode === 'history' && (
              <button
                onClick={handleExportAttendanceExcel}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                disabled={isExporting || !isValidRange || matrixStudents.length === 0}
              >
                <FileSpreadsheet size={16} />
                <span>{isExporting ? 'Generating Excel...' : 'Export Attendance to Excel'}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Mode Switcher Tabs */}
      <div
        className="hhs-card no-print"
        style={{
          padding: '8px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          backgroundColor: 'var(--hhs-surface)',
          borderRadius: 'var(--hhs-radius-container)',
        }}
      >
        <button
          onClick={() => setActiveMode('daily')}
          className={`hhs-btn hhs-btn-sm ${activeMode === 'daily' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
        >
          <Calendar size={14} />
          <span>Daily Roll Call Register</span>
        </button>
        <button
          onClick={() => setActiveMode('history')}
          className={`hhs-btn hhs-btn-sm ${activeMode === 'history' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
        >
          <Layers size={14} />
          <span>Attendance History & Excel Export</span>
        </button>
      </div>

      {error && <ErrorBanner title="Attendance Error" message={error} />}
      {exportError && <ErrorBanner title="Export Error" message={exportError} />}

      {/* ========================================================================= */}
      {/* MODE 1: DAILY ROLL CALL REGISTER */}
      {/* ========================================================================= */}
      {activeMode === 'daily' && (
        <>
          {/* Status Banner */}
          {isSessionActuallySaved ? (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--hhs-primary-light)',
                border: '1px solid #c9d8d3',
                color: 'var(--hhs-primary-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.86rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} color="var(--hhs-primary)" />
                <span>
                  <strong>Register Saved:</strong> Attendance for <strong>{activeClass?.label}</strong> on{' '}
                  <strong className="tnum">{selectedDate}</strong> is recorded and saved in repository.
                </span>
              </div>
              <span className="hhs-badge hhs-badge-primary">Recorded</span>
            </div>
          ) : (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--hhs-surface-muted)',
                border: '1px solid var(--hhs-border)',
                color: 'var(--hhs-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.86rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} color="var(--pop-tangerine-orange)" />
                <span>
                  {canMark ? (
                    <>
                      <strong>Morning Roll Call Pending:</strong> No attendance session has been finalized for{' '}
                      <strong>{activeClass?.label}</strong> on <strong className="tnum">{selectedDate}</strong>. Mark students below and click Finalize.
                    </>
                  ) : (
                    <>
                      <strong>Attendance Not Recorded:</strong> No attendance register has been submitted for{' '}
                      <strong>{activeClass?.label}</strong> on <strong className="tnum">{selectedDate}</strong>.
                    </>
                  )}
                </span>
              </div>
              <span className="hhs-badge hhs-badge-neutral">Unmarked</span>
            </div>
          )}

          {/* Controls & Live Counters */}
          <div
            className="hhs-card"
            style={{
              padding: '16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div>
                <label className="hhs-label" htmlFor="register-class" style={{ marginBottom: '4px' }}>
                  Select Class & Section
                </label>
                <select
                  id="register-class"
                  value={selectedClassId}
                  onChange={e => {
                    setSelectedClassId(e.target.value);
                    navigate(`/attendance/register/${e.target.value}`);
                  }}
                  className="hhs-select"
                  style={{ width: '180px' }}
                  disabled={currentUser.role === 'class_teacher'}
                >
                  {availableClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.studentCount} students)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="hhs-label" htmlFor="register-date" style={{ marginBottom: '4px' }}>
                  Attendance Date
                </label>
                <input
                  id="register-date"
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="hhs-input tnum"
                  style={{ width: '160px' }}
                />
              </div>
            </div>

            {/* Live Counters */}
            <div style={{ display: 'flex', gap: 'clamp(10px, 2vw, 16px)', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--pop-apple-green)' }}>
                  {isSessionActuallySaved ? presentCount : canMark ? presentCount : '—'}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
                  Present
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--pop-coral-red)' }}>
                  {isSessionActuallySaved ? absentCount : canMark ? absentCount : '—'}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
                  Absent
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--pop-tangerine-orange)' }}>
                  {isSessionActuallySaved ? lateCount : canMark ? lateCount : '—'}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
                  Late
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--pop-deep-violet)' }}>
                  {isSessionActuallySaved ? excusedCount : canMark ? excusedCount : '—'}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
                  Excused
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--hhs-border)', paddingLeft: '14px', textAlign: 'center' }}>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, color: isSessionActuallySaved ? 'var(--hhs-primary)' : 'var(--hhs-text-secondary)' }}>
                  {isSessionActuallySaved ? `${attendanceRate.toFixed(1)}%` : canMark ? `${attendanceRate.toFixed(1)}% (Draft)` : 'Unmarked'}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
                  Turnout
                </div>
              </div>
            </div>
          </div>

          {/* Roster Table */}
          {isLoading ? (
            <LoadingState message="Loading class attendance roster..." />
          ) : (
            <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="hhs-table" style={{ width: '100%', fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center' }}>Roll #</th>
                      <th style={{ minWidth: '180px' }}>Student Name</th>
                      <th style={{ width: '120px' }}>Admission #</th>
                      <th style={{ width: '320px', textAlign: 'center' }}>Attendance Marking</th>
                      <th>Remarks / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map(row => (
                      <tr key={row.studentId}>
                        <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>
                          {row.rollNumber}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>{row.name}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                            {row.admissionNumber}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {(['present', 'absent', 'late', 'excused'] as AttendanceState[]).map(state => {
                              const isSelected = row.state === state;
                              const colors: Record<AttendanceState, string> = {
                                present: 'var(--pop-apple-green)',
                                absent: 'var(--pop-coral-red)',
                                late: 'var(--pop-tangerine-orange)',
                                excused: 'var(--pop-deep-violet)',
                              };
                              return (
                                <button
                                  key={state}
                                  type="button"
                                  onClick={() => canMark && handleStateChange(row.studentId, state)}
                                  disabled={!canMark}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '14px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    border: isSelected ? `2px solid ${colors[state]}` : '1px solid var(--hhs-border)',
                                    backgroundColor: isSelected ? colors[state] : 'var(--hhs-surface)',
                                    color: isSelected ? '#FFFFFF' : 'var(--hhs-text-primary)',
                                    cursor: canMark ? 'pointer' : 'default',
                                    textTransform: 'capitalize',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  {state}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td>
                          {canMark ? (
                            <input
                              type="text"
                              value={row.remarks}
                              onChange={e => handleRemarksChange(row.studentId, e.target.value)}
                              placeholder="Optional remarks..."
                              className="hhs-input"
                              style={{ height: '30px', fontSize: '0.78rem' }}
                            />
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: row.remarks ? 'var(--hhs-text-primary)' : 'var(--hhs-text-secondary)' }}>
                              {row.remarks || '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: ATTENDANCE HISTORY & EXCEL EXPORT */}
      {/* ========================================================================= */}
      {activeMode === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* History Controls Bar */}
          <div className="hhs-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 className="hhs-headline-sm" style={{ margin: 0 }}>Attendance Report & Date Range Filters</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', margin: '2px 0 0' }}>
                  Filter attendance across multiple sections and download comprehensive Excel workbooks.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="hhs-badge hhs-badge-primary">
                  {academicYears.find(y => y.id === historyYearId)?.name || 'Session 2025–2026'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', alignItems: 'end' }}>
              {/* Date Range Preset Selector */}
              <div>
                <label className="hhs-label" style={{ marginBottom: '6px' }}>Date Range Period</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(['3m', '6m', '9m', 'custom'] as AttendanceRangePreset[]).map(preset => {
                    const labels: Record<AttendanceRangePreset, string> = {
                      '3m': 'Last 3 Months',
                      '6m': 'Last 6 Months',
                      '9m': 'Last 9 Months',
                      'custom': 'Custom Range',
                    };
                    const isSelected = dateRangePreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDateRangePreset(preset)}
                        className={`hhs-btn hhs-btn-sm ${isSelected ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                        style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      >
                        {labels[preset]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Date Pickers */}
              {dateRangePreset === 'custom' && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label className="hhs-label" htmlFor="custom-start" style={{ marginBottom: '4px' }}>Start Date</label>
                    <input
                      id="custom-start"
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="hhs-input tnum"
                      style={{ width: '140px', height: '34px', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label className="hhs-label" htmlFor="custom-end" style={{ marginBottom: '4px' }}>End Date</label>
                    <input
                      id="custom-end"
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="hhs-input tnum"
                      style={{ width: '140px', height: '34px', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Validation Alert for Custom Range */}
            {!isValidRange && (
              <div style={{ padding: '8px 12px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '0.82rem' }}>
                <strong>Validation Error:</strong> End date ({customEndDate}) cannot be earlier than start date ({customStartDate}).
              </div>
            )}

            {/* Section Multi-Select */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <span className="hhs-label" style={{ margin: 0 }}>
                  Authorized Class Scope ({historySelectedClasses.length} selected)
                </span>
                {isPrincipal && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleSelectAllHistoryClasses}
                      className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearHistoryClasses}
                      className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Class Checkboxes */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto', padding: '6px', backgroundColor: 'var(--hhs-canvas)', borderRadius: 'var(--hhs-radius-base)', border: '1px solid var(--hhs-border)' }}>
                {availableClasses.map(cls => {
                  const isSelected = historySelectedClasses.includes(cls.id);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => handleToggleHistoryClass(cls.id)}
                      disabled={!isPrincipal}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 700 : 500,
                        border: isSelected ? '1px solid var(--hhs-primary)' : '1px solid var(--hhs-border)',
                        backgroundColor: isSelected ? 'var(--hhs-primary-light)' : 'var(--hhs-surface)',
                        color: isSelected ? 'var(--hhs-primary)' : 'var(--hhs-text-primary)',
                        cursor: isPrincipal ? 'pointer' : 'default',
                      }}
                    >
                      {isSelected ? <CheckSquare size={13} color="var(--hhs-primary)" /> : <Square size={13} color="var(--hhs-text-secondary)" />}
                      <span>{cls.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Range Summary Card */}
          <div
            className="hhs-card"
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--hhs-surface)',
              borderLeft: '4px solid var(--hhs-primary)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <span className="hhs-label">Selected Scope</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--hhs-text-primary)', marginTop: '2px' }}>
                {historySelectedClasses.map(cId => classes.find(c => c.id === cId)?.label || cId).join(', ')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                {matrixStudents.length} eligible students mapped
              </div>
            </div>

            <div>
              <span className="hhs-label">Date Range Boundaries</span>
              <div className="tnum" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--hhs-text-primary)', marginTop: '2px' }}>
                {rangeStartDate} to {rangeEndDate}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                {calendarDatesInRange.length} total calendar days
              </div>
            </div>

            <div>
              <span className="hhs-label">Submitted Registers Coverage</span>
              <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--pop-apple-green)', marginTop: '2px' }}>
                {submittedCoverageCount} sessions
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                persisted daily muster entries
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                onClick={handleExportAttendanceExcel}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', width: '100%', justifyContent: 'center' }}
                disabled={isExporting || !isValidRange || matrixStudents.length === 0}
              >
                <FileSpreadsheet size={16} />
                <span>Export Attendance to Excel</span>
              </button>
            </div>
          </div>

          {/* Matrix Preview Table */}
          {isLoadingRange ? (
            <LoadingState message="Extracting multi-date attendance matrix records..." />
          ) : matrixStudents.length === 0 ? (
            <div className="hhs-card" style={{ padding: '36px', textAlign: 'center' }}>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                No attendance records or students available for the chosen date boundaries.
              </p>
            </div>
          ) : (
            <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--hhs-border)', backgroundColor: 'var(--hhs-surface-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                  Attendance Register Matrix Preview ({matrixStudents.length} Students × {calendarDatesInRange.length} Dates)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
                  Showing first 15 dates on-screen • Full date range included in Excel (.xlsx) export
                </span>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
                <table className="hhs-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--hhs-canvas)', zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '50px', textAlign: 'center' }}>S.#</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Roll</th>
                      <th style={{ minWidth: '160px' }}>Student Name</th>
                      {historySelectedClasses.length > 1 && <th style={{ width: '90px' }}>Class</th>}
                      {calendarDatesInRange.slice(0, 15).map(date => {
                        const parts = date.split('-');
                        const dLabel = `${parts[2]}/${parts[1]}`;
                        return (
                          <th key={date} className="numeric tnum" style={{ width: '55px', textAlign: 'center', padding: '6px 4px' }}>
                            {dLabel}
                          </th>
                        );
                      })}
                      {calendarDatesInRange.length > 15 && (
                        <th style={{ textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>...</th>
                      )}
                      <th className="numeric" style={{ width: '70px', textAlign: 'center' }}>Present</th>
                      <th className="numeric" style={{ width: '70px', textAlign: 'center' }}>Absent</th>
                      <th className="numeric" style={{ width: '75px', textAlign: 'center' }}>Turnout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixStudents.map((s, idx) => {
                      let p = 0;
                      let a = 0;
                      calendarDatesInRange.forEach(d => {
                        const st = s.attendanceByDate[d];
                        if (st === 'P') p++;
                        if (st === 'A') a++;
                      });
                      const rate = p + a > 0 ? `${Math.round((p / (p + a)) * 1000) / 10}%` : '—';

                      return (
                        <tr key={`${s.classLabel}-${s.rollNumber}-${idx}`}>
                          <td className="tnum" style={{ textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
                            {idx + 1}
                          </td>
                          <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>
                            {s.rollNumber}
                          </td>
                          <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                          {historySelectedClasses.length > 1 && (
                            <td style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>{s.classLabel}</td>
                          )}
                          {calendarDatesInRange.slice(0, 15).map(date => {
                            const status = s.enrollmentDate && s.enrollmentDate > date ? 'N/A' : s.attendanceByDate[date] || '—';
                            const badgeColor =
                              status === 'P' ? 'var(--pop-apple-green)' :
                              status === 'A' ? 'var(--pop-coral-red)' :
                              status === 'LEAVE' ? 'var(--pop-deep-violet)' :
                              status === 'N/A' ? 'var(--hhs-text-secondary)' : 'transparent';
                            return (
                              <td key={date} style={{ textAlign: 'center', padding: '6px 2px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: '24px',
                                    height: '20px',
                                    lineHeight: '20px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: status === '—' ? 'var(--hhs-text-secondary)' : '#FFFFFF',
                                    backgroundColor: badgeColor,
                                  }}
                                >
                                  {status}
                                </span>
                              </td>
                            );
                          })}
                          {calendarDatesInRange.length > 15 && (
                            <td style={{ textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>...</td>
                          )}
                          <td className="numeric tnum" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--pop-apple-green)' }}>
                            {p}
                          </td>
                          <td className="numeric tnum" style={{ textAlign: 'center', fontWeight: 700, color: a > 5 ? 'var(--pop-coral-red)' : 'inherit' }}>
                            {a}
                          </td>
                          <td className="numeric tnum" style={{ textAlign: 'center', fontWeight: 700 }}>
                            {rate}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title={`Confirm Attendance Submission — ${activeClass?.label}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p className="hhs-body-sm">
              You are about to record daily attendance for <strong>{activeClass?.label}</strong> on{' '}
              <strong className="tnum">{selectedDate}</strong>.
            </p>

            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--hhs-canvas)',
                border: '1px solid var(--hhs-border)',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                textAlign: 'center',
              }}
            >
              <div>
                <div className="tnum" style={{ fontWeight: 800, color: 'var(--pop-apple-green)' }}>{presentCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>Present</div>
              </div>
              <div>
                <div className="tnum" style={{ fontWeight: 800, color: 'var(--pop-coral-red)' }}>{absentCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>Absent</div>
              </div>
              <div>
                <div className="tnum" style={{ fontWeight: 800, color: 'var(--pop-tangerine-orange)' }}>{lateCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>Late</div>
              </div>
              <div>
                <div className="tnum" style={{ fontWeight: 800, color: 'var(--pop-deep-violet)' }}>{excusedCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>Excused</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="hhs-btn hhs-btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="hhs-btn hhs-btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Recording...' : 'Confirm & Save Attendance'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
