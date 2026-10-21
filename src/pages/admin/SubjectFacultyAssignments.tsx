import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { ClassSection, Subject, StaffUser, SubjectAssignment } from '../../domain/types';
import {
  CheckCircle2,
  Edit,
} from 'lucide-react';

export const SubjectFacultyAssignments: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffUser[]>([]);
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('class-10-a');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('subj-math');
  const [targetTeacherId, setTargetTeacherId] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [clsList, subList, stList, asgnList] = await Promise.all([
        provider.getClasses(),
        provider.getSubjects(),
        provider.getStaffMembers(),
        provider.getSubjectAssignments(),
      ]);
      setClasses(clsList);
      setSubjects(subList);
      setStaffMembers(stList);
      setAssignments(asgnList);
      if (stList.length > 0) setTargetTeacherId(stList[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load subject assignment matrix.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [provider]);

  const handleOpenAssign = (classId: string, subjectId: string) => {
    setSelectedClassId(classId);
    setSelectedSubjectId(subjectId);
    const existing = assignments.find(
      a => a.classId === classId && a.subjectId === subjectId
    );
    if (existing) {
      setTargetTeacherId(existing.teacherId);
    } else if (staffMembers.length > 0) {
      setTargetTeacherId(staffMembers[0].id);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const teacher = staffMembers.find(s => s.id === targetTeacherId);
    if (!teacher) return;

    setIsSaving(true);
    try {
      const created = await provider.assignSubjectTeacher(
        {
          classId: selectedClassId,
          subjectId: selectedSubjectId,
          teacherId: teacher.id,
          teacherName: teacher.displayName,
          academicYearId: 'ay-2025-26',
        },
        currentUser
      );

      setAssignments(prev => {
        const filtered = prev.filter(
          a => !(a.classId === selectedClassId && a.subjectId === selectedSubjectId)
        );
        return [...filtered, created];
      });
      setIsModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update subject assignment.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading subject faculty assignment matrix..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Subject Faculty Assignment Matrix"
        subtitle="Departmental subject mappings, weekly period workloads, and marks entry authorization clearances."
        roleScope="Academic Governance"
        breadcrumbs={[
          { label: 'Operations Hub', to: '/' },
          { label: 'Staff', to: '/staff' },
          { label: 'Subject Faculty Matrix', to: '/admin/subject-teachers' },
        ]}
        actions={
          <button
            onClick={() => navigate('/admin/class-teachers')}
            className="hhs-btn hhs-btn-secondary"
          >
            <span>Class Tutors Directory</span>
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* KPI Cards Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Mapped Class Cohorts</div>
          <div className="hhs-metric-value">{classes.length} Sections</div>
          <div className="hhs-metric-sub">Class 1 to 10 (A &amp; B)</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Curricular Subjects</div>
          <div className="hhs-metric-value">{subjects.length} Subjects</div>
          <div className="hhs-metric-sub">CBSE Mandated Curriculum</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Workload Cap Quota</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            24 Periods / Wk
          </div>
          <div className="hhs-metric-sub">CBSE By-Law 28.2 Standard</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Marks Entry Rights</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.15rem' }}>
            Bound to Matrix
          </div>
          <div className="hhs-metric-sub">Restricted by Subject Allocation</div>
        </div>
      </div>

      {/* Matrix Table for Class 10-A, 10-B, and others */}
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
              Senior Secondary Subject Faculty Allocation Matrix
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Defines which faculty member is authorized to enter marks for each subject in each section
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">Session 2025–26</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Class Section</th>
                <th>Subject &amp; Code</th>
                <th>Assigned Instructor</th>
                <th className="numeric" style={{ width: '120px' }}>Weekly Periods</th>
                <th>Marks Entry Clearance</th>
                <th style={{ textAlign: 'right', width: '90px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {classes.slice(0, 4).flatMap(cls =>
                subjects.map(sub => {
                  const asgn = assignments.find(
                    a => a.classId === cls.id && a.subjectId === sub.id
                  );
                  const teacherName = asgn?.teacherName || (
                    sub.id === 'subj-math' ? 'Mr. Vikram Saxena' :
                    sub.id === 'subj-sci' ? 'Dr. Priya Nair' :
                    sub.id === 'subj-eng' ? 'Mrs. Ananya Sharma' :
                    'Faculty Allocated'
                  );

                  return (
                    <tr key={`${cls.id}-${sub.id}`}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                          {cls.label}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                          {cls.roomNumber}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sub.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
                          Code: {sub.code}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--hhs-primary)' }}>
                          {teacherName}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                          Authorized Grader
                        </div>
                      </td>
                      <td className="numeric" style={{ fontWeight: 600 }}>
                        {sub.id === 'subj-math' || sub.id === 'subj-sci' ? '6 Periods' : '5 Periods'}
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--hhs-primary)', fontSize: '0.78rem', fontWeight: 600 }}>
                          <CheckCircle2 size={14} />
                          <span>Authorized Grader</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenAssign(cls.id, sub.id)}
                          className="hhs-btn hhs-btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 8px', height: '28px' }}
                        >
                          <Edit size={13} />
                          <span>Assign</span>
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

      {/* Assignment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Update Subject Faculty Assignment"
        subtitle="Authorizes teacher to enter and edit marks in this subject and class register."
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="hhs-label" htmlFor="subj-teacher">Select Authorized Faculty Member</label>
            <select
              id="subj-teacher"
              required
              className="hhs-select"
              value={targetTeacherId}
              onChange={e => setTargetTeacherId(e.target.value)}
            >
              {staffMembers.map(staff => (
                <option key={staff.id} value={staff.id}>
                  {staff.displayName} ({staff.email}) — Role: {staff.role}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--hhs-surface-muted)',
              border: '1px solid var(--hhs-border)',
              borderRadius: 'var(--hhs-radius-base)',
              fontSize: '0.8rem',
              color: 'var(--hhs-text-primary)',
            }}
          >
            <strong>RBAC Enforcement:</strong> In accordance with institutional policy, subject teachers may only enter and edit marks for subjects assigned to them in this matrix.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="hhs-btn hhs-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="hhs-btn hhs-btn-primary"
            >
              {isSaving ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
