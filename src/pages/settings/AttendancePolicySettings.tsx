import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { AttendancePolicy } from '../../domain/types';
import {
  Clock,
  Save,
  CheckCircle2,
} from 'lucide-react';

export const AttendancePolicySettings: React.FC = () => {
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [policy, setPolicy] = useState<AttendancePolicy>({
    dailyMarkingWindowStart: '07:45',
    dailyMarkingWindowEnd: '09:15',
    gracePeriodMinutes: 15,
    minimumAttendancePercentage: 75.0,
    dualCustodyCorrectionRequired: true,
    windowStartTime: '07:45',
    windowEndTime: '09:15',
    allowTeacherLateCorrection: true,
    requirePrincipalApproval: true,
    cbseMinimumThresholdPercent: 75.0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadPolicy() {
      setIsLoading(true);
      try {
        const settings = await provider.getSchoolSettings();
        if (!isMounted) return;
        if (settings.attendancePolicy) {
          setPolicy(settings.attendancePolicy);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error('Error fetching attendance policy:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPolicy();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await provider.updateAttendancePolicy(policy, currentUser);
      setPolicy(updated);
      setSuccessMsg('Attendance Marking Policy parameters successfully saved and logged to audit trail.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance policy.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading attendance policy configuration..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Attendance Marking & Lockout Policy"
        subtitle="Morning roll-call submission windows, dual-custody verification rules, and CBSE 75% attendance floors."
        roleScope="Administrative Settings"
        breadcrumbs={[
          { label: 'Operations Hub', to: '/' },
          { label: 'Settings', to: '/settings/system-config' },
          { label: 'Attendance Policy', to: '/settings/attendance-policy' },
        ]}
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

      {/* Demonstration Configuration Notice */}
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
        <Clock size={20} style={{ color: 'var(--hhs-primary)', flexShrink: 0 }} />
        <div>
          <strong style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Demonstration Configuration:</strong>{' '}
          The morning submission window (07:45 AM – 09:15 AM IST) and grace parameters shown below are sample administrative defaults configured for pilot presentation to HanuJai High School.
        </div>
      </div>

      {/* Policy Form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Pillar 1: Morning Window */}
          <div className="hhs-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              1. Daily Roll-Call Submission Window
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="hhs-label" htmlFor="win-start">Window Opening Time (IST)</label>
                <input
                  id="win-start"
                  type="time"
                  required
                  className="hhs-input"
                  value={policy.windowStartTime}
                  onChange={e => setPolicy({ ...policy, windowStartTime: e.target.value })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  Assembly &amp; zero-period homeroom opening
                </span>
              </div>

              <div>
                <label className="hhs-label" htmlFor="win-end">Window Cutoff Time (IST)</label>
                <input
                  id="win-end"
                  type="time"
                  required
                  className="hhs-input"
                  value={policy.windowEndTime}
                  onChange={e => setPolicy({ ...policy, windowEndTime: e.target.value })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  Period 1 bell; registers lock automatically
                </span>
              </div>

              <div>
                <label className="hhs-label" htmlFor="win-grace">Post-Assembly Grace Period (Minutes)</label>
                <input
                  id="win-grace"
                  type="number"
                  min={0}
                  max={60}
                  required
                  className="hhs-input"
                  value={policy.gracePeriodMinutes}
                  onChange={e => setPolicy({ ...policy, gracePeriodMinutes: Number(e.target.value) })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  Additional buffer before locking register
                </span>
              </div>
            </div>
          </div>

          {/* Pillar 2: Dual Custody */}
          <div className="hhs-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              2. Late Correction &amp; Dual-Custody Protocol
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <input
                  id="allow-late"
                  type="checkbox"
                  checked={policy.allowTeacherLateCorrection}
                  onChange={e => setPolicy({ ...policy, allowTeacherLateCorrection: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <label htmlFor="allow-late" style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                    Permit Post-Window Correction Requests
                  </label>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
                    Allows class teachers to submit correction requests when medical excuses or transport delays are presented late.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <input
                  id="req-approval"
                  type="checkbox"
                  checked={policy.requirePrincipalApproval}
                  onChange={e => setPolicy({ ...policy, requirePrincipalApproval: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <label htmlFor="req-approval" style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                    Enforce Dual-Custody Principal Sign-Off
                  </label>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
                    Mandates that post-window adjustments do not take effect until formally approved by the Principal.
                  </p>
                </div>
              </div>

              <div>
                <label className="hhs-label" htmlFor="cbse-floor">CBSE Rule 14.1 Statutory Minimum Floor (%)</label>
                <input
                  id="cbse-floor"
                  type="number"
                  min={50}
                  max={100}
                  step="0.5"
                  required
                  className="hhs-input"
                  value={policy.cbseMinimumThresholdPercent}
                  onChange={e => setPolicy({ ...policy, cbseMinimumThresholdPercent: Number(e.target.value) })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  Statutory threshold triggering red-line condonation warnings
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="submit"
            disabled={isSaving}
            className="hhs-btn hhs-btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving Changes...' : 'Save Policy Parameters'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
