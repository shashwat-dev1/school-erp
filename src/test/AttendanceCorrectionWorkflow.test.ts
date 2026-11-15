import { describe, it, expect, beforeEach } from 'vitest';
import { demoRepository } from '../data/demo/demoRepository';
import { Permissions } from '../domain/permissions';
import { WhatsAppNotificationService } from '../services/whatsapp/whatsappService';
import { DryRunWhatsAppProvider } from '../services/whatsapp/providers/dryRunProvider';
import type { StaffUser, AttendanceCorrection } from '../domain/types';

describe('HANUJAI ERP — Attendance Correction Request & Principal Approval Workflow Suite', () => {
  let adminUser: StaffUser;
  let principalUser: StaffUser;
  let developerUser: StaffUser;

  beforeEach(async () => {
    localStorage.clear();
    if (demoRepository.resetDemoData) {
      demoRepository.resetDemoData();
    }
    WhatsAppNotificationService.setProvider(new DryRunWhatsAppProvider());

    const staffMembers = await demoRepository.getStaffMembers();
    adminUser = staffMembers.find(s => s.role === 'admin')!;
    principalUser = staffMembers.find(s => s.role === 'principal')!;
    developerUser = staffMembers.find(s => s.role === 'developer')!;
  });

  // =========================================================================
  // SCENARIO 1, 2, 3: ATTENDANCE SUBMISSION, LOCKING & MODIFICATION REJECTION
  // =========================================================================
  describe('Part 1: Lock Attendance Register After Submission', () => {
    const testDate = '2026-11-20';
    const classId = 'class-10-a';

    it('Scenario 1: Normal attendance submission succeeds and locks the register', async () => {
      const session = await demoRepository.submitDailyAttendance(
        {
          classId,
          date: testDate,
          academicYearId: 'year-2025-2026',
          records: [
            { studentId: 'STU-10A-01', state: 'present' },
            { studentId: 'STU-10A-02', state: 'absent' },
            { studentId: 'STU-10A-03', state: 'present' },
          ],
        },
        adminUser
      );

      expect(session).toBeDefined();
      expect(session.status).toBe('submitted');
      expect(session.presentCount).toBe(2);
      expect(session.absentCount).toBe(1);
    });

    it('Scenario 2: Attempting to directly overwrite or modify submitted attendance is rejected', async () => {
      // First submission
      await demoRepository.submitDailyAttendance(
        {
          classId,
          date: testDate,
          academicYearId: 'year-2025-2026',
          records: [
            { studentId: 'STU-10A-01', state: 'present' },
            { studentId: 'STU-10A-02', state: 'absent' },
          ],
        },
        adminUser
      );

      // Attempt 2: Admin tries to directly overwrite or change status
      await expect(
        demoRepository.submitDailyAttendance(
          {
            classId,
            date: testDate,
            academicYearId: 'year-2025-2026',
            records: [
              { studentId: 'STU-10A-01', state: 'absent' },
              { studentId: 'STU-10A-02', state: 'present' },
            ],
          },
          adminUser
        )
      ).rejects.toThrow(/Attendance register is locked.*Direct modifications are forbidden/i);
    });

    it('Scenario 3: Direct modification attempts by any staff role through API are strictly rejected', async () => {
      // Submit initially
      await demoRepository.submitDailyAttendance(
        {
          classId,
          date: testDate,
          academicYearId: 'year-2025-2026',
          records: [
            { studentId: 'STU-10A-01', state: 'present' },
          ],
        },
        adminUser
      );

      // Principal cannot submit/modify
      await expect(
        demoRepository.submitDailyAttendance(
          {
            classId,
            date: testDate,
            academicYearId: 'year-2025-2026',
            records: [{ studentId: 'STU-10A-01', state: 'absent' }],
          },
          principalUser
        )
      ).rejects.toThrow(/Principal has strictly read-only access/i);

      // Developer direct overwrite is also locked to preserve audit integrity
      await expect(
        demoRepository.submitDailyAttendance(
          {
            classId,
            date: testDate,
            academicYearId: 'year-2025-2026',
            records: [{ studentId: 'STU-10A-01', state: 'absent' }],
          },
          developerUser
        )
      ).rejects.toThrow(/Attendance register is locked/i);
    });
  });

  // =========================================================================
  // SCENARIO 4, 5, 6, 7: CORRECTION REQUEST CREATION & VALIDATION
  // =========================================================================
  describe('Part 2: Admin Office Correction Request & Form Validations', () => {
    const testDate = '2026-11-21';
    const classId = 'class-10-a';
    const sessionId = `att-${classId}-${testDate}`;

    beforeEach(async () => {
      await demoRepository.submitDailyAttendance(
        {
          classId,
          date: testDate,
          academicYearId: 'year-2025-2026',
          records: [
            { studentId: 'STU-10A-01', state: 'absent' },
            { studentId: 'STU-10A-02', state: 'present' },
          ],
        },
        adminUser
      );
    });

    it('Scenario 4: Admin Office can successfully initiate an Attendance Correction Request', async () => {
      const correction = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'Parent informed student arrived at 08:30 AM after dentist appointment.',
        },
        adminUser
      );

      expect(correction).toBeDefined();
      expect(correction.id).toMatch(/^corr-/);
      expect(correction.studentId).toBe('STU-10A-01');
      expect(correction.previousState).toBe('absent');
      expect(correction.requestedState).toBe('present');
      expect(correction.mandatoryReason).toContain('dentist appointment');
      expect(correction.status).toBe('pending_principal');
      expect(correction.requestedByStaffId).toBe(adminUser.id);
      expect(correction.requestedByStaffName).toBe(adminUser.name);
    });

    it('Scenario 5: Correction request with missing or empty reason / remarks is rejected', async () => {
      await expect(
        demoRepository.requestAttendanceCorrection(
          {
            sessionId,
            studentId: 'STU-10A-01',
            previousState: 'absent',
            requestedState: 'present',
            mandatoryReason: '   ', // whitespace only
          },
          adminUser
        )
      ).rejects.toThrow(/Mandatory justification\/remarks are required/i);
    });

    it('Scenario 6: Correction request where requested state == previous state is rejected', async () => {
      await expect(
        demoRepository.requestAttendanceCorrection(
          {
            sessionId,
            studentId: 'STU-10A-01',
            previousState: 'absent',
            requestedState: 'absent', // identical
            mandatoryReason: 'Mistake in entry',
          },
          adminUser
        )
      ).rejects.toThrow(/Requested status cannot be identical/i);
    });

    it('Scenario 7: Duplicate pending correction request for same student, class, and date is rejected', async () => {
      // First request
      await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'First valid correction request',
        },
        adminUser
      );

      // Attempt second pending request while first is still pending
      await expect(
        demoRepository.requestAttendanceCorrection(
          {
            sessionId,
            studentId: 'STU-10A-01',
            previousState: 'absent',
            requestedState: 'present',
            mandatoryReason: 'Second conflicting request',
          },
          adminUser
        )
      ).rejects.toThrow(/A pending attendance correction request already exists/i);
    });
  });

  // =========================================================================
  // SCENARIO 8, 9, 21: DUAL CUSTODY & PERMISSIONS
  // =========================================================================
  describe('Part 3: Dual Custody Enforcement & Role Boundary Matrix', () => {
    const testDate = '2026-11-22';
    const classId = 'class-10-a';
    const sessionId = `att-${classId}-${testDate}`;
    let correction: AttendanceCorrection;

    beforeEach(async () => {
      await demoRepository.submitDailyAttendance(
        {
          classId,
          date: testDate,
          academicYearId: 'year-2025-2026',
          records: [{ studentId: 'STU-10A-01', state: 'absent' }],
        },
        adminUser
      );

      correction = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'Verified late arrival by bus',
        },
        adminUser
      );
    });

    it('Scenario 8: Admin Office CANNOT approve or reject attendance correction requests', async () => {
      // Permissions check
      expect(Permissions.canApproveAttendanceCorrection(adminUser, correction)).toBe(false);
      expect(Permissions.canRejectAttendanceCorrection(adminUser, correction)).toBe(false);

      // Data Layer check
      await expect(
        demoRepository.approveAttendanceCorrection(correction.id, adminUser, true, 'Admin tries self-approval')
      ).rejects.toThrow(/Unauthorized: Admin Office cannot approve/i);

      await expect(
        demoRepository.approveAttendanceCorrection(correction.id, adminUser, false, 'Admin tries reject')
      ).rejects.toThrow(/Unauthorized: Admin Office cannot approve/i);
    });

    it('Scenario 9: Requester cannot approve their own correction request (SEC-201 Dual Custody)', async () => {
      // Simulate Developer requesting a correction
      const devCorrection = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-02',
          previousState: 'present',
          requestedState: 'absent',
          mandatoryReason: 'Developer test request',
        },
        developerUser
      );

      // Permissions check: Developer cannot self-approve their own request
      expect(Permissions.canApproveAttendanceCorrection(developerUser, devCorrection)).toBe(false);

      // Data layer check
      await expect(
        demoRepository.approveAttendanceCorrection(devCorrection.id, developerUser, true, 'Self approval')
      ).rejects.toThrow(/Dual custody violation \(SEC-201\)/i);
    });

    it('Scenario 21: Developer (Super Admin) can review corrections requested by Admin Office', async () => {
      // Developer reviewing Admin request -> ALLOWED
      expect(Permissions.canApproveAttendanceCorrection(developerUser, correction)).toBe(true);

      // Principal reviewing Admin request -> ALLOWED
      expect(Permissions.canApproveAttendanceCorrection(principalUser, correction)).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO 10, 11, 12, 13, 14: PRINCIPAL REVIEW, APPROVAL, REJECTION & CONCURRENCY
  // =========================================================================
  describe('Part 4: Principal Review Actions & Concurrency Safety', () => {
    const testDate = '2026-11-23';
    const classId = 'class-10-a';
    const sessionId = `att-${classId}-${testDate}`;
    let correction: AttendanceCorrection;

    beforeEach(async () => {
      await demoRepository.submitDailyAttendance(
        {
          classId,
          date: testDate,
          academicYearId: 'year-2025-2026',
          records: [
            { studentId: 'STU-10A-01', state: 'absent' },
            { studentId: 'STU-10A-02', state: 'present' },
          ],
        },
        adminUser
      );

      correction = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'Parent provided medical slip for 1st period',
        },
        adminUser
      );
    });

    it('Scenario 10: Principal can view pending correction requests with complete details', async () => {
      const allCorrections = await demoRepository.getAttendanceCorrections(classId);
      const found = allCorrections.find(c => c.id === correction.id);

      expect(found).toBeDefined();
      expect(found!.studentName).toBe('Aarav Singhania');
      expect(found!.date).toBe(testDate);
      expect(found!.previousState).toBe('absent');
      expect(found!.requestedState).toBe('present');
      expect(found!.status).toBe('pending_principal');
      expect(found!.mandatoryReason).toContain('medical slip');
    });

    it('Scenario 11: Principal can reject a correction request with remarks; original attendance is preserved', async () => {
      // Reject request
      await demoRepository.approveAttendanceCorrection(
        correction.id,
        principalUser,
        false,
        'Medical slip does not cover full school hours.'
      );

      const allCorrections = await demoRepository.getAttendanceCorrections(classId);
      const updatedCorr = allCorrections.find(c => c.id === correction.id)!;
      expect(updatedCorr.status).toBe('rejected');
      expect(updatedCorr.reviewedByStaffId).toBe(principalUser.id);
      expect(updatedCorr.reviewRemarks).toContain('Medical slip does not cover');

      // Verify original session attendance is strictly UNCHANGED
      const session = await demoRepository.getAttendanceSession(classId, testDate);
      const studentRec = session!.records.find(r => r.studentId === 'STU-10A-01')!;
      expect(studentRec.state).toBe('absent'); // Preserved original
      expect(session!.presentCount).toBe(1);
      expect(session!.absentCount).toBe(1);
      expect(session!.status).toBe('submitted'); // Still submitted, not corrected
    });

    it('Scenario 12 & 14: Principal approval updates ONLY the target student and recalculates totals', async () => {
      await demoRepository.approveAttendanceCorrection(
        correction.id,
        principalUser,
        true,
        'Verified with parent phone call.'
      );

      const allCorrections = await demoRepository.getAttendanceCorrections(classId);
      const updatedCorr = allCorrections.find(c => c.id === correction.id)!;
      expect(updatedCorr.status).toBe('approved');
      expect(updatedCorr.reviewedByStaffId).toBe(principalUser.id);
      expect(updatedCorr.reviewRemarks).toContain('Verified with parent');

      // Verify attendance session
      const session = await demoRepository.getAttendanceSession(classId, testDate);
      expect(session!.status).toBe('corrected');

      // STU-10A-01 updated to present
      const rec1 = session!.records.find(r => r.studentId === 'STU-10A-01')!;
      expect(rec1.state).toBe('present');

      // STU-10A-02 remained untouched
      const rec2 = session!.records.find(r => r.studentId === 'STU-10A-02')!;
      expect(rec2.state).toBe('present');

      // Totals recalculated: now 2 present, 0 absent
      expect(session!.presentCount).toBe(2);
      expect(session!.absentCount).toBe(0);
      expect(session!.totalPresent).toBe(2);
      expect(session!.totalAbsent).toBe(0);
    });

    it('Scenario 13: Concurrency check rejects approval if session record state was altered', async () => {
      // Simulate state tamper or concurrent change in store
      const store = (demoRepository as any).loadStore();
      const sess = store.attendanceSessions.find((s: any) => s.id === sessionId);
      const rec = sess.records.find((r: any) => r.studentId === 'STU-10A-01');
      rec.state = 'present'; // altered behind the scenes
      (demoRepository as any).saveStore(store);

      await expect(
        demoRepository.approveAttendanceCorrection(
          correction.id,
          principalUser,
          true,
          'Attempting approval on tampered session'
        )
      ).rejects.toThrow(/Record mismatch/i);
    });
  });

  // =========================================================================
  // SCENARIO 15, 16, 17, 18, 19: WHATSAPP NOTIFICATION DISPATCH
  // =========================================================================
  describe('Part 5: Single-Parent WhatsApp Correction Notification', () => {
    const testDate = '2026-11-24';
    const classId = 'class-10-a';
    const sessionId = `att-${classId}-${testDate}`;

    beforeEach(async () => {
      await demoRepository.submitDailyAttendance(
        {
          classId,
          date: testDate,
          academicYearId: 'year-2025-2026',
          records: [
            { studentId: 'STU-10A-01', state: 'absent' },
            { studentId: 'STU-10A-02', state: 'present' },
            { studentId: 'STU-10A-03', state: 'present' },
          ],
        },
        adminUser
      );
    });

    it('Scenario 15 & 16: Approval dispatches WhatsApp notice ONLY to the affected student, NEVER whole class', async () => {
      const correction = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'Arrived after morning prayers',
        },
        adminUser
      );

      // Approve correction
      await demoRepository.approveAttendanceCorrection(
        correction.id,
        principalUser,
        true,
        'Approved by Principal'
      );

      const allCorrections = await demoRepository.getAttendanceCorrections(classId);
      const updated = allCorrections.find(c => c.id === correction.id)!;

      // Correction record has job ID and sent status
      expect(updated.notificationJobId).toBe(`att_corr_${correction.id}`);
      expect(updated.notificationStatus).toBe('sent');

      // Check job details
      const job = await WhatsAppNotificationService.getNotificationJob(updated.notificationJobId!);
      expect(job).not.toBeNull();
      expect(job!.studentId).toBe('STU-10A-01');
      expect(job!.attendanceState).toBe('present');

      // Verify no other jobs were created for STU-10A-02 or STU-10A-03 under correction prefix
      const corrJob2 = await WhatsAppNotificationService.getNotificationJob(`att_corr_${correction.id}_STU-10A-02`);
      expect(corrJob2).toBeNull();
    });

    it('Scenario 17: Pending original attendance notification is cancelled / superseded upon correction', async () => {
      // Simulate pending original notification
      const origJobId = `att_${sessionId}_STU-10A-01`;
      localStorage.setItem(
        'hanujai_whatsapp_notifications_v1',
        JSON.stringify({
          [origJobId]: {
            id: origJobId,
            sessionId,
            studentId: 'STU-10A-01',
            deliveryStatus: 'pending',
            messageText: 'Original message',
          },
        })
      );

      const correction = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'Bus breakdown reported',
        },
        adminUser
      );

      await demoRepository.approveAttendanceCorrection(
        correction.id,
        principalUser,
        true,
        'Bus delay confirmed'
      );

      // Original job should now be marked 'skipped' with supersession reason
      const origJob = await WhatsAppNotificationService.getNotificationJob(origJobId);
      expect(origJob!.deliveryStatus).toBe('skipped');
      expect(origJob!.error).toContain(`Superseded by attendance correction ${correction.id}`);
    });

    it('Scenario 18: Correction notification uses dedicated respectful bilingual template (English + Hindi)', async () => {
      const correction = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'Office typo corrected',
        },
        adminUser
      );

      await demoRepository.approveAttendanceCorrection(
        correction.id,
        principalUser,
        true,
        'Typo confirmed'
      );

      const job = await WhatsAppNotificationService.getNotificationJob(`att_corr_${correction.id}`);
      expect(job).not.toBeNull();
      const text = job!.messageText;

      // English section checks
      expect(text).toContain('Aarav Singhania');
      expect(text).toContain('Previous Attendance: Absent');
      expect(text).toContain('Corrected Attendance: Present');
      expect(text).toContain('HanuJai High School');

      // Hindi section checks
      expect(text).toContain('विद्यार्थी का नाम: Aarav Singhania');
      expect(text).toContain('पूर्व दर्ज उपस्थिति: अनुपस्थित (Absent)');
      expect(text).toContain('संशोधित उपस्थिति: उपस्थित (Present)');
      expect(text).toContain('हनुजाई हाई स्कूल');
    });

    it('Scenario 19: Notification status (Sent / Skipped / Failed) is tracked on correction record', async () => {
      const correction = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'Test notification status tracking',
        },
        adminUser
      );

      await demoRepository.approveAttendanceCorrection(
        correction.id,
        principalUser,
        true,
        'Approved'
      );

      const allCorrections = await demoRepository.getAttendanceCorrections(classId);
      const updated = allCorrections.find(c => c.id === correction.id)!;
      expect(['sent', 'skipped', 'failed', 'pending']).toContain(updated.notificationStatus);
    });
  });

  // =========================================================================
  // SCENARIO 20: AUDIT TRAIL
  // =========================================================================
  describe('Part 6: Audit Log Trail for Correction Lifecycle', () => {
    const testDate = '2026-11-25';
    const classId = 'class-10-a';
    const sessionId = `att-${classId}-${testDate}`;

    it('Scenario 20: Audit ledger logs all 3 lifecycle events (requested, approved, rejected)', async () => {
      await demoRepository.submitDailyAttendance(
        {
          classId,
          date: testDate,
          academicYearId: 'year-2025-2026',
          records: [{ studentId: 'STU-10A-01', state: 'absent' }],
        },
        adminUser
      );

      // Event 1: Request
      const corr1 = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'Audit trail test 1',
        },
        adminUser
      );

      const auditAfterRequest = await demoRepository.getAuditEvents({});
      const reqEvent = auditAfterRequest.find(
        e => e.action === 'attendance_correction_requested' && e.targetId === corr1.id
      );
      expect(reqEvent).toBeDefined();
      expect(reqEvent!.actorId).toBe(adminUser.id);
      expect(reqEvent!.summary).toContain('Requested attendance correction for Aarav Singhania');

      // Event 2: Approve
      await demoRepository.approveAttendanceCorrection(corr1.id, principalUser, true, 'Approved for audit');
      const auditAfterApprove = await demoRepository.getAuditEvents({});
      const appEvent = auditAfterApprove.find(
        e => e.action === 'attendance_corrected' && e.targetId === corr1.id
      );
      expect(appEvent).toBeDefined();
      expect(appEvent!.actorId).toBe(principalUser.id);
      expect(appEvent!.summary).toContain('Approved attendance correction');

      // Event 3: Reject another request
      const corr2 = await demoRepository.requestAttendanceCorrection(
        {
          sessionId,
          studentId: 'STU-10A-02',
          previousState: 'present',
          requestedState: 'absent',
          mandatoryReason: 'Audit trail test 2',
        },
        adminUser
      );

      await demoRepository.approveAttendanceCorrection(corr2.id, principalUser, false, 'Rejected for audit');
      const auditAfterReject = await demoRepository.getAuditEvents({});
      const rejEvent = auditAfterReject.find(
        e => e.action === 'attendance_correction_rejected' && e.targetId === corr2.id
      );
      expect(rejEvent).toBeDefined();
      expect(rejEvent!.actorId).toBe(principalUser.id);
      expect(rejEvent!.summary).toContain('Rejected attendance correction');
    });
  });
});
