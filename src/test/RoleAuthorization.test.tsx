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

describe('Role Authorization & Security Boundary Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    if (demoRepository.resetDemoData) {
      await demoRepository.resetDemoData();
    }
  });

  const setupUserSession = (staffUser: StaffUser) => {
    localStorage.setItem('hanujai_demo_user_id', staffUser.id);
  };

  it('Principal Dashboard renders whole-school oversight (1,000 enrollment, all-class attendance)', async () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
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
      expect(screen.getByText(/Present Today/i)).toBeInTheDocument();
      expect(screen.getByText(/Attendance by Class/i)).toBeInTheDocument();
    });

    // Check that active enrollment derivation is 1,000 (20 sections × 50 students)
    expect(screen.getByText(/1000/i)).toBeInTheDocument();
  });

  it('Office Staff Dashboard renders operational directory lookup without teacher-specific marks registers', async () => {
    const officeStaff = initialStaff.find(s => s.role === 'office_admin' || s.role === 'office_staff')!;
    setupUserSession(officeStaff);

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
      expect(screen.getByText(/Parent & Visitor Inquiry/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Students/i)).toBeInTheDocument();
    });
  });

  it('Class Teacher Dashboard is strictly scoped to assigned class (Class 10-A) with zero global metrics', async () => {
    const classTeacher = initialStaff.find(s => s.role === 'class_teacher')!;
    setupUserSession(classTeacher);

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
      expect(screen.getByText(/My Class \(Class 10-A\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Present Today/i)).toBeInTheDocument();
      expect(screen.getByText(/Absent Students Today/i)).toBeInTheDocument();
    });

    // Class teacher must NOT see whole-school metrics
    expect(screen.queryByText(/Attendance by Class \(Today\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Institutional Executive Desk/i)).not.toBeInTheDocument();
  });

  it('Subject Teacher Dashboard is scoped to assigned teaching assignments with zero whole-school roll call', async () => {
    const subjectTeacher = initialStaff.find(s => s.role === 'subject_teacher')!;
    setupUserSession(subjectTeacher);

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
      expect(screen.getAllByText(/My Classes/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Marks Registers/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Assigned Classes/i)[0]).toBeInTheDocument();
    });

    // Subject teacher must not see whole-school attendance or unassigned classes
    expect(screen.queryByText(/Attendance by Class \(Today\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Present Today/i)).not.toBeInTheDocument();
  });

  it('SectionGuard denies class teacher from accessing an unassigned class attendance register', async () => {
    const classTeacher = initialStaff.find(s => s.role === 'class_teacher')!; // assigned to class-10-a
    setupUserSession(classTeacher);

    render(
      <MemoryRouter initialEntries={['/attendance/register/class-08-b']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Attendance Roll-Call Unauthorized/i)).toBeInTheDocument();
      expect(screen.getByText(/You are not authorized to mark attendance for section/i)).toBeInTheDocument();
    });
  });

  it('RoleGuard blocks Class Teacher from accessing System Configuration (/settings/system-config)', async () => {
    const classTeacher = initialStaff.find(s => s.role === 'class_teacher')!;
    setupUserSession(classTeacher);

    render(
      <MemoryRouter initialEntries={['/settings/system-config']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Desk Authorization Policy/i)).toBeInTheDocument();
      expect(screen.getByText(/Your current role/i)).toBeInTheDocument();
    });
  });

  it('RoleGuard blocks Subject Teacher from accessing Audit Log (/audit-log)', async () => {
    const subjectTeacher = initialStaff.find(s => s.role === 'subject_teacher')!;
    setupUserSession(subjectTeacher);

    render(
      <MemoryRouter initialEntries={['/audit-log']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Desk Authorization Policy/i)).toBeInTheDocument();
      expect(screen.getByText(/Your current role/i)).toBeInTheDocument();
    });
  });

  it('Permissions: SEC-201 dual custody prevents self-approval of attendance corrections', () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    const classTeacher = initialStaff.find(s => s.role === 'class_teacher')!;

    // Case 1: Class teacher requested, principal reviewing -> APPROVED
    const canApproveNormal = Permissions.canApproveAttendanceCorrection(principal, classTeacher.id);
    expect(canApproveNormal).toBe(true);

    // Case 2: Principal requested, same principal tries to approve -> FORBIDDEN (dual custody)
    const canApproveSelf = Permissions.canApproveAttendanceCorrection(principal, principal.id);
    expect(canApproveSelf).toBe(false);

    // Case 3: Class teacher tries to approve -> FORBIDDEN
    const canClassTeacherApprove = Permissions.canApproveAttendanceCorrection(classTeacher, 'staff-001');
    expect(canClassTeacherApprove).toBe(false);
  });

  it('Permissions: Subject teacher cannot edit marks for an unassigned subject/class', () => {
    const subjectTeacher = initialStaff.find(s => s.role === 'subject_teacher')!; // assigned to sub-math-10 for class-10-a, 10-b, 09-a

    // Can edit assigned: Math for Class 10-A
    expect(Permissions.canEditMarks(subjectTeacher, 'class-10-a', 'sub-math-10')).toBe(true);

    // CANNOT edit unassigned subject: Science for Class 10-A
    expect(Permissions.canEditMarks(subjectTeacher, 'class-10-a', 'sub-sci-10')).toBe(false);

    // CANNOT edit unassigned class: Math for Class 06-A
    expect(Permissions.canEditMarks(subjectTeacher, 'class-06-a', 'sub-math-10')).toBe(false);
  });

  it('Policy: calculateGrade accurately follows CBSE 9-point grading scale', () => {
    const maxMarks = 100;
    expect(calculateGrade(95, maxMarks).grade).toBe('A1');
    expect(calculateGrade(85, maxMarks).grade).toBe('A2');
    expect(calculateGrade(75, maxMarks).grade).toBe('B1');
    expect(calculateGrade(65, maxMarks).grade).toBe('B2');
    expect(calculateGrade(55, maxMarks).grade).toBe('C1');
    expect(calculateGrade(45, maxMarks).grade).toBe('C2');
    expect(calculateGrade(35, maxMarks).grade).toBe('D');
    expect(calculateGrade(25, maxMarks).grade).toBe('E1');
    expect(calculateGrade(15, maxMarks).grade).toBe('E2');
    expect(calculateGrade(null, maxMarks).grade).toBe('—');
  });

  it('Policy: morning roll-call window accurately checks window boundary', () => {
    // Window is 07:45 - 09:15
    expect(isMorningRollCallWindowOpen('08:00')).toBe(true);
    expect(isMorningRollCallWindowOpen('07:44')).toBe(false);
    expect(isMorningRollCallWindowOpen('09:16')).toBe(false);
  });

  it('Permissions: canViewRiskWatchlist fails closed without explicit classId for Class Teacher', () => {
    const classTeacher = initialStaff.find(s => s.role === 'class_teacher')!;
    const subjectTeacher = initialStaff.find(s => s.role === 'subject_teacher')!;
    const principal = initialStaff.find(s => s.role === 'principal')!;

    // Principal can view without or with classId
    expect(Permissions.canViewRiskWatchlist(principal)).toBe(true);
    expect(Permissions.canViewRiskWatchlist(principal, 'class-10-a')).toBe(true);

    // Class Teacher can ONLY view when explicit matching classId is supplied
    expect(Permissions.canViewRiskWatchlist(classTeacher, classTeacher.assignedClassId)).toBe(true);
    expect(Permissions.canViewRiskWatchlist(classTeacher, 'class-01-a')).toBe(false);
    // Crucial P0 test: Missing classId MUST fail closed to prevent whole-school risk leakage
    expect(Permissions.canViewRiskWatchlist(classTeacher)).toBe(false);

    // Subject Teacher cannot view risk watchlist
    expect(Permissions.canViewRiskWatchlist(subjectTeacher)).toBe(false);
    expect(Permissions.canViewRiskWatchlist(subjectTeacher, 'class-10-a')).toBe(false);
  });

  it('Permissions: canViewStudentReportCard restricts cumulative report cards to Principal, Office, and assigned Class Teacher', () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    const officeAdmin = initialStaff.find(s => s.role === 'office_admin')!;
    const classTeacher10A = initialStaff.find(s => s.role === 'class_teacher' && s.assignedClassId === 'class-10-a')!;
    const subjectTeacher = initialStaff.find(s => s.role === 'subject_teacher')!; // Alok Saxena (Math 10-A, 10-B, 09-A)

    const student10A = { classId: 'class-10-a' } as any;
    const student01A = { classId: 'class-01-a' } as any;

    // Principal and Office have school-wide clearance
    expect(Permissions.canViewStudentReportCard(principal, student10A)).toBe(true);
    expect(Permissions.canViewStudentReportCard(officeAdmin, student01A)).toBe(true);

    // Class Teacher has clearance for their section only
    expect(Permissions.canViewStudentReportCard(classTeacher10A, student10A)).toBe(true);
    expect(Permissions.canViewStudentReportCard(classTeacher10A, student01A)).toBe(false);

    // Subject Teacher does NOT have clearance for cumulative 5-subject report cards (even for classes they teach)
    expect(Permissions.canViewStudentReportCard(subjectTeacher, student10A)).toBe(false);
  });

  it('Security Boundary: Direct URL to unauthorized student report card renders AccessDenied', async () => {
    const classTeacher10A = initialStaff.find(s => s.role === 'class_teacher' && s.assignedClassId === 'class-10-a')!;
    setupUserSession(classTeacher10A);

    // Student from Class 01-A
    render(
      <MemoryRouter initialEntries={['/reports/report-card/STU-01A-01']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Report Authorization Boundary/i)).toBeInTheDocument();
      expect(screen.getByText(/not authorized to access cumulative 5-subject report cards/i)).toBeInTheDocument();
    });
  });

  it('Security Boundary: Direct URL to unassigned class attendance register renders AccessDenied', async () => {
    const classTeacher10A = initialStaff.find(s => s.role === 'class_teacher' && s.assignedClassId === 'class-10-a')!;
    setupUserSession(classTeacher10A);

    render(
      <MemoryRouter initialEntries={['/attendance/register/class-01-a']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Attendance Roll-Call Unauthorized/i)).toBeInTheDocument();
      expect(screen.getByText(/You are not authorized to mark attendance for section/i)).toBeInTheDocument();
    });
  });
});
