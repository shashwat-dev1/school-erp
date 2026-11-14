/**
 * HanuJai High School ERP — Central Authorization & Permission Policy
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Centralized Role-Based Access Control (RBAC) for Operating Model:
 * 1. Principal: School-wide executive supervision, viewing and reporting. Strictly READ-ONLY.
 * 2. Admin Office (admin): Complete student directory access and daily attendance data entry for ALL classes.
 * 3. Developer / Root Admin (developer): Reserved for future phase. Server-side provisioned.
 * 
 * Classroom teacher accounts are deactivated in this operating phase; classroom attendance
 * is taken on physical registers and entered into the ERP centrally by the Admin Office.
 */

import type { StaffUser, StudentRecord } from './types';

export const Permissions = {
  /**
   * Section / Class Access:
   * - Principal: School-wide read-only oversight across all configured classes.
   * - Admin Office: Full administrative access across all configured classes.
   * - Deactivated teacher accounts: No active access.
   */
  canAccessSection(user: StaffUser | null, _classId?: string): boolean {
    if (!user || user.status !== 'active') return false;
    return user.role === 'principal' || user.role === 'admin' || user.role === 'developer';
  },

  /**
   * Daily Attendance Register Marking:
   * - Principal: STRICTLY FORBIDDEN (Strictly read-only oversight).
   * - Admin Office: Authorized for ALL configured school classes (centralized entry).
   * - Deactivated teacher accounts: Strictly forbidden.
   */
  canMarkAttendance(user: StaffUser | null, _classId?: string): boolean {
    if (!user || user.status !== 'active') return false;
    if (user.role === 'principal') return false;
    return user.role === 'admin' || user.role === 'developer';
  },

  /**
   * Attendance Submission:
   * - Principal: STRICTLY FORBIDDEN.
   * - Admin Office: Authorized to submit attendance registers one class at a time.
   */
  canSubmitAttendance(user: StaffUser | null, _classId?: string): boolean {
    if (!user || user.status !== 'active') return false;
    if (user.role === 'principal') return false;
    return user.role === 'admin' || user.role === 'developer';
  },

  /**
   * Individual Student Attendance Records & Absence Lists:
   * - Principal: Authorized to view individual student attendance histories and reports.
   * - Admin Office: Authorized to view individual student attendance histories and reports.
   */
  canViewIndividualAttendance(user: StaffUser | null, _classId?: string): boolean {
    if (!user || user.status !== 'active') return false;
    return user.role === 'principal' || user.role === 'admin' || user.role === 'developer';
  },

  /**
   * Attendance Correction Request / Application:
   * - Principal: Cannot submit correction requests (Strictly read-only).
   * - Admin Office: Authorized to correct submitted registers under school policy.
   */
  canRequestAttendanceCorrection(user: StaffUser | null, _classId?: string): boolean {
    if (!user || user.status !== 'active') return false;
    if (user.role === 'principal') return false;
    return user.role === 'admin' || user.role === 'developer';
  },

  /**
   * Attendance Correction Approval:
   * - Dual-custody correction approval is disabled in Phase 1 (Principal is strictly read-only).
   */
  canApproveAttendanceCorrection(_user: StaffUser | null, _correctionOrRequesterId: unknown): boolean {
    return false;
  },

  /**
   * Student Master Record Access:
   * - Principal: School-wide access to all student profiles (read-only).
   * - Admin Office: School-wide access to all student profiles.
   */
  canViewStudent(user: StaffUser | null, _studentOrClassId?: StudentRecord | string): boolean {
    if (!user || user.status !== 'active') return false;
    return user.role === 'principal' || user.role === 'admin' || user.role === 'developer';
  },

  /**
   * Student Contact Modification:
   * - Principal: Strictly read-only.
   * - Admin Office: Authorized for student information maintenance.
   */
  canEditStudentContact(user: StaffUser | null, _studentOrClassId?: StudentRecord | string): boolean {
    if (!user || user.status !== 'active') return false;
    if (user.role === 'principal') return false;
    return user.role === 'admin' || user.role === 'developer';
  },

  /**
   * Attendance Reports & Excel Export:
   * - Principal: Authorized to download and inspect attendance reports.
   * - Admin Office: Authorized to download and inspect attendance reports.
   */
  canExportAttendance(user: StaffUser | null): boolean {
    if (!user || user.status !== 'active') return false;
    return user.role === 'principal' || user.role === 'admin' || user.role === 'developer';
  },

  /**
   * Formal Cumulative Student Report Card Access:
   * - Principal: Read-only access.
   * - Admin Office: Authorized access.
   */
  canViewStudentReportCard(user: StaffUser | null, _studentOrClassId?: StudentRecord | string): boolean {
    if (!user || user.status !== 'active') return false;
    return user.role === 'principal' || user.role === 'admin' || user.role === 'developer';
  },

  /**
   * System Audit Ledger:
   * - Principal: School-wide read-only audit visibility.
   * - Admin Office: Authorized audit inspection.
   */
  canViewAuditLog(user: StaffUser | null): boolean {
    if (!user || user.status !== 'active') return false;
    return user.role === 'principal' || user.role === 'admin' || user.role === 'developer';
  },

  /**
   * System Settings Management:
   * - Denied across all regular operational accounts.
   */
  canManageSettings(user: StaffUser | null): boolean {
    return Boolean(user && user.status === 'active' && user.role === 'developer');
  },

  canManageStaff(user: StaffUser | null): boolean {
    return Boolean(user && user.status === 'active' && user.role === 'developer');
  },

  /**
   * Student Documents Management:
   * - Principal: Read-only access (canViewStudentDocuments, canDownloadStudentDocument)
   * - Admin Office: Full access (upload, replace, delete, download, view)
   */
  canViewStudentDocuments(user: StaffUser | null): boolean {
    if (!user || user.status !== 'active') return false;
    return user.role === 'principal' || user.role === 'admin' || user.role === 'developer';
  },

  canDownloadStudentDocument(user: StaffUser | null): boolean {
    if (!user || user.status !== 'active') return false;
    return user.role === 'principal' || user.role === 'admin' || user.role === 'developer';
  },

  canUploadStudentDocument(user: StaffUser | null): boolean {
    if (!user || user.status !== 'active') return false;
    if (user.role === 'principal') return false;
    return user.role === 'admin' || user.role === 'developer';
  },

  canDeleteStudentDocument(user: StaffUser | null): boolean {
    if (!user || user.status !== 'active') return false;
    if (user.role === 'principal') return false;
    return user.role === 'admin' || user.role === 'developer';
  },

  // Legacy stubs kept for interface compatibility with any existing tests
  canAccessSubjectMarks(user: StaffUser | null, _classId?: string, _subjectId?: string): boolean {
    return user?.role === 'principal' || user?.role === 'admin';
  },

  canEditMarks(_user: StaffUser | null, _classId?: string, _subjectId?: string): boolean {
    return false;
  },

  canViewRiskWatchlist(user: StaffUser | null, _classId?: string): boolean {
    return user?.role === 'principal' || user?.role === 'admin';
  },

  canLogIncident(_user: StaffUser | null, _studentClassId?: string): boolean {
    return false;
  },
};
