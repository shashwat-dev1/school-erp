/**
 * HanuJai High School ERP — Bulk Request Documents Modal
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Features:
 * 1. Bulk document request across multiple selected students.
 * 2. Strict isolation guarantee: Each student gets an individual, cryptographically random,
 *    student-bound invitation token (#t=TOKEN). Links and sessions are NEVER combined across siblings or peers.
 * 3. Individual WhatsApp dispatches using the official bilingual document request template.
 * 4. Slot customization with defaults (Photo, Aadhar, Birth Certificate).
 * 5. Live progress bar and detailed completion report.
 */

import React, { useState } from 'react';
import {
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  X,
  Send,
  Copy,
  Check,
} from 'lucide-react';
import type { StudentRecord, StaffUser, StudentDocumentType } from '../../domain/types';
import { DOCUMENT_SLOT_DEFINITIONS } from '../../domain/policy';
import { ParentDocumentService } from '../../services/documents/parentDocumentService';

interface BulkRequestDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: StudentRecord[];
  currentUser: StaffUser;
  onSuccess?: () => void;
}

interface DispatchResult {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  phone: string;
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
  messageId?: string;
}

export const BulkRequestDocumentsModal: React.FC<BulkRequestDocumentsModalProps> = ({
  isOpen,
  onClose,
  selectedStudents,
  currentUser,
  onSuccess,
}) => {
  const [selectedSlots, setSelectedSlots] = useState<StudentDocumentType[]>([
    'student_photo',
    'student_aadhaar_front',
    'student_aadhaar_back',
    'birth_certificate',
  ]);
  const [expiryDays, setExpiryDays] = useState<number>(7);

  // Dispatch state
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [dispatchResults, setDispatchResults] = useState<DispatchResult[]>([]);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [hasCopiedReport, setHasCopiedReport] = useState<boolean>(false);

  if (!isOpen) return null;

  const allAvailableSlots = Object.values(DOCUMENT_SLOT_DEFINITIONS);

  const handleToggleSlot = (type: StudentDocumentType) => {
    if (selectedSlots.includes(type)) {
      if (selectedSlots.length === 1) {
        alert('You must select at least one document slot to request.');
        return;
      }
      setSelectedSlots(prev => prev.filter(s => s !== type));
    } else {
      setSelectedSlots(prev => [...prev, type]);
    }
  };

  const handleSelectAllSlots = () => {
    setSelectedSlots(allAvailableSlots.map(s => s.type));
  };

  const handleSelectStandardSlots = () => {
    setSelectedSlots([
      'student_photo',
      'student_aadhaar_front',
      'student_aadhaar_back',
      'birth_certificate',
    ]);
  };

  const startDispatch = async () => {
    if (selectedSlots.length === 0) {
      alert('Please select at least one document slot.');
      return;
    }

    setIsDispatching(true);
    setIsFinished(false);
    setCurrentIndex(0);
    const results: DispatchResult[] = [];

    for (let i = 0; i < selectedStudents.length; i++) {
      setCurrentIndex(i + 1);
      const student = selectedStudents[i];
      const phone = (student.primaryPhone || '').trim();

      if (!phone) {
        results.push({
          studentId: student.id,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          phone: 'None',
          status: 'skipped',
          error: 'No guardian phone recorded in student master record.',
        });
        continue;
      }

      try {
        // Create an individual student-bound invitation with raw token in URL fragment
        const { invitation, uploadUrl } = await ParentDocumentService.createInvitation(
          student,
          selectedSlots,
          currentUser,
          expiryDays
        );

        // Dispatch official bilingual WhatsApp message
        const sendRes = await ParentDocumentService.sendInvitationWhatsApp(invitation, uploadUrl);

        results.push({
          studentId: student.id,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          phone,
          status: 'sent',
          messageId: sendRes.messageId,
        });
      } catch (err) {
        results.push({
          studentId: student.id,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          phone,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Failed to dispatch WhatsApp invitation.',
        });
      }

      // Small pacing pause for UI progress responsiveness
      await new Promise(r => setTimeout(r, 60));
    }

    setDispatchResults(results);
    setIsDispatching(false);
    setIsFinished(true);

    if (onSuccess) {
      onSuccess();
    }
  };

  const handleClose = () => {
    if (isDispatching) return;
    setIsFinished(false);
    setDispatchResults([]);
    setCurrentIndex(0);
    onClose();
  };

  const successCount = dispatchResults.filter(r => r.status === 'sent').length;
  const skippedCount = dispatchResults.filter(r => r.status === 'skipped').length;
  const failedCount = dispatchResults.filter(r => r.status === 'failed').length;

  const handleCopyReport = () => {
    const lines = [
      `HanuJai High School — Document Request Dispatch Summary`,
      `Date: ${new Date().toLocaleString('en-IN')}`,
      `Total Students: ${selectedStudents.length}`,
      `Successfully Sent: ${successCount}`,
      `Skipped: ${skippedCount}`,
      `Failed: ${failedCount}`,
      `Requested Document Slots: ${selectedSlots.join(', ')}`,
      '',
      ...dispatchResults.map(
        r => `• ${r.studentName} (${r.admissionNumber}) - ${r.phone} : ${r.status.toUpperCase()}${r.error ? ` [${r.error}]` : ''}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setHasCopiedReport(true);
    setTimeout(() => setHasCopiedReport(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="hhs-card"
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
          borderRadius: '14px',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#DCFCE7',
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                Bulk Request Documents from Parents
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
                {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected • WhatsApp Dispatch
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isDispatching}
            style={{
              background: 'none',
              border: 'none',
              cursor: isDispatching ? 'not-allowed' : 'pointer',
              color: '#64748B',
              padding: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Security & Isolation Notice */}
          <div
            style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              gap: '12px',
            }}
          >
            <ShieldCheck size={20} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.78rem', color: '#1E40AF', lineHeight: '1.45' }}>
              <strong>Strict Isolation Guarantee:</strong> Each student will receive an individual, student-bound
              invitation link via WhatsApp. Permissions, tokens, and sessions are <em>never</em> shared across students
              or siblings. Uploads are placed directly into the school's private Mumbai Blob Store.
            </div>
          </div>

          {!isFinished && !isDispatching && (
            <>
              {/* Document Slots Selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                    Document Slots to Request from Parents:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleSelectStandardSlots}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--hhs-primary)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      3 Mandatory Only
                    </button>
                    <span style={{ color: '#CBD5E1', fontSize: '0.72rem' }}>|</span>
                    <button
                      type="button"
                      onClick={handleSelectAllSlots}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--hhs-primary)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Select All 9
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: '8px',
                  }}
                >
                  {allAvailableSlots.map(slot => {
                    const isChecked = selectedSlots.includes(slot.type);
                    return (
                      <label
                        key={slot.type}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: isChecked ? '1px solid #93C5FD' : '1px solid #E2E8F0',
                          backgroundColor: isChecked ? '#F0F7FF' : '#F8FAFC',
                          cursor: 'pointer',
                          fontSize: '0.76rem',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSlot(slot.type)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: isChecked ? 600 : 400, color: '#0F172A' }}>
                          {slot.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Link Expiration Settings */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                  Link Expiration Duration:
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { label: '7 Days (Recommended)', value: 7 },
                    { label: '14 Days', value: 14 },
                    { label: '30 Days', value: 30 },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="expiryDays"
                        checked={expiryDays === opt.value}
                        onChange={() => setExpiryDays(opt.value)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Selected Students Preview Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                    Target Students ({selectedStudents.length}):
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                    Messages sent to registered guardian phone
                  </span>
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>Roll</th>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>Student Name</th>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>Class</th>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>Guardian Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStudents.map(student => {
                        const hasPhone = Boolean((student.primaryPhone || '').trim());
                        return (
                          <tr key={student.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#64748B' }}>
                              {student.rollNumber}
                            </td>
                            <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0F172A' }}>
                              {student.fullName} ({student.admissionNumber})
                            </td>
                            <td style={{ padding: '6px 10px', color: '#334155' }}>
                              {student.classLabel}
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              {hasPhone ? (
                                <span style={{ color: '#166534', fontFamily: 'monospace' }}>
                                  {student.primaryPhone}
                                </span>
                              ) : (
                                <span style={{ color: '#DC2626', fontWeight: 600 }}>
                                  ⚠️ Missing Phone
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Dispatch in Progress */}
          {isDispatching && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: '4px solid #E2E8F0',
                  borderTopColor: '#2563EB',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px auto',
                }}
              />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#0F172A', fontWeight: 700 }}>
                Dispatching WhatsApp Requests...
              </h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748B' }}>
                Sending request {currentIndex} of {selectedStudents.length} (
                {Math.round((currentIndex / selectedStudents.length) * 100)}%)
              </p>

              {/* Progress Bar */}
              <div
                style={{
                  marginTop: '16px',
                  height: '8px',
                  backgroundColor: '#E2E8F0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  maxWidth: '380px',
                  margin: '16px auto 0 auto',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    backgroundColor: '#2563EB',
                    width: `${(currentIndex / selectedStudents.length) * 100}%`,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Finished Report */}
          {isFinished && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: failedCount === 0 ? '#F0FDF4' : '#FFFBEB',
                  border: failedCount === 0 ? '1px solid #BBF7D0' : '1px solid #FDE68A',
                }}
              >
                {failedCount === 0 ? (
                  <CheckCircle2 size={24} color="#16A34A" />
                ) : (
                  <AlertCircle size={24} color="#D97706" />
                )}
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                    WhatsApp Dispatch Completed
                  </h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
                    {successCount} sent successfully • {skippedCount} skipped (no phone) • {failedCount} failed
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {hasCopiedReport ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                  <span>{hasCopiedReport ? 'Copied' : 'Copy Log'}</span>
                </button>
              </div>

              {/* Log Table */}
              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>Student</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>Contact</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchResults.map((res, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0F172A' }}>
                          {res.studentName}
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#64748B' }}>
                          {res.phone}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {res.status === 'sent' && (
                            <span style={{ color: '#16A34A', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={13} /> Sent
                            </span>
                          )}
                          {res.status === 'skipped' && (
                            <span style={{ color: '#D97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={13} /> Skipped
                            </span>
                          )}
                          {res.status === 'failed' && (
                            <span style={{ color: '#DC2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <XCircle size={13} /> Failed
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px', color: '#64748B', fontSize: '0.72rem' }}>
                          {res.messageId ? `Message ID: ${res.messageId}` : res.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
            {!isFinished ? (
              <span>
                {selectedSlots.length} document category slot{selectedSlots.length !== 1 ? 's' : ''} requested
              </span>
            ) : (
              <span>Review dispatch status in the table above</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {!isFinished ? (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isDispatching}
                  className="hhs-btn hhs-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startDispatch}
                  disabled={isDispatching || selectedStudents.length === 0}
                  className="hhs-btn hhs-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#16A34A', borderColor: '#15803D' }}
                >
                  <Send size={15} />
                  <span>Send WhatsApp Requests ({selectedStudents.length})</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="hhs-btn hhs-btn-primary"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
