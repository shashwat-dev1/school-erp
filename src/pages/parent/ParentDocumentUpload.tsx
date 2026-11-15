import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
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

export const ParentDocumentUpload: React.FC = () => {
  const [phase, setPhase] = useState<'verifying_link' | 'upload_ready' | 'success_complete' | 'error'>('verifying_link');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Raw token saved securely in component state
  const [rawToken, setRawToken] = useState<string>('');

  // Student & Invitation metadata
  const [requestedSlots, setRequestedSlots] = useState<StudentDocumentType[]>([]);

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

  const initiateVerification = async (token: string) => {
    setPhase('verifying_link');
    setErrorMessage(null);

    try {
      const res = await ParentDocumentService.exchangeTokenForUploadSession(token);
      if (!res.valid || !res.session) {
        setErrorMessage(res.error || 'Upload link is invalid, expired, or revoked.');
        setPhase('error');
        return;
      }

      setSession(res.session);
      setRequestedSlots(res.session.requestedSlots || []);

      // Initialize slot upload status
      const initialStatus: Record<string, { status: 'idle' | 'uploading' | 'completed' | 'error'; progress: number; filename?: string; error?: string }> = {};
      res.session.requestedSlots.forEach(slot => {
        initialStatus[slot] = { status: 'idle', progress: 0 };
      });
      setUploadedSlots(initialStatus);
      setPhase('upload_ready');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to verify upload link.');
      setPhase('error');
    }
  };

  const handleSlotFileSelect = async (slotType: StudentDocumentType, file: File) => {
    if (!session || !rawToken) return;

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
      // Execute upload via dedicated server-side parent upload architecture (using scoped uploadSessionToken)
      const uploadAuthToken = session.uploadSessionToken || rawToken;
      await ParentDocumentService.uploadParentDocument(
        uploadAuthToken,
        session.studentId,
        slotType,
        file,
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

        {/* PHASE 3: Document Upload Form */}
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
              Your uploaded documents for <strong>{session?.studentName || 'Student'}</strong> ({session?.classLabel || 'Official Record'}) have been securely encrypted and transmitted to the HanuJai High School Administrative Office.
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
