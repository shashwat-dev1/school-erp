import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { DataContextProvider } from '../context/DataContext';
import { App } from '../App';
import { demoRepository } from '../data/demo/demoRepository';
import { initialStaff } from '../data/demo/seedData';
import { Permissions } from '../domain/permissions';
import { calculateGrade, isMorningRollCallWindowOpen } from '../domain/policy';
import type { StaffUser } from '../domain/types';

describe('HANUJAI ERP — Role Model, Student Dossier & Permission Test Matrix', () => {
  beforeEach(async () => {
    localStorage.clear();
    if (demoRepository.resetDemoData) {
      await demoRepository.resetDemoData();
    }
  });

  const setupUserSession = (staffUser: StaffUser) => {
    localStorage.setItem('hanujai_demo_user_id', staffUser.id);
  };

  // =========================================================================
  // 1. PRINCIPAL: SCHOOL-WIDE, STRICTLY READ-ONLY ACCESS
  // =========================================================================
  describe('1. Principal: School-Wide, Strictly Read-Only Oversight', () => {
    const getPrincipal = () => initialStaff.find(s => s.role === 'principal')!;

    it('Principal can view whole-school dashboard with calculated counts for ~1,000 students', async () => {
      const principal = getPrincipal();
      setupUserSession(principal);

      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <DataContextProvider>
              <App />
            </DataContextProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Home/i)[0]).toBeInTheDocument();
        expect(screen.getByText(/Total Students/i)).toBeInTheDocument();
        expect(screen.getByText(/1000/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Present Today/i)[0]).toBeInTheDocument();
        expect(screen.getAllByText(/Absent Today/i)[0]).toBeInTheDocument();
        expect(screen.getByText(/Attendance by Class \(Today\)/i)).toBeInTheDocument();
      });
    });

    it('Principal can search for any student across the school and open dossier', async () => {
      const principal = getPrincipal();
      setupUserSession(principal);

      // Verify repository allows principal to search any student
      const allStudents = await demoRepository.getStudents({ limit: 1000 });
      expect(allStudents.total).toBe(1000);

      // Student from 10-A and Student from 01-B
      const stu10A = await demoRepository.getStudentById('STU-10A-01');
      const stu01B = await demoRepository.getStudentById('STU-01B-01');
      expect(stu10A).not.toBeNull();
      expect(stu01B).not.toBeNull();

      // Permissions check: Principal can view any student dossier
      expect(Permissions.canViewStudent(principal, stu10A!.classId)).toBe(true);
      expect(Permissions.canViewStudent(principal, stu01B!.classId)).toBe(true);
      expect(Permissions.canViewStudentReportCard(principal, stu10A!)).toBe(true);
      expect(Permissions.canViewStudentReportCard(principal, stu01B!)).toBe(true);
    });

    it('Principal can view attendance totals and history, but cannot mark attendance', () => {
      const principal = getPrincipal();

      // Permissions check
      expect(Permissions.canAccessSection(principal, 'class-10-a')).toBe(true);
      expect(Permissions.canViewIndividualAttendance(principal)).toBe(true);
      expect(Permissions.canMarkAttendance(principal, 'class-10-a')).toBe(false);
      expect(Permissions.canMarkAttendance(principal, 'class-01-a')).toBe(false);
      // Principal CAN approve corrections requested by others, but NOT self
      expect(Permissions.canApproveAttendanceCorrection(principal, 'staff-003')).toBe(true);
      expect(Permissions.canApproveAttendanceCorrection(principal, principal.id)).toBe(false);
    });

    it('Data Layer Guard: Principal cannot mutate attendance, students, marks, notes, staff, or settings', async () => {
      const principal = getPrincipal();

      // Attempt 1: submit daily attendance
      await expect(
        demoRepository.submitDailyAttendance(
          {
            classId: 'class-10-a',
            date: '2026-10-23',
            academicYearId: 'year-2025-2026',
            records: [],
          },
          principal
        )
      ).rejects.toThrow(/Principal cannot mark or edit|Principal has strictly read-only access/i);

      // Attempt 2: save marks register
      await expect(
        demoRepository.saveMarksRegister(
          {
            assessmentId: 'assess-ut2-2025',
            classId: 'class-10-a',
            subjectId: 'sub-math-10',
            entries: [],
            isDraft: false,
          },
          principal
        )
      ).rejects.toThrow(/Principal has strictly read-only access/i);

      // Attempt 3: create student note / incident
      await expect(
        demoRepository.createIncident(
          {
            studentId: 'STU-10A-01',
            category: 'conduct_discipline',
            title: 'Test Note',
            description: 'Test note content',
            severity: 'notice',
          },
          principal
        )
      ).rejects.toThrow(/Principal has strictly read-only access/i);

      // Attempt 4: create staff member
      await expect(
        demoRepository.createStaffMember(
          {
            displayName: 'Test Staff',
            email: 'test@hanujai.edu.in',
            role: 'subject_teacher',
          },
          principal
        )
      ).rejects.toThrow(/Principal has strictly read-only access/i);

      // Attempt 5: update school settings
      await expect(
        demoRepository.updateSchoolSettings(
          {
            schoolName: 'Hacked School Name',
          },
          principal
        )
      ).rejects.toThrow(/Principal has strictly read-only access/i);
    });
  });

  // =========================================================================
  // 2. ADMIN OFFICE: FULL ATTENDANCE MARKING & STUDENT DIRECTORY ACROSS ALL CLASSES
  // =========================================================================
  describe('2. Admin Office: Centralized Daily Attendance & Operations Across All Classes', () => {
    const getAdminOffice = () => initialStaff.find(s => s.role === 'admin')!;

    it('Admin Office can access any class (10-A, 10-B, 08-B, 01-A) for attendance entry', () => {
      const admin = getAdminOffice();

      expect(Permissions.canAccessSection(admin, 'class-10-a')).toBe(true);
      expect(Permissions.canAccessSection(admin, 'class-10-b')).toBe(true);
      expect(Permissions.canAccessSection(admin, 'class-08-b')).toBe(true);
      expect(Permissions.canAccessSection(admin, 'class-01-a')).toBe(true);

      expect(Permissions.canMarkAttendance(admin, 'class-10-a')).toBe(true);
      expect(Permissions.canMarkAttendance(admin, 'class-10-b')).toBe(true);
      expect(Permissions.canSubmitAttendance(admin, 'class-10-a')).toBe(true);

      expect(Permissions.canViewIndividualAttendance(admin)).toBe(true);
      expect(Permissions.canViewStudent(admin, 'class-10-a')).toBe(true);
      expect(Permissions.canExportAttendance(admin)).toBe(true);
      expect(Permissions.canEditStudentContact(admin)).toBe(true);
    });

    it('Admin Office attendance submission saves attendance against proper session and students', async () => {
      const admin = getAdminOffice();

      const session = await demoRepository.submitDailyAttendance(
        {
          classId: 'class-10-a',
          date: '2026-10-23',
          academicYearId: 'year-2025-2026',
          records: [
            { studentId: 'STU-10A-01', state: 'present', remarks: 'On time' },
            { studentId: 'STU-10A-02', state: 'absent', remarks: 'Medical leave' },
          ],
        },
        admin
      );

      expect(session).toBeDefined();
      expect(session.classId).toBe('class-10-a');
      expect(session.markedByStaffId).toBe(admin.id);
      expect(session.totalPresent).toBe(1);
      expect(session.totalAbsent).toBe(1);
    });
  });

  // =========================================================================
  // 3. DEACTIVATED TEACHER ACCOUNTS: REVOKED ACTIVE LOGIN & PERMISSION ACCESS
  // =========================================================================
  describe('3. Deactivated Teacher Accounts: Revoked Active Login & Permissions', () => {
    const getClassTeacher = () => initialStaff.find(s => s.role === 'class_teacher')!;
    const getSubjectTeacher = () => initialStaff.find(s => s.role === 'subject_teacher')!;

    it('Class Teacher accounts are deactivated and denied active attendance marking', () => {
      const classTeacher = getClassTeacher();
      expect(classTeacher.status).toBe('deactivated');
      expect(Permissions.canAccessSection(classTeacher, 'class-10-a')).toBe(false);
      expect(Permissions.canMarkAttendance(classTeacher, 'class-10-a')).toBe(false);
      expect(Permissions.canSubmitAttendance(classTeacher, 'class-10-a')).toBe(false);
      expect(Permissions.canViewIndividualAttendance(classTeacher)).toBe(false);
      expect(Permissions.canViewStudent(classTeacher, 'class-10-a')).toBe(false);
    });

    it('Subject Teacher accounts are deactivated and denied marks and attendance access', () => {
      const subjectTeacher = getSubjectTeacher();
      expect(subjectTeacher.status).toBe('deactivated');
      expect(Permissions.canAccessSection(subjectTeacher, 'class-10-a')).toBe(false);
      expect(Permissions.canMarkAttendance(subjectTeacher, 'class-10-a')).toBe(false);
      expect(Permissions.canEditMarks(subjectTeacher, 'class-10-a', 'sub-sci-10')).toBe(false);
      expect(Permissions.canViewIndividualAttendance(subjectTeacher)).toBe(false);
    });

    it('Deactivated teachers are forbidden from submitting daily attendance in repository', async () => {
      const classTeacher = getClassTeacher();
      await expect(
        demoRepository.submitDailyAttendance(
          {
            classId: 'class-10-a',
            date: '2026-10-23',
            academicYearId: 'year-2025-2026',
            records: [
              { studentId: 'STU-10A-01', state: 'present' },
            ],
          },
          classTeacher
        )
      ).rejects.toThrow(/Only Admin Office is authorized to submit daily classroom attendance/i);
    });
  });

  // =========================================================================
  // 4. DEVELOPER / ROOT ADMIN ARCHITECTURE READINESS
  // =========================================================================
  describe('4. Developer / Root Admin Architecture Readiness', () => {
    it('Developer role is ready in permission architecture but hidden from active user lists', () => {
      const mockDeveloper: StaffUser = {
        id: 'staff-root',
        email: 'root@hanujai.edu.in',
        name: 'Root Developer',
        role: 'developer',
        status: 'active',
        employeeCode: 'EMP-DEV-00',
        designation: 'Lead Developer',
        department: 'Information Technology',
        phone: '+91 98290 00000',
        createdAt: '2026-11-13T00:00:00.000Z',
      };

      // Developer has system access when provisioned
      expect(Permissions.canAccessSection(mockDeveloper, 'class-10-a')).toBe(true);
      expect(Permissions.canMarkAttendance(mockDeveloper, 'class-10-a')).toBe(true);
      expect(Permissions.canManageSettings(mockDeveloper)).toBe(true);

      // Verify no developer account is in default initialStaff seeds
      const seedDeveloper = initialStaff.find(s => s.role === 'developer');
      expect(seedDeveloper).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. MARKS VALIDATION & CANONICAL REGISTER INTEGRITY
  // =========================================================================
  describe('5. Marks Validation & Register Integrity', () => {
    it('Rejects scores exceeding maxMarks in repository', async () => {
      const teacher = initialStaff.find(s => s.id === 'staff-003')!;

      await expect(
        demoRepository.saveMarksRegister(
          {
            assessmentId: 'assess-ut2-2025',
            classId: 'class-10-a',
            subjectId: 'sub-math-10',
            entries: [
              { studentId: 'STU-10A-01', marksObtained: 999, isAbsent: false }, // Max is 25!
            ],
            isDraft: false,
          },
          teacher
        )
      ).rejects.toThrow(/exceeds maximum permitted/i);
    });

    it('Rejects negative scores in repository', async () => {
      const teacher = initialStaff.find(s => s.id === 'staff-003')!;

      await expect(
        demoRepository.saveMarksRegister(
          {
            assessmentId: 'assess-ut2-2025',
            classId: 'class-10-a',
            subjectId: 'sub-math-10',
            entries: [
              { studentId: 'STU-10A-01', marksObtained: -5, isAbsent: false },
            ],
            isDraft: false,
          },
          teacher
        )
      ).rejects.toThrow(/cannot be negative/i);
    });

    it('Distinguishes missing marks (null) from zero (0)', async () => {
      const teacher = initialStaff.find(s => s.id === 'staff-003')!;

      const register = await demoRepository.saveMarksRegister(
        {
          assessmentId: 'assess-ut2-2025',
          classId: 'class-10-a',
          subjectId: 'sub-math-10',
          entries: [
            { studentId: 'STU-10A-01', marksObtained: 0, isAbsent: false },    // Scored zero
            { studentId: 'STU-10A-02', marksObtained: null, isAbsent: false }, // Unmarked / missing
          ],
          isDraft: true,
        },
        teacher
      );

      const entry1 = register.entries.find(e => e.studentId === 'STU-10A-01')!;
      const entry2 = register.entries.find(e => e.studentId === 'STU-10A-02')!;

      expect(entry1.marksObtained).toBe(0);
      expect(entry1.grade).toBe('E2'); // Scored 0%

      expect(entry2.marksObtained).toBeNull();
      expect(entry2.grade).toBe('—'); // Pending
    });

    it('Accurately maps CBSE 9-point scale', () => {
      const maxMarks = 100;
      expect(calculateGrade(95, maxMarks).grade).toBe('A1');
      expect(calculateGrade(85, maxMarks).grade).toBe('A2');
      expect(calculateGrade(75, maxMarks).grade).toBe('B1');
      expect(calculateGrade(65, maxMarks).grade).toBe('B2');
      expect(calculateGrade(55, maxMarks).grade).toBe('C1');
      expect(calculateGrade(45, maxMarks).grade).toBe('C2');
      expect(calculateGrade(35, maxMarks).grade).toBe('D');
      expect(calculateGrade(25, maxMarks).grade).toBe('E1');
      expect(calculateGrade(10, maxMarks).grade).toBe('E2');
      expect(calculateGrade(null, maxMarks).grade).toBe('—');
    });

    it('Morning roll-call window validator checks 07:45 - 09:15 boundary', () => {
      expect(isMorningRollCallWindowOpen('08:00')).toBe(true);
      expect(isMorningRollCallWindowOpen('07:45')).toBe(true);
      expect(isMorningRollCallWindowOpen('09:15')).toBe(true);
      expect(isMorningRollCallWindowOpen('07:44')).toBe(false);
      expect(isMorningRollCallWindowOpen('09:16')).toBe(false);
    });
  });

  // =========================================================================
  // 6. OPERATING MODEL PROFILES & ACCESS ENFORCEMENT
  // =========================================================================
  describe('6. Strictly 2 Active Roles in Operating Model', () => {
    it('Active staff members belong strictly to the 2 permitted roles: principal and admin', () => {
      const activeStaff = initialStaff.filter(s => s.status === 'active');
      expect(activeStaff.length).toBe(2);
      const activeRoles = activeStaff.map(s => s.role);
      expect(activeRoles).toContain('principal');
      expect(activeRoles).toContain('admin');
      expect(activeRoles).not.toContain('class_teacher');
      expect(activeRoles).not.toContain('subject_teacher');
      expect(activeRoles).not.toContain('office_admin');
    });

    it('Unsupported legacy roles cannot access protected pages', async () => {
      const unsupportedUser = {
        id: 'staff-legacy',
        email: 'legacy@hanujai.edu.in',
        name: 'Legacy Office Staff',
        role: 'office_admin' as any,
        status: 'active' as any,
      };
      localStorage.setItem('hanujai_demo_user_override', JSON.stringify(unsupportedUser));

      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <DataContextProvider>
              <App />
            </DataContextProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // Unsupported role is denied by RoleDashboardRouter
        expect(screen.getAllByText(/Access Restricted/i)[0]).toBeInTheDocument();
      });
    });
  });
});
