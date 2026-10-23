import React, { useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import type { StudentRecord } from '../../domain/types';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import type { StudentFollowUpRecord, FollowUpActionInput } from '../../data/provider';
import { CheckCircle2, User, Calendar, PlusCircle, AlertCircle } from 'lucide-react';

interface RiskEvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentRecord | null;
  onFollowUpRecorded?: () => void;
}

export const RiskEvidenceDrawer: React.FC<RiskEvidenceDrawerProps> = ({
  isOpen,
  onClose,
  student,
  onFollowUpRecorded,
}) => {
  const { currentUser } = useAuth();
  const { provider } = useData();

  const isPrincipal = currentUser?.role === 'principal';

  const [followUps, setFollowUps] = useState<StudentFollowUpRecord[]>([]);
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState<boolean>(false);

  // Follow-up form state
  const [showActionForm, setShowActionForm] = useState<boolean>(false);
  const [actionType, setActionType] = useState<FollowUpActionInput['actionType']>('guardian_contacted');
  const [actionNote, setActionNote] = useState<string>('');
  const [actionDate, setActionDate] = useState<string>('');
  const [statusUpdate, setStatusUpdate] = useState<'pending' | 'in_progress' | 'counseled' | 'resolved'>('in_progress');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (student && isOpen) {
      loadFollowUps(student.id);
      setShowActionForm(false);
      setFormError(null);
      setSuccessMessage(null);
      setActionNote('');
      setActionDate('');
    }
  }, [student, isOpen]);

  const loadFollowUps = async (studentId: string) => {
    setIsLoadingFollowUps(true);
    try {
      const records = await provider.getStudentFollowUps(studentId);
      setFollowUps(records);
    } catch {
      // ignore
    } finally {
      setIsLoadingFollowUps(false);
    }
  };

  if (!student) return null;

  const attendanceRate = student.attendanceSummary?.overallPercentage ?? 85.0;
  const isAttendanceDeficit = attendanceRate < 75.0;
  const consecutiveAbsences = 3;
  const hasAcademicDrop = student.careFlags?.some(f => f.code === '#ACAD-04') || false;

  const actionLabels: Record<FollowUpActionInput['actionType'], string> = {
    guardian_contacted: 'Guardian contacted',
    parent_meeting: 'Parent meeting planned',
    extra_support: 'Extra subject support arranged',
    teacher_followup: 'Follow-up with Class Teacher',
    other: 'Other',
  };

  const handleRecordFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!actionNote.trim()) {
      setFormError('Please enter a note describing the follow-up action.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const input: FollowUpActionInput = {
        studentId: student.id,
        actionType,
        actionLabel: actionLabels[actionType],
        note: actionNote.trim(),
        followUpDate: actionDate || undefined,
        statusUpdate,
      };

      const saved = await provider.recordStudentFollowUp(input, currentUser);
      setFollowUps(prev => [saved, ...prev]);
      setSuccessMessage('Follow-up action recorded successfully.');
      setShowActionForm(false);
      setActionNote('');
      setActionDate('');
      if (onFollowUpRecorded) onFollowUpRecorded();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to record follow-up.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Student Follow-up: ${student.firstName} ${student.lastName}`}
      subtitle={`Roll ${student.rollNumber || '—'} • Admission #${student.admissionNumber} • Class ${student.classLabel || student.classId?.toUpperCase()}`}
      width="640px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Student Quick Information */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            padding: '12px',
            border: '1px solid var(--hhs-border)',
            borderRadius: 'var(--hhs-radius-base)',
            backgroundColor: 'var(--hhs-surface-muted)',
            fontSize: '0.82rem',
          }}
        >
          <div>
            <div style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Guardian Details
            </div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{student.guardianName} ({student.guardianRelation})</div>
            <div style={{ color: 'var(--hhs-text-secondary)', fontFamily: 'monospace', marginTop: '1px' }}>{student.primaryPhone}</div>
          </div>
          <div>
            <div style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Class Teacher
            </div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>Mrs. Ananya Sharma</div>
            <div style={{ color: 'var(--hhs-text-secondary)', marginTop: '1px' }}>Class {student.classLabel || student.classId?.toUpperCase()}</div>
          </div>
        </div>

        {/* Reasons & Evidence for Follow-up */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
            Follow-up Reasons &amp; Evidence
          </h4>

          {/* Trigger 1: Attendance below 75% */}
          {isAttendanceDeficit && (
            <div
              style={{
                border: '1px solid var(--hhs-danger)',
                backgroundColor: 'var(--hhs-danger-light)',
                borderRadius: 'var(--hhs-radius-container)',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      borderRadius: 'var(--hhs-radius-sm)',
                      backgroundColor: 'var(--hhs-danger)',
                      color: '#ffffff',
                    }}
                  >
                    ATTENDANCE
                  </span>
                  <h5 style={{ margin: '4px 0 2px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--hhs-danger-text)' }}>
                    Attendance Below 75% Threshold
                  </h5>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-danger-text)' }}>
                    {attendanceRate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                    Minimum Target: 75.0%
                  </div>
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--hhs-text-primary)', lineHeight: 1.4 }}>
                Current attendance of {attendanceRate.toFixed(1)}% is strictly below the school standard of 75.0%.
                Shortfall delta is -{(75.0 - attendanceRate).toFixed(1)}%.
              </p>
            </div>
          )}

          {/* Trigger 2: Consecutive unexcused absences */}
          <div
            style={{
              border: '1px solid var(--hhs-accent)',
              backgroundColor: 'var(--hhs-accent-light)',
              borderRadius: 'var(--hhs-radius-container)',
              padding: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    borderRadius: 'var(--hhs-radius-sm)',
                    backgroundColor: 'var(--hhs-accent)',
                    color: '#ffffff',
                  }}
                >
                  CONSECUTIVE ABSENCES
                </span>
                <h5 style={{ margin: '4px 0 2px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--hhs-accent-text)' }}>
                  3 Consecutive Days Absent
                </h5>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-accent-text)' }}>
                  {consecutiveAbsences} Days
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                  Threshold: ≥ 3 days
                </div>
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--hhs-text-primary)', lineHeight: 1.4 }}>
              Student was recorded absent for 3 consecutive instructional days without medical certificate on file.
            </p>
          </div>

          {/* Trigger 3: Recent marks drop */}
          {hasAcademicDrop && (
            <div
              style={{
                border: '1px solid var(--hhs-border-strong)',
                backgroundColor: 'var(--hhs-surface)',
                borderRadius: 'var(--hhs-radius-container)',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      borderRadius: 'var(--hhs-radius-sm)',
                      backgroundColor: 'var(--hhs-text-secondary)',
                      color: '#ffffff',
                    }}
                  >
                    ACADEMIC DROP
                  </span>
                  <h5 style={{ margin: '4px 0 2px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                    Recent Marks Fallen (&gt;15%)
                  </h5>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-danger-text)' }}>
                    -28.0%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                    Unit Test 1 (88%) → Unit Test 2 (60%)
                  </div>
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.4 }}>
                Subject: <strong>Mathematics</strong>. Score dropped from 22/25 (88%) in Unit Test 1 down to 15/25 (60%) in Unit Test 2.
              </p>
            </div>
          )}
        </div>

        {/* Previous Follow-up History */}
        <div style={{ borderTop: '1px solid var(--hhs-border)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              Follow-up History ({followUps.length})
            </h4>
          </div>

          {isLoadingFollowUps ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)', padding: '10px 0' }}>
              Loading follow-up records...
            </div>
          ) : followUps.length === 0 ? (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                backgroundColor: 'var(--hhs-surface-muted)',
                borderRadius: 'var(--hhs-radius-base)',
                fontSize: '0.8rem',
                color: 'var(--hhs-text-secondary)',
              }}
            >
              No previous follow-up actions recorded for this student.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {followUps.map(fu => (
                <div
                  key={fu.id}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--hhs-border)',
                    borderRadius: 'var(--hhs-radius-base)',
                    backgroundColor: 'var(--hhs-surface)',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--hhs-primary)' }}>
                      {fu.actionLabel || fu.actionType}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
                      {new Date(fu.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--hhs-text-primary)', marginBottom: '6px', lineHeight: 1.4 }}>
                    {fu.note}
                  </div>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} />
                      {fu.actorName} ({fu.actorRole === 'class_teacher' ? 'Class Teacher' : fu.actorRole})
                    </span>
                    {fu.followUpDate && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        Target: {fu.followUpDate}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Success message banner */}
        {successMessage && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--hhs-success-light)',
              border: '1px solid var(--hhs-success)',
              borderRadius: 'var(--hhs-radius-base)',
              color: 'var(--hhs-success-text)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Action / Record Follow-up Section */}
        <div
          style={{
            borderTop: '1px solid var(--hhs-border)',
            paddingTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              Next Action
            </h4>
            {!isPrincipal && !showActionForm && (
              <button
                type="button"
                onClick={() => setShowActionForm(true)}
                className="hhs-btn hhs-btn-primary"
                style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <PlusCircle size={14} />
                <span>Record Follow-up</span>
              </button>
            )}
          </div>

          {isPrincipal ? (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--hhs-surface-muted)',
                borderRadius: 'var(--hhs-radius-base)',
                fontSize: '0.8rem',
                color: 'var(--hhs-text-secondary)',
                lineHeight: 1.45,
              }}
            >
              Principal view is read-only. Follow-up actions and parent communication are executed and recorded by the assigned Class Teacher.
            </div>
          ) : showActionForm ? (
            <form onSubmit={handleRecordFollowUp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {formError && (
                <div
                  style={{
                    padding: '8px 10px',
                    backgroundColor: 'var(--hhs-danger-light)',
                    color: 'var(--hhs-danger-text)',
                    borderRadius: 'var(--hhs-radius-base)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="hhs-label" style={{ marginBottom: '4px' }}>Action Type</label>
                <select
                  className="hhs-select"
                  value={actionType}
                  onChange={e => setActionType(e.target.value as FollowUpActionInput['actionType'])}
                >
                  <option value="guardian_contacted">Guardian contacted</option>
                  <option value="parent_meeting">Parent meeting planned</option>
                  <option value="extra_support">Extra subject support arranged</option>
                  <option value="teacher_followup">Follow-up with Class Teacher</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="hhs-label" style={{ marginBottom: '4px' }}>Action Note / Summary *</label>
                <textarea
                  className="hhs-input"
                  rows={3}
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  placeholder="Detail the discussion with guardian, remedial arrangement, or agreed next steps..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="hhs-label" style={{ marginBottom: '4px' }}>Target Date (Optional)</label>
                  <input
                    type="date"
                    className="hhs-input"
                    value={actionDate}
                    onChange={e => setActionDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="hhs-label" style={{ marginBottom: '4px' }}>Status Update</label>
                  <select
                    className="hhs-select"
                    value={statusUpdate}
                    onChange={e => setStatusUpdate(e.target.value as any)}
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="counseled">Counseled / Meeting Held</option>
                    <option value="resolved">Resolved</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowActionForm(false)}
                  className="hhs-btn hhs-btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="hhs-btn hhs-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Follow-up'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
              Click <strong>Record Follow-up</strong> above to log guardian calls, parent meetings, or remedial support arrangements.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              onClick={onClose}
              className="hhs-btn hhs-btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
