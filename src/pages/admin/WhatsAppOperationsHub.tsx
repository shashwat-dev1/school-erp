/**
 * HanuJai High School ERP — WhatsApp Operations & Messaging Hub
 * Institutional Gateway for Principal Oversight & Notification Diagnostics
 * Design: Regal Academic SaaS
 */

import React, { useState, useEffect } from 'react';
import { PHASE_CONFIG } from '../../config/phase';
import { WhatsAppNotificationService } from '../../services/whatsapp/whatsappService';
import type { WhatsAppNotificationJob, WhatsAppStats } from '../../services/whatsapp/types';
import {
  ShieldCheck,
  RefreshCw,
  Search,
  Smartphone,
  Check,
  XCircle,
  FileText,
  ShieldAlert,
} from 'lucide-react';

export const WhatsAppOperationsHub: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [jobs, setJobs] = useState<WhatsAppNotificationJob[]>([]);
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'pending' | 'skipped' | 'failed'>('all');

  // Test Phone Sandbox Checker state
  const [testInputPhone, setTestInputPhone] = useState<string>('9009519718');
  const [testResult, setTestResult] = useState<{ allowed: boolean; reason: string } | null>(null);

  // Template preview tab
  const [activeTemplateTab, setActiveTemplateTab] = useState<'present' | 'absent'>('present');

  const allowlist = PHASE_CONFIG.whatsapp.testRecipientAllowlist || [];
  const sendEnabled = PHASE_CONFIG.whatsapp.sendEnabled;
  const providerName = PHASE_CONFIG.whatsapp.provider;

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      // Fetch latest session notifications (default: class-10-a latest or from service)
      const res = await WhatsAppNotificationService.getSessionNotifications('latest');
      setJobs(res.jobs);
      setStats(res.stats);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleRetryJob = async (job: WhatsAppNotificationJob) => {
    setRetryingJobId(job.id);
    try {
      const updated = await WhatsAppNotificationService.retryJob(job);
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      loadNotifications();
    } catch (err) {
      console.error('Job retry error:', err);
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleTestPhoneValidation = () => {
    const clean = testInputPhone.trim().replace(/\D/g, '');
    if (!clean || clean.length < 10) {
      setTestResult({
        allowed: false,
        reason: 'Invalid phone: Phone numbers must contain at least 10 digits.',
      });
      return;
    }

    if (!sendEnabled) {
      setTestResult({
        allowed: false,
        reason: 'Dry-Run / Preview Mode: Live dispatch is disabled (VITE_WHATSAPP_SEND_ENABLED=false). Simulated transmission only.',
      });
      return;
    }

    if (allowlist.length === 0) {
      setTestResult({
        allowed: true,
        reason: 'Broadcasting open: Allowlist is empty; all verified guardian numbers are eligible for dispatch.',
      });
      return;
    }

    const isMatch = allowlist.some((allowed) => clean.endsWith(allowed.replace(/\D/g, '')));
    if (isMatch) {
      setTestResult({
        allowed: true,
        reason: `Verified Test Allowlist Member: Recipient matches authorized developer/admin number. Live WhatsApp messages will be dispatched!`,
      });
    } else {
      setTestResult({
        allowed: false,
        reason: `Filtered by Safety Guard: ${clean} is not in VITE_WHATSAPP_TEST_ALLOWLIST. Message will be safely marked as 'skipped' to protect parents during testing.`,
      });
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const matchesSearch =
      (j.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.guardianName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.recipientPhone || '').includes(searchQuery);

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return j.deliveryStatus === statusFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#0A1931',
          borderRadius: '14px',
          padding: '24px 28px',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 12px 0 rgba(10, 25, 49, 0.15)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                backgroundColor: 'rgba(245, 166, 35, 0.15)',
                border: '1px solid #F5A623',
                color: '#F5A623',
                borderRadius: '9999px',
                padding: '3px 10px',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Enterprise Communication Gateway
            </span>
            <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
              Baileys WebSocket / Cloud API Gateway
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            WhatsApp Operations & Messaging Hub
          </h1>
          <p style={{ color: '#CBD5E1', fontSize: '0.86rem', lineHeight: 1.45, margin: 0 }}>
            Central administrative oversight for automated attendance alerts, parent notification delivery receipts, safety allowlist filters, and background worker queue health.
          </p>
        </div>

        <button
          onClick={loadNotifications}
          disabled={isLoading}
          style={{
            backgroundColor: '#F5A623',
            border: 'none',
            color: '#0A1931',
            borderRadius: '8px',
            padding: '9px 16px',
            fontSize: '0.82rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(245, 166, 35, 0.3)',
          }}
        >
          <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          <span>Refresh Queue Status</span>
        </button>
      </div>

      {/* 4 Gateway Health Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        
        {/* Worker Status */}
        <div className="hhs-card" style={{ padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Worker Gateway
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} color="#10B981" />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10B981', margin: '8px 0 4px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {providerName === 'dry_run' ? 'Simulation (Dry-Run)' : 'Worker Connected'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            Provider: <code style={{ backgroundColor: '#F1F5F9', padding: '2px 4px', borderRadius: '4px' }}>{providerName}</code>
          </div>
        </div>

        {/* Safety Mode */}
        <div className="hhs-card" style={{ padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Network Dispatch
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: sendEnabled ? '#ECFDF5' : '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={18} color={sendEnabled ? '#10B981' : '#D97706'} />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: sendEnabled ? '#10B981' : '#D97706', margin: '8px 0 4px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {sendEnabled ? 'Live Enabled' : 'Preview Mode'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {sendEnabled ? 'Live SMS/WhatsApp enabled' : 'Zero network messages sent'}
          </div>
        </div>

        {/* Test Allowlist */}
        <div className="hhs-card" style={{ padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Test Allowlist
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={18} color="#4F46E5" />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4F46E5', margin: '8px 0 4px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {allowlist.length} Authorized
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {allowlist.length > 0 ? allowlist.join(', ') : 'Open cohort'}
          </div>
        </div>

        {/* Total Processed */}
        <div className="hhs-card" style={{ padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Delivery Rate
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={18} color="#10B981" />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A1931', margin: '8px 0 4px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="tnum">
            {stats ? stats.sent : 0} <span style={{ fontSize: '0.9rem', color: '#64748B' }}>/ {stats ? stats.total : 0}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>
            {stats && stats.total > 0 ? `${Math.round((stats.sent / stats.total) * 100)}% successful` : '100% verified'}
          </div>
        </div>

      </div>

      {/* Interactive Safety Sandbox Checker & Template Viewer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <style>{`
          @media (max-width: 900px) {
            div[style*="gridTemplateColumns: 1fr 1fr"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {/* Allowlist Phone Tester */}
        <div className="hhs-card" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ShieldCheck size={18} color="#0A1931" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0A1931', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Test Phone Allowlist Validator
            </h3>
          </div>
          <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 14px 0' }}>
            Test whether an incoming parent phone number will receive real WhatsApp notifications or be safely filtered.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              value={testInputPhone}
              onChange={(e) => setTestInputPhone(e.target.value)}
              placeholder="Enter phone number (e.g. 9009519718)"
              className="hhs-input"
              style={{ flex: 1, height: '40px' }}
            />
            <button
              onClick={handleTestPhoneValidation}
              style={{
                backgroundColor: '#0A1931',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '0 16px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Verify Filter
            </button>
          </div>

          {testResult && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: testResult.allowed ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${testResult.allowed ? '#A7F3D0' : '#FECACA'}`,
                color: testResult.allowed ? '#065F46' : '#991B1B',
                fontSize: '0.82rem',
                lineHeight: 1.4,
              }}
            >
              <strong>{testResult.allowed ? '✓ ALLOWED FOR LIVE DISPATCH:' : '✕ FILTERED / SKIPPED:'}</strong>{' '}
              {testResult.reason}
            </div>
          )}
        </div>

        {/* Bilingual Template Previewer */}
        <div className="hhs-card" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#0A1931" />
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0A1931', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Official Notification Templates
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setActiveTemplateTab('present')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: activeTemplateTab === 'present' ? '#0A1931' : '#FFFFFF',
                  color: activeTemplateTab === 'present' ? '#FFFFFF' : '#0A1931',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Present Alert
              </button>
              <button
                onClick={() => setActiveTemplateTab('absent')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: activeTemplateTab === 'absent' ? '#0A1931' : '#FFFFFF',
                  color: activeTemplateTab === 'absent' ? '#FFFFFF' : '#0A1931',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Absent Alert
              </button>
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '0.78rem',
              color: '#334155',
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              maxHeight: '160px',
              overflowY: 'auto',
            }}
          >
            {activeTemplateTab === 'present'
              ? PHASE_CONFIG.whatsapp.templates.present('Aarav Singhania', '02 Nov 2026', 'Shashwat')
              : PHASE_CONFIG.whatsapp.templates.absent('Aarav Singhania', '02 Nov 2026', 'Shashwat')}
          </div>
        </div>

      </div>

      {/* Live Notification Queue Table */}
      <div className="hhs-card" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div
          className="hhs-card-header"
          style={{
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0A1931', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Message Queue & Delivery Receipts
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
              Showing {filteredJobs.length} notification jobs
            </span>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0 8px', height: '32px' }}>
              <Search size={14} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search recipient or student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.78rem', marginLeft: '6px', width: '180px' }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="hhs-select"
              style={{ height: '32px', fontSize: '0.76rem', padding: '0 24px 0 8px' }}
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="pending">Pending</option>
              <option value="skipped">Skipped (Allowlist)</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Student & Class</th>
                <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Recipient Parent</th>
                <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Attendance State</th>
                <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Delivery Status</th>
                <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Message Summary</th>
                <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: '0.86rem' }}>
                    No notification jobs found in active session queue.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => {
                  const isSent = j.deliveryStatus === 'sent';
                  const isSkipped = j.deliveryStatus === 'skipped';
                  const isFailed = j.deliveryStatus === 'failed';

                  return (
                    <tr key={j.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ color: '#0A1931', display: 'block' }}>{j.studentName}</strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{j.classLabel}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: '#0F172A' }}>{j.guardianName}</div>
                        <span style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>
                          {j.recipientPhone || 'No Phone Registered'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: j.attendanceState === 'present' ? '#ECFDF5' : '#FEF2F2',
                            color: j.attendanceState === 'present' ? '#065F46' : '#991B1B',
                          }}
                        >
                          {j.attendanceState === 'present' ? '✓ Present' : '✕ Absent'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: isSent ? '#ECFDF5' : isSkipped ? '#FEF3C7' : isFailed ? '#FEF2F2' : '#EFF6FF',
                            color: isSent ? '#065F46' : isSkipped ? '#92400E' : isFailed ? '#991B1B' : '#1D4ED8',
                          }}
                        >
                          {isSent && <Check size={11} />}
                          {isSkipped && <ShieldAlert size={11} />}
                          {isFailed && <XCircle size={11} />}
                          <span>{j.deliveryStatus.toUpperCase()}</span>
                        </span>
                        {j.skipReason && (
                          <div style={{ fontSize: '0.68rem', color: '#92400E', marginTop: '2px' }}>
                            {j.skipReason}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: '#475569',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={j.messageText}
                        >
                          {j.messageText}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRetryJob(j)}
                          disabled={retryingJobId === j.id}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#0A1931',
                            cursor: 'pointer',
                          }}
                        >
                          {retryingJobId === j.id ? 'Retrying...' : 'Retry'}
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

    </div>
  );
};
