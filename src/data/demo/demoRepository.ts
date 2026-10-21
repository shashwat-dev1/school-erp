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
} from '../provider';
import type {
  SchoolSettings,
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
  IncidentRecord,
  IncidentFilter,
  AuditEvent,
  AuditFilter,
} from '../../domain/types';

import {
  initialSettings,
  initialAcademicYear,
  initialStaff,
  initialClasses,
  initialSubjects,
  initialSubjectAssignments,
  initialStudents,
  initialAssessments,
  initialAttendanceSessions,
  initialIncidents,
  initialAuditEvents,
} from './seedData';

const STORAGE_KEY = 'hanujai_erp_demo_store_v1';

interface DemoStore {
  settings: SchoolSettings;
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
}

function getInitialStore(): DemoStore {
  return {
    settings: { ...initialSettings },
    academicYear: { ...initialAcademicYear },
    staff: [...initialStaff],
    classes: [...initialClasses],
    subjects: [...initialSubjects],
    subjectAssignments: [...initialSubjectAssignments],
    students: [...initialStudents],
    assessments: [...initialAssessments],
    attendanceSessions: [...initialAttendanceSessions],
    attendanceCorrections: [],
    marksRegisters: [],
    incidents: [...initialIncidents],
    auditEvents: [...initialAuditEvents],
  };
}

class DemoRepository implements DataProvider {
  private loadStore(): DemoStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DemoRepository] Could not parse localStorage, re-initializing seed store.', e);
    }
    const store = getInitialStore();
    this.saveStore(store);
    return store;
  }

  private saveStore(store: DemoStore): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.error('[DemoRepository] Failed to save store to localStorage:', e);
    }
  }

  public async resetDemoData(): Promise<void> {
    const fresh = getInitialStore();
    this.saveStore(fresh);
  }

  // Institutional Identity & Context
  public async getSchoolSettings(): Promise<SchoolSettings> {
    return this.loadStore().settings;
  }

  public async getActiveAcademicYear(): Promise<AcademicYear> {
    return this.loadStore().academicYear;
  }

  public async getStaffMembers(): Promise<StaffUser[]> {
    return this.loadStore().staff;
  }

  public async getCurrentStaffUser(userId: string): Promise<StaffUser | null> {
    const staff = this.loadStore().staff;
    return staff.find(s => s.id === userId || s.email === userId) || null;
  }

  // Classes & Section Roster
  public async getClasses(yearId?: string): Promise<ClassSection[]> {
    const classes = this.loadStore().classes;
    if (yearId) {
      return classes.filter(c => c.academicYearId === yearId);
    }
    return classes;
  }

  public async getClassById(classId: string): Promise<ClassSection | null> {
    const classes = this.loadStore().classes;
    return classes.find(c => c.id === classId) || null;
  }

  public async getClassStudents(classId: string): Promise<StudentRecord[]> {
    const students = this.loadStore().students;
    return students
      .filter(s => s.classId === classId)
      .sort((a, b) => a.rollNumber - b.rollNumber);
  }

  public async getSubjects(): Promise<Subject[]> {
    return this.loadStore().subjects;
  }

  public async getSubjectAssignments(teacherId?: string): Promise<SubjectAssignment[]> {
    const assignments = this.loadStore().subjectAssignments;
    if (teacherId) {
      return assignments.filter(a => a.teacherId === teacherId);
    }
    return assignments;
  }

  // Students Directory & Profiles
  public async getStudents(filter: StudentFilter = {}): Promise<PaginatedResult<StudentRecord>> {
    const store = this.loadStore();
    let result = [...store.students];

    if (filter.classId) {
      result = result.filter(s => s.classId === filter.classId);
    }
    if (filter.status) {
      result = result.filter(s => s.status === filter.status);
    }
    if (filter.flagCode) {
      result = result.filter(s => s.activeFlags.some(f => f.code === filter.flagCode));
    }
    if (filter.query) {
      const q = filter.query.toLowerCase().trim();
      result = result.filter(
        s =>
          s.fullName.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          s.rollNumber.toString() === q
      );
    }

    const page = filter.page || 1;
    const pageSize = filter.pageSize || 10;
    const total = result.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const items = result.slice((page - 1) * pageSize, page * pageSize);

    return { items, total, page, pageSize, totalPages };
  }

  public async getStudentById(studentId: string): Promise<StudentRecord | null> {
    const store = this.loadStore();
    return store.students.find(s => s.id === studentId || s.admissionNumber === studentId) || null;
  }

  public async createStudent(input: NewStudentInput, actor: StaffUser): Promise<StudentRecord> {
    const store = this.loadStore();
    const targetClass = store.classes.find(c => c.id === input.classId);
    
    const newStudent: StudentRecord = {
      id: `STU-GEN-${Date.now().toString().slice(-4)}`,
      admissionNumber: input.admissionNumber,
      rollNumber: input.rollNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: `${input.firstName} ${input.lastName}`,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      enrollmentDate: input.enrollmentDate,
      classId: input.classId,
      classLabel: targetClass ? targetClass.label : input.classId,
      academicYearId: store.academicYear.id,
      status: 'enrolled',
      guardianName: input.guardianName,
      guardianRelation: input.guardianRelation,
      primaryPhone: input.primaryPhone,
      residentialAddress: input.residentialAddress,
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      attendancePercentage: 100.0,
      academicAverage: 0.0,
      activeFlags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.students.push(newStudent);

    // Audit Event
    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'student_created',
      resource: 'students',
      targetId: newStudent.id,
      summary: `Enrolled new student: ${newStudent.fullName} (${newStudent.admissionNumber}) in ${newStudent.classLabel}`,
    });

    this.saveStore(store);
    return newStudent;
  }

  public async updateStudent(
    studentId: string,
    updates: Partial<StudentRecord>,
    actor: StaffUser,
    reason: string
  ): Promise<StudentRecord> {
    const store = this.loadStore();
    const index = store.students.findIndex(s => s.id === studentId);
    if (index === -1) {
      throw new Error(`Student ${studentId} not found.`);
    }

    const previous = { ...store.students[index] };
    const updated = {
      ...previous,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    store.students[index] = updated;

    // Audit Event
    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'student_updated',
      resource: 'students',
      targetId: studentId,
      summary: `Updated student record for ${updated.fullName}: ${reason}`,
      oldValue: previous,
      newValue: updated,
    });

    this.saveStore(store);
    return updated;
  }

  // Attendance Register & Policy
  public async getAttendanceSession(classId: string, date: string): Promise<AttendanceSession | null> {
    const store = this.loadStore();
    return store.attendanceSessions.find(s => s.classId === classId && s.date === date) || null;
  }

  public async submitDailyAttendance(
    input: AttendanceSubmissionInput,
    actor: StaffUser
  ): Promise<AttendanceSession> {
    const store = this.loadStore();
    const students = store.students.filter(s => s.classId === input.classId);
    const targetClass = store.classes.find(c => c.id === input.classId);

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    const records = input.records.map(r => {
      const stu = students.find(s => s.id === r.studentId);
      if (r.state === 'present') present++;
      else if (r.state === 'absent') absent++;
      else if (r.state === 'late') late++;
      else if (r.state === 'excused') excused++;

      return {
        studentId: r.studentId,
        studentName: stu ? stu.fullName : r.studentId,
        rollNumber: stu ? stu.rollNumber : 0,
        state: r.state,
        remarks: r.remarks,
      };
    });

    const newSession: AttendanceSession = {
      id: `att-${input.classId}-${input.date}`,
      classId: input.classId,
      classLabel: targetClass ? targetClass.label : input.classId,
      date: input.date,
      academicYearId: input.academicYearId,
      takenByStaffId: actor.id,
      takenByStaffName: actor.name,
      takenAt: new Date().toISOString(),
      windowStart: store.settings.attendancePolicy.dailyMarkingWindowStart,
      windowEnd: store.settings.attendancePolicy.dailyMarkingWindowEnd,
      isWindowOpen: true,
      status: 'submitted',
      totalStudents: records.length,
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      excusedCount: excused,
      records,
    };

    // Upsert session
    const idx = store.attendanceSessions.findIndex(s => s.id === newSession.id);
    if (idx >= 0) {
      store.attendanceSessions[idx] = newSession;
    } else {
      store.attendanceSessions.push(newSession);
    }

    // Audit Event
    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'attendance_submitted',
      resource: 'attendanceSessions',
      targetId: newSession.id,
      summary: `Submitted attendance for ${newSession.classLabel} (${present} Present, ${absent} Absent)`,
    });

    this.saveStore(store);
    return newSession;
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
    const store = this.loadStore();
    const session = store.attendanceSessions.find(s => s.id === input.sessionId);
    const student = store.students.find(s => s.id === input.studentId);

    const correction: AttendanceCorrection = {
      id: `corr-${Date.now()}`,
      sessionId: input.sessionId,
      classId: session ? session.classId : 'class-10-a',
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
    this.saveStore(store);
    return correction;
  }

  public async approveAttendanceCorrection(
    correctionId: string,
    actor: StaffUser,
    approved: boolean,
    remarks?: string
  ): Promise<void> {
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

    // Generate initial blank register from class students
    const assessment = store.assessments.find(a => a.id === assessmentId);
    const targetClass = store.classes.find(c => c.id === classId);
    const subject = store.subjects.find(s => s.id === subjectId);
    const students = store.students.filter(s => s.classId === classId);

    if (!assessment || !targetClass || !subject) return null;

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
      teacherId: 'staff-004',
      teacherName: 'Shri Alok Saxena',
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
    const store = this.loadStore();
    const assessment = store.assessments.find(a => a.id === input.assessmentId);
    const targetClass = store.classes.find(c => c.id === input.classId);
    const subject = store.subjects.find(s => s.id === input.subjectId);

    const register: MarksRegister = {
      id: `reg-${input.assessmentId}-${input.classId}-${input.subjectId}`,
      assessmentId: input.assessmentId,
      assessmentTitle: assessment ? assessment.title : 'Assessment',
      classId: input.classId,
      classLabel: targetClass ? targetClass.label : input.classId,
      subjectId: input.subjectId,
      subjectName: subject ? subject.name : input.subjectId,
      maxMarks: assessment ? assessment.maxMarks : 100,
      passingMarks: assessment ? assessment.passingMarks : 33,
      teacherId: actor.id,
      teacherName: actor.name,
      status: input.isDraft ? 'draft' : 'submitted',
      lastSavedAt: new Date().toISOString(),
      submittedAt: input.isDraft ? undefined : new Date().toISOString(),
      entries: input.entries.map(e => ({
        studentId: e.studentId,
        studentName: store.students.find(s => s.id === e.studentId)?.fullName || e.studentId,
        rollNumber: store.students.find(s => s.id === e.studentId)?.rollNumber || 0,
        marksObtained: e.marksObtained,
        isAbsent: e.isAbsent,
        remarks: e.remarks,
        percentage:
          e.marksObtained !== null && assessment
            ? Math.round((e.marksObtained / assessment.maxMarks) * 100)
            : undefined,
      })),
    };

    const idx = store.marksRegisters.findIndex(r => r.id === register.id);
    if (idx >= 0) {
      store.marksRegisters[idx] = register;
    } else {
      store.marksRegisters.push(register);
    }

    // Audit Event
    store.auditEvents.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: input.isDraft ? 'marks_saved' : 'marks_submitted',
      resource: 'marksRegisters',
      targetId: register.id,
      summary: `${input.isDraft ? 'Saved draft' : 'Submitted marks'} for ${register.classLabel} ${register.subjectName} (${register.assessmentTitle})`,
    });

    this.saveStore(store);
    return register;
  }

  // Behaviour & Incidents
  public async getIncidents(filter: IncidentFilter = {}): Promise<IncidentRecord[]> {
    const store = this.loadStore();
    let res = [...store.incidents];
    if (filter.studentId) res = res.filter(i => i.studentId === filter.studentId);
    if (filter.classId) res = res.filter(i => i.classId === filter.classId);
    if (filter.category) res = res.filter(i => i.category === filter.category);
    if (filter.severity) res = res.filter(i => i.severity === filter.severity);
    return res;
  }

  public async createIncident(input: NewIncidentInput, actor: StaffUser): Promise<IncidentRecord> {
    const store = this.loadStore();
    const student = store.students.find(s => s.id === input.studentId);

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
    this.saveStore(store);
    return incident;
  }

  // Audit Events
  public async getAuditEvents(filter: AuditFilter = {}): Promise<AuditEvent[]> {
    const store = this.loadStore();
    let res = [...store.auditEvents];
    if (filter.action) res = res.filter(a => a.action === filter.action);
    if (filter.actorId) res = res.filter(a => a.actorId === filter.actorId);
    if (filter.limit) res = res.slice(0, filter.limit);
    return res;
  }
}

export const demoRepository = new DemoRepository();
