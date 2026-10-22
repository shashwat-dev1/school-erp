import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import type { StudentRecord } from '../../domain/types';
import type { NewIncidentInput } from '../../data/provider';

interface NewObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentRecord[];
  onIncidentCreated: () => void;
}

export const NewObservationModal: React.FC<NewObservationModalProps> = ({
  isOpen,
  onClose,
  students,
  onIncidentCreated,
}) => {
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [studentId, setStudentId] = useState<string>(students[0]?.id || '');
  const [category, setCategory] = useState<NewIncidentInput['category']>('commendation');
  const [severity, setSeverity] = useState<NewIncidentInput['severity']>('commendation');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [actionTaken, setActionTaken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial studentId if empty and students loaded
  React.useEffect(() => {
    if (!studentId && students.length > 0) {
      setStudentId(students[0].id);
    }
  }, [students, studentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !studentId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await provider.createIncident(
        {
          studentId,
          category,
          severity,
          title,
          description,
          actionTaken,
        },
        currentUser
      );
      onIncidentCreated();
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setActionTaken('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save student note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Student Note"
      subtitle="Record a factual observation or academic note for a student."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {error && (
          <div
            style={{
              color: 'var(--hhs-danger-text)',
              fontSize: '0.82rem',
              padding: '8px 12px',
              backgroundColor: 'var(--hhs-danger-light)',
              borderRadius: 'var(--hhs-radius-base)',
              border: '1px solid var(--hhs-danger)',
            }}
          >
            {error}
          </div>
        )}

        <div>
          <label className="hhs-label" htmlFor="obs-student">
            Select Student
          </label>
          <select
            id="obs-student"
            required
            className="hhs-select"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
          >
            {students.length === 0 ? (
              <option value="">No students available</option>
            ) : (
              students.map(s => (
                <option key={s.id} value={s.id}>
                  Roll {s.rollNumber} — {s.firstName} {s.lastName} ({s.admissionNumber})
                </option>
              ))
            )}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="hhs-label" htmlFor="obs-cat">
              Note Type
            </label>
            <select
              id="obs-cat"
              className="hhs-select"
              value={category}
              onChange={e => setCategory(e.target.value as NewIncidentInput['category'])}
            >
              <option value="commendation">Positive Progress / Commendation</option>
              <option value="academic_integrity">Academic Progress & Integrity</option>
              <option value="conduct_discipline">General Conduct</option>
              <option value="punctuality">Attendance / Punctuality</option>
            </select>
          </div>

          <div>
            <label className="hhs-label" htmlFor="obs-sev">
              Type of Feedback
            </label>
            <select
              id="obs-sev"
              className="hhs-select"
              value={severity}
              onChange={e => setSeverity(e.target.value as NewIncidentInput['severity'])}
            >
              <option value="commendation">Positive Progress / Commendation</option>
              <option value="notice">Observation / Notice</option>
              <option value="disciplinary">Needs Follow-Up</option>
            </select>
          </div>
        </div>

        <div>
          <label className="hhs-label" htmlFor="obs-title">
            Subject / Title
          </label>
          <input
            id="obs-title"
            type="text"
            required
            className="hhs-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Excellent progress in trigonometry test"
          />
        </div>

        <div>
          <label className="hhs-label" htmlFor="obs-desc">
            Note Details
          </label>
          <textarea
            id="obs-desc"
            required
            className="hhs-textarea"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Provide factual details of the observation or progress..."
            rows={3}
          />
        </div>

        <div>
          <label className="hhs-label" htmlFor="obs-action">
            Action Taken or Follow-Up (Optional)
          </label>
          <input
            id="obs-action"
            type="text"
            className="hhs-input"
            value={actionTaken}
            onChange={e => setActionTaken(e.target.value)}
            placeholder="e.g. Encouraged to take part in Inter-School Math Olympiad"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            className="hhs-btn hhs-btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="hhs-btn hhs-btn-primary"
            disabled={isSubmitting || !studentId}
          >
            <span>{isSubmitting ? 'Saving...' : 'Save Note'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
