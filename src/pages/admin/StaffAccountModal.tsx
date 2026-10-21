import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import type { StaffUser } from '../../domain/types';

interface StaffAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingStaff: StaffUser | null;
  onSaved: () => void;
}

export const StaffAccountModal: React.FC<StaffAccountModalProps> = ({
  isOpen,
  onClose,
  editingStaff,
  onSaved,
}) => {
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [displayName, setDisplayName] = useState<string>(editingStaff?.displayName || '');
  const [email, setEmail] = useState<string>(editingStaff?.email || '');
  const [role, setRole] = useState<StaffUser['role']>(editingStaff?.role || 'subject_teacher');
  const [department, setDepartment] = useState<string>(
    editingStaff?.role === 'office_admin' ? 'Administration' : 'Academic Faculty'
  );
  const [phone, setPhone] = useState<string>('+91 98290 ');
  const [tempPassword, setTempPassword] = useState<string>('HanuJai@2025');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if editingStaff changes
  React.useEffect(() => {
    if (editingStaff) {
      setDisplayName(editingStaff.displayName || editingStaff.fullName || '');
      setEmail(editingStaff.email);
      setRole(editingStaff.role);
    } else {
      setDisplayName('');
      setEmail('');
      setRole('subject_teacher');
    }
  }, [editingStaff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    setError(null);
    try {
      if (editingStaff) {
        await provider.updateStaffMember(
          editingStaff.id,
          {
            displayName,
            email,
            role,
          },
          currentUser
        );
      } else {
        await provider.createStaffMember(
          {
            displayName,
            email,
            role,
            assignedClassId: role === 'class_teacher' ? 'class-10-a' : undefined,
            assignedSubjectIds: role === 'subject_teacher' ? ['subj-math'] : undefined,
          },
          currentUser
        );
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save staff account.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingStaff ? `Edit Account: ${editingStaff.displayName}` : 'Provision Institutional Staff Account'}
      subtitle="Staff identity record bound to Firebase Authentication UID and RBAC clearance."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {error && (
          <div style={{ color: 'var(--hhs-danger-text)', fontSize: '0.82rem', padding: '8px', backgroundColor: 'var(--hhs-danger-light)', borderRadius: 'var(--hhs-radius-base)' }}>
            {error}
          </div>
        )}

        <div>
          <label className="hhs-label" htmlFor="staff-name">Full Faculty Name</label>
          <input
            id="staff-name"
            required
            className="hhs-input"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Dr. Rajesh Sharma"
          />
        </div>

        <div>
          <label className="hhs-label" htmlFor="staff-email">Institutional Email Address</label>
          <input
            id="staff-email"
            type="email"
            required
            className="hhs-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@hanujai.edu.in"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="hhs-label" htmlFor="staff-role">RBAC Institutional Role</label>
            <select
              id="staff-role"
              className="hhs-select"
              value={role}
              onChange={e => setRole(e.target.value as StaffUser['role'])}
            >
              <option value="principal">Principal (Full Authority)</option>
              <option value="office_admin">Office Registrar / Admin</option>
              <option value="class_teacher">Class Teacher / Tutor</option>
              <option value="subject_teacher">Subject Faculty</option>
            </select>
          </div>

          <div>
            <label className="hhs-label" htmlFor="staff-dept">Department</label>
            <select
              id="staff-dept"
              className="hhs-select"
              value={department}
              onChange={e => setDepartment(e.target.value)}
            >
              <option value="Academic Faculty">Academic Faculty</option>
              <option value="Mathematics Department">Mathematics Department</option>
              <option value="Science Department">Science Department</option>
              <option value="Languages Department">Languages Department</option>
              <option value="Administration">Administration &amp; Registrar</option>
            </select>
          </div>
        </div>

        {!editingStaff && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="staff-phone">Contact Phone</label>
              <input
                id="staff-phone"
                className="hhs-input"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="staff-pwd">Initial Temporary Password</label>
              <input
                id="staff-pwd"
                type="text"
                className="hhs-input"
                value={tempPassword}
                onChange={e => setTempPassword(e.target.value)}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            className="hhs-btn hhs-btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="hhs-btn hhs-btn-primary"
          >
            {isSaving ? 'Provisioning...' : editingStaff ? 'Save Changes' : 'Provision Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
