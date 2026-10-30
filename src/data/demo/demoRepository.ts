/**
 * HanuJai High School ERP — In-Browser Demo Repository
 * Implements the DataProvider interface using localStorage for deterministic prototyping.
 */

import type {
  DataProvider,
  AttendanceSubmissionInput,
  AttendanceCorrectionInput,
  MarksSubmissionInput,
  NewStudentInput,
  NewIncidentInput,
  RiskWatchlistItem,
  ConsolidatedClassMarks,
  FollowUpActionInput,
  StudentFollowUpRecord,
} from '../provider';
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
  AttendanceAggregate,
  AttendanceCorrection,
  AssessmentCycle,
  MarksRegister,
  IncidentRecord,
  IncidentFilter,
  AuditEvent,
  AuditFilter,
} from '../../domain/types';

import {
  initialSettings,
  initialStaff,
  initialAttendanceSessions,
  initialAttendanceCorrections,
  initialAuditEvents,
} from './seedData';
import {
  historicalAcademicYears,
  historicalAssessmentCycles,
  historicalSubjects,
  historicalSubjectAssignments,
  generateAllHistoricalClasses,
  generateAllHistoricalStudents,
  generateAllHistoricalMarksRegisters,
  generateAllHistoricalAttendanceSessions,
  generateAllHistoricalTeacherNotes,
  expandCompactSession,
  CompactAttendanceSession,
  StudentProgressionEntry,
} from './historicalGenerator';
import { getSchoolLocalDate, calculateGrade } from '../../domain/policy';

const STORAGE_KEY = 'hanujai_erp_demo_store_v2';

// Lazy baseline singletons
let cachedBaselineStudents: StudentRecord[] | null = null;
let cachedBaselineMarks: MarksRegister[] | null = null;
let cachedBaselineAttendance: CompactAttendanceSession[] | null = null;

function getBaselineStudents(): StudentRecord[] {
  if (!cachedBaselineStudents) {
    cachedBaselineStudents = generateAllHistoricalStudents();
  }
  return cachedBaselineStudents;
}

function getBaselineMarks(students: StudentRecord[]): MarksRegister[] {
  if (!cachedBaselineMarks) {
    cachedBaselineMarks = generateAllHistoricalMarksRegisters(students);
  }
  return cachedBaselineMarks;
}

function getBaselineAttendance(students: StudentRecord[]): CompactAttendanceSession[] {
  if (!cachedBaselineAttendance) {
    cachedBaselineAttendance = generateAllHistoricalAttendanceSessions(students);
  }
  return cachedBaselineAttendance;
}

interface DemoStore {
  settings: SchoolSettings;
  academicYears: AcademicYear[];
  academicYear: AcademicYear;
  staff: StaffUser[];
  classes: ClassSection[];
  subjects: Subject[];
  subjectAssignments: SubjectAssignment[];
  students: StudentRecord[];
  assessments: AssessmentCycle[];
  attendanceSessions: AttendanceSession[];
  attendanceCorrections: AttendanceCorrection[];
  marksRegisters: MarksRegister[];
  incidents: IncidentRecord[];
  auditEvents: AuditEvent[];
  followUps?: StudentFollowUpRecord[];
  userSavedRegisterIds?: string[];
}

function getInitialStore(): DemoStore {
  const students = getBaselineStudents();
  const marksRegisters = [...getBaselineMarks(students)];
  const classes = generateAllHistoricalClasses();
  const notes = generateAllHistoricalTeacherNotes();

  return {
    settings: { ...initialSettings },
    academicYears: [...historicalAcademicYears],
    academicYear: { ...(historicalAcademicYears.find(y => y.isCurrent) || historicalAcademicYears[2]) },
    staff: [...initialStaff],
    classes,
    subjects: [...historicalSubjects],
    subjectAssignments: [...historicalSubjectAssignments],
    students: [...students],
    assessments: [...historicalAssessmentCycles],
    attendanceSessions: [...initialAttendanceSessions],
    attendanceCorrections: [...initialAttendanceCorrections],
    marksRegisters,
    incidents: [...notes],
    auditEvents: [...initialAuditEvents],
    followUps: [],
    userSavedRegisterIds: [],
  };
}

class DemoRepository implements DataProvider {
  private storeCache: DemoStore | null = null;
  private userSavedRegisterIds = new Set<string>();

  private loadStore(): DemoStore {
    if (this.storeCache) {
      return this.storeCache;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.students && parsed.students.length >= 500) {
          // Sync staff to ensure 3-role model without legacy office_admin
          if (
            !parsed.staff ||
            parsed.staff.some((s: StaffUser) => (s.role as string) === 'office_admin' || (s.role as string) === 'office_staff') ||
            !parsed.staff.some((s: StaffUser) => s.email === 'alok.saxena@hanujai.edu.in')
          ) {
            parsed.staff = [...initialStaff];
          }

          // Ensure all historical cycles and classes exist
          parsed.academicYears = [...historicalAcademicYears];
          parsed.assessments = [...historicalAssessmentCycles];
          parsed.classes = generateAllHistoricalClasses();
          parsed.subjects = [...historicalSubjects];
          parsed.subjectAssignments = [...historicalSubjectAssignments];

          // Restore user-saved registers into baseline marks
          const baselineStudents = getBaselineStudents();
          const baseMarks = getBaselineMarks(baselineStudents);
          const fullMarksMap = new Map<string, MarksRegister>(baseMarks.map(r => [r.id, r]));

          if (Array.isArray(parsed.userSavedRegisterIds)) {
            parsed.userSavedRegisterIds.forEach((id: string) => this.userSavedRegisterIds.add(id));
          }

          if (Array.isArray(parsed.marksRegisters)) {
            parsed.marksRegisters.forEach((userReg: MarksRegister) => {
              fullMarksMap.set(userReg.id, userReg);
              this.userSavedRegisterIds.add(userReg.id);
            });
          }
          parsed.marksRegisters = Array.from(fullMarksMap.values());

          if (!Array.isArray(parsed.incidents) || parsed.incidents.length === 0) {
            parsed.incidents = generateAllHistoricalTeacherNotes();
          }

          if (!Array.isArray(parsed.attendanceSessions)) {
            parsed.attendanceSessions = [...initialAttendanceSessions];
          }

          this.storeCache = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[DemoRepository] Could not parse localStorage, re-initializing seed store.', e);
    }

    const store = getInitialStore();
    this.storeCache = store;
    this.saveStore(store);
    return store;
  }

  private saveStore(store: DemoStore): void {
    try {
      this.storeCache = store;
      // Optimize storage size to stay well under 5MB quota:
      // Only serialize user-modified registers and user-modified attendance sessions
      const toSerialize: DemoStore = {
        ...store,
        userSavedRegisterIds: Array.from(this.userSavedRegisterIds),
        marksRegisters: store.marksRegisters.filter(r => this.userSavedRegisterIds.has(r.id)),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSerialize));
    } catch (e) {
      console.error('[DemoRepository] Failed to save store to localStorage:', e);
    }
  }

  // Institutional Identity & Settings
  public async getSchoolSettings(): Promise<SchoolSettings> {
    return this.loadStore().settings;
  }

  public async updateSchoolSettings(
    settings: Partial<SchoolSettings>,
    actor: StaffUser
  ): Promise<SchoolSettings> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    store.settings = { ...store.settings, ...settings };

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'policy_updated',
      resource: 'schoolSettings',
      targetId: store.settings.id,
      summary: `Updated core institution configuration for ${store.settings.institutionName}`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return store.settings;
  }

  public async updateAttendancePolicy(
    policy: Partial<AttendancePolicy>,
    actor: StaffUser
  ): Promise<AttendancePolicy> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    store.settings.attendancePolicy = {
      ...store.settings.attendancePolicy,
      ...policy,
    };

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'policy_updated',
      resource: 'attendancePolicy',
      targetId: 'policy-attendance',
      summary: `Updated daily attendance window policy (${store.settings.attendancePolicy.dailyMarkingWindowStart}–${store.settings.attendancePolicy.dailyMarkingWindowEnd})`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return store.settings.attendancePolicy;
  }

  public async getActiveAcademicYear(): Promise<AcademicYear> {
    return this.loadStore().academicYear;
  }

  public async getAcademicYears(): Promise<AcademicYear[]> {
    const store = this.loadStore();
    return store.academicYears || [store.academicYear];
  }

  public async updateAcademicYear(
    yearId: string,
    updates: Partial<AcademicYear>,
    actor: StaffUser
  ): Promise<AcademicYear> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    if (!store.academicYears) store.academicYears = [...historicalAcademicYears];
    const idx = store.academicYears.findIndex(y => y.id === yearId);
    if (idx === -1) throw new Error('Academic Year not found');

    store.academicYears[idx] = { ...store.academicYears[idx], ...updates };
    if (updates.isCurrent) {
      store.academicYears.forEach((y, i) => {
        if (i !== idx) y.isCurrent = false;
      });
      store.academicYear = store.academicYears[idx];
    }

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'policy_updated',
      resource: 'academicYears',
      targetId: yearId,
      summary: `Updated academic session settings for ${store.academicYears[idx].label}`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return store.academicYears[idx];
  }

  // Staff Management
  public async getStaffMembers(): Promise<StaffUser[]> {
    return this.loadStore().staff;
  }

  public async getStaffMemberById(staffId: string): Promise<StaffUser | null> {
    const found = this.loadStore().staff.find(s => s.id === staffId);
    return found || null;
  }

  public async createStaffMember(input: Partial<StaffUser>, actor: StaffUser): Promise<StaffUser> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    const newStaff: StaffUser = {
      id: `staff-${Date.now()}`,
      email: input.email || `staff.${Date.now()}@hanujai.edu.in`,
      name: input.name || 'New Faculty',
      role: input.role || 'subject_teacher',
      employeeCode: input.employeeCode || `EMP-${new Date().getFullYear()}-${Math.floor(Math.random() * 800 + 100)}`,
      designation: input.designation || 'Faculty Member',
      department: input.department || 'Academics',
      phone: input.phone || '+91 98290 00000',
      assignedClassId: input.assignedClassId,
      assignedClassLabel: input.assignedClassLabel,
      assignedSubjects: input.assignedSubjects || [],
      assignedClasses: input.assignedClasses || [],
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    store.staff.push(newStaff);

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'student_created',
      resource: 'staff',
      targetId: newStaff.id,
      summary: `Provisioned new staff account for ${newStaff.name} (${newStaff.role})`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return newStaff;
  }

  public async updateStaffMember(
    staffId: string,
    updates: Partial<StaffUser>,
    actor: StaffUser
  ): Promise<StaffUser> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    const idx = store.staff.findIndex(s => s.id === staffId);
    if (idx === -1) throw new Error('Staff member not found');

    store.staff[idx] = { ...store.staff[idx], ...updates };

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'student_updated',
      resource: 'staff',
      targetId: staffId,
      summary: `Updated faculty assignment profile for ${store.staff[idx].name}`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return store.staff[idx];
  }

  public async getCurrentStaffUser(userId: string): Promise<StaffUser | null> {
    const staff = this.loadStore().staff;
    return staff.find(s => s.id === userId) || staff[0] || null;
  }

  // Classes & Sections
  public async getClasses(yearId?: string): Promise<ClassSection[]> {
    const store = this.loadStore();
    const targetYear = yearId || store.academicYear?.id || 'year-2025-2026';
    const matches = store.classes.filter(c => c.academicYearId === targetYear);
    return matches.length > 0 ? matches : store.classes.slice(0, 20);
  }

  private getStudentsForClassInYear(classId: string, academicYearId: string): StudentRecord[] {
    const store = this.loadStore();
    return store.students.filter(s => {
      const prog = (s as any).previousEnrollments as StudentProgressionEntry[] | undefined;
      if (prog) {
        return prog.some(p => p.academicYearId === academicYearId && p.classId === classId);
      }
      return s.classId === classId;
    });
  }

  public async getClassById(classId: string): Promise<ClassSection | null> {
    const found = this.loadStore().classes.find(c => c.id === classId);
    return found || null;
  }

  public async getClassStudents(classId: string): Promise<StudentRecord[]> {
    const store = this.loadStore();
    const sorted = store.students
      .filter(s => s.classId === classId)
      .sort((a, b) => {
        const nameComp = (a.firstName || '').localeCompare(b.firstName || '', undefined, { sensitivity: 'base' })
          || (a.lastName || '').localeCompare(b.lastName || '', undefined, { sensitivity: 'base' });
        if (nameComp !== 0) return nameComp;
        return a.rollNumber - b.rollNumber;
      });
    return sorted.map((s, idx) => ({
      ...s,
      rollNumber: idx + 1,
    }));
  }

  public async updateClassTeacher(
    classId: string,
    teacherId: string,
    teacherName: string,
    actor: StaffUser
  ): Promise<ClassSection> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    const cls = store.classes.find(c => c.id === classId);
    if (!cls) throw new Error('Class section not found');

    cls.classTeacherId = teacherId;
    cls.classTeacherName = teacherName;

    // Update staff record
    const teacher = store.staff.find(s => s.id === teacherId);
    if (teacher) {
      teacher.assignedClassId = classId;
      teacher.assignedClassLabel = cls.label;
    }

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'policy_updated',
      resource: 'classes',
      targetId: classId,
      summary: `Assigned ${teacherName} as Class Tutor for ${cls.label}`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return cls;
  }

  // Subjects & Assignments
  public async getSubjects(): Promise<Subject[]> {
    return this.loadStore().subjects;
  }

  public async createSubject(subject: Partial<Subject>, actor: StaffUser): Promise<Subject> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    const newSubject: Subject = {
      id: `sub-${Date.now()}`,
      code: subject.code || 'SUB-NEW',
      name: subject.name || 'New Subject',
      gradeLevel: subject.gradeLevel || 10,
      type: subject.type || 'core',
    };
    store.subjects.push(newSubject);

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'policy_updated',
      resource: 'subjects',
      targetId: newSubject.id,
      summary: `Added curriculum subject ${newSubject.name} (${newSubject.code})`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return newSubject;
  }

  public async getSubjectAssignments(teacherId?: string): Promise<SubjectAssignment[]> {
    const store = this.loadStore();
    if (teacherId) {
      return store.subjectAssignments.filter(a => a.teacherId === teacherId);
    }
    return store.subjectAssignments;
  }

  public async assignSubjectTeacher(
    assignment: Partial<SubjectAssignment>,
    actor: StaffUser
  ): Promise<SubjectAssignment> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    if (!assignment.subjectId || !assignment.classId || !assignment.teacherId) {
      throw new Error('Subject assignment requires subjectId, classId, and teacherId.');
    }
    const subj = store.subjects.find(s => s.id === assignment.subjectId);
    const cls = store.classes.find(c => c.id === assignment.classId);
    const teacher = store.staff.find(s => s.id === assignment.teacherId);

    const newAssign: SubjectAssignment = {
      id: `assign-${Date.now()}`,
      subjectId: assignment.subjectId,
      subjectName: assignment.subjectName || subj?.name || assignment.subjectId,
      classId: assignment.classId,
      classLabel: assignment.classLabel || cls?.label || assignment.classId,
      teacherId: assignment.teacherId,
      teacherName: assignment.teacherName || teacher?.name || assignment.teacherId,
      academicYearId: assignment.academicYearId || 'year-2025-2026',
    };

    // Remove any collision for this subject + class
    store.subjectAssignments = store.subjectAssignments.filter(
      a => !(a.subjectId === newAssign.subjectId && a.classId === newAssign.classId)
    );
    store.subjectAssignments.push(newAssign);

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'policy_updated',
      resource: 'subjectAssignments',
      targetId: newAssign.id,
      summary: `Assigned ${newAssign.teacherName} to teach ${newAssign.subjectName} for ${newAssign.classLabel}`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return newAssign;
  }

  // Student Directory & Profiles
  public async getStudents(filter: StudentFilter = {}): Promise<PaginatedResult<StudentRecord>> {
    const store = this.loadStore();
    let res = [...store.students];

    if (filter.classId && filter.classId !== 'all') {
      res = res.filter(s => s.classId === filter.classId);
    }

    if (filter.query) {
      const q = filter.query.toLowerCase().trim();
      res = res.filter(
        s =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          s.rollNumber.toString().includes(q)
      );
    }

    if (filter.status) {
      res = res.filter(s => s.status === filter.status);
    }

    const total = res.length;
    const page = filter.page || 1;
    const pageSize = filter.pageSize || filter.limit || 50;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const start = (page - 1) * pageSize;
    const items = res.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  public async getStudentById(studentId: string): Promise<StudentRecord | null> {
    const found = this.loadStore().students.find(
      s => s.id === studentId || s.id.toLowerCase() === studentId.toLowerCase()
    );
    return found || null;
  }

  public async createStudent(input: NewStudentInput, actor: StaffUser): Promise<StudentRecord> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();

    // Collision check
    const existing = store.students.find(
      s => s.admissionNumber.toLowerCase() === input.admissionNumber.toLowerCase()
    );
    if (existing) {
      throw new Error(`Collision: Admission number ${input.admissionNumber} already exists.`);
    }

    const cls = store.classes.find(c => c.id === input.classId);

    const student: StudentRecord = {
      id: `STU-${Date.now()}`,
      admissionNumber: input.admissionNumber,
      rollNumber: input.rollNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: `${input.firstName} ${input.lastName}`,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      enrollmentDate: input.enrollmentDate,
      classId: input.classId,
      classLabel: cls ? cls.label : input.classId,
      academicYearId: 'year-2025-2026',
      status: 'enrolled',
      guardianName: input.guardianName,
      guardianRelation: input.guardianRelation,
      primaryPhone: input.primaryPhone,
      residentialAddress: input.residentialAddress,
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      attendancePercentage: 100,
      academicAverage: 0,
      activeFlags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.students.unshift(student);

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'student_created',
      resource: 'students',
      targetId: student.id,
      summary: `Enrolled new student ${student.fullName} into ${student.classLabel} (Adm #${student.admissionNumber})`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return student;
  }

  public async updateStudent(
    studentId: string,
    updates: Partial<StudentRecord>,
    actor: StaffUser,
    reason: string
  ): Promise<StudentRecord> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    const idx = store.students.findIndex(
      s => s.id === studentId || s.id.toLowerCase() === studentId.toLowerCase()
    );
    if (idx === -1) throw new Error('Student record not found.');

    const oldRecord = { ...store.students[idx] };
    const updated = {
      ...oldRecord,
      ...updates,
      fullName: updates.firstName && updates.lastName
        ? `${updates.firstName} ${updates.lastName}`
        : updates.firstName
        ? `${updates.firstName} ${oldRecord.lastName}`
        : oldRecord.fullName,
      updatedAt: new Date().toISOString(),
    };

    store.students[idx] = updated;

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'student_updated',
      resource: 'students',
      targetId: studentId,
      summary: `Updated master profile for ${updated.fullName}: ${reason}`,
      details: { reason, updates },
      oldValue: oldRecord,
      newValue: updated,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return updated;
  }

  public async getStudentAuditHistory(studentId: string): Promise<AuditEvent[]> {
    const store = this.loadStore();
    return store.auditEvents.filter(
      a => a.targetId === studentId || a.targetId.toLowerCase() === studentId.toLowerCase()
    );
  }

  // Attendance Registers & Policy
  public async getAttendanceSessions(date?: string): Promise<AttendanceSession[]> {
    const store = this.loadStore();
    const targetDate = date || getSchoolLocalDate();
    const matches = store.attendanceSessions.filter(s => s.date === targetDate);
    if (matches.length > 0) return matches;

    // Search historical baseline compact sessions
    const compacts = getBaselineAttendance(store.students).filter(s => s.date === targetDate);
    if (compacts.length > 0) {
      return compacts.map(c => {
        const classStudents = this.getStudentsForClassInYear(c.classId, c.academicYearId);
        const enrolled = classStudents.filter(s => s.enrollmentDate <= c.date);
        return expandCompactSession(c, enrolled);
      });
    }

    if (!date && store.attendanceSessions.length > 0) {
      return store.attendanceSessions;
    }
    return [];
  }

  public async getAttendanceSessionsInRange(startDate: string, endDate: string, classIds?: string[]): Promise<AttendanceSession[]> {
    const store = this.loadStore();
    const results: AttendanceSession[] = [];
    const handledIds = new Set<string>();

    // 1. Overlay / user-modified sessions
    for (const session of store.attendanceSessions) {
      if (session.date >= startDate && session.date <= endDate) {
        if (!classIds?.length || classIds.includes(session.classId)) {
          results.push(session);
          handledIds.add(session.id);
        }
      }
    }

    // 2. Historical baseline compact sessions
    const baselineAtt = getBaselineAttendance(store.students);
    for (const compact of baselineAtt) {
      if (compact.date >= startDate && compact.date <= endDate) {
        if (!classIds?.length || classIds.includes(compact.classId)) {
          if (!handledIds.has(compact.id)) {
            const classStudents = this.getStudentsForClassInYear(compact.classId, compact.academicYearId);
            const enrolled = classStudents.filter(s => s.enrollmentDate <= compact.date);
            results.push(expandCompactSession(compact, enrolled));
            handledIds.add(compact.id);
          }
        }
      }
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  public async getAttendanceSession(classId: string, date: string): Promise<AttendanceSession | null> {
    const store = this.loadStore();
    const found = store.attendanceSessions.find(s => s.classId === classId && s.date === date);
    if (found) return found;

    const compact = getBaselineAttendance(store.students).find(s => s.classId === classId && s.date === date);
    if (compact) {
      const classStudents = this.getStudentsForClassInYear(compact.classId, compact.academicYearId);
      const enrolled = classStudents.filter(s => s.enrollmentDate <= compact.date);
      return expandCompactSession(compact, enrolled);
    }
    return null;
  }

  public async getAttendanceAggregate(classId: string, date: string): Promise<AttendanceAggregate | null> {
    const session = await this.getAttendanceSession(classId, date);
    if (!session || session.status === 'draft') return null;
    return {
      classId: session.classId,
      date: session.date,
      totalStudents: session.totalStudents,
      presentCount: session.presentCount,
      absentCount: session.absentCount,
      lateCount: session.lateCount,
      excusedCount: session.excusedCount,
    };
  }

  public async submitDailyAttendance(
    input: AttendanceSubmissionInput,
    actor: StaffUser
  ): Promise<AttendanceSession> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access. Principal cannot mark or edit classroom attendance.');
    }

    const isClassTeacher = actor.assignedClassId === input.classId || 
      (actor.role === 'class_teacher' && actor.assignedClasses?.includes(input.classId));
    if (!isClassTeacher) {
      throw new Error(`Unauthorized: Only the assigned Class Teacher can mark attendance for class ${input.classId}.`);
    }

    const store = this.loadStore();
    const cls = store.classes.find(c => c.id === input.classId);

    const recs = input.records || (input as any).entries || [];
    const presentCount = recs.filter((r: any) => r.state === 'present').length;
    const absentCount = recs.filter((r: any) => r.state === 'absent').length;
    const lateCount = recs.filter((r: any) => r.state === 'late').length;
    const excusedCount = recs.filter((r: any) => r.state === 'excused').length;

    const session: AttendanceSession = {
      id: `att-${input.classId}-${input.date}`,
      classId: input.classId,
      classLabel: cls ? cls.label : input.classId,
      date: input.date,
      academicYearId: input.academicYearId || 'year-2025-2026',
      takenByStaffId: actor.id,
      takenByStaffName: actor.name,
      markedByStaffId: actor.id,
      takenAt: new Date().toISOString(),
      windowStart: '07:45',
      windowEnd: '09:15',
      isWindowOpen: true,
      status: 'submitted',
      totalStudents: recs.length,
      presentCount,
      absentCount,
      totalPresent: presentCount,
      totalAbsent: absentCount,
      lateCount,
      excusedCount,
      records: recs.map((r: any) => {
        const student = store.students.find(s => s.id === r.studentId);
        return {
          studentId: r.studentId,
          studentName: student ? student.fullName : r.studentId,
          rollNumber: student ? student.rollNumber : 0,
          state: r.state,
          remarks: r.remarks,
        };
      }),
    };

    const idx = store.attendanceSessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      store.attendanceSessions[idx] = session;
    } else {
      store.attendanceSessions.push(session);
    }

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'attendance_submitted',
      resource: 'attendanceSessions',
      targetId: session.id,
      summary: `Submitted attendance register for ${session.classLabel} on ${session.date} (${presentCount} Present, ${absentCount} Absent, ${lateCount} Late)`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return session;
  }

  public async getAttendanceCorrections(classId?: string): Promise<AttendanceCorrection[]> {
    const store = this.loadStore();
    if (classId) {
      return store.attendanceCorrections.filter(c => c.classId === classId);
    }
    return store.attendanceCorrections;
  }

  public async requestAttendanceCorrection(
    input: AttendanceCorrectionInput,
    actor: StaffUser
  ): Promise<AttendanceCorrection> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal cannot request attendance corrections.');
    }

    const store = this.loadStore();
    const session = store.attendanceSessions.find(s => s.id === input.sessionId);
    const student = store.students.find(s => s.id === input.studentId);
    const classId = session ? session.classId : 'class-10-a';

    const isClassTeacher = actor.assignedClassId === classId || 
      (actor.role === 'class_teacher' && actor.assignedClasses?.includes(classId));
    if (!isClassTeacher) {
      throw new Error('Unauthorized: Only the assigned Class Teacher can request attendance corrections.');
    }

    const correction: AttendanceCorrection = {
      id: `corr-${Date.now()}`,
      sessionId: input.sessionId,
      classId,
      classLabel: session ? session.classLabel : 'Class 10-A',
      date: session ? session.date : new Date().toISOString().split('T')[0],
      studentId: input.studentId,
      studentName: student ? student.fullName : input.studentId,
      previousState: input.previousState,
      requestedState: input.requestedState,
      mandatoryReason: input.mandatoryReason,
      requestedByStaffId: actor.id,
      requestedByStaffName: actor.name,
      requestedAt: new Date().toISOString(),
      status: 'pending_principal',
    };

    store.attendanceCorrections.unshift(correction);

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'attendance_corrected',
      resource: 'attendanceCorrections',
      targetId: correction.id,
      summary: `Requested attendance correction for ${correction.studentName} (${input.previousState} -> ${input.requestedState}): ${input.mandatoryReason}`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return correction;
  }

  public async approveAttendanceCorrection(
    correctionId: string,
    actor: StaffUser,
    approved: boolean,
    remarks?: string
  ): Promise<void> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal cannot approve attendance corrections in this pilot.');
    }
    const store = this.loadStore();
    const corr = store.attendanceCorrections.find(c => c.id === correctionId);
    if (!corr) return;

    corr.status = approved ? 'approved' : 'rejected';
    corr.reviewedByStaffId = actor.id;
    corr.reviewedByStaffName = actor.name;
    corr.reviewedAt = new Date().toISOString();
    corr.reviewRemarks = remarks;

    if (approved) {
      const session = store.attendanceSessions.find(s => s.id === corr.sessionId);
      if (session) {
        const rec = session.records.find(r => r.studentId === corr.studentId);
        if (rec) {
          rec.state = corr.requestedState;
        }
      }
    }

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'attendance_corrected',
      resource: 'attendanceCorrections',
      targetId: correctionId,
      summary: `${approved ? 'Approved' : 'Rejected'} attendance correction for ${corr.studentName} (${corr.previousState} -> ${corr.requestedState})`,
      details: { remarks },
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
  }

  // Assessment Cycles & Marks Entry
  public async getAssessmentCycles(yearId?: string): Promise<AssessmentCycle[]> {
    const store = this.loadStore();
    if (yearId) {
      return store.assessments.filter(a => a.academicYearId === yearId);
    }
    return store.assessments;
  }

  public async getAssessmentCycleById(cycleId: string): Promise<AssessmentCycle | null> {
    const found = this.loadStore().assessments.find(a => a.id === cycleId);
    return found || null;
  }

  public async createAssessmentCycle(
    cycle: Partial<AssessmentCycle>,
    actor: StaffUser
  ): Promise<AssessmentCycle> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    const newCycle: AssessmentCycle = {
      id: `assess-${Date.now()}`,
      type: cycle.type || 'unit_test_1',
      title: cycle.title || 'New Assessment',
      academicYearId: 'year-2025-2026',
      startDate: cycle.startDate || new Date().toISOString().split('T')[0],
      endDate: cycle.endDate || new Date().toISOString().split('T')[0],
      maxMarks: cycle.maxMarks || 25,
      passingMarks: cycle.passingMarks || 9,
      weightagePercent: cycle.weightagePercent || 10,
      status: cycle.status || 'scheduled',
    };

    store.assessments.push(newCycle);

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'policy_updated',
      resource: 'assessments',
      targetId: newCycle.id,
      summary: `Configured assessment cycle: ${newCycle.title} (Max Marks: ${newCycle.maxMarks})`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return newCycle;
  }

  public async updateAssessmentCycle(
    cycleId: string,
    updates: Partial<AssessmentCycle>,
    actor: StaffUser
  ): Promise<AssessmentCycle> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access in this pilot.');
    }
    const store = this.loadStore();
    const idx = store.assessments.findIndex(a => a.id === cycleId);
    if (idx === -1) throw new Error('Assessment cycle not found');

    store.assessments[idx] = { ...store.assessments[idx], ...updates };

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'policy_updated',
      resource: 'assessments',
      targetId: cycleId,
      summary: `Updated parameters for assessment cycle: ${store.assessments[idx].title}`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return store.assessments[idx];
  }

  public async getMarksRegister(
    assessmentId: string,
    classId: string,
    subjectId: string
  ): Promise<MarksRegister | null> {
    const store = this.loadStore();
    const existing = store.marksRegisters.find(
      r => r.assessmentId === assessmentId && r.classId === classId && r.subjectId === subjectId
    );
    if (existing) return existing;

    // Generate draft register from enrolled class students
    const assessment = store.assessments.find(a => a.id === assessmentId);
    const targetClass = store.classes.find(c => c.id === classId);
    const subject = store.subjects.find(s => s.id === subjectId);
    const students = store.students.filter(s => s.classId === classId);

    if (!assessment || !targetClass || !subject) return null;

    const assignment = store.subjectAssignments.find(
      a => a.classId === classId && a.subjectId === subjectId
    );

    return {
      id: `reg-${assessmentId}-${classId}-${subjectId}`,
      assessmentId,
      assessmentTitle: assessment.title,
      classId,
      classLabel: targetClass.label,
      subjectId,
      subjectName: subject.name,
      maxMarks: assessment.maxMarks,
      passingMarks: assessment.passingMarks,
      teacherId: assignment ? assignment.teacherId : 'staff-003',
      teacherName: assignment ? assignment.teacherName : 'Shri Alok Saxena',
      status: 'draft',
      lastSavedAt: new Date().toISOString(),
      entries: students.map(s => ({
        studentId: s.id,
        studentName: s.fullName,
        rollNumber: s.rollNumber,
        marksObtained: null,
        isAbsent: false,
      })),
    };
  }

  public async saveMarksRegister(
    input: MarksSubmissionInput,
    actor: StaffUser
  ): Promise<MarksRegister> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access. Principal cannot enter or edit marks.');
    }

    const store = this.loadStore();
    const assessment = store.assessments.find(a => a.id === input.assessmentId);
    const targetClass = store.classes.find(c => c.id === input.classId);
    const subject = store.subjects.find(s => s.id === input.subjectId);

    const isAssignedSubjectTeacher = store.subjectAssignments.some(
      a => a.teacherId === actor.id && a.classId === input.classId && a.subjectId === input.subjectId
    ) || (
      actor.assignedClasses?.includes(input.classId) &&
      actor.assignedSubjects?.includes(input.subjectId)
    );

    if (!isAssignedSubjectTeacher) {
      throw new Error(`Unauthorized: Marks entry permitted only for assigned subject teachers of ${input.classId} (${input.subjectId}).`);
    }

    const maxMarks = assessment ? assessment.maxMarks : 100;

    // Validate marks against maxMarks and prevent negative numbers
    for (const entry of input.entries) {
      if (entry.marksObtained !== null && entry.marksObtained !== undefined) {
        if (entry.marksObtained < 0) {
          throw new Error(`Invalid mark ${entry.marksObtained}: Marks cannot be negative.`);
        }
        if (entry.marksObtained > maxMarks) {
          throw new Error(`Invalid mark ${entry.marksObtained}: Marks exceeds maximum permitted (${maxMarks}).`);
        }
      }
    }

    const register: MarksRegister = {
      id: `reg-${input.assessmentId}-${input.classId}-${input.subjectId}`,
      assessmentId: input.assessmentId,
      assessmentTitle: assessment ? assessment.title : 'Assessment',
      classId: input.classId,
      classLabel: targetClass ? targetClass.label : input.classId,
      subjectId: input.subjectId,
      subjectName: subject ? subject.name : input.subjectId,
      maxMarks,
      passingMarks: assessment ? assessment.passingMarks : 33,
      teacherId: actor.id,
      teacherName: actor.name,
      status: input.isDraft ? 'draft' : 'submitted',
      lastSavedAt: new Date().toISOString(),
      submittedAt: input.isDraft ? undefined : new Date().toISOString(),
      entries: input.entries.map(e => {
        const student = store.students.find(s => s.id === e.studentId);
        const marks = e.marksObtained;
        let grade: string | undefined;
        let percentage: number | undefined;

        if (!e.isAbsent) {
          const gradeRes = calculateGrade(marks, maxMarks);
          percentage = gradeRes.percentage !== null ? gradeRes.percentage : undefined;
          grade = gradeRes.grade;
        }

        return {
          studentId: e.studentId,
          studentName: student ? student.fullName : e.studentId,
          rollNumber: student ? student.rollNumber : 0,
          marksObtained: e.isAbsent ? null : marks,
          isAbsent: e.isAbsent,
          remarks: e.remarks,
          percentage,
          grade,
        };
      }),
    };

    const idx = store.marksRegisters.findIndex(r => r.id === register.id);
    if (idx >= 0) {
      store.marksRegisters[idx] = register;
    } else {
      store.marksRegisters.push(register);
    }

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: input.isDraft ? 'marks_saved' : 'marks_submitted',
      resource: 'marksRegisters',
      targetId: register.id,
      summary: `${input.isDraft ? 'Saved draft' : 'Submitted final'} marks for ${register.classLabel} ${register.subjectName} (${register.assessmentTitle})`,
      clientIp: '192.168.1.1',
    });

    this.userSavedRegisterIds.add(register.id);
    this.saveStore(store);
    return register;
  }

  public async getStudentMarksRegisters(studentId: string): Promise<MarksRegister[]> {
    const store = this.loadStore();
    const cleanId = studentId.toLowerCase().trim();
    return store.marksRegisters.filter(reg =>
      reg.entries.some(e => e.studentId.toLowerCase().trim() === cleanId)
    );
  }

  public async getConsolidatedClassMarks(
    classId: string,
    assessmentId: string = 'assess-ut1-2025'
  ): Promise<ConsolidatedClassMarks> {
    const store = this.loadStore();
    const targetClass = store.classes.find(c => c.id === classId) || store.classes[0];
    const assessment = store.assessments.find(a => a.id === assessmentId) || store.assessments[0];
    const students = store.students.filter(s => s.classId === classId);
    const subjects = store.subjects.filter(s => s.gradeLevel === targetClass.grade);

    // Matrix: studentId -> subjectId -> entry
    const matrix: Record<string, Record<string, any>> = {};
    const subjectSums: Record<string, { total: number; count: number }> = {};

    subjects.forEach(sub => {
      subjectSums[sub.id] = { total: 0, count: 0 };
    });

    students.forEach(st => {
      matrix[st.id] = {};
    });

    // Populate from registers
    subjects.forEach(sub => {
      const reg = store.marksRegisters.find(
        r => r.assessmentId === assessment.id && r.classId === classId && r.subjectId === sub.id
      );
      if (reg) {
        reg.entries.forEach(entry => {
          if (matrix[entry.studentId]) {
            matrix[entry.studentId][sub.id] = entry;
            if (entry.marksObtained !== null && !entry.isAbsent) {
              subjectSums[sub.id].total += entry.marksObtained;
              subjectSums[sub.id].count += 1;
            }
          }
        });
      }
    });

    const subjectAverages: Record<string, number> = {};
    subjects.forEach(sub => {
      const data = subjectSums[sub.id];
      subjectAverages[sub.id] = data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0;
    });

    return {
      classSection: targetClass,
      assessmentCycle: assessment,
      subjects,
      students,
      matrix,
      subjectAverages,
    };
  }

  // Behaviour & Observations
  public async getIncidents(filter: IncidentFilter = {}): Promise<IncidentRecord[]> {
    const store = this.loadStore();
    let res = [...store.incidents];
    if (filter.studentId) {
      const q = filter.studentId.toLowerCase();
      res = res.filter(i => i.studentId === filter.studentId || i.studentId.toLowerCase() === q);
    }
    if (filter.classId) res = res.filter(i => i.classId === filter.classId);
    if (filter.category) res = res.filter(i => i.category === filter.category);
    if (filter.severity) res = res.filter(i => i.severity === filter.severity);
    return res;
  }

  public async createIncident(input: NewIncidentInput, actor: StaffUser): Promise<IncidentRecord> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access. Principal cannot create student notes in this pilot.');
    }

    const store = this.loadStore();
    const student = store.students.find(
      s => s.id === input.studentId || s.id.toLowerCase() === input.studentId.toLowerCase()
    );
    if (!student) throw new Error('Student not found.');

    const isAssigned = (actor.assignedClassId === student.classId) || 
      (actor.assignedClasses && actor.assignedClasses.includes(student.classId));
    if (!isAssigned) {
      throw new Error('Unauthorized: Teachers can only add notes for students in their assigned classes.');
    }

    const incident: IncidentRecord = {
      id: `inc-${Date.now()}`,
      studentId: input.studentId,
      studentName: student ? student.fullName : input.studentId,
      classId: student ? student.classId : 'class-10-a',
      classLabel: student ? student.classLabel : 'Class 10-A',
      date: new Date().toISOString().split('T')[0],
      category: input.category,
      severity: input.severity,
      title: input.title,
      description: input.description,
      actionTaken: input.actionTaken,
      loggedByStaffId: actor.id,
      loggedByStaffName: actor.name,
      loggedByStaffRole: actor.role,
      createdAt: new Date().toISOString(),
      parentNotified: false,
    };

    store.incidents.unshift(incident);

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'incident_recorded',
      resource: 'incidents',
      targetId: incident.id,
      summary: `Logged pastoral observation for ${incident.studentName} [${incident.category}]: ${incident.title}`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return incident;
  }

  public async updateIncident(
    incidentId: string,
    updates: Partial<IncidentRecord>,
    actor: StaffUser
  ): Promise<IncidentRecord> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access. Principal cannot edit student notes in this pilot.');
    }
    const store = this.loadStore();
    const idx = store.incidents.findIndex(i => i.id === incidentId);
    if (idx === -1) throw new Error('Incident not found');

    store.incidents[idx] = { ...store.incidents[idx], ...updates };

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'incident_recorded',
      resource: 'incidents',
      targetId: incidentId,
      summary: `Updated observation notes for ${store.incidents[idx].studentName}`,
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return store.incidents[idx];
  }

  // Risk Watchlist
  public async getRiskWatchlist(classId?: string): Promise<RiskWatchlistItem[]> {
    const store = this.loadStore();
    const watchlist: RiskWatchlistItem[] = [];

    store.students.forEach(s => {
      if (classId && s.classId !== classId) return;
      if (s.activeFlags && s.activeFlags.length > 0) {
        const flag0 = s.activeFlags[0];
        const primaryTrigger = flag0.title;
        let consecutiveAbsences = 0;
        let academicDropPercent = 0;

        if (flag0.code === 'ATT-01') consecutiveAbsences = 3;
        if (flag0.code === 'ACAD-04') academicDropPercent = 28;

        watchlist.push({
          student: s,
          primaryTrigger,
          consecutiveAbsences,
          attendanceRate: s.attendancePercentage,
          academicDropPercent,
          flagCount: s.activeFlags.length,
          mentorAssigned: s.classId === 'class-10-a' ? 'Shri Rajeshwar Choudhary' : 'Assigned Class Tutor',
          followUpStatus: flag0.code === 'ATT-01' ? 'pending' : 'in_progress',
        });
      }
    });

    return watchlist;
  }

  // Student Follow-up & Interventions
  public async getStudentFollowUps(studentId: string): Promise<StudentFollowUpRecord[]> {
    const store = this.loadStore();
    const list = store.followUps || [];
    return list.filter(f => f.studentId === studentId);
  }

  public async recordStudentFollowUp(input: FollowUpActionInput, actor: StaffUser): Promise<StudentFollowUpRecord> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal has strictly read-only access and cannot record student follow-up actions.');
    }

    const store = this.loadStore();
    const student = store.students.find(s => s.id === input.studentId);
    if (!student) throw new Error('Student record not found.');

    const isClassTeacher = actor.assignedClassId === student.classId ||
      (actor.role === 'class_teacher' && actor.assignedClasses?.includes(student.classId));
    const isSubjectTeacher = actor.role === 'subject_teacher' && actor.assignedClasses?.includes(student.classId);

    if (!isClassTeacher && !isSubjectTeacher) {
      throw new Error('Unauthorized: You are not assigned to record follow-up for this student.');
    }

    if (!store.followUps) store.followUps = [];

    const record: StudentFollowUpRecord = {
      id: `fu-${Date.now()}`,
      studentId: input.studentId,
      actionType: input.actionType,
      actionLabel: input.actionLabel,
      note: input.note,
      followUpDate: input.followUpDate,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      createdAt: new Date().toISOString(),
    };

    store.followUps.unshift(record);

    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'followup_recorded',
      resource: 'students',
      targetId: input.studentId,
      summary: `Recorded follow-up for ${student.fullName}: ${input.actionLabel}${input.note ? ` — ${input.note}` : ''}`,
      details: { input },
      clientIp: '192.168.1.1',
    });

    this.saveStore(store);
    return record;
  }

  // Audit Events
  public async getAuditEvents(filter: AuditFilter = {}): Promise<AuditEvent[]> {
    const store = this.loadStore();
    let res = [...store.auditEvents];
    if (filter.action) res = res.filter(a => a.action === filter.action);
    if (filter.actorId) res = res.filter(a => a.actorId === filter.actorId);
    if (filter.resource) res = res.filter(a => a.resource === filter.resource);
    if (filter.limit) res = res.slice(0, filter.limit);
    return res;
  }

  // Reset to original deterministic seed data
  public async resetDemoData(): Promise<void> {
    this.userSavedRegisterIds.clear();
    this.storeCache = null;
    cachedBaselineStudents = null;
    cachedBaselineMarks = null;
    cachedBaselineAttendance = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('hanujai_demo_user_id');
    const fresh = getInitialStore();
    this.storeCache = fresh;
    this.saveStore(fresh);
  }
}

export const demoRepository = new DemoRepository();
