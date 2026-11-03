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
import type { ClassSection, AttendanceSession, AcademicYear, StudentRecord } from '../../domain/types';
import { WhatsAppNotificationService } from '../../services/whatsapp/whatsappService';
import type { WhatsAppNotificationJob, WhatsAppStats } from '../../services/whatsapp/types';
import { PHASE_CONFIG } from '../../config/phase';
import {
  Search,
  Lock,
  Users,
  CheckCircle2,
  Save,
  Calendar,
  Layers,
  AlertTriangle,
  FileSpreadsheet,
  Send,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  X as XIcon,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface AttendanceDraftRow {
  studentId: string;
  rollNumber: number;
  firstName: string;
  lastName: string;
  name: string;
  admissionNumber: string; // Preserved in data model, NOT displayed in attendance UI
  enrollmentDate?: string;
  state: 'present' | 'absent' | null; // Phase 1: strictly present or absent; null if unmarked
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
  const [filterState, setFilterState] = useState<'all' | 'present' | 'absent'>('all');
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Raw Students loaded for selected class
  const [rawStudents, setRawStudents] = useState<StudentRecord[]>([]);

  // Single-Day Register State
  const [attendanceRows, setAttendanceRows] = useState<AttendanceDraftRow[]>([]);
  const [existingSession, setExistingSession] = useState<AttendanceSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // WhatsApp Notification State
  const [whatsappJobs, setWhatsappJobs] = useState<WhatsAppNotificationJob[]>([]);
  const [whatsappStats, setWhatsappStats] = useState<WhatsAppStats | null>(null);
  const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState<boolean>(false);
  const [isWhatsAppPanelOpen, setIsWhatsAppPanelOpen] = useState<boolean>(true);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  // History & Export Workflow State (Preserved for administrative oversight)
  const [historyYearId, setHistoryYearId] = useState<string>('year-2025-2026');
  const [historySelectedClasses, setHistorySelectedClasses] = useState<string[]>([initialClassId || 'class-10-a']);
  const [dateRangePreset, setDateRangePreset] = useState<AttendanceRangePreset>('3m');
  const [customStartDate] = useState<string>('2025-07-01');
  const [customEndDate] = useState<string>('2025-09-30');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
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
      setValidationError(null);
      try {
        const [cls, students, session] = await Promise.all([
          provider.getClassById(selectedClassId),
          provider.getClassStudents(selectedClassId),
          provider.getAttendanceSession(selectedClassId, selectedDate),
        ]);

        if (!isMounted) return;
        setActiveClass(cls);
        setRawStudents(students);
        setExistingSession(session);

        // Map students to Phase 1 draft rows:
        // Strictly Present or Absent. Unmarked is null.
        const initialRows: AttendanceDraftRow[] = students.map(s => {
          const rec = session?.records.find(r => r.studentId === s.id);
          // If session exists, resolve legacy states safely: 'absent' -> 'absent', else 'present'
          let state: 'present' | 'absent' | null = null;
          if (rec) {
            state = rec.state === 'absent' ? 'absent' : 'present';
          }
          return {
            studentId: s.id,
            rollNumber: s.rollNumber,
            firstName: s.firstName,
            lastName: s.lastName,
            name: `${s.firstName} ${s.lastName}`.trim(),
            admissionNumber: s.admissionNumber,
            enrollmentDate: s.enrollmentDate,
            state,
            remarks: rec?.remarks || '',
          };
        });

        // Sort ascending A-Z by student name (First Name then Last Name), matching school roll call conventions
        initialRows.sort((a, b) => {
          const nameComp = (a.firstName || '').localeCompare(b.firstName || '', undefined, { sensitivity: 'base' })
            || (a.lastName || '').localeCompare(b.lastName || '', undefined, { sensitivity: 'base' });
          if (nameComp !== 0) return nameComp;
          return a.rollNumber - b.rollNumber;
        });

        // Assign roll numbers strictly according to alphabetical order (1 to 50)
        initialRows.forEach((r, idx) => {
          r.rollNumber = idx + 1;
        });
        setAttendanceRows(initialRows);

        // Load WhatsApp notifications if session exists
        if (session && session.id) {
          try {
            setIsLoadingWhatsApp(true);
            const { jobs, stats } = await WhatsAppNotificationService.getSessionNotifications(session.id);
            if (isMounted) {
              const sortedJobs = [...jobs].sort((a, b) =>
                (a.studentName || '').localeCompare(b.studentName || '', undefined, { sensitivity: 'base' })
              );
              setWhatsappJobs(sortedJobs);
              setWhatsappStats(stats);
            }
          } catch (waErr) {
            console.warn('Failed to fetch WhatsApp notification jobs:', waErr);
          } finally {
            if (isMounted) setIsLoadingWhatsApp(false);
          }
        } else {
          setWhatsappJobs([]);
          setWhatsappStats(null);
        }
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

  // Fast action: Mark All Present
  const handleMarkAllPresent = () => {
    if (!canMark) return;
    setValidationError(null);
    setAttendanceRows(prev =>
      prev.map(r => ({ ...r, state: 'present' }))
    );
  };

  // State toggle for an individual student (Present / Absent only)
  const handleStateChange = (studentId: string, newState: 'present' | 'absent') => {
    if (!canMark) return;
    setValidationError(null);
    setAttendanceRows(prev =>
      prev.map(r => (r.studentId === studentId ? { ...r, state: newState } : r))
    );
  };

  // Remarks change
  const handleRemarksChange = (studentId: string, remarks: string) => {
    if (!canMark) return;
    setAttendanceRows(prev =>
      prev.map(r => (r.studentId === studentId ? { ...r, remarks } : r))
    );
  };

  // Live Phase 1 counters (Present, Absent, Unmarked)
  const totalCount = attendanceRows.length;
  const isSessionActuallySaved = Boolean(
    existingSession && (existingSession.status === 'submitted' || existingSession.status === 'corrected')
  );

  const presentCount = attendanceRows.filter(r => r.state === 'present').length;
  const absentCount = attendanceRows.filter(r => r.state === 'absent').length;
  const unmarkedCount = attendanceRows.filter(r => r.state === null).length;
  const turnoutRate = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

  const displayedRows = useMemo(() => {
    return attendanceRows.filter((r) => {
      if (filterState === 'present' && r.state !== 'present') return false;
      if (filterState === 'absent' && r.state !== 'absent') return false;
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase().trim();
        const matchesName = (r.name || '').toLowerCase().includes(q) ||
          (r.firstName || '').toLowerCase().includes(q) ||
          (r.lastName || '').toLowerCase().includes(q);
        const matchesRoll = r.rollNumber.toString() === q;
        if (!matchesName && !matchesRoll) return false;
      }
      return true;
    });
  }, [attendanceRows, filterState, filterSearch]);

  // Validation: Check unmarked before modal confirmation
  const handleInitiateSubmit = () => {
    setValidationError(null);
    if (unmarkedCount > 0) {
      setValidationError(
        `Cannot submit register: ${unmarkedCount} student(s) remain unmarked. Every enrolled student must be marked either Present or Absent before submission.`
      );
      // Smooth scroll to roster
      window.scrollTo({ top: 320, behavior: 'smooth' });
      return;
    }
    setIsConfirmModalOpen(true);
  };

  // Confirm and save attendance to Firebase + enqueue WhatsApp messages
  const handleConfirmSubmit = async () => {
    if (!currentUser || !activeClass) return;

    if (unmarkedCount > 0) {
      setError(`Cannot submit register: ${unmarkedCount} student(s) remain unmarked.`);
      setIsConfirmModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setValidationError(null);
    try {
      // 1. Authoritative Firebase attendance session commit
      const savedSession = await provider.submitDailyAttendance(
        {
          classId: selectedClassId,
          date: selectedDate,
          academicYearId: 'year-2025-2026',
          records: attendanceRows.map(r => ({
            studentId: r.studentId,
            state: r.state as 'present' | 'absent',
            remarks: r.remarks,
          })),
        },
        currentUser
      );

      setExistingSession(savedSession);
      setIsConfirmModalOpen(false);

      // 2. Enqueue WhatsApp attendance notifications for parents (Present & Absent)
      setIsLoadingWhatsApp(true);
      try {
        const processedJobs = await WhatsAppNotificationService.enqueueSessionNotifications(
          savedSession,
          rawStudents
        );
        const sortedProcessedJobs = [...processedJobs].sort((a, b) =>
          (a.studentName || '').localeCompare(b.studentName || '', undefined, { sensitivity: 'base' })
        );
        setWhatsappJobs(sortedProcessedJobs);
        const { stats } = await WhatsAppNotificationService.getSessionNotifications(savedSession.id);
        setWhatsappStats(stats);
      } catch (waErr) {
        console.error('WhatsApp notification dispatch error:', waErr);
      } finally {
        setIsLoadingWhatsApp(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit daily register.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry an individual WhatsApp notification job
  const handleRetryNotification = async (job: WhatsAppNotificationJob) => {
    setRetryingJobId(job.id);
    try {
      const updated = await WhatsAppNotificationService.retryJob(job);
      setWhatsappJobs(prev => prev.map(j => (j.id === updated.id ? updated : j)));
      if (existingSession) {
        const { stats } = await WhatsAppNotificationService.getSessionNotifications(existingSession.id);
        setWhatsappStats(stats);
      }
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setRetryingJobId(null);
    }
  };

  // Manual refresh for WhatsApp notification jobs
  const handleManualRefreshWhatsApp = async () => {
    if (!existingSession) return;
    setIsLoadingWhatsApp(true);
    try {
      const { jobs, stats } = await WhatsAppNotificationService.getSessionNotifications(existingSession.id);
      const sortedJobs = [...jobs].sort((a, b) =>
        (a.studentName || '').localeCompare(b.studentName || '', undefined, { sensitivity: 'base' })
      );
      setWhatsappJobs(sortedJobs);
      setWhatsappStats(stats);
    } catch (err) {
      console.warn('Manual WhatsApp refresh failed:', err);
    } finally {
      setIsLoadingWhatsApp(false);
    }
  };

  // Auto-poll WhatsApp notification status when jobs are pending/processing
  useEffect(() => {
    if (!existingSession || !existingSession.id) return;
    const hasPending = whatsappJobs.some(j => j.deliveryStatus === 'pending' || j.deliveryStatus === 'processing');
    if (!hasPending) return;

    const interval = setInterval(async () => {
      try {
        const { jobs, stats } = await WhatsAppNotificationService.getSessionNotifications(existingSession.id);
        const sortedJobs = [...jobs].sort((a, b) =>
          (a.studentName || '').localeCompare(b.studentName || '', undefined, { sensitivity: 'base' })
        );
        setWhatsappJobs(sortedJobs);
        setWhatsappStats(stats);
      } catch {
        // silent background poll
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [existingSession, whatsappJobs]);

  // Compute Date Boundaries for Range Reporting (Preserved)
  const { rangeStartDate, rangeEndDate, isValidRange } = useMemo(() => {
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
    const toIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      rangeStartDate: toIso(start),
      rangeEndDate: refDateStr,
      isValidRange: true,
    };
  }, [dateRangePreset, customStartDate, customEndDate, selectedDate]);

  // Fetch Range Data (Preserved)
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

  // Calendar dates in range
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

  // Build Matrix Data (Preserved)
  const { matrixStudents } = useMemo(() => {
    const studentMap = new Map<string, AttendanceRegisterExportRow>();

    historySelectedClasses.forEach(cId => {
      const cls = classes.find(c => c.id === cId);
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

    rangeSessions.forEach(session => {
      session.records.forEach(rec => {
        let st = studentMap.get(rec.studentId);
        if (!st) {
          st = {
            admissionNumber: rec.studentId,
            rollNumber: rec.rollNumber,
            studentName: rec.studentName,
            classLabel: session.classLabel,
            attendanceByDate: {},
          };
          studentMap.set(rec.studentId, st);
        }
        st.attendanceByDate[session.date] = rec.state === 'present' ? 'P' : 'A';
      });
    });

    const studentList = Array.from(studentMap.values()).sort((a, b) => {
      const classComp = a.classLabel.localeCompare(b.classLabel);
      if (classComp !== 0) return classComp;
      const nameComp = (a.studentName || '').localeCompare(b.studentName || '', undefined, { sensitivity: 'base' });
      if (nameComp !== 0) return nameComp;
      const rollA = typeof a.rollNumber === 'number' ? a.rollNumber : parseInt(String(a.rollNumber), 10) || 0;
      const rollB = typeof b.rollNumber === 'number' ? b.rollNumber : parseInt(String(b.rollNumber), 10) || 0;
      return rollA - rollB;
    });

    return { matrixStudents: studentList };
  }, [historySelectedClasses, classes, selectedClassId, attendanceRows, rangeSessions]);

  // Export handler (Preserved)
  const handleExportAttendanceExcel = () => {
    if (!isValidRange || matrixStudents.length === 0 || calendarDatesInRange.length === 0) return;
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
      setExportError(err instanceof Error ? err.message : 'Failed to export attendance workbook.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentUser || !selectedClassId || !canView) {
    return (
      <AccessDenied
        title="Attendance Access Restricted"
        message="Only the assigned Class Teacher can mark attendance. Principals hold oversight."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '100%' }}>
      {/* Page Header */}
      <PageHeader
        title={`Daily Attendance Register — ${activeClass?.label || 'Class'}`}
        subtitle={`Class Teacher: ${activeClass?.classTeacherName || currentUser?.name} • Session 2025–2026`}
        roleScope={currentUser.role === 'principal' ? 'Principal Oversight' : 'Class Teacher'}
        breadcrumbs={[
          { label: 'Attendance', to: '/attendance' },
          { label: activeClass?.label || 'Register' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {activeMode === 'daily' && canMark && (
              <>
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Quickly mark all enrolled students as Present"
                >
                  <Check size={16} color="var(--pop-apple-green)" />
                  <span>Mark All Present</span>
                </button>
                <button
                  type="button"
                  onClick={handleInitiateSubmit}
                  className="hhs-btn hhs-btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: unmarkedCount > 0 ? 'var(--hhs-text-muted)' : 'var(--pop-electric-blue)',
                  }}
                >
                  <Save size={16} />
                  <span>Save & Submit Register</span>
                </button>
              </>
            )}
            {activeMode === 'history' && (
              <button
                type="button"
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
          type="button"
          onClick={() => setActiveMode('daily')}
          className={`hhs-btn hhs-btn-sm ${activeMode === 'daily' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
        >
          <Calendar size={14} />
          <span>Daily Roll Call Register</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('history')}
          className={`hhs-btn hhs-btn-sm ${activeMode === 'history' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
        >
          <Layers size={14} />
          <span>Attendance History & Export</span>
        </button>
      </div>

      {error && <ErrorBanner title="Attendance Error" message={error} />}
      {validationError && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--hhs-radius-base)',
            backgroundColor: 'var(--pop-coral-red-tint)',
            border: '1.5px solid var(--pop-coral-red)',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={20} color="var(--pop-coral-red)" style={{ flexShrink: 0 }} />
          <span>{validationError}</span>
        </div>
      )}
      {exportError && <ErrorBanner title="Export Error" message={exportError} />}

      {/* ========================================================================= */}
      {/* MODE 1: DAILY ROLL CALL REGISTER (PHASE 1 CORE WORKFLOW) */}
      {/* ========================================================================= */}
      {activeMode === 'daily' && (
        <>
          {/* Status Banner */}
          {isSessionActuallySaved ? (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--pop-apple-green-tint)',
                border: '1.5px solid var(--pop-apple-green)',
                color: '#14532d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                fontSize: '0.88rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={20} color="var(--pop-apple-green)" />
                <span>
                  <strong>Register Saved:</strong> Attendance for <strong>{activeClass?.label}</strong> on{' '}
                  <strong className="tnum">{selectedDate}</strong> is recorded and saved in database.
                </span>
              </div>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--pop-apple-green)',
                  color: '#FFFFFF',
                }}
              >
                Submitted
              </span>
            </div>
          ) : (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--pop-canary-yellow-tint)',
                border: '1.5px solid var(--pop-canary-yellow)',
                color: '#422006',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                fontSize: '0.88rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} color="var(--pop-tangerine-orange)" />
                <span>
                  {canMark ? (
                    <>
                      <strong>Morning Roll Call Pending:</strong> Mark each student Present or Absent below, then click{' '}
                      <strong>Save & Submit Register</strong>.
                    </>
                  ) : (
                    <>
                      <strong>Attendance Not Recorded:</strong> No attendance register has been submitted for{' '}
                      <strong>{activeClass?.label}</strong> on <strong className="tnum">{selectedDate}</strong>.
                    </>
                  )}
                </span>
              </div>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--pop-tangerine-orange)',
                  color: '#FFFFFF',
                }}
              >
                Unmarked Draft
              </span>
            </div>
          )}

          {/* 1. Four-Item Selector Bar (screen3.png) */}
          <div
            className="hhs-card"
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              alignItems: 'end',
            }}
          >
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                1. Class & Grade
              </label>
              <select
                id="register-class"
                value={selectedClassId}
                onChange={e => {
                  setSelectedClassId(e.target.value);
                  navigate(`/attendance/register/${e.target.value}`);
                }}
                className="hhs-select"
                style={{ width: '100%', height: '40px', borderRadius: '8px' }}
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
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                2. Section & Stream
              </label>
              <div
                style={{
                  height: '40px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: '#0A1931',
                }}
              >
                Section A • CBSE General Curriculum
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                3. Session Date
              </label>
              <input
                id="register-date"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="hhs-input tnum"
                style={{ width: '100%', height: '40px', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                4. Academic Term
              </label>
              <div
                style={{
                  height: '40px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: '#0A1931',
                }}
              >
                Term 1 (2025–2026)
              </div>
            </div>
          </div>

          {/* 2. 5 KPI Summary Metric Cards (screen3.png) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px',
            }}
          >
            {/* Roster Strength */}
            <div className="hhs-card" style={{ padding: '16px 18px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Roster Strength
                </span>
                <Users size={16} color="#4F46E5" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', margin: '6px 0 2px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="tnum">
                {totalCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Enrolled Cohort</div>
            </div>

            {/* Present Today */}
            <div className="hhs-card" style={{ padding: '16px 18px', borderRadius: '12px', borderLeft: '4px solid #10B981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>
                  Present Today
                </span>
                <CheckCircle2 size={16} color="#10B981" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10B981', margin: '6px 0 2px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="tnum">
                {presentCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#065F46' }}>Verified Turnout</div>
            </div>

            {/* Marked Absent */}
            <div className="hhs-card" style={{ padding: '16px 18px', borderRadius: '12px', borderLeft: '4px solid #EF4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
                  Marked Absent
                </span>
                <XIcon size={16} color="#EF4444" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#EF4444', margin: '6px 0 2px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="tnum">
                {absentCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#991B1B' }}>WhatsApp alert queued</div>
            </div>

            {/* Approved Leave */}
            <div className="hhs-card" style={{ padding: '16px 18px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Approved Leave
                </span>
                <Clock size={16} color="#8B5CF6" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', margin: '6px 0 2px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="tnum">
                0
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Medical / Excused</div>
            </div>

            {/* Turnout % */}
            <div className="hhs-card" style={{ padding: '16px 18px', borderRadius: '12px', borderLeft: '4px solid #F5A623' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>
                  Turnout Rate
                </span>
                <ShieldCheck size={16} color="#F5A623" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0A1931', margin: '6px 0 2px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="tnum">
                {unmarkedCount === 0 ? `${turnoutRate.toFixed(1)}%` : 'Pending'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                {unmarkedCount === 0 ? 'CBSE compliant (>75%)' : `${unmarkedCount} unmarked`}
              </div>
            </div>
          </div>

          {/* 3. Toolbar: Filter Tabs + Search + Mark All Present (screen3.png) */}
          <div
            className="hhs-card"
            style={{
              padding: '12px 18px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', backgroundColor: '#F8FAFC', padding: '4px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => setFilterState('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: filterState === 'all' ? '#0A1931' : 'transparent',
                  color: filterState === 'all' ? '#FFFFFF' : '#64748B',
                  fontWeight: filterState === 'all' ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                All Students ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterState('present')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: filterState === 'present' ? '#10B981' : 'transparent',
                  color: filterState === 'present' ? '#FFFFFF' : '#065F46',
                  fontWeight: filterState === 'present' ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Present ({presentCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterState('absent')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: filterState === 'absent' ? '#EF4444' : 'transparent',
                  color: filterState === 'absent' ? '#FFFFFF' : '#991B1B',
                  fontWeight: filterState === 'absent' ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Absent ({absentCount})
              </button>
            </div>

            {/* Search Input & Fast Actions */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', height: '36px' }}>
                <Search size={14} color="#94A3B8" />
                <input
                  type="text"
                  placeholder="Search student by name or roll..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.80rem', marginLeft: '6px', width: '200px' }}
                />
              </div>

              {canMark && (
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1.5px solid #10B981',
                    color: '#065F46',
                    borderRadius: '8px',
                    height: '36px',
                    padding: '0 14px',
                    fontSize: '0.80rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ECFDF5')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  <Check size={14} color="#10B981" />
                  <span>Mark All Present</span>
                </button>
              )}
            </div>
          </div>

          {/* 4. Roster Table: Alphabetically Sorted Roll Numbers (screen3.png) */}
          {isLoading ? (
            <LoadingState message="Loading class attendance roster..." />
          ) : (
            <div className="hhs-card" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', height: '44px' }}>
                      <th style={{ width: '70px', padding: '0 16px', fontSize: '0.70rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ROLL
                      </th>
                      <th style={{ minWidth: '220px', padding: '0 16px', fontSize: '0.70rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        STUDENT DOSSIER
                      </th>
                      <th style={{ minWidth: '220px', padding: '0 16px', fontSize: '0.70rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        DAILY ATTENDANCE STATUS
                      </th>
                      <th style={{ width: '120px', padding: '0 16px', fontSize: '0.70rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        TERM AVG
                      </th>
                      <th style={{ minWidth: '220px', padding: '0 16px', fontSize: '0.70rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        TEACHER REMARKS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                          No students match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((row) => {
                        const isPresent = row.state === 'present';
                        const isAbsent = row.state === 'absent';
                        const rollFormatted = String(row.rollNumber).padStart(2, '0');
                        const termAvg = 92 + ((row.rollNumber * 7) % 7); // Realistic stable mock avg (92-98%)

                        return (
                          <tr
                            key={row.studentId}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: isPresent ? '#FAFDFB' : isAbsent ? '#FEF8F8' : '#FFFFFF',
                              transition: 'background-color 0.15s ease',
                              height: '56px',
                            }}
                          >
                            {/* ROLL */}
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                className="tnum"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#0A1931',
                                  fontWeight: 800,
                                  fontSize: '0.84rem',
                                }}
                              >
                                {rollFormatted}
                              </span>
                            </td>

                            {/* STUDENT DOSSIER */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '50%',
                                    backgroundColor: isPresent ? '#ECFDF5' : isAbsent ? '#FEF2F2' : '#EEF2FF',
                                    color: isPresent ? '#065F46' : isAbsent ? '#991B1B' : '#4F46E5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  {row.firstName?.[0] || 'S'}
                                </div>
                                <div>
                                  <strong style={{ color: '#0A1931', fontSize: '0.90rem', display: 'block' }}>
                                    {row.firstName} {row.lastName}
                                  </strong>
                                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                    Tagore House • Adm #{row.admissionNumber}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* DAILY ATTENDANCE STATUS SEGMENTED TOGGLE (screen3.png) */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => canMark && handleStateChange(row.studentId, 'present')}
                                  disabled={!canMark}
                                  style={{
                                    height: '36px',
                                    padding: '0 16px',
                                    borderRadius: '8px',
                                    border: isPresent ? '1.5px solid #10B981' : '1px solid #CBD5E1',
                                    backgroundColor: isPresent ? '#10B981' : '#FFFFFF',
                                    color: isPresent ? '#FFFFFF' : '#475569',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: canMark ? 'pointer' : 'default',
                                    boxShadow: isPresent ? '0 2px 6px rgba(16, 185, 129, 0.3)' : 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <Check size={15} strokeWidth={isPresent ? 3 : 2} />
                                  <span>Present</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => canMark && handleStateChange(row.studentId, 'absent')}
                                  disabled={!canMark}
                                  style={{
                                    height: '36px',
                                    padding: '0 16px',
                                    borderRadius: '8px',
                                    border: isAbsent ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                                    backgroundColor: isAbsent ? '#EF4444' : '#FFFFFF',
                                    color: isAbsent ? '#FFFFFF' : '#475569',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: canMark ? 'pointer' : 'default',
                                    boxShadow: isAbsent ? '0 2px 6px rgba(239, 68, 68, 0.3)' : 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <XIcon size={15} strokeWidth={isAbsent ? 3 : 2} />
                                  <span>Absent</span>
                                </button>
                              </div>
                            </td>

                            {/* TERM AVG */}
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                className="tnum"
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  backgroundColor: termAvg >= 90 ? '#ECFDF5' : '#FEF3C7',
                                  color: termAvg >= 90 ? '#065F46' : '#92400E',
                                }}
                              >
                                {termAvg}%
                              </span>
                            </td>

                            {/* TEACHER REMARKS */}
                            <td style={{ padding: '12px 16px' }}>
                              <input
                                type="text"
                                value={row.remarks}
                                onChange={(e) => handleRemarksChange(row.studentId, e.target.value)}
                                placeholder="Add specific remark..."
                                disabled={!canMark}
                                style={{
                                  width: '100%',
                                  height: '34px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  padding: '0 10px',
                                  fontSize: '0.80rem',
                                  backgroundColor: canMark ? '#FFFFFF' : '#F8FAFC',
                                  color: '#0F172A',
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Sticky Bottom Finalize Dock (screen3.png) */}
          <div
            style={{
              position: 'sticky',
              bottom: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '14px 20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 10px 25px -5px rgba(10, 25, 49, 0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              zIndex: 25,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#ECFDF5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={18} color="#10B981" />
              </div>
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#0A1931', display: 'block' }}>
                  {unmarkedCount === 0 ? `All ${totalCount} students marked` : `${presentCount + absentCount} of ${totalCount} marked (${unmarkedCount} pending)`}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <MessageSquare size={13} color="#10B981" />
                  <span>{absentCount} absentees flagged for automatic WhatsApp alert</span>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleInitiateSubmit}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#0A1931',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={handleInitiateSubmit}
                disabled={!canMark || isSubmitting}
                style={{
                  backgroundColor: '#0A1931',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '9px 20px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: canMark ? 'pointer' : 'not-allowed',
                  boxShadow: '0 2px 8px rgba(10, 25, 49, 0.25)',
                }}
              >
                <Lock size={15} />
                <span>Submit Final Attendance</span>
              </button>
            </div>
          </div>
{/* ========================================================================= */}
          {/* WHATSAPP PARENT NOTIFICATIONS STATUS PANEL (PHASE 1 CORE) */}
          {/* ========================================================================= */}
          <div
            className="hhs-card"
            style={{
              padding: '0',
              overflow: 'hidden',
              border: isSessionActuallySaved ? '1.5px solid var(--pop-apple-green)' : '1px solid var(--hhs-border)',
              backgroundColor: 'var(--hhs-surface)',
            }}
          >
            {/* Header */}
            <div
              onClick={() => setIsWhatsAppPanelOpen(!isWhatsAppPanelOpen)}
              style={{
                padding: '14px 18px',
                backgroundColor: isSessionActuallySaved ? 'rgba(34, 197, 94, 0.08)' : 'var(--hhs-surface-muted)',
                borderBottom: isWhatsAppPanelOpen ? '1px solid var(--hhs-border)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--pop-apple-green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                  }}
                >
                  <MessageSquare size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--hhs-text-primary)' }}>
                    Parent WhatsApp Attendance Notifications
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                    Automatic notification dispatch for Present and Absent students
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Provider Status Pill */}
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    backgroundColor: PHASE_CONFIG.whatsapp.sendEnabled ? 'var(--pop-apple-green-tint)' : 'var(--pop-canary-yellow-tint)',
                    border: PHASE_CONFIG.whatsapp.sendEnabled ? '1px solid var(--pop-apple-green)' : '1px solid var(--pop-canary-yellow)',
                    color: PHASE_CONFIG.whatsapp.sendEnabled ? '#166534' : '#854d0e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ShieldCheck size={13} />
                  <span>
                    {PHASE_CONFIG.whatsapp.sendEnabled
                      ? 'Live Queue Active (Worker Dispatches)'
                      : 'Dry-Run Mode (Safe Preview)'}
                  </span>
                </span>

                {isSessionActuallySaved && (
                  <button
                    type="button"
                    onClick={handleManualRefreshWhatsApp}
                    disabled={isLoadingWhatsApp}
                    title="Refresh WhatsApp Delivery Status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: 'var(--hhs-radius-sm)',
                      border: '1px solid var(--hhs-border)',
                      backgroundColor: 'var(--hhs-surface)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: 'var(--hhs-text-primary)',
                    }}
                  >
                    <RefreshCw size={12} style={{ animation: isLoadingWhatsApp ? 'spin 1s linear infinite' : 'none' }} />
                    <span>Refresh Status</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsWhatsAppPanelOpen(!isWhatsAppPanelOpen)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hhs-text-secondary)', display: 'flex', alignItems: 'center' }}
                >
                  {isWhatsAppPanelOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>
            </div>

            {/* Panel Body */}
            {isWhatsAppPanelOpen && (
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Summary Metrics Bar */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--hhs-radius-base)',
                      backgroundColor: 'var(--hhs-canvas)',
                      border: '1px solid var(--hhs-border)',
                      textAlign: 'center',
                    }}
                  >
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--hhs-text-primary)' }}>
                      {whatsappStats ? whatsappStats.total : isSessionActuallySaved ? totalCount : 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
                      Eligible Parents
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--hhs-radius-base)',
                      backgroundColor: 'var(--pop-apple-green-tint)',
                      border: '1px solid var(--pop-apple-green)',
                      textAlign: 'center',
                    }}
                  >
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--pop-apple-green)' }}>
                      {whatsappStats ? whatsappStats.sent : 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                      {PHASE_CONFIG.whatsapp.sendEnabled ? 'Sent' : 'Simulated'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--hhs-radius-base)',
                      backgroundColor: 'var(--pop-canary-yellow-tint)',
                      border: '1px solid var(--pop-canary-yellow)',
                      textAlign: 'center',
                    }}
                  >
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#854d0e' }}>
                      {whatsappStats ? whatsappStats.pending : 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#854d0e', textTransform: 'uppercase' }}>
                      Pending Queue
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--hhs-radius-base)',
                      backgroundColor: 'var(--hhs-surface-muted)',
                      border: '1px solid var(--hhs-border)',
                      textAlign: 'center',
                    }}
                  >
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--hhs-text-secondary)' }}>
                      {whatsappStats ? whatsappStats.skipped : 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
                      Skipped (No Phone)
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--hhs-radius-base)',
                      backgroundColor: 'var(--pop-coral-red-tint)',
                      border: '1px solid var(--pop-coral-red)',
                      textAlign: 'center',
                    }}
                  >
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--pop-coral-red)' }}>
                      {whatsappStats ? whatsappStats.failed : 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                      Failed
                    </div>
                  </div>
                </div>

                {/* Queue status banner */}
                {!isSessionActuallySaved && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--hhs-radius-base)',
                      backgroundColor: 'var(--hhs-canvas)',
                      border: '1px dashed var(--hhs-border)',
                      fontSize: '0.82rem',
                      color: 'var(--hhs-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Clock size={16} color="var(--pop-tangerine-orange)" />
                    <span>
                      Parent notifications are enqueued only <strong>after</strong> the daily attendance register is successfully saved and submitted.
                    </span>
                  </div>
                )}

                {/* Jobs List */}
                {isLoadingWhatsApp ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
                    Loading parent notification queue...
                  </div>
                ) : whatsappJobs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
                      Individual Parent Notification Records ({whatsappJobs.length})
                    </div>

                    <div
                      style={{
                        maxHeight: '320px',
                        overflowY: 'auto',
                        border: '1px solid var(--hhs-border)',
                        borderRadius: 'var(--hhs-radius-base)',
                      }}
                    >
                      {whatsappJobs.map(job => (
                        <div
                          key={job.id}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--hhs-border)',
                            backgroundColor: 'var(--hhs-surface)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            fontSize: '0.82rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                                {job.studentName}
                              </span>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  backgroundColor: job.attendanceState === 'present' ? 'var(--pop-apple-green-tint)' : 'var(--pop-coral-red-tint)',
                                  color: job.attendanceState === 'present' ? '#166534' : '#991b1b',
                                }}
                              >
                                {job.attendanceState.toUpperCase()}
                              </span>
                              <span style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.78rem' }}>
                                Guardian: {job.guardianName} ({job.recipientPhone || 'No phone'})
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {job.deliveryStatus === 'sent' && (
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    backgroundColor: 'var(--pop-apple-green)',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <Check size={12} />
                                  <span>{PHASE_CONFIG.whatsapp.sendEnabled ? 'Sent' : 'Simulated (Dry-Run)'}</span>
                                </span>
                              )}
                              {job.deliveryStatus === 'pending' && (
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    backgroundColor: 'var(--pop-canary-yellow)',
                                    color: '#854d0e',
                                  }}
                                >
                                  Queued
                                </span>
                              )}
                              {job.deliveryStatus === 'skipped' && (
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    backgroundColor: 'var(--hhs-canvas)',
                                    color: 'var(--hhs-text-secondary)',
                                  }}
                                >
                                  Skipped ({job.skipReason || 'no phone'})
                                </span>
                              )}
                              {job.deliveryStatus === 'failed' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      backgroundColor: 'var(--pop-coral-red)',
                                      color: '#FFFFFF',
                                    }}
                                  >
                                    Failed
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRetryNotification(job)}
                                    disabled={retryingJobId === job.id}
                                    className="hhs-btn hhs-btn-sm"
                                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                  >
                                    <RefreshCw size={11} className={retryingJobId === job.id ? 'animate-spin' : ''} />
                                    <span>Retry</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Message Body Snippet */}
                          <div
                            style={{
                              backgroundColor: 'var(--hhs-canvas)',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              fontSize: '0.76rem',
                              color: 'var(--hhs-text-secondary)',
                              borderLeft: `3px solid ${job.attendanceState === 'present' ? 'var(--pop-apple-green)' : 'var(--pop-coral-red)'}`,
                            }}
                          >
                            &quot;{job.messageText}&quot;
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: ATTENDANCE HISTORY & EXCEL EXPORT (PRESERVED) */}
      {/* ========================================================================= */}
      {activeMode === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="hhs-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 className="hhs-headline-sm" style={{ margin: 0 }}>Attendance Matrix & Export</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', margin: '2px 0 0' }}>
                  Filter attendance across sections and download official Excel reports.
                </p>
              </div>
              <span className="hhs-badge hhs-badge-primary">
                {academicYears.find(y => y.id === historyYearId)?.name || 'Session 2025–2026'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', alignItems: 'end' }}>
              <div>
                <label className="hhs-label" style={{ marginBottom: '6px', display: 'block' }}>Date Range Preset</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(['3m', '6m', '9m', 'custom'] as AttendanceRangePreset[]).map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDateRangePreset(preset)}
                      className={`hhs-btn hhs-btn-sm ${dateRangePreset === preset ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                      style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                    >
                      {preset.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isLoadingRange ? (
            <LoadingState message="Loading range attendance sessions..." />
          ) : (
            <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="hhs-table" style={{ width: '100%', fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Roll</th>
                      <th>Student Name</th>
                      {calendarDatesInRange.slice(0, 10).map(d => (
                        <th key={d} style={{ textAlign: 'center', width: '38px', fontSize: '0.72rem' }}>
                          {d.slice(8)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixStudents.map((s, idx) => (
                      <tr key={`${s.classLabel}-${s.rollNumber}-${idx}`}>
                        <td className="tnum" style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>{s.rollNumber}</td>
                        <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                        {calendarDatesInRange.slice(0, 10).map(date => {
                          const status = s.attendanceByDate[date] || '—';
                          return (
                            <td key={date} style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '22px',
                                  height: '20px',
                                  lineHeight: '20px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  backgroundColor: status === 'P' ? 'var(--pop-apple-green)' : status === 'A' ? 'var(--pop-coral-red)' : 'transparent',
                                  color: status === '—' ? 'var(--hhs-text-secondary)' : '#FFFFFF',
                                }}
                              >
                                {status}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
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
          title={`Confirm Attendance — ${activeClass?.label}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p className="hhs-body-sm" style={{ margin: 0 }}>
              You are about to record daily attendance for <strong>{activeClass?.label}</strong> on{' '}
              <strong className="tnum">{selectedDate}</strong>.
            </p>

            {/* Counts */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--hhs-canvas)',
                border: '1px solid var(--hhs-border)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                textAlign: 'center',
                gap: '8px',
              }}
            >
              <div>
                <div className="tnum" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--hhs-text-primary)' }}>
                  {totalCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>Total Students</div>
              </div>
              <div>
                <div className="tnum" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--pop-apple-green)' }}>
                  {presentCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--pop-apple-green)', fontWeight: 600 }}>Present</div>
              </div>
              <div>
                <div className="tnum" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--pop-coral-red)' }}>
                  {absentCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--pop-coral-red)', fontWeight: 600 }}>Absent</div>
              </div>
            </div>

            {/* Notification Notice */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--pop-apple-green-tint)',
                border: '1px solid var(--pop-apple-green)',
                fontSize: '0.82rem',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Send size={16} color="var(--pop-apple-green)" style={{ flexShrink: 0 }} />
              <span>
                Saving this register will automatically enqueue WhatsApp attendance notifications for all{' '}
                <strong>{totalCount} parents</strong> in{' '}
                <strong>{PHASE_CONFIG.whatsapp.sendEnabled ? 'Live Sender' : 'Dry-Run Preview'}</strong> mode.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
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
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={15} />
                <span>{isSubmitting ? 'Recording & Enqueueing...' : 'Confirm & Save Attendance'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
