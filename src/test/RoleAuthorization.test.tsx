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
      expect(Permissions.canApproveAttendanceCorrection(principal, 'staff-003')).toBe(false);
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
  // 2. CLASS TEACHER: FULL RESPONSIBILITY FOR ASSIGNED CLASS
  // =========================================================================
  describe('2. Class Teacher: Full Responsibility for Assigned Section', () => {
    // Shri Alok Saxena is Class Teacher of Class 10-A
    const getClassTeacher = () => initialStaff.find(s => s.role === 'class_teacher' && s.assignedClassId === 'class-10-a')!;

    it('Class Teacher can access assigned class (10-A) for class-teacher functions', () => {
      const classTeacher = getClassTeacher();

      expect(Permissions.canAccessSection(classTeacher, 'class-10-a')).toBe(true);
      expect(Permissions.canMarkAttendance(classTeacher, 'class-10-a')).toBe(true);
      expect(Permissions.canViewIndividualAttendance(classTeacher)).toBe(false);
      expect(Permissions.canViewIndividualAttendance(classTeacher, 'class-10-a')).toBe(true);
      expect(Permissions.canViewStudent(classTeacher, 'class-10-a')).toBe(true);
      expect(Permissions.canViewRiskWatchlist(classTeacher, 'class-10-a')).toBe(true);
    });

    it('Class Teacher can view cross-subject results matrix for assigned class 10-A', () => {
      const classTeacher = getClassTeacher();

      expect(Permissions.canAccessSubjectMarks(classTeacher, 'class-10-a', 'sub-math-10')).toBe(true);
      expect(Permissions.canAccessSubjectMarks(classTeacher, 'class-10-a', 'sub-sci-10')).toBe(true);
      expect(Permissions.canAccessSubjectMarks(classTeacher, 'class-10-a', 'sub-eng-10')).toBe(true);
      expect(Permissions.canAccessSubjectMarks(classTeacher, 'class-10-a', 'sub-hin-10')).toBe(true);
      expect(Permissions.canAccessSubjectMarks(classTeacher, 'class-10-a', 'sub-sst-10')).toBe(true);
    });

    it('Class Teacher is forbidden from marking attendance or viewing unrelated classes', () => {
      const classTeacher = getClassTeacher();

      expect(Permissions.canAccessSection(classTeacher, 'class-08-b')).toBe(false);
      expect(Permissions.canMarkAttendance(classTeacher, 'class-08-b')).toBe(false);
      expect(Permissions.canViewStudent(classTeacher, 'class-08-b')).toBe(false);
      expect(Permissions.canViewRiskWatchlist(classTeacher, 'class-08-b')).toBe(false);
    });

    it('Class Teacher attendance form saves attendance against proper session and students', async () => {
      const classTeacher = getClassTeacher();

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
        classTeacher
      );

      expect(session).toBeDefined();
      expect(session.classId).toBe('class-10-a');
      expect(session.markedByStaffId).toBe(classTeacher.id);
      expect(session.totalPresent).toBe(1);
      expect(session.totalAbsent).toBe(1);
    });
  });

  // =========================================================================
  // 3. SUBJECT TEACHER: ONLY ASSIGNED SUBJECTS AND CLASSES
  // =========================================================================
  describe('3. Subject Teacher: Scoped strictly to assigned subjects/classes', () => {
    // Smt. Priyanka Sen is Science teacher for Class 10-A and 10-B
    const getSubjectTeacher = () => initialStaff.find(s => s.role === 'subject_teacher' && s.id === 'staff-004')!;

    it('Subject Teacher can access assigned subject (Science) in assigned classes (10-A, 10-B)', () => {
      const subjectTeacher = getSubjectTeacher();

      expect(Permissions.canAccessSubjectMarks(subjectTeacher, 'class-10-a', 'sub-sci-10')).toBe(true);
      expect(Permissions.canEditMarks(subjectTeacher, 'class-10-a', 'sub-sci-10')).toBe(true);
      expect(Permissions.canAccessSubjectMarks(subjectTeacher, 'class-10-b', 'sub-sci-10')).toBe(true);
      expect(Permissions.canEditMarks(subjectTeacher, 'class-10-b', 'sub-sci-10')).toBe(true);
    });

    it('Subject Teacher CANNOT access other subjects (e.g. Mathematics, English)', () => {
      const subjectTeacher = getSubjectTeacher();

      expect(Permissions.canAccessSubjectMarks(subjectTeacher, 'class-10-a', 'sub-math-10')).toBe(false);
      expect(Permissions.canEditMarks(subjectTeacher, 'class-10-a', 'sub-math-10')).toBe(false);
      expect(Permissions.canAccessSubjectMarks(subjectTeacher, 'class-10-a', 'sub-eng-10')).toBe(false);
      expect(Permissions.canEditMarks(subjectTeacher, 'class-10-a', 'sub-eng-10')).toBe(false);
    });

    it('Subject Teacher cannot access individual attendance registers or absent lists', () => {
      const subjectTeacher = getSubjectTeacher();

      expect(Permissions.canMarkAttendance(subjectTeacher, 'class-10-a')).toBe(false);
      expect(Permissions.canViewIndividualAttendance(subjectTeacher)).toBe(false);
    });

    it('Subject Teacher cannot retrieve unrelated student records', () => {
      const subjectTeacher = getSubjectTeacher();

      // Class 01-A is unrelated to Smt. Priyanka Sen
      expect(Permissions.canViewStudent(subjectTeacher, 'class-01-a')).toBe(false);
      expect(Permissions.canViewRiskWatchlist(subjectTeacher, 'class-01-a')).toBe(false);
    });
  });

  // =========================================================================
  // 4. DUAL-RESPONSIBILITY TEACHER: SHRI ALOK SAXENA
  // =========================================================================
  describe('4. Dual-Responsibility Teacher (Class Teacher 10-A + Math across 10-A, 10-B, 9-A, 9-B)', () => {
    // Shri Alok Saxena: staff-003
    const getDualTeacher = () => initialStaff.find(s => s.id === 'staff-003')!;

    it('In Class 10-A context: can mark attendance and view all subjects marks', () => {
      const teacher = getDualTeacher();

      // Class teacher capabilities in 10-A
      expect(Permissions.canMarkAttendance(teacher, 'class-10-a')).toBe(true);
      expect(Permissions.canViewStudent(teacher, 'class-10-a')).toBe(true);
      expect(Permissions.canAccessSubjectMarks(teacher, 'class-10-a', 'sub-math-10')).toBe(true);
      expect(Permissions.canAccessSubjectMarks(teacher, 'class-10-a', 'sub-sci-10')).toBe(true);
      expect(Permissions.canAccessSubjectMarks(teacher, 'class-10-a', 'sub-eng-10')).toBe(true);
    });

    it('In Class 10-A Mathematics context: can enter Mathematics marks', () => {
      const teacher = getDualTeacher();

      expect(Permissions.canEditMarks(teacher, 'class-10-a', 'sub-math-10')).toBe(true);
      // In 10-A, Alok Saxena is NOT Science teacher, so cannot edit Science marks
      expect(Permissions.canEditMarks(teacher, 'class-10-a', 'sub-sci-10')).toBe(false);
    });

    it('In Classes 10-B, 9-A, 9-B: can enter Math marks and view aggregate attendance only', () => {
      const teacher = getDualTeacher();

      // 10-B context
      expect(Permissions.canEditMarks(teacher, 'class-10-b', 'sub-math-10')).toBe(true);
      expect(Permissions.canAccessSubjectMarks(teacher, 'class-10-b', 'sub-math-10')).toBe(true);
      // But CANNOT mark attendance in 10-B
      expect(Permissions.canMarkAttendance(teacher, 'class-10-b')).toBe(false);
      // CANNOT view other subject marks in 10-B
      expect(Permissions.canAccessSubjectMarks(teacher, 'class-10-b', 'sub-sci-10')).toBe(false);
      expect(Permissions.canAccessSubjectMarks(teacher, 'class-10-b', 'sub-eng-10')).toBe(false);

      // 09-A context
      expect(Permissions.canEditMarks(teacher, 'class-09-a', 'sub-math-09')).toBe(true);
      expect(Permissions.canMarkAttendance(teacher, 'class-09-a')).toBe(false);
      expect(Permissions.canAccessSubjectMarks(teacher, 'class-09-a', 'sub-sci-09')).toBe(false);

      // 09-B context
      expect(Permissions.canEditMarks(teacher, 'class-09-b', 'sub-math-09')).toBe(true);
      expect(Permissions.canMarkAttendance(teacher, 'class-09-b')).toBe(false);
      expect(Permissions.canAccessSubjectMarks(teacher, 'class-09-b', 'sub-sci-09')).toBe(false);
    });

    it('Class 10-A class-teacher privileges DO NOT leak into 10-B, 9-A, or 9-B', () => {
      const teacher = getDualTeacher();

      // Cannot access cumulative report card for a student in 10-B (subject teacher only)
      const student10B = { classId: 'class-10-b' } as any;
      expect(Permissions.canViewStudentReportCard(teacher, student10B)).toBe(false);

      // Cannot access cumulative report card for a student in 09-A
      const student09A = { classId: 'class-09-a' } as any;
      expect(Permissions.canViewStudentReportCard(teacher, student09A)).toBe(false);
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
  // 6. THREE PROFILES VERIFICATION & RESIDUAL OFFICE ROLE PURGE
  // =========================================================================
  describe('6. Strictly 3 Profiles in System', () => {
    it('All seed staff members belong strictly to the 3 permitted roles', () => {
      const allowedRoles = ['principal', 'class_teacher', 'subject_teacher'];
      initialStaff.forEach(staff => {
        expect(allowedRoles).toContain(staff.role);
        expect((staff.role as string)).not.toBe('office_admin');
        expect((staff.role as string)).not.toBe('office_staff');
      });
    });

    it('Unsupported legacy roles cannot access protected pages', async () => {
      const unsupportedUser = {
        id: 'staff-legacy',
        email: 'legacy@hanujai.edu.in',
        name: 'Legacy Office Staff',
        role: 'office_admin' as any,
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
