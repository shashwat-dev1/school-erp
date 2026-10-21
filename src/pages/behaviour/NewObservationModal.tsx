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

  const [studentId, setStudentId] = useState<string>(students[0]?.id || 'stu-10a-01');
  const [category, setCategory] = useState<NewIncidentInput['category']>('conduct_discipline');
  const [severity, setSeverity] = useState<NewIncidentInput['severity']>('notice');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [actionTaken, setActionTaken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
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
      setError(err instanceof Error ? err.message : 'Failed to record observation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record New Pastoral Observation or Incident"
      subtitle="Confidential proctorial record logged under HanuJai High School Pastoral Care Code."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {error && (
          <div style={{ color: 'var(--hhs-danger-text)', fontSize: '0.82rem', padding: '8px', backgroundColor: 'var(--hhs-danger-light)', borderRadius: 'var(--hhs-radius-base)' }}>
            {error}
          </div>
        )}

        <div>
          <label className="hhs-label" htmlFor="obs-student">Select Candidate</label>
          <select
            id="obs-student"
            required
            className="hhs-select"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
          >
            {students.map(s => (
              <option key={s.id} value={s.id}>
                Roll {s.rollNumber} — {s.firstName} {s.lastName} ({s.admissionNumber})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="hhs-label" htmlFor="obs-cat">Category</label>
            <select
              id="obs-cat"
              className="hhs-select"
              value={category}
              onChange={e => setCategory(e.target.value as NewIncidentInput['category'])}
            >
              <option value="conduct_discipline">Conduct &amp; Discipline</option>
              <option value="punctuality">Punctuality &amp; Attendance</option>
              <option value="academic_integrity">Academic Integrity</option>
              <option value="commendation">Commendation / Honour</option>
            </select>
          </div>
          <div>
            <label className="hhs-label" htmlFor="obs-sev">Classification Level</label>
            <select
              id="obs-sev"
              className="hhs-select"
              value={severity}
              onChange={e => setSeverity(e.target.value as NewIncidentInput['severity'])}
            >
              <option value="commendation">Commendation (Positive)</option>
              <option value="notice">Proctorial Notice (Low)</option>
              <option value="disciplinary">Disciplinary Action (Medium)</option>
              <option value="critical">Critical Hearing (High)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="hhs-label" htmlFor="obs-title">Incident / Commendation Summary</label>
          <input
            id="obs-title"
            required
            className="hhs-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Unexcused absence during laboratory session"
          />
        </div>

        <div>
          <label className="hhs-label" htmlFor="obs-desc">Objective Factual Description</label>
          <textarea
            id="obs-desc"
            required
            rows={3}
            className="hhs-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Provide factual, neutral chronology without speculative emotional characterizations."
            style={{ height: 'auto', padding: '8px' }}
          />
        </div>

        <div>
          <label className="hhs-label" htmlFor="obs-act">Intervention / Action Taken</label>
          <input
            id="obs-act"
            className="hhs-input"
            value={actionTaken}
            onChange={e => setActionTaken(e.target.value)}
            placeholder="e.g. Guardian telephonic notification and counseling scheduled."
          />
        </div>

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
            disabled={isSubmitting}
            className="hhs-btn hhs-btn-primary"
          >
            {isSubmitting ? 'Logging...' : 'Record Observation'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
