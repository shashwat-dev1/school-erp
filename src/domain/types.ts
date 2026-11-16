/**
 * HanuJai High School ERP — Domain Model Types
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Strict single-school domain specification covering all core operations.
 */

// ============================================================================
// 1. Staff & Authentication
// ============================================================================
export type StaffRole =
  | 'principal'
  | 'admin'
  | 'developer'
  | 'class_teacher'
  | 'subject_teacher';

export type ActiveStaffRole = 'principal' | 'admin' | 'developer';

export const ACTIVE_ROLES: StaffRole[] = ['principal', 'admin', 'developer'];

export interface StaffUser {
  id: string; // Firebase Auth UID or Synthetic Demo ID
  authUid?: string;               // Firebase Auth UID reference
  email: string;
  name: string;
  displayName?: string;           // Convenient alias
  fullName?: string;              // Convenient alias
  role: StaffRole;
  employeeCode: string;
  designation: string;
  department: string;
  phone: string;
  avatarUrl?: string;
  assignedClassId?: string;       // e.g. 'class-10-a' for Class Teachers
  assignedClassLabel?: string;    // e.g. 'Class 10-A'
  assignedSubjects?: string[];    // Array of subject IDs
  assignedSubjectIds?: string[];  // Convenient alias
  assignedClasses?: string[];     // Array of class IDs where teacher teaches
  status: 'active' | 'on_leave' | 'suspended' | 'deactivated';
  createdAt: string;
  lastLoginAt?: string;
}

// ============================================================================
// 2. School Settings & Campus Identity
// ============================================================================
export interface SchoolSettings {
  id: string;
  institutionName: string;         // 'HanuJai High School'
  institutionShortName: string;    // 'HanuJai'
  tagline: string;                 // 'Vidya Dadati Vinayam • Excellence in Character & Learning'
  campusLocation: string;          // 'Jaipur, Rajasthan, India'
  foundedYear: number;             // 1998
  affiliationNumber?: string;      // e.g. 'CBSE/AFF/1730198'
  contactEmail: string;
  contactPhone: string;
  activeAcademicYearId: string;
  attendancePolicy: AttendancePolicy;

  // Convenient Aliases
  schoolName?: string;
  schoolLocation?: string;
  schoolAddress?: string;
  schoolEmail?: string;
  schoolPhone?: string;
  cbseAffiliationNumber?: string;
  cbseSchoolCode?: string;
  timezone?: string;
  rolePermissions?: RolePermissions;
}

// ============================================================================
// Granular Permission Management Types
// ============================================================================
export type PermissionModule =
  | 'students'
  | 'attendance'
  | 'documents'
  | 'parent_requests'
  | 'whatsapp'
  | 'excel_import'
  | 'data_export'
  | 'classes'
  | 'users'
  | 'database'
  | 'audit'
  | 'settings';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'upload'
  | 'download'
  | 'export'
  | 'approve'
  | 'reject'
  | 'revoke'
  | 'send_whatsapp'
  | 'manage';

export type ModulePermissions = Partial<Record<PermissionAction, boolean>>;
export type RolePermissions = Record<ActiveStaffRole, Record<PermissionModule, ModulePermissions>>;

export type PermissionPreset = 'read_only' | 'read_write' | 'full' | 'custom';

export interface AttendancePolicy {
  dailyMarkingWindowStart: string; // '07:45' (24h IST)
  dailyMarkingWindowEnd: string;   // '09:15' (24h IST)
  gracePeriodMinutes: number;      // 15
  minimumAttendancePercentage: number; // 75.0 (CBSE Compliance Threshold)
  dualCustodyCorrectionRequired: boolean; // true

  // Convenient Aliases
  windowStartTime?: string;
  windowEndTime?: string;
  allowTeacherLateCorrection?: boolean;
  requirePrincipalApproval?: boolean;
  cbseMinimumThresholdPercent?: number;
}

// ============================================================================
// 3. Academic Years & Terms
// ============================================================================
export interface AcademicYear {
  id: string;                      // 'year-2025-2026'
  label: string;                   // '2025–2026'
  name?: string;                   // Alias for label
  startDate: string;               // '2025-04-01'
  endDate: string;                 // '2026-03-31'
  isCurrent: boolean;
  status: 'active' | 'planning' | 'archived';
  terms: AcademicTerm[];
}

export interface AcademicTerm {
  id: string;
  name: string;                    // 'Term 1' | 'Term 2'
  startDate: string;
  endDate: string;
}

// ============================================================================
// 4. Classes & Sections
// ============================================================================
export interface ClassSection {
  id: string;                      // 'class-10-a'
  grade: number;                   // 1 to 10
  gradeLevel?: number;             // Alias for grade
  section: 'A' | 'B';
  label: string;                   // 'Class 10-A'
  name?: string;                   // Alias for label
  academicYearId: string;
  classTeacherId: string;
  classTeacherName: string;
  coTutorId?: string;
  coTutorName?: string;
  roomNumber: string;
  studentCount: number;
  maxCapacity: number;             // standard 40
}

// ============================================================================
// 5. Subjects & Faculty Assignments
// ============================================================================
export interface Subject {
  id: string;                      // 'sub-math-10'
  code: string;                    // 'MATH-10'
  name: string;                    // 'Mathematics'
  gradeLevel: number;              // 10
  type: 'core' | 'language' | 'elective';
}

export interface SubjectAssignment {
  id: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  classLabel: string;
  teacherId: string;
  teacherName: string;
  academicYearId: string;
}

// ============================================================================
// 6. Student Master Records
// ============================================================================
export type Gender = 'M' | 'F' | 'Other';
export type StudentStatus = 'enrolled' | 'withdrawn' | 'graduated' | 'suspended';

export interface StudentRecord {
  id: string;                      // 'STU-2025-0010'
  admissionNumber: string;         // 'ADM/2023/1042'
  rollNumber: number;              // 1
  firstName: string;
  lastName: string;
  fullName: string;                // 'Aarav Singhania'
  gender: Gender;
  dateOfBirth: string;             // '2010-08-14'
  enrollmentDate: string;          // '2023-04-05'
  classId: string;                 // 'class-10-a'
  classLabel: string;              // 'Class 10-A'
  academicYearId: string;
  status: StudentStatus;
  
  // Guardian & Contact
  guardianName: string;
  guardianRelation: 'Father' | 'Mother' | 'Guardian';
  fatherName?: string;
  motherName?: string;
  primaryPhone: string;
  alternatePhone?: string;
  residentialAddress: string;
  city: string;                    // 'Jaipur'
  state: string;                   // 'Rajasthan'
  pincode: string;
  
  // Operational Metrics (Computed)
  attendancePercentage: number;    // e.g. 94.2
  attendanceSummary?: { overallPercentage: number };
  academicAverage: number;         // e.g. 82.5
  activeFlags: StudentFlag[];
  careFlags?: Array<{ code: string; label?: string; description?: string }>;
  
  createdAt: string;
  updatedAt: string;
}

export interface StudentFlag {
  id: string;
  code: 'ATT-01' | 'ATT-03' | 'DISC-02' | 'FEE-01';
  type: 'attendance' | 'behaviour' | 'administrative';
  severity: 'alert' | 'warning' | 'info';
  title: string;
  reason: string;
  triggeredAt: string;
  resolved: boolean;
}

// ============================================================================
// 7. Daily Attendance Sessions & Registers
// ============================================================================
export type AttendanceState = 'present' | 'absent' | 'late' | 'excused';

export interface DailyAttendanceRecord {
  studentId: string;
  studentName: string;
  rollNumber: number;
  state: AttendanceState;
  remarks?: string;
}

export interface AttendanceSession {
  id: string;                      // 'att-class-10-a-2026-10-21'
  classId: string;
  classLabel: string;
  date: string;                    // '2026-10-21'
  academicYearId: string;
  takenByStaffId: string;
  takenByStaffName: string;
  markedByStaffId?: string;        // Backward compatible alias for takenByStaffId
  takenAt: string;                 // ISO Timestamp
  
  windowStart: string;
  windowEnd: string;
  isWindowOpen: boolean;
  status: 'draft' | 'submitted' | 'corrected';
  
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  totalPresent?: number;           // Backward compatible alias for presentCount
  totalAbsent?: number;            // Backward compatible alias for absentCount
  lateCount: number;
  excusedCount: number;
  
  records: DailyAttendanceRecord[];
}

export interface AttendanceAggregate {
  classId: string;
  date: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
}

export interface AttendanceCorrection {
  id: string;
  sessionId: string;
  classId: string;
  classLabel: string;
  section?: string;
  date: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  previousState: AttendanceState;
  requestedState: AttendanceState;
  mandatoryReason: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  requestedAt: string;
  status: 'pending_principal' | 'approved' | 'rejected';
  reviewedByStaffId?: string;
  reviewedByStaffName?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  notificationJobId?: string;
  notificationStatus?: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
  notificationError?: string;
}

// ============================================================================
// 8. Assessment Definitions & Marks Entry
// ============================================================================
export type AssessmentType = 'unit_test_1' | 'unit_test_2' | 'half_yearly' | 'annual';

export interface AssessmentCycle {
  id: string;                      // 'assess-ut1-2025'
  type: AssessmentType;
  title: string;                   // 'Unit Test 1'
  name?: string;                   // Alias for title
  term?: 'term1' | 'term2';
  academicYearId: string;
  startDate: string;
  endDate: string;
  maxMarks: number;                // e.g. 25 for UT, 80 for Annual
  passingMarks: number;            // e.g. 9 for UT, 27 for Annual
  weightagePercent: number;        // e.g. 10
  status: 'scheduled' | 'active_marking' | 'locked' | 'published' | 'draft';
}

export interface StudentMarkEntry {
  studentId: string;
  studentName: string;
  rollNumber: number;
  marksObtained: number | null;    // null indicates absent
  isAbsent: boolean;
  remarks?: string;
  percentage?: number;
  grade?: string;                  // 'A1', 'A2', 'B1', etc.
}

export interface MarksRegister {
  id: string;                      // 'reg-assess-ut1-class-10-a-math'
  assessmentId: string;
  assessmentTitle: string;
  classId: string;
  classLabel: string;
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  passingMarks: number;
  teacherId: string;
  teacherName: string;
  status: 'draft' | 'submitted' | 'verified_locked' | 'finalized';
  lastSavedAt: string;
  submittedAt?: string;
  entries: StudentMarkEntry[];
}

// ============================================================================
// 9. Behaviour & Disciplinary Incidents
// ============================================================================
export type IncidentCategory = 'academic_integrity' | 'conduct_discipline' | 'punctuality' | 'commendation';
export type IncidentSeverity = 'commendation' | 'notice' | 'disciplinary' | 'critical';

export interface IncidentRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  classLabel: string;
  date: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  description: string;
  actionTaken?: string;
  loggedByStaffId: string;
  loggedByStaffName: string;
  loggedByName?: string;           // Alias for loggedByStaffName
  loggedByStaffRole: StaffRole;
  createdAt: string;
  parentNotified: boolean;
}

// ============================================================================
// 10. Audit Ledger Events
// ============================================================================
export type AuditAction = 
  | 'login_success' 
  | 'login_failed' 
  | 'student_created' 
  | 'student_updated'
  | 'attendance_submitted' 
  | 'attendance_corrected' 
  | 'attendance_correction_requested'
  | 'attendance_correction_rejected'
  | 'marks_saved' 
  | 'marks_submitted'
  | 'incident_recorded'
  | 'followup_recorded'
  | 'policy_updated'
  | 'document_uploaded'
  | 'document_replaced'
  | 'document_deleted'
  | 'document_approved'
  | 'document_rejected'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_status_changed'
  | 'user_role_changed'
  | 'user_session_revoked'
  | 'password_recovery_initiated'
  | 'permissions_updated';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: StaffRole;
  action: AuditAction;
  resource: string;
  targetId: string;
  summary: string;
  details?: Record<string, unknown>;
  oldValue?: unknown;
  newValue?: unknown;
  clientIp?: string;
  // Aliases for UI flexibility
  eventType?: string;
  targetEntity?: string;
  ipAddress?: string;
  diff?: { before?: unknown; after?: unknown };
}

// ============================================================================
// 11. Pagination & Generic Query Filter Structures
// ============================================================================
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StudentFilter {
  classId?: string;
  query?: string;
  status?: StudentStatus;
  flagCode?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
}

export interface IncidentFilter {
  studentId?: string;
  classId?: string;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
}

export interface AuditFilter {
  actorId?: string;
  action?: AuditAction;
  resource?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

// ============================================================================
// 12. Student Document Management (9 Required Slots)
// ============================================================================

export type StudentDocumentType =
  | 'student_aadhaar_front'
  | 'student_aadhaar_back'
  | 'birth_certificate'
  | 'transfer_certificate'
  | 'student_photo'
  | 'father_aadhaar_front'
  | 'father_aadhaar_back'
  | 'mother_aadhaar_front'
  | 'mother_aadhaar_back';

export type DocumentCategory = 'student' | 'father' | 'mother';

export interface DocumentSlotDefinition {
  type: StudentDocumentType;
  title: string;
  category: DocumentCategory;
  categoryLabel: string;
  required: boolean;
  acceptedMimeTypes: string[];
  maxSizeInBytes: number;
  fileTypeDescription: string;
}

export interface StudentDocumentRecord {
  id: string; // matches documentType, e.g. "student_aadhaar_front"
  documentType: StudentDocumentType;
  studentId: string;
  storagePath: string; // "students/{studentId}/documents/{documentType}/{fileId}"
  originalFileName: string;
  contentType: string; // e.g. "image/jpeg", "application/pdf"
  fileSize: number; // in bytes
  uploadedAt: string; // ISO 8601 string
  uploadedBy: string; // Staff ID, e.g. "staff-admin"
  uploadedByName: string; // Staff Name, e.g. "Admin Office"
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
  version: number;
  isPresent: boolean;
  downloadUrl?: string; // Ephemeral preview/download URL
  reviewStatus?: 'pending' | 'accepted' | 'rejected';
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
}

export interface DocumentCompletenessSummary {
  totalRequired: number; // 9
  uploadedCount: number;
  missingCount: number;
  completionPercentage: number;
}

// ============================================================================
// 13. Secure Parent Document Collection & Invitations
// ============================================================================

export type ParentInvitationStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface ParentDocumentInvitation {
  id: string; // document id (typically tokenHash)
  tokenHash: string; // SHA-256 of raw invitation token
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  classLabel: string;
  guardianPhone: string;
  guardianName: string;
  requestedSlots: StudentDocumentType[];
  status: ParentInvitationStatus;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  revokedAt?: string;
  createdBy: string;
  createdByName: string;
  whatsappMessageId?: string;
  otpHash?: string;
  otpExpiresAt?: string;
  otpAttempts?: number;
  lastOtpSentAt?: string;
}

export interface ParentUploadSession {
  sessionId: string;
  tokenHash: string;
  uploadSessionToken?: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  classLabel: string;
  guardianPhone: string;
  requestedSlots: StudentDocumentType[];
  authorizedSlots?: StudentDocumentType[];
  expiresAt: string;
  createdAt: string;
}
