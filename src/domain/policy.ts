/**
 * HanuJai High School ERP — Central Institutional Policy & Configuration Layer
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Single source of truth for all configurable school rules, operational defaults,
 * and demonstration policies.
 * 
 * NOTE: Values marked as "DEMO_DEFAULT" are editable demonstration defaults 
 * for pilot evaluation and do not represent confirmed institutional board policy.
 */

import type { AttendancePolicy, StudentDocumentType, DocumentCategory, DocumentSlotDefinition, DocumentCompletenessSummary } from './types';

export const INSTITUTIONAL_CONFIG = {
  // Campus Identity (Configurable Demo Defaults)
  institutionName: 'HanuJai High School',
  institutionShortName: 'HanuJai',
  campusLocation: 'Sector 3, Vidyadhar Nagar, Jaipur, Rajasthan 302039',
  contactEmail: 'admin@hanujai.edu.in',
  contactPhone: '+91 141 2780198',
  foundedYear: 1998,
  
  // Demonstrative Board Affiliation (Configurable Demonstration Values)
  cbseAffiliationNumber: 'CBSE/AFF/1730198',
  cbseSchoolCode: '30198',
  affiliationStatus: 'Provisional Senior Secondary Affiliation (Demonstration Setting)',
  
  // Academic Session (Configurable)
  activeAcademicYearId: 'year-2025-2026',
  activeAcademicYearLabel: '2025–2026',
  
  // Planning Scale: 10 Grades, 2 Sections each = 20 Sections (50 students/section = 1,000 total)
  totalGrades: 10,
  sectionsPerGrade: ['A', 'B'] as const,
  nominalCapacityPerSection: 50,
  
  // Operational Attendance Policy (Configurable Demonstration Values)
  attendance: {
    dailyMarkingWindowStart: '07:45',
    dailyMarkingWindowEnd: '09:15',
    gracePeriodMinutes: 15,
    minimumAttendancePercentage: 75.0, // Statutory CBSE 75% attendance threshold
    dualCustodyCorrectionRequired: true, // Class Teacher requests -> Principal approves
    allowSelfApproval: false, // Rule SEC-201: Requester cannot counter-approve own request
  } satisfies AttendancePolicy & { allowSelfApproval: boolean },

  // Academic Grading Scale (CBSE 9-Point Continuous Evaluation Scale)
  gradingScale: [
    { grade: 'A1', minPercentage: 91, maxPercentage: 100, gradePoint: 10.0, description: 'Outstanding performance' },
    { grade: 'A2', minPercentage: 81, maxPercentage: 90.99, gradePoint: 9.0, description: 'Excellent scholastic achievement' },
    { grade: 'B1', minPercentage: 71, maxPercentage: 80.99, gradePoint: 8.0, description: 'Very Good' },
    { grade: 'B2', minPercentage: 61, maxPercentage: 70.99, gradePoint: 7.0, description: 'Good' },
    { grade: 'C1', minPercentage: 51, maxPercentage: 60.99, gradePoint: 6.0, description: 'Above Average' },
    { grade: 'C2', minPercentage: 41, maxPercentage: 50.99, gradePoint: 5.0, description: 'Average' },
    { grade: 'D',  minPercentage: 33, maxPercentage: 40.99, gradePoint: 4.0, description: 'Pass / Marginal' },
    { grade: 'E1', minPercentage: 21, maxPercentage: 32.99, gradePoint: 0.0, description: 'Essential Repeat / Remedial Required' },
    { grade: 'E2', minPercentage: 0,  maxPercentage: 20.99, gradePoint: 0.0, description: 'Critical Shortfall / Remedial Required' },
  ],

  // Passing Criteria
  passingPercentage: 33.0,

  // Transparent Rule-Based Care Indicators (Explainable Quantitative Risk Triggers)
  riskRules: {
    'ATT-01': {
      code: 'ATT-01',
      title: '3 Consecutive Absences',
      threshold: 3,
      description: 'Triggered when a student is absent on 3 consecutive operational school days without parental leave note.',
      recommendedAction: 'Immediate telephonic outreach to primary guardian by Class Tutor.',
    },
    'ATT-03': {
      code: 'ATT-03',
      title: 'Attendance Shortfall Below 75%',
      threshold: 75.0,
      description: 'Cumulative session attendance below statutory 75.0% minimum threshold.',
      recommendedAction: 'Schedule Parent-Teacher Conference (PTM) & formal shortfall notification.',
    },
  },
} as const;

/**
 * Calculates CBSE Grade and Grade Point from obtained and maximum marks.
 */
export function calculateGrade(marksObtained: number | null, maxMarks: number): { grade: string; gradePoint: number; percentage: number | null } {
  if (marksObtained === null || maxMarks <= 0) {
    return { grade: '—', gradePoint: 0, percentage: null };
  }
  const percentage = (marksObtained / maxMarks) * 100;
  for (const item of INSTITUTIONAL_CONFIG.gradingScale) {
    if (percentage >= item.minPercentage) {
      return { grade: item.grade, gradePoint: item.gradePoint, percentage: Math.round(percentage * 10) / 10 };
    }
  }
  return { grade: 'E2', gradePoint: 0, percentage: Math.round(percentage * 10) / 10 };
}

/**
 * Validates whether current time falls within the configured morning roll-call window.
 */
export function isAttendanceWindowActive(
  now: Date = new Date(),
  policy: AttendancePolicy = INSTITUTIONAL_CONFIG.attendance
): { isOpen: boolean; start: string; end: string } {
  const currentHours = now.getHours().toString().padStart(2, '0');
  const currentMins = now.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMins}`;
  
  const isOpen = currentTimeStr >= policy.dailyMarkingWindowStart && currentTimeStr <= policy.dailyMarkingWindowEnd;
  return {
    isOpen,
    start: policy.dailyMarkingWindowStart,
    end: policy.dailyMarkingWindowEnd,
  };
}

/**
 * Checks whether a specific HH:MM time string is inside the morning roll-call window.
 */
export function isMorningRollCallWindowOpen(
  timeStr: string,
  policy: AttendancePolicy = INSTITUTIONAL_CONFIG.attendance
): boolean {
  return timeStr >= policy.dailyMarkingWindowStart && timeStr <= policy.dailyMarkingWindowEnd;
}

/**
 * Returns current school-local date (YYYY-MM-DD) in Asia/Kolkata timezone.
 */
export function getSchoolLocalDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Returns formatted school-local display date (e.g. 21 October 2026).
 */
export function formatSchoolDisplayDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Student Document Slot Configuration (9 Required Slots)
// ============================================================================

export const DOCUMENT_SLOT_DEFINITIONS: Record<StudentDocumentType, DocumentSlotDefinition> = {
  student_aadhaar_front: {
    type: 'student_aadhaar_front',
    title: 'Student Aadhaar Card (Front)',
    category: 'student',
    categoryLabel: 'Student Documents',
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeInBytes: 10 * 1024 * 1024, // 10 MB
    fileTypeDescription: 'JPEG, PNG, WEBP, or PDF up to 10 MB',
  },
  student_aadhaar_back: {
    type: 'student_aadhaar_back',
    title: 'Student Aadhaar Card (Back)',
    category: 'student',
    categoryLabel: 'Student Documents',
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeInBytes: 10 * 1024 * 1024,
    fileTypeDescription: 'JPEG, PNG, WEBP, or PDF up to 10 MB',
  },
  birth_certificate: {
    type: 'birth_certificate',
    title: 'Birth Certificate',
    category: 'student',
    categoryLabel: 'Student Documents',
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeInBytes: 10 * 1024 * 1024,
    fileTypeDescription: 'JPEG, PNG, WEBP, or PDF up to 10 MB',
  },
  transfer_certificate: {
    type: 'transfer_certificate',
    title: 'Transfer Certificate (TC)',
    category: 'student',
    categoryLabel: 'Student Documents',
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeInBytes: 10 * 1024 * 1024,
    fileTypeDescription: 'JPEG, PNG, WEBP, or PDF up to 10 MB',
  },
  student_photo: {
    type: 'student_photo',
    title: 'Student Photograph',
    category: 'student',
    categoryLabel: 'Student Documents',
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeInBytes: 5 * 1024 * 1024, // 5 MB
    fileTypeDescription: 'Passport photo (JPEG, PNG, WEBP up to 5 MB)',
  },
  father_aadhaar_front: {
    type: 'father_aadhaar_front',
    title: "Father's Aadhaar Card (Front)",
    category: 'father',
    categoryLabel: "Father's Documents",
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeInBytes: 10 * 1024 * 1024,
    fileTypeDescription: 'JPEG, PNG, WEBP, or PDF up to 10 MB',
  },
  father_aadhaar_back: {
    type: 'father_aadhaar_back',
    title: "Father's Aadhaar Card (Back)",
    category: 'father',
    categoryLabel: "Father's Documents",
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeInBytes: 10 * 1024 * 1024,
    fileTypeDescription: 'JPEG, PNG, WEBP, or PDF up to 10 MB',
  },
  mother_aadhaar_front: {
    type: 'mother_aadhaar_front',
    title: "Mother's Aadhaar Card (Front)",
    category: 'mother',
    categoryLabel: "Mother's Documents",
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeInBytes: 10 * 1024 * 1024,
    fileTypeDescription: 'JPEG, PNG, WEBP, or PDF up to 10 MB',
  },
  mother_aadhaar_back: {
    type: 'mother_aadhaar_back',
    title: "Mother's Aadhaar Card (Back)",
    category: 'mother',
    categoryLabel: "Mother's Documents",
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeInBytes: 10 * 1024 * 1024,
    fileTypeDescription: 'JPEG, PNG, WEBP, or PDF up to 10 MB',
  },
};

export const ORDERED_DOCUMENT_TYPES: StudentDocumentType[] = [
  'student_aadhaar_front',
  'student_aadhaar_back',
  'birth_certificate',
  'transfer_certificate',
  'student_photo',
  'father_aadhaar_front',
  'father_aadhaar_back',
  'mother_aadhaar_front',
  'mother_aadhaar_back',
];

export const DOCUMENT_CATEGORIES: { id: DocumentCategory; label: string; types: StudentDocumentType[] }[] = [
  {
    id: 'student',
    label: 'Student Documents',
    types: ['student_aadhaar_front', 'student_aadhaar_back', 'birth_certificate', 'transfer_certificate', 'student_photo'],
  },
  {
    id: 'father',
    label: "Father's Documents",
    types: ['father_aadhaar_front', 'father_aadhaar_back'],
  },
  {
    id: 'mother',
    label: "Mother's Documents",
    types: ['mother_aadhaar_front', 'mother_aadhaar_back'],
  },
];

/**
 * Calculates document completeness summary across the 9 mandatory slots.
 */
export function calculateDocumentCompleteness(
  documents: Array<{ documentType: StudentDocumentType; isPresent?: boolean }>
): DocumentCompletenessSummary {
  const totalRequired = 9;
  const presentTypes = new Set<StudentDocumentType>();
  
  for (const doc of documents) {
    if (doc.isPresent !== false && ORDERED_DOCUMENT_TYPES.includes(doc.documentType)) {
      presentTypes.add(doc.documentType);
    }
  }

  const uploadedCount = presentTypes.size;
  const missingCount = Math.max(0, totalRequired - uploadedCount);
  const completionPercentage = Math.round((uploadedCount / totalRequired) * 100);

  return {
    totalRequired,
    uploadedCount,
    missingCount,
    completionPercentage,
  };
}

/**
 * Validates a file against slot constraints (size and MIME type).
 */
export function validateDocumentFile(
  documentType: StudentDocumentType,
  file: { size: number; type?: string; name?: string }
): { valid: boolean; error?: string } {
  const slot = DOCUMENT_SLOT_DEFINITIONS[documentType];
  if (!slot) {
    return { valid: false, error: 'Unknown document slot' };
  }

  if (file.size > slot.maxSizeInBytes) {
    const maxMb = slot.maxSizeInBytes / (1024 * 1024);
    return { valid: false, error: `File exceeds maximum allowed size of ${maxMb} MB.` };
  }

  const ext = file.name ? file.name.split('.').pop()?.toLowerCase() : '';
  const allowedExtensions: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
  };

  const fileMime = file.type?.toLowerCase();
  if (fileMime && slot.acceptedMimeTypes.includes(fileMime)) {
    return { valid: true };
  }

  // Fallback check by extension if mime type is generic or missing (e.g. application/octet-stream)
  if (ext) {
    const isExtensionAllowed = slot.acceptedMimeTypes.some(mime => 
      allowedExtensions[mime]?.includes(ext)
    );
    if (isExtensionAllowed) {
      return { valid: true };
    }
  }

  return { valid: false, error: `Invalid file format. Allowed formats: ${slot.fileTypeDescription}` };
}


