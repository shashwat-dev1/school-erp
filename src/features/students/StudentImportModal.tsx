import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  X,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  DeveloperService,
  type ImportValidationSummary,
  type ImportExecutionResult,
  type ImportMode,
} from '../../services/developer/developerService';
import type { StudentRecord, ClassSection, StaffUser } from '../../domain/types';
import type { DataProvider } from '../../data/provider';

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffUser;
  provider: DataProvider;
  existingStudents: StudentRecord[];
  classes: ClassSection[];
  onImportSuccess: () => void;
}

export const StudentImportModal: React.FC<StudentImportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  provider,
  existingStudents,
  classes,
  onImportSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Header verification & mapping
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [missingRequiredColumns, setMissingRequiredColumns] = useState<string[]>([]);
  const [unexpectedColumns, setUnexpectedColumns] = useState<string[]>([]);

  // Validation
  const [validationSummary, setValidationSummary] = useState<ImportValidationSummary | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'valid' | 'errors'>('valid');

  // Mode & Execution
  const [importMode, setImportMode] = useState<ImportMode>('add_only');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Principal forbidden safeguard
  if (currentUser.role === 'principal') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-restricted-title"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          zIndex: 1050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            textAlign: 'center',
          }}
        >
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
          <h3 id="import-restricted-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            Import Access Restricted
          </h3>
          <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
            The Principal role has strictly read-only supervisory privileges. Student data ingestion and updates must be performed by the Admin Office or System Administrator.
          </p>
          <button
            onClick={onClose}
            className="hhs-btn hhs-btn-secondary"
            style={{ width: '100%' }}
          >
            Return to Student Directory
          </button>
        </div>
      </div>
    );
  }

  // Handle template download
  const handleDownloadTemplate = () => {
    DeveloperService.downloadStudentTemplate();
  };

  // Reset modal state
  const handleReset = () => {
    setCurrentStep(1);
    setFile(null);
    setIsParsing(false);
    setParseError(null);
    setRawHeaders([]);
    setMissingRequiredColumns([]);
    setUnexpectedColumns([]);
    setValidationSummary(null);
    setActivePreviewTab('valid');
    setImportMode('add_only');
    setIsExecuting(false);
    setExecutionResult(null);
    setExecutionError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (executionResult && executionResult.createdCount + executionResult.updatedCount > 0) {
      onImportSuccess();
    }
    handleReset();
    onClose();
  };

  // Step 2 & 3: File Selection & Header Verification
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await processFile(selected);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    await processFile(dropped);
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsParsing(true);
    setParseError(null);

    try {
      const { headers, rows } = await DeveloperService.parseSpreadsheetFile(uploadedFile);
      setRawHeaders(headers);

      // Verify headers
      const verification = DeveloperService.verifySpreadsheetHeaders(headers);
      setMissingRequiredColumns(verification.missingRequiredColumns);
      setUnexpectedColumns(verification.unexpectedColumns);

      if (!verification.isValid) {
        setParseError(`Required columns missing: ${verification.missingRequiredColumns.join(', ')}.`);
        setCurrentStep(2); // Stay at upload/verify
        return;
      }

      // Automatically run validation
      const summary = DeveloperService.validateSpreadsheet(
        rows,
        verification.detectedMap,
        existingStudents,
        classes
      );
      setValidationSummary(summary);
      setCurrentStep(3); // Advance to preview
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse spreadsheet.');
      setCurrentStep(2);
    } finally {
      setIsParsing(false);
    }
  };

  // Download validation error report
  const handleDownloadValidationReport = () => {
    if (!validationSummary) return;

    const invalidOrWarn = validationSummary.records.filter(
      r => r.validationErrors.length > 0 || r.validationWarnings.length > 0
    );

    const reportRows = invalidOrWarn.map(r => ({
      'Row #': r.rowIndex,
      'Admission Number': r.admissionNumber,
      'Student Name': r.fullName,
      'Class': r.classText,
      'Section': r.sectionText,
      'Status': r.status.toUpperCase(),
      'Errors': r.validationErrors.join(' | ') || 'None',
      'Warnings': r.validationWarnings.join(' | ') || 'None',
    }));

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Validation Report');
    XLSX.writeFile(wb, `HanuJai_Validation_Report_${Date.now()}.xlsx`);
  };

  // Execute database import
  const handleExecuteImport = async () => {
    if (!validationSummary || !file) return;

    setIsExecuting(true);
    setExecutionError(null);

    try {
      const result = await DeveloperService.executeImport(
        validationSummary,
        importMode,
        file.name,
        currentUser,
        provider
      );
      setExecutionResult(result);
      setCurrentStep(5); // Advance to final report
      onImportSuccess();
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : 'Database import failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Download execution result summary
  const handleDownloadExecutionReport = () => {
    if (!executionResult) return;

    const reportRows = executionResult.rowResults.map(r => ({
      'Row #': r.rowIndex,
      'Admission Number': r.admissionNumber,
      'Student Name': r.fullName,
      'Action Taken': r.action,
      'Result Message': r.message,
    }));

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Result');
    XLSX.writeFile(wb, `HanuJai_Import_Summary_${executionResult.batchId}.xlsx`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(14, 116, 144, 0.1)',
                color: 'var(--hhs-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 id="import-dialog-title" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Import Student Data
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                Batch ingestion engine • HanuJai High School ERP Phase 1
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF',
            padding: '12px 24px',
            gap: '8px',
            fontSize: '0.78rem',
            overflowX: 'auto',
          }}
        >
          {[
            { num: 1, label: '1. Template & Guidelines' },
            { num: 2, label: '2. Upload & Headers' },
            { num: 3, label: '3. Data Validation' },
            { num: 4, label: '4. Mode & Confirm' },
            { num: 5, label: '5. Summary Report' },
          ].map(step => {
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            return (
              <div
                key={step.num}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--hhs-primary)' : isCompleted ? '#16A34A' : '#94A3B8',
                  whiteSpace: 'nowrap',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: isActive
                      ? 'var(--hhs-primary)'
                      : isCompleted
                      ? '#16A34A'
                      : '#E2E8F0',
                    color: isActive || isCompleted ? '#ffffff' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {isCompleted ? <Check size={12} /> : step.num}
                </div>
                <span>{step.label}</span>
                {step.num < 5 && <ArrowRight size={12} style={{ color: '#CBD5E1', marginLeft: '4px' }} />}
              </div>
            );
          })}
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* STEP 1: Template & Guidelines */}
          {currentStep === 1 && (
            <div>
              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <FileSpreadsheet size={24} style={{ color: '#2563EB', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 600, color: '#1E40AF' }}>
                    Approved 7-Column Student Schema
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#1E3A8A', lineHeight: 1.5 }}>
                    Download the official template before uploading. The spreadsheet must include exactly the 7 columns matching our single source of truth template.
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>
                  The 7 Fixed Columns in Official Template:
                </h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {[
                    { name: 'Admission Number (SR No.)', req: 'Mandatory & Unique', desc: 'Primary student identifier (e.g. 2024/0101)' },
                    { name: 'Roll Number', req: 'Mandatory', desc: 'Class attendance register position (1, 2, 3...)' },
                    { name: 'Student Full Name', req: 'Mandatory', desc: 'Official student name (e.g. Aarav Sharma)' },
                    { name: 'Class', req: 'Mandatory', desc: 'Enrolled class (e.g. Class 10 or 10)' },
                    { name: 'Section', req: 'Mandatory', desc: 'Assigned section (e.g. A or B)' },
                    { name: 'Gender', req: 'Mandatory', desc: 'Male, Female, or Other' },
                    { name: 'WhatsApp Mobile Number', req: 'Mandatory', desc: '10-digit mobile number for WhatsApp alerts' },
                  ].map((col, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0F172A' }}>
                          {col.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            backgroundColor: col.req.includes('Mandatory') ? '#FEE2E2' : '#F1F5F9',
                            color: col.req.includes('Mandatory') ? '#B91C1C' : '#475569',
                          }}
                        >
                          {col.req}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B' }}>{col.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  borderTop: '1px solid #E2E8F0',
                }}
              >
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Download size={16} />
                  <span>Download Excel Template (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="hhs-btn hhs-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>Proceed to Upload</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Upload & Headers */}
          {currentStep === 2 && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #CBD5E1',
                  borderRadius: '12px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#F8FAFC',
                  transition: 'border-color 0.2s',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(14, 116, 144, 0.1)',
                    color: 'var(--hhs-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <UploadCloud size={28} />
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>
                  {file ? file.name : 'Select or drag & drop student spreadsheet'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
                  Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) up to 25 MB
                </div>
              </div>

              {isParsing && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748B' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  <div>Verifying spreadsheet structure and validating column headers...</div>
                </div>
              )}

              {parseError && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '10px',
                    padding: '16px',
                    color: '#991B1B',
                    fontSize: '0.88rem',
                    marginBottom: '20px',
                    display: 'flex',
                    gap: '10px',
                  }}
                >
                  <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>Header Verification Error</strong>
                    {parseError}
                    {missingRequiredColumns.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '0.8rem' }}>
                        Missing: <strong>{missingRequiredColumns.join(', ')}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {rawHeaders.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>
                    Detected Columns ({rawHeaders.length}):
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {rawHeaders.map((h, i) => {
                      const isUnmapped = unexpectedColumns.includes(h);
                      return (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: isUnmapped ? '#FEF3C7' : '#DCFCE7',
                            color: isUnmapped ? '#92400E' : '#166534',
                            border: `1px solid ${isUnmapped ? '#FCD34D' : '#BBF7D0'}`,
                          }}
                        >
                          {h} {isUnmapped ? '(Unmapped)' : '✓'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  marginTop: '20px',
                  borderTop: '1px solid #E2E8F0',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="hhs-btn hhs-btn-secondary"
                >
                  Back to Template
                </button>
                <button
                  type="button"
                  disabled={!validationSummary || missingRequiredColumns.length > 0}
                  onClick={() => setCurrentStep(3)}
                  className="hhs-btn hhs-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>Review Data Validation</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Data Validation Preview */}
          {currentStep === 3 && validationSummary && (
            <div>
              {/* Metrics cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '10px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#F8FAFC' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>TOTAL ROWS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A' }}>{validationSummary.totalRows}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #BBF7D0', borderRadius: '10px', backgroundColor: '#F0FDF4' }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>NEW STUDENTS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16A34A' }}>{validationSummary.newRows}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #BFDBFE', borderRadius: '10px', backgroundColor: '#EFF6FF' }}>
                  <div style={{ fontSize: '0.72rem', color: '#1E40AF', fontWeight: 600 }}>UPDATES FOUND</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563EB' }}>{validationSummary.updateRows}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#F8FAFC' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>UNCHANGED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#64748B' }}>{validationSummary.unchangedRows}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #FECACA', borderRadius: '10px', backgroundColor: '#FEF2F2' }}>
                  <div style={{ fontSize: '0.72rem', color: '#991B1B', fontWeight: 600 }}>ERRORS / DUPS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#DC2626' }}>
                    {validationSummary.invalidRows + validationSummary.duplicateRows}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('valid')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      border: 'none',
                      backgroundColor: activePreviewTab === 'valid' ? 'var(--hhs-primary)' : '#F1F5F9',
                      color: activePreviewTab === 'valid' ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Valid Records ({validationSummary.validRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('errors')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      border: 'none',
                      backgroundColor: activePreviewTab === 'errors' ? '#DC2626' : '#F1F5F9',
                      color: activePreviewTab === 'errors' ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Errors & Warnings ({validationSummary.invalidRows + validationSummary.duplicateRows})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadValidationReport}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '6px 10px' }}
                >
                  <Download size={14} />
                  <span>Download Report</span>
                </button>
              </div>

              {/* Tab 1: Valid Records Table */}
              {activePreviewTab === 'valid' && (
                <div
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    maxHeight: '300px',
                    overflowY: 'auto',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '8px 12px' }}>Row</th>
                        <th style={{ padding: '8px 12px' }}>Admission #</th>
                        <th style={{ padding: '8px 12px' }}>Student Name</th>
                        <th style={{ padding: '8px 12px' }}>Class</th>
                        <th style={{ padding: '8px 12px' }}>Mobile</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationSummary.records
                        .filter(r => r.status === 'new' || r.status === 'update' || r.status === 'unchanged')
                        .slice(0, 100)
                        .map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748B' }}>{r.rowIndex}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.admissionNumber}</td>
                            <td style={{ padding: '8px 12px' }}>{r.fullName}</td>
                            <td style={{ padding: '8px 12px' }}>{r.classLabel}</td>
                            <td style={{ padding: '8px 12px' }}>{r.mobile}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  backgroundColor:
                                    r.status === 'new'
                                      ? '#DCFCE7'
                                      : r.status === 'update'
                                      ? '#DBEAFE'
                                      : '#F1F5F9',
                                  color:
                                    r.status === 'new'
                                      ? '#166534'
                                      : r.status === 'update'
                                      ? '#1E40AF'
                                      : '#475569',
                                }}
                              >
                                {r.status === 'new' ? 'NEW' : r.status === 'update' ? 'UPDATE' : 'UNCHANGED'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Errors Table */}
              {activePreviewTab === 'errors' && (
                <div
                  style={{
                    border: '1px solid #FECACA',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    maxHeight: '300px',
                    overflowY: 'auto',
                  }}
                >
                  {validationSummary.records.filter(r => r.validationErrors.length > 0 || r.validationWarnings.length > 0).length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#16A34A' }}>
                      <CheckCircle2 size={32} style={{ margin: '0 auto 8px auto' }} />
                      <div>Zero errors detected! All spreadsheet records are compliant.</div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead style={{ backgroundColor: '#FEF2F2', position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ borderBottom: '1px solid #FECACA', color: '#991B1B' }}>
                          <th style={{ padding: '8px 12px' }}>Row</th>
                          <th style={{ padding: '8px 12px' }}>Admission #</th>
                          <th style={{ padding: '8px 12px' }}>Student Name</th>
                          <th style={{ padding: '8px 12px' }}>Validation Issues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationSummary.records
                          .filter(r => r.validationErrors.length > 0 || r.validationWarnings.length > 0)
                          .map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #FEE2E2', backgroundColor: '#FFF5F5' }}>
                              <td style={{ padding: '8px 12px', color: '#991B1B', fontWeight: 600 }}>{r.rowIndex}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.admissionNumber || '(Blank)'}</td>
                              <td style={{ padding: '8px 12px' }}>{r.fullName || '(Blank)'}</td>
                              <td style={{ padding: '8px 12px' }}>
                                {r.validationErrors.map((err, ei) => (
                                  <div key={ei} style={{ color: '#DC2626', fontWeight: 600, fontSize: '0.74rem' }}>
                                    • {err}
                                  </div>
                                ))}
                                {r.validationWarnings.map((warn, wi) => (
                                  <div key={wi} style={{ color: '#D97706', fontSize: '0.72rem' }}>
                                    ⚠ {warn}
                                  </div>
                                ))}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  marginTop: '20px',
                  borderTop: '1px solid #E2E8F0',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="hhs-btn hhs-btn-secondary"
                >
                  Back to Upload
                </button>
                <button
                  type="button"
                  disabled={validationSummary.validRows === 0}
                  onClick={() => setCurrentStep(4)}
                  className="hhs-btn hhs-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>Select Import Mode & Confirm</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Mode & Confirm */}
          {currentStep === 4 && validationSummary && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                  Choose Ingestion Mode
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>
                  Decide how matching records should be handled when their Admission Number already exists in the database.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '16px',
                    border: `2px solid ${importMode === 'add_only' ? 'var(--hhs-primary)' : '#E2E8F0'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    backgroundColor: importMode === 'add_only' ? 'rgba(14, 116, 144, 0.04)' : '#FFFFFF',
                  }}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="add_only"
                    checked={importMode === 'add_only'}
                    onChange={() => setImportMode('add_only')}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>
                      Add New Records Only (Safe / Append-Only)
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                      Only creates brand new student records ({validationSummary.newRows}). Ignores existing records ({validationSummary.updateRows}) without altering their data.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '16px',
                    border: `2px solid ${importMode === 'update_or_add' ? 'var(--hhs-primary)' : '#E2E8F0'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    backgroundColor: importMode === 'update_or_add' ? 'rgba(14, 116, 144, 0.04)' : '#FFFFFF',
                  }}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="update_or_add"
                    checked={importMode === 'update_or_add'}
                    onChange={() => setImportMode('update_or_add')}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>
                      Update Existing & Add New (Upsert by Admission Number)
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                      Updates matching student records ({validationSummary.updateRows}) and creates new records ({validationSummary.newRows}). Never overwrites non-empty fields with blank cells.
                    </div>
                  </div>
                </label>
              </div>

              {/* Safety banner */}
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <ShieldCheck size={24} style={{ color: '#16A34A', flexShrink: 0 }} />
                <div style={{ fontSize: '0.82rem', color: '#166534', lineHeight: 1.4 }}>
                  <strong>Pre-Import Snapshot Safeguard:</strong> An automated database backup will be generated immediately prior to applying changes, enabling instant rollback if required.
                </div>
              </div>

              {executionError && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '10px',
                    padding: '14px',
                    color: '#DC2626',
                    fontSize: '0.85rem',
                    marginBottom: '20px',
                  }}
                >
                  {executionError}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  borderTop: '1px solid #E2E8F0',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={isExecuting}
                  className="hhs-btn hhs-btn-secondary"
                >
                  Back to Validation
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isExecuting}
                  className="hhs-btn hhs-btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#16A34A',
                    borderColor: '#16A34A',
                  }}
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Writing to Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirm & Import ({validationSummary.validRows} Records)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Summary Report */}
          {currentStep === 5 && executionResult && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#DCFCE7',
                    color: '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto',
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  Student Data Ingestion Complete
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                  Batch ID: <code>{executionResult.batchId}</code> • Snapshot ID: <code>{executionResult.snapshotId}</code>
                </div>
              </div>

              {/* Execution Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ padding: '14px', border: '1px solid #BBF7D0', borderRadius: '10px', backgroundColor: '#F0FDF4' }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>STUDENTS CREATED</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16A34A' }}>{executionResult.createdCount}</div>
                </div>
                <div style={{ padding: '14px', border: '1px solid #BFDBFE', borderRadius: '10px', backgroundColor: '#EFF6FF' }}>
                  <div style={{ fontSize: '0.72rem', color: '#1E40AF', fontWeight: 600 }}>STUDENTS UPDATED</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563EB' }}>{executionResult.updatedCount}</div>
                </div>
                <div style={{ padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#F8FAFC' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>SKIPPED / UNCHANGED</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#64748B' }}>{executionResult.skippedCount}</div>
                </div>
                <div style={{ padding: '14px', border: '1px solid #FECACA', borderRadius: '10px', backgroundColor: '#FEF2F2' }}>
                  <div style={{ fontSize: '0.72rem', color: '#991B1B', fontWeight: 600 }}>FAILED ROWS</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#DC2626' }}>{executionResult.failedCount}</div>
                </div>
              </div>

              {/* Row results sample */}
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  marginBottom: '20px',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#F8FAFC', position: 'sticky', top: 0 }}>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 12px' }}>Row</th>
                      <th style={{ padding: '8px 12px' }}>Admission #</th>
                      <th style={{ padding: '8px 12px' }}>Student Name</th>
                      <th style={{ padding: '8px 12px' }}>Action</th>
                      <th style={{ padding: '8px 12px' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executionResult.rowResults.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748B' }}>{r.rowIndex}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.admissionNumber}</td>
                        <td style={{ padding: '8px 12px' }}>{r.fullName}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              backgroundColor:
                                r.action === 'CREATED'
                                  ? '#DCFCE7'
                                  : r.action === 'UPDATED'
                                  ? '#DBEAFE'
                                  : r.action === 'SKIPPED'
                                  ? '#F1F5F9'
                                  : '#FEE2E2',
                              color:
                                r.action === 'CREATED'
                                  ? '#166534'
                                  : r.action === 'UPDATED'
                                  ? '#1E40AF'
                                  : r.action === 'SKIPPED'
                                  ? '#475569'
                                  : '#DC2626',
                            }}
                          >
                            {r.action}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#64748B' }}>{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  borderTop: '1px solid #E2E8F0',
                }}
              >
                <button
                  type="button"
                  onClick={handleDownloadExecutionReport}
                  className="hhs-btn hhs-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={15} />
                  <span>Download Summary Report (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="hhs-btn hhs-btn-primary"
                >
                  Done (Refresh Students)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
