import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Check,
  Lock,
} from 'lucide-react';
import {
  ParentDocumentService,
} from '../../services/documents/parentDocumentService';
import { DOCUMENT_SLOT_DEFINITIONS, validateDocumentFile } from '../../domain/policy';
import type {
  StudentDocumentType,
  ParentUploadSession,
  DocumentSlotDefinition,
} from '../../domain/types';
import { useData } from '../../context/DataContext';

export const ParentDocumentUpload: React.FC = () => {
  const { provider } = useData();

  const [rawToken, setRawToken] = useState<string>('');
  const [phase, setPhase] = useState<'verifying_link' | 'otp_required' | 'upload_ready' | 'success_complete' | 'error'>('verifying_link');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Student & Invitation metadata
  const [studentName, setStudentName] = useState<string>('');
  const [classLabel, setClassLabel] = useState<string>('');
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [requestedSlots, setRequestedSlots] = useState<StudentDocumentType[]>([]);
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);

  // OTP State
  const [otpValue, setOtpValue] = useState<string>('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Active Upload Session
  const [session, setSession] = useState<ParentUploadSession | null>(null);

  // Per-slot upload state
  const [uploadedSlots, setUploadedSlots] = useState<Record<string, { status: 'idle' | 'uploading' | 'completed' | 'error'; progress: number; filename?: string; error?: string }>>({});

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Step 1: Read token from hash fragment and immediately scrub URL
  useEffect(() => {
    let token = '';
    const hash = window.location.hash;
    if (hash && hash.includes('t=')) {
      const match = hash.match(/t=([a-zA-Z0-9]+)/);
      if (match) {
        token = match[1];
      }
    }

    // Clean hash from browser history immediately to prevent referrer leaks
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (!token) {
      setErrorMessage('No document upload link token found. Please open the link sent by HanuJai High School on WhatsApp.');
      setPhase('error');
      return;
    }

    setRawToken(token);
    initiateVerification(token);
  }, []);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const initiateVerification = async (token: string) => {
    setPhase('verifying_link');
    setErrorMessage(null);

    try {
      const res = await ParentDocumentService.verifyTokenAndSendOtp(token);
      if (!res.valid) {
        setErrorMessage(res.error || 'Upload link is invalid or has expired.');
        setPhase('error');
        return;
      }

      setStudentName(res.studentName || 'Student');
      setClassLabel(res.classLabel || '');
      setMaskedPhone(res.maskedPhone || '');
      setRequestedSlots(res.requestedSlots || []);
      if (res.generatedOtpForDemo) {
        setDemoOtpHint(res.generatedOtpForDemo);
      }
      setCooldownSeconds(30);
      setPhase('otp_required');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to verify link.');
      setPhase('error');
    }
  };

  const handleResendOtp = async () => {
    if (cooldownSeconds > 0 || !rawToken) return;
    setOtpError(null);
    try {
      const res = await ParentDocumentService.verifyTokenAndSendOtp(rawToken);
      if (res.generatedOtpForDemo) {
        setDemoOtpHint(res.generatedOtpForDemo);
      }
      setCooldownSeconds(30);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Failed to resend code.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpValue || otpValue.trim().length !== 6) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const res = await ParentDocumentService.verifyOtpAndCreateSession(rawToken, otpValue.trim());
      if (!res.valid || !res.session) {
        setOtpError(res.error || 'Invalid verification code.');
        setIsVerifyingOtp(false);
        return;
      }

      setSession(res.session);
      // Initialize slot upload status
      const initialStatus: Record<string, { status: 'idle' | 'uploading' | 'completed' | 'error'; progress: number; filename?: string; error?: string }> = {};
      res.session.requestedSlots.forEach(slot => {
        initialStatus[slot] = { status: 'idle', progress: 0 };
      });
      setUploadedSlots(initialStatus);
      setPhase('upload_ready');
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSlotFileSelect = async (slotType: StudentDocumentType, file: File) => {
    if (!session) return;

    // Validate size and mime
    const validation = validateDocumentFile(slotType, {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      setUploadedSlots(prev => ({
        ...prev,
        [slotType]: {
          status: 'error',
          progress: 0,
          error: validation.error || 'File validation failed.',
        },
      }));
      return;
    }

    setUploadedSlots(prev => ({
      ...prev,
      [slotType]: { status: 'uploading', progress: 20, filename: file.name },
    }));

    try {
      // Synthetic staff representation for parent upload
      const parentActor = {
        id: `parent_${session.guardianPhone.replace(/[^0-9]/g, '')}`,
        name: `Parent of ${session.studentName}`,
        email: 'parent@hanujai.local',
        role: 'admin' as const, // Technical authorization to write document metadata
        status: 'active' as const,
        employeeCode: 'PARENT-PORTAL',
        designation: 'Parent / Guardian',
        department: 'Parent Portal',
        phone: session.guardianPhone,
        createdAt: new Date().toISOString(),
      };

      await provider.uploadStudentDocument(
        session.studentId,
        slotType,
        file,
        {
          originalFileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          notes: 'Uploaded by parent via secure portal link',
        },
        parentActor,
        (percent: number) => {
          setUploadedSlots(prev => ({
            ...prev,
            [slotType]: {
              ...prev[slotType],
              progress: Math.max(20, percent),
            },
          }));
        }
      );

      setUploadedSlots(prev => ({
        ...prev,
        [slotType]: { status: 'completed', progress: 100, filename: file.name },
      }));
    } catch (err) {
      setUploadedSlots(prev => ({
        ...prev,
        [slotType]: {
          status: 'error',
          progress: 0,
          error: err instanceof Error ? err.message : 'Upload failed. Please try again.',
        },
      }));
    }
  };

  const allCompleted = requestedSlots.length > 0 && requestedSlots.every(
    s => uploadedSlots[s]?.status === 'completed'
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px', maxWidth: '480px', width: '100%' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--hhs-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '14px',
            }}
          >
            H
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>
            HanuJai High School
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>• Jaipur</span>
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
          Parent Document Upload Portal
        </h1>
        <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
          सुरक्षित अभिभावक दस्तावेज़ अपलोड पोर्टल
        </div>
      </div>

      {/* Main Container Card */}
      <div
        style={{
          maxWidth: '540px',
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
          padding: '28px 24px',
          overflow: 'hidden',
        }}
      >
        {/* PHASE 1: Verifying link */}
        {phase === 'verifying_link' && (
          <div style={{ textAlign: 'center', padding: '40px 10px' }}>
            <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--hhs-primary)', margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0F172A', marginBottom: '8px' }}>
              Verifying Upload Link...
            </h3>
            <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>
              Checking security token and establishing encrypted session with HanuJai High School.
            </p>
          </div>
        )}

        {/* PHASE 2: Error Screen */}
        {phase === 'error' && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertCircle size={32} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
              Unable to Access Portal
            </h3>
            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
              {errorMessage}
            </p>
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '0.82rem',
                color: '#64748B',
                textAlign: 'left',
              }}
            >
              <strong style={{ color: '#334155', display: 'block', marginBottom: '4px' }}>Need assistance?</strong>
              Please contact HanuJai High School Administrative Office to receive a fresh verification link.
            </div>
          </div>
        )}

        {/* PHASE 3: OTP Verification */}
        {phase === 'otp_required' && (
          <div>
            {/* Student badge */}
            <div
              style={{
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#DBEAFE',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                {studentName.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1E40AF' }}>
                  {studentName}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#3B82F6' }}>
                  {classLabel} • Official Student Record
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto',
                }}
              >
                <Phone size={24} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                WhatsApp Verification Code
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                We sent a 6-digit code to your registered mobile number:
                <br />
                <strong style={{ color: '#0F172A', fontSize: '0.95rem' }}>{maskedPhone}</strong>
              </p>
            </div>

            {demoOtpHint && (
              <div
                style={{
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  color: '#92400E',
                  textAlign: 'center',
                  marginBottom: '16px',
                }}
              >
                <strong>[Demo Mode Active]</strong> Verification Code: <code>{demoOtpHint}</code>
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otpValue}
                  onChange={e => setOtpValue(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '1.75rem',
                    letterSpacing: '0.3em',
                    fontWeight: 700,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: otpError ? '2px solid #EF4444' : '2px solid #CBD5E1',
                    outline: 'none',
                    backgroundColor: '#F8FAFC',
                    boxSizing: 'border-box',
                  }}
                />
                {otpError && (
                  <div style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: '6px', textAlign: 'center' }}>
                    {otpError}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isVerifyingOtp || otpValue.length !== 6}
                className="hhs-btn hhs-btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isVerifyingOtp ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Verify Code & Enter Portal</span>
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.82rem', color: '#64748B' }}>
              Didn't receive the WhatsApp message?{' '}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldownSeconds > 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: cooldownSeconds > 0 ? '#94A3B8' : 'var(--hhs-primary)',
                  fontWeight: 600,
                  cursor: cooldownSeconds > 0 ? 'not-allowed' : 'pointer',
                  padding: 0,
                  textDecoration: cooldownSeconds > 0 ? 'none' : 'underline',
                }}
              >
                {cooldownSeconds > 0 ? `Resend code in ${cooldownSeconds}s` : 'Resend code via WhatsApp'}
              </button>
            </div>
          </div>
        )}

        {/* PHASE 4: Document Upload Form */}
        {phase === 'upload_ready' && session && (
          <div>
            {/* Header info */}
            <div style={{ marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>
                    {session.studentName}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
                    {session.classLabel} • Admission #{session.admissionNumber}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    backgroundColor: '#DCFCE7',
                    color: '#166534',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ShieldCheck size={14} /> Verified
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                Required Documents ({requestedSlots.length}):
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: 1.4 }}>
                Please upload clear photos or scanned PDF files. Supported: JPEG, PNG, WEBP, PDF up to 10 MB (5 MB for student photo).
              </p>
            </div>

            {/* Slots list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              {requestedSlots.map(slotType => {
                const slotDef: DocumentSlotDefinition | undefined = DOCUMENT_SLOT_DEFINITIONS[slotType];
                const title = slotDef?.title || slotType;
                const slotStatus = uploadedSlots[slotType] || { status: 'idle', progress: 0 };
                const isCompleted = slotStatus.status === 'completed';
                const isUploading = slotStatus.status === 'uploading';

                return (
                  <div
                    key={slotType}
                    style={{
                      border: isCompleted ? '1px solid #BBF7D0' : slotStatus.status === 'error' ? '1px solid #FECACA' : '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px',
                      backgroundColor: isCompleted ? '#F0FDF4' : '#FFFFFF',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      ref={el => { fileInputRefs.current[slotType] = el; }}
                      type="file"
                      accept={slotType === 'student_photo' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleSlotFileSelect(slotType, file);
                      }}
                      style={{ display: 'none' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: isCompleted ? '#DCFCE7' : '#F1F5F9',
                            color: isCompleted ? '#16A34A' : 'var(--hhs-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isCompleted ? <Check size={18} /> : <FileText size={18} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0F172A' }}>
                            {title}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            {slotDef?.fileTypeDescription || 'PDF or photo'}
                          </div>
                        </div>
                      </div>

                      {isCompleted ? (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#DCFCE7',
                            color: '#166534',
                            fontWeight: 600,
                          }}
                        >
                          ✓ Uploaded
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => fileInputRefs.current[slotType]?.click()}
                          className="hhs-btn hhs-btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <UploadCloud size={14} />
                          <span>{isUploading ? 'Uploading...' : 'Choose File'}</span>
                        </button>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {isUploading && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', marginBottom: '4px' }}>
                          <span>Encrypting & Uploading to Private Cloud...</span>
                          <span>{slotStatus.progress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${slotStatus.progress}%`,
                              height: '100%',
                              backgroundColor: 'var(--hhs-primary)',
                              borderRadius: '3px',
                              transition: 'width 0.2s',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {slotStatus.filename && isCompleted && (
                      <div style={{ fontSize: '0.74rem', color: '#166534', marginTop: '6px' }}>
                        File: <strong>{slotStatus.filename}</strong> (Saved to School Private Vault)
                      </div>
                    )}

                    {slotStatus.error && (
                      <div style={{ fontSize: '0.74rem', color: '#DC2626', marginTop: '6px' }}>
                        ⚠ {slotStatus.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Complete Button */}
            <button
              type="button"
              disabled={!allCompleted}
              onClick={() => setPhase('success_complete')}
              className="hhs-btn hhs-btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: allCompleted ? '#16A34A' : '#94A3B8',
                borderColor: allCompleted ? '#16A34A' : '#94A3B8',
              }}
            >
              <CheckCircle2 size={18} />
              <span>
                {allCompleted
                  ? 'Submit All Uploaded Documents'
                  : `Please Upload All ${requestedSlots.length} Documents`}
              </span>
            </button>
          </div>
        )}

        {/* PHASE 5: Success Complete */}
        {phase === 'success_complete' && (
          <div style={{ textAlign: 'center', padding: '24px 10px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              Documents Received!
            </h3>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#166534', marginBottom: '16px' }}>
              दस्तावेज़ सफलतापूर्वक प्राप्त हुए!
            </div>
            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Your uploaded documents for <strong>{studentName}</strong> ({classLabel}) have been securely encrypted and transmitted to the HanuJai High School Administrative Office.
              <br />
              The office will review and verify them shortly.
            </p>

            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '0.82rem',
                color: '#64748B',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                HanuJai High School, Jaipur
              </div>
              <div>Vidya Dadati Vinayam • Excellence in Character & Learning</div>
              <div style={{ marginTop: '6px' }}>
                Office Helpline: +91 98290 12345 • info@hanujaihighschool.edu.in
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security footer */}
      <div
        style={{
          marginTop: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.75rem',
          color: '#94A3B8',
        }}
      >
        <Lock size={12} />
        <span>256-bit Encrypted Private Cloud Vault • Vercel Mumbai (BOM1)</span>
      </div>
    </div>
  );
};
