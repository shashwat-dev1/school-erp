import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Files,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Search,
  Download,
  Send,
  Link2,
  X,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  DOCUMENT_SLOT_DEFINITIONS,
  ORDERED_DOCUMENT_TYPES,
  validateDocumentFile,
} from '../../domain/policy';
import {
  ParentDocumentService,
} from '../../services/documents/parentDocumentService';
import type {
  StudentRecord,
  ClassSection,
  StudentDocumentType,
  StudentDocumentRecord,
  ParentDocumentInvitation,
} from '../../domain/types';

export const DocumentsDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { provider } = useData();

  // Primary Data
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [allDocs, setAllDocs] = useState<Record<string, StudentDocumentRecord[]>>({});
  const [invitations, setInvitations] = useState<ParentDocumentInvitation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedDocType, setSelectedDocType] = useState<string>('all');
  const [selectedDocStatus, setSelectedDocStatus] = useState<string>('all'); // all, complete, pending, empty
  const [selectedRequestStatus, setSelectedRequestStatus] = useState<string>('all'); // all, none, active, used, expired, revoked

  // Multi-Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Alerts
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Modals
  const [showGenerateLinksModal, setShowGenerateLinksModal] = useState<boolean>(false);
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState<boolean>(false);
  const [showStaffUploadModal, setShowStaffUploadModal] = useState<boolean>(false);
  const [showInvitationManagementModal, setShowInvitationManagementModal] = useState<boolean>(false);
  const [preSelectedStudentForStaffUpload, setPreSelectedStudentForStaffUpload] = useState<StudentRecord | null>(null);

  // Load all initial data
  const loadDashboardData = async () => {
    setIsLoading(true);
    setGlobalError(null);
    try {
      const [stuRes, clsRes, docsMap] = await Promise.all([
        provider.getStudents({ limit: 5000 }),
        provider.getClasses(),
        provider.getAllStudentDocuments ? provider.getAllStudentDocuments() : Promise.resolve({}),
      ]);

      const stuList = stuRes?.items || (stuRes as any)?.data || [];
      setStudents(stuList);
      setClasses(clsRes || []);
      setAllDocs(docsMap || {});

      // Invitations
      const localInvs = ParentDocumentService.getLocalInvitations();
      setInvitations(localInvs);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load document dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Compute Active Invitation map by studentId
  const studentInvitationMap = useMemo(() => {
    const map = new Map<string, ParentDocumentInvitation>();
    // Sort so most recent is chosen
    const sorted = [...invitations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const inv of sorted) {
      if (!map.has(inv.studentId)) {
        map.set(inv.studentId, inv);
      }
    }
    return map;
  }, [invitations]);

  // Student document completeness map
  const studentCompletenessMap = useMemo(() => {
    const map = new Map<string, {
      totalRequired: number;
      submittedCount: number;
      pendingCount: number;
      missingSlots: StudentDocumentType[];
      status: 'complete' | 'pending' | 'empty';
    }>();

    for (const stu of students) {
      const docs = allDocs[stu.id] || [];
      const presentSlots = new Set(
        docs.filter(d => d.isPresent !== false && d.reviewStatus !== 'rejected').map(d => d.documentType)
      );

      const missingSlots: StudentDocumentType[] = [];
      for (const slot of ORDERED_DOCUMENT_TYPES) {
        if (!presentSlots.has(slot)) {
          missingSlots.push(slot);
        }
      }

      const submittedCount = presentSlots.size;
      const pendingCount = missingSlots.length;
      let status: 'complete' | 'pending' | 'empty' = 'pending';
      if (submittedCount === 0) status = 'empty';
      else if (pendingCount === 0) status = 'complete';

      map.set(stu.id, {
        totalRequired: ORDERED_DOCUMENT_TYPES.length,
        submittedCount,
        pendingCount,
        missingSlots,
        status,
      });
    }

    return map;
  }, [students, allDocs]);

  // Overview Statistics KPI
  const stats = useMemo(() => {
    const totalStudents = students.length;
    let allRequiredOnFile = 0;
    let pendingDocuments = 0;
    let noDocuments = 0;

    for (const stu of students) {
      const c = studentCompletenessMap.get(stu.id);
      if (c?.status === 'complete') allRequiredOnFile++;
      else if (c?.status === 'empty') noDocuments++;
      else pendingDocuments++;
    }

    const incomplete = pendingDocuments + noDocuments;
    const requestsGenerated = invitations.length;
    const requestsSent = invitations.filter(i => Boolean(i.whatsappMessageId)).length;

    // Document review counts
    let awaitingReview = 0;
    let rejectedDocs = 0;
    for (const docs of Object.values(allDocs)) {
      for (const d of docs) {
        if (d.reviewStatus === 'pending') awaitingReview++;
        else if (d.reviewStatus === 'rejected') rejectedDocs++;
      }
    }

    return {
      totalStudents,
      allRequiredOnFile,
      pendingDocuments,
      noDocuments,
      incomplete,
      requestsGenerated,
      requestsSent,
      awaitingReview,
      rejectedDocs,
    };
  }, [students, studentCompletenessMap, invitations, allDocs]);

  // Slot-by-slot completeness calculations
  const slotCompleteness = useMemo(() => {
    return ORDERED_DOCUMENT_TYPES.map(slotType => {
      const def = DOCUMENT_SLOT_DEFINITIONS[slotType];
      let submittedCount = 0;
      let approvedCount = 0;
      let pendingReviewCount = 0;

      for (const stu of students) {
        const docs = allDocs[stu.id] || [];
        const record = docs.find(d => d.documentType === slotType && d.isPresent !== false);
        if (record) {
          submittedCount++;
          if (record.reviewStatus === 'accepted' || (!record.reviewStatus && record.isPresent)) {
            approvedCount++;
          } else if (record.reviewStatus === 'pending') {
            pendingReviewCount++;
          }
        }
      }

      const totalRequired = students.length;
      const missingCount = Math.max(0, totalRequired - submittedCount);
      const percentage = totalRequired > 0 ? Math.round((submittedCount / totalRequired) * 100) : 0;

      return {
        slotType,
        title: def.title,
        categoryLabel: def.categoryLabel,
        required: def.required,
        maxSizeDescription: def.fileTypeDescription,
        submittedCount,
        approvedCount,
        pendingReviewCount,
        missingCount,
        totalRequired,
        percentage,
      };
    });
  }, [students, allDocs]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (student.fullName || '').toLowerCase().includes(q);
        const admMatch = (student.admissionNumber || '').toLowerCase().includes(q);
        const rollMatch = String(student.rollNumber || '').includes(q);
        const phoneMatch = (student.primaryPhone || '').includes(q);
        if (!nameMatch && !admMatch && !rollMatch && !phoneMatch) return false;
      }

      // 2. Class filter
      if (selectedClassId !== 'all' && student.classId !== selectedClassId) {
        return false;
      }

      // 3. Document Completeness Status filter
      const comp = studentCompletenessMap.get(student.id);
      if (selectedDocStatus !== 'all') {
        if (selectedDocStatus === 'complete' && comp?.status !== 'complete') return false;
        if (selectedDocStatus === 'pending' && comp?.status !== 'pending') return false;
        if (selectedDocStatus === 'empty' && comp?.status !== 'empty') return false;
      }

      // 4. Document Type filter (Missing this specific slot)
      if (selectedDocType !== 'all') {
        const hasSlot = !(comp?.missingSlots.includes(selectedDocType as StudentDocumentType));
        if (!hasSlot) {
          // If filtering by specific slot, check if this student has it missing
          // Keep student
        }
      }

      // 5. Parent Request Status filter
      const inv = studentInvitationMap.get(student.id);
      if (selectedRequestStatus !== 'all') {
        if (selectedRequestStatus === 'none' && inv) return false;
        if (selectedRequestStatus === 'active' && (!inv || inv.status !== 'active')) return false;
        if (selectedRequestStatus === 'used' && (!inv || inv.status !== 'used')) return false;
        if (selectedRequestStatus === 'expired' && (!inv || inv.status !== 'expired')) return false;
        if (selectedRequestStatus === 'revoked' && (!inv || inv.status !== 'revoked')) return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedClassId, selectedDocStatus, selectedDocType, selectedRequestStatus, studentCompletenessMap, studentInvitationMap]);

  // Multi-Selection Handlers
  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
  };

  const handleSelectEntireClass = (classId: string) => {
    const classStudentIds = students.filter(s => s.classId === classId).map(s => s.id);
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      classStudentIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  // Export filtered status report to Excel
  const handleExportFilteredReport = () => {
    const rows = filteredStudents.map(student => {
      const comp = studentCompletenessMap.get(student.id);
      const inv = studentInvitationMap.get(student.id);
      return {
        'Admission Number': student.admissionNumber,
        'Student Name': student.fullName,
        'Class': student.classLabel,
        'Section': (student as any).section || '',
        'Roll Number': student.rollNumber || '',
        'Parent Phone': student.primaryPhone || '',
        'Submitted Slots': comp ? `${comp.submittedCount} / 9` : '0 / 9',
        'Missing Slots Count': comp?.pendingCount || 9,
        'Missing Slot Names': comp ? comp.missingSlots.map(s => DOCUMENT_SLOT_DEFINITIONS[s]?.title || s).join(', ') : 'All Required Slots',
        'Overall Status': comp ? comp.status.toUpperCase() : 'EMPTY',
        'Parent Invitation Status': inv ? inv.status.toUpperCase() : 'NOT REQUESTED',
        'Invitation Created At': inv ? inv.createdAt.split('T')[0] : '—',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student Document Status');
    XLSX.writeFile(wb, `HanuJai_Student_Document_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div style={{ padding: '24px 32px', backgroundColor: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#0A1931', color: '#FFFFFF', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Files size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0A1931', margin: 0 }}>
                Centralized Student Document Management
              </h1>
              <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                HanuJai High School, Jaipur • Client Vercel Private Blob Store (BOM1 Mumbai)
              </div>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowInvitationManagementModal(true)}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '9px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Link2 size={15} color="#2563EB" />
            <span>Manage Invitations ({invitations.length})</span>
          </button>

          <button
            onClick={() => {
              setPreSelectedStudentForStaffUpload(null);
              setShowStaffUploadModal(true);
            }}
            style={{
              backgroundColor: '#0A1931',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(10,25,49,0.15)',
            }}
          >
            <UploadCloud size={16} />
            <span>Upload Document (Staff)</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 600 }}>
          <RefreshCw size={16} className="spin" />
          <span>Synchronizing student records and private storage manifests...</span>
        </div>
      )}

      {/* Global Alerts */}
      {globalSuccess && (
        <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>{globalSuccess}</span>
          </div>
          <button onClick={() => setGlobalSuccess(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {globalError && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            <AlertCircle size={18} color="#DC2626" />
            <span>{globalError}</span>
          </div>
          <button onClick={() => setGlobalError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 1: OVERVIEW METRIC KPI CARDS */}
      {/* ==================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ color: '#64748B', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Students</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0A1931', marginTop: '4px' }}>{stats.totalStudents}</div>
          <div style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '2px' }}>Registered Master Roster</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ color: '#059669', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>All Required On File</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{stats.allRequiredOnFile}</div>
          <div style={{ fontSize: '0.70rem', color: '#059669', marginTop: '2px' }}>
            {stats.totalStudents > 0 ? Math.round((stats.allRequiredOnFile / stats.totalStudents) * 100) : 0}% 100% Compliant
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ color: '#D97706', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Pending Documents</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>{stats.pendingDocuments}</div>
          <div style={{ fontSize: '0.70rem', color: '#D97706', marginTop: '2px' }}>1 to 8 Slots On File</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ color: '#DC2626', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>No Documents</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>{stats.noDocuments}</div>
          <div style={{ fontSize: '0.70rem', color: '#DC2626', marginTop: '2px' }}>Zero Slots Uploaded</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ color: '#2563EB', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Parent Links Created</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>{stats.requestsGenerated}</div>
          <div style={{ fontSize: '0.70rem', color: '#2563EB', marginTop: '2px' }}>{stats.requestsSent} Sent on WhatsApp</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ color: '#7C3AED', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Awaiting Review</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>{stats.awaitingReview}</div>
          <div style={{ fontSize: '0.70rem', color: '#7C3AED', marginTop: '2px' }}>{stats.rejectedDocs} Rejected Slots</div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 2: 9-SLOT COMPLETENESS BREAKDOWN TABLE */}
      {/* ==================================================================== */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0A1931', margin: 0 }}>
              Official 9-Slot Document Completeness Breakdown
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Institutional slots configured for HanuJai High School admission compliance.
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: '6px' }}>
            9 Statutory Slots
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '8px 12px' }}>Document Slot</th>
                <th style={{ padding: '8px 12px' }}>Category</th>
                <th style={{ padding: '8px 12px' }}>Accepted</th>
                <th style={{ padding: '8px 12px' }}>Awaiting Review</th>
                <th style={{ padding: '8px 12px' }}>Missing</th>
                <th style={{ padding: '8px 12px' }}>Total On File</th>
                <th style={{ padding: '8px 12px', minWidth: '180px' }}>Completeness</th>
              </tr>
            </thead>
            <tbody>
              {slotCompleteness.map(slot => (
                <tr key={slot.slotType} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0A1931' }}>
                    {slot.title}
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 400 }}>{slot.maxSizeDescription}</div>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#64748B' }}>
                    {slot.categoryLabel}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#059669', fontWeight: 700 }}>
                    {slot.approvedCount}
                  </td>
                  <td style={{ padding: '8px 12px', color: slot.pendingReviewCount > 0 ? '#D97706' : '#94A3B8', fontWeight: 700 }}>
                    {slot.pendingReviewCount}
                  </td>
                  <td style={{ padding: '8px 12px', color: slot.missingCount > 0 ? '#DC2626' : '#94A3B8', fontWeight: 700 }}>
                    {slot.missingCount}
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>
                    {slot.submittedCount} / {slot.totalRequired}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${slot.percentage}%`,
                            height: '100%',
                            backgroundColor: slot.percentage >= 80 ? '#059669' : (slot.percentage >= 40 ? '#D97706' : '#DC2626'),
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>
                        {slot.percentage}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 3: STUDENT DOCUMENT STATUS LIST & MULTI-SELECTION */}
      {/* ==================================================================== */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px 24px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0A1931', margin: 0 }}>
              Student Document Status Directory ({filteredStudents.length} of {students.length})
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Select students in bulk to generate secure parent upload links or send WhatsApp reminders.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleExportFilteredReport}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#475569',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Download size={14} />
              <span>Export Roster (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Search student, adm no, phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                paddingLeft: '30px',
                paddingRight: '10px',
                fontSize: '0.78rem',
              }}
            />
          </div>

          {/* Class Filter */}
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.78rem', padding: '0 8px', backgroundColor: '#FFFFFF' }}
          >
            <option value="all">All Classes & Sections</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.label || cls.name || cls.id}</option>
            ))}
          </select>

          {/* Document Status Filter */}
          <select
            value={selectedDocStatus}
            onChange={e => setSelectedDocStatus(e.target.value)}
            style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.78rem', padding: '0 8px', backgroundColor: '#FFFFFF' }}
          >
            <option value="all">All Document Statuses</option>
            <option value="complete">Complete (9/9 Uploaded)</option>
            <option value="pending">Pending / Incomplete (1-8 Uploaded)</option>
            <option value="empty">No Documents (0 Uploaded)</option>
          </select>

          {/* Specific Missing Slot Filter */}
          <select
            value={selectedDocType}
            onChange={e => setSelectedDocType(e.target.value)}
            style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.78rem', padding: '0 8px', backgroundColor: '#FFFFFF' }}
          >
            <option value="all">Filter by Missing Slot: Any</option>
            {ORDERED_DOCUMENT_TYPES.map(slot => (
              <option key={slot} value={slot}>Missing: {DOCUMENT_SLOT_DEFINITIONS[slot]?.title}</option>
            ))}
          </select>

          {/* Request Status Filter */}
          <select
            value={selectedRequestStatus}
            onChange={e => setSelectedRequestStatus(e.target.value)}
            style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.78rem', padding: '0 8px', backgroundColor: '#FFFFFF' }}
          >
            <option value="all">All Request Statuses</option>
            <option value="none">Not Requested</option>
            <option value="active">Active Upload Link</option>
            <option value="used">Used / Submitted</option>
            <option value="expired">Expired Link</option>
            <option value="revoked">Revoked Link</option>
          </select>
        </div>

        {/* Quick Selection Helpers Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.72rem', color: '#64748B', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>Quick Selection:</span>
          <button
            onClick={handleSelectAllFiltered}
            style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
          >
            Select All Filtered ({filteredStudents.length})
          </button>
          {selectedClassId !== 'all' && (
            <button
              onClick={() => handleSelectEntireClass(selectedClassId)}
              style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
            >
              Select Entire Class
            </button>
          )}
          {selectedStudentIds.size > 0 && (
            <button
              onClick={handleClearSelection}
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
            >
              Clear Selection ({selectedStudentIds.size})
            </button>
          )}
        </div>

        {/* Students Table */}
        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '8px 10px', width: '36px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.has(s.id))}
                    onChange={() => {
                      const allSelected = filteredStudents.every(s => selectedStudentIds.has(s.id));
                      if (allSelected) {
                        setSelectedStudentIds(prev => {
                          const next = new Set(prev);
                          filteredStudents.forEach(s => next.delete(s.id));
                          return next;
                        });
                      } else {
                        handleSelectAllFiltered();
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '8px 12px' }}>Student Name</th>
                <th style={{ padding: '8px 12px' }}>Admission No.</th>
                <th style={{ padding: '8px 12px' }}>Class</th>
                <th style={{ padding: '8px 12px' }}>Parent Mobile</th>
                <th style={{ padding: '8px 12px' }}>Completeness</th>
                <th style={{ padding: '8px 12px', minWidth: '180px' }}>Pending Required Documents</th>
                <th style={{ padding: '8px 12px' }}>Upload Link Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8' }}>
                    No students match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const comp = studentCompletenessMap.get(student.id);
                  const inv = studentInvitationMap.get(student.id);
                  const isSelected = selectedStudentIds.has(student.id);

                  let statusBadge = (
                    <span style={{ backgroundColor: '#ECFDF5', color: '#059669', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '0.68rem' }}>
                      COMPLETE (9/9)
                    </span>
                  );
                  if (comp?.status === 'empty') {
                    statusBadge = (
                      <span style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '0.68rem' }}>
                        EMPTY (0/9)
                      </span>
                    );
                  } else if (comp?.status === 'pending') {
                    statusBadge = (
                      <span style={{ backgroundColor: '#FFFBEB', color: '#D97706', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '0.68rem' }}>
                        PENDING ({comp.submittedCount}/9)
                      </span>
                    );
                  }

                  let requestBadge = (
                    <span style={{ backgroundColor: '#F1F5F9', color: '#64748B', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600 }}>
                      Not Requested
                    </span>
                  );
                  if (inv) {
                    if (inv.status === 'active') {
                      requestBadge = (
                        <span style={{ backgroundColor: '#ECFDF5', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                          Active Link
                        </span>
                      );
                    } else if (inv.status === 'used') {
                      requestBadge = (
                        <span style={{ backgroundColor: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                          Used
                        </span>
                      );
                    } else if (inv.status === 'revoked') {
                      requestBadge = (
                        <span style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                          Revoked
                        </span>
                      );
                    } else if (inv.status === 'expired') {
                      requestBadge = (
                        <span style={{ backgroundColor: '#FFFBEB', color: '#D97706', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                          Expired
                        </span>
                      );
                    }
                  }

                  return (
                    <tr
                      key={student.id}
                      style={{
                        backgroundColor: isSelected ? '#F0F9FF' : '#FFFFFF',
                        borderBottom: '1px solid #F1F5F9',
                      }}
                    >
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(student.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Link
                          to={`/students/${student.id}`}
                          style={{ fontWeight: 700, color: '#0A1931', textDecoration: 'none' }}
                        >
                          {student.fullName}
                        </Link>
                        <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Roll #{student.rollNumber || '-'}</div>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                        {student.admissionNumber}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>
                        {student.classLabel}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#64748B' }}>
                        {student.primaryPhone || '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {statusBadge}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {comp && comp.missingSlots.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {comp.missingSlots.slice(0, 3).map(slot => (
                              <span
                                key={slot}
                                style={{
                                  backgroundColor: '#F1F5F9',
                                  color: '#475569',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  fontSize: '0.65rem',
                                  fontWeight: 500,
                                }}
                              >
                                {DOCUMENT_SLOT_DEFINITIONS[slot]?.title.replace('Student ', '').replace("Father's ", 'Father ').replace("Mother's ", 'Mother ')}
                              </span>
                            ))}
                            {comp.missingSlots.length > 3 && (
                              <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 600 }}>
                                +{comp.missingSlots.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#059669', fontSize: '0.70rem', fontWeight: 600 }}>All 9 slots verified</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {requestBadge}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => {
                              setPreSelectedStudentForStaffUpload(student);
                              setShowStaffUploadModal(true);
                            }}
                            title="Upload document as staff"
                            style={{
                              backgroundColor: '#F1F5F9',
                              color: '#0A1931',
                              border: '1px solid #CBD5E1',
                              borderRadius: '4px',
                              padding: '3px 7px',
                              fontSize: '0.70rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Upload
                          </button>
                          <Link
                            to={`/students/${student.id}`}
                            title="Open Dossier"
                            style={{
                              backgroundColor: '#F8FAFC',
                              color: '#3B82F6',
                              border: '1px solid #CBD5E1',
                              borderRadius: '4px',
                              padding: '3px 7px',
                              fontSize: '0.70rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            Dossier
                          </Link>
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

      {/* ==================================================================== */}
      {/* FLOATING STICKY ACTION BAR (When Students Selected) */}
      {/* ==================================================================== */}
      {selectedStudentIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#0A1931',
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '50px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
            <CheckCircle2 size={18} color="#10B981" />
            <span>{selectedStudentIds.size} Students Selected</span>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.2)' }} />

          {/* Action 1: Generate Links & Download 7-Column Excel */}
          <button
            onClick={() => setShowGenerateLinksModal(true)}
            style={{
              backgroundColor: '#F5A623',
              color: '#0A1931',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.80rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Link2 size={14} />
            <span>Generate Links & Excel</span>
          </button>

          {/* Action 2: Send WhatsApp Reminders */}
          <button
            onClick={() => setShowBulkWhatsAppModal(true)}
            style={{
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.80rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Send size={14} />
            <span>Send WhatsApp Reminders</span>
          </button>

          {/* Clear button */}
          <button
            onClick={handleClearSelection}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: GENERATE LINKS & 7-COLUMN CONFIDENTIAL EXCEL */}
      {/* ==================================================================== */}
      {showGenerateLinksModal && currentUser && (
        <GenerateLinksModal
          isOpen={showGenerateLinksModal}
          onClose={() => setShowGenerateLinksModal(false)}
          selectedStudents={students.filter(s => selectedStudentIds.has(s.id))}
          currentUser={currentUser}
          onSuccess={() => {
            loadDashboardData();
            handleClearSelection();
            setGlobalSuccess('Generated student-bound upload links and downloaded confidential 7-column Excel!');
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: BULK WHATSAPP REMINDER DISPATCH */}
      {/* ==================================================================== */}
      {showBulkWhatsAppModal && currentUser && (
        <BulkWhatsAppReminderModal
          isOpen={showBulkWhatsAppModal}
          onClose={() => setShowBulkWhatsAppModal(false)}
          selectedStudents={students.filter(s => selectedStudentIds.has(s.id))}
          currentUser={currentUser}
          onSuccess={() => {
            loadDashboardData();
            handleClearSelection();
            setGlobalSuccess('Successfully dispatched parent document reminder messages on WhatsApp!');
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: SIMPLIFIED STAFF DOCUMENT UPLOAD (Part 7) */}
      {/* ==================================================================== */}
      {showStaffUploadModal && currentUser && (
        <StaffDocumentUploadModal
          isOpen={showStaffUploadModal}
          onClose={() => {
            setShowStaffUploadModal(false);
            setPreSelectedStudentForStaffUpload(null);
          }}
          students={students}
          preSelectedStudent={preSelectedStudentForStaffUpload}
          currentUser={currentUser}
          onSuccess={() => {
            loadDashboardData();
            setGlobalSuccess('Successfully uploaded and verified student document in private cloud storage!');
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: INVITATION MANAGEMENT MODAL */}
      {/* ==================================================================== */}
      {showInvitationManagementModal && currentUser && (
        <InvitationManagementModal
          isOpen={showInvitationManagementModal}
          onClose={() => setShowInvitationManagementModal(false)}
          invitations={invitations}
          currentUser={currentUser}
          onRefresh={() => loadDashboardData()}
        />
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: GenerateLinksModal (7-Column Confidential Excel)
// ============================================================================
interface GenerateLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: StudentRecord[];
  currentUser: any;
  onSuccess: () => void;
}

const GenerateLinksModal: React.FC<GenerateLinksModalProps> = ({
  isOpen,
  onClose,
  selectedStudents,
  currentUser,
  onSuccess,
}) => {
  const [selectedSlots, setSelectedSlots] = useState<StudentDocumentType[]>([...ORDERED_DOCUMENT_TYPES]);
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  if (!isOpen) return null;

  const handleGenerateAndExport = async () => {
    setIsGenerating(true);
    setProgressPercent(10);

    try {
      const exportRows: Array<{
        studentName: string;
        admissionNumber: string;
        classLabel: string;
        section: string;
        guardianPhone: string;
        pendingDocuments: string;
        uploadUrl: string;
      }> = [];

      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        const { invitation, uploadUrl } = await ParentDocumentService.createInvitation(
          student,
          selectedSlots,
          currentUser,
          expiryDays
        );

        const slotTitles = invitation.requestedSlots
          .map(s => DOCUMENT_SLOT_DEFINITIONS[s]?.title || s)
          .join(', ');

        exportRows.push({
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          classLabel: student.classLabel,
          section: (student as any).section || '',
          guardianPhone: student.primaryPhone || '',
          pendingDocuments: slotTitles,
          uploadUrl,
        });

        setProgressPercent(Math.round(((i + 1) / selectedStudents.length) * 90));
      }

      // Download the 7-column Excel workbook
      ParentDocumentService.exportParentLinksExcel(exportRows);
      setProgressPercent(100);
      onSuccess();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate invitation links.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', width: '90%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 size={20} color="#0A1931" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A1931' }}>
              Generate Parent Upload Links
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <p style={{ fontSize: '0.84rem', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          Generates individual, 256-bit cryptographically secure upload links for <strong>{selectedStudents.length} students</strong> and automatically downloads the confidential <strong>7-column Excel workbook</strong>.
        </p>

        <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
            Excel Workbook Format (Strict 7 Columns)
          </div>
          <div style={{ fontSize: '0.72rem', color: '#334155', lineHeight: 1.6 }}>
            1. Student Name • 2. Admission Number • 3. Class • 4. Section<br />
            5. Parent/Guardian Mobile Number • 6. List of Pending Documents • 7. Secure Document Upload Link
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
              Requested Document Slots ({selectedSlots.length} Selected)
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setSelectedSlots([...ORDERED_DOCUMENT_TYPES])}
                style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                All 9 Slots
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlots(['student_photo', 'student_aadhaar_front', 'birth_certificate'])}
                style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                Core 3 Slots
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
            Link Validity Period
          </label>
          <select
            value={expiryDays}
            onChange={e => setExpiryDays(Number(e.target.value))}
            style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '0.82rem' }}
          >
            <option value={7}>7 Days (Recommended)</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
        </div>

        {isGenerating && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B', marginBottom: '4px' }}>
              <span>Generating cryptographically secure links...</span>
              <span>{progressPercent}%</span>
            </div>
            <div style={{ height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#0A1931', transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} disabled={isGenerating} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            Cancel
          </button>
          <button
            onClick={handleGenerateAndExport}
            disabled={isGenerating}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: '#0A1931',
              color: '#FFFFFF',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={14} />
            <span>{isGenerating ? 'Processing...' : 'Generate & Download Excel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: BulkWhatsAppReminderModal
// ============================================================================
interface BulkWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: StudentRecord[];
  currentUser: any;
  onSuccess: () => void;
}

const BulkWhatsAppReminderModal: React.FC<BulkWhatsAppModalProps> = ({
  isOpen,
  onClose,
  selectedStudents,
  currentUser,
  onSuccess,
}) => {
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sentCount, setSentCount] = useState<number>(0);

  if (!isOpen) return null;

  const handleSendReminders = async () => {
    setIsSending(true);
    let count = 0;
    try {
      for (const student of selectedStudents) {
        if (!student.primaryPhone) continue;
        const { invitation, uploadUrl } = await ParentDocumentService.createInvitation(
          student,
          ORDERED_DOCUMENT_TYPES,
          currentUser
        );
        await ParentDocumentService.sendInvitationWhatsApp(invitation, uploadUrl);
        count++;
        setSentCount(count);
        await new Promise(r => setTimeout(r, 60));
      }
      onSuccess();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send WhatsApp messages.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', width: '90%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={20} color="#10B981" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A1931' }}>
              Dispatch WhatsApp Reminders
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <p style={{ fontSize: '0.84rem', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          You are about to queue document collection reminder messages for <strong>{selectedStudents.length} parents</strong>.
        </p>

        {/* Message preview card */}
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '14px', marginBottom: '16px', fontSize: '0.78rem', color: '#166534', lineHeight: 1.5 }}>
          <strong>Bilingual Message Template:</strong><br />
          "Dear Parent/Guardian of [Student Name] ([Class]), HanuJai High School requests you to securely upload the following required documents... Please tap the secure link below: [Secure Link]. Note: No login or password required."
        </div>

        <div style={{ fontSize: '0.76rem', color: '#64748B', marginBottom: '20px' }}>
          • Sibling Separation: Siblings with the same parent phone receive strictly separate individual messages.<br />
          • Direct Upload: Parents tap the link and upload directly without OTP or login.
        </div>

        {isSending && (
          <div style={{ marginBottom: '16px', textAlign: 'center', color: '#059669', fontSize: '0.80rem', fontWeight: 700 }}>
            Dispatching... ({sentCount} of {selectedStudents.length})
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} disabled={isSending} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            Cancel
          </button>
          <button
            onClick={handleSendReminders}
            disabled={isSending}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: '#10B981',
              color: '#FFFFFF',
              cursor: isSending ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            {isSending ? 'Sending...' : 'Confirm & Send Reminders'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: StaffDocumentUploadModal (Simplified 4-Step Upload)
// ============================================================================
interface StaffUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentRecord[];
  preSelectedStudent: StudentRecord | null;
  currentUser: any;
  onSuccess: () => void;
}

const StaffDocumentUploadModal: React.FC<StaffUploadModalProps> = ({
  isOpen,
  onClose,
  students,
  preSelectedStudent,
  currentUser,
  onSuccess,
}) => {
  const { provider } = useData();

  const [selectedStudentId, setSelectedStudentId] = useState<string>(preSelectedStudent?.id || '');
  const [selectedSlot, setSelectedSlot] = useState<StudentDocumentType>('student_photo');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    setFileError(null);
    const validation = validateDocumentFile(selectedSlot, {
      name: file.name,
      size: file.size,
      type: file.type,
    });
    if (!validation.valid) {
      setFileError(validation.error || 'Invalid file format or size.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedStudentId || !selectedFile) {
      alert('Please select both a student and a file.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      await provider.uploadStudentDocument(
        selectedStudentId,
        selectedSlot,
        selectedFile,
        {
          originalFileName: selectedFile.name,
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
          notes: 'Direct upload by staff member via Document Dashboard',
        },
        currentUser,
        percent => setUploadProgress(percent)
      );

      // Auto-approve staff uploads
      await provider.reviewStudentDocument(
        selectedStudentId,
        selectedSlot,
        'accept',
        currentUser
      );

      setUploadProgress(100);
      onSuccess();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Document upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', width: '90%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud size={20} color="#0A1931" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A1931' }}>
              Staff Document Upload
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Step 1: Select Student */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
            Step 1: Select Student *
          </label>
          <select
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '0.82rem' }}
          >
            <option value="" disabled>Choose a student...</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.classLabel} • Adm #{s.admissionNumber})
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Select Document Slot */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
            Step 2: Select Document Slot *
          </label>
          <select
            value={selectedSlot}
            onChange={e => {
              setSelectedSlot(e.target.value as StudentDocumentType);
              setSelectedFile(null);
            }}
            style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '0.82rem' }}
          >
            {ORDERED_DOCUMENT_TYPES.map(slot => (
              <option key={slot} value={slot}>
                {DOCUMENT_SLOT_DEFINITIONS[slot]?.title}
              </option>
            ))}
          </select>
          <div style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '4px' }}>
            {DOCUMENT_SLOT_DEFINITIONS[selectedSlot]?.fileTypeDescription}
          </div>
        </div>

        {/* Step 3: Select File */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
            Step 3: Select File *
          </label>
          <input
            type="file"
            accept={DOCUMENT_SLOT_DEFINITIONS[selectedSlot]?.acceptedMimeTypes.join(',')}
            onChange={e => {
              if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
            }}
            style={{ fontSize: '0.80rem' }}
          />
          {fileError && (
            <div style={{ color: '#DC2626', fontSize: '0.74rem', marginTop: '4px' }}>
              {fileError}
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748B', marginBottom: '4px' }}>
              <span>Uploading to Mumbai Private Blob Store...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={{ height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: '#059669', transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {/* Step 4: Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} disabled={isUploading} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading || !selectedFile || !selectedStudentId}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: '#0A1931',
              color: '#FFFFFF',
              cursor: isUploading || !selectedFile || !selectedStudentId ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            {isUploading ? 'Uploading...' : 'Confirm Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: InvitationManagementModal
// ============================================================================
interface InvitationManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  invitations: ParentDocumentInvitation[];
  currentUser: any;
  onRefresh: () => void;
}

const InvitationManagementModal: React.FC<InvitationManagementModalProps> = ({
  isOpen,
  onClose,
  invitations,
  currentUser,
  onRefresh,
}) => {
  const [search, setSearch] = useState<string>('');

  if (!isOpen) return null;

  const filtered = invitations.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (inv.studentName || '').toLowerCase().includes(q) ||
      (inv.admissionNumber || '').toLowerCase().includes(q) ||
      (inv.guardianPhone || '').includes(q)
    );
  });

  const handleRevoke = async (inv: ParentDocumentInvitation) => {
    const confirm = window.confirm(`Revoke upload link for ${inv.studentName}? Parents will no longer be able to use it.`);
    if (!confirm) return;
    try {
      await ParentDocumentService.revokeInvitation(inv.tokenHash, currentUser);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke invitation.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', width: '92%', maxWidth: '780px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 size={20} color="#0A1931" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A1931' }}>
              Parent Document Invitations Lifecycle
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <input
            type="text"
            placeholder="Search invitation by student name, admission no, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', height: '34px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '0.80rem' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '8px 12px' }}>Student</th>
                <th style={{ padding: '8px 12px' }}>Class</th>
                <th style={{ padding: '8px 12px' }}>Parent Mobile</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px' }}>Created</th>
                <th style={{ padding: '8px 12px' }}>Expires</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
                    No invitations found.
                  </td>
                </tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0A1931' }}>
                      {inv.studentName}
                      <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Adm #{inv.admissionNumber}</div>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{inv.classLabel}</td>
                    <td style={{ padding: '8px 12px', color: '#64748B' }}>{inv.guardianPhone}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          backgroundColor: inv.status === 'active' ? '#ECFDF5' : (inv.status === 'used' ? '#EFF6FF' : '#FEF2F2'),
                          color: inv.status === 'active' ? '#059669' : (inv.status === 'used' ? '#2563EB' : '#DC2626'),
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.68rem',
                        }}
                      >
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#64748B' }}>{inv.createdAt.split('T')[0]}</td>
                    <td style={{ padding: '8px 12px', color: '#64748B' }}>{inv.expiresAt.split('T')[0]}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      {inv.status === 'active' && (
                        <button
                          onClick={() => handleRevoke(inv)}
                          style={{
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            border: '1px solid #FECACA',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.70rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#0A1931', color: '#FFFFFF', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
