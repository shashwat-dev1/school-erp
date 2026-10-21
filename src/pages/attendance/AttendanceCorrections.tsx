import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { AttendanceCorrection, AttendanceState, StudentRecord } from '../../domain/types';
import {
  ShieldCheck,
  CheckCircle2,
  Plus,
} from 'lucide-react';

export const AttendanceCorrections: React.FC = () => {
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New Request Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [requestForm, setRequestForm] = useState({
    studentId: '',
    previousState: 'absent' as AttendanceState,
    requestedState: 'excused' as AttendanceState,
    mandatoryReason: '',
  });

  // Approval Action Modal
  const [activeCorrection, setActiveCorrection] = useState<AttendanceCorrection | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState<string>('Verified supporting documentation.');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [corrList, stuRes] = await Promise.all([
          provider.getAttendanceCorrections(),
          provider.getStudents({ limit: 100 }),
        ]);
        if (!isMounted) return;
        setCorrections(corrList);
        setStudents(stuRes.items);
        if (stuRes.items.length > 0) {
          setRequestForm(prev => ({ ...prev, studentId: stuRes.items[0].id }));
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load corrections.';
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

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!requestForm.mandatoryReason.trim()) {
      alert('Mandatory requirement: Reason for correction is required.');
      return;
    }

    setIsProcessing(true);
    try {
      const created = await provider.requestAttendanceCorrection(
        {
          sessionId: 'att-class-10-a-today',
          studentId: requestForm.studentId,
          previousState: requestForm.previousState,
          requestedState: requestForm.requestedState,
          mandatoryReason: requestForm.mandatoryReason,
        },
        currentUser
      );

      setCorrections(prev => [created, ...prev]);
      setIsRequestModalOpen(false);
      setRequestForm({
        studentId: students[0]?.id || '',
        previousState: 'absent',
        requestedState: 'excused',
        mandatoryReason: '',
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to submit correction request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewAction = async (approved: boolean) => {
    if (!activeCorrection || !currentUser) return;
    setIsProcessing(true);
    try {
      await provider.approveAttendanceCorrection(
        activeCorrection.id,
        currentUser,
        approved,
        approvalRemarks
      );

      // Update local state
      setCorrections(prev =>
        prev.map(c =>
          c.id === activeCorrection.id
            ? {
                ...c,
                status: approved ? 'approved' : 'rejected',
                reviewedByStaffId: currentUser.id,
                reviewedByStaffName: currentUser.name,
                reviewedAt: new Date().toISOString(),
                reviewRemarks: approvalRemarks,
              }
            : c
        )
      );

      setActiveCorrection(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to review correction.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading dual-custody attendance correction authorizations..." />;
  }

  const role = currentUser?.role || 'principal';
  const canApprove = role === 'principal' || role === 'office_admin';

  const pending = corrections.filter(c => c.status === 'pending_principal');
  const history = corrections.filter(c => c.status !== 'pending_principal');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="Late Attendance Corrections"
        subtitle="HanuJai High School, Jaipur • Dual-custody authorization queue enforcing statutory CBSE compliance."
        breadcrumbs={[
          { label: 'Campus' },
          { label: 'Attendance', to: '/attendance' },
          { label: 'Late Corrections' },
        ]}
        actions={
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="hhs-btn hhs-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} />
            <span>Submit Correction Request</span>
          </button>
        }
      />

      {error && <ErrorBanner title="Correction Ledger Error" message={error} />}

      {/* Institutional Policy Notice */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: 'var(--hhs-radius-base)',
          backgroundColor: 'var(--hhs-surface)',
          border: '1px solid var(--hhs-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.84rem',
        }}
      >
        <ShieldCheck size={20} color="var(--hhs-primary)" style={{ flexShrink: 0 }} />
        <div>
          <strong>Dual-Custody Policy:</strong> After the morning roll-call window (07:45 – 09:15 AM) closes, attendance records are locked. Any post-window state change requires verified teacher justification and explicit Principal counter-authorization.
        </div>
      </div>

      {/* PENDING APPROVAL QUEUE */}
      <div className="hhs-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--hhs-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="hhs-headline-sm" style={{ margin: 0 }}>Pending Principal Approvals</h3>
            <span className="hhs-badge hhs-badge-accent">{pending.length} Pending</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--hhs-text-muted)' }}>
            Dual-custody verification required
          </span>
        </div>

        {pending.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pending.map(c => (
              <div
                key={c.id}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--hhs-radius-base)',
                  backgroundColor: 'var(--hhs-canvas)',
                  border: '1px solid var(--hhs-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.94rem' }}>{c.studentName}</strong>
                    <span className="hhs-badge hhs-badge-primary">{c.classLabel}</span>
                    <span className="tnum" style={{ fontSize: '0.78rem', color: 'var(--hhs-text-muted)' }}>
                      Date: {c.date}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', marginBottom: '4px' }}>
                    Requested State Change:{' '}
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--hhs-danger)' }}>
                      {c.previousState}
                    </span>{' '}
                    &rarr;{' '}
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--hhs-primary)' }}>
                      {c.requestedState}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--hhs-text-primary)' }}>
                    &ldquo;{c.mandatoryReason}&rdquo;
                  </div>
                  <div className="tnum" style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)', marginTop: '4px' }}>
                    Submitted by {c.requestedByStaffName} at {new Date(c.requestedAt).toLocaleTimeString()}
                  </div>
                </div>

                {canApprove ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setActiveCorrection(c)}
                      className="hhs-btn hhs-btn-primary hhs-btn-sm"
                    >
                      Review & Authorize
                    </button>
                  </div>
                ) : (
                  <span className="hhs-badge hhs-badge-accent">Awaiting Principal Desk</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
            <CheckCircle2 size={24} color="var(--hhs-primary)" style={{ margin: '0 auto 8px' }} />
            <div>All submitted attendance records are synchronized. No pending correction requests.</div>
          </div>
        )}
      </div>

      {/* RESOLVED CORRECTION HISTORY */}
      <div className="hhs-card" style={{ padding: '20px' }}>
        <h3 className="hhs-headline-sm" style={{ marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--hhs-border)' }}>
          Historical Authorization Ledger
        </h3>

        {history.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="hhs-table">
              <thead>
                <tr>
                  <th>Student & Section</th>
                  <th>Session Date</th>
                  <th>State Transition</th>
                  <th>Justification</th>
                  <th>Reviewer</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {history.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.studentName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>{c.classLabel}</div>
                    </td>
                    <td className="tnum">{c.date}</td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>{c.previousState}</span> &rarr;{' '}
                      <strong style={{ textTransform: 'capitalize' }}>{c.requestedState}</strong>
                    </td>
                    <td style={{ fontSize: '0.8rem', maxWidth: '300px' }}>
                      <div>{c.mandatoryReason}</div>
                      {c.reviewRemarks && (
                        <div style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.74rem', marginTop: '2px' }}>
                          Remarks: {c.reviewRemarks}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      <div>{c.reviewedByStaffName || 'Principal Desk'}</div>
                      <div className="tnum" style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
                        {c.reviewedAt ? new Date(c.reviewedAt).toLocaleDateString() : '—'}
                      </div>
                    </td>
                    <td>
                      <span
                        className={c.status === 'approved' ? 'hhs-badge hhs-badge-primary' : 'hhs-badge hhs-badge-danger'}
                      >
                        {c.status === 'approved' ? 'Approved & Locked' : 'Rejected'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
            No historical corrections on file.
          </div>
        )}
      </div>

      {/* REQUEST CORRECTION MODAL */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="Request Post-Window Attendance Correction"
        subtitle="Mandatory requirement: Document reason for revision to satisfy dual-custody verification."
      >
        <form onSubmit={handleRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="hhs-label" htmlFor="corr-student">Select Student</label>
            <select
              id="corr-student"
              className="hhs-select"
              value={requestForm.studentId}
              onChange={e => setRequestForm({ ...requestForm, studentId: e.target.value })}
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.classLabel} • Roll #{s.rollNumber})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="prev-state">Original Marked State</label>
              <select
                id="prev-state"
                className="hhs-select"
                value={requestForm.previousState}
                onChange={e => setRequestForm({ ...requestForm, previousState: e.target.value as AttendanceState })}
              >
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="present">Present</option>
              </select>
            </div>
            <div>
              <label className="hhs-label" htmlFor="req-state">Requested Correct State</label>
              <select
                id="req-state"
                className="hhs-select"
                value={requestForm.requestedState}
                onChange={e => setRequestForm({ ...requestForm, requestedState: e.target.value as AttendanceState })}
              >
                <option value="excused">Excused (Medical / Official)</option>
                <option value="present">Present (On-Duty Activity)</option>
                <option value="late">Late Arrival</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="hhs-label" htmlFor="corr-reason" style={{ color: 'var(--hhs-primary)' }}>
              * Mandatory Audit Justification Note
            </label>
            <textarea
              id="corr-reason"
              required
              rows={3}
              placeholder="e.g. Parent submitted medical leave certificate / Student attended state debate competition..."
              className="hhs-textarea"
              value={requestForm.mandatoryReason}
              onChange={e => setRequestForm({ ...requestForm, mandatoryReason: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsRequestModalOpen(false)}
              className="hhs-btn hhs-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="hhs-btn hhs-btn-primary"
            >
              {isProcessing ? 'Submitting...' : 'Submit to Principal Desk'}
            </button>
          </div>
        </form>
      </Modal>

      {/* PRINCIPAL REVIEW MODAL */}
      <Modal
        isOpen={Boolean(activeCorrection)}
        onClose={() => setActiveCorrection(null)}
        title="Authorize Attendance Correction"
        subtitle={
          activeCorrection
            ? `Student: ${activeCorrection.studentName} • ${activeCorrection.classLabel} (${activeCorrection.date})`
            : ''
        }
      >
        {activeCorrection && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--hhs-canvas)',
                borderRadius: 'var(--hhs-radius-base)',
                border: '1px solid var(--hhs-border)',
                fontSize: '0.84rem',
              }}
            >
              <div>
                <strong>Requested Transition:</strong>{' '}
                <span style={{ textTransform: 'capitalize' }}>{activeCorrection.previousState}</span> &rarr;{' '}
                <strong style={{ textTransform: 'capitalize', color: 'var(--hhs-primary)' }}>
                  {activeCorrection.requestedState}
                </strong>
              </div>
              <div style={{ marginTop: '6px' }}>
                <strong>Tutor Justification:</strong> &ldquo;{activeCorrection.mandatoryReason}&rdquo;
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.74rem', color: 'var(--hhs-text-muted)' }}>
                Requested by: {activeCorrection.requestedByStaffName}
              </div>
            </div>

            <div>
              <label className="hhs-label" htmlFor="approval-notes">Principal Verification Remarks</label>
              <input
                id="approval-notes"
                className="hhs-input"
                value={approvalRemarks}
                onChange={e => setApprovalRemarks(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleReviewAction(false)}
                disabled={isProcessing}
                className="hhs-btn hhs-btn-secondary"
                style={{ color: 'var(--hhs-danger-text)' }}
              >
                Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction(true)}
                disabled={isProcessing}
                className="hhs-btn hhs-btn-primary"
              >
                {isProcessing ? 'Authorizing...' : 'Approve & Commit Correction'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
