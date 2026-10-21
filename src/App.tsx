import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RoleGuard } from './components/auth/RoleGuard';

// Public Auth
import { StaffLogin } from './pages/auth/StaffLogin';

// Operational Hub
import { OperationsHub } from './pages/dashboard/OperationsHub';

// Student Master Dossiers
import { StudentDirectory } from './pages/students/StudentDirectory';
import { StudentDetail } from './pages/students/StudentDetail';

// Attendance Registers & Dual-Custody
import { AttendanceDashboard } from './pages/attendance/AttendanceDashboard';
import { DailyAttendanceRegister } from './pages/attendance/DailyAttendanceRegister';
import { AttendanceCorrections } from './pages/attendance/AttendanceCorrections';

// Classes & Academic Structure
import { ClassesDirectory } from './pages/admin/ClassesDirectory';
import { SectionRoster } from './pages/admin/SectionRoster';
import { ClassTeacherAssignments } from './pages/admin/ClassTeacherAssignments';
import { SubjectFacultyAssignments } from './pages/admin/SubjectFacultyAssignments';
import { RolePermissionMatrix } from './pages/admin/RolePermissionMatrix';
import { StaffDirectory } from './pages/admin/StaffDirectory';

// Assessment Cycles & Marks Entry
import { AssessmentList } from './pages/academics/AssessmentList';
import { MarksEntryRegister } from './pages/academics/MarksEntryRegister';
import { ClassPerformanceLedger } from './pages/performance/ClassPerformanceLedger';

// Risk Watchlist & Pastoral Care
import { RiskWatchlist } from './pages/risk/RiskWatchlist';
import { BehaviourDirectory } from './pages/behaviour/BehaviourDirectory';

// Statutory Reports & Print Dossiers
import { ReportsHub } from './pages/reports/ReportsHub';
import { StudentReportCard } from './pages/reports/StudentReportCard';
import { PTMSlip } from './pages/reports/PTMSlip';
import { AttendanceReport } from './pages/reports/AttendanceReport';
import { AcademicComparisonReport } from './pages/reports/AcademicComparisonReport';

// Settings & Security Governance
import { SystemSettings } from './pages/settings/SystemSettings';
import { AcademicYearSettings } from './pages/settings/AcademicYearSettings';
import { AssessmentTypeSettings } from './pages/settings/AssessmentTypeSettings';
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
        {/* Operations Hub (Dashboard) */}
        <Route index element={<OperationsHub />} />

        {/* Student Master Ledger & Profiles */}
        <Route path="students" element={<StudentDirectory />} />
        <Route path="students/:id" element={<StudentDetail />} />

        {/* Attendance Operations & Dual-Custody */}
        <Route path="attendance" element={<AttendanceDashboard />} />
        <Route path="attendance/register/:classId" element={<DailyAttendanceRegister />} />
        <Route path="attendance/corrections" element={<AttendanceCorrections />} />

        {/* Classes & Section Rosters */}
        <Route path="classes" element={<ClassesDirectory />} />
        <Route path="classes/:classId/students" element={<SectionRoster />} />
        <Route path="classes/:classId/performance" element={<ClassPerformanceLedger />} />
        <Route path="performance/classes/:classId" element={<ClassPerformanceLedger />} />

        {/* Assessment Cycles & Marks Sheets */}
        <Route path="assessments" element={<AssessmentList />} />
        <Route path="academics/assessments" element={<AssessmentList />} />
        <Route path="academics/marks/:assessmentId" element={<MarksEntryRegister />} />

        {/* Performance Risk Watchlist */}
        <Route path="risk-watchlist" element={<RiskWatchlist />} />

        {/* Behaviour & Proctorial Care */}
        <Route path="behaviour" element={<BehaviourDirectory />} />

        {/* Institutional Reports & Print Views */}
        <Route path="reports" element={<ReportsHub />} />
        <Route path="reports/report-card/:studentId" element={<StudentReportCard />} />
        <Route path="reports/ptm-slip/:studentId" element={<PTMSlip />} />
        <Route path="reports/attendance" element={<AttendanceReport />} />
        <Route path="reports/academic-comparison" element={<AcademicComparisonReport />} />

        {/* Staff Administration & Allocations */}
        <Route
          path="staff"
          element={
            <RoleGuard allowedRoles={['principal', 'office_admin']}>
              <StaffDirectory />
            </RoleGuard>
          }
        />
        <Route
          path="admin/staff"
          element={
            <RoleGuard allowedRoles={['principal', 'office_admin']}>
              <StaffDirectory />
            </RoleGuard>
          }
        />
        <Route
          path="admin/class-teachers"
          element={
            <RoleGuard allowedRoles={['principal', 'office_admin']}>
              <ClassTeacherAssignments />
            </RoleGuard>
          }
        />
        <Route
          path="admin/subject-teachers"
          element={
            <RoleGuard allowedRoles={['principal', 'office_admin']}>
              <SubjectFacultyAssignments />
            </RoleGuard>
          }
        />
        <Route path="admin/roles" element={<RolePermissionMatrix />} />

        {/* Institutional Settings */}
        <Route
          path="settings/system-config"
          element={
            <RoleGuard allowedRoles={['principal', 'office_admin']}>
              <SystemSettings />
            </RoleGuard>
          }
        />
        <Route
          path="admin/system-config"
          element={
            <RoleGuard allowedRoles={['principal', 'office_admin']}>
              <SystemSettings />
            </RoleGuard>
          }
        />
        <Route
          path="settings/academic-years"
          element={
            <RoleGuard allowedRoles={['principal', 'office_admin']}>
              <AcademicYearSettings />
            </RoleGuard>
          }
        />
        <Route
          path="settings/assessment-types"
          element={
            <RoleGuard allowedRoles={['principal', 'office_admin']}>
              <AssessmentTypeSettings />
            </RoleGuard>
          }
        />
        <Route
          path="settings/attendance-policy"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <AttendancePolicySettings />
            </RoleGuard>
          }
        />

        {/* Security Audit Log */}
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
