import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { StudentRecord, ClassSection } from '../../domain/types';
import type { NewStudentInput } from '../../data/provider';
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Phone,
  Home,
  ShieldAlert,
} from 'lucide-react';

export const StudentDirectory: React.FC = () => {
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'flagged' | 'below75'>('all');

  // Detail Drawer
  const [activeStudent, setActiveStudent] = useState<StudentRecord | null>(null);

  // New Student Modal
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const [newStudentForm, setNewStudentForm] = useState<NewStudentInput>({
    admissionNumber: '',
    rollNumber: 1,
    firstName: '',
    lastName: '',
    gender: 'M',
    dateOfBirth: '2010-01-01',
    enrollmentDate: new Date().toISOString().split('T')[0],
    classId: 'class-10-a',
    guardianName: '',
    guardianRelation: 'Father',
    primaryPhone: '+91 98290 ',
    residentialAddress: 'Jaipur, Rajasthan',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const isClassTeacher = currentUser?.role === 'class_teacher';
        const defaultClass = isClassTeacher ? (currentUser.assignedClassId || 'class-10-a') : 'all';
        setSelectedClass(defaultClass);

        const [studentRes, classRes] = await Promise.all([
          provider.getStudents({ limit: 1000 }),
          provider.getClasses(),
        ]);
        if (!isMounted) return;
        setStudents(studentRes.items);
        setClasses(classRes);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to retrieve students.';
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  // Client-side filtering for fast interactive ledger experience
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        s.rollNumber.toString().includes(q);

      const matchesClass = selectedClass === 'all' || s.classId === selectedClass;

      let matchesAttendance = true;
      if (attendanceFilter === 'flagged') {
        matchesAttendance = Boolean(s.activeFlags && s.activeFlags.length > 0);
      } else if (attendanceFilter === 'below75') {
        matchesAttendance = s.attendancePercentage < 75;
      }

      return matchesSearch && matchesClass && matchesAttendance;
    });
  }, [students, searchQuery, selectedClass, attendanceFilter]);

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      const created = await provider.createStudent(newStudentForm, currentUser);
      setStudents(prev => [created, ...prev]);
      setIsEnrollModalOpen(false);
      // Reset form
      setNewStudentForm({
        admissionNumber: '',
        rollNumber: 1,
        firstName: '',
        lastName: '',
        gender: 'M',
        dateOfBirth: '2010-01-01',
        enrollmentDate: new Date().toISOString().split('T')[0],
        classId: 'class-10-a',
        guardianName: '',
        guardianRelation: 'Father',
        primaryPhone: '+91 98290 ',
        residentialAddress: 'Jaipur, Rajasthan',
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<StudentRecord>[] = [
    {
      key: 'rollNumber',
      header: 'Roll #',
      width: '70px',
      render: s => <span className="numeric tnum" style={{ fontWeight: 600 }}>{s.rollNumber}</span>,
    },
    {
      key: 'name',
      header: 'Student Name & Admission',
      render: s => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
            {s.firstName} {s.lastName}
          </div>
          <div className="tnum" style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
            {s.admissionNumber} • {s.gender === 'M' ? 'Boy' : s.gender === 'F' ? 'Girl' : 'Other'}
          </div>
        </div>
      ),
    },
    {
      key: 'classLabel',
      header: 'Class & Section',
      width: '120px',
      render: s => <span style={{ fontWeight: 500 }}>{s.classLabel}</span>,
    },
    {
      key: 'guardian',
      header: 'Guardian & Contact',
      render: s => (
        <div style={{ fontSize: '0.8rem' }}>
          <div>{s.guardianName} ({s.guardianRelation})</div>
          <div className="tnum" style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.72rem' }}>
            {s.primaryPhone}
          </div>
        </div>
      ),
    },
    {
      key: 'attendance',
      header: 'Attendance (YTD)',
      width: '130px',
      render: s => {
        const isBelow75 = s.attendancePercentage < 75;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              className="numeric tnum"
              style={{
                fontWeight: 700,
                color: isBelow75 ? 'var(--hhs-danger-text)' : 'var(--hhs-text-primary)',
              }}
            >
              {s.attendancePercentage}%
            </span>
            {isBelow75 && (
              <span
                className="hhs-badge hhs-badge-danger"
                style={{ fontSize: '0.65rem', padding: '2px 4px' }}
                title="Below CBSE mandatory 75% threshold"
              >
                &lt;75%
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'flags',
      header: 'Explainable Care Flags',
      render: s => {
        if (!s.activeFlags || s.activeFlags.length === 0) {
          return <span style={{ color: 'var(--hhs-text-muted)', fontSize: '0.74rem' }}>None</span>;
        }
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {s.activeFlags.map((f, idx) => (
              <span
                key={idx}
                className={f.severity === 'alert' ? 'hhs-badge hhs-badge-danger' : 'hhs-badge hhs-badge-accent'}
                style={{ fontSize: '0.68rem', cursor: 'help' }}
                title={f.reason}
              >
                #{f.code}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      render: s => <StatusBadge status={s.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '80px',
      render: s => (
        <button
          onClick={() => setActiveStudent(s)}
          className="hhs-btn hhs-btn-secondary hhs-btn-sm"
          style={{ fontSize: '0.74rem', padding: '4px 8px' }}
        >
          Dossier
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="Student Ledger & Profiles"
        subtitle="HanuJai High School, Jaipur • Official master student records, demographic registry, and attendance compliance."
        breadcrumbs={[
          { label: 'Campus' },
          { label: 'Student Directory' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                alert('Exporting student cohort in CBSE Pariksha Sangam compatible CSV format...');
              }}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileSpreadsheet size={15} />
              <span>Export CSV</span>
            </button>
            {(currentUser?.role === 'principal' || currentUser?.role === 'office_admin') && (
              <button
                onClick={() => setIsEnrollModalOpen(true)}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} />
                <span>Enroll New Student</span>
              </button>
            )}
          </div>
        }
      />

      {error && <ErrorBanner title="Error Loading Records" message={error} />}

      {/* Filter and Search Controls */}
      <div
        className="hhs-card"
        style={{
          padding: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', flex: 1, minWidth: '280px' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--hhs-text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search by student name, roll number, or admission ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="hhs-input"
              style={{ paddingLeft: '32px' }}
            />
          </div>

          {/* Class Section Select */}
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="hhs-select"
            style={{ width: '170px' }}
          >
            {currentUser?.role !== 'class_teacher' && (
              <option value="all">
                {currentUser?.role === 'subject_teacher' ? 'All Assigned Classes' : 'All 20 Classes'}
              </option>
            )}
            {classes
              .filter(c => {
                if (!currentUser) return true;
                if (currentUser.role === 'class_teacher') {
                  return c.id === currentUser.assignedClassId;
                }
                if (currentUser.role === 'subject_teacher') {
                  return currentUser.assignedClasses?.includes(c.id);
                }
                return true;
              })
              .map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>

          {/* Attendance Compliance Filter */}
          <select
            value={attendanceFilter}
            onChange={e => setAttendanceFilter(e.target.value as 'all' | 'flagged' | 'below75')}
            className="hhs-select"
            style={{ width: '190px' }}
          >
            <option value="all">All Attendance Levels</option>
            <option value="flagged">Active Care Flags</option>
            <option value="below75">Below 75% (CBSE Risk)</option>
          </select>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
          Showing <strong className="tnum">{filteredStudents.length}</strong> of{' '}
          <strong className="tnum">{students.length}</strong> enrolled students
        </div>
      </div>

      {/* Main Ledger Table */}
      {isLoading ? (
        <LoadingState message="Fetching institutional student ledger..." />
      ) : (
        <DataTable
          columns={columns}
          data={filteredStudents}
          keyExtractor={s => s.id}
          emptyMessage="No students match the current filters or search term."
        />
      )}

      {/* Student Dossier Drawer */}
      <Drawer
        isOpen={Boolean(activeStudent)}
        onClose={() => setActiveStudent(null)}
        title={
          activeStudent
            ? `${activeStudent.firstName} ${activeStudent.lastName}`
            : 'Student Profile'
        }
        subtitle={
          activeStudent
            ? `Admission #${activeStudent.admissionNumber} • Roll #${activeStudent.rollNumber} • ${activeStudent.classLabel}`
            : ''
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => setActiveStudent(null)}
              className="hhs-btn hhs-btn-secondary"
            >
              Close
            </button>
          </div>
        }
      >
        {activeStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Identity Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--hhs-canvas)',
                border: '1px solid var(--hhs-border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                fontSize: '0.84rem',
              }}
            >
              <div>
                <span className="hhs-label">Gender & DoB</span>
                <div>{activeStudent.gender === 'M' ? 'Male' : 'Female'} • {activeStudent.dateOfBirth}</div>
              </div>
              <div>
                <span className="hhs-label">Enrollment Date</span>
                <div className="tnum">{activeStudent.enrollmentDate}</div>
              </div>
              <div>
                <span className="hhs-label">Current Academic Standing</span>
                <StatusBadge status={activeStudent.status} />
              </div>
              <div>
                <span className="hhs-label">Attendance Rate (YTD)</span>
                <span
                  className="tnum"
                  style={{
                    fontWeight: 700,
                    color: activeStudent.attendancePercentage < 75 ? 'var(--hhs-danger)' : 'var(--hhs-primary)',
                  }}
                >
                  {activeStudent.attendancePercentage}%
                </span>
              </div>
            </div>

            {/* Guardian & Emergency Contact */}
            <div className="hhs-card" style={{ padding: '16px' }}>
              <h4 className="hhs-headline-sm" style={{ fontSize: '0.86rem', marginBottom: '12px' }}>
                Guardian & Residence
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={15} color="var(--hhs-text-secondary)" />
                  <span>
                    <strong>{activeStudent.guardianName}</strong> ({activeStudent.guardianRelation})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={15} color="var(--hhs-text-secondary)" />
                  <span className="tnum">{activeStudent.primaryPhone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <Home size={15} color="var(--hhs-text-secondary)" style={{ marginTop: '2px' }} />
                  <span>{activeStudent.residentialAddress}</span>
                </div>
              </div>
            </div>

            {/* Explainable Care Rules */}
            <div className="hhs-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 className="hhs-headline-sm" style={{ fontSize: '0.86rem' }}>
                  Explainable Care Rules & Triggers
                </h4>
                <ShieldAlert size={16} color="var(--hhs-accent)" />
              </div>

              {activeStudent.activeFlags && activeStudent.activeFlags.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeStudent.activeFlags.map((flag, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--hhs-radius-base)',
                        backgroundColor: 'var(--hhs-canvas)',
                        border: '1px solid var(--hhs-border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="hhs-badge hhs-badge-accent">#{flag.code}</span>
                        <span className="tnum" style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
                          Triggered: {flag.triggeredAt.split('T')[0]}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: '4px' }}>
                        {flag.title}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
                        <strong>Trigger Reason:</strong> {flag.reason}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                  This student has no active alerts or disciplinary notices.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Enroll New Student Modal */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title="Enroll New Student"
        subtitle="Master student admission record for HanuJai High School, Jaipur."
      >
        <form onSubmit={handleEnrollSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="first-name">First Name</label>
              <input
                id="first-name"
                required
                className="hhs-input"
                value={newStudentForm.firstName}
                onChange={e => setNewStudentForm({ ...newStudentForm, firstName: e.target.value })}
                placeholder="e.g. Aarav"
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="last-name">Last Name</label>
              <input
                id="last-name"
                required
                className="hhs-input"
                value={newStudentForm.lastName}
                onChange={e => setNewStudentForm({ ...newStudentForm, lastName: e.target.value })}
                placeholder="e.g. Sharma"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="adm-no">Admission #</label>
              <input
                id="adm-no"
                required
                className="hhs-input"
                value={newStudentForm.admissionNumber}
                onChange={e => setNewStudentForm({ ...newStudentForm, admissionNumber: e.target.value })}
                placeholder="HJ-2025-1045"
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="roll-no">Roll #</label>
              <input
                id="roll-no"
                type="number"
                required
                min={1}
                max={50}
                className="hhs-input"
                value={newStudentForm.rollNumber}
                onChange={e => setNewStudentForm({ ...newStudentForm, rollNumber: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="gender">Gender</label>
              <select
                id="gender"
                className="hhs-select"
                value={newStudentForm.gender}
                onChange={e => setNewStudentForm({ ...newStudentForm, gender: e.target.value as 'M' | 'F' | 'Other' })}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="class-select">Assigned Class</label>
              <select
                id="class-select"
                className="hhs-select"
                value={newStudentForm.classId}
                onChange={e => setNewStudentForm({ ...newStudentForm, classId: e.target.value })}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.classTeacherName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="hhs-label" htmlFor="dob">Date of Birth</label>
              <input
                id="dob"
                type="date"
                required
                className="hhs-input"
                value={newStudentForm.dateOfBirth}
                onChange={e => setNewStudentForm({ ...newStudentForm, dateOfBirth: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="guardian-name">Guardian Name</label>
              <input
                id="guardian-name"
                required
                className="hhs-input"
                value={newStudentForm.guardianName}
                onChange={e => setNewStudentForm({ ...newStudentForm, guardianName: e.target.value })}
                placeholder="Parent / Guardian Name"
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="relation">Relation</label>
              <select
                id="relation"
                className="hhs-select"
                value={newStudentForm.guardianRelation}
                onChange={e => setNewStudentForm({ ...newStudentForm, guardianRelation: e.target.value as 'Father' | 'Mother' | 'Guardian' })}
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="phone">Primary Phone</label>
              <input
                id="phone"
                required
                className="hhs-input"
                value={newStudentForm.primaryPhone}
                onChange={e => setNewStudentForm({ ...newStudentForm, primaryPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="address">Residential City / Area</label>
              <input
                id="address"
                required
                className="hhs-input"
                value={newStudentForm.residentialAddress}
                onChange={e => setNewStudentForm({ ...newStudentForm, residentialAddress: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(false)}
              className="hhs-btn hhs-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="hhs-btn hhs-btn-primary"
            >
              {isSubmitting ? 'Registering...' : 'Complete Enrollment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
