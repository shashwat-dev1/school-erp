import { describe, it, expect, beforeEach } from 'vitest';
import { WhatsAppNotificationService } from '../services/whatsapp/whatsappService';
import { DryRunWhatsAppProvider } from '../services/whatsapp/providers/dryRunProvider';
import { PHASE_CONFIG } from '../config/phase';
import type { AttendanceSession, StudentRecord } from '../domain/types';

describe('HanuJai ERP — Phase 1: Attendance & WhatsApp Notifications', () => {
  beforeEach(() => {
    localStorage.clear();
    WhatsAppNotificationService.setProvider(new DryRunWhatsAppProvider());
  });

  const mockStudents: StudentRecord[] = [
    {
      id: 'STU-101',
      admissionNumber: 'ADM/2023/101',
      rollNumber: 1,
      firstName: 'Aarav',
      lastName: 'Sharma',
      fullName: 'Aarav Sharma',
      gender: 'M',
      dateOfBirth: '2010-05-12',
      enrollmentDate: '2023-04-01',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      academicYearId: 'year-2025-2026',
      status: 'enrolled',
      guardianName: 'Ramesh Sharma',
      guardianRelation: 'Father',
      primaryPhone: '+91 98290 12345',
      residentialAddress: 'Jaipur, Rajasthan',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      attendancePercentage: 92.5,
      academicAverage: 84.0,
      activeFlags: [],
      createdAt: '2023-04-01T00:00:00Z',
      updatedAt: '2025-04-01T00:00:00Z',
    },
    {
      id: 'STU-102',
      admissionNumber: 'ADM/2023/102',
      rollNumber: 2,
      firstName: 'Diya',
      lastName: 'Patel',
      fullName: 'Diya Patel',
      gender: 'F',
      dateOfBirth: '2010-08-20',
      enrollmentDate: '2023-04-01',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      academicYearId: 'year-2025-2026',
      status: 'enrolled',
      guardianName: 'Sunita Patel',
      guardianRelation: 'Mother',
      primaryPhone: '+91 98290 54321',
      residentialAddress: 'Jaipur, Rajasthan',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      attendancePercentage: 88.0,
      academicAverage: 79.5,
      activeFlags: [],
      createdAt: '2023-04-01T00:00:00Z',
      updatedAt: '2025-04-01T00:00:00Z',
    },
    {
      id: 'STU-103',
      admissionNumber: 'ADM/2023/103',
      rollNumber: 3,
      firstName: 'Karan',
      lastName: 'Mehta',
      fullName: 'Karan Mehta',
      gender: 'M',
      dateOfBirth: '2010-11-05',
      enrollmentDate: '2023-04-01',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      academicYearId: 'year-2025-2026',
      status: 'enrolled',
      guardianName: 'Vijay Mehta',
      guardianRelation: 'Father',
      primaryPhone: '', // Missing phone for testing skip
      residentialAddress: 'Jaipur, Rajasthan',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      attendancePercentage: 90.0,
      academicAverage: 81.0,
      activeFlags: [],
      createdAt: '2023-04-01T00:00:00Z',
      updatedAt: '2025-04-01T00:00:00Z',
    },
  ];

  const mockSession: AttendanceSession = {
    id: 'att_class-10-a_2026-10-26',
    classId: 'class-10-a',
    classLabel: 'Class 10-A',
    date: '2026-10-26',
    academicYearId: 'year-2025-2026',
    takenByStaffId: 'teacher-1',
    takenByStaffName: 'Shri Rajeshwar Choudhary',
    takenAt: '2026-10-26T08:30:00Z',
    windowStart: '07:45',
    windowEnd: '09:15',
    isWindowOpen: true,
    status: 'submitted',
    totalStudents: 3,
    presentCount: 1,
    absentCount: 2,
    lateCount: 0,
    excusedCount: 0,
    records: [
      { studentId: 'STU-101', rollNumber: 1, studentName: 'Aarav Sharma', state: 'present' },
      { studentId: 'STU-102', rollNumber: 2, studentName: 'Diya Patel', state: 'absent' },
      { studentId: 'STU-103', rollNumber: 3, studentName: 'Karan Mehta', state: 'absent' },
    ],
  };

  it('Phase 1 scope enforces 2 selectable statuses: Present and Absent only', () => {
    expect(PHASE_CONFIG.phase1Only).toBe(true);
    expect(PHASE_CONFIG.features.allowLateStatus).toBe(false);
    expect(PHASE_CONFIG.features.dailyAttendance).toBe(true);
    expect(PHASE_CONFIG.features.whatsappNotifications).toBe(true);
    expect(PHASE_CONFIG.features.academicComparison).toBe(false);
  });

  it('enqueues notifications for BOTH Present and Absent students upon submission', async () => {
    const jobs = await WhatsAppNotificationService.enqueueSessionNotifications(mockSession, mockStudents);
    expect(jobs.length).toBe(3);

    // Present Student
    const presentJob = jobs.find(j => j.studentId === 'STU-101')!;
    expect(presentJob.attendanceState).toBe('present');
    expect(presentJob.messageText).toContain('has been marked PRESENT at HanuJai High School');
    expect(presentJob.messageText).toContain('Aarav Sharma');
    expect(presentJob.deliveryStatus).toBe('sent'); // In dry run mode, processed as simulated sent

    // Absent Student
    const absentJob = jobs.find(j => j.studentId === 'STU-102')!;
    expect(absentJob.attendanceState).toBe('absent');
    expect(absentJob.messageText).toContain('has been marked ABSENT at HanuJai High School');
    expect(absentJob.messageText).toContain('Diya Patel');
    expect(absentJob.deliveryStatus).toBe('sent');

    // Missing phone student is safely skipped
    const skippedJob = jobs.find(j => j.studentId === 'STU-103')!;
    expect(skippedJob.deliveryStatus).toBe('skipped');
    expect(skippedJob.skipReason).toBe('missing_phone');
  });

  it('generates deterministic idempotency keys preventing duplicate jobs', async () => {
    const firstRun = await WhatsAppNotificationService.enqueueSessionNotifications(mockSession, mockStudents);
    const secondRun = await WhatsAppNotificationService.enqueueSessionNotifications(mockSession, mockStudents);

    expect(firstRun.map(j => j.id)).toEqual(secondRun.map(j => j.id));
    expect(secondRun[0].id).toBe('att_att_class-10-a_2026-10-26_STU-101');

    const { stats } = await WhatsAppNotificationService.getSessionNotifications(mockSession.id);
    expect(stats.total).toBe(3);
    expect(stats.sent).toBe(2);
    expect(stats.skipped).toBe(1);
    expect(stats.failed).toBe(0);
  });

  it('supports safe retries for individual failed or unskipped jobs', async () => {
    const [job] = await WhatsAppNotificationService.enqueueSessionNotifications(mockSession, mockStudents);
    const failedJob = { ...job, deliveryStatus: 'failed' as const, error: 'Network timeout' };
    const retried = await WhatsAppNotificationService.retryJob(failedJob);

    expect(retried.retryCount).toBe(1);
    expect(retried.deliveryStatus).toBe('sent');
  });
});
