import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RoleGuard } from './components/auth/RoleGuard';
import { SectionGuard } from './components/auth/SectionGuard';

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

// Institutional Reports & Print Dossiers
import { ReportsHub } from './pages/reports/ReportsHub';
import { StudentReportCard } from './pages/reports/StudentReportCard';
import { PTMSlip } from './pages/reports/PTMSlip';
import { AttendanceReport } from './pages/reports/AttendanceReport';
import { AcademicComparisonReport } from './pages/reports/AcademicComparisonReport';
import { ClassAcademicSummary } from './pages/reports/ClassAcademicSummary';

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
        {/* Dynamic Role-Aware Landing Workspace */}
        <Route index element={<RoleDashboardRouter />} />

        {/* Student Master Ledger & Profiles */}
        <Route path="students" element={<StudentDirectory />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="students/:id/attendance" element={<StudentAttendanceHistory />} />
        <Route path="students/:studentId/attendance" element={<StudentAttendanceHistory />} />

        {/* Whole-School Attendance (Principal only) */}
        <Route
          path="attendance"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <AttendanceDashboard />
            </RoleGuard>
          }
        />

        {/* Daily Classroom Register (Guarded by Section Clearance) */}
        <Route
          path="attendance/register/:classId"
          element={
            <SectionGuard action="mark_attendance">
              <DailyAttendanceRegister />
            </SectionGuard>
          }
        />

        {/* Attendance Corrections (Principal & Class Teachers) */}
        <Route
          path="attendance/corrections"
          element={
            <RoleGuard allowedRoles={['principal', 'class_teacher']}>
              <AttendanceCorrections />
            </RoleGuard>
          }
        />

        {/* Classes & Section Rosters */}
        <Route
          path="classes"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <ClassesDirectory />
            </RoleGuard>
          }
        />
        <Route
          path="classes/:classId/students"
          element={
            <SectionGuard>
              <SectionRoster />
            </SectionGuard>
          }
        />
        <Route
          path="classes/:classId/performance"
          element={
            <SectionGuard>
              <ClassPerformanceLedger />
            </SectionGuard>
          }
        />
        <Route
          path="performance/classes/:classId"
          element={
            <SectionGuard>
              <ClassPerformanceLedger />
            </SectionGuard>
          }
        />

        {/* Assessment Cycles & Marks Sheets */}
        <Route path="assessments" element={<AssessmentList />} />
        <Route path="academics/assessments" element={<AssessmentList />} />
        <Route path="academics/marks" element={<MarksEntryRegister />} />
        <Route path="academics/marks/:assessmentId" element={<MarksEntryRegister />} />
        <Route path="academics/marks/:assessmentId/:classId/:subjectId" element={<MarksEntryRegister />} />
        <Route path="academics/assessments/marks/:registerId" element={<MarksEntryRegister />} />
        <Route path="assessments/marks/:registerId" element={<MarksEntryRegister />} />

        {/* Performance Risk Watchlist (Principal, Class Teacher) */}
        <Route
          path="risk-watchlist"
          element={
            <RoleGuard allowedRoles={['principal', 'class_teacher']}>
              <RiskWatchlist />
            </RoleGuard>
          }
        />

        {/* Behaviour & Proctorial Care */}
        <Route path="behaviour" element={<BehaviourDirectory />} />

        {/* Institutional Reports & Print Views */}
        <Route path="reports" element={<ReportsHub />} />
        <Route path="reports/report-card/:studentId" element={<StudentReportCard />} />
        <Route path="reports/ptm-slip/:studentId" element={<PTMSlip />} />
        <Route
          path="reports/attendance"
          element={
            <RoleGuard allowedRoles={['principal', 'class_teacher']}>
              <AttendanceReport />
            </RoleGuard>
          }
        />
        <Route
          path="reports/academic-comparison"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <AcademicComparisonReport />
            </RoleGuard>
          }
        />
        <Route
          path="reports/class-summary"
          element={
            <RoleGuard allowedRoles={['principal', 'class_teacher']}>
              <ClassAcademicSummary />
            </RoleGuard>
          }
        />
        <Route
          path="reports/student-followup"
          element={
            <RoleGuard allowedRoles={['principal', 'class_teacher']}>
              <RiskWatchlist />
            </RoleGuard>
          }
        />

        {/* Staff Administration & Allocations */}
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
        <Route
          path="admin/subject-teachers"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <SubjectFacultyAssignments />
            </RoleGuard>
          }
        />
        <Route
          path="admin/roles"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <RolePermissionMatrix />
            </RoleGuard>
          }
        />

        {/* Institutional Settings & Identity (Principal Governance Only) */}
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
        <Route
          path="settings/assessment-types"
          element={
            <RoleGuard allowedRoles={['principal']}>
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
