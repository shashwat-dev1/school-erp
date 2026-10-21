import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { AssessmentCycle } from '../../domain/types';
import {
  FileCheck2,
  Calendar,
  Plus,
  Edit,
  BookOpen,
} from 'lucide-react';

export const AssessmentList: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [cycles, setCycles] = useState<AssessmentCycle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Configure Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCycle, setEditingCycle] = useState<AssessmentCycle | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formTerm, setFormTerm] = useState<'term1' | 'term2'>('term1');
  const [formMaxMarks, setFormMaxMarks] = useState<number>(25);
  const [formWeightage, setFormWeightage] = useState<number>(10);
  const [formStartDate, setFormStartDate] = useState<string>('2025-08-01');
  const [formEndDate, setFormEndDate] = useState<string>('2025-08-10');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadCycles() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await provider.getAssessmentCycles();
        if (!isMounted) return;
        setCycles(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load assessment cycles.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadCycles();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  const handleOpenCreateModal = () => {
    setEditingCycle(null);
    setFormName('');
    setFormTerm('term1');
    setFormMaxMarks(25);
    setFormWeightage(10);
    setFormStartDate('2025-08-01');
    setFormEndDate('2025-08-10');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cycle: AssessmentCycle) => {
    setEditingCycle(cycle);
    setFormName(cycle.name || cycle.title || '');
    setFormTerm(cycle.term || 'term1');
    setFormMaxMarks(cycle.maxMarks);
    setFormWeightage(cycle.weightagePercent);
    setFormStartDate(cycle.startDate);
    setFormEndDate(cycle.endDate);
    setIsModalOpen(true);
  };

  const handleSaveCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    try {
      if (editingCycle) {
        const updated = await provider.updateAssessmentCycle(
          editingCycle.id,
          {
            name: formName,
            term: formTerm,
            maxMarks: Number(formMaxMarks),
            passingMarks: Math.round(Number(formMaxMarks) * 0.33),
            weightagePercent: Number(formWeightage),
            startDate: formStartDate,
            endDate: formEndDate,
          },
          currentUser
        );
        setCycles(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      } else {
        const created = await provider.createAssessmentCycle(
          {
            name: formName,
            term: formTerm,
            academicYearId: 'ay-2025-26',
            maxMarks: Number(formMaxMarks),
            passingMarks: Math.round(Number(formMaxMarks) * 0.33),
            weightagePercent: Number(formWeightage),
            startDate: formStartDate,
            endDate: formEndDate,
            status: 'draft',
          },
          currentUser
        );
        setCycles(prev => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error saving assessment cycle.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading assessment cycles..." />;
  }

  const role = currentUser?.role || 'principal';
  const isSubjectTeacher = role === 'subject_teacher';

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Assessment Cycles & Marks Entry"
        subtitle="Manage term examination milestones, maximum marks rules, and subject-wise score registration."
        roleScope="Academic Operations"
        breadcrumbs={[
          { label: 'Operations Hub', to: '/' },
          { label: 'Assessments', to: '/assessments' },
        ]}
        actions={
          (role === 'principal' || role === 'office_admin') ? (
            <button
              onClick={handleOpenCreateModal}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Configure Assessment</span>
            </button>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Institutional Operational Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Configured Cycles</div>
          <div className="hhs-metric-value">{cycles.length}</div>
          <div className="hhs-metric-sub">Session 2025–26 (CBSE)</div>
        </div>
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Target Cohorts</div>
          <div className="hhs-metric-value">Class 10-A, 10-B</div>
          <div className="hhs-metric-sub">Senior Secondary Wing</div>
        </div>
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Marks Lock Policy</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            Dual-Custody
          </div>
          <div className="hhs-metric-sub">Requires Principal Sign-off</div>
        </div>
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Current Window</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-accent-text)' }}>
            UT-2 Active
          </div>
          <div className="hhs-metric-sub">Lock in 72 hours</div>
        </div>
      </div>

      {/* Cycles Master Table */}
      <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--hhs-border)',
            backgroundColor: 'var(--hhs-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--hhs-text-primary)' }}>
              Examination & Evaluation Schedule
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', margin: '2px 0 0' }}>
              Official evaluation milestones registered for HanuJai High School.
            </p>
          </div>
          <span className="hhs-badge hhs-badge-primary">Session 2025–26</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Assessment Cycle</th>
                <th>Academic Term</th>
                <th className="numeric">Max Marks</th>
                <th className="numeric">Pass Mark (33%)</th>
                <th className="numeric">Weightage</th>
                <th>Window Schedule</th>
                <th>Registry Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle, index) => {
                return (
                  <tr key={cycle.id}>
                    <td className="numeric" style={{ color: 'var(--hhs-text-muted)' }}>
                      {index + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                        {cycle.name || cycle.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                        ID: {cycle.id}
                      </div>
                    </td>
                    <td>
                      <span className="hhs-badge hhs-badge-neutral">
                        {cycle.term === 'term1' ? 'Term I (Apr–Sep)' : 'Term II (Oct–Mar)'}
                      </span>
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {cycle.maxMarks}
                    </td>
                    <td className="numeric" style={{ color: 'var(--hhs-text-secondary)' }}>
                      {cycle.passingMarks}
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {cycle.weightagePercent}%
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} style={{ color: 'var(--hhs-text-muted)' }} />
                        <span>
                          {cycle.startDate} to {cycle.endDate}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        status={
                          cycle.status === 'published'
                            ? 'active'
                            : cycle.status === 'locked'
                            ? 'inactive'
                            : 'pending'
                        }
                        label={
                          cycle.status === 'published'
                            ? 'Published'
                            : cycle.status === 'locked'
                            ? 'Locked'
                            : 'In Draft'
                        }
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => navigate(`/academics/marks/${cycle.id}`)}
                          className="hhs-btn hhs-btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px', height: '30px' }}
                          title="Open Marks Entry Register"
                        >
                          <FileCheck2 size={14} />
                          <span>{isSubjectTeacher ? 'Enter Marks' : 'Marks Sheet'}</span>
                        </button>

                        <button
                          onClick={() => navigate('/classes/class-10-a/performance')}
                          className="hhs-btn hhs-btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '5px 8px', height: '30px' }}
                          title="View Consolidated Matrix"
                        >
                          <BookOpen size={14} />
                        </button>

                        {(role === 'principal' || role === 'office_admin') && (
                          <button
                            onClick={() => handleOpenEditModal(cycle)}
                            className="hhs-btn hhs-btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '5px 8px', height: '30px' }}
                            title="Edit Cycle Configuration"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configure Cycle Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCycle ? `Edit Cycle: ${editingCycle.name}` : 'Configure New Assessment Cycle'}
        subtitle="CBSE Continuous and Comprehensive Evaluation policy definition."
      >
        <form onSubmit={handleSaveCycle} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="hhs-label" htmlFor="cycle-name">Cycle Name</label>
            <input
              id="cycle-name"
              required
              className="hhs-input"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g. Periodic Assessment 3 / Pre-Board"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="cycle-term">Academic Term</label>
              <select
                id="cycle-term"
                className="hhs-select"
                value={formTerm}
                onChange={e => setFormTerm(e.target.value as 'term1' | 'term2')}
              >
                <option value="term1">Term 1</option>
                <option value="term2">Term 2</option>
              </select>
            </div>
            <div>
              <label className="hhs-label" htmlFor="cycle-max">Maximum Marks</label>
              <input
                id="cycle-max"
                type="number"
                required
                min={10}
                max={100}
                className="hhs-input"
                value={formMaxMarks}
                onChange={e => setFormMaxMarks(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="cycle-weightage">Final Weightage (%)</label>
              <input
                id="cycle-weightage"
                type="number"
                required
                min={0}
                max={100}
                className="hhs-input"
                value={formWeightage}
                onChange={e => setFormWeightage(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="hhs-label">Auto Pass Mark (33%)</label>
              <div
                className="hhs-input"
                style={{ backgroundColor: 'var(--hhs-surface-muted)', color: 'var(--hhs-text-secondary)' }}
              >
                {Math.round(formMaxMarks * 0.33)} Marks
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="cycle-start">Start Date</label>
              <input
                id="cycle-start"
                type="date"
                required
                className="hhs-input"
                value={formStartDate}
                onChange={e => setFormStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="cycle-end">End Date</label>
              <input
                id="cycle-end"
                type="date"
                required
                className="hhs-input"
                value={formEndDate}
                onChange={e => setFormEndDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
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
              {isSaving ? 'Saving...' : editingCycle ? 'Update Configuration' : 'Create Cycle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
