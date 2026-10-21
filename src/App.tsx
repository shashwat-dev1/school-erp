import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RoleGuard } from './components/auth/RoleGuard';
import { StaffLogin } from './pages/auth/StaffLogin';
import { OperationsHub } from './pages/dashboard/OperationsHub';
import { StudentDirectory } from './pages/students/StudentDirectory';
import { DailyAttendanceRegister } from './pages/attendance/DailyAttendanceRegister';
import { AccessDenied } from './pages/error/AccessDenied';
import { NotFound } from './pages/error/NotFound';
import { PhasePlaceholder } from './pages/common/PhasePlaceholder';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route path="/login" element={<StaffLogin />} />

      {/* Protected Institutional Routes in AppShell */}
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

        {/* Student Master Ledger */}
        <Route path="students" element={<StudentDirectory />} />

        {/* Daily Attendance Registers */}
        <Route path="attendance" element={<DailyAttendanceRegister />} />
        <Route path="attendance/register/:classId" element={<DailyAttendanceRegister />} />
        <Route
          path="attendance/corrections"
          element={
            <PhasePlaceholder
              moduleName="Attendance Late Corrections & Dual Custody"
              phaseNumber={2}
              description="Formal workflow for principal/tutor dual-custody verification of post-window attendance adjustments."
              deliverables={[
                'Mandatory justification audit logging',
                'Principal approval queue',
                'Lock state verification',
                'CBSE compliance timestamping',
              ]}
            />
          }
        />

        {/* Classes & Sections */}
        <Route
          path="classes"
          element={
            <PhasePlaceholder
              moduleName="Class & Section Roster Management"
              phaseNumber={2}
              description="Class 1 to 10 sections A & B roster configuration, classroom allocations, and tutor assignments."
              deliverables={[
                'Section strength monitoring (max 40 students)',
                'Tutor assignment matrix',
                'Student roll generation',
                'Room scheduling',
              ]}
            />
          }
        />
        <Route
          path="classes/:classId/students"
          element={<StudentDirectory />}
        />
        <Route
          path="classes/:classId/performance"
          element={
            <PhasePlaceholder
              moduleName="Consolidated Class Performance Ledger"
              phaseNumber={3}
              description="Cross-subject performance ledger tracking Term 1 and Term 2 progression against historical benchmarks."
              deliverables={[
                'Multi-subject consolidated grade grid',
                'Explainable care rule triggers',
                'CBSE grading scale calculations',
                'Cohort ranking and percentiles',
              ]}
            />
          }
        />

        {/* Assessment Cycles & Marks Entry */}
        <Route
          path="assessments"
          element={
            <PhasePlaceholder
              moduleName="Assessment Cycles & Marks Register"
              phaseNumber={3}
              description="Continuous term assessments, periodic tests, and subject teacher marks entry workflows."
              deliverables={[
                'Subject-wise mark sheet with draft & finalize states',
                'Absentee mark validation',
                'Auto-tabulation of totals and grades',
                'Direct report card generation',
              ]}
            />
          }
        />

        {/* Behaviour & Discipline */}
        <Route
          path="behaviour"
          element={
            <PhasePlaceholder
              moduleName="Incident & Student Care Registry"
              phaseNumber={3}
              description="Objective behavioral observations, commendations, disciplinary notices, and pastoral care tracking."
              deliverables={[
                'Explainable care flags integration',
                'Guardian notification history',
                'Dual-custody disciplinary actions',
                'Confidential counselor notes',
              ]}
            />
          }
        />

        {/* Institutional Reports */}
        <Route
          path="reports"
          element={
            <PhasePlaceholder
              moduleName="Institutional Reports & CBSE Compliance"
              phaseNumber={4}
              description="Mandatory state board filings, Pariksha Sangam exports, and demographic reports."
              deliverables={[
                'CBSE Form A & B compliance registers',
                'Below 75% attendance audit certificates',
                'End-of-term student report cards',
                'Staff workload summaries',
              ]}
            />
          }
        />

        {/* Administration & Governance (Principal / Office Admin) */}
        <Route
          path="admin/staff"
          element={
            <RoleGuard allowedRoles={['principal', 'office_admin']}>
              <PhasePlaceholder
                moduleName="Staff Directory & Role Provisioning"
                phaseNumber={4}
                description="Staff accounts, desk assignments, and Firebase Auth UID bindings."
                deliverables={[
                  'Staff credential provisioning',
                  'Teacher class/subject assignment',
                  'Clearance level auditing',
                  'Departmental rosters',
                ]}
              />
            </RoleGuard>
          }
        />
        <Route
          path="admin/audit-log"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <PhasePlaceholder
                moduleName="System Audit & Security Log"
                phaseNumber={4}
                description="Tamper-evident system audit trail recording every mutation, login, and policy override."
                deliverables={[
                  'Immutable append-only audit events',
                  'IP address and user agent logging',
                  'Security anomaly alerts',
                  'DPDP Act data access verification',
                ]}
              />
            </RoleGuard>
          }
        />
        <Route
          path="admin/system-config"
          element={
            <RoleGuard allowedRoles={['principal']}>
              <PhasePlaceholder
                moduleName="School Policy & Academic Setup"
                phaseNumber={4}
                description="School calendar, attendance window timings, CBSE affiliation parameters, and grading rules."
                deliverables={[
                  'Daily attendance window configuration (07:45–09:15)',
                  'Term dates and holiday schedule',
                  'Dual-custody verification toggles',
                  'Institution identity settings',
                ]}
              />
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
