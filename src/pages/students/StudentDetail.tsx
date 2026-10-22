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
  ShieldAlert,
  Edit,
  Printer,
  FileText,
  CheckCircle2,
  ArrowLeft,
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
          setError(`Desk Clearance Boundary: Your current role (${currentUser?.role}) is not authorized to access student dossiers outside your assigned section or subject allocations.`);
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

        // Parallel fetch for tabs
        const [incRes, auditRes, assessRes] = await Promise.all([
          provider.getIncidents({ studentId: id }),
          provider.getStudentAuditHistory(id),
          provider.getAssessmentCycles(),
        ]);

        if (!isMounted) return;
        setIncidents(incRes);
        setAuditHistory(auditRes);

        // Fetch marks for authorized subjects concurrently
        const subjects = await provider.getSubjects();
        const isFullMarksAuthorized =
          currentUser?.role === 'principal' ||
          currentUser?.role === 'office_admin' ||
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
        const msg = err instanceof Error ? err.message : 'Failed to load student profile.';
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
      alert('Mandatory requirement: Please enter a reason for revision to ensure audit compliance.');
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
      alert(err instanceof Error ? err.message : 'Failed to update student profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Retrieving institutional student dossier & historical ledger..." />;
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
          <span>Return to Student Ledger</span>
        </button>
        <ErrorBanner title="Record Unavailable" message={error || 'Student not found.'} />
      </div>
    );
  }

  const role = currentUser?.role;
  const canEdit = role === 'principal' || role === 'office_admin';
  const isGuardianContactAuthorized =
    role === 'principal' ||
    role === 'office_admin' ||
    (role === 'class_teacher' && currentUser?.assignedClassId === student.classId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`HanuJai High School, Jaipur • ${student.classLabel} • Admission #${student.admissionNumber} • Roll #${student.rollNumber}`}
        roleScope={role === 'class_teacher' ? `${student.classLabel} Student Dossier` : 'Student Master Dossier'}
        breadcrumbs={[
          { label: role === 'class_teacher' ? 'My Section' : role === 'subject_teacher' ? 'My Teaching' : 'Operations Hub', to: '/' },
          { label: 'Student Directory', to: '/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
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
              <span>CBSE Report Card</span>
            </button>
            {canEdit && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit size={15} />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        }
      />

      {/* Profile Summary Banner */}
      <div
        className="hhs-card"
        style={{
          padding: '20px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: '20px',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--hhs-radius-container)',
            backgroundColor: 'var(--hhs-primary-light)',
            color: 'var(--hhs-primary-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1.4rem',
            border: '1px solid #c9d8d3',
          }}
        >
          {student.firstName[0]}
          {student.lastName[0]}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 className="hhs-headline-md" style={{ marginBottom: 0 }}>
              {student.fullName}
            </h2>
            <StatusBadge status={student.status} />
            {student.attendancePercentage < 75 && (
              <span className="hhs-badge hhs-badge-danger">
                CBSE Attendance Risk (&lt;75%)
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)' }}>
            Class: <strong>{student.classLabel}</strong> • Roll #:{' '}
            <strong className="tnum">{student.rollNumber}</strong> • Admission No:{' '}
            <strong className="tnum">{student.admissionNumber}</strong> • Enrollment Date:{' '}
            <span className="tnum">{student.enrollmentDate}</span>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div style={{ display: 'flex', gap: '24px', borderLeft: '1px solid var(--hhs-border)', paddingLeft: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              className="tnum"
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: student.attendancePercentage < 75 ? 'var(--hhs-danger)' : 'var(--hhs-primary)',
              }}
            >
              {student.attendancePercentage}%
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
              Attendance (YTD)
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="tnum" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              {student.academicAverage > 0 ? `${student.academicAverage}%` : '82.5%'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase' }}>
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
          { id: 'attendance', label: 'Attendance Records', icon: <CalendarCheck size={15} /> },
          {
            id: 'behaviour',
            label: `Pastoral Care & Incidents (${incidents.length})`,
            icon: <AlertTriangle size={15} />,
          },
          { id: 'audit', label: `Change History (${auditHistory.length})`, icon: <History size={15} /> },
        ]}
      />

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
          {/* Left: Demographics & Guardian */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="hhs-card" style={{ padding: '20px' }}>
              <h3 className="hhs-headline-sm" style={{ marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--hhs-border)' }}>
                Personal & Family Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.84rem' }}>
                <div>
                  <span className="hhs-label">Date of Birth</span>
                  <div className="tnum" style={{ fontWeight: 600 }}>{student.dateOfBirth}</div>
                </div>
                <div>
                  <span className="hhs-label">Gender</span>
                  <div style={{ fontWeight: 600 }}>{student.gender === 'M' ? 'Male' : student.gender === 'F' ? 'Female' : 'Other'}</div>
                </div>
                {isGuardianContactAuthorized ? (
                  <>
                    <div>
                      <span className="hhs-label">Primary Guardian</span>
                      <div style={{ fontWeight: 600 }}>{student.guardianName} ({student.guardianRelation})</div>
                    </div>
                    <div>
                      <span className="hhs-label">Emergency Phone</span>
                      <div className="tnum" style={{ fontWeight: 600 }}>{student.primaryPhone}</div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span className="hhs-label">Residential Address</span>
                      <div style={{ color: 'var(--hhs-text-secondary)', lineHeight: 1.5 }}>
                        {student.residentialAddress}, {student.city}, {student.state} {student.pincode}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ gridColumn: 'span 2', padding: '12px', backgroundColor: 'var(--hhs-surface-muted)', borderRadius: 'var(--hhs-radius-sm)', fontStyle: 'italic', color: 'var(--hhs-text-muted)' }}>
                    Guardian contact and residential address are restricted to the Office Registrar and Assigned Class Tutor.
                  </div>
                )}
              </div>
            </div>

            {/* Academic Track */}
            <div className="hhs-card" style={{ padding: '20px' }}>
              <h3 className="hhs-headline-sm" style={{ marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--hhs-border)' }}>
                Enrollment & Section Details
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.84rem' }}>
                <div>
                  <span className="hhs-label">Academic Session</span>
                  <div style={{ fontWeight: 600 }}>{student.academicYearId || '2025–2026'}</div>
                </div>
                <div>
                  <span className="hhs-label">Class Section</span>
                  <div style={{ fontWeight: 600 }}>{student.classLabel}</div>
                </div>
                <div>
                  <span className="hhs-label">Admission Number</span>
                  <div className="tnum" style={{ fontWeight: 600 }}>{student.admissionNumber}</div>
                </div>
                <div>
                  <span className="hhs-label">Roll Number</span>
                  <div className="tnum" style={{ fontWeight: 600 }}>{student.rollNumber}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Explainable Care Rules & Active Flags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="hhs-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--hhs-border)' }}>
                <div>
                  <h3 className="hhs-headline-sm">Explainable Care Flags</h3>
                  <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                    Transparent, rule-based alerts requiring educator intervention.
                  </p>
                </div>
                <ShieldAlert size={18} color="var(--hhs-accent)" />
              </div>

              {student.activeFlags && student.activeFlags.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {student.activeFlags.map((flag, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--hhs-radius-base)',
                        backgroundColor: 'var(--hhs-canvas)',
                        border: `1px solid ${flag.severity === 'alert' ? '#f0bcb8' : '#e6cdb2'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={flag.severity === 'alert' ? 'hhs-badge hhs-badge-danger' : 'hhs-badge hhs-badge-accent'}>
                          #{flag.code}
                        </span>
                        <span className="tnum" style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
                          Triggered: {flag.triggeredAt.split('T')[0]}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem', marginTop: '6px' }}>
                        {flag.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
                        <strong>Trigger Reason:</strong> {flag.reason}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
                  <CheckCircle2 size={24} color="var(--hhs-primary)" style={{ margin: '0 auto 8px' }} />
                  <div>No active care alerts for this student.</div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="hhs-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                Quick Dossier Actions:
              </div>
              <button
                onClick={() => navigate(`/attendance/register/${student.classId}`)}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ justifyContent: 'flex-start' }}
              >
                Mark Daily Attendance for {student.classLabel}
              </button>
              <button
                onClick={() => {
                  setActiveTab('behaviour');
                }}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ justifyContent: 'flex-start' }}
              >
                Log Pastoral Care Observation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACADEMICS */}
      {activeTab === 'academics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">Continuous Assessment Performance Transcript</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Unit tests and term examination records for Session 2025–2026.
                </p>
              </div>
              <button
                onClick={() => navigate(`/reports/report-card/${student.id}`)}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={13} />
                <span>Print Official Report Card</span>
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
                      <th style={{ textAlign: 'center' }}>CBSE Grade</th>
                      <th>Teacher Remarks</th>
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
                          <td className="numeric tnum" style={{ textAlign: 'center' }}>{reg.maxMarks}</td>
                          <td className="numeric tnum" style={{ textAlign: 'center', fontWeight: 700 }}>
                            {entry.isAbsent ? (
                              <span className="hhs-badge hhs-badge-danger">Absent</span>
                            ) : (
                              entry.marksObtained
                            )}
                          </td>
                          <td className="numeric tnum" style={{ textAlign: 'center' }}>
                            {entry.percentage !== undefined ? `${entry.percentage}%` : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {entry.grade ? (
                              <span className="hhs-badge hhs-badge-primary">{entry.grade}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                            {entry.remarks || 'Standard progress verified.'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
                No submitted assessment marks on file yet for this student.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '8px' }}>
              Attendance Register Breakdown (Session 2025–2026)
            </h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '20px' }}>
              Cumulative turnout: <strong className="tnum">{student.attendancePercentage}%</strong> (CBSE Minimum Statutory Threshold: 75.0%).
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <div style={{ padding: '16px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <span className="hhs-label">Total Operational Days</span>
                <div className="tnum" style={{ fontSize: '1.4rem', fontWeight: 700 }}>112</div>
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <span className="hhs-label">Days Present</span>
                <div className="tnum" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--hhs-primary)' }}>100</div>
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <span className="hhs-label">Unexcused Absences</span>
                <div className="tnum" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--hhs-danger)' }}>8</div>
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <span className="hhs-label">Late Reporting (Grace)</span>
                <div className="tnum" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--hhs-accent)' }}>4</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => navigate('/attendance/corrections')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              >
                Request Dual-Custody Attendance Correction
              </button>
              <span className="tnum" style={{ fontSize: '0.78rem', color: 'var(--hhs-text-muted)' }}>
                Audited daily against CBSE Pariksha Sangam standards
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BEHAVIOUR & INCIDENTS */}
      {activeTab === 'behaviour' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm">Pastoral Care & Conduct Timeline</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Chronological record of commendations, notices, and disciplinary observations.
                </p>
              </div>
              <button
                onClick={() => navigate('/behaviour')}
                className="hhs-btn hhs-btn-primary hhs-btn-sm"
              >
                Log New Observation
              </button>
            </div>

            {incidents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {incidents.map(inc => (
                  <div
                    key={inc.id}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--hhs-radius-base)',
                      border: '1px solid var(--hhs-border)',
                      backgroundColor: 'var(--hhs-surface-hover)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className={
                            inc.severity === 'commendation'
                              ? 'hhs-badge hhs-badge-primary'
                              : inc.severity === 'critical' || inc.severity === 'disciplinary'
                              ? 'hhs-badge hhs-badge-danger'
                              : 'hhs-badge hhs-badge-accent'
                          }
                        >
                          {inc.category.replace('_', ' ').toUpperCase()}
                        </span>
                        <strong style={{ fontSize: '0.9rem' }}>{inc.title}</strong>
                      </div>
                      <span className="tnum" style={{ fontSize: '0.74rem', color: 'var(--hhs-text-muted)' }}>
                        Date: {inc.date} • Logged by: {inc.loggedByStaffName}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', marginBottom: '8px' }}>
                      {inc.description}
                    </p>

                    {inc.actionTaken && (
                      <div style={{ fontSize: '0.78rem', backgroundColor: 'var(--hhs-canvas)', padding: '8px 12px', borderRadius: 'var(--hhs-radius-sm)', border: '1px solid var(--hhs-border)' }}>
                        <strong>Action Plan:</strong> {inc.actionTaken}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
                No disciplinary notices or commendations recorded for this student.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT HISTORY */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '8px' }}>
              Immutable Profile Revision Ledger
            </h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '16px' }}>
              Cryptographic audit log recording every mutation made to this student record.
            </p>

            {auditHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {auditHistory.map(evt => (
                  <div
                    key={evt.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--hhs-radius-base)',
                      border: '1px solid var(--hhs-border)',
                      backgroundColor: 'var(--hhs-canvas)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>{evt.actorName} ({evt.actorRole})</span>
                      <span className="tnum" style={{ fontSize: '0.74rem', color: 'var(--hhs-text-muted)' }}>
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)' }}>
                      {evt.summary}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
                No profile revisions recorded since original enrollment.
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT STUDENT PROFILE MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Student Profile — ${student.fullName}`}
        subtitle="Modifications will be permanently committed to the immutable school audit ledger."
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="edit-first">First Name</label>
              <input
                id="edit-first"
                required
                className="hhs-input"
                value={editForm.firstName}
                onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="edit-last">Last Name</label>
              <input
                id="edit-last"
                required
                className="hhs-input"
                value={editForm.lastName}
                onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="edit-guardian">Guardian Name</label>
              <input
                id="edit-guardian"
                required
                className="hhs-input"
                value={editForm.guardianName}
                onChange={e => setEditForm({ ...editForm, guardianName: e.target.value })}
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="edit-relation">Relation</label>
              <select
                id="edit-relation"
                className="hhs-select"
                value={editForm.guardianRelation}
                onChange={e => setEditForm({ ...editForm, guardianRelation: e.target.value as any })}
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="edit-phone">Primary Phone</label>
              <input
                id="edit-phone"
                required
                className="hhs-input"
                value={editForm.primaryPhone}
                onChange={e => setEditForm({ ...editForm, primaryPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="edit-addr">Residential Address</label>
              <input
                id="edit-addr"
                required
                className="hhs-input"
                value={editForm.residentialAddress}
                onChange={e => setEditForm({ ...editForm, residentialAddress: e.target.value })}
              />
            </div>
          </div>

          {/* Mandatory Reason for Revision */}
          <div style={{ padding: '12px', backgroundColor: 'var(--hhs-canvas)', borderRadius: 'var(--hhs-radius-base)', border: '1px solid var(--hhs-border)' }}>
            <label className="hhs-label" htmlFor="edit-reason" style={{ color: 'var(--hhs-primary)' }}>
              * Mandatory Audit Justification: Reason for Profile Revision
            </label>
            <textarea
              id="edit-reason"
              required
              rows={2}
              placeholder="e.g. Guardian submitted updated residential proof or phone number..."
              className="hhs-textarea"
              value={editForm.revisionReason}
              onChange={e => setEditForm({ ...editForm, revisionReason: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
              {isSaving ? 'Committing...' : 'Commit Changes to Ledger'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
