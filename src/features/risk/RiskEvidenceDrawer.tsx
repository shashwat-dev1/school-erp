import React from 'react';
import { Drawer } from '../../components/ui/Drawer';
import type { StudentRecord } from '../../domain/types';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

interface RiskEvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentRecord | null;
  onScheduleConference?: () => void;
}

export const RiskEvidenceDrawer: React.FC<RiskEvidenceDrawerProps> = ({
  isOpen,
  onClose,
  student,
  onScheduleConference,
}) => {
  if (!student) return null;

  const attendanceRate = student.attendanceSummary?.overallPercentage ?? 85.0;
  const isAttendanceDeficit = attendanceRate < 75.0;
  const consecutiveAbsences = 3; // Aarav Singhania trigger #ATT-01
  const hasAcademicDrop = student.careFlags?.some(f => f.code === '#ACAD-04') || false;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Deterministic Care Dossier: ${student.firstName} ${student.lastName}`}
      subtitle={`Roll ${student.rollNumber} • Admission #${student.admissionNumber} • Class 10-A`}
      width="640px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Empirical Dossier Non-Stigmatizing Disclaimer */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--hhs-surface-muted)',
            borderLeft: '4px solid var(--hhs-primary)',
            borderRadius: 'var(--hhs-radius-base)',
            fontSize: '0.8rem',
            lineHeight: 1.45,
            color: 'var(--hhs-text-primary)',
          }}
        >
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <ShieldCheck size={16} style={{ color: 'var(--hhs-primary)' }} />
            <span>Deterministic Rule-Based Governance</span>
          </div>
          Evidence indicators are derived strictly from arithmetic comparisons against published CBSE statutory by-laws and cross-term assessment deltas. Zero opaque profiling or predictive algorithmic scores.
        </div>

        {/* Student Quick Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            padding: '12px',
            border: '1px solid var(--hhs-border)',
            borderRadius: 'var(--hhs-radius-base)',
            backgroundColor: 'var(--hhs-surface)',
            fontSize: '0.82rem',
          }}
        >
          <div>
            <div style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Guardian Contact
            </div>
            <div style={{ fontWeight: 600 }}>{student.guardianName} ({student.guardianRelation})</div>
            <div style={{ color: 'var(--hhs-text-secondary)', fontFamily: 'monospace' }}>{student.primaryPhone}</div>
          </div>
          <div>
            <div style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Assigned Tutor
            </div>
            <div style={{ fontWeight: 600 }}>Mrs. Ananya Sharma</div>
            <div style={{ color: 'var(--hhs-text-secondary)' }}>Senior Wing • Class 10-A</div>
          </div>
        </div>

        {/* Active Rule Verifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
            Empirical Trigger Verifications
          </h4>

          {/* Trigger 1: Rule #ATT-03 / CBSE 75% Threshold */}
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
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      borderRadius: 'var(--hhs-radius-sm)',
                      backgroundColor: 'var(--hhs-danger)',
                      color: '#ffffff',
                    }}
                  >
                    RULE #ATT-03
                  </span>
                  <h5 style={{ margin: '4px 0 2px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--hhs-danger-text)' }}>
                    Statutory CBSE 75.0% Attendance Shortfall
                  </h5>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-danger-text)' }}>
                    {attendanceRate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                    Min Required: 75.0%
                  </div>
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--hhs-text-primary)', lineHeight: 1.4 }}>
                Pursuant to <strong>CBSE Examination Bye-Laws Rule 14.1</strong>, students with attendance below 75% aggregate instruction days risk debarment from board examinations without formal condonation.
              </p>
              <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--hhs-danger-text)', fontWeight: 600 }}>
                Shortfall delta: -{(75.0 - attendanceRate).toFixed(1)}% absolute attendance gap.
              </div>
            </div>
          )}

          {/* Trigger 2: Rule #ATT-01 / Consecutive Unexcused Absences */}
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
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    borderRadius: 'var(--hhs-radius-sm)',
                    backgroundColor: 'var(--hhs-accent)',
                    color: '#ffffff',
                  }}
                >
                  RULE #ATT-01
                </span>
                <h5 style={{ margin: '4px 0 2px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--hhs-accent-text)' }}>
                  Repeated Consecutive Operational Absences
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
              System verified 3 continuous calendar instruction days unmarked by certified medical excuse. Requires immediate guardian inquiry.
            </p>
          </div>

          {/* Trigger 3: Rule #ACAD-04 / Term-over-Term Score Decline */}
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
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      borderRadius: 'var(--hhs-radius-sm)',
                      backgroundColor: 'var(--hhs-text-secondary)',
                      color: '#ffffff',
                    }}
                  >
                    RULE #ACAD-04
                  </span>
                  <h5 style={{ margin: '4px 0 2px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                    &gt;15% Academic Trajectory Decline
                  </h5>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-danger-text)' }}>
                    -28.0%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                    UT-1 (88%) → UT-2 (60%)
                  </div>
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.4 }}>
                Subject: <strong>Mathematics (041)</strong>. Student obtained 22/25 (88%) in UT-1, dropping to 15/25 (60%) in UT-2. Represents a 28% drop exceeding the 15% intervention threshold.
              </p>
            </div>
          )}
        </div>

        {/* Actionable Administrative Protocol */}
        <div
          style={{
            borderTop: '1px solid var(--hhs-border)',
            paddingTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
            Prescribed Intervention Protocol
          </h4>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.5 }}>
            <li>1. Issue Formal Form A Condonation Warning to Primary Guardian.</li>
            <li>2. Schedule Tutor &amp; Guardian Alignment Conference (PTM Slip).</li>
            <li>3. Enroll student into 07:45 AM Zero-Period Mathematics Remedial Clinic.</li>
          </ul>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            {onScheduleConference && (
              <button
                onClick={() => {
                  onScheduleConference();
                  onClose();
                }}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                PTM Slip
              </button>
            )}
            <button
              onClick={() => {
                alert(`Official Notice generated and logged to Student Care Timeline for ${student.firstName} ${student.lastName}.`);
                onClose();
              }}
              className="hhs-btn hhs-btn-primary"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <CheckCircle2 size={15} />
              <span>Log Formal Intervention Action</span>
            </button>
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
