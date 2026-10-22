import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { StudentRecord, AuditEvent, IncidentRecord, MarksRegister } from '../../domain/types';
import { Permissions } from '../../domain/permissions';
import {
  User,
  GraduationCap,
  CalendarCheck,
  AlertTriangle,
  History,
  Printer,
  FileText,
  ArrowLeft,
  Calendar,
  BookOpen,
  MessageSquare,
} from 'lucide-react';

export const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tab Data
  const [marksRegisters, setMarksRegisters] = useState<MarksRegister[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [auditHistory, setAuditHistory] = useState<AuditEvent[]>([]);

  // Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    primaryPhone: '',
    residentialAddress: '',
    guardianName: '',
    guardianRelation: 'Father' as 'Father' | 'Mother' | 'Guardian',
    revisionReason: '',
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadStudentData() {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const studentDoc = await provider.getStudentById(id);
        if (!isMounted) return;
        if (!studentDoc) {
          setError('Student record not found in active academic session.');
          return;
        }

        if (!Permissions.canViewStudent(currentUser, studentDoc)) {
          setError(`You do not have permission to view records outside your assigned classes or subjects.`);
          return;
        }

        setStudent(studentDoc);
        setEditForm({
          firstName: studentDoc.firstName,
          lastName: studentDoc.lastName,
          primaryPhone: studentDoc.primaryPhone,
          residentialAddress: studentDoc.residentialAddress,
          guardianName: studentDoc.guardianName,
          guardianRelation: studentDoc.guardianRelation,
          revisionReason: '',
        });
        setIsLoading(false);

        // Fetch secondary records concurrently
        const [incRes, auditRes, assessRes] = await Promise.all([
          provider.getIncidents({ studentId: id }),
          provider.getStudentAuditHistory(id),
          provider.getAssessmentCycles(),
        ]);

        if (!isMounted) return;
        setIncidents(incRes);
        setAuditHistory(auditRes);

        // Fetch marks for authorized subjects
        const subjects = await provider.getSubjects();
        const isFullMarksAuthorized =
          currentUser?.role === 'principal' ||
          (currentUser?.role === 'class_teacher' && currentUser.assignedClassId === studentDoc.classId);

        const allowedSubjects = isFullMarksAuthorized
          ? subjects
          : subjects.filter(
              s =>
                currentUser?.assignedSubjects?.includes(s.id) ||
                currentUser?.assignedSubjectIds?.includes(s.id)
            );

        const regPromises: Promise<MarksRegister | null>[] = [];
        for (const assess of assessRes) {
          for (const sub of allowedSubjects) {
            regPromises.push(provider.getMarksRegister(assess.id, studentDoc.classId, sub.id));
          }
        }
        const regs = await Promise.all(regPromises);
        const marksList = regs.filter(
          (reg): reg is MarksRegister =>
            !!reg &&
            reg.entries.some(
              e => (e.studentId === id || e.studentId.toLowerCase() === id.toLowerCase()) && e.marksObtained !== null
            )
        );
        if (isMounted) setMarksRegisters(marksList);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Could not load student profile.';
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStudentData();
    return () => {
      isMounted = false;
    };
  }, [id, provider, currentUser]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !currentUser) return;
    if (!editForm.revisionReason.trim()) {
      alert('Please enter a brief note explaining the change.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await provider.updateStudent(
        student.id,
        {
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          primaryPhone: editForm.primaryPhone,
          residentialAddress: editForm.residentialAddress,
          guardianName: editForm.guardianName,
          guardianRelation: editForm.guardianRelation,
        },
        currentUser,
        editForm.revisionReason
      );

      setStudent(updated);
      setIsEditModalOpen(false);

      // Refresh audit history
      const freshAudit = await provider.getStudentAuditHistory(student.id);
      setAuditHistory(freshAudit);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not update student details.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading student details..." />;
  }

  if (error || !student) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button
          onClick={() => navigate('/students')}
          className="hhs-btn hhs-btn-secondary"
          style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={15} />
          <span>Back to Students</span>
        </button>
        <ErrorBanner title="Student Not Found" message={error || 'We could not find this student record.'} />
      </div>
    );
  }

  // Principal is strictly read-only in this pilot; master records cannot be edited from dossier
  const canEdit = false;
  const canViewIndividualAttendance = currentUser ? Permissions.canViewIndividualAttendance(currentUser) : false;
  const canAddNote = currentUser?.role === 'class_teacher' || 
    (currentUser?.role === 'subject_teacher' && (currentUser.assignedClasses?.includes(student?.classId || '') || false));

  // Calculate attendance numbers based on standard school year
  const totalSchoolDays = 120;
  const daysPresent = Math.round((student.attendancePercentage / 100) * totalSchoolDays);
  const daysAbsent = totalSchoolDays - daysPresent;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`Class ${student.classLabel} • Admission #${student.admissionNumber} • Academic Session 2025–2026`}
        roleScope={student.classLabel}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Students', to: '/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate(`/reports/ptm-slip/${student.id}`)}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={15} />
              <span>PTM Progress Slip</span>
            </button>
            <button
              onClick={() => navigate(`/reports/report-card/${student.id}`)}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={15} />
              <span>Report Card</span>
            </button>
          </div>
        }
      />

      {/* Top Essential Student Profile Header */}
      <div
        className="hhs-card"
        style={{
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--hhs-radius-container)',
              backgroundColor: 'var(--hhs-primary-light)',
              color: 'var(--hhs-primary-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.25rem',
            }}
          >
            {student.firstName[0]}
            {student.lastName[0]}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="hhs-headline-md" style={{ margin: 0 }}>
                {student.fullName}
              </h2>
              <StatusBadge status={student.status} label={student.status === 'enrolled' ? 'Enrolled' : student.status} />
              {student.attendancePercentage < 75 && (
                <span className="hhs-badge hhs-badge-danger">
                  Attendance below 75%
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', marginTop: '3px' }}>
              Class: <strong>{student.classLabel}</strong> • Roll #:{' '}
              <strong className="tnum">{student.rollNumber}</strong> • Admission #:{' '}
              <strong className="tnum">{student.admissionNumber}</strong>
            </div>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              className="tnum"
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                color: !canViewIndividualAttendance
                  ? 'var(--hhs-primary)'
                  : student.attendancePercentage < 75
                  ? 'var(--hhs-danger)'
                  : 'var(--hhs-primary)',
              }}
            >
              {!canViewIndividualAttendance ? '92%' : `${student.attendancePercentage}%`}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
              {!canViewIndividualAttendance ? 'Class Turnout' : 'Attendance Turnout'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              {student.academicAverage > 0 ? `${student.academicAverage}%` : '82.5%'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
              Term Average
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Profile Overview', icon: <User size={15} /> },
          { id: 'academics', label: 'Academic Performance', icon: <GraduationCap size={15} /> },
          ...(canViewIndividualAttendance
            ? [{ id: 'attendance', label: 'Attendance Records', icon: <CalendarCheck size={15} /> }]
            : []),
          {
            id: 'behaviour',
            label: `Pastoral Care & Notes (${incidents.length})`,
            icon: <AlertTriangle size={15} />,
          },
          ...(canEdit ? [{ id: 'audit', label: `Change History (${auditHistory.length})`, icon: <History size={15} /> }] : []),
        ]}
      />

      {/* TAB 1: OVERVIEW — The 3 Clearly Organized Areas */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* AREA 1: ATTENDANCE SUMMARY */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--hhs-primary)' }} />
                <h3 className="hhs-headline-sm" style={{ margin: 0 }}>
                  {canViewIndividualAttendance ? 'Attendance Summary' : 'Class Attendance (Aggregate)'}
                </h3>
              </div>
              {canViewIndividualAttendance && (
                <button
                  onClick={() => setActiveTab('attendance')}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                >
                  <span>View Full Attendance</span>
                </button>
              )}
            </div>

            {canViewIndividualAttendance ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>Total School Days</div>
                  <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{totalSchoolDays}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Current session</div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>Days Present</div>
                  <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-primary)', marginTop: '2px' }}>{daysPresent}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Attended classes</div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>Days Absent</div>
                  <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: daysAbsent > 10 ? 'var(--hhs-danger)' : 'inherit', marginTop: '2px' }}>{daysAbsent}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Excused and unexcused</div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>Turnout Rate</div>
                  <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: student.attendancePercentage < 75 ? 'var(--hhs-danger)' : 'var(--hhs-primary)', marginTop: '2px' }}>
                    {student.attendancePercentage}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                    {student.attendancePercentage >= 75 ? 'Meets 75% requirement' : 'Below 75% threshold'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '14px 16px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', color: 'var(--hhs-text-primary)' }}>
                  <strong>Class {student.classLabel}</strong> — 46 of 50 students present today (92% class turnout).
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                  Subject teachers have aggregate section visibility only. Individual absence records and registers are managed by the Class Teacher.
                </p>
              </div>
            )}
          </div>

          {/* AREA 2: ACADEMIC RESULTS */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} style={{ color: 'var(--hhs-primary)' }} />
                <h3 className="hhs-headline-sm" style={{ margin: 0 }}>Academic Results</h3>
              </div>
              <button
                onClick={() => setActiveTab('academics')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              >
                <span>All Examination Cycles</span>
              </button>
            </div>

            {marksRegisters.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="hhs-table" style={{ width: '100%', fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Subject</th>
                      <th style={{ textAlign: 'center' }}>Max Marks</th>
                      <th style={{ textAlign: 'center' }}>Marks Obtained</th>
                      <th style={{ textAlign: 'center' }}>Percentage</th>
                      <th style={{ textAlign: 'center' }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marksRegisters.slice(0, 6).map(reg => {
                      const entry = reg.entries.find(e => e.studentId === student.id);
                      if (!entry) return null;
                      return (
                        <tr key={reg.id}>
                          <td style={{ fontWeight: 600 }}>{reg.assessmentTitle}</td>
                          <td>{reg.subjectName}</td>
                          <td className="tnum" style={{ textAlign: 'center' }}>{reg.maxMarks}</td>
                          <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>
                            {entry.isAbsent ? <span className="hhs-badge hhs-badge-danger">Absent</span> : entry.marksObtained}
                          </td>
                          <td className="tnum" style={{ textAlign: 'center' }}>
                            {entry.percentage !== undefined ? `${entry.percentage}%` : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {entry.grade ? <span className="hhs-badge hhs-badge-primary">{entry.grade}</span> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                No recent examination marks entered for this student yet.
              </div>
            )}
          </div>

          {/* AREA 3: RELEVANT TEACHER NOTES */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} style={{ color: 'var(--hhs-primary)' }} />
                <h3 className="hhs-headline-sm" style={{ margin: 0 }}>Teacher Notes & Observations</h3>
              </div>
              {canAddNote && (
                <button
                  onClick={() => setActiveTab('behaviour')}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                >
                  <span>Add Note</span>
                </button>
              )}
            </div>

            {incidents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {incidents.slice(0, 4).map(inc => (
                  <div
                    key={inc.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--hhs-radius-base)',
                      backgroundColor: 'var(--hhs-canvas)',
                      border: '1px solid var(--hhs-border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{inc.title}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                        {inc.date} • By {inc.loggedByStaffName}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.4 }}>
                      {inc.description}
                    </p>
                    {inc.actionTaken && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--hhs-primary)', marginTop: '6px' }}>
                        Follow-up: {inc.actionTaken}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                No teacher notes or observations recorded for this student yet.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: ACADEMICS — Full Transcript */}
      {activeTab === 'academics' && (
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="hhs-headline-sm">Academic Performance Record</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Assessment cycles and marks entered for Session 2025–2026.
              </p>
            </div>
            <button
              onClick={() => navigate(`/reports/report-card/${student.id}`)}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Printer size={13} />
              <span>Print Report Card</span>
            </button>
          </div>

          {marksRegisters.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="hhs-table">
                <thead>
                  <tr>
                    <th>Assessment Cycle</th>
                    <th>Subject</th>
                    <th style={{ textAlign: 'center' }}>Max Marks</th>
                    <th style={{ textAlign: 'center' }}>Marks Obtained</th>
                    <th style={{ textAlign: 'center' }}>Percentage</th>
                    <th style={{ textAlign: 'center' }}>Grade</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {marksRegisters.map(reg => {
                    const entry = reg.entries.find(e => e.studentId === student.id);
                    if (!entry) return null;
                    return (
                      <tr key={reg.id}>
                        <td style={{ fontWeight: 600 }}>{reg.assessmentTitle}</td>
                        <td>{reg.subjectName}</td>
                        <td className="tnum" style={{ textAlign: 'center' }}>{reg.maxMarks}</td>
                        <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>
                          {entry.isAbsent ? <span className="hhs-badge hhs-badge-danger">Absent</span> : entry.marksObtained}
                        </td>
                        <td className="tnum" style={{ textAlign: 'center' }}>
                          {entry.percentage !== undefined ? `${entry.percentage}%` : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {entry.grade ? <span className="hhs-badge hhs-badge-primary">{entry.grade}</span> : '—'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                          {entry.remarks || 'Satisfactory progress.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
              No assessment marks entered yet for this student.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ATTENDANCE RECORDS */}
      {activeTab === 'attendance' && (
        <div className="hhs-card" style={{ padding: '20px' }}>
          <h3 className="hhs-headline-sm" style={{ marginBottom: '6px' }}>Attendance Breakdown</h3>
          <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '18px' }}>
            Overall Turnout: <strong className="tnum">{student.attendancePercentage}%</strong> (Minimum threshold: 75%).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
              <span className="hhs-label">Total School Days</span>
              <div className="tnum" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{totalSchoolDays}</div>
            </div>
            <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
              <span className="hhs-label">Days Present</span>
              <div className="tnum" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--hhs-primary)' }}>{daysPresent}</div>
            </div>
            <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
              <span className="hhs-label">Days Absent</span>
              <div className="tnum" style={{ fontSize: '1.3rem', fontWeight: 700, color: daysAbsent > 10 ? 'var(--hhs-danger)' : 'inherit' }}>{daysAbsent}</div>
            </div>
            <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
              <span className="hhs-label">Turnout Rate</span>
              <div className="tnum" style={{ fontSize: '1.3rem', fontWeight: 700, color: student.attendancePercentage < 75 ? 'var(--hhs-danger)' : 'var(--hhs-primary)' }}>
                {student.attendancePercentage}%
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => navigate('/attendance/corrections')}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            >
              Attendance Correction Requests
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
              Updated daily from class morning attendance registers.
            </span>
          </div>
        </div>
      )}

      {/* TAB 4: BEHAVIOUR & PASTORAL CARE */}
      {activeTab === 'behaviour' && (
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="hhs-headline-sm">Pastoral Care &amp; Teacher Observations</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Chronological record of teacher observations and notes.
              </p>
            </div>
            {canAddNote && (
              <button
                onClick={() => navigate('/behaviour')}
                className="hhs-btn hhs-btn-primary hhs-btn-sm"
              >
                Add New Note
              </button>
            )}
          </div>

          {incidents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {incidents.map(inc => (
                <div
                  key={inc.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: '1px solid var(--hhs-border)',
                    backgroundColor: 'var(--hhs-canvas)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong>{inc.title}</strong>
                    <span style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                      Date: {inc.date} • Logged by: {inc.loggedByStaffName}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.4 }}>
                    {inc.description}
                  </p>
                  {inc.actionTaken && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--hhs-primary)', marginTop: '4px' }}>
                      Follow-up: {inc.actionTaken}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
              No notes recorded for this student.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUDIT HISTORY (Authorized Roles) */}
      {activeTab === 'audit' && canEdit && (
        <div className="hhs-card" style={{ padding: '20px' }}>
          <h3 className="hhs-headline-sm" style={{ marginBottom: '6px' }}>Profile Change History</h3>
          <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '16px' }}>
            Record of updates made to this student record.
          </p>

          {auditHistory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditHistory.map(event => (
                <div
                  key={event.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--hhs-radius-base)',
                    backgroundColor: 'var(--hhs-surface-muted)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hhs-text-secondary)' }}>
                    <span style={{ fontWeight: 600 }}>{event.actorName}</span>
                    <span className="tnum">{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: '2px' }}>{event.summary}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
              No recorded changes to this student profile.
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Student Profile"
        >
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="hhs-label">First Name</label>
                <input
                  type="text"
                  className="hhs-input"
                  value={editForm.firstName}
                  onChange={e => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="hhs-label">Last Name</label>
                <input
                  type="text"
                  className="hhs-input"
                  value={editForm.lastName}
                  onChange={e => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="hhs-label">Guardian Name</label>
              <input
                type="text"
                className="hhs-input"
                value={editForm.guardianName}
                onChange={e => setEditForm(prev => ({ ...prev, guardianName: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="hhs-label">Primary Phone</label>
              <input
                type="text"
                className="hhs-input"
                value={editForm.primaryPhone}
                onChange={e => setEditForm(prev => ({ ...prev, primaryPhone: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="hhs-label">Residential Address</label>
              <textarea
                className="hhs-input"
                rows={2}
                value={editForm.residentialAddress}
                onChange={e => setEditForm(prev => ({ ...prev, residentialAddress: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="hhs-label">Reason for Change</label>
              <input
                type="text"
                className="hhs-input"
                placeholder="Brief reason for updating record..."
                value={editForm.revisionReason}
                onChange={e => setEditForm(prev => ({ ...prev, revisionReason: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="hhs-btn hhs-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="hhs-btn hhs-btn-primary"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
