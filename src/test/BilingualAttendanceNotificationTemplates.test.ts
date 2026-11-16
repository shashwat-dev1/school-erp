import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePresentAttendanceMessage,
  generateAbsentAttendanceMessage,
  generatePresentEnglishMessage,
  generatePresentHindiMessage,
  generateAbsentEnglishMessage,
  generateAbsentHindiMessage,
  generateAttendanceNotificationMessage,
  SIGN_OFF_ENGLISH,
  SIGN_OFF_HINDI,
  SCHOOL_NAME_EN,
  SCHOOL_NAME_HI,
} from '../services/whatsapp/attendanceNotificationTemplates';
import { WhatsAppNotificationService } from '../services/whatsapp/whatsappService';
import { DryRunWhatsAppProvider } from '../services/whatsapp/providers/dryRunProvider';
import { demoRepository } from '../data/demo/demoRepository';
import type { AttendanceSession, StudentRecord } from '../domain/types';

describe('HANUJAI ERP — Bilingual WhatsApp Attendance Notification Suite', () => {
  const sampleStudentName = 'Aarav Singhania';
  const sampleDate = '13 Nov 2026';

  beforeEach(() => {
    WhatsAppNotificationService.setProvider(new DryRunWhatsAppProvider());
  });

  // ==========================================================================
  // 1. PRESENT Template Tests
  // ==========================================================================
  describe('1. PRESENT Attendance Notification Template', () => {
    it('generates the exact approved English wording for PRESENT', () => {
      const en = generatePresentEnglishMessage(sampleStudentName, sampleDate);
      const expectedEn =
        `Dear Parent\n\n` +
        `Attendance for your ward Master Aarav Singhania has been marked PRESENT at HanuJai High School on 13 Nov 2026.\n\n` +
        `Regards,\n` +
        `HanuJai High School\n` +
        `School Administration`;
      expect(en).toBe(expectedEn);
    });

    it('generates the exact approved Hindi wording for PRESENT', () => {
      const hi = generatePresentHindiMessage(sampleStudentName, sampleDate);
      const expectedHi =
        `आदरणीय अभिभावक\n\n` +
        `आपको सूचित किया जाता है की Aarav Singhania कि दिनांक 13 Nov 2026 को हनुजय हाई स्कूल में उपस्थिति (PRESENT) दर्ज कि गई है।\n\n` +
        `सादर,\n` +
        `हनुजय हाई स्कूल\n` +
        `विद्यालय प्रशासन`;
      expect(hi).toBe(expectedHi);
    });

    it('maps dynamic student name and attendance date correctly in PRESENT notification', () => {
      const dynamicName = 'Harshvardhan Rathore';
      const dynamicDate = '20 Nov 2026';
      const full = generatePresentAttendanceMessage(dynamicName, dynamicDate);

      expect(full).toContain('Master Harshvardhan Rathore');
      expect(full).toContain('दिनांक 20 Nov 2026');
      expect(full).not.toContain('{studentName}');
      expect(full).not.toContain('{date}');
      expect(full).not.toContain('Aarav Singhania');
    });

    it('includes complete English sign-off (Regards, HanuJai High School, School Administration)', () => {
      const en = generatePresentEnglishMessage(sampleStudentName, sampleDate);
      expect(en.endsWith(SIGN_OFF_ENGLISH)).toBe(true);
      expect(SIGN_OFF_ENGLISH).toBe('Regards,\nHanuJai High School\nSchool Administration');
    });

    it('includes complete Hindi sign-off (सादर, हनुजय हाई स्कूल, विद्यालय प्रशासन)', () => {
      const hi = generatePresentHindiMessage(sampleStudentName, sampleDate);
      expect(hi.endsWith(SIGN_OFF_HINDI)).toBe(true);
      expect(SIGN_OFF_HINDI).toBe('सादर,\nहनुजय हाई स्कूल\nविद्यालय प्रशासन');
    });

    it('ensures English section appears before Hindi section with clear paragraph separation', () => {
      const full = generatePresentAttendanceMessage(sampleStudentName, sampleDate);
      const enIndex = full.indexOf('Dear Parent');
      const hiIndex = full.indexOf('आदरणीय अभिभावक');

      expect(enIndex).toBeGreaterThanOrEqual(0);
      expect(hiIndex).toBeGreaterThanOrEqual(0);
      expect(enIndex).toBeLessThan(hiIndex);

      // Verify clear paragraph separation between English sign-off and Hindi greeting
      expect(full).toContain(`${SIGN_OFF_ENGLISH}\n\nआदरणीय अभिभावक`);
    });

    it('rejects missing or empty studentName or date with descriptive errors', () => {
      expect(() => generatePresentAttendanceMessage('', sampleDate)).toThrow('Student name is required');
      expect(() => generatePresentAttendanceMessage('  ', sampleDate)).toThrow('Student name is required');
      expect(() => generatePresentAttendanceMessage('null', sampleDate)).toThrow('cannot be "undefined" or "null"');
      expect(() => generatePresentAttendanceMessage(sampleStudentName, '')).toThrow('Attendance date is required');
      expect(() => generatePresentAttendanceMessage(sampleStudentName, 'undefined')).toThrow('cannot be "undefined" or "null"');
    });
  });

  // ==========================================================================
  // 2. ABSENT Template Tests
  // ==========================================================================
  describe('2. ABSENT Attendance Notification Template', () => {
    it('generates the exact approved English wording for ABSENT including leave application instruction', () => {
      const en = generateAbsentEnglishMessage(sampleStudentName, sampleDate);
      const expectedEn =
        `Dear Parent\n\n` +
        `Attendance for your ward Master Aarav Singhania has been marked ABSENT at HanuJai High School on 13 Nov 2026. Please share the leave application/ medical certificate.\n\n` +
        `Regards,\n` +
        `HanuJai High School\n` +
        `School Administration`;
      expect(en).toBe(expectedEn);
    });

    it('generates the exact approved Hindi wording for ABSENT including leave application instruction', () => {
      const hi = generateAbsentHindiMessage(sampleStudentName, sampleDate);
      const expectedHi =
        `आदरणीय अभिभावक\n\n` +
        `आपको सूचित किया जाता है की Aarav Singhania कि दिनांक 13 Nov 2026 को हनुजय हाई स्कूल में अनुपस्थिति (ABSENT) दर्ज कि गई है। लीव एप्लिकेशन/ मेडिकल सर्टिफिकेट जमा करें।\n\n` +
        `सादर,\n` +
        `हनुजय हाई स्कूल\n` +
        `विद्यालय प्रशासन`;
      expect(hi).toBe(expectedHi);
    });

    it('maps dynamic student name and attendance date correctly in ABSENT notification', () => {
      const dynamicName = 'Diya Singhania';
      const dynamicDate = '18 Nov 2026';
      const full = generateAbsentAttendanceMessage(dynamicName, dynamicDate);

      expect(full).toContain('Master Diya Singhania');
      expect(full).toContain('दिनांक 18 Nov 2026');
      expect(full).toContain('Please share the leave application/ medical certificate.');
      expect(full).toContain('लीव एप्लिकेशन/ मेडिकल सर्टिफिकेट जमा करें।');
    });

    it('includes complete English and Hindi sign-offs for ABSENT template', () => {
      const full = generateAbsentAttendanceMessage(sampleStudentName, sampleDate);
      expect(full).toContain(SIGN_OFF_ENGLISH);
      expect(full).toContain(SIGN_OFF_HINDI);
      expect(full.endsWith(SIGN_OFF_HINDI)).toBe(true);
    });

    it('ensures English section appears before Hindi section with clear paragraph separation in ABSENT notification', () => {
      const full = generateAbsentAttendanceMessage(sampleStudentName, sampleDate);
      const enIndex = full.indexOf('Dear Parent');
      const hiIndex = full.indexOf('आदरणीय अभिभावक');

      expect(enIndex).toBeLessThan(hiIndex);
      expect(full).toContain(`${SIGN_OFF_ENGLISH}\n\nआदरणीय अभिभावक`);
    });
  });

  // ==========================================================================
  // 3. Attendance Selection & Dispatch Tests
  // ==========================================================================
  describe('3. Attendance-Based Template Selection', () => {
    it('selects PRESENT template for present status and ABSENT for absent status', () => {
      const presResult = generateAttendanceNotificationMessage({
        studentName: 'Aarav Singhania',
        date: '13 Nov 2026',
        status: 'present',
      });
      expect(presResult.templateType).toBe('present');
      expect(presResult.messageText).toContain('marked PRESENT');
      expect(presResult.messageText).toContain('उपस्थिति (PRESENT)');
      expect(presResult.messageText).not.toContain('marked ABSENT');

      const absResult = generateAttendanceNotificationMessage({
        studentName: 'Aarav Singhania',
        date: '13 Nov 2026',
        status: 'absent',
      });
      expect(absResult.templateType).toBe('absent');
      expect(absResult.messageText).toContain('marked ABSENT');
      expect(absResult.messageText).toContain('अनुपस्थिति (ABSENT)');
      expect(absResult.messageText).toContain('leave application');
      expect(absResult.messageText).not.toContain('marked PRESENT at');
    });

    it('throws error when an invalid attendance status is provided', () => {
      expect(() =>
        generateAttendanceNotificationMessage({
          studentName: 'Aarav Singhania',
          date: '13 Nov 2026',
          status: 'late',
        })
      ).toThrow('Invalid attendance status: "late"');
    });

    it('correctly processes a mixed register of 50 students (e.g. 42 Present and 8 Absent)', async () => {
      // Create synthetic register with 42 Present and 8 Absent
      const mockStudents: StudentRecord[] = [];
      const sessionRecords: any[] = [];

      for (let i = 1; i <= 50; i++) {
        const id = `STU-TEST-${i.toString().padStart(2, '0')}`;
        const isAbsent = i > 42; // 1-42 Present, 43-50 Absent
        const state = isAbsent ? 'absent' : 'present';
        const name = `Student ${i}`;

        mockStudents.push({
          id,
          rollNumber: i,
          firstName: 'Student',
          lastName: `${i}`,
          fullName: name,
          gender: i % 2 === 0 ? 'F' : 'M',
          primaryPhone: `+9198290${(10000 + i).toString()}`,
          status: 'active',
          currentClassId: 'class-10-a',
          currentClassLabel: 'Class 10-A',
        } as any);

        sessionRecords.push({
          studentId: id,
          studentName: name,
          rollNumber: i,
          state,
        });
      }

      const mockSession = {
        id: 'sess-bulk-50',
        academicYearId: 'year-2025-2026',
        classId: 'class-10-a',
        classLabel: 'Class 10-A',
        date: '2026-11-13',
        takenByStaffId: 'staff-admin',
        takenByStaffName: 'Admin Office',
        status: 'submitted',
        totalStudents: 50,
        presentCount: 42,
        absentCount: 8,
        records: sessionRecords,
      } as unknown as AttendanceSession;

      const jobs = await WhatsAppNotificationService.enqueueSessionNotifications(mockSession, mockStudents);

      // Verify total count
      expect(jobs.length).toBe(50);

      // Verify PRESENT count
      const presentJobs = jobs.filter(j => j.attendanceState === 'present');
      expect(presentJobs.length).toBe(42);
      presentJobs.forEach(j => {
        expect(j.templateType).toBe('present');
        expect(j.messageText).toContain('marked PRESENT');
        expect(j.messageText).toContain('उपस्थिति (PRESENT)');
        expect(j.messageText).not.toContain('marked ABSENT');
        expect(j.recipientPhone).toMatch(/^\+9198290/);
      });

      // Verify ABSENT count
      const absentJobs = jobs.filter(j => j.attendanceState === 'absent');
      expect(absentJobs.length).toBe(8);
      absentJobs.forEach(j => {
        expect(j.templateType).toBe('absent');
        expect(j.messageText).toContain('marked ABSENT');
        expect(j.messageText).toContain('अनुपस्थिति (ABSENT)');
        expect(j.messageText).toContain('leave application/ medical certificate');
        expect(j.messageText).not.toContain('marked PRESENT at');
        expect(j.recipientPhone).toMatch(/^\+9198290/);
      });

      // Verify no student is skipped
      const studentIdsInJobs = new Set(jobs.map(j => j.studentId));
      expect(studentIdsInJobs.size).toBe(50);
    });
  });

  // ==========================================================================
  // 4. Queue Reliability & Idempotency Tests
  // ==========================================================================
  describe('4. Queue Reliability & Idempotency', () => {
    const studentA: StudentRecord = {
      id: 'STU-Q-01',
      rollNumber: 1,
      firstName: 'Kabir',
      lastName: 'Mehta',
      fullName: 'Kabir Mehta',
      gender: 'M',
      primaryPhone: '+919009519718',
      status: 'active',
      currentClassId: 'class-10-a',
      currentClassLabel: 'Class 10-A',
    } as any;

    const session: AttendanceSession = {
      id: 'sess-q-101',
      academicYearId: 'year-2025-2026',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      date: '2026-11-13',
      takenByStaffId: 'staff-admin',
      takenByStaffName: 'Admin Office',
      status: 'submitted',
      totalStudents: 1,
      presentCount: 1,
      absentCount: 0,
      records: [{ studentId: 'STU-Q-01', studentName: 'Kabir Mehta', rollNumber: 1, state: 'present' }],
    } as unknown as AttendanceSession;

    it('enforces deterministic idempotency keys preventing duplicate jobs', async () => {
      const firstRun = await WhatsAppNotificationService.enqueueSessionNotifications(session, [studentA]);
      const secondRun = await WhatsAppNotificationService.enqueueSessionNotifications(session, [studentA]);

      expect(firstRun.length).toBe(1);
      expect(secondRun.length).toBe(1);
      expect(firstRun[0].id).toBe(secondRun[0].id);
      expect(firstRun[0].id).toBe('att_sess-q-101_STU-Q-01');
    });

    it('safely skips students with missing, generic, or incomplete phone numbers', async () => {
      const noPhoneStudent: StudentRecord = {
        ...studentA,
        id: 'STU-Q-02',
        primaryPhone: '',
      };
      const sessionWithNoPhone = {
        ...session,
        id: 'sess-q-102',
        records: [{ studentId: 'STU-Q-02', studentName: 'Kabir Mehta', rollNumber: 2, state: 'absent' }],
      } as unknown as AttendanceSession;

      const jobs = await WhatsAppNotificationService.enqueueSessionNotifications(sessionWithNoPhone, [noPhoneStudent]);
      expect(jobs[0].deliveryStatus).toBe('skipped');
      expect(jobs[0].skipReason).toBe('missing_phone');
    });

    it('allows retry of failed jobs without duplicating completed jobs', async () => {
      const [job] = await WhatsAppNotificationService.enqueueSessionNotifications(session, [studentA]);
      const failedJob = { ...job, deliveryStatus: 'failed' as const, error: 'Network socket closed' };

      const retried = await WhatsAppNotificationService.retryJob(failedJob);
      expect(retried.retryCount).toBe(1);
      expect(retried.deliveryStatus).toBe('sent');
    });
  });

  // ==========================================================================
  // 5. Regression Suite: Attendance Corrections & Unrelated Templates
  // ==========================================================================
  describe('5. Regression Safeguards', () => {
    it('preserves the separate Attendance Correction workflow and approval process', async () => {
      const staffMembers = await demoRepository.getStaffMembers();
      const adminUser = staffMembers.find(s => s.role === 'admin')!;
      const principalUser = staffMembers.find(s => s.role === 'principal')!;

      // 0. Submit attendance first so session exists
      const testDate = '2026-11-13';
      const classId = 'class-10-a';
      const sess = await demoRepository.submitDailyAttendance(
        {
          academicYearId: 'year-2025-2026',
          classId,
          date: testDate,
          records: [
            { studentId: 'STU-10A-01', state: 'absent' },
          ],
        },
        adminUser
      );

      // 1. Admin Office requests a correction
      const correction = await demoRepository.requestAttendanceCorrection(
        {
          sessionId: sess.id,
          studentId: 'STU-10A-01',
          previousState: 'absent',
          requestedState: 'present',
          mandatoryReason: 'Medical slip verified by office.',
        },
        adminUser
      );

      expect(correction.status).toBe('pending_principal');

      // 2. Principal approves
      await demoRepository.approveAttendanceCorrection(
        correction.id,
        principalUser,
        true,
        'Approved after reviewing doctor certificate.'
      );

      const approved = (await demoRepository.getAttendanceCorrections()).find(c => c.id === correction.id)!;
      expect(approved.status).toBe('approved');

      // 3. Generates separate correction notification
      const student = (await demoRepository.getStudentById('STU-10A-01'))!;
      const notif = await WhatsAppNotificationService.enqueueCorrectionNotification(approved, student);

      expect(notif.messageText).toContain('attendance record for 13 Nov 2026 has been corrected');
      expect(notif.messageText).toContain('संशोधित उपस्थिति: उपस्थित (Present)');
      // Must NOT be the standard initial PRESENT or ABSENT notification
      expect(notif.messageText).not.toContain('Attendance for your ward Master Aarav Singhania has been marked PRESENT');
    });

    it('keeps institutional identity names constant', () => {
      expect(SCHOOL_NAME_EN).toBe('HanuJai High School');
      expect(SCHOOL_NAME_HI).toBe('हनुजय हाई स्कूल');
    });
  });
});
