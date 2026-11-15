import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { Permissions } from '../../domain/permissions';
import { WhatsAppNotificationService } from '../../services/whatsapp/whatsappService';
import type {
  AttendanceCorrection,
  AttendanceState,
  StudentRecord,
  ClassSection,
} from '../../domain/types';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  RotateCw,
  Eye,
  AlertTriangle,
  Calendar,
  ArrowRight,
} from 'lucide-react';

export const AttendanceCorrections: React.FC = () => {
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');

  // Principal Review Modal
  const [reviewCorrection, setReviewCorrection] = useState<AttendanceCorrection | null>(null);
  const [reviewMode, setReviewMode] = useState<'approve' | 'reject'>('approve');
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [isProcessingReview, setIsProcessingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // View Details Modal
  const [detailsCorrection, setDetailsCorrection] = useState<AttendanceCorrection | null>(null);

  // New Request Modal (Admin Office)
  const [isNewRequestOpen, setIsNewRequestOpen] = useState<boolean>(false);
  const [newRequestForm, setNewRequestForm] = useState({
    studentId: '',
    sessionId: '',
    classId: '',
    date: new Date().toISOString().split('T')[0],
    previousState: 'absent' as AttendanceState,
    requestedState: 'present' as AttendanceState,
    mandatoryReason: '',
  });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Retrying notification
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const isPrincipal = currentUser?.role === 'principal';
  const isDeveloper = currentUser?.role === 'developer';
  const isAdmin = currentUser?.role === 'admin';
  const canApprove = isPrincipal || isDeveloper;
  const canRequest = isAdmin || isDeveloper;

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [corrList, clsList, stuRes] = await Promise.all([
        provider.getAttendanceCorrections(),
        provider.getClasses(),
        provider.getStudents({ limit: 1000 }),
      ]);
      setCorrections(corrList);
      setClasses(clsList);
      setStudents(stuRes.items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load attendance corrections.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [provider]);

  // Toast auto-clear
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // KPI calculations
  const pendingCount = useMemo(
    () => corrections.filter(c => c.status === 'pending_principal').length,
    [corrections]
  );
  const approvedCount = useMemo(
    () => corrections.filter(c => c.status === 'approved').length,
    [corrections]
  );
  const rejectedCount = useMemo(
    () => corrections.filter(c => c.status === 'rejected').length,
    [corrections]
  );
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return corrections.filter(c => (c.requestedAt || '').startsWith(today)).length;
  }, [corrections]);

  // Filtered corrections list
  const filteredCorrections = useMemo(() => {
    return corrections.filter(c => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterClass !== 'all' && c.classId !== filterClass) return false;
      if (filterDate && c.date !== filterDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (c.studentName || '').toLowerCase().includes(q);
        const matchesAdmission = (c.admissionNumber || '').toLowerCase().includes(q);
        const matchesReason = (c.mandatoryReason || '').toLowerCase().includes(q);
        if (!matchesName && !matchesAdmission && !matchesReason) return false;
      }
      return true;
    });
  }, [corrections, filterStatus, filterClass, filterDate, searchQuery]);

  // Handle Review (Approve or Reject)
  const handleOpenReview = (corr: AttendanceCorrection, mode: 'approve' | 'reject') => {
    setReviewCorrection(corr);
    setReviewMode(mode);
    setReviewRemarks(mode === 'approve' ? 'Verified student attendance records and justification.' : '');
    setReviewError(null);
  };

  const handleSubmitReview = async () => {
    if (!reviewCorrection || !currentUser) return;
    if (reviewMode === 'reject' && !reviewRemarks.trim()) {
      setReviewError('Please specify the mandatory reason for rejecting this correction request.');
      return;
    }

    setIsProcessingReview(true);
    setReviewError(null);
    try {
      await provider.approveAttendanceCorrection(
        reviewCorrection.id,
        currentUser,
        reviewMode === 'approve',
        reviewRemarks.trim()
      );

      setSuccessToast(
        reviewMode === 'approve'
          ? `Correction approved for ${reviewCorrection.studentName}. Attendance record updated and parent notification dispatched.`
          : `Correction rejected for ${reviewCorrection.studentName}. Original attendance preserved.`
      );

      setReviewCorrection(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete correction review.';
      setReviewError(msg);
    } finally {
      setIsProcessingReview(false);
    }
  };

  // Handle Retry Notification
  const handleRetryNotification = async (corr: AttendanceCorrection) => {
    if (!corr.notificationJobId) return;
    setRetryingJobId(corr.id);
    try {
      const job = await WhatsAppNotificationService.getNotificationJob(corr.notificationJobId);
      if (job) {
        const updated = await WhatsAppNotificationService.retryJob(job);
        setSuccessToast(`Notification retried for ${corr.studentName}: status is ${updated.deliveryStatus}.`);
        await loadData();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to retry notification.');
    } finally {
      setRetryingJobId(null);
    }
  };

  // Handle Submit New Request
  const handleOpenNewRequest = () => {
    const defaultStudent = students[0];
    const defaultClass = classes[0];
    setNewRequestForm({
      studentId: defaultStudent ? defaultStudent.id : '',
      sessionId: `att-${defaultClass?.id || 'class-10-a'}-${new Date().toISOString().split('T')[0]}`,
      classId: defaultClass ? defaultClass.id : 'class-10-a',
      date: new Date().toISOString().split('T')[0],
      previousState: 'absent',
      requestedState: 'present',
      mandatoryReason: '',
    });
    setRequestError(null);
    setIsNewRequestOpen(true);
  };

  const handleSubmitNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!newRequestForm.mandatoryReason.trim()) {
      setRequestError('Mandatory justification / remarks are required.');
      return;
    }
    if (newRequestForm.previousState === newRequestForm.requestedState) {
      setRequestError('Requested status cannot be identical to the currently recorded status.');
      return;
    }

    setIsSubmittingRequest(true);
    setRequestError(null);
    try {
      const selectedStudent = students.find(s => s.id === newRequestForm.studentId);
      const selectedCls = classes.find(c => c.id === newRequestForm.classId);

      await provider.requestAttendanceCorrection(
        {
          sessionId: `att-${newRequestForm.classId}-${newRequestForm.date}`,
          studentId: newRequestForm.studentId,
          section: selectedCls?.section || '',
          admissionNumber: selectedStudent?.admissionNumber || '',
          previousState: newRequestForm.previousState,
          requestedState: newRequestForm.requestedState,
          mandatoryReason: newRequestForm.mandatoryReason.trim(),
        },
        currentUser
      );

      setSuccessToast(`Correction request submitted for ${selectedStudent?.fullName || 'student'}. Awaiting Principal review.`);
      setIsNewRequestOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit correction request.';
      setRequestError(msg);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading attendance correction requests and approval ledger..." />;
  }

  const pageTitle = canApprove ? 'Attendance Correction Approvals' : 'Attendance Correction Requests';
  const pageSubtitle = canApprove
    ? 'HanuJai High School, Jaipur • Institutional review and dual-custody approval of attendance corrections.'
    : 'HanuJai High School, Jaipur • Track attendance correction requests and view Principal decisions.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        breadcrumbs={[
          { label: 'Campus' },
          { label: 'Attendance', to: '/attendance' },
          { label: canApprove ? 'Approvals' : 'Correction Requests' },
        ]}
        actions={
          canRequest && (
            <button
              onClick={handleOpenNewRequest}
              className="hhs-btn hhs-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#0A1931',
                color: '#FFFFFF',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              <span>New Correction Request</span>
            </button>
          )
        }
      />

      {error && <ErrorBanner title="Correction Ledger Error" message={error} />}

      {successToast && (
        <div
          style={{
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: '8px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#065F46',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>{successToast}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Pending Requests */}
        <div
          className="hhs-card"
          style={{
            padding: '18px 20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            borderLeft: '4px solid #F59E0B',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>
              Pending Approvals
            </span>
            <Clock size={18} color="#F59E0B" />
          </div>
          <div style={{ marginTop: '8px', fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#B45309', marginTop: '4px', fontWeight: 500 }}>
            Requires Principal action
          </div>
        </div>

        {/* Approved Requests */}
        <div
          className="hhs-card"
          style={{
            padding: '18px 20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            borderLeft: '4px solid #10B981',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>
              Approved Corrections
            </span>
            <CheckCircle2 size={18} color="#10B981" />
          </div>
          <div style={{ marginTop: '8px', fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>
            {approvedCount}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '4px', fontWeight: 500 }}>
            Applied & notified
          </div>
        </div>

        {/* Rejected Requests */}
        <div
          className="hhs-card"
          style={{
            padding: '18px 20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            borderLeft: '4px solid #EF4444',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>
              Rejected Requests
            </span>
            <XCircle size={18} color="#EF4444" />
          </div>
          <div style={{ marginTop: '8px', fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>
            {rejectedCount}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#B91C1C', marginTop: '4px', fontWeight: 500 }}>
            Original attendance retained
          </div>
        </div>

        {/* Today's Requests */}
        <div
          className="hhs-card"
          style={{
            padding: '18px 20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            borderLeft: '4px solid #3B82F6',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>
              Today's Requests
            </span>
            <Calendar size={18} color="#3B82F6" />
          </div>
          <div style={{ marginTop: '8px', fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>
            {todayCount}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#1D4ED8', marginTop: '4px', fontWeight: 500 }}>
            Logged in current session
          </div>
        </div>
      </div>

      {/* Dual Custody Safeguard Notice */}
      <div
        style={{
          padding: '12px 18px',
          borderRadius: '8px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.84rem',
          color: '#475569',
        }}
      >
        <ShieldCheck size={20} color="#0A1931" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: '#0A1931' }}>Dual Custody Enforcement:</strong> Submitted attendance registers are permanently locked against direct editing. Any correction requires verified justification from Admin Office and formal review by Principal. Once approved, the register reflects the correction and a bilingual correction notice is dispatched to that student's parent only.
        </div>
      </div>

      {/* Filters Toolbar */}
      <div
        className="hhs-card"
        style={{
          padding: '16px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: filterStatus === 'all' ? '1px solid #0A1931' : '1px solid #E2E8F0',
              backgroundColor: filterStatus === 'all' ? '#0A1931' : '#FFFFFF',
              color: filterStatus === 'all' ? '#FFFFFF' : '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All ({corrections.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('pending_principal')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: filterStatus === 'pending_principal' ? '1px solid #F59E0B' : '1px solid #E2E8F0',
              backgroundColor: filterStatus === 'pending_principal' ? '#FEF3C7' : '#FFFFFF',
              color: filterStatus === 'pending_principal' ? '#B45309' : '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('approved')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: filterStatus === 'approved' ? '1px solid #10B981' : '1px solid #E2E8F0',
              backgroundColor: filterStatus === 'approved' ? '#D1FAE5' : '#FFFFFF',
              color: filterStatus === 'approved' ? '#065F46' : '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('rejected')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: filterStatus === 'rejected' ? '1px solid #EF4444' : '1px solid #E2E8F0',
              backgroundColor: filterStatus === 'rejected' ? '#FEE2E2' : '#FFFFFF',
              color: filterStatus === 'rejected' ? '#991B1B' : '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {/* Class, Date & Search */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Class Select */}
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.82rem',
              color: '#0A1931',
              backgroundColor: '#FFFFFF',
            }}
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.82rem',
              color: '#0A1931',
            }}
          />
          {filterDate && (
            <button
              type="button"
              onClick={() => setFilterDate('')}
              style={{
                fontSize: '0.74rem',
                color: '#64748B',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear Date
            </button>
          )}

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
            />
            <input
              type="text"
              placeholder="Search student or admission no..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px 6px 30px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.82rem',
                width: '220px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Corrections Table */}
      <div
        className="hhs-card"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Student Details</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Class & Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Change Request</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Reason / Justification</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Requested By</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>WhatsApp Notice</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCorrections.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={36} color="#CBD5E1" />
                      <div style={{ fontWeight: 600, color: '#334155' }}>No attendance correction records found</div>
                      <div style={{ fontSize: '0.78rem' }}>
                        {corrections.length === 0
                          ? 'No attendance corrections have been requested yet.'
                          : 'No records match the current filter criteria.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCorrections.map(corr => {
                  const isPending = corr.status === 'pending_principal';
                  const isApproved = corr.status === 'approved';
                  const isRejected = corr.status === 'rejected';

                  // Can current user approve this specific correction? (Dual custody check)
                  const userCanApproveThis =
                    canApprove && isPending && Permissions.canApproveAttendanceCorrection(currentUser, corr);

                  return (
                    <tr
                      key={corr.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Student Details */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0A1931' }}>{corr.studentName}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                          Adm: {corr.admissionNumber || corr.studentId}
                        </div>
                      </td>

                      {/* Class & Date */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B' }}>{corr.classLabel}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                          {corr.date}
                        </div>
                      </td>

                      {/* Change Request (Prev -> Req) */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              backgroundColor: corr.previousState === 'present' ? '#DCFCE7' : '#FEE2E2',
                              color: corr.previousState === 'present' ? '#15803D' : '#B91C1C',
                            }}
                          >
                            {corr.previousState}
                          </span>
                          <ArrowRight size={14} color="#94A3B8" />
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              backgroundColor: corr.requestedState === 'present' ? '#DCFCE7' : '#FEE2E2',
                              color: corr.requestedState === 'present' ? '#15803D' : '#B91C1C',
                            }}
                          >
                            {corr.requestedState}
                          </span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                        <div
                          style={{
                            color: '#334155',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={corr.mandatoryReason}
                        >
                          {corr.mandatoryReason}
                        </div>
                        {corr.reviewRemarks && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: isApproved ? '#047857' : '#B91C1C',
                              marginTop: '2px',
                              fontStyle: 'italic',
                            }}
                          >
                            Note: {corr.reviewRemarks}
                          </div>
                        )}
                      </td>

                      {/* Requested By */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B' }}>{corr.requestedByStaffName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
                          {new Date(corr.requestedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {isPending && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              backgroundColor: '#FEF3C7',
                              color: '#B45309',
                            }}
                          >
                            <Clock size={12} />
                            <span>Pending Review</span>
                          </span>
                        )}
                        {isApproved && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              backgroundColor: '#DCFCE7',
                              color: '#15803D',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>Approved</span>
                          </span>
                        )}
                        {isRejected && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              backgroundColor: '#FEE2E2',
                              color: '#B91C1C',
                            }}
                          >
                            <XCircle size={12} />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>

                      {/* WhatsApp Notice Status */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {isApproved ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                                backgroundColor:
                                  corr.notificationStatus === 'sent'
                                    ? '#ECFDF5'
                                    : corr.notificationStatus === 'failed'
                                    ? '#FEF2F2'
                                    : '#FFFBEB',
                                color:
                                  corr.notificationStatus === 'sent'
                                    ? '#065F46'
                                    : corr.notificationStatus === 'failed'
                                    ? '#991B1B'
                                    : '#92400E',
                              }}
                            >
                              {corr.notificationStatus || 'Sent'}
                            </span>
                            {corr.notificationStatus === 'failed' && (
                              <button
                                type="button"
                                onClick={() => handleRetryNotification(corr)}
                                disabled={retryingJobId === corr.id}
                                title="Retry WhatsApp Notification"
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  color: '#EF4444',
                                }}
                              >
                                <RotateCw size={14} className={retryingJobId === corr.id ? 'animate-spin' : ''} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '0.74rem' }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {userCanApproveThis ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReview(corr, 'approve')}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #10B981',
                                  backgroundColor: '#10B981',
                                  color: '#FFFFFF',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenReview(corr, 'reject')}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF',
                                  color: '#DC2626',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDetailsCorrection(corr)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#475569',
                                fontSize: '0.76rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              <Eye size={12} />
                              <span>Details</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Principal Review Modal (Approve or Reject) */}
      {reviewCorrection && (
        <Modal
          isOpen={true}
          onClose={() => !isProcessingReview && setReviewCorrection(null)}
          title={reviewMode === 'approve' ? 'Approve Attendance Correction' : 'Reject Attendance Correction'}
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {reviewError && <ErrorBanner title="Review Error" message={reviewError} />}

            {/* Student & Correction Summary Card */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Student:</span>
                <span style={{ fontWeight: 700, color: '#0A1931' }}>{reviewCorrection.studentName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Admission No:</span>
                <span style={{ fontWeight: 600 }}>{reviewCorrection.admissionNumber || reviewCorrection.studentId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Class & Date:</span>
                <span style={{ fontWeight: 600 }}>{reviewCorrection.classLabel} • {reviewCorrection.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748B' }}>Status Change:</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      backgroundColor: reviewCorrection.previousState === 'present' ? '#DCFCE7' : '#FEE2E2',
                      color: reviewCorrection.previousState === 'present' ? '#15803D' : '#B91C1C',
                    }}
                  >
                    {reviewCorrection.previousState}
                  </span>
                  <ArrowRight size={14} color="#94A3B8" />
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      backgroundColor: reviewCorrection.requestedState === 'present' ? '#DCFCE7' : '#FEE2E2',
                      color: reviewCorrection.requestedState === 'present' ? '#15803D' : '#B91C1C',
                    }}
                  >
                    {reviewCorrection.requestedState}
                  </span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '8px', marginTop: '2px' }}>
                <div style={{ color: '#64748B', fontSize: '0.78rem' }}>Justification from Admin Office:</div>
                <div style={{ color: '#0F172A', fontWeight: 500, marginTop: '2px' }}>
                  "{reviewCorrection.mandatoryReason}"
                </div>
              </div>
            </div>

            {/* Action Notice */}
            {reviewMode === 'approve' ? (
              <div
                style={{
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '0.82rem',
                  color: '#065F46',
                  display: 'flex',
                  gap: '10px',
                }}
              >
                <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Official Record Update:</strong> Approving will update the attendance session atomically to <strong>{reviewCorrection.requestedState.toUpperCase()}</strong> and trigger a single bilingual WhatsApp correction notification exclusively to this student's parent/guardian.
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '0.82rem',
                  color: '#991B1B',
                  display: 'flex',
                  gap: '10px',
                }}
              >
                <AlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Original Record Maintained:</strong> Rejecting will leave the original attendance unchanged as <strong>{reviewCorrection.previousState.toUpperCase()}</strong>. You must supply a rejection reason below.
                </div>
              </div>
            )}

            {/* Remarks input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                {reviewMode === 'approve' ? 'Approval Remarks (Optional)' : 'Rejection Reason (Mandatory)'}
              </label>
              <textarea
                value={reviewRemarks}
                onChange={e => setReviewRemarks(e.target.value)}
                placeholder={
                  reviewMode === 'approve'
                    ? 'E.g. Verified supporting parent slip / leave letter.'
                    : 'Specify reason for rejecting this correction request...'
                }
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.84rem',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setReviewCorrection(null)}
                disabled={isProcessingReview}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={isProcessingReview}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: reviewMode === 'approve' ? '#10B981' : '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: isProcessingReview ? 'not-allowed' : 'pointer',
                  opacity: isProcessingReview ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isProcessingReview && <RotateCw size={14} className="animate-spin" />}
                <span>
                  {reviewMode === 'approve' ? 'Confirm & Apply Correction' : 'Reject Request'}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: View Details Modal */}
      {detailsCorrection && (
        <Modal
          isOpen={true}
          onClose={() => setDetailsCorrection(null)}
          title="Attendance Correction Details"
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Student Name</span>
                <div style={{ fontWeight: 700, color: '#0A1931', marginTop: '2px' }}>
                  {detailsCorrection.studentName}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Admission Number</span>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>
                  {detailsCorrection.admissionNumber || detailsCorrection.studentId}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Class & Section</span>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{detailsCorrection.classLabel}</div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Attendance Date</span>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{detailsCorrection.date}</div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Originally Submitted</span>
                <div style={{ textTransform: 'uppercase', fontWeight: 700, color: detailsCorrection.previousState === 'present' ? '#15803D' : '#B91C1C', marginTop: '2px' }}>
                  {detailsCorrection.previousState}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Requested Status</span>
                <div style={{ textTransform: 'uppercase', fontWeight: 700, color: detailsCorrection.requestedState === 'present' ? '#15803D' : '#B91C1C', marginTop: '2px' }}>
                  {detailsCorrection.requestedState}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
              <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Justification</span>
              <div style={{ marginTop: '4px', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', color: '#1E293B' }}>
                {detailsCorrection.mandatoryReason}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Requested By</span>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{detailsCorrection.requestedByStaffName}</div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{new Date(detailsCorrection.requestedAt).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Review Status</span>
                <div style={{ fontWeight: 700, textTransform: 'capitalize', marginTop: '2px', color: detailsCorrection.status === 'approved' ? '#15803D' : detailsCorrection.status === 'rejected' ? '#B91C1C' : '#B45309' }}>
                  {detailsCorrection.status.replace('_', ' ')}
                </div>
                {detailsCorrection.reviewedByStaffName && (
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>By {detailsCorrection.reviewedByStaffName}</div>
                )}
              </div>
            </div>

            {detailsCorrection.reviewRemarks && (
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Review Remarks</span>
                <div style={{ marginTop: '4px', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', color: '#1E293B' }}>
                  {detailsCorrection.reviewRemarks}
                </div>
              </div>
            )}

            {detailsCorrection.status === 'approved' && (
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#64748B', fontSize: '0.78rem' }}>WhatsApp Parent Notice</span>
                  <div style={{ fontWeight: 600, marginTop: '2px', color: detailsCorrection.notificationStatus === 'sent' ? '#065F46' : '#991B1B' }}>
                    Status: {detailsCorrection.notificationStatus || 'Sent'}
                  </div>
                </div>
                {detailsCorrection.notificationStatus === 'failed' && (
                  <button
                    type="button"
                    onClick={() => handleRetryNotification(detailsCorrection)}
                    className="hhs-btn hhs-btn-secondary"
                    style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                  >
                    Retry Sending
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setDetailsCorrection(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  backgroundColor: '#0A1931',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: New Correction Request Modal (Admin Office) */}
      {isNewRequestOpen && (
        <Modal
          isOpen={true}
          onClose={() => !isSubmittingRequest && setIsNewRequestOpen(false)}
          title="Request Attendance Correction"
          maxWidth="560px"
        >
          <form onSubmit={handleSubmitNewRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {requestError && <ErrorBanner title="Request Error" message={requestError} />}

            <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
              Submit a formal attendance correction request for Principal review. Submitted attendance registers cannot be modified directly.
            </div>

            {/* Class selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Class & Section</label>
              <select
                value={newRequestForm.classId}
                onChange={e => {
                  const cId = e.target.value;
                  const matchingStudents = students.filter(s => s.classId === cId);
                  setNewRequestForm(prev => ({
                    ...prev,
                    classId: cId,
                    studentId: matchingStudents[0]?.id || prev.studentId,
                  }));
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.84rem',
                }}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Student selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Student</label>
              <select
                value={newRequestForm.studentId}
                onChange={e => setNewRequestForm(prev => ({ ...prev, studentId: e.target.value }))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.84rem',
                }}
              >
                {students
                  .filter(s => s.classId === newRequestForm.classId)
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} (Roll {s.rollNumber} • Adm: {s.admissionNumber})
                    </option>
                  ))}
              </select>
            </div>

            {/* Date selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Attendance Date</label>
              <input
                type="date"
                value={newRequestForm.date}
                onChange={e => setNewRequestForm(prev => ({ ...prev, date: e.target.value }))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.84rem',
                }}
              />
            </div>

            {/* State toggle: Recorded -> Target */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Recorded Status</label>
                <select
                  value={newRequestForm.previousState}
                  onChange={e => {
                    const prev = e.target.value as AttendanceState;
                    setNewRequestForm(f => ({
                      ...f,
                      previousState: prev,
                      requestedState: prev === 'absent' ? 'present' : 'absent',
                    }));
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                  }}
                >
                  <option value="absent">Absent</option>
                  <option value="present">Present</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Corrected Status</label>
                <select
                  value={newRequestForm.requestedState}
                  onChange={e => setNewRequestForm(f => ({ ...f, requestedState: e.target.value as AttendanceState }))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                  }}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>

            {/* Mandatory Reason */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                Mandatory Reason / Justification <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                value={newRequestForm.mandatoryReason}
                onChange={e => setNewRequestForm(prev => ({ ...prev, mandatoryReason: e.target.value }))}
                placeholder="E.g. Parent informed student arrived at 08:30 AM after medical appointment, marked absent in morning roll call by mistake."
                rows={3}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.84rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setIsNewRequestOpen(false)}
                disabled={isSubmittingRequest}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingRequest}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#0A1931',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: isSubmittingRequest ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingRequest ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isSubmittingRequest && <RotateCw size={14} className="animate-spin" />}
                <span>Submit Correction Request</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
