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
import type { ClassSection, AttendanceState } from '../../domain/types';
import {
  CheckCircle2,
  Save,
  Check,
  ShieldCheck,
} from 'lucide-react';

interface AttendanceDraftRow {
  studentId: string;
  rollNumber: number;
  name: string;
  admissionNumber: string;
  state: AttendanceState;
  remarks: string;
}

export const DailyAttendanceRegister: React.FC = () => {
  const { classId: paramClassId } = useParams<{ classId?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [classes, setClasses] = useState<ClassSection[]>([]);
  // Fail-closed initial class selection: if class_teacher, only their assignedClassId; if principal, param or first class
  const initialClassId = paramClassId || currentUser?.assignedClassId || (currentUser?.role === 'principal' ? 'class-10-a' : '');
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId);
  const [selectedDate, setSelectedDate] = useState<string>(getSchoolLocalDate());
  const [activeClass, setActiveClass] = useState<ClassSection | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceDraftRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Sync paramClassId if route changes
  useEffect(() => {
    if (paramClassId && paramClassId !== selectedClassId) {
      setSelectedClassId(paramClassId);
    }
  }, [paramClassId, selectedClassId]);

  // Load Classes
  useEffect(() => {
    let isMounted = true;
    async function fetchClasses() {
      try {
        const clsList = await provider.getClasses();
        if (isMounted) setClasses(clsList);
      } catch (err: unknown) {
        console.error('Error fetching classes:', err);
      }
    }
    fetchClasses();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  // Load Students & existing session for selected Class and Date
  useEffect(() => {
    let isMounted = true;
    async function loadRegister() {
      setIsLoading(true);
      setError(null);
      setIsSubmittedSuccess(false);
      try {
        const [cls, students, existingSession] = await Promise.all([
          provider.getClassById(selectedClassId),
          provider.getClassStudents(selectedClassId),
          provider.getAttendanceSession(selectedClassId, selectedDate),
        ]);

        if (!isMounted) return;
        setActiveClass(cls);

        // Map students to draft rows
        const initialRows: AttendanceDraftRow[] = students.map(s => {
          const rec = existingSession?.records.find(r => r.studentId === s.id);
          return {
            studentId: s.id,
            rollNumber: s.rollNumber,
            name: `${s.firstName} ${s.lastName}`,
            admissionNumber: s.admissionNumber,
            state: rec ? rec.state : 'present',
            remarks: rec?.remarks || '',
          };
        });

        // Sort by roll number
        initialRows.sort((a, b) => a.rollNumber - b.rollNumber);
        setAttendanceRows(initialRows);

        if (existingSession && (existingSession.status === 'submitted' || existingSession.status === 'corrected')) {
          setIsSubmittedSuccess(true);
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

  // Calculate live stats
  const totalCount = attendanceRows.length;
  const presentCount = attendanceRows.filter(r => r.state === 'present').length;
  const absentCount = attendanceRows.filter(r => r.state === 'absent').length;
  const lateCount = attendanceRows.filter(r => r.state === 'late').length;
  const excusedCount = attendanceRows.filter(r => r.state === 'excused').length;
  const attendanceRate = totalCount > 0 ? ((presentCount + lateCount) / totalCount) * 100 : 0;

  // Submit register
  const handleConfirmSubmit = async () => {
    if (!currentUser || !activeClass) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await provider.submitDailyAttendance(
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

      setIsSubmittedSuccess(true);
      setIsConfirmModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit daily register.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  if (!currentUser || !selectedClassId || !canView) {
    return (
      <AccessDenied
        title="Attendance Register Access Restricted"
        message={
          currentUser?.role === 'subject_teacher'
            ? "Subject teachers can view aggregate attendance totals only. Individual attendance registers are restricted to the assigned Class Teacher."
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
        title={`Daily Attendance Register — ${activeClass?.label || 'Class Register'}`}
        subtitle={
          canMark
            ? `Class Teacher: ${currentUser.name} • Morning roll call register for ${activeClass?.label || 'assigned section'}.`
            : `Class Teacher: ${activeClass?.classTeacherName || 'Assigned Teacher'} • Principal read-only institutional inspection.`
        }
        breadcrumbs={[
          { label: 'Campus' },
          { label: 'Attendance' },
          { label: activeClass?.label || 'Register' },
        ]}
        actions={
          canMark ? (
            <div style={{ display: 'flex', gap: '10px' }}>
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
                <span>Finalize & Submit Register</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span
                className="hhs-badge hhs-badge-accent"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px' }}
              >
                <ShieldCheck size={14} />
                <span>Read-Only Oversight</span>
              </span>
              <button
                onClick={() => window.print()}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Print Register</span>
              </button>
            </div>
          )
        }
      />

      {!canMark && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--hhs-radius-base)',
            backgroundColor: 'var(--hhs-surface-muted)',
            border: '1px solid var(--hhs-border)',
            color: 'var(--hhs-text-secondary)',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ShieldCheck size={16} color="var(--hhs-primary)" />
          <span>
            <strong>School-Wide Attendance Oversight (Read-Only):</strong> The Principal profile has read-only oversight across all classrooms. Marking, modifying, and submitting attendance is strictly reserved for the assigned Class Teacher ({activeClass?.classTeacherName || 'Class Teacher'}).
          </span>
        </div>
      )}

      {error && <ErrorBanner title="Submission Error" message={error} />}

      {isSubmittedSuccess && (
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
              <strong>Register Finalized:</strong> Attendance for <strong>{activeClass?.label}</strong> on{' '}
              <strong className="tnum">{selectedDate}</strong> has been logged to the audit ledger.
            </span>
          </div>
          <span className="hhs-badge hhs-badge-primary">Dual-Custody Logged</span>
        </div>
      )}

      {/* Roster Controls: Class Picker, Date Selector & Window Status */}
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

        {/* Live Attendance Counters */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-primary)' }}>
              {presentCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
              Present
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-danger)' }}>
              {absentCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
              Absent
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-accent)' }}>
              {lateCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
              Late
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-info)' }}>
              {excusedCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
              Excused
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--hhs-border)', paddingLeft: '16px', textAlign: 'center' }}>
            <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              {attendanceRate.toFixed(1)}%
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
              Turnout
            </div>
          </div>
        </div>
      </div>

      {/* Roster Table */}
      {isLoading ? (
        <LoadingState message="Loading class attendance sheet..." />
      ) : (
        <div className="hhs-card">
          <div className="hhs-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="hhs-table">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>Roll #</th>
                  <th style={{ width: '220px' }}>Student Name</th>
                  <th style={{ width: '130px' }}>Admission #</th>
                  <th style={{ width: '320px', textAlign: 'center' }}>Attendance Marking</th>
                  <th>Remarks / Reason</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map(row => {
                  return (
                    <tr key={row.studentId}>
                      <td className="numeric tnum" style={{ fontWeight: 600 }}>
                        {row.rollNumber}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {row.name}
                      </td>
                      <td className="numeric tnum" style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.78rem' }}>
                        {row.admissionNumber}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {canMark ? (
                          /* Attendance State Segmented Buttons */
                          <div
                            style={{
                              display: 'inline-flex',
                              borderRadius: 'var(--hhs-radius-base)',
                              border: '1px solid var(--hhs-border)',
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleStateChange(row.studentId, 'present')}
                              style={{
                                padding: '5px 12px',
                                border: 'none',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundColor:
                                  row.state === 'present' ? 'var(--hhs-primary)' : 'var(--hhs-surface)',
                                color: row.state === 'present' ? '#ffffff' : 'var(--hhs-text-primary)',
                                borderRight: '1px solid var(--hhs-border)',
                              }}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStateChange(row.studentId, 'absent')}
                              style={{
                                padding: '5px 12px',
                                border: 'none',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundColor:
                                  row.state === 'absent' ? 'var(--hhs-danger)' : 'var(--hhs-surface)',
                                color: row.state === 'absent' ? '#ffffff' : 'var(--hhs-text-primary)',
                                borderRight: '1px solid var(--hhs-border)',
                              }}
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStateChange(row.studentId, 'late')}
                              style={{
                                padding: '5px 12px',
                                border: 'none',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundColor:
                                  row.state === 'late' ? 'var(--hhs-accent)' : 'var(--hhs-surface)',
                                color: row.state === 'late' ? '#202b2a' : 'var(--hhs-text-primary)',
                                borderRight: '1px solid var(--hhs-border)',
                              }}
                            >
                              Late
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStateChange(row.studentId, 'excused')}
                              style={{
                                padding: '5px 12px',
                                border: 'none',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundColor:
                                  row.state === 'excused' ? 'var(--hhs-info)' : 'var(--hhs-surface)',
                                color: row.state === 'excused' ? '#ffffff' : 'var(--hhs-text-primary)',
                              }}
                            >
                              Excused
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`hhs-badge ${
                              row.state === 'present'
                                ? 'hhs-badge-primary'
                                : row.state === 'absent'
                                ? 'hhs-badge-danger'
                                : row.state === 'late'
                                ? 'hhs-badge-accent'
                                : 'hhs-badge-secondary'
                            }`}
                            style={{ textTransform: 'capitalize', padding: '4px 10px' }}
                          >
                            {row.state}
                          </span>
                        )}
                      </td>
                      <td>
                        {canMark ? (
                          <input
                            type="text"
                            placeholder={
                              row.state === 'absent'
                                ? 'Unexplained absence (call parent)'
                                : row.state === 'late'
                                ? 'Arrived 08:05 AM'
                                : 'Optional notes'
                            }
                            value={row.remarks}
                            onChange={e => handleRemarksChange(row.studentId, e.target.value)}
                            className="hhs-input"
                            style={{ height: '30px', fontSize: '0.78rem' }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                            {row.remarks || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm & Submit Attendance Register"
        subtitle={`Session for ${activeClass?.label} on date ${selectedDate}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--hhs-radius-base)',
              backgroundColor: 'var(--hhs-canvas)',
              border: '1px solid var(--hhs-border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              textAlign: 'center',
            }}
          >
            <div>
              <span className="hhs-label" style={{ marginBottom: 0 }}>Present</span>
              <span className="tnum" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>
                {presentCount}
              </span>
            </div>
            <div>
              <span className="hhs-label" style={{ marginBottom: 0 }}>Absent</span>
              <span className="tnum" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--hhs-danger)' }}>
                {absentCount}
              </span>
            </div>
            <div>
              <span className="hhs-label" style={{ marginBottom: 0 }}>Late</span>
              <span className="tnum" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--hhs-accent)' }}>
                {lateCount}
              </span>
            </div>
            <div>
              <span className="hhs-label" style={{ marginBottom: 0 }}>Total</span>
              <span className="tnum" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {totalCount}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.82rem', color: 'var(--hhs-text-secondary)' }}>
            <ShieldCheck size={18} color="var(--hhs-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              Submitting locks this daily register. Subsequent corrections will require dual-custody approval under the HanuJai institutional policy.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              className="hhs-btn hhs-btn-secondary"
            >
              Back to Editing
            </button>
            <button
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="hhs-btn hhs-btn-primary"
            >
              {isSubmitting ? 'Finalizing...' : 'Confirm Submission'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
