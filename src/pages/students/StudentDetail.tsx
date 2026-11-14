/**
 * HanuJai High School ERP — Student Master Profile
 * Phase 1 Scope: Student Information Management + Attendance History
 * Focus: Student identity, enrollment details, parent/guardian contacts, and CBSE attendance records.
 */

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
import type { StudentRecord, AuditEvent, AttendanceSession, AttendanceCorrection } from '../../domain/types';
import { Permissions } from '../../domain/permissions';
import {
  User,
  CalendarCheck,
  History,
  FileSpreadsheet,
  ArrowLeft,
  Phone,
  Home,
  Edit,
  FileText,
} from 'lucide-react';
import { downloadStudentAttendanceXlsx } from '../../utils/exportUtils';
import { StudentDocumentsTab } from './StudentDocumentsTab';

export const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Attendance data
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [attendanceCorrections, setAttendanceCorrections] = useState<AttendanceCorrection[]>([]);
  const [auditHistory, setAuditHistory] = useState<AuditEvent[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'absent'>('all');

  // Edit Modal for Contact Details
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
          setError(`No student record exists matching identifier #${id}`);
          setIsLoading(false);
          return;
        }

        // Check view permissions
        if (!Permissions.canViewStudent(currentUser, studentDoc)) {
          setError('Access restricted: You do not have permission to view students outside your assigned section.');
          setIsLoading(false);
          return;
        }

        setStudent(studentDoc);
        setEditForm({
          firstName: studentDoc.firstName,
          lastName: studentDoc.lastName,
          primaryPhone: studentDoc.primaryPhone || '',
          residentialAddress: studentDoc.residentialAddress || '',
          guardianName: studentDoc.guardianName || '',
          guardianRelation: studentDoc.guardianRelation || 'Father',
          revisionReason: '',
        });

        // Compute 90-day attendance date range
        const today = new Date();
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - 90);
        const startStr = pastDate.toISOString().split('T')[0];
        const endStr = today.toISOString().split('T')[0];

        const [sessions, corrections, audit] = await Promise.all([
          provider.getAttendanceSessionsInRange(startStr, endStr, [studentDoc.classId]),
          provider.getAttendanceCorrections(studentDoc.classId),
          provider.getAuditEvents ? provider.getAuditEvents({ resource: studentDoc.id, limit: 10 }) : Promise.resolve([]),
        ]);

        if (!isMounted) return;
        setAttendanceSessions(sessions);
        setAttendanceCorrections(corrections.filter(c => c.studentId === studentDoc.id));
        setAuditHistory(audit);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to retrieve student dossier.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStudentData();
    return () => {
      isMounted = false;
    };
  }, [id, provider, currentUser]);

  if (isLoading) {
    return <LoadingState message="Loading student profile..." />;
  }

  if (error || !student) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PageHeader
          title="Student Profile"
          breadcrumbs={[{ label: 'Students', to: '/students' }, { label: 'Record' }]}
        />
        <ErrorBanner title="Could not load record" message={error || 'Student not found.'} />
        <button
          onClick={() => navigate('/students')}
          className="hhs-btn hhs-btn-secondary"
          style={{ width: 'fit-content' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Students</span>
        </button>
      </div>
    );
  }

  const canEdit = Permissions.canEditStudentContact(currentUser, student);
  const canViewAttendance = Permissions.canViewIndividualAttendance(currentUser, student.classId);
  const canViewDocuments = Permissions.canViewStudentDocuments(currentUser);

  // Compile individual attendance log
  const studentLogs = attendanceSessions
    .map(session => {
      const entry = session.records.find(r => r.studentId === student.id);
      const correction = attendanceCorrections.find(c => c.date === session.date);
      return {
        date: session.date,
        day: new Date(session.date).toLocaleDateString('en-IN', { weekday: 'short' }),
        state: entry ? entry.state : ('unmarked' as const),
        remarks: entry?.remarks || '',
        correction: correction ? `${correction.previousState.toUpperCase()} → ${correction.requestedState.toUpperCase()}: ${correction.mandatoryReason}` : undefined,
        recordedBy: session.takenByStaffName || session.markedByStaffId || 'Class Teacher',
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalSessions = studentLogs.filter(l => l.state === 'present' || l.state === 'absent').length;
  const presentDays = studentLogs.filter(l => l.state === 'present').length;
  const absentDays = studentLogs.filter(l => l.state === 'absent').length;
  const attendanceRate = totalSessions > 0
    ? Math.round((presentDays / totalSessions) * 100)
    : student.attendancePercentage;

  const filteredLogs = studentLogs.filter(l => {
    if (attendanceFilter === 'present') return l.state === 'present';
    if (attendanceFilter === 'absent') return l.state === 'absent';
    return true;
  });

  const handleExportExcel = () => {
    const exportRows = studentLogs.map(l => ({
      date: l.date,
      day: l.day,
      status: l.state === 'present' ? ('Present' as const) : l.state === 'absent' ? ('Absent' as const) : ('Unmarked' as const),
      remarks: l.remarks || l.correction || '',
      correctionInfo: l.correction,
    }));
    downloadStudentAttendanceXlsx(student, exportRows);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !student) return;
    setIsSaving(true);
    try {
      await provider.updateStudent(
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
        editForm.revisionReason || 'Contact and residence update'
      );
      setStudent({
        ...student,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        primaryPhone: editForm.primaryPhone,
        residentialAddress: editForm.residentialAddress,
        guardianName: editForm.guardianName,
        guardianRelation: editForm.guardianRelation,
      });
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update record.');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Student Information', icon: <User size={15} /> },
    ...(canViewDocuments
      ? [{ id: 'documents', label: 'Documents', icon: <FileText size={15} /> }]
      : []),
    ...(canViewAttendance
      ? [{ id: 'attendance', label: 'Attendance Profile & History', icon: <CalendarCheck size={15} /> }]
      : []),
    ...(auditHistory.length > 0
      ? [{ id: 'audit', label: 'Audit Log', icon: <History size={15} /> }]
      : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`Admission #${student.admissionNumber} • Roll #${student.rollNumber} • ${student.classLabel}`}
        breadcrumbs={[
          { label: 'Students', to: '/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {canViewAttendance && (
              <button
                onClick={handleExportExcel}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileSpreadsheet size={15} />
                <span>Export Attendance (Excel)</span>
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit size={15} />
                <span>Update Contact</span>
              </button>
            )}
            <button
              onClick={() => navigate('/students')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>
          </div>
        }
      />

      {/* Hero Student Summary Card */}
      <div
        className="hhs-card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          backgroundColor: '#0A1931',
          color: '#FFFFFF',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '9999px',
              backgroundColor: '#F5A623',
              color: '#0A1931',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.4rem',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {student.firstName[0]}
            {student.lastName[0]}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                {student.firstName} {student.lastName}
              </h2>
              <StatusBadge status={student.status} />
            </div>
            <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: '4px' }}>
              Admission: <strong>{student.admissionNumber}</strong> • Roll No: <strong>{student.rollNumber}</strong> • Class: <strong>{student.classLabel}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
              Attendance Rate
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: attendanceRate >= 75 ? '#10B981' : '#F5A623' }} className="tnum">
              {attendanceRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={tabs}
      />

      {/* TAB 1: Profile Information */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <style>{`
            @media (max-width: 800px) {
              div[style*="gridTemplateColumns: 1fr 1fr"] {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>

          {/* Student Details */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={16} color="var(--hhs-primary)" />
              <span>Student Details</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.85rem' }}>
              <div>
                <span className="hhs-label">Admission Number</span>
                <div style={{ fontWeight: 600 }}>{student.admissionNumber}</div>
              </div>
              <div>
                <span className="hhs-label">Roll Number</span>
                <div style={{ fontWeight: 600 }}>{student.rollNumber}</div>
              </div>
              <div>
                <span className="hhs-label">Class & Section</span>
                <div style={{ fontWeight: 600 }}>{student.classLabel}</div>
              </div>
              <div>
                <span className="hhs-label">Date of Birth</span>
                <div>{student.dateOfBirth}</div>
              </div>
              <div>
                <span className="hhs-label">Gender</span>
                <div>{student.gender === 'M' ? 'Male' : student.gender === 'F' ? 'Female' : 'Other'}</div>
              </div>
              <div>
                <span className="hhs-label">Admission Date</span>
                <div>{student.enrollmentDate}</div>
              </div>
              <div>
                <span className="hhs-label">Current Enrolment Status</span>
                <StatusBadge status={student.status} />
              </div>
            </div>
          </div>

          {/* Guardian & Emergency Contact */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="hhs-headline-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={16} color="var(--hhs-primary)" />
                <span>Parent / Guardian & Residence</span>
              </h3>
              {canEdit && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                >
                  Edit Contact
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div>
                <span className="hhs-label">Primary Guardian</span>
                <div style={{ fontWeight: 600 }}>
                  {student.guardianName} ({student.guardianRelation})
                </div>
              </div>
              <div>
                <span className="hhs-label">Primary Contact Number (WhatsApp Alerts)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <Phone size={14} color="#10B981" />
                  <span className="tnum">{student.primaryPhone || 'No contact phone recorded'}</span>
                </div>
              </div>
              <div>
                <span className="hhs-label">Residential Address</span>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <Home size={14} color="var(--hhs-text-secondary)" style={{ marginTop: '2px' }} />
                  <span>{student.residentialAddress || 'Jaipur, Rajasthan, India'}</span>
                </div>
              </div>
              <div>
                <span className="hhs-label">City & State</span>
                <div>{student.city || 'Jaipur'}, {student.state || 'Rajasthan'} ({student.pincode || '302039'})</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Student Documents (9 Mandatory Slots) */}
      {activeTab === 'documents' && canViewDocuments && (
        <StudentDocumentsTab student={student} currentUser={currentUser} />
      )}

      {/* TAB 2: Attendance Profile & History */}
      {activeTab === 'attendance' && canViewAttendance && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Attendance KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="hhs-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--hhs-text-muted)', textTransform: 'uppercase' }}>
                Attendance Rate (90d)
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: attendanceRate >= 75 ? '#10B981' : '#EF4444', margin: '6px 0' }} className="tnum">
                {attendanceRate}%
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                {attendanceRate >= 75 ? '✓ Compliant with CBSE 75% rule' : '⚠ Below required threshold'}
              </div>
            </div>

            <div className="hhs-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--hhs-text-muted)', textTransform: 'uppercase' }}>
                Days Present
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', margin: '6px 0' }} className="tnum">
                {presentDays}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                Recorded present in class
              </div>
            </div>

            <div className="hhs-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--hhs-text-muted)', textTransform: 'uppercase' }}>
                Days Absent
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#DC2626', margin: '6px 0' }} className="tnum">
                {absentDays}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                Recorded absent from roll call
              </div>
            </div>

            <div className="hhs-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--hhs-text-muted)', textTransform: 'uppercase' }}>
                Total Evaluated Sessions
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', margin: '6px 0' }} className="tnum">
                {totalSessions}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                Sessions logged this term
              </div>
            </div>
          </div>

          {/* Filter Bar & History Table */}
          <div className="hhs-card" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hhs-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0 }}>Daily Attendance Register Logs</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
                  Chronological records for the last 90 calendar days
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setAttendanceFilter('all')}
                  className={`hhs-btn hhs-btn-sm ${attendanceFilter === 'all' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                >
                  All ({studentLogs.length})
                </button>
                <button
                  onClick={() => setAttendanceFilter('present')}
                  className={`hhs-btn hhs-btn-sm ${attendanceFilter === 'present' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                >
                  Present ({presentDays})
                </button>
                <button
                  onClick={() => setAttendanceFilter('absent')}
                  className={`hhs-btn hhs-btn-sm ${attendanceFilter === 'absent' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                >
                  Absent ({absentDays})
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--hhs-canvas)', borderBottom: '1px solid var(--hhs-border)' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--hhs-text-secondary)' }}>Date</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--hhs-text-secondary)' }}>Day</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--hhs-text-secondary)' }}>Status</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--hhs-text-secondary)' }}>Remarks / Audit</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--hhs-text-secondary)' }}>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(l => (
                    <tr key={l.date} style={{ borderBottom: '1px solid var(--hhs-border)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }} className="tnum">{l.date}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--hhs-text-secondary)' }}>{l.day}</td>
                      <td style={{ padding: '10px 16px' }}>
                        {l.state === 'present' ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#D1FAE5', color: '#065F46', fontWeight: 700, fontSize: '0.74rem' }}>
                            ✓ Present
                          </span>
                        ) : l.state === 'absent' ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: '0.74rem' }}>
                            ✕ Absent
                          </span>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#64748B', fontSize: '0.74rem' }}>
                            Unmarked
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--hhs-text-secondary)' }}>
                        {l.correction ? (
                          <span style={{ color: '#D97706', fontWeight: 600 }}>{l.correction}</span>
                        ) : (
                          l.remarks || '—'
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--hhs-text-secondary)' }}>{l.recordedBy}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-muted)' }}>
                        No attendance records match the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Audit Log */}
      {activeTab === 'audit' && auditHistory.length > 0 && (
        <div className="hhs-card" style={{ padding: '20px' }}>
          <h3 className="hhs-headline-sm" style={{ marginBottom: '14px' }}>Administrative Record Changes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {auditHistory.map(evt => (
              <div
                key={evt.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--hhs-canvas)',
                  border: '1px solid var(--hhs-border)',
                  fontSize: '0.80rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hhs-text-secondary)' }}>
                  <span>Action: <strong>{evt.action}</strong> by {evt.actorName || evt.actorId}</span>
                  <span className="tnum">{evt.timestamp}</span>
                </div>
                {evt.summary && (
                  <div style={{ marginTop: '4px', color: 'var(--hhs-text-primary)' }}>
                    Summary: {evt.summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Update Student Information"
        subtitle={`Revision for ${student.firstName} ${student.lastName} (Admission #${student.admissionNumber})`}
      >
        <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label">First Name</label>
              <input
                required
                className="hhs-input"
                value={editForm.firstName}
                onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="hhs-label">Last Name</label>
              <input
                required
                className="hhs-input"
                value={editForm.lastName}
                onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label">Guardian Name</label>
              <input
                required
                className="hhs-input"
                value={editForm.guardianName}
                onChange={e => setEditForm({ ...editForm, guardianName: e.target.value })}
              />
            </div>
            <div>
              <label className="hhs-label">Guardian Relation</label>
              <select
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

          <div>
            <label className="hhs-label">Primary Contact Number (WhatsApp Alerts)</label>
            <input
              required
              className="hhs-input"
              value={editForm.primaryPhone}
              onChange={e => setEditForm({ ...editForm, primaryPhone: e.target.value })}
              placeholder="+91 98290 12345"
            />
          </div>

          <div>
            <label className="hhs-label">Residential Address</label>
            <input
              required
              className="hhs-input"
              value={editForm.residentialAddress}
              onChange={e => setEditForm({ ...editForm, residentialAddress: e.target.value })}
            />
          </div>

          <div>
            <label className="hhs-label">Reason for Revision</label>
            <input
              required
              className="hhs-input"
              value={editForm.revisionReason}
              onChange={e => setEditForm({ ...editForm, revisionReason: e.target.value })}
              placeholder="e.g. Guardian phone number update per parent request"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
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
              {isSaving ? 'Saving...' : 'Save Revisions'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
