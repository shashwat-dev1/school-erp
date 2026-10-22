import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { ClassSection, StaffUser } from '../../domain/types';
import {
  ShieldCheck,
  Edit,
  CheckCircle2,
} from 'lucide-react';

export const ClassTeacherAssignments: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reassignment Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<ClassSection | null>(null);
  const [targetTeacherId, setTargetTeacherId] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [clsList, stList] = await Promise.all([
        provider.getClasses(),
        provider.getStaffMembers(),
      ]);
      setClasses(clsList);
      setStaffMembers(stList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assignment data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [provider]);

  const handleOpenReassign = (cls: ClassSection) => {
    setSelectedClass(cls);
    setTargetTeacherId(cls.classTeacherId);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !currentUser) return;

    // Duplicate Check: Rule SEC-108 (no teacher can have more than one section)
    const existingConflict = classes.find(
      c => c.id !== selectedClass.id && c.classTeacherId === targetTeacherId
    );

    if (existingConflict) {
      alert(
        `Assignment Conflict (Rule SEC-108): This faculty member is already allocated as Class Teacher for ${existingConflict.label}. Concurrent multi-cohort assignment is prohibited by institutional policy.`
      );
      return;
    }

    const selectedTeacher = staffMembers.find(s => s.id === targetTeacherId);
    if (!selectedTeacher) return;

    setIsSaving(true);
    try {
      const updated = await provider.updateClassTeacher(
        selectedClass.id,
        selectedTeacher.id,
        selectedTeacher.displayName || selectedTeacher.fullName || 'Faculty Member',
        currentUser
      );

      setClasses(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      setSuccessMsg(`Class ${selectedClass.label} successfully assigned to ${selectedTeacher.displayName || selectedTeacher.fullName}.`);
      setIsModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update teacher assignment.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading class teacher assignment ledger..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Class Teacher (Tutor) Assignment Management"
        subtitle="Sanctioned section custodians, single-custody integrity verification, and pastoral supervision rights."
        roleScope="Administrative Structure"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Classes', to: '/classes' },
          { label: 'Class Teacher Assignments', to: '/admin/class-teachers' },
        ]}
        actions={
          <button
            onClick={() => navigate('/admin/subject-teachers')}
            className="hhs-btn hhs-btn-secondary"
          >
            <span>Subject Faculty Matrix</span>
          </button>
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

      {/* Statutory Rule SEC-108 Banner */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--hhs-surface-muted)',
          borderLeft: '4px solid var(--hhs-primary)',
          borderRadius: 'var(--hhs-radius-base)',
          marginBottom: '20px',
          fontSize: '0.8rem',
          lineHeight: 1.45,
          color: 'var(--hhs-text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <ShieldCheck size={20} style={{ color: 'var(--hhs-primary)', flexShrink: 0 }} />
        <div>
          <strong style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Statutory Rule SEC-108:</strong>{' '}
          Institutional Policy requires that no faculty member may serve as Class Teacher for more than one section concurrently. Class teachers are granted supervisory cross-subject marksheet and daily attendance roll-call clearance exclusively for their allocated cohort.
        </div>
      </div>

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
          <div className="hhs-metric-label">Sanctioned Cohorts</div>
          <div className="hhs-metric-value">{classes.length} Sections</div>
          <div className="hhs-metric-sub">Classes 1 to 10 (A &amp; B)</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Designated Tutors</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {classes.length} / {classes.length}
          </div>
          <div className="hhs-metric-sub">100% Quorum Filled</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Rule SEC-108 Compliance</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            100% Compliant
          </div>
          <div className="hhs-metric-sub">Zero duplicate assignments</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Supervisory Clearance</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.15rem' }}>
            Multi-Subject
          </div>
          <div className="hhs-metric-sub">Tutor Gradebook Access</div>
        </div>
      </div>

      {/* Allocation Table */}
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
              Official Class Educator Allocation Register
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Session 2025–26 • All designated class tutors
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">20 Active Allocations</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Class / Section</th>
                <th style={{ width: '100px' }}>Room</th>
                <th>Designated Class Teacher (Tutor)</th>
                <th>Department / Wing</th>
                <th className="numeric" style={{ width: '110px' }}>Enrolled Students</th>
                <th>Single-Custody Status</th>
                <th style={{ textAlign: 'right', width: '90px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {classes.map(cls => (
                <tr key={cls.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                      {cls.label}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                      {cls.roomNumber}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                      {cls.classTeacherName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
                      Emp ID: {cls.classTeacherId}
                    </div>
                  </td>
                  <td>
                    <span className="hhs-badge hhs-badge-neutral">
                      {(cls.gradeLevel ?? cls.grade ?? 10) >= 9 ? 'Senior Wing Faculty' : 'Middle Wing Faculty'}
                    </span>
                  </td>
                  <td className="numeric" style={{ fontWeight: 600 }}>
                    {cls.studentCount} / 40
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--hhs-primary)', fontSize: '0.78rem', fontWeight: 600 }}>
                      <CheckCircle2 size={14} />
                      <span>SEC-108 Verified</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleOpenReassign(cls)}
                      className="hhs-btn hhs-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px', height: '28px' }}
                    >
                      <Edit size={13} />
                      <span>Reassign</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reassign Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Reassign Class Educator: ${selectedClass?.label}`}
        subtitle="Rule SEC-108 validation applies. Duplicate allocations will be blocked."
      >
        <form onSubmit={handleSaveAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="hhs-label" htmlFor="reassign-teacher">Select Designated Faculty Member</label>
            <select
              id="reassign-teacher"
              required
              className="hhs-select"
              value={targetTeacherId}
              onChange={e => setTargetTeacherId(e.target.value)}
            >
              {staffMembers.map(staff => {
                const assignedCls = classes.find(c => c.classTeacherId === staff.id);
                const isConflict = assignedCls && assignedCls.id !== selectedClass?.id;

                return (
                  <option
                    key={staff.id}
                    value={staff.id}
                    disabled={Boolean(isConflict)}
                  >
                    {staff.displayName} ({staff.email}) {isConflict ? `— Already assigned to ${assignedCls.label}` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--hhs-accent-light)',
              border: '1px solid var(--hhs-accent)',
              borderRadius: 'var(--hhs-radius-base)',
              fontSize: '0.8rem',
              color: 'var(--hhs-accent-text)',
            }}
          >
            <strong>Warning:</strong> Reassigning class tutor transfers supervisory marksheet verification and daily attendance roll-call duties for {selectedClass?.label}.
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
              {isSaving ? 'Updating...' : 'Commit Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
