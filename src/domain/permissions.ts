/**
 * HanuJai High School ERP — Central Authorization & Granular Permission Policy
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Operating Model:
 * 1. Developer: Super Administrator with unrestricted access. Top authority in the ERP.
 *    Only an authorized Developer can create or assign Developer accounts, manage users,
 *    and configure the dynamic role permission matrix.
 * 2. Principal: School-wide executive supervision. By default strictly READ-ONLY.
 *    Individual permissions are configurable by Developer without redeploying code.
 * 3. Admin Office (admin): Operational school administration.
 *    Individual permissions are configurable by Developer without redeploying code.
 * 
 * Classroom teacher accounts are deactivated in this operating phase; classroom attendance
 * is taken on physical registers and entered into the ERP centrally.
 */

import type {
  StaffUser,
  StaffRole,
  StudentRecord,
  AttendanceCorrection,
  PermissionModule,
  PermissionAction,
  RolePermissions,
  ModulePermissions,
  PermissionPreset,
  ActiveStaffRole,
} from './types';

const STORAGE_KEY_ROLE_PERMISSIONS = 'hanujai_role_permissions_v2';

/**
 * Default Baseline Permissions Matrix.
 * Developer has complete unconstrained system administration.
 * Admin Office starts with full operational capabilities.
 * Principal starts strictly read-only.
 */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  developer: {
    students: { view: true, create: true, edit: true, delete: true, export: true, manage: true },
    attendance: { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, manage: true },
    documents: { view: true, upload: true, download: true, edit: true, delete: true, approve: true, reject: true, manage: true },
    parent_requests: { view: true, create: true, revoke: true, send_whatsapp: true, export: true, manage: true },
    whatsapp: { view: true, send_whatsapp: true, manage: true },
    excel_import: { view: true, create: true, edit: true, manage: true },
    data_export: { view: true, export: true, manage: true },
    classes: { view: true, create: true, edit: true, delete: true, manage: true },
    users: { view: true, create: true, edit: true, delete: true, revoke: true, manage: true },
    database: { view: true, export: true, manage: true },
    audit: { view: true, export: true, manage: true },
    settings: { view: true, edit: true, manage: true },
  },
  admin: {
    students: { view: true, create: true, edit: true, delete: false, export: true, manage: false },
    attendance: { view: true, create: true, edit: true, delete: false, approve: false, reject: false, export: true, manage: false },
    documents: { view: true, upload: true, download: true, edit: true, delete: true, approve: true, reject: true, manage: false },
    parent_requests: { view: true, create: true, revoke: true, send_whatsapp: true, export: true, manage: false },
    whatsapp: { view: true, send_whatsapp: true, manage: false },
    excel_import: { view: true, create: true, edit: true, manage: false },
    data_export: { view: true, export: true, manage: false },
    classes: { view: true, create: false, edit: false, delete: false, manage: false },
    users: { view: true, create: false, edit: false, delete: false, manage: false },
    database: { view: false, export: false, manage: false },
    audit: { view: true, export: false, manage: false },
    settings: { view: false, edit: false, manage: false },
  },
  principal: {
    students: { view: true, create: false, edit: false, delete: false, export: true, manage: false },
    attendance: { view: true, create: false, edit: false, delete: false, approve: true, reject: true, export: true, manage: false },
    documents: { view: true, upload: false, download: true, edit: false, delete: false, approve: false, reject: false, manage: false },
    parent_requests: { view: true, create: false, revoke: false, send_whatsapp: false, export: true, manage: false },
    whatsapp: { view: true, send_whatsapp: false, manage: false },
    excel_import: { view: false, create: false, edit: false, manage: false },
    data_export: { view: true, export: true, manage: false },
    classes: { view: true, create: false, edit: false, delete: false, manage: false },
    users: { view: true, create: false, edit: false, delete: false, manage: false },
    database: { view: false, export: false, manage: false },
    audit: { view: true, export: true, manage: false },
    settings: { view: false, edit: false, manage: false },
  },
};

// In-memory permission cache
let activeRolePermissions: RolePermissions = { ...DEFAULT_ROLE_PERMISSIONS };

/**
 * Initialize role permissions from storage if present, with deep-merging to ensure fallback
 * to default module permissions if any module/action is omitted in cached storage.
 */
function initRolePermissions(): RolePermissions {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_ROLE_PERMISSIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          developer: { ...DEFAULT_ROLE_PERMISSIONS.developer }, // Developer cannot be tampered
          admin: {
            ...DEFAULT_ROLE_PERMISSIONS.admin,
            ...(parsed.admin || {}),
            students: { ...DEFAULT_ROLE_PERMISSIONS.admin.students, ...(parsed.admin?.students || {}) },
            attendance: { ...DEFAULT_ROLE_PERMISSIONS.admin.attendance, ...(parsed.admin?.attendance || {}) },
            documents: { ...DEFAULT_ROLE_PERMISSIONS.admin.documents, ...(parsed.admin?.documents || {}) },
            parent_requests: { ...DEFAULT_ROLE_PERMISSIONS.admin.parent_requests, ...(parsed.admin?.parent_requests || {}) },
            whatsapp: { ...DEFAULT_ROLE_PERMISSIONS.admin.whatsapp, ...(parsed.admin?.whatsapp || {}) },
            excel_import: { ...DEFAULT_ROLE_PERMISSIONS.admin.excel_import, ...(parsed.admin?.excel_import || {}) },
            data_export: { ...DEFAULT_ROLE_PERMISSIONS.admin.data_export, ...(parsed.admin?.data_export || {}) },
            classes: { ...DEFAULT_ROLE_PERMISSIONS.admin.classes, ...(parsed.admin?.classes || {}) },
            users: { ...DEFAULT_ROLE_PERMISSIONS.admin.users, ...(parsed.admin?.users || {}) },
            database: { ...DEFAULT_ROLE_PERMISSIONS.admin.database, ...(parsed.admin?.database || {}) },
            audit: { ...DEFAULT_ROLE_PERMISSIONS.admin.audit, ...(parsed.admin?.audit || {}) },
            settings: { ...DEFAULT_ROLE_PERMISSIONS.admin.settings, ...(parsed.admin?.settings || {}) },
          },
          principal: {
            ...DEFAULT_ROLE_PERMISSIONS.principal,
            ...(parsed.principal || {}),
            students: { ...DEFAULT_ROLE_PERMISSIONS.principal.students, ...(parsed.principal?.students || {}) },
            attendance: { ...DEFAULT_ROLE_PERMISSIONS.principal.attendance, ...(parsed.principal?.attendance || {}) },
            documents: { ...DEFAULT_ROLE_PERMISSIONS.principal.documents, ...(parsed.principal?.documents || {}) },
            parent_requests: { ...DEFAULT_ROLE_PERMISSIONS.principal.parent_requests, ...(parsed.principal?.parent_requests || {}) },
            whatsapp: { ...DEFAULT_ROLE_PERMISSIONS.principal.whatsapp, ...(parsed.principal?.whatsapp || {}) },
            excel_import: { ...DEFAULT_ROLE_PERMISSIONS.principal.excel_import, ...(parsed.principal?.excel_import || {}) },
            data_export: { ...DEFAULT_ROLE_PERMISSIONS.principal.data_export, ...(parsed.principal?.data_export || {}) },
            classes: { ...DEFAULT_ROLE_PERMISSIONS.principal.classes, ...(parsed.principal?.classes || {}) },
            users: { ...DEFAULT_ROLE_PERMISSIONS.principal.users, ...(parsed.principal?.users || {}) },
            database: { ...DEFAULT_ROLE_PERMISSIONS.principal.database, ...(parsed.principal?.database || {}) },
            audit: { ...DEFAULT_ROLE_PERMISSIONS.principal.audit, ...(parsed.principal?.audit || {}) },
            settings: { ...DEFAULT_ROLE_PERMISSIONS.principal.settings, ...(parsed.principal?.settings || {}) },
          },
        };
      }
    } catch {
      // Fallback to default
    }
  }
  return { ...DEFAULT_ROLE_PERMISSIONS };
}

activeRolePermissions = initRolePermissions();

export const Permissions = {
  /**
   * Retrieve active role permissions matrix.
   */
  getRolePermissions(): RolePermissions {
    return activeRolePermissions;
  },

  /**
   * Update active role permissions matrix dynamically.
   * Can be configured by Developer without code redeployment.
   */
  setRolePermissions(permissions: RolePermissions, persist = true): void {
    activeRolePermissions = {
      developer: { ...DEFAULT_ROLE_PERMISSIONS.developer }, // Developer cannot be restricted
      admin: { ...permissions.admin },
      principal: { ...permissions.principal },
    };

    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_ROLE_PERMISSIONS, JSON.stringify(activeRolePermissions));
      } catch (err) {
        console.warn('Failed to persist role permissions:', err);
      }
    }
  },

  /**
   * Core Granular Authorization Evaluator.
   * Evaluates if a given staff user has authorization for a specific module action.
   * 
   * Strict Rules:
   * 1. Inactive or null users always return false.
   * 2. Developer is the Super Administrator and ALWAYS has permission for every module and action.
   * 3. Principal and Admin Office are evaluated against the dynamic permission matrix.
   * 4. Normalizes legacy/variant roles and provides default fallbacks.
   */
  hasPermission(
    user: StaffUser | null,
    module: PermissionModule,
    action: PermissionAction
  ): boolean {
    if (!user) return false;

    // Resilient status check: default to 'active' if status is omitted
    const userStatus = user.status || 'active';
    if (userStatus !== 'active') return false;

    // Normalize role string representation
    const rawRole = (user.role || '').toLowerCase().trim();
    if (rawRole === 'developer' || rawRole === 'dev' || rawRole === 'system_admin' || rawRole === 'sysadmin') {
      return true; // Super Administrator: unrestricted
    }

    let role: ActiveStaffRole | null = null;
    if (rawRole === 'principal' || rawRole === 'head' || rawRole === 'director') {
      role = 'principal';
    } else if (rawRole === 'admin' || rawRole === 'admin_office') {
      role = 'admin';
    }

    if (!role) return false;

    const rolePerms = activeRolePermissions[role];
    if (!rolePerms) {
      const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[role];
      const defaultModulePerms = defaultRolePerms ? defaultRolePerms[module] : null;
      return Boolean(defaultModulePerms && defaultModulePerms[action]);
    }

    const modulePerms = rolePerms[module];
    if (!modulePerms) {
      const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[role];
      const defaultModulePerms = defaultRolePerms ? defaultRolePerms[module] : null;
      return Boolean(defaultModulePerms && defaultModulePerms[action]);
    }

    if (modulePerms[action] !== undefined) {
      return Boolean(modulePerms[action]);
    }

    const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[role];
    const defaultModulePerms = defaultRolePerms ? defaultRolePerms[module] : null;
    return Boolean(defaultModulePerms && defaultModulePerms[action]);
  },

  /**
   * Super Administrator Access Check:
   * Only Developer accounts can manage users, assign Developer roles, or edit permissions.
   * Principal and Admin Office can NEVER elevate themselves or manage permissions.
   */
  canManagePermissions(user: StaffUser | null): boolean {
    if (!user) return false;
    const status = user.status || 'active';
    const role = (user.role || '').toLowerCase().trim();
    return status === 'active' && (role === 'developer' || role === 'dev' || role === 'system_admin');
  },

  canAccessDeveloperConsole(user: StaffUser | null): boolean {
    return this.canManagePermissions(user);
  },

  canManageStaff(user: StaffUser | null): boolean {
    return this.canManagePermissions(user);
  },

  canManageDatabase(user: StaffUser | null): boolean {
    return this.canManagePermissions(user);
  },

  canManageSettings(user: StaffUser | null): boolean {
    return this.canManagePermissions(user);
  },

  // ==========================================================================
  // Student Management Modules
  // ==========================================================================
  canAccessSection(user: StaffUser | null, _classId?: string): boolean {
    return this.hasPermission(user, 'classes', 'view') || this.hasPermission(user, 'attendance', 'view');
  },

  canViewStudent(user: StaffUser | null, _studentOrClassId?: StudentRecord | string): boolean {
    return this.hasPermission(user, 'students', 'view');
  },

  canCreateStudent(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'students', 'create');
  },

  canEditStudentContact(user: StaffUser | null, _studentOrClassId?: StudentRecord | string): boolean {
    return this.hasPermission(user, 'students', 'edit');
  },

  canDeleteStudent(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'students', 'delete');
  },

  canExportStudents(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'data_export', 'export') || this.hasPermission(user, 'students', 'export');
  },

  canImportStudents(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'excel_import', 'create') || this.hasPermission(user, 'excel_import', 'edit');
  },

  // ==========================================================================
  // Attendance Management Modules
  // ==========================================================================
  canViewAttendance(user: StaffUser | null, _classId?: string): boolean {
    return this.hasPermission(user, 'attendance', 'view');
  },

  canViewAttendanceRegister(user: StaffUser | null, _classId?: string): boolean {
    return this.hasPermission(user, 'attendance', 'view');
  },

  canViewAttendanceHistory(user: StaffUser | null, _classId?: string): boolean {
    return this.hasPermission(user, 'attendance', 'view') || this.hasPermission(user, 'attendance', 'export');
  },

  canMarkAttendance(user: StaffUser | null, _classId?: string): boolean {
    return this.hasPermission(user, 'attendance', 'create');
  },

  canSubmitAttendance(user: StaffUser | null, _classId?: string): boolean {
    return this.hasPermission(user, 'attendance', 'create');
  },

  canViewIndividualAttendance(user: StaffUser | null, _classId?: string): boolean {
    return this.hasPermission(user, 'attendance', 'view');
  },

  canRequestAttendanceCorrection(user: StaffUser | null, _classId?: string): boolean {
    return this.hasPermission(user, 'attendance', 'edit');
  },

  canManageAttendancePermissions(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'attendance', 'manage');
  },

  canApproveAttendanceCorrection(
    user: StaffUser | null,
    correctionOrRequesterId?: AttendanceCorrection | string | null
  ): boolean {
    if (!user || user.status !== 'active') return false;

    // Rule: Admin Office cannot approve attendance corrections
    if (user.role === 'admin') return false;

    // Rule SEC-201: Requester cannot approve their own correction (Dual Custody)
    if (correctionOrRequesterId) {
      const requesterId =
        typeof correctionOrRequesterId === 'string'
          ? correctionOrRequesterId
          : correctionOrRequesterId.requestedByStaffId;
      if (requesterId && requesterId === user.id) {
        return false;
      }
    }

    if (user.role === 'developer') return true;

    if (user.role === 'principal') {
      return this.hasPermission(user, 'attendance', 'approve');
    }

    return false;
  },

  canRejectAttendanceCorrection(
    user: StaffUser | null,
    correctionOrRequesterId?: AttendanceCorrection | string | null
  ): boolean {
    return this.canApproveAttendanceCorrection(user, correctionOrRequesterId);
  },

  canExportAttendance(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'attendance', 'export');
  },

  canViewStudentReportCard(user: StaffUser | null, _studentOrClassId?: StudentRecord | string): boolean {
    return this.hasPermission(user, 'students', 'view');
  },

  // ==========================================================================
  // Student Documents & Parent Requests Modules
  // ==========================================================================
  canViewStudentDocuments(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'documents', 'view');
  },

  canDownloadStudentDocument(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'documents', 'download');
  },

  canUploadStudentDocument(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'documents', 'upload');
  },

  canDeleteStudentDocument(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'documents', 'delete');
  },

  canApproveDocument(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'documents', 'approve');
  },

  canRejectDocument(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'documents', 'reject');
  },

  canRequestParentDocuments(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'parent_requests', 'create');
  },

  canRevokeParentInvitation(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'parent_requests', 'revoke');
  },

  canSendWhatsAppReminders(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'whatsapp', 'send_whatsapp');
  },

  // ==========================================================================
  // Audit Ledger & Classes
  // ==========================================================================
  canViewAuditLog(user: StaffUser | null): boolean {
    return this.hasPermission(user, 'audit', 'view');
  },

  // Legacy stubs kept for interface compatibility with existing tests
  canAccessSubjectMarks(user: StaffUser | null, _classId?: string, _subjectId?: string): boolean {
    return user?.role === 'principal' || user?.role === 'admin' || user?.role === 'developer';
  },

  canEditMarks(_user: StaffUser | null, _classId?: string, _subjectId?: string): boolean {
    return false;
  },

  canViewRiskWatchlist(user: StaffUser | null, _classId?: string): boolean {
    return user?.role === 'principal' || user?.role === 'admin' || user?.role === 'developer';
  },

  canLogIncident(_user: StaffUser | null, _studentClassId?: string): boolean {
    return false;
  },
};

/**
 * Apply Preset Configuration to a given module permissions object.
 */
export function applyPermissionPreset(
  preset: PermissionPreset,
  module: PermissionModule
): ModulePermissions {
  if (preset === 'read_only') {
    return { view: true, download: true, export: true };
  }
  if (preset === 'read_write') {
    return {
      view: true,
      create: true,
      edit: true,
      upload: true,
      download: true,
      export: true,
      approve: true,
      reject: true,
      send_whatsapp: true,
    };
  }
  if (preset === 'full') {
    return {
      view: true,
      create: true,
      edit: true,
      delete: true,
      upload: true,
      download: true,
      export: true,
      approve: true,
      reject: true,
      revoke: true,
      send_whatsapp: true,
      manage: true,
    };
  }
  return {};
}
