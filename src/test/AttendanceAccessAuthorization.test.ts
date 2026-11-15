import { describe, it, expect, beforeEach } from 'vitest';
import { Permissions, DEFAULT_ROLE_PERMISSIONS } from '../domain/permissions';
import type { StaffUser, AttendanceCorrection } from '../domain/types';

describe('HanuJai ERP — Attendance Authorization & Role Access Control', () => {
  const mockAdminOffice: StaffUser = {
    id: 'staff-admin',
    name: 'Admin Office',
    email: 'admin@hanujai.edu.in',
    role: 'admin',
    employeeCode: 'EMP-ADMIN-01',
    designation: 'Administrative Officer',
    department: 'School Administration',
    phone: '+91 98290 11002',
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
  };

  const mockPrincipal: StaffUser = {
    id: 'staff-001',
    name: 'Dr. Vikramaditya Sharma',
    email: 'principal@hanujai.edu.in',
    role: 'principal',
    employeeCode: 'EMP-1998-001',
    designation: 'Principal & Head of School',
    department: 'School Administration',
    phone: '+91 98290 11001',
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
  };

  const mockDeveloper: StaffUser = {
    id: 'staff-dev',
    name: 'System Developer',
    email: 'developer@hanujai.edu.in',
    role: 'developer',
    employeeCode: 'DEV-001',
    designation: 'Lead Systems Architect & Administrator',
    department: 'System Architecture & Infrastructure',
    phone: '+91 98290 00001',
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    // Reset permissions to baseline
    Permissions.setRolePermissions(DEFAULT_ROLE_PERMISSIONS, false);
  });

  describe('1. Attendance Register Access Gates', () => {
    it('Admin Office MUST be authorized to view attendance registers', () => {
      expect(Permissions.canViewAttendance(mockAdminOffice)).toBe(true);
      expect(Permissions.canViewAttendanceRegister(mockAdminOffice)).toBe(true);
      expect(Permissions.canAccessSection(mockAdminOffice, 'class-10-a')).toBe(true);
      expect(Permissions.hasPermission(mockAdminOffice, 'attendance', 'view')).toBe(true);
    });

    it('Principal MUST be authorized to view attendance registers in read-only mode', () => {
      expect(Permissions.canViewAttendance(mockPrincipal)).toBe(true);
      expect(Permissions.canViewAttendanceRegister(mockPrincipal)).toBe(true);
      expect(Permissions.canAccessSection(mockPrincipal, 'class-10-a')).toBe(true);
      expect(Permissions.hasPermission(mockPrincipal, 'attendance', 'view')).toBe(true);
    });

    it('Developer MUST have unrestricted access to view attendance registers', () => {
      expect(Permissions.canViewAttendance(mockDeveloper)).toBe(true);
      expect(Permissions.canViewAttendanceRegister(mockDeveloper)).toBe(true);
      expect(Permissions.canAccessSection(mockDeveloper, 'class-10-a')).toBe(true);
      expect(Permissions.hasPermission(mockDeveloper, 'attendance', 'view')).toBe(true);
    });

    it('Inactive or null users must be rejected from viewing attendance registers', () => {
      expect(Permissions.canViewAttendance(null)).toBe(false);
      expect(Permissions.canViewAttendance({ ...mockAdminOffice, status: 'suspended' })).toBe(false);
      expect(Permissions.canViewAttendance({ ...mockPrincipal, status: 'deactivated' })).toBe(false);
    });
  });

  describe('2. Separation of Viewing vs Marking/Submitting Permissions', () => {
    it('Admin Office can mark and submit initial attendance', () => {
      expect(Permissions.canMarkAttendance(mockAdminOffice, 'class-10-a')).toBe(true);
      expect(Permissions.canSubmitAttendance(mockAdminOffice, 'class-10-a')).toBe(true);
      expect(Permissions.hasPermission(mockAdminOffice, 'attendance', 'create')).toBe(true);
    });

    it('Principal is STRICTLY FORBIDDEN from marking or submitting initial attendance', () => {
      expect(Permissions.canMarkAttendance(mockPrincipal, 'class-10-a')).toBe(false);
      expect(Permissions.canSubmitAttendance(mockPrincipal, 'class-10-a')).toBe(false);
      expect(Permissions.hasPermission(mockPrincipal, 'attendance', 'create')).toBe(false);
    });

    it('Developer can mark and submit initial attendance', () => {
      expect(Permissions.canMarkAttendance(mockDeveloper, 'class-10-a')).toBe(true);
      expect(Permissions.canSubmitAttendance(mockDeveloper, 'class-10-a')).toBe(true);
      expect(Permissions.hasPermission(mockDeveloper, 'attendance', 'create')).toBe(true);
    });
  });

  describe('3. Attendance History & Export Permissions', () => {
    it('All three active roles can view attendance history and exports', () => {
      expect(Permissions.canViewAttendanceHistory(mockAdminOffice)).toBe(true);
      expect(Permissions.canExportAttendance(mockAdminOffice)).toBe(true);

      expect(Permissions.canViewAttendanceHistory(mockPrincipal)).toBe(true);
      expect(Permissions.canExportAttendance(mockPrincipal)).toBe(true);

      expect(Permissions.canViewAttendanceHistory(mockDeveloper)).toBe(true);
      expect(Permissions.canExportAttendance(mockDeveloper)).toBe(true);
    });
  });

  describe('4. Attendance Correction & Dual-Custody Approval Rules', () => {
    const sampleCorrection: AttendanceCorrection = {
      id: 'corr-001',
      sessionId: 'sess-10-a-2026-11-15',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      studentId: 'stu-10a-01',
      studentName: 'Aarav Sharma',
      date: '2026-11-15',
      previousState: 'present',
      requestedState: 'absent',
      mandatoryReason: 'Entered present by mistake; parent reported sick leave in morning',
      requestedByStaffId: 'staff-admin',
      requestedByStaffName: 'Admin Office',
      requestedAt: '2026-11-15T09:30:00Z',
      status: 'pending_principal',
    };

    it('Admin Office can request attendance corrections but CANNOT approve corrections', () => {
      expect(Permissions.canRequestAttendanceCorrection(mockAdminOffice)).toBe(true);
      expect(Permissions.canApproveAttendanceCorrection(mockAdminOffice, sampleCorrection)).toBe(false);
      expect(Permissions.canRejectAttendanceCorrection(mockAdminOffice, sampleCorrection)).toBe(false);
    });

    it('Principal CAN approve and reject attendance corrections requested by Admin Office', () => {
      expect(Permissions.canApproveAttendanceCorrection(mockPrincipal, sampleCorrection)).toBe(true);
      expect(Permissions.canRejectAttendanceCorrection(mockPrincipal, sampleCorrection)).toBe(true);
    });

    it('Rule SEC-201 (Dual Custody): Requester CANNOT approve their own correction', () => {
      const devRequestedCorrection: AttendanceCorrection = {
        ...sampleCorrection,
        id: 'corr-dev-01',
        requestedByStaffId: mockDeveloper.id,
      };
      // Even Super Admin / Developer cannot self-approve their own request
      expect(Permissions.canApproveAttendanceCorrection(mockDeveloper, devRequestedCorrection)).toBe(false);
      expect(Permissions.canRejectAttendanceCorrection(mockDeveloper, devRequestedCorrection)).toBe(false);

      // Principal CAN approve Developer request
      expect(Permissions.canApproveAttendanceCorrection(mockPrincipal, devRequestedCorrection)).toBe(true);
    });

    it('Developer can approve corrections requested by Admin Office', () => {
      expect(Permissions.canApproveAttendanceCorrection(mockDeveloper, sampleCorrection)).toBe(true);
      expect(Permissions.canRejectAttendanceCorrection(mockDeveloper, sampleCorrection)).toBe(true);
    });
  });

  describe('5. Role String Normalization & Resilient User Evaluation', () => {
    it('Normalizes variant role representations (e.g. admin_office, ADMIN, Admin)', () => {
      const legacyAdmin1: any = { ...mockAdminOffice, role: 'admin_office' };
      const legacyAdmin2: any = { ...mockAdminOffice, role: 'ADMIN' };
      const legacyAdmin3: any = { ...mockAdminOffice, role: 'Admin' };

      expect(Permissions.canViewAttendance(legacyAdmin1)).toBe(true);
      expect(Permissions.canMarkAttendance(legacyAdmin1)).toBe(true);

      expect(Permissions.canViewAttendance(legacyAdmin2)).toBe(true);
      expect(Permissions.canMarkAttendance(legacyAdmin2)).toBe(true);

      expect(Permissions.canViewAttendance(legacyAdmin3)).toBe(true);
      expect(Permissions.canMarkAttendance(legacyAdmin3)).toBe(true);
    });

    it('Tolerates missing status field on Firestore staff user documents by defaulting to active', () => {
      const userWithoutStatus: any = {
        id: 'staff-admin',
        name: 'Admin Office',
        email: 'admin@hanujai.edu.in',
        role: 'admin',
      };
      expect(Permissions.canViewAttendance(userWithoutStatus)).toBe(true);
      expect(Permissions.canMarkAttendance(userWithoutStatus)).toBe(true);
    });
  });

  describe('6. Dynamic Permission Configuration by Developer', () => {
    it('Developer can configure Admin Office permissions dynamically', () => {
      expect(Permissions.canManagePermissions(mockDeveloper)).toBe(true);
      expect(Permissions.canManagePermissions(mockAdminOffice)).toBe(false);
      expect(Permissions.canManagePermissions(mockPrincipal)).toBe(false);

      // Developer restricts Admin Office export temporarily
      Permissions.setRolePermissions({
        ...DEFAULT_ROLE_PERMISSIONS,
        admin: {
          ...DEFAULT_ROLE_PERMISSIONS.admin,
          attendance: {
            ...DEFAULT_ROLE_PERMISSIONS.admin.attendance,
            export: false,
          },
        },
      }, false);

      expect(Permissions.canViewAttendance(mockAdminOffice)).toBe(true);
      expect(Permissions.canExportAttendance(mockAdminOffice)).toBe(false);

      // Reset
      Permissions.setRolePermissions(DEFAULT_ROLE_PERMISSIONS, false);
      expect(Permissions.canExportAttendance(mockAdminOffice)).toBe(true);
    });
  });
});
