/**
 * HanuJai High School ERP — Central Authorization & Permission Policy
 * 
 * Enforces Role-Based Access Control (RBAC) and Assignment-Based Access Control (ABAC).
 * Every sensitive read and mutation is verified against this policy.
 */

import type { StaffUser, AttendanceCorrection, StudentRecord } from './types';

export const Permissions = {
  /**
   * Section / Class Access:
   * - Principal & Office Admin: School-wide access to all 20 sections.
   * - Class Teacher: Access to assigned class section only (e.g. 'class-10-a').
   * - Subject Teacher: Access only to sections where they are assigned to teach a subject.
   */
  canAccessSection(user: StaffUser | null, classId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal' || user.role === 'office_admin') return true;
    if (user.role === 'class_teacher') {
      return user.assignedClassId === classId;
    }
    if (user.role === 'subject_teacher') {
      return user.assignedClasses?.includes(classId) ?? false;
    }
    return false;
  },

  /**
   * Daily Attendance Register Marking:
   * - Principal: May review or execute administrative override.
   * - Class Teacher: ONLY for their assigned section.
   * - Subject Teacher & Office Admin: No routine classroom attendance marking.
   */
  canMarkAttendance(user: StaffUser | null, classId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    if (user.role === 'class_teacher') {
      return user.assignedClassId === classId;
    }
    return false;
  },

  /**
   * Attendance Correction Request:
   * - Class Teacher: Can request correction for students in their assigned section.
   * - Principal: Can initiate administrative correction.
   */
  canRequestAttendanceCorrection(user: StaffUser | null, classId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    if (user.role === 'class_teacher') {
      return user.assignedClassId === classId;
    }
    return false;
  },

  /**
   * Dual-Custody Attendance Correction Approval:
   * - Principal: Can approve/reject.
   * - Rule SEC-201: The requester CANNOT approve their own correction!
   */
  canApproveAttendanceCorrection(
    user: StaffUser | null,
    correctionOrRequesterId: AttendanceCorrection | string
  ): boolean {
    if (!user) return false;
    if (user.role !== 'principal' && user.role !== 'admin') return false;
    const requesterId =
      typeof correctionOrRequesterId === 'string'
        ? correctionOrRequesterId
        : correctionOrRequesterId.requestedByStaffId;
    // Dual custody rule: Requester cannot self-approve
    if (user.id === requesterId) return false;
    return true;
  },

  /**
   * Subject Marks Access:
   * - Principal & Office Admin: Broad academic oversight across subjects.
   * - Class Teacher: Consolidated performance view for their assigned section only.
   * - Subject Teacher: Strictly restricted to their assigned subject and class!
   */
  canAccessSubjectMarks(user: StaffUser | null, classId: string, subjectId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal' || user.role === 'office_admin') return true;
    if (user.role === 'class_teacher') {
      // Class teacher can view consolidated performance for their section, but not edit unassigned subjects
      return user.assignedClassId === classId;
    }
    if (user.role === 'subject_teacher') {
      const teachesSubject = user.assignedSubjects?.includes(subjectId) || user.assignedSubjectIds?.includes(subjectId);
      const teachesClass = user.assignedClasses?.includes(classId);
      return Boolean(teachesSubject && teachesClass);
    }
    return false;
  },

  /**
   * Marks Entry & Edit:
   * - Subject Teacher: ONLY for assigned subject + class.
   * - Class Teacher: ONLY if separately assigned to teach that subject in that class.
   * - Principal: Academic administrative override.
   * - Office Admin: No marks entry.
   */
  canEditMarks(user: StaffUser | null, classId: string, subjectId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    if (user.role === 'subject_teacher' || user.role === 'class_teacher') {
      const teachesSubject = user.assignedSubjects?.includes(subjectId) || user.assignedSubjectIds?.includes(subjectId);
      const teachesClass = user.assignedClasses?.includes(classId);
      return Boolean(teachesSubject && teachesClass);
    }
    return false;
  },

  /**
   * Student Master Record Access:
   * - Principal & Office Admin: All student records for enrollment/office duties.
   * - Class Teacher: Students in their assigned section.
   * - Subject Teacher: Students in their assigned classes (academic/attendance context, no private contact fields).
   */
  canViewStudent(user: StaffUser | null, student: StudentRecord): boolean {
    if (!user) return false;
    if (user.role === 'principal' || user.role === 'office_admin') return true;
    if (user.role === 'class_teacher') {
      return user.assignedClassId === student.classId;
    }
    if (user.role === 'subject_teacher') {
      return user.assignedClasses?.includes(student.classId) ?? false;
    }
    return false;
  },

  /**
   * Risk Watchlist Access:
   * - Principal: Whole-school overview.
   * - Office Admin: Operational summary.
   * - Class Teacher: Scoped strictly to their assigned class. classId parameter is REQUIRED.
   * - Subject Teacher: No school-wide or cross-subject risk watchlist.
   */
  canViewRiskWatchlist(user: StaffUser | null, classId?: string): boolean {
    if (!user) return false;
    if (user.role === 'principal' || user.role === 'office_admin') return true;
    if (user.role === 'class_teacher') {
      // Must have an assigned class, and global (unscoped) risk watchlist is strictly forbidden
      if (!user.assignedClassId || !classId) return false;
      return user.assignedClassId === classId;
    }
    return false;
  },

  /**
   * Formal Cumulative Student Report Card Access:
   * - Principal & Office Admin: Broad institutional oversight.
   * - Class Teacher: ONLY for students in their assigned section.
   * - Subject Teacher: Denied full multi-subject cumulative report cards (must use subject-specific reports).
   */
  canViewStudentReportCard(user: StaffUser | null, student: StudentRecord): boolean {
    if (!user) return false;
    if (user.role === 'principal' || user.role === 'office_admin') return true;
    if (user.role === 'class_teacher') {
      return Boolean(user.assignedClassId && user.assignedClassId === student.classId);
    }
    return false;
  },

  /**
   * Behaviour & Incident Logging:
   * - Principal & Class Teacher: Full proctorial access and logging.
   * - Subject Teacher: Can log observations for students in their assigned classes.
   * - Office Admin: Operational view only.
   */
  canLogIncident(user: StaffUser | null, studentClassId: string): boolean {
    if (!user) return false;
    if (user.role === 'principal') return true;
    if (user.role === 'class_teacher') {
      return user.assignedClassId === studentClassId;
    }
    if (user.role === 'subject_teacher') {
      return user.assignedClasses?.includes(studentClassId) ?? false;
    }
    return false;
  },

  /**
   * System Audit Ledger:
   * - Principal ONLY has school-wide audit visibility.
   */
  canViewAuditLog(user: StaffUser | null): boolean {
    return user?.role === 'principal';
  },

  /**
   * School Identity & System Policy Settings:
   * - Principal ONLY.
   */
  canManageSettings(user: StaffUser | null): boolean {
    return user?.role === 'principal';
  },

  /**
   * Faculty Allocations & Staff Directory:
   * - Principal & Office Admin.
   */
  canManageStaff(user: StaffUser | null): boolean {
    return user?.role === 'principal' || user?.role === 'office_admin';
  },
};
