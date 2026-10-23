import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { AccessDenied } from '../error/AccessDenied';
import { downloadStudentAttendanceXlsx } from '../../utils/exportUtils';
import type { StudentRecord, AttendanceCorrection, AttendanceSession } from '../../domain/types';
import { Permissions } from '../../domain/permissions';
import {
  FileSpreadsheet,
  ArrowLeft,
  Calendar,
} from 'lucide-react';

interface AttendanceDayLog {
  date: string;
  day: string;
  status: 'Present' | 'Absent' | 'Late' | 'Approved leave' | 'School Off' | 'Holiday' | 'Unmarked';
  remarks?: string;
  correctionInfo?: string;
}

export const StudentAttendanceHistory: React.FC = () => {
  const { studentId, id } = useParams<{ studentId?: string; id?: string }>();
  const effectiveId = studentId || id;
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [range, setRange] = useState(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { start: iso(start), end: iso(end) };
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!effectiveId || range.start > range.end) return;
      setIsLoading(true);
      setError(null);
      try {
        const studentDoc = await provider.getStudentById(effectiveId);

        if (!isMounted) return;
        if (!studentDoc) {
          setError('Student record not found.');
          return;
        }
        if (!Permissions.canViewIndividualAttendance(currentUser, studentDoc.classId)) {
          setError('Individual attendance history is limited to the Principal and the student’s assigned Class Teacher.');
          return;
        }

        const [sessionList, corrList] = await Promise.all([
          provider.getAttendanceSessionsInRange(range.start, range.end, [studentDoc.classId]),
          provider.getAttendanceCorrections(studentDoc.classId),
        ]);

        setStudent(studentDoc);
        setSessions(sessionList);
        setCorrections(corrList.filter(c => c.studentId === effectiveId));
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load attendance history.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [effectiveId, provider, range.start, range.end, currentUser]);

  // Build the log only from saved attendance sessions. Missing weekdays remain unmarked.
  const dateLogs: AttendanceDayLog[] = useMemo(() => {
    if (!student || range.start > range.end) return [];

    const logs: AttendanceDayLog[] = [];
    const sessionByDate = new Map(sessions.filter(s => s.classId === student.classId).map(s => [s.date, s]));
    const start = new Date(`${range.start}T12:00:00`);
    const end = new Date(`${range.end}T12:00:00`);
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
      const dayOfWeek = d.getDay(); // 0 is Sunday

      if (dayOfWeek === 0) {
        logs.push({
          date: isoDate,
          day: dayName,
          status: 'School Off',
          remarks: 'Sunday; scheduled day off',
        });
        continue;
      }

      const session = sessionByDate.get(isoDate);
      const record = session && session.status !== 'draft'
        ? session.records.find(item => item.studentId === student.id)
        : undefined;
      const status: AttendanceDayLog['status'] = record
        ? record.state === 'present' ? 'Present'
          : record.state === 'absent' ? 'Absent'
            : record.state === 'late' ? 'Late' : 'Approved leave'
        : 'Unmarked';
      const remarks = record?.remarks || (session?.status === 'draft' ? 'Attendance session is still a draft' : 'No submitted attendance record');
      const matchCorr = corrections.find(c => c.date === isoDate);
      let correctionInfo: string | undefined;
      if (matchCorr && session?.status === 'corrected') {
        correctionInfo = `Corrected from ${matchCorr.previousState}: ${matchCorr.mandatoryReason}`;
      }

      logs.push({
        date: isoDate,
        day: dayName,
        status,
        remarks,
        correctionInfo,
      });
    }

    return logs;
  }, [student, corrections, sessions, range.start, range.end]);

  // Metrics
  const schoolDays = dateLogs.filter(l => !['School Off', 'Holiday', 'Unmarked'].includes(l.status));
  const presentDays = schoolDays.filter(l => l.status === 'Present' || l.status === 'Late').length;
  const absentDays = schoolDays.filter(l => l.status === 'Absent').length;
  const totalRecordedDays = presentDays + absentDays;
  const attendanceTurnout = totalRecordedDays > 0 ? ((presentDays / totalRecordedDays) * 100).toFixed(1) : '0.0';

  const handleExportExcel = () => {
    if (!student) return;
    downloadStudentAttendanceXlsx(student, dateLogs);
  };

  if (isLoading) {
    return <LoadingState message="Compiling date-by-date attendance log..." />;
  }

  if (error || !student) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button
          onClick={() => navigate('/reports/attendance')}
          className="hhs-btn hhs-btn-secondary"
          style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={15} />
          <span>Back to Attendance Ledger</span>
        </button>
        <ErrorBanner title="Attendance Record Not Found" message={error || 'Could not find student attendance log.'} />
      </div>
    );
  }

  // Authorization check
  const isAuthorized =
    currentUser?.role === 'principal' ||
    (currentUser?.role === 'class_teacher' && currentUser.assignedClassId === student.classId);

  if (!isAuthorized && currentUser?.role === 'subject_teacher') {
    return (
      <AccessDenied
        title="Restricted Attendance History"
        message="Subject teachers have aggregate section visibility only. Individual attendance histories are restricted to School Leadership and Assigned Class Teachers."
      />
    );
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title={`Attendance History — ${student.fullName}`}
        subtitle={`Class ${student.classLabel} • Admission #${student.admissionNumber} • Roll #${student.rollNumber}`}
        roleScope="Attendance Register"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Attendance Ledger', to: '/reports/attendance' },
          { label: student.fullName },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/reports/attendance')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={15} />
              <span>Attendance Ledger</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Download day-by-day attendance history as genuine Excel workbook"
            >
              <FileSpreadsheet size={15} />
              <span>Export Excel</span>
            </button>
          </div>
        }
      />

      <section className="hhs-panel" aria-label="Attendance date range" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
          Start date
          <input type="date" value={range.start} max={range.end} onChange={event => setRange(value => ({ ...value, start: event.target.value }))} />
        </label>
        <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
          End date
          <input type="date" value={range.end} min={range.start} onChange={event => setRange(value => ({ ...value, end: event.target.value }))} />
        </label>
        {range.start > range.end && <span role="alert" style={{ color: 'var(--hhs-danger-text)' }}>Start date must be on or before end date.</span>}
        <span style={{ color: 'var(--hhs-text-secondary)', fontSize: 13 }}>Summaries and export use this date range. Missing attendance stays unmarked.</span>
      </section>

      {/* KPI Cards Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Recorded Present / Absent</div>
          <div className="hhs-metric-value">{totalRecordedDays} Days</div>
          <div className="hhs-metric-sub">Academic Session 2025–26</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Days Present</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {presentDays} Days
          </div>
          <div className="hhs-metric-sub">Attended morning instructional hours</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Days Absent</div>
          <div
            className="hhs-metric-value"
            style={{ color: absentDays > 10 ? 'var(--hhs-danger-text)' : 'var(--hhs-text-primary)' }}
          >
            {absentDays} Days
          </div>
          <div className="hhs-metric-sub">Excused &amp; unexcused absences</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Turnout Percentage</div>
          <div
            className="hhs-metric-value"
            style={{
              color: parseFloat(attendanceTurnout) < 75.0 ? 'var(--hhs-danger-text)' : 'var(--hhs-primary)',
            }}
          >
            {attendanceTurnout}%
          </div>
          <div className="hhs-metric-sub">
            {parseFloat(attendanceTurnout) < 75.0 ? 'Below 75% threshold' : '75% or above (Meets criteria)'}
          </div>
        </div>
      </div>

      {/* Date-by-Date Log Table */}
      <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--hhs-border)',
            backgroundColor: 'var(--hhs-surface-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              Day-by-Day Attendance Record
            </h4>
            <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
              Chronological log of verified morning roll-call sessions
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">Session 2025–26</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Date</th>
                <th style={{ width: '130px' }}>Day of Week</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Recorded Status</th>
                <th>Teacher Remarks &amp; Corrections</th>
              </tr>
            </thead>
            <tbody>
              {dateLogs.map((log, idx) => {
                const isAbsent = log.status === 'Absent';
                const isOff = log.status === 'School Off' || log.status === 'Holiday';

                return (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: isAbsent
                        ? 'var(--hhs-danger-light)'
                        : isOff
                        ? 'var(--hhs-surface-muted)'
                        : undefined,
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <Calendar size={14} style={{ color: 'var(--hhs-text-muted)' }} />
                        <span className="tnum">{log.date}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                      {log.day}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {log.status === 'Present' && (
                        <span className="hhs-badge hhs-badge-primary">Present</span>
                      )}
                      {log.status === 'Absent' && (
                        <span className="hhs-badge hhs-badge-danger">Absent</span>
                      )}
                      {log.status === 'Late' && (
                        <span className="hhs-badge hhs-badge-accent">Late</span>
                      )}
                      {log.status === 'Approved leave' && (
                        <span className="hhs-badge hhs-badge-neutral">Approved leave</span>
                      )}
                      {log.status === 'School Off' && (
                        <span className="hhs-badge hhs-badge-neutral" style={{ color: 'var(--hhs-text-muted)' }}>
                          School Off
                        </span>
                      )}
                      {log.status === 'Holiday' && (
                        <span className="hhs-badge hhs-badge-neutral">Holiday</span>
                      )}
                      {log.status === 'Unmarked' && (
                        <span className="hhs-badge hhs-badge-neutral">Unmarked</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', color: isOff ? 'var(--hhs-text-muted)' : 'var(--hhs-text-primary)' }}>
                        {log.remarks || '—'}
                      </div>
                      {log.correctionInfo && (
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--hhs-primary)',
                            marginTop: '2px',
                            fontWeight: 600,
                          }}
                        >
                          {log.correctionInfo}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
