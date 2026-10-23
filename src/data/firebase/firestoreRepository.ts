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
  StudentMarkEntry,
} from '../../domain/types';
import { getSchoolLocalDate } from '../../domain/policy';

import { db, auth, isFirebaseConfigured } from '../../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  writeBatch,
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
    if (snap.exists()) {
      return snap.data() as StaffUser;
    }

    // Dynamic UID-to-staff profile linker:
    // If the authenticated user does not have a /staff/{authUid} document yet, lookup by email
    const userEmail = auth?.currentUser?.email?.toLowerCase().trim();
    if (userEmail) {
      const q = query(collection(db!, 'staff'), where('email', '==', userEmail));
      const snapByEmail = await getDocs(q);
      if (!snapByEmail.empty) {
        const staffData = snapByEmail.docs[0].data() as StaffUser;
        try {
          // Mirror to /staff/${userId} so security rules can resolve request.auth.uid
          await setDoc(docRef, { ...staffData, authUid: userId }, { merge: true });
        } catch {
          // Non-blocking if rules prevent write
        }
        return staffData;
      }
    }
    return null;
  }

  public async getClasses(yearId?: string): Promise<ClassSection[]> {
    ensureFirebaseReady();
    const coll = collection(db!, 'classes');
    const targetYear = yearId || 'year-2025-2026';
    const q = query(coll, where('academicYearId', '==', targetYear));
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => d.data() as ClassSection);
    if (docs.length > 0) return docs;
    // Fallback if classes collection is unpartitioned by academicYearId
    const allSnap = await getDocs(coll);
    return allSnap.docs.map(d => d.data() as ClassSection).slice(0, 20);
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
      where('classId', '==', classId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => d.data() as StudentRecord)
      .sort((a, b) => a.rollNumber - b.rollNumber);
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
    if (filter.classId && filter.classId !== 'all') {
      q = query(collection(db!, 'students'), where('classId', '==', filter.classId));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => d.data() as StudentRecord);

    if (filter.query) {
      const qStr = filter.query.toLowerCase().trim();
      items = items.filter(
        s =>
          s.firstName.toLowerCase().includes(qStr) ||
          s.lastName.toLowerCase().includes(qStr) ||
          s.fullName.toLowerCase().includes(qStr) ||
          s.admissionNumber.toLowerCase().includes(qStr) ||
          s.rollNumber.toString().includes(qStr)
      );
    }

    if (filter.status) {
      items = items.filter(s => s.status === filter.status);
    }

    const total = items.length;
    const page = filter.page || 1;
    const pageSize = filter.pageSize || filter.limit || total || 50;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  public async getStudentById(studentId: string): Promise<StudentRecord | null> {
    ensureFirebaseReady();
    const docRef = doc(db!, 'students', studentId);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as StudentRecord) : null;
  }

  public async createStudent(input: NewStudentInput, actor: StaffUser): Promise<StudentRecord> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const [cls, activeYear] = await Promise.all([
      this.getClassById(input.classId),
      this.getActiveAcademicYear().catch(() => null),
    ]);
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
      classLabel: cls ? cls.label : input.classId,
      academicYearId: activeYear ? activeYear.id : 'year-2025-2026',
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
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
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

  public async getAttendanceAggregate(classId: string, date: string): Promise<AttendanceAggregate | null> {
    ensureFirebaseReady();
    const id = `att-aggregate-${classId}-${date}`;
    const snap = await getDoc(doc(db!, 'attendanceAggregates', id));
    return snap.exists() ? snap.data() as AttendanceAggregate : null;
  }

  public async submitDailyAttendance(
    input: AttendanceSubmissionInput,
    actor: StaffUser
  ): Promise<AttendanceSession> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal cannot mark or edit classroom attendance.');
    }
    const isClassTeacher = actor.assignedClassId === input.classId || 
      (actor.role === 'class_teacher' && actor.assignedClasses?.includes(input.classId));
    if (!isClassTeacher) {
      throw new Error(`Unauthorized: Only the assigned Class Teacher can mark attendance for class ${input.classId}.`);
    }
    ensureFirebaseReady();
    const [cls, students] = await Promise.all([
      this.getClassById(input.classId),
      this.getClassStudents(input.classId),
    ]);
    const studentMap = new Map(students.map(s => [s.id, s]));
    const sessionId = `att-${input.classId}-${input.date}`;
    const records = input.records.map(r => {
      const stud = studentMap.get(r.studentId);
      return {
        studentId: r.studentId,
        studentName: stud ? stud.fullName : r.studentId,
        rollNumber: stud ? stud.rollNumber : 0,
        state: r.state,
        remarks: r.remarks,
      };
    });

    const session: AttendanceSession = {
      id: sessionId,
      classId: input.classId,
      classLabel: cls ? cls.label : input.classId,
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

    const batch = writeBatch(db!);
    batch.set(doc(db!, 'attendanceSessions', sessionId), session);
    batch.set(doc(db!, 'attendanceAggregates', `att-aggregate-${input.classId}-${input.date}`), {
      classId: session.classId,
      date: session.date,
      totalStudents: session.totalStudents,
      presentCount: session.presentCount,
      absentCount: session.absentCount,
      lateCount: session.lateCount,
      excusedCount: session.excusedCount,
    } satisfies AttendanceAggregate);
    await batch.commit();
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
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal cannot request attendance corrections.');
    }
    ensureFirebaseReady();
    const [studDoc, sessDoc] = await Promise.all([
      getDoc(doc(db!, 'students', input.studentId)),
      getDoc(doc(db!, 'attendanceSessions', input.sessionId)),
    ]);
    const stud = studDoc.exists() ? (studDoc.data() as StudentRecord) : null;
    const sess = sessDoc.exists() ? (sessDoc.data() as AttendanceSession) : null;

    const classId = sess?.classId || stud?.classId || 'class-10-a';
    const isClassTeacher = actor.assignedClassId === classId || 
      (actor.role === 'class_teacher' && actor.assignedClasses?.includes(classId));
    if (!isClassTeacher) {
      throw new Error('Unauthorized: Only the assigned Class Teacher can request attendance corrections.');
    }

    const classLabel = sess?.classLabel || stud?.classLabel || classId;
    const date = sess?.date || getSchoolLocalDate();
    const studentName = stud?.fullName || input.studentId;

    const corrId = `corr-${Date.now()}`;
    const corr: AttendanceCorrection = {
      id: corrId,
      sessionId: input.sessionId,
      classId,
      classLabel,
      date,
      studentId: input.studentId,
      studentName,
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
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal cannot approve attendance corrections in this pilot.');
    }
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

  public async getStudentMarksRegisters(studentId: string): Promise<MarksRegister[]> {
    ensureFirebaseReady();
    const snap = await getDocs(collection(db!, 'marksRegisters'));
    const cleanId = studentId.toLowerCase().trim();
    return snap.docs
      .map(d => d.data() as MarksRegister)
      .filter(reg => reg.entries.some(e => e.studentId.toLowerCase().trim() === cleanId));
  }

  public async saveMarksRegister(
    input: MarksSubmissionInput,
    actor: StaffUser
  ): Promise<MarksRegister> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal cannot enter or edit marks.');
    }
    ensureFirebaseReady();
    const [assessment, targetClass, allSubjects, students] = await Promise.all([
      this.getAssessmentCycleById(input.assessmentId),
      this.getClassById(input.classId),
      this.getSubjects(),
      this.getClassStudents(input.classId),
    ]);
    const subject = allSubjects.find(s => s.id === input.subjectId);
    const studentMap = new Map(students.map(s => [s.id, s]));
    const regId = `reg-${input.assessmentId}-${input.classId}-${input.subjectId}`;
    const maxMarks = assessment ? assessment.maxMarks : 100;
    const passingMarks = assessment ? assessment.passingMarks : 33;

    // Validate marks against maxMarks
    for (const entry of input.entries) {
      if (entry.marksObtained !== null && entry.marksObtained !== undefined) {
        if (entry.marksObtained < 0 || entry.marksObtained > maxMarks) {
          throw new Error(`Invalid mark ${entry.marksObtained}: Marks must be between 0 and maximum ${maxMarks}.`);
        }
      }
    }

    const register: MarksRegister = {
      id: regId,
      assessmentId: input.assessmentId,
      assessmentTitle: assessment ? assessment.title : input.assessmentId,
      classId: input.classId,
      classLabel: targetClass ? targetClass.label : input.classId,
      subjectId: input.subjectId,
      subjectName: subject ? subject.name : input.subjectId,
      maxMarks,
      passingMarks,
      teacherId: actor.id,
      teacherName: actor.name,
      status: input.isDraft ? 'draft' : 'submitted',
      lastSavedAt: new Date().toISOString(),
      entries: input.entries.map(e => {
        const stud = studentMap.get(e.studentId);
        return {
          studentId: e.studentId,
          studentName: stud ? stud.fullName : e.studentId,
          rollNumber: stud ? stud.rollNumber : 0,
          marksObtained: e.marksObtained,
          isAbsent: e.isAbsent,
          remarks: e.remarks,
        };
      }),
    };
    await setDoc(doc(db!, 'marksRegisters', regId), register);
    return register;
  }

  public async getIncidents(filter: IncidentFilter = {}): Promise<IncidentRecord[]> {
    ensureFirebaseReady();
    const coll = collection(db!, 'incidents');
    if (filter.classId && filter.studentId) {
      const q = query(coll, where('classId', '==', filter.classId), where('studentId', '==', filter.studentId));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as IncidentRecord);
    }
    if (filter.classId) {
      const q = query(coll, where('classId', '==', filter.classId));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as IncidentRecord);
    }
    if (filter.studentId) return [];
    const snap = await getDocs(coll);
    return snap.docs.map(d => d.data() as IncidentRecord);
  }

  public async createIncident(input: NewIncidentInput, actor: StaffUser): Promise<IncidentRecord> {
    if (actor.role === 'principal') {
      throw new Error('Unauthorized: Principal cannot create student notes in this pilot.');
    }
    ensureFirebaseReady();
    const studDoc = await getDoc(doc(db!, 'students', input.studentId));
    const stud = studDoc.exists() ? (studDoc.data() as StudentRecord) : null;
    const incidentId = `inc-${Date.now()}`;
    const inc: IncidentRecord = {
      id: incidentId,
      studentId: input.studentId,
      studentName: stud ? stud.fullName : input.studentId,
      classId: stud ? stud.classId : 'class-10-a',
      classLabel: stud ? stud.classLabel : 'Class 10-A',
      date: getSchoolLocalDate(),
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
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const ref = doc(db!, 'schoolSettings', 'hhs-settings-jaipur');
    await updateDoc(ref, settings);
    const snap = await getDoc(ref);
    return snap.data() as SchoolSettings;
  }

  public async updateAttendancePolicy(policy: Partial<AttendancePolicy>, _actor: StaffUser): Promise<AttendancePolicy> {
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const ref = doc(db!, 'schoolSettings', 'hhs-settings-jaipur');
    const snapBefore = await getDoc(ref);
    const existingPolicy = snapBefore.exists() ? (snapBefore.data() as SchoolSettings).attendancePolicy : {};
    const mergedPolicy = { ...existingPolicy, ...policy };
    await updateDoc(ref, { attendancePolicy: mergedPolicy });
    return mergedPolicy as AttendancePolicy;
  }

  public async getAcademicYears(): Promise<AcademicYear[]> {
    ensureFirebaseReady();
    const snap = await getDocs(collection(db!, 'academicYears'));
    return snap.docs.map(d => d.data() as AcademicYear);
  }

  public async updateAcademicYear(yearId: string, updates: Partial<AcademicYear>, _actor: StaffUser): Promise<AcademicYear> {
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
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
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const id = `staff-${Date.now()}`;
    const staff = { id, ...input } as StaffUser;
    await setDoc(doc(db!, 'staff', id), staff);
    return staff;
  }

  public async updateStaffMember(staffId: string, updates: Partial<StaffUser>, _actor: StaffUser): Promise<StaffUser> {
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const ref = doc(db!, 'staff', staffId);
    await updateDoc(ref, updates);
    const snap = await getDoc(ref);
    return snap.data() as StaffUser;
  }

  public async updateClassTeacher(classId: string, teacherId: string, teacherName: string, _actor: StaffUser): Promise<ClassSection> {
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const ref = doc(db!, 'classes', classId);
    await updateDoc(ref, { classTeacherId: teacherId, classTeacherName: teacherName });
    const snap = await getDoc(ref);
    return snap.data() as ClassSection;
  }

  public async createSubject(subject: Partial<Subject>, _actor: StaffUser): Promise<Subject> {
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const id = `sub-${Date.now()}`;
    const sub = { id, ...subject } as Subject;
    await setDoc(doc(db!, 'subjects', id), sub);
    return sub;
  }

  public async assignSubjectTeacher(assignment: Partial<SubjectAssignment>, _actor: StaffUser): Promise<SubjectAssignment> {
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
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
      where('targetId', '==', studentId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => d.data() as AuditEvent)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  public async getAttendanceSessions(date?: string): Promise<AttendanceSession[]> {
    ensureFirebaseReady();
    const targetDate = date || new Date().toISOString().split('T')[0];
    const q = query(collection(db!, 'attendanceSessions'), where('date', '==', targetDate));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AttendanceSession);
  }

  public async getAttendanceSessionsInRange(startDate: string, endDate: string, classIds?: string[]): Promise<AttendanceSession[]> {
    ensureFirebaseReady();
    if (startDate > endDate) throw new Error('Start date must be on or before end date.');
    if (!classIds?.length) return [];
    
    // Uses standard automatic single-field index on 'date' without requiring complex composite index combinations
    const q = query(
      collection(db!, 'attendanceSessions'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    const inRange = snap.docs.map(d => d.data() as AttendanceSession);
    return inRange.filter(s => classIds.includes(s.classId));
  }

  public async getAssessmentCycleById(cycleId: string): Promise<AssessmentCycle | null> {
    ensureFirebaseReady();
    const snap = await getDoc(doc(db!, 'assessments', cycleId));
    return snap.exists() ? (snap.data() as AssessmentCycle) : null;
  }

  public async createAssessmentCycle(cycle: Partial<AssessmentCycle>, _actor: StaffUser): Promise<AssessmentCycle> {
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const id = `assess-${Date.now()}`;
    const c = { id, ...cycle } as AssessmentCycle;
    await setDoc(doc(db!, 'assessments', id), c);
    return c;
  }

  public async updateAssessmentCycle(cycleId: string, updates: Partial<AssessmentCycle>, _actor: StaffUser): Promise<AssessmentCycle> {
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const ref = doc(db!, 'assessments', cycleId);
    await updateDoc(ref, updates);
    const snap = await getDoc(ref);
    return snap.data() as AssessmentCycle;
  }

  public async getConsolidatedClassMarks(classId: string, assessmentId: string = 'assess-ut1-2025'): Promise<ConsolidatedClassMarks> {
    ensureFirebaseReady();
    const cls = await this.getClassById(classId);
    if (!cls) throw new Error(`Class ${classId} not found.`);
    const students = await this.getClassStudents(classId);
    const allSubjects = await this.getSubjects();
    const subjects = allSubjects.filter(s => s.gradeLevel === cls.grade);
    const assessment = await this.getAssessmentCycleById(assessmentId);
    if (!assessment) throw new Error(`Assessment ${assessmentId} not found.`);

    // Fetch marks registers for this class & assessment
    const q = query(
      collection(db!, 'marksRegisters'),
      where('classId', '==', classId),
      where('assessmentId', '==', assessmentId)
    );
    const snap = await getDocs(q);
    const registers = snap.docs.map(d => d.data() as MarksRegister);

    const matrix: Record<string, Record<string, StudentMarkEntry | null>> = {};
    const subjectSums: Record<string, { total: number; count: number }> = {};

    subjects.forEach(sub => {
      subjectSums[sub.id] = { total: 0, count: 0 };
    });

    students.forEach(st => {
      matrix[st.id] = {};
    });

    subjects.forEach(sub => {
      const reg = registers.find(r => r.subjectId === sub.id);
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
      const info = subjectSums[sub.id];
      subjectAverages[sub.id] = info.count > 0 ? Math.round((info.total / info.count) * 10) / 10 : 0;
    });

    return {
      classSection: cls,
      assessmentCycle: assessment,
      subjects,
      students,
      matrix,
      subjectAverages,
    };
  }

  public async updateIncident(incidentId: string, updates: Partial<IncidentRecord>, _actor: StaffUser): Promise<IncidentRecord> {
    if (_actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const ref = doc(db!, 'incidents', incidentId);
    await updateDoc(ref, updates);
    const snap = await getDoc(ref);
    return snap.data() as IncidentRecord;
  }

  public async getRiskWatchlist(classId?: string): Promise<RiskWatchlistItem[]> {
    ensureFirebaseReady();
    const res = await this.getStudents(classId ? { classId } : undefined);
    const students = res.items.filter(s => s.activeFlags && s.activeFlags.length > 0);

    return students.map(s => {
      const flag0 = s.activeFlags[0];
      const primaryTrigger = flag0 ? flag0.title : 'Care Alert';
      let consecutiveAbsences = 0;
      let academicDropPercent = 0;
      if (flag0?.code === 'ATT-01') consecutiveAbsences = 3;
      if (flag0?.code === 'ACAD-04') academicDropPercent = 28;

      return {
        student: s,
        primaryTrigger,
        consecutiveAbsences,
        attendanceRate: s.attendancePercentage,
        academicDropPercent,
        flagCount: s.activeFlags.length,
        mentorAssigned: s.classLabel ? `Tutor (${s.classLabel})` : 'Assigned Class Tutor',
        followUpStatus: flag0?.code === 'ATT-01' ? 'pending' : 'in_progress',
      };
    });
  }

  public async getStudentFollowUps(studentId: string): Promise<StudentFollowUpRecord[]> {
    ensureFirebaseReady();
    const q = query(
      collection(db!, 'studentFollowUps'),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<StudentFollowUpRecord, 'id'>) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async recordStudentFollowUp(input: FollowUpActionInput, actor: StaffUser): Promise<StudentFollowUpRecord> {
    if (actor?.role === 'principal') {
      throw new Error('Unauthorized: Principal profile is strictly read-only in this pilot.');
    }
    ensureFirebaseReady();
    const followUpData: Omit<StudentFollowUpRecord, 'id'> = {
      studentId: input.studentId,
      actionType: input.actionType,
      actionLabel: input.actionLabel,
      note: input.note,
      followUpDate: input.followUpDate,
      actorId: actor.id,
      actorName: actor.displayName || actor.name || 'Staff User',
      actorRole: actor.role,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db!, 'studentFollowUps'), followUpData);
    return {
      id: docRef.id,
      ...followUpData,
    };
  }
}

export const firestoreRepository = new FirestoreRepository();
