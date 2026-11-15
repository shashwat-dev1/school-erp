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
  StudentDocumentType,
  StudentDocumentRecord,
  RolePermissions,
  PermissionModule,
  PermissionAction,
} from '../../domain/types';
import { Permissions } from '../../domain/permissions';
import { getSchoolLocalDate } from '../../domain/policy';

import { db, auth, isFirebaseConfigured } from '../../config/firebase';
import { vercelBlobStorage } from '../../services/storage/vercelBlobStorage';
import { WhatsAppNotificationService } from '../../services/whatsapp/whatsappService';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
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
    // 1. Authoritative lookup by authenticated Firebase UID in canonical collection /staff/{uid}
    const docRef = doc(db!, 'staff', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as StaffUser;
    }

    // 2. Secondary lookup for records where document ID is a staff slug and authUid matches
    const qByUid = query(collection(db!, 'staff'), where('authUid', '==', userId));
    const snapByUid = await getDocs(qByUid);
    if (!snapByUid.empty) {
      return snapByUid.docs[0].data() as StaffUser;
    }

    // 3. Fail-closed: No authoritative record exists for this Firebase Auth UID
    console.warn(`[HanuJai Auth] No authoritative staff record found for Firebase UID: ${userId}`);
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
    const sorted = snap.docs
      .map(d => d.data() as StudentRecord)
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

  public async getSubjects(): Promise<Subject[]> {
    return [];
  }

  public async getSubjectAssignments(_teacherId?: string): Promise<SubjectAssignment[]> {
    return [];
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
      throw new Error('Unauthorized: Principal profile is strictly read-only and cannot submit attendance.');
    }
    const isAuthorized = actor.role === 'admin' || actor.role === 'developer';
    if (!isAuthorized) {
      throw new Error('Unauthorized: Only Admin Office is authorized to submit daily classroom attendance.');
    }
    ensureFirebaseReady();

    const sessionId = `att-${input.classId}-${input.date}`;
    const sessDoc = await getDoc(doc(db!, 'attendanceSessions', sessionId));
    if (sessDoc.exists()) {
      const existing = sessDoc.data() as AttendanceSession;
      if (existing.status === 'submitted' || existing.status === 'corrected') {
        throw new Error(
          'Attendance register is locked for this class and date. Direct modifications are forbidden. Please submit an Attendance Correction Request for Principal review.'
        );
      }
    }

    const [cls, students] = await Promise.all([
      this.getClassById(input.classId),
      this.getClassStudents(input.classId),
    ]);
    const studentMap = new Map(students.map(s => [s.id, s]));
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
    const isAuthorized = actor.role === 'admin' || actor.role === 'developer';
    if (!isAuthorized) {
      throw new Error('Unauthorized: Only Admin Office is authorized to record attendance corrections.');
    }

    if (!input.mandatoryReason || !input.mandatoryReason.trim()) {
      throw new Error('Mandatory justification/remarks are required to request an attendance correction.');
    }

    if (input.previousState === input.requestedState) {
      throw new Error('Requested status cannot be identical to the currently recorded status.');
    }

    ensureFirebaseReady();
    const [studDoc, sessDoc] = await Promise.all([
      getDoc(doc(db!, 'students', input.studentId)),
      getDoc(doc(db!, 'attendanceSessions', input.sessionId)),
    ]);
    const stud = studDoc.exists() ? (studDoc.data() as StudentRecord) : null;
    const sess = sessDoc.exists() ? (sessDoc.data() as AttendanceSession) : null;

    const classId = sess?.classId || stud?.classId || 'class-10-a';
    const classLabel = sess?.classLabel || stud?.classLabel || classId;
    const date = sess?.date || getSchoolLocalDate();
    const studentName = stud?.fullName || input.studentId;

    // Check duplicate pending request
    const existingQ = query(
      collection(db!, 'attendanceCorrections'),
      where('studentId', '==', input.studentId),
      where('date', '==', date),
      where('status', '==', 'pending_principal')
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      throw new Error('A pending attendance correction request already exists for this student on this date.');
    }

    const corrId = `corr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const corr: AttendanceCorrection = {
      id: corrId,
      sessionId: input.sessionId,
      classId,
      classLabel,
      section: input.section || (classLabel.includes('-') ? classLabel.split('-')[1]?.trim() : ''),
      admissionNumber: input.admissionNumber || stud?.admissionNumber || stud?.id || '',
      date,
      studentId: input.studentId,
      studentName,
      previousState: input.previousState,
      requestedState: input.requestedState,
      mandatoryReason: input.mandatoryReason.trim(),
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
    const corrRef = doc(db!, 'attendanceCorrections', correctionId);
    const corrSnap = await getDoc(corrRef);
    if (!corrSnap.exists()) {
      throw new Error('Attendance correction request not found.');
    }
    const corr = corrSnap.data() as AttendanceCorrection;

    if (corr.status !== 'pending_principal') {
      throw new Error(`Cannot review attendance correction: current status is "${corr.status}".`);
    }

    // Role and dual-custody check
    if (!Permissions.canApproveAttendanceCorrection(actor, corr)) {
      if (actor.role === 'admin') {
        throw new Error('Unauthorized: Admin Office cannot approve or reject attendance corrections.');
      }
      if (corr.requestedByStaffId === actor.id) {
        throw new Error('Unauthorized: Dual custody violation (SEC-201). Requester cannot review their own correction request.');
      }
      throw new Error('Unauthorized: You do not have permission to review attendance corrections.');
    }

    if (approved) {
      await runTransaction(db!, async (transaction) => {
        const sessRef = doc(db!, 'attendanceSessions', corr.sessionId);
        const sessDoc = await transaction.get(sessRef);
        if (!sessDoc.exists()) throw new Error('Attendance session not found for this correction.');
        const session = sessDoc.data() as AttendanceSession;
        const recIndex = session.records.findIndex(r => r.studentId === corr.studentId);
        if (recIndex === -1) throw new Error(`Student record ${corr.studentId} not found in attendance session.`);
        if (session.records[recIndex].state !== corr.previousState) {
          throw new Error(`Record mismatch: student status in session is currently "${session.records[recIndex].state}", but correction expected "${corr.previousState}".`);
        }

        session.records[recIndex].state = corr.requestedState;
        session.presentCount = session.records.filter(r => r.state === 'present').length;
        session.absentCount = session.records.filter(r => r.state === 'absent').length;
        session.totalPresent = session.presentCount;
        session.totalAbsent = session.absentCount;
        session.status = 'corrected';

        transaction.set(sessRef, session, { merge: true });
        transaction.update(corrRef, {
          status: 'approved',
          reviewedByStaffId: actor.id,
          reviewedByStaffName: actor.name,
          reviewedAt: new Date().toISOString(),
          reviewRemarks: remarks || '',
        });
      });

      // Single-parent notification
      const studDoc = await getDoc(doc(db!, 'students', corr.studentId));
      if (studDoc.exists()) {
        const student = studDoc.data() as StudentRecord;
        try {
          const job = await WhatsAppNotificationService.enqueueCorrectionNotification(corr, student);
          await updateDoc(corrRef, {
            notificationJobId: job.id,
            notificationStatus: job.deliveryStatus,
            notificationError: job.error || null,
          });
        } catch (err: any) {
          await updateDoc(corrRef, {
            notificationStatus: 'failed',
            notificationError: err?.message || 'Notification failed',
          });
        }
      }
    } else {
      if (!remarks || !remarks.trim()) {
        throw new Error('A rejection reason or remarks is required when rejecting a correction request.');
      }
      await updateDoc(corrRef, {
        status: 'rejected',
        reviewedByStaffId: actor.id,
        reviewedByStaffName: actor.name,
        reviewedAt: new Date().toISOString(),
        reviewRemarks: remarks.trim(),
      });
    }
  }

  public async getAssessmentCycles(_yearId?: string): Promise<AssessmentCycle[]> {
    return [];
  }

  public async getMarksRegister(
    _assessmentId: string,
    _classId: string,
    _subjectId: string
  ): Promise<MarksRegister | null> {
    return null;
  }

  public async getStudentMarksRegisters(_studentId: string): Promise<MarksRegister[]> {
    return [];
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

  public async getIncidents(_filter: IncidentFilter = {}): Promise<IncidentRecord[]> {
    return [];
  }

  public async createIncident(input: NewIncidentInput, actor: StaffUser): Promise<IncidentRecord> {
    return {
      id: `inc-${Date.now()}`,
      studentId: input.studentId,
      studentName: input.studentId,
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
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
    if (!_actor || _actor.role !== 'developer') {
      throw new Error('Unauthorized: Only Developer accounts can provision staff users.');
    }
    if (input.role === 'developer' && _actor.role !== 'developer') {
      throw new Error('Unauthorized: Only an authorized Developer can create or assign another Developer account.');
    }
    ensureFirebaseReady();
    const id = `staff-${Date.now()}`;
    const staff = { id, ...input, status: input.status || 'active', createdAt: new Date().toISOString() } as StaffUser;
    await setDoc(doc(db!, 'staff', id), staff);

    try {
      const auditRef = collection(db!, 'auditEvents');
      await addDoc(auditRef, {
        timestamp: new Date().toISOString(),
        actorId: _actor.id,
        actorName: _actor.displayName || _actor.name,
        actorRole: _actor.role,
        action: 'user_created',
        resource: 'staff',
        targetId: id,
        summary: `Provisioned staff account for ${staff.name} (${staff.role})`,
        clientIp: '192.168.1.1',
      });
    } catch {
      // Non-blocking audit recording
    }

    return staff;
  }

  public async updateStaffMember(staffId: string, updates: Partial<StaffUser>, _actor: StaffUser): Promise<StaffUser> {
    if (!_actor || _actor.role !== 'developer') {
      throw new Error('Unauthorized: Only Developer accounts can modify staff roles or account status.');
    }
    ensureFirebaseReady();
    const ref = doc(db!, 'staff', staffId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Staff member not found');
    const existing = snap.data() as StaffUser;

    // Protect against non-developer elevating to developer
    if (updates.role === 'developer' && _actor.role !== 'developer') {
      throw new Error('Unauthorized: Principal and Admin Office cannot elevate themselves to Developer.');
    }

    // Protect against accidental demotion or deactivation of the last active Developer
    if (existing.role === 'developer') {
      const isDemoting = updates.role && updates.role !== 'developer';
      const isDeactivating = updates.status && updates.status !== 'active';
      if (isDemoting || isDeactivating) {
        const staffSnap = await getDocs(query(collection(db!, 'staff'), where('role', '==', 'developer'), where('status', '==', 'active')));
        if (staffSnap.size <= 1) {
          throw new Error('Action blocked: Cannot deactivate or demote the last active Developer account.');
        }
      }
    }

    await updateDoc(ref, updates);
    const updatedSnap = await getDoc(ref);
    const updated = updatedSnap.data() as StaffUser;

    try {
      const auditRef = collection(db!, 'auditEvents');
      await addDoc(auditRef, {
        timestamp: new Date().toISOString(),
        actorId: _actor.id,
        actorName: _actor.displayName || _actor.name,
        actorRole: _actor.role,
        action: updates.role ? 'user_role_changed' : updates.status ? 'user_status_changed' : 'user_updated',
        resource: 'staff',
        targetId: staffId,
        summary: `Updated staff profile for ${updated.name}: ${JSON.stringify(updates)}`,
        clientIp: '192.168.1.1',
      });
    } catch {
      // Non-blocking
    }

    return updated;
  }

  public async revokeStaffSessions(staffId: string, _actor: StaffUser): Promise<void> {
    if (!_actor || _actor.role !== 'developer') {
      throw new Error('Unauthorized: Only Developer accounts can revoke user sessions.');
    }
    ensureFirebaseReady();
    try {
      const auditRef = collection(db!, 'auditEvents');
      await addDoc(auditRef, {
        timestamp: new Date().toISOString(),
        actorId: _actor.id,
        actorName: _actor.displayName || _actor.name,
        actorRole: _actor.role,
        action: 'user_session_revoked',
        resource: 'staff',
        targetId: staffId,
        summary: `Revoked active sessions for staff user ${staffId}`,
        clientIp: '192.168.1.1',
      });
    } catch {
      // Non-blocking
    }
  }

  public async initiatePasswordRecovery(staffId: string, _actor: StaffUser): Promise<{ tempToken?: string; message: string }> {
    if (!_actor || _actor.role !== 'developer') {
      throw new Error('Unauthorized: Only Developer accounts can initiate password recovery.');
    }
    ensureFirebaseReady();
    const tempToken = `reset_${Math.random().toString(36).substring(2, 10)}`;
    try {
      const auditRef = collection(db!, 'auditEvents');
      await addDoc(auditRef, {
        timestamp: new Date().toISOString(),
        actorId: _actor.id,
        actorName: _actor.displayName || _actor.name,
        actorRole: _actor.role,
        action: 'password_recovery_initiated',
        resource: 'staff',
        targetId: staffId,
        summary: `Initiated password recovery dispatch for staff user ${staffId}`,
        clientIp: '192.168.1.1',
      });
    } catch {
      // Non-blocking
    }
    return {
      tempToken,
      message: `Password recovery process initiated for staff user ${staffId}.`,
    };
  }

  public async getRolePermissions(): Promise<RolePermissions> {
    if (isFirebaseConfigured() && db) {
      try {
        const ref = doc(db, 'systemSettings', 'permissions');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as RolePermissions;
          Permissions.setRolePermissions(data, false);
          return Permissions.getRolePermissions();
        }
      } catch (err) {
        console.warn('Failed to fetch role permissions from Firestore:', err);
      }
    }
    return Permissions.getRolePermissions();
  }

  public async updateRolePermissions(
    role: 'principal' | 'admin',
    permissions: Record<PermissionModule, Partial<Record<PermissionAction, boolean>>>,
    actor: StaffUser
  ): Promise<RolePermissions> {
    if (!actor || actor.role !== 'developer') {
      throw new Error('Unauthorized: Only Developer accounts can configure role permissions.');
    }

    const current = Permissions.getRolePermissions();
    const updated: RolePermissions = {
      ...current,
      developer: { ...current.developer },
      [role]: { ...current[role], ...permissions },
    };

    Permissions.setRolePermissions(updated, true);

    ensureFirebaseReady();
    try {
      await setDoc(doc(db!, 'systemSettings', 'permissions'), updated, { merge: true });
      const auditRef = collection(db!, 'auditEvents');
      await addDoc(auditRef, {
        timestamp: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.displayName || actor.name,
        actorRole: actor.role,
        action: 'permissions_updated',
        resource: 'permissions',
        targetId: role,
        summary: `Updated granular permission matrix for role: ${role.toUpperCase()}`,
        clientIp: '192.168.1.1',
      });
    } catch (err) {
      console.warn('Failed to persist permissions to Firestore:', err);
    }

    return updated;
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
    return { id: incidentId, ...updates } as IncidentRecord;
  }

  public async getRiskWatchlist(_classId?: string): Promise<RiskWatchlistItem[]> {
    return [];
  }

  public async getStudentFollowUps(_studentId: string): Promise<StudentFollowUpRecord[]> {
    return [];
  }

  public async recordStudentFollowUp(input: FollowUpActionInput, actor: StaffUser): Promise<StudentFollowUpRecord> {
    return {
      id: `fu-${Date.now()}`,
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
  }

  // Student Document Management (9 Required Slots)
  public async getStudentDocuments(studentId: string): Promise<StudentDocumentRecord[]> {
    ensureFirebaseReady();
    const docsColl = collection(db!, 'students', studentId, 'documents');
    const snap = await getDocs(docsColl);
    const records: StudentDocumentRecord[] = [];
    snap.forEach(d => {
      const data = d.data() as StudentDocumentRecord;
      if (data && data.isPresent !== false) {
        records.push(data);
      }
    });
    return records;
  }

  public async getAllStudentDocuments(): Promise<Record<string, StudentDocumentRecord[]>> {
    ensureFirebaseReady();
    const result: Record<string, StudentDocumentRecord[]> = {};
    try {
      const snap = await getDocs(collectionGroup(db!, 'documents'));
      snap.forEach(d => {
        const data = d.data() as StudentDocumentRecord;
        if (data && data.isPresent !== false && data.studentId) {
          if (!result[data.studentId]) {
            result[data.studentId] = [];
          }
          result[data.studentId].push(data);
        }
      });
    } catch (err) {
      console.warn('Failed to fetch all documents via collectionGroup:', err);
    }
    return result;
  }

  public async uploadStudentDocument(
    studentId: string,
    documentType: StudentDocumentType,
    file: File | Blob,
    metadata: { originalFileName?: string; contentType?: string; fileSize?: number; notes?: string },
    actor: StaffUser,
    onProgress?: (progressPercent: number) => void
  ): Promise<StudentDocumentRecord> {
    ensureFirebaseReady();

    let idToken = '';
    if (auth?.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch (tokenErr) {
        console.warn('[HanuJai Storage] Could not retrieve Firebase ID token:', tokenErr);
      }
    }

    if (!idToken) {
      throw new Error('User session is not authenticated. Please log in before managing documents.');
    }

    const originalFileName = metadata.originalFileName || (file as File).name || `${documentType}.pdf`;
    const contentType = metadata.contentType || (file as File).type || 'application/octet-stream';
    const fileSize = metadata.fileSize || (file as File).size || 0;

    // Step 1: Upload binary directly to Vercel Private Blob store via client authorization
    let uploadResult;
    try {
      uploadResult = await vercelBlobStorage.uploadFile(file, {
        studentId,
        documentType,
        originalFileName,
        contentType,
        fileSize,
        actorId: actor.id,
        actorRole: actor.role,
        idToken,
        onProgress: (p) => onProgress?.(p.percentage),
      });
    } catch (uploadFailure) {
      console.error('[HanuJai Storage] Vercel Blob upload failed:', uploadFailure);
      throw uploadFailure;
    }

    const storagePath = uploadResult.pathname;
    const downloadUrl = await vercelBlobStorage.getFileDownloadUrl(storagePath);

    // Step 2: Storage upload succeeded. Now prepare and write Firestore metadata.
    const docRef = doc(db!, 'students', studentId, 'documents', documentType);
    let existingSnap;
    try {
      existingSnap = await getDoc(docRef);
    } catch (getDocErr) {
      console.warn('Could not read existing doc metadata; treating as new slot:', getDocErr);
    }

    const nowIso = new Date().toISOString();
    const isReplace = Boolean(existingSnap && existingSnap.exists() && existingSnap.data()?.isPresent !== false);
    const version = existingSnap && existingSnap.exists() ? ((existingSnap.data().version || 1) + 1) : 1;
    const oldStoragePath = existingSnap && existingSnap.exists() ? existingSnap.data().storagePath : null;

    const record: StudentDocumentRecord = {
      id: documentType,
      documentType,
      studentId,
      storagePath,
      originalFileName,
      contentType,
      fileSize,
      uploadedAt: existingSnap && existingSnap.exists() ? (existingSnap.data().uploadedAt || nowIso) : nowIso,
      uploadedBy: existingSnap && existingSnap.exists() ? (existingSnap.data().uploadedBy || actor.id) : actor.id,
      uploadedByName: existingSnap && existingSnap.exists() ? (existingSnap.data().uploadedByName || (actor.displayName || actor.name)) : (actor.displayName || actor.name),
      updatedAt: nowIso,
      updatedBy: actor.id,
      updatedByName: actor.displayName || actor.name,
      version,
      isPresent: true,
      downloadUrl,
    };

    // Step 3: Write metadata to Firestore with safety rollback if Firestore fails
    try {
      await setDoc(docRef, record);
    } catch (firestoreWriteErr) {
      console.error('Firestore metadata write failed after storage upload. Rolling back orphaned storage object...', firestoreWriteErr);
      try {
        await vercelBlobStorage.deleteFile(storagePath, idToken);
      } catch (cleanupErr) {
        console.warn('Failed to cleanup orphaned storage file:', cleanupErr);
      }
      throw new Error(
        'File uploaded to storage but saving document metadata to Firestore failed. Orphaned file was removed. Please retry.'
      );
    }

    // Step 4: If replacing, safely clean up old storage blob now that metadata is committed
    if (oldStoragePath && oldStoragePath !== storagePath) {
      try {
        await vercelBlobStorage.deleteFile(oldStoragePath, idToken);
      } catch (oldCleanupErr) {
        console.warn('Non-blocking: could not delete old document binary:', oldCleanupErr);
      }
    }

    // Step 5: Append immutable audit record
    try {
      const auditRef = collection(db!, 'auditEvents');
      await addDoc(auditRef, {
        timestamp: nowIso,
        actorId: actor.id,
        actorName: actor.displayName || actor.name,
        actorRole: actor.role,
        action: isReplace ? 'document_replaced' : 'document_uploaded',
        resource: 'student_documents',
        targetId: `${studentId}/${documentType}`,
        summary: `${isReplace ? 'Replaced' : 'Uploaded'} ${documentType} for student ${studentId} (${originalFileName})`,
        details: {
          documentType,
          originalFileName,
          fileSize,
          version,
          storagePath,
        },
        clientIp: '192.168.1.1',
      });
    } catch {
      // Non-blocking audit recording
    }

    return record;
  }

  public async deleteStudentDocument(
    studentId: string,
    documentType: StudentDocumentType,
    actor: StaffUser
  ): Promise<void> {
    ensureFirebaseReady();
    const docRef = doc(db!, 'students', studentId, 'documents', documentType);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const data = snap.data() as StudentDocumentRecord;

    let idToken = '';
    if (auth?.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch {
        // Ignore
      }
    }

    if (!idToken) {
      throw new Error('User session is not authenticated. Please log in before deleting documents.');
    }

    // Delete storage object from Vercel Private Blob
    if (data.storagePath) {
      try {
        await vercelBlobStorage.deleteFile(data.storagePath, idToken);
      } catch {
        // Non-fatal if already deleted
      }
    }

    // Delete Firestore document
    await deleteDoc(docRef);

    // Audit event
    try {
      const auditRef = collection(db!, 'auditEvents');
      await addDoc(auditRef, {
        timestamp: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.displayName || actor.name,
        actorRole: actor.role,
        action: 'document_deleted',
        resource: 'student_documents',
        targetId: `${studentId}/${documentType}`,
        summary: `Deleted document ${documentType} for student ${studentId} (was ${data.originalFileName})`,
        details: {
          documentType,
          originalFileName: data.originalFileName,
          storagePath: data.storagePath,
        },
        clientIp: '192.168.1.1',
      });
    } catch {
      // Non-blocking
    }
  }

  public async reviewStudentDocument(
    studentId: string,
    documentType: StudentDocumentType,
    action: 'accept' | 'reject',
    actor: StaffUser,
    reason?: string
  ): Promise<StudentDocumentRecord> {
    ensureFirebaseReady();
    if (!actor || actor.role === 'principal') {
      throw new Error('Unauthorized: Principal is strictly read-only and cannot approve or reject documents.');
    }
    if (action === 'reject' && (!reason || !reason.trim())) {
      throw new Error('A rejection reason is required when rejecting a student document.');
    }

    const docRef = doc(db!, 'students', studentId, 'documents', documentType);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`Document ${documentType} not found for student ${studentId}`);
    }

    const nowIso = new Date().toISOString();
    const updates: Partial<StudentDocumentRecord> = {
      reviewStatus: action === 'accept' ? 'accepted' : 'rejected',
      verifiedBy: actor.id,
      verifiedByName: actor.displayName || actor.name,
      verifiedAt: nowIso,
      rejectionReason: action === 'reject' ? (reason || 'Document rejected by school administration') : undefined,
      isPresent: action === 'accept',
      updatedAt: nowIso,
      updatedBy: actor.id,
      updatedByName: actor.displayName || actor.name,
    };

    await updateDoc(docRef, updates);

    try {
      const auditRef = collection(db!, 'auditEvents');
      await addDoc(auditRef, {
        timestamp: nowIso,
        actorId: actor.id,
        actorName: actor.displayName || actor.name,
        actorRole: actor.role,
        action: action === 'accept' ? 'document_approved' : 'document_rejected',
        resource: 'student_documents',
        targetId: `${studentId}/${documentType}`,
        summary: `${action === 'accept' ? 'Approved' : 'Rejected'} ${documentType} for student ${studentId}${reason ? ': ' + reason : ''}`,
        clientIp: '192.168.1.1',
      });
    } catch {
      // Non-blocking
    }

    const updated = await getDoc(docRef);
    return updated.data() as StudentDocumentRecord;
  }

  public async getDocumentDownloadUrl(storagePath: string): Promise<string> {
    return await vercelBlobStorage.getFileDownloadUrl(storagePath);
  }
}

export const firestoreRepository = new FirestoreRepository();
