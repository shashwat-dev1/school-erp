/**
 * HanuJai High School ERP — Student Document Management Tab
 * Official 9-Slot Mandatory Student Document Repository
 * 
 * Features:
 * - 9 required slots grouped into Student, Father's, and Mother's documents.
 * - Completeness KPI progress bar (X of 9 documents uploaded).
 * - Secure preview and download.
 * - Role-based permissions: Admin Office can upload/replace/delete; Principal has read-only oversight.
 * - Size and MIME validation (5MB for photo, 10MB for documents).
 */

import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../../config/firebase';
import { useData } from '../../context/DataContext';
import { Permissions } from '../../domain/permissions';
import {
  DOCUMENT_SLOT_DEFINITIONS,
  DOCUMENT_CATEGORIES,
  calculateDocumentCompleteness,
  validateDocumentFile,
  formatSchoolDisplayDate,
} from '../../domain/policy';
import type {
  StudentRecord,
  StaffUser,
  StudentDocumentRecord,
  StudentDocumentType,
  DocumentSlotDefinition,
} from '../../domain/types';
import { Modal } from '../../components/ui/Modal';
import {
  FileText,
  Upload,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface StudentDocumentsTabProps {
  student: StudentRecord;
  currentUser: StaffUser | null;
}

export const StudentDocumentsTab: React.FC<StudentDocumentsTabProps> = ({
  student,
  currentUser,
}) => {
  const { provider } = useData();

  const [documents, setDocuments] = useState<StudentDocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Upload / Replace modal state
  const [targetSlot, setTargetSlot] = useState<DocumentSlotDefinition | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<{ record: StudentDocumentRecord; url: string } | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<StudentDocumentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const canUpload = Permissions.canUploadStudentDocument(currentUser);
  const canDelete = Permissions.canDeleteStudentDocument(currentUser);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const records = await provider.getStudentDocuments(student.id);
      setDocuments(records);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load student documents.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [student.id, provider]);

  const completeness = calculateDocumentCompleteness(documents);
  const docsByType = new Map<StudentDocumentType, StudentDocumentRecord>();
  documents.forEach(d => {
    if (d.isPresent !== false) {
      docsByType.set(d.documentType, d);
    }
  });

  const handleOpenUpload = (slot: DocumentSlotDefinition) => {
    setTargetSlot(slot);
    setSelectedFile(null);
    setFileValidationError(null);
    setUploadError(null);
    setIsUploadModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !targetSlot) return;
    const file = e.target.files[0];
    const validation = validateDocumentFile(targetSlot.type, {
      size: file.size,
      type: file.type,
      name: file.name,
    });

    if (!validation.valid) {
      setFileValidationError(validation.error || 'Invalid file.');
      setSelectedFile(null);
    } else {
      setFileValidationError(null);
      setSelectedFile(file);
    }
  };

  const handlePerformUpload = async () => {
    if (!selectedFile || !targetSlot || !currentUser) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      await provider.uploadStudentDocument(
        student.id,
        targetSlot.type,
        selectedFile,
        {
          originalFileName: selectedFile.name,
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
        },
        currentUser,
        (progressPercent: number) => {
          setUploadProgress(progressPercent);
        }
      );
      await loadDocuments();
      setIsUploadModalOpen(false);
      setSelectedFile(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed. Please check network and permissions.';
      setUploadError(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreview = async (docRecord: StudentDocumentRecord) => {
    try {
      let url = docRecord.downloadUrl;
      let idToken = '';
      if (auth?.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken();
        } catch {
          // Non-blocking
        }
      }
      if (!url && provider.getDocumentDownloadUrl) {
        url = await provider.getDocumentDownloadUrl(docRecord.storagePath);
      }
      if (url) {
        if (idToken && !url.includes('token=') && url.startsWith('/api/')) {
          url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(idToken);
        }
        setPreviewDoc({ record: docRecord, url });
      } else {
        alert('Could not resolve preview URL for this document.');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to retrieve preview.');
    }
  };

  const handleDownload = async (docRecord: StudentDocumentRecord) => {
    try {
      let url = docRecord.downloadUrl;
      let idToken = '';
      if (auth?.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken();
        } catch {
          // Non-blocking
        }
      }
      if (!url && provider.getDocumentDownloadUrl) {
        url = await provider.getDocumentDownloadUrl(docRecord.storagePath);
      }
      if (!url) {
        alert('Could not resolve download URL.');
        return;
      }
      if (idToken && !url.includes('token=') && url.startsWith('/api/')) {
        url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(idToken);
      }
      if (url.startsWith('/api/') && !url.includes('download=')) {
        url += (url.includes('?') ? '&' : '?') + 'download=1';
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = docRecord.originalFileName || `${docRecord.documentType}.pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !currentUser) return;
    setIsDeleting(true);
    try {
      await provider.deleteStudentDocument(student.id, deleteTarget.documentType, currentUser);
      await loadDocuments();
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete document.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
        <Loader2 size={24} className="hhs-spin" style={{ margin: '0 auto 8px' }} />
        <div style={{ fontSize: '14px' }}>Loading student document dossier...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Completeness KPI Card */}
      <div
        className="hhs-card"
        style={{
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <FileCheck size={20} color="#0A1931" />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0A1931' }}>
                Document Dossier Completeness
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
              Official 9-slot institutional archive for {student.fullName}. Role-based access and cloud encryption enforced.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {completeness.uploadedCount === 9 ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={16} />
                <span>Complete (9/9)</span>
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={16} />
                <span>{completeness.missingCount} Missing ({completeness.uploadedCount}/9 Uploaded)</span>
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
            <span>Verification & Upload Progress</span>
            <span>{completeness.completionPercentage}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#F1F5F9',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${completeness.completionPercentage}%`,
                height: '100%',
                backgroundColor: completeness.uploadedCount === 9 ? '#10B981' : '#0284C7',
                borderRadius: '4px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
            color: '#B91C1C',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* 3 Grouped Sections */}
      {DOCUMENT_CATEGORIES.map(category => (
        <div key={category.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0F172A' }}>
              {category.label}
            </h4>
            <span
              style={{
                fontSize: '12px',
                color: '#64748B',
                backgroundColor: '#F1F5F9',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              {category.types.filter(t => docsByType.has(t)).length} of {category.types.length} verified
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {category.types.map(type => {
              const slot = DOCUMENT_SLOT_DEFINITIONS[type];
              const docRecord = docsByType.get(type);
              const isUploaded = Boolean(docRecord);

              return (
                <div
                  key={type}
                  className="hhs-card"
                  style={{
                    padding: '18px 20px',
                    borderRadius: '10px',
                    border: isUploaded ? '1px solid #E2E8F0' : '1px dashed #CBD5E1',
                    backgroundColor: isUploaded ? '#FFFFFF' : '#FAFAFA',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '190px',
                    boxShadow: isUploaded ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                  }}
                >
                  <div>
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: isUploaded ? '#E0F2FE' : '#F1F5F9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isUploaded ? '#0284C7' : '#94A3B8',
                          }}
                        >
                          <FileText size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                            {slot.title}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            {slot.fileTypeDescription}
                          </div>
                        </div>
                      </div>

                      {isUploaded && docRecord ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#15803D',
                            backgroundColor: '#DCFCE7',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Uploaded v{docRecord.version}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: '#64748B',
                            backgroundColor: '#F1F5F9',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Not Uploaded
                        </span>
                      )}
                    </div>

                    {/* Metadata display if uploaded */}
                    {isUploaded && docRecord && (
                      <div
                        style={{
                          margin: '10px 0',
                          padding: '8px 10px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#334155',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📄 {docRecord.originalFileName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {formatFileSize(docRecord.fileSize)} • {formatSchoolDisplayDate(docRecord.uploadedAt.split('T')[0])}
                        </div>
                        {docRecord.uploadedByName && (
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            By: {docRecord.uploadedByName}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div
                    style={{
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid #F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    {isUploaded && docRecord ? (
                      <>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handlePreview(docRecord)}
                            className="hhs-btn hhs-btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Preview Document"
                          >
                            <Eye size={13} />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(docRecord)}
                            className="hhs-btn hhs-btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Download Document"
                          >
                            <Download size={13} />
                            <span>Download</span>
                          </button>
                        </div>

                        {canUpload && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenUpload(slot)}
                              className="hhs-btn hhs-btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Replace with updated scan"
                            >
                              <RefreshCw size={13} />
                              <span>Replace</span>
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(docRecord)}
                                className="hhs-btn hhs-btn-secondary"
                                style={{ padding: '6px 8px', fontSize: '12px', color: '#DC2626', borderColor: '#FCA5A5' }}
                                title="Delete document"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                          {canUpload ? 'Mandatory archive document' : 'Pending upload by Admin'}
                        </div>
                        {canUpload && (
                          <button
                            type="button"
                            onClick={() => handleOpenUpload(slot)}
                            className="hhs-btn hhs-btn-primary"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Upload size={13} />
                            <span>Upload</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Upload / Replace Modal */}
      {isUploadModalOpen && targetSlot && (
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => !isUploading && setIsUploadModalOpen(false)}
          title={`Upload ${targetSlot.title}`}
          subtitle={`Allowed format: ${targetSlot.fileTypeDescription}`}
          maxWidth="520px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="hhs-btn hhs-btn-secondary"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hhs-btn hhs-btn-primary"
                onClick={handlePerformUpload}
                disabled={!selectedFile || isUploading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="hhs-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Submit & Upload</span>
                  </>
                )}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                border: '2px dashed #CBD5E1',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: '#F8FAFC',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={targetSlot.acceptedMimeTypes.join(',')}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Upload size={32} color="#64748B" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#0F172A' }}>
                {selectedFile ? selectedFile.name : 'Click to select or drag document scan'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                {selectedFile ? `${formatFileSize(selectedFile.size)}` : targetSlot.fileTypeDescription}
              </div>
            </div>

            {isUploading && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#0369A1' }}>
                  <span>Uploading to Cloud Storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: '#E0F2FE',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      backgroundColor: '#0284C7',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {fileValidationError && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '6px',
                  color: '#B91C1C',
                  fontSize: '13px',
                }}
              >
                {fileValidationError}
              </div>
            )}

            {uploadError && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '6px',
                  color: '#991B1B',
                  fontSize: '13px',
                  lineHeight: '1.4',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Upload Notice</div>
                <div>{uploadError}</div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: '#EFF6FF',
                borderRadius: '6px',
                color: '#1E40AF',
                fontSize: '12px',
              }}
            >
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Privacy Safeguard:</strong> All identity documents are strictly restricted to school administration. Full Aadhaar numbers are never extracted, stored in plaintext, or transmitted externally.
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <Modal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          title={`Document Preview: ${DOCUMENT_SLOT_DEFINITIONS[previewDoc.record.documentType]?.title || previewDoc.record.documentType}`}
          subtitle={`${previewDoc.record.originalFileName} (${formatFileSize(previewDoc.record.fileSize)})`}
          maxWidth="780px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              >
                <ExternalLink size={14} />
                <span>Open in New Tab</span>
              </a>
              <button
                type="button"
                className="hhs-btn hhs-btn-secondary"
                onClick={() => setPreviewDoc(null)}
              >
                Close
              </button>
            </div>
          }
        >
          <div style={{ minHeight: '380px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {previewDoc.record.contentType.startsWith('image/') ? (
              <img
                src={previewDoc.url}
                alt={previewDoc.record.originalFileName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '520px',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                }}
              />
            ) : previewDoc.record.contentType === 'application/pdf' ? (
              <iframe
                src={previewDoc.url}
                title={previewDoc.record.originalFileName}
                style={{
                  width: '100%',
                  height: '520px',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <FileText size={48} color="#64748B" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '14px', color: '#1E293B', fontWeight: 500 }}>
                  Inline preview is not supported for this file type.
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                  Please use the "Open in New Tab" or "Download" option.
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => !isDeleting && setDeleteTarget(null)}
          title="Confirm Document Deletion"
          maxWidth="460px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="hhs-btn hhs-btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hhs-btn hhs-btn-secondary"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{ backgroundColor: '#DC2626', color: '#FFFFFF', borderColor: '#DC2626' }}
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
              Are you sure you want to delete the document{' '}
              <strong>{DOCUMENT_SLOT_DEFINITIONS[deleteTarget.documentType]?.title}</strong>?
            </p>
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: '#FEF2F2',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#991B1B',
              }}
            >
              File: {deleteTarget.originalFileName} ({formatFileSize(deleteTarget.fileSize)})
              <br />
              This will remove the file from secure cloud storage and clear the slot in the student dossier. An entry will be logged in the system audit trail.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
