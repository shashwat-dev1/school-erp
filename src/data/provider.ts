/**
 * HanuJai High School ERP — Data Provider Interface
 * Unified contract isolating UI components from the underlying data store (Demo vs. Firebase).
 */

import type {
  SchoolSettings,
  AttendancePolicy,
  AcademicYear,
  ClassSection,
  Subject,
  SubjectAssignment,
  StaffUser,
  StudentRecord,
  StudentFilter,
  PaginatedResult,
  AttendanceSession,
  AttendanceCorrection,
  AssessmentCycle,
  MarksRegister,
  StudentMarkEntry,
  IncidentRecord,
  IncidentFilter,
  AuditEvent,
  AuditFilter,
  AttendanceState,
} from '../domain/types';

export interface AttendanceSubmissionInput {
  classId: string;
  date: string;
  academicYearId: string;
  records: Array<{
    studentId: string;
    state: AttendanceState;
    remarks?: string;
  }>;
}

export interface AttendanceCorrectionInput {
  sessionId: string;
  studentId: string;
  previousState: AttendanceState;
  requestedState: AttendanceState;
  mandatoryReason: string;
}

export interface MarksSubmissionInput {
  assessmentId: string;
  classId: string;
  subjectId: string;
  isDraft: boolean;
  entries: Array<{
    studentId: string;
    marksObtained: number | null;
    isAbsent: boolean;
    remarks?: string;
  }>;
}

export interface NewStudentInput {
  admissionNumber: string;
  rollNumber: number;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F' | 'Other';
  dateOfBirth: string;
  enrollmentDate: string;
  classId: string;
  guardianName: string;
  guardianRelation: 'Father' | 'Mother' | 'Guardian';
  primaryPhone: string;
  residentialAddress: string;
}

export interface NewIncidentInput {
  studentId: string;
  category: 'academic_integrity' | 'conduct_discipline' | 'punctuality' | 'commendation';
  severity: 'commendation' | 'notice' | 'disciplinary' | 'critical';
  title: string;
  description: string;
  actionTaken?: string;
}

export interface RiskWatchlistItem {
  student: StudentRecord;
  primaryTrigger: string;
  consecutiveAbsences: number;
  attendanceRate: number;
  academicDropPercent: number;
  flagCount: number;
  mentorAssigned?: string;
  followUpStatus: 'pending' | 'in_progress' | 'counseled' | 'resolved';
}

export interface ConsolidatedClassMarks {
  classSection: ClassSection;
  assessmentCycle: AssessmentCycle;
  subjects: Subject[];
  students: StudentRecord[];
  matrix: Record<string, Record<string, StudentMarkEntry | null>>; // studentId -> subjectId -> entry
  subjectAverages: Record<string, number>;
}

export interface DataProvider {
  // Institutional Identity & Context
  getSchoolSettings(): Promise<SchoolSettings>;
  updateSchoolSettings(settings: Partial<SchoolSettings>, actor: StaffUser): Promise<SchoolSettings>;
  getActiveAcademicYear(): Promise<AcademicYear>;
  getAcademicYears(): Promise<AcademicYear[]>;
  updateAcademicYear(yearId: string, updates: Partial<AcademicYear>, actor: StaffUser): Promise<AcademicYear>;
  getStaffMembers(): Promise<StaffUser[]>;
  getStaffMemberById(staffId: string): Promise<StaffUser | null>;
  createStaffMember(input: Partial<StaffUser>, actor: StaffUser): Promise<StaffUser>;
  updateStaffMember(staffId: string, updates: Partial<StaffUser>, actor: StaffUser): Promise<StaffUser>;
  getCurrentStaffUser(userId: string): Promise<StaffUser | null>;

  // Classes & Section Roster
  getClasses(yearId?: string): Promise<ClassSection[]>;
  getClassById(classId: string): Promise<ClassSection | null>;
  getClassStudents(classId: string): Promise<StudentRecord[]>;
  updateClassTeacher(classId: string, teacherId: string, teacherName: string, actor: StaffUser): Promise<ClassSection>;
  getSubjects(): Promise<Subject[]>;
  createSubject(subject: Partial<Subject>, actor: StaffUser): Promise<Subject>;
  getSubjectAssignments(teacherId?: string): Promise<SubjectAssignment[]>;
  assignSubjectTeacher(assignment: Partial<SubjectAssignment>, actor: StaffUser): Promise<SubjectAssignment>;

  // Student Directory & Profile
  getStudents(filter?: StudentFilter): Promise<PaginatedResult<StudentRecord>>;
  getStudentById(studentId: string): Promise<StudentRecord | null>;
  createStudent(input: NewStudentInput, actor: StaffUser): Promise<StudentRecord>;
  updateStudent(studentId: string, updates: Partial<StudentRecord>, actor: StaffUser, reason: string): Promise<StudentRecord>;
  getStudentAuditHistory(studentId: string): Promise<AuditEvent[]>;

  // Attendance Register & Policy
  getAttendanceSessions(date?: string): Promise<AttendanceSession[]>;
  getAttendanceSession(classId: string, date: string): Promise<AttendanceSession | null>;
  submitDailyAttendance(input: AttendanceSubmissionInput, actor: StaffUser): Promise<AttendanceSession>;
  getAttendanceCorrections(classId?: string): Promise<AttendanceCorrection[]>;
  requestAttendanceCorrection(input: AttendanceCorrectionInput, actor: StaffUser): Promise<AttendanceCorrection>;
  approveAttendanceCorrection(correctionId: string, actor: StaffUser, approved: boolean, remarks?: string): Promise<void>;
  updateAttendancePolicy(policy: Partial<AttendancePolicy>, actor: StaffUser): Promise<AttendancePolicy>;

  // Assessment Cycles & Marks
  getAssessmentCycles(yearId?: string): Promise<AssessmentCycle[]>;
  getAssessmentCycleById(cycleId: string): Promise<AssessmentCycle | null>;
  createAssessmentCycle(cycle: Partial<AssessmentCycle>, actor: StaffUser): Promise<AssessmentCycle>;
  updateAssessmentCycle(cycleId: string, updates: Partial<AssessmentCycle>, actor: StaffUser): Promise<AssessmentCycle>;
  getMarksRegister(assessmentId: string, classId: string, subjectId: string): Promise<MarksRegister | null>;
  saveMarksRegister(input: MarksSubmissionInput, actor: StaffUser): Promise<MarksRegister>;
  getConsolidatedClassMarks(classId: string, assessmentId?: string): Promise<ConsolidatedClassMarks>;

  // Behaviour & Incidents
  getIncidents(filter?: IncidentFilter): Promise<IncidentRecord[]>;
  createIncident(input: NewIncidentInput, actor: StaffUser): Promise<IncidentRecord>;
  updateIncident(incidentId: string, updates: Partial<IncidentRecord>, actor: StaffUser): Promise<IncidentRecord>;

  // Risk Watchlist & Explainable Rules
  getRiskWatchlist(): Promise<RiskWatchlistItem[]>;

  // Audit Ledger
  getAuditEvents(filter?: AuditFilter): Promise<AuditEvent[]>;

  // Reset Demo Repository (Demo mode only)
  resetDemoData?(): Promise<void>;
}
