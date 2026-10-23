/**
 * HanuJai High School ERP — Central Authorization & Permission Policy
 * 
 * Enforces Role-Based Access Control (RBAC) and Assignment-Based Access Control (ABAC).
 * Supports exactly three user profiles: Principal, Class Teacher, Subject Teacher.
 * Dual-responsibility teachers hold separate assignments evaluated per class context.
 */

import type { StaffUser, StudentRecord } from './types';

export const Permissions = {
  /**
   * Section / Class Access:
   * - Principal: School-wide read-only oversight across all 20 sections.
   * - Class Teacher: Access to assigned class section and any sections where they teach a subject.
   * - Subject Teacher: Access strictly to sections where they are assigned to teach a subject.
   */
  canAccessSection(user: StaffUser | null, classId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    if (user.assignedClassId === classId) return true;
    return user.assignedClasses?.includes(classId) ?? false;
  },

  /**
   * Daily Attendance Register Marking:
   * - Principal: STRICTLY FORBIDDEN (Read-only oversight only).
   * - Class Teacher: ONLY for their explicitly assigned section.
   * - Subject Teacher: STRICTLY FORBIDDEN.
   */
  canMarkAttendance(user: StaffUser | null, classId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return false;
    return user.assignedClassId === classId;
  },

  /**
   * Individual Student Attendance Records & Absence Lists:
   * - Principal: Authorized to view individual student attendance histories and reports.
   * - Class Teacher: Authorized for students in their assigned section.
   * - Subject Teacher: FORBIDDEN from viewing individual absence lists (Aggregate counts only).
   */
  canViewIndividualAttendance(user: StaffUser | null, classId?: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    if (user.role === 'class_teacher') {
      return Boolean(classId && user.assignedClassId === classId);
    }
    return false;
  },

  /**
   * Attendance Correction Request:
   * - Class Teacher: Can request correction for students in their assigned section only.
   * - Principal: Cannot submit correction requests (Read-only).
   * - Subject Teacher: Forbidden.
   */
  canRequestAttendanceCorrection(user: StaffUser | null, classId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return false;
    return user.assignedClassId === classId;
  },

  /**
   * Attendance Correction Approval:
   * - Principal is strictly read-only in this pilot (no approvals or record modifications).
   */
  canApproveAttendanceCorrection(_user: StaffUser | null, _correctionOrRequesterId: unknown): boolean {
    return false;
  },

  /**
   * Subject Marks Access:
   * - Principal: School-wide read-only oversight across all subjects.
   * - Class Teacher: Consolidated marks across all subjects for their assigned section only.
   * - Subject Teacher: Strictly restricted to their assigned subject and classes.
   */
  canAccessSubjectMarks(user: StaffUser | null, classId: string, subjectId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    if (user.assignedClassId === classId) return true;
    
    const teachesSubject = user.assignedSubjects?.includes(subjectId) || user.assignedSubjectIds?.includes(subjectId);
    const teachesClass = user.assignedClasses?.includes(classId);
    return Boolean(teachesSubject && teachesClass);
  },

  /**
   * Marks Entry & Edit:
   * - Principal: STRICTLY FORBIDDEN (Read-only oversight).
   * - Faculty: ONLY permitted if the user has an explicit subject-teacher assignment
   *   for the requested class and subject.
   *   (A Class Teacher CANNOT enter marks unless they also teach that subject in that section).
   */
  canEditMarks(user: StaffUser | null, classId: string, subjectId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return false;

    const teachesSubject = user.assignedSubjects?.includes(subjectId) || user.assignedSubjectIds?.includes(subjectId);
    const teachesClass = user.assignedClasses?.includes(classId);
    return Boolean(teachesSubject && teachesClass);
  },

  /**
   * Student Master Record Access:
   * - Principal: School-wide access to all student dossiers.
   * - Class Teacher: Students in their assigned section.
   * - Subject Teacher: Students in their assigned classes.
   */
  canViewStudent(user: StaffUser | null, studentOrClassId: StudentRecord | string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    const targetClassId = typeof studentOrClassId === 'string' ? studentOrClassId : studentOrClassId.classId;
    if (user.assignedClassId === targetClassId) return true;
    return user.assignedClasses?.includes(targetClassId) ?? false;
  },

  /**
   * Risk Watchlist Access:
   * - Principal: Whole-school overview.
   * - Class Teacher: Scoped strictly to their assigned class.
   * - Subject Teacher: Forbidden from school-wide or cross-subject watchlist.
   */
  canViewRiskWatchlist(user: StaffUser | null, classId?: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    if (user.assignedClassId && classId) {
      return user.assignedClassId === classId;
    }
    return false;
  },

  /**
   * Formal Cumulative Student Report Card Access:
   * - Principal: Read-only download/print access for any student.
   * - Class Teacher: Students in their assigned section.
   * - Subject Teacher: Denied full multi-subject cumulative report cards.
   */
  canViewStudentReportCard(user: StaffUser | null, studentOrClassId: StudentRecord | string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    const targetClassId = typeof studentOrClassId === 'string' ? studentOrClassId : studentOrClassId.classId;
    return user.assignedClassId === targetClassId;
  },

  /**
   * Teacher Notes Logging:
   * - Principal: STRICTLY FORBIDDEN from creating/editing notes (Read-only oversight).
   * - Class Teacher: Can log notes for students in their assigned section.
   * - Subject Teacher: Forbidden by default (safest baseline assumption pending explicit confirmation).
   */
  canLogIncident(user: StaffUser | null, studentClassId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return false;
    // Safest baseline: Class Teacher for their assigned class section only
    return Boolean(user.role === 'class_teacher' && user.assignedClassId === studentClassId);
  },

  /**
   * System Audit Ledger:
   * - Principal: School-wide read-only audit visibility.
   */
  canViewAuditLog(user: StaffUser | null): boolean {
    return user?.role === 'principal';
  },

  /**
   * School Settings & Staff Administration Mutations:
   * - Denied across all roles in this pilot (Principal is strictly read-only).
   */
  canManageSettings(_user: StaffUser | null): boolean {
    return false;
  },

  canManageStaff(_user: StaffUser | null): boolean {
    return false;
  },
};
