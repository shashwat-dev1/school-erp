/**
 * HanuJai High School ERP — Cloud Firestore Repository
 * Implements the DataProvider interface using Cloud Firestore collections and transactions.
 * Strict boundary: Requires active Firebase configuration; never silently falls back to demo data.
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
  IncidentRecord,
  IncidentFilter,
  AuditEvent,
  AuditFilter,
} from '../../domain/types';

import { db, isFirebaseConfigured } from '../../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';

function ensureFirebaseReady() {
  if (!db || !isFirebaseConfigured()) {
    throw new Error(
      '[FirestoreRepository] Cloud Firestore is not configured or unavailable. Check your .env.local configuration.'
    );
  }
}

export class FirestoreRepository implements DataProvider {
  public async getSchoolSettings(): Promise<SchoolSettings> {
    ensureFirebaseReady();
    const docRef = doc(db!, 'schoolSettings', 'hhs-settings-jaipur');
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('School settings document not found in Firestore.');
    }
    return snap.data() as SchoolSettings;
  }

  public async getActiveAcademicYear(): Promise<AcademicYear> {
    ensureFirebaseReady();
    const q = query(collection(db!, 'academicYears'), where('isCurrent', '==', true), firestoreLimit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error('No active academic year found in Firestore.');
    }
    return snap.docs[0].data() as AcademicYear;
  }

  public async getStaffMembers(): Promise<StaffUser[]> {
    ensureFirebaseReady();
    const snap = await getDocs(collection(db!, 'staff'));
    return snap.docs.map(d => d.data() as StaffUser);
  }

  public async getCurrentStaffUser(userId: string): Promise<StaffUser | null> {
    ensureFirebaseReady();
    const docRef = doc(db!, 'staff', userId);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as StaffUser) : null;
  }

  public async getClasses(yearId?: string): Promise<ClassSection[]> {
    ensureFirebaseReady();
    const coll = collection(db!, 'classes');
    const q = yearId ? query(coll, where('academicYearId', '==', yearId)) : coll;
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ClassSection);
  }

  public async getClassById(classId: string): Promise<ClassSection | null> {
    ensureFirebaseReady();
    const docRef = doc(db!, 'classes', classId);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as ClassSection) : null;
  }

  public async getClassStudents(classId: string): Promise<StudentRecord[]> {
    ensureFirebaseReady();
    const q = query(
      collection(db!, 'students'),
      where('classId', '==', classId),
      orderBy('rollNumber', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as StudentRecord);
  }

  public async getSubjects(): Promise<Subject[]> {
    ensureFirebaseReady();
    const snap = await getDocs(collection(db!, 'subjects'));
    return snap.docs.map(d => d.data() as Subject);
  }

  public async getSubjectAssignments(teacherId?: string): Promise<SubjectAssignment[]> {
    ensureFirebaseReady();
    const coll = collection(db!, 'subjectAssignments');
    const q = teacherId ? query(coll, where('teacherId', '==', teacherId)) : coll;
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as SubjectAssignment);
  }

  public async getStudents(filter: StudentFilter = {}): Promise<PaginatedResult<StudentRecord>> {
    ensureFirebaseReady();
    let q = query(collection(db!, 'students'), orderBy('fullName', 'asc'));
    if (filter.classId) {
      q = query(collection(db!, 'students'), where('classId', '==', filter.classId));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => d.data() as StudentRecord);
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: 1,
    };
  }

  public async getStudentById(studentId: string): Promise<StudentRecord | null> {
    ensureFirebaseReady();
    const docRef = doc(db!, 'students', studentId);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as StudentRecord) : null;
  }

  public async createStudent(input: NewStudentInput, actor: StaffUser): Promise<StudentRecord> {
    ensureFirebaseReady();
    const studentId = `STU-${Date.now()}`;
    const newRecord: StudentRecord = {
      id: studentId,
      admissionNumber: input.admissionNumber,
      rollNumber: input.rollNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: `${input.firstName} ${input.lastName}`,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      enrollmentDate: input.enrollmentDate,
      classId: input.classId,
      classLabel: input.classId,
      academicYearId: 'year-2025-2026',
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

    await setDoc(doc(db!, 'students', studentId), newRecord);

    // Audit Event
    await addDoc(collection(db!, 'auditEvents'), {
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'student_created',
      resource: 'students',
      targetId: studentId,
      summary: `Enrolled new student: ${newRecord.fullName}`,
    });

    return newRecord;
  }

  public async updateStudent(
    studentId: string,
    updates: Partial<StudentRecord>,
    actor: StaffUser,
    reason: string
  ): Promise<StudentRecord> {
    ensureFirebaseReady();
    const docRef = doc(db!, 'students', studentId);
    await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
    const snap = await getDoc(docRef);

    // Audit Event
    await addDoc(collection(db!, 'auditEvents'), {
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'student_updated',
      resource: 'students',
      targetId: studentId,
      summary: `Updated student ${studentId}: ${reason}`,
    });

    return snap.data() as StudentRecord;
  }

  public async getAttendanceSession(classId: string, date: string): Promise<AttendanceSession | null> {
    ensureFirebaseReady();
    const sessionId = `att-${classId}-${date}`;
    const snap = await getDoc(doc(db!, 'attendanceSessions', sessionId));
    return snap.exists() ? (snap.data() as AttendanceSession) : null;
  }

  public async submitDailyAttendance(
    input: AttendanceSubmissionInput,
    actor: StaffUser
  ): Promise<AttendanceSession> {
    ensureFirebaseReady();
    const sessionId = `att-${input.classId}-${input.date}`;
    const records = input.records.map(r => ({
      studentId: r.studentId,
      studentName: r.studentId,
      rollNumber: 0,
      state: r.state,
      remarks: r.remarks,
    }));

    const session: AttendanceSession = {
      id: sessionId,
      classId: input.classId,
      classLabel: input.classId,
      date: input.date,
      academicYearId: input.academicYearId,
      takenByStaffId: actor.id,
      takenByStaffName: actor.name,
      takenAt: new Date().toISOString(),
      windowStart: '07:45',
      windowEnd: '09:15',
      isWindowOpen: true,
      status: 'submitted',
      totalStudents: records.length,
      presentCount: records.filter(r => r.state === 'present').length,
      absentCount: records.filter(r => r.state === 'absent').length,
      lateCount: records.filter(r => r.state === 'late').length,
      excusedCount: records.filter(r => r.state === 'excused').length,
      records,
    };

    await setDoc(doc(db!, 'attendanceSessions', sessionId), session);
    return session;
  }

  public async getAttendanceCorrections(classId?: string): Promise<AttendanceCorrection[]> {
    ensureFirebaseReady();
    const coll = collection(db!, 'attendanceCorrections');
    const q = classId ? query(coll, where('classId', '==', classId)) : coll;
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AttendanceCorrection);
  }

  public async requestAttendanceCorrection(
    input: AttendanceCorrectionInput,
    actor: StaffUser
  ): Promise<AttendanceCorrection> {
    ensureFirebaseReady();
    const corrId = `corr-${Date.now()}`;
    const corr: AttendanceCorrection = {
      id: corrId,
      sessionId: input.sessionId,
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      date: new Date().toISOString().split('T')[0],
      studentId: input.studentId,
      studentName: input.studentId,
      previousState: input.previousState,
      requestedState: input.requestedState,
      mandatoryReason: input.mandatoryReason,
      requestedByStaffId: actor.id,
      requestedByStaffName: actor.name,
      requestedAt: new Date().toISOString(),
      status: 'pending_principal',
    };
    await setDoc(doc(db!, 'attendanceCorrections', corrId), corr);
    return corr;
  }

  public async approveAttendanceCorrection(
    correctionId: string,
    actor: StaffUser,
    approved: boolean,
    remarks?: string
  ): Promise<void> {
    ensureFirebaseReady();
    const docRef = doc(db!, 'attendanceCorrections', correctionId);
    await updateDoc(docRef, {
      status: approved ? 'approved' : 'rejected',
      reviewedByStaffId: actor.id,
      reviewedByStaffName: actor.name,
      reviewedAt: new Date().toISOString(),
      reviewRemarks: remarks,
    });
  }

  public async getAssessmentCycles(yearId?: string): Promise<AssessmentCycle[]> {
    ensureFirebaseReady();
    const coll = collection(db!, 'assessments');
    const q = yearId ? query(coll, where('academicYearId', '==', yearId)) : coll;
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AssessmentCycle);
  }

  public async getMarksRegister(
    assessmentId: string,
    classId: string,
    subjectId: string
  ): Promise<MarksRegister | null> {
    ensureFirebaseReady();
    const regId = `reg-${assessmentId}-${classId}-${subjectId}`;
    const snap = await getDoc(doc(db!, 'marksRegisters', regId));
    return snap.exists() ? (snap.data() as MarksRegister) : null;
  }

  public async saveMarksRegister(
    input: MarksSubmissionInput,
    actor: StaffUser
  ): Promise<MarksRegister> {
    ensureFirebaseReady();
    const regId = `reg-${input.assessmentId}-${input.classId}-${input.subjectId}`;
    const register: MarksRegister = {
      id: regId,
      assessmentId: input.assessmentId,
      assessmentTitle: input.assessmentId,
      classId: input.classId,
      classLabel: input.classId,
      subjectId: input.subjectId,
      subjectName: input.subjectId,
      maxMarks: 100,
      passingMarks: 33,
      teacherId: actor.id,
      teacherName: actor.name,
      status: input.isDraft ? 'draft' : 'submitted',
      lastSavedAt: new Date().toISOString(),
      entries: input.entries.map(e => ({
        studentId: e.studentId,
        studentName: e.studentId,
        rollNumber: 0,
        marksObtained: e.marksObtained,
        isAbsent: e.isAbsent,
        remarks: e.remarks,
      })),
    };
    await setDoc(doc(db!, 'marksRegisters', regId), register);
    return register;
  }

  public async getIncidents(filter: IncidentFilter = {}): Promise<IncidentRecord[]> {
    ensureFirebaseReady();
    const coll = collection(db!, 'incidents');
    const snap = await getDocs(coll);
    let items = snap.docs.map(d => d.data() as IncidentRecord);
    if (filter.studentId) items = items.filter(i => i.studentId === filter.studentId);
    if (filter.classId) items = items.filter(i => i.classId === filter.classId);
    return items;
  }

  public async createIncident(input: NewIncidentInput, actor: StaffUser): Promise<IncidentRecord> {
    ensureFirebaseReady();
    const incidentId = `inc-${Date.now()}`;
    const inc: IncidentRecord = {
      id: incidentId,
      studentId: input.studentId,
      studentName: input.studentId,
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
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
    await setDoc(doc(db!, 'incidents', incidentId), inc);
    return inc;
  }

  public async getAuditEvents(filter: AuditFilter = {}): Promise<AuditEvent[]> {
    ensureFirebaseReady();
    const q = query(
      collection(db!, 'auditEvents'),
      orderBy('timestamp', 'desc'),
      firestoreLimit(filter.limit || 50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AuditEvent);
  }

  public async updateSchoolSettings(settings: Partial<SchoolSettings>, _actor: StaffUser): Promise<SchoolSettings> {
    ensureFirebaseReady();
    const ref = doc(db!, 'schoolSettings', 'hhs-settings-jaipur');
    await updateDoc(ref, settings);
    const snap = await getDoc(ref);
    return snap.data() as SchoolSettings;
  }

  public async updateAttendancePolicy(policy: Partial<AttendancePolicy>, _actor: StaffUser): Promise<AttendancePolicy> {
    ensureFirebaseReady();
    const ref = doc(db!, 'schoolSettings', 'hhs-settings-jaipur');
    await updateDoc(ref, { attendancePolicy: policy });
    const snap = await getDoc(ref);
    return (snap.data() as SchoolSettings).attendancePolicy;
  }

  public async getAcademicYears(): Promise<AcademicYear[]> {
    ensureFirebaseReady();
    const snap = await getDocs(collection(db!, 'academicYears'));
    return snap.docs.map(d => d.data() as AcademicYear);
  }

  public async updateAcademicYear(yearId: string, updates: Partial<AcademicYear>, _actor: StaffUser): Promise<AcademicYear> {
    ensureFirebaseReady();
    const ref = doc(db!, 'academicYears', yearId);
    await updateDoc(ref, updates);
    const snap = await getDoc(ref);
    return snap.data() as AcademicYear;
  }

  public async getStaffMemberById(staffId: string): Promise<StaffUser | null> {
    ensureFirebaseReady();
    const snap = await getDoc(doc(db!, 'staff', staffId));
    return snap.exists() ? (snap.data() as StaffUser) : null;
  }

  public async createStaffMember(input: Partial<StaffUser>, _actor: StaffUser): Promise<StaffUser> {
    ensureFirebaseReady();
    const id = `staff-${Date.now()}`;
    const staff = { id, ...input } as StaffUser;
    await setDoc(doc(db!, 'staff', id), staff);
    return staff;
  }

  public async updateStaffMember(staffId: string, updates: Partial<StaffUser>, _actor: StaffUser): Promise<StaffUser> {
    ensureFirebaseReady();
    const ref = doc(db!, 'staff', staffId);
    await updateDoc(ref, updates);
    const snap = await getDoc(ref);
    return snap.data() as StaffUser;
  }

  public async updateClassTeacher(classId: string, teacherId: string, teacherName: string, _actor: StaffUser): Promise<ClassSection> {
    ensureFirebaseReady();
    const ref = doc(db!, 'classes', classId);
    await updateDoc(ref, { classTeacherId: teacherId, classTeacherName: teacherName });
    const snap = await getDoc(ref);
    return snap.data() as ClassSection;
  }

  public async createSubject(subject: Partial<Subject>, _actor: StaffUser): Promise<Subject> {
    ensureFirebaseReady();
    const id = `sub-${Date.now()}`;
    const sub = { id, ...subject } as Subject;
    await setDoc(doc(db!, 'subjects', id), sub);
    return sub;
  }

  public async assignSubjectTeacher(assignment: Partial<SubjectAssignment>, _actor: StaffUser): Promise<SubjectAssignment> {
    ensureFirebaseReady();
    const id = `assign-${Date.now()}`;
    const assign = { id, ...assignment } as SubjectAssignment;
    await setDoc(doc(db!, 'subjectAssignments', id), assign);
    return assign;
  }

  public async getStudentAuditHistory(studentId: string): Promise<AuditEvent[]> {
    ensureFirebaseReady();
    const q = query(
      collection(db!, 'auditEvents'),
      where('targetId', '==', studentId),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AuditEvent);
  }

  public async getAttendanceSessions(date?: string): Promise<AttendanceSession[]> {
    ensureFirebaseReady();
    const targetDate = date || new Date().toISOString().split('T')[0];
    const q = query(collection(db!, 'attendanceSessions'), where('date', '==', targetDate));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AttendanceSession);
  }

  public async getAssessmentCycleById(cycleId: string): Promise<AssessmentCycle | null> {
    ensureFirebaseReady();
    const snap = await getDoc(doc(db!, 'assessments', cycleId));
    return snap.exists() ? (snap.data() as AssessmentCycle) : null;
  }

  public async createAssessmentCycle(cycle: Partial<AssessmentCycle>, _actor: StaffUser): Promise<AssessmentCycle> {
    ensureFirebaseReady();
    const id = `assess-${Date.now()}`;
    const c = { id, ...cycle } as AssessmentCycle;
    await setDoc(doc(db!, 'assessments', id), c);
    return c;
  }

  public async updateAssessmentCycle(cycleId: string, updates: Partial<AssessmentCycle>, _actor: StaffUser): Promise<AssessmentCycle> {
    ensureFirebaseReady();
    const ref = doc(db!, 'assessments', cycleId);
    await updateDoc(ref, updates);
    const snap = await getDoc(ref);
    return snap.data() as AssessmentCycle;
  }

  public async getConsolidatedClassMarks(classId: string, assessmentId: string = 'assess-ut1-2025'): Promise<any> {
    ensureFirebaseReady();
    const cls = await this.getClassById(classId);
    const students = await this.getClassStudents(classId);
    const subjects = await this.getSubjects();
    const assessment = await this.getAssessmentCycleById(assessmentId);
    return {
      classSection: cls!,
      assessmentCycle: assessment!,
      subjects,
      students,
      matrix: {},
      subjectAverages: {},
    };
  }

  public async updateIncident(incidentId: string, updates: Partial<IncidentRecord>, _actor: StaffUser): Promise<IncidentRecord> {
    ensureFirebaseReady();
    const ref = doc(db!, 'incidents', incidentId);
    await updateDoc(ref, updates);
    const snap = await getDoc(ref);
    return snap.data() as IncidentRecord;
  }

  public async getRiskWatchlist(): Promise<any[]> {
    ensureFirebaseReady();
    const res = await this.getStudents();
    return res.items
      .filter(s => s.activeFlags && s.activeFlags.length > 0)
      .map(s => ({
        student: s,
        primaryTrigger: s.activeFlags[0]?.title || 'Care Alert',
        consecutiveAbsences: 0,
        attendanceRate: s.attendancePercentage,
        academicDropPercent: 0,
        flagCount: s.activeFlags.length,
        followUpStatus: 'pending',
      }));
  }
}

export const firestoreRepository = new FirestoreRepository();
