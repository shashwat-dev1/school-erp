import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RoleGuard } from './components/auth/RoleGuard';

// Public Auth
import { StaffLogin } from './pages/auth/StaffLogin';

// Dynamic Role-Aware Dashboard Router
import { RoleDashboardRouter } from './pages/dashboard/RoleDashboardRouter';

// Student Master Dossiers
import { StudentDirectory } from './pages/students/StudentDirectory';
import { StudentDetail } from './pages/students/StudentDetail';
import { StudentAttendanceHistory } from './pages/attendance/StudentAttendanceHistory';

// Attendance Registers & Dual-Custody
import { AttendanceDashboard } from './pages/attendance/AttendanceDashboard';
import { DailyAttendanceRegister } from './pages/attendance/DailyAttendanceRegister';
import { AttendanceCorrections } from './pages/attendance/AttendanceCorrections';

// Classes & Academic Structure
import { ClassesDirectory } from './pages/admin/ClassesDirectory';
import { SectionRoster } from './pages/admin/SectionRoster';
import { ClassTeacherAssignments } from './pages/admin/ClassTeacherAssignments';
import { RolePermissionMatrix } from './pages/admin/RolePermissionMatrix';
import { StaffDirectory } from './pages/admin/StaffDirectory';

// Attendance Reports & Exports
import { AttendanceReport } from './pages/reports/AttendanceReport';

// Settings & Security Governance
import { SystemSettings } from './pages/settings/SystemSettings';
import { AcademicYearSettings } from './pages/settings/AcademicYearSettings';
import { AttendancePolicySettings } from './pages/settings/AttendancePolicySettings';
import { AuditLogDirectory } from './pages/audit/AuditLogDirectory';

// Errors
import { AccessDenied } from './pages/error/AccessDenied';
import { NotFound } from './pages/error/NotFound';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication */}
      <Route path="/login" element={<StaffLogin />} />

      {/* Authenticated Institutional Shell */}
      <Route
        path="/"
        element={
          <RoleGuard>
            <AppShell />
          </RoleGuard>
        }
      >
        {/* Dynamic Role-Aware Landing Workspace */}
        <Route index element={<RoleDashboardRouter />} />

        {/* Student Master Ledger & Profiles */}
        <Route path="students" element={<StudentDirectory />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="students/:id/attendance" element={<StudentAttendanceHistory />} />
        <Route path="students/:studentId/attendance" element={<StudentAttendanceHistory />} />

        {/* Whole-School Attendance (Principal oversight) */}
        <Route
          path="attendance"
          element={
            <RoleGuard allowedRoles={['principal', 'admin', 'developer']}>
              <AttendanceDashboard />
            </RoleGuard>
          }
        />

        {/* Daily Classroom Register (Admin Entry & Principal Oversight) */}
        <Route
          path="attendance/register"
          element={
            <RoleGuard allowedRoles={['principal', 'admin', 'developer']}>
              <DailyAttendanceRegister />
            </RoleGuard>
          }
        />
        <Route
          path="attendance/register/:classId"
          element={
            <RoleGuard allowedRoles={['principal', 'admin', 'developer']}>
              <DailyAttendanceRegister />
            </RoleGuard>
          }
        />

        {/* Attendance Corrections (Admin Office Operations) */}
        <Route
          path="attendance/corrections"
          element={
            <RoleGuard allowedRoles={['admin', 'developer']}>
              <AttendanceCorrections />
            </RoleGuard>
          }
        />

        {/* Classes & Section Rosters */}
        <Route
          path="classes"
          element={
            <RoleGuard allowedRoles={['principal', 'admin', 'developer']}>
              <ClassesDirectory />
            </RoleGuard>
          }
        />
        <Route
          path="classes/:classId/students"
          element={
            <RoleGuard allowedRoles={['principal', 'admin', 'developer']}>
              <SectionRoster />
            </RoleGuard>
          }
        />
        {/* Deprecated Academic & Performance Routes -> Redirect to Students / Classes */}
        <Route path="classes/:classId/performance" element={<Navigate to="/students" replace />} />
        <Route path="performance/classes/:classId" element={<Navigate to="/students" replace />} />
        <Route path="assessments" element={<Navigate to="/students" replace />} />
        <Route path="academics/*" element={<Navigate to="/students" replace />} />
        <Route path="assessments/*" element={<Navigate to="/students" replace />} />
        <Route path="risk-watchlist" element={<Navigate to="/students" replace />} />
        <Route path="behaviour" element={<Navigate to="/students" replace />} />

        {/* Attendance Reports & History */}
        <Route
          path="reports/attendance"
          element={
            <RoleGuard allowedRoles={['principal', 'admin', 'developer']}>
              <AttendanceReport />
            </RoleGuard>
          }
        />
        <Route path="reports" element={<Navigate to="/reports/attendance" replace />} />
        <Route path="reports/*" element={<Navigate to="/reports/attendance" replace />} />

        {/* Staff Administration */}
        <Route
          path="staff"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <StaffDirectory />
            </RoleGuard>
          }
        />
        <Route
          path="admin/staff"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <StaffDirectory />
            </RoleGuard>
          }
        />
        <Route
          path="admin/class-teachers"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <ClassTeacherAssignments />
            </RoleGuard>
          }
        />
        <Route path="admin/subject-teachers" element={<Navigate to="/admin/class-teachers" replace />} />
        <Route
          path="admin/roles"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <RolePermissionMatrix />
            </RoleGuard>
          }
        />

        {/* WhatsApp Hub redirected to Home (runs automatically in background) */}
        <Route path="admin/whatsapp" element={<Navigate to="/" replace />} />
        <Route path="whatsapp" element={<Navigate to="/" replace />} />

        {/* Institutional Settings */}
        <Route
          path="settings/system-config"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <SystemSettings />
            </RoleGuard>
          }
        />
        <Route
          path="admin/system-config"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <SystemSettings />
            </RoleGuard>
          }
        />
        <Route
          path="settings/academic-years"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <AcademicYearSettings />
            </RoleGuard>
          }
        />
        <Route path="settings/assessment-types" element={<Navigate to="/settings/system-config" replace />} />
        <Route
          path="settings/attendance-policy"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <AttendancePolicySettings />
            </RoleGuard>
          }
        />

        {/* Security Audit Log (Principal Only) */}
        <Route
          path="audit-log"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <AuditLogDirectory />
            </RoleGuard>
          }
        />
        <Route
          path="admin/audit-log"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <AuditLogDirectory />
            </RoleGuard>
          }
        />

        {/* RBAC Access Denied */}
        <Route path="access-denied" element={<AccessDenied />} />

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
