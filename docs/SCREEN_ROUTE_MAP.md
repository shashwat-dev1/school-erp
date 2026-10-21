# HanuJai High School ERP — Screen to Route & Component Map

This document establishes the definitive mapping between every exported Google Stitch design screen in `Designs/` and its corresponding production route, component, modal, or drawer in `src/`.

---

## 1. Authentication & System Gateway

| Design Reference Directory | Production Route | React Component / View | Role Scope | Key Functional Interactions |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/staff_login_desktop_all_states/` | `/login` | `src/pages/auth/StaffLogin.tsx` | Anonymous / Public | Email/Password form, persona preview buttons, error alerts, active session checkbox. |
| `Designs/staff_login_mobile_390px_all_states/` | `/login` (Mobile Viewport) | `src/pages/auth/StaffLogin.tsx` | Anonymous / Public | Responsive 390px reflow, touch-friendly inputs (40px), vertical brand stack. |
| `Designs/access_denied/` | `/access-denied` | `src/pages/error/AccessDenied.tsx` | All Authenticated | Role-boundary violation alert, current role notice, return to dashboard CTA. |

---

## 2. Institutional Leadership & Operations Dashboards

| Design Reference Directory | Production Route | React Component / View | Role Scope | Key Functional Interactions |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/principal_administration_dashboard/` | `/` | `src/pages/dashboard/OperationsHub.tsx` | Principal / Office | Live KPIs (Enrollment, Daily Attendance, Roll-call progress, Care Flags), Quick Actions. |
| `Designs/principal_dashboard_standard_overview/` | `/?tab=overview` | `src/pages/dashboard/OperationsHub.tsx` | Principal | Section attendance comparison table, upcoming examination milestones, department progress. |
| `Designs/principal_dashboard_alert_selected_cbse_compliance/` | `/?alert=cbse` | `src/pages/dashboard/OperationsHub.tsx` | Principal | CBSE 75% attendance rule threshold banner with direct link to flagged students. |
| `Designs/individual_risk_explanation_evidence_panel/` | Drawer on `/students/:id` or `/risk-watchlist` | `src/features/risk/RiskEvidenceDrawer.tsx` | Principal / Tutors | Transparent rule breakdown (#ATT-01, #ACAD-04, #ATT-03), audit timeline, follow-up scheduling. |
| `Designs/school_wide_student_follow_up_watchlist/` | `/risk-watchlist` | `src/pages/risk/RiskWatchlist.tsx` | Principal / Office | Multi-filter watchlist (Chronic Absenteeism, Academic Drop, Conduct), mentor assignment, CSV export. |

---

## 3. Student Master Ledger & Profiles

| Design Reference Directory | Production Route | React Component / View | Role Scope | Key Functional Interactions |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/student_directory_enrollment_ledger/` | `/students` | `src/pages/students/StudentDirectory.tsx` | All Staff (Scoped) | Search, class/section filter, attendance filter, CSV export, pagination, dossier drawer. |
| `Designs/student_profile_overview_aarav_singhania/` | `/students/:id` | `src/pages/students/StudentDetail.tsx` (Tab: Overview) | All Staff (Scoped) | Demographic data, guardian contacts, emergency phone, residential address, status chips. |
| `Designs/student_profile_academic_performance_aarav_singhania/` | `/students/:id` (Tab: Academics) | `src/pages/students/StudentDetail.tsx` (Tab: Academics) | Teachers / Principal | Historical marks transcript across UT1, UT2, Half-Yearly, grade distribution, CBSE grading. |
| `Designs/student_behaviour_history/` | `/students/:id` (Tab: Behaviour) | `src/pages/students/StudentDetail.tsx` (Tab: Behaviour) | Teachers / Principal | Chronological timeline of commendations, notices, late reporting entries, and action plans. |
| `Designs/student_chronological_change_history/` | `/students/:id` (Tab: Audit) | `src/pages/students/StudentDetail.tsx` (Tab: Audit) | Principal / Office | Immutable audit ledger diff showing field changes (old vs new), editor UID, timestamp. |
| `Designs/edit_student_profile_master_record_aarav_singhania/` | Modal on `/students/:id` | `src/pages/students/StudentEditModal.tsx` | Principal / Office | Master record editing, section reassignment, mandatory "Reason for Revision" audit log entry. |
| `Designs/add_student_new_admission_enrollment_form/` | Modal on `/students` | `src/pages/students/StudentEnrollModal.tsx` | Principal / Office | Multi-field admission wizard: identity, DOB picker, guardian details, class allocation. |
| `Designs/student_form_validation_errors_duplicate_collision_state/` | Inline in Enrollment Modal | `src/pages/students/StudentEnrollModal.tsx` | Principal / Office | Inline duplicate collision alerts (e.g. duplicate Admission Number collision). |
| `Designs/student_record_created_successful_save_confirmation_state/` | Confirmation Modal | `src/pages/students/StudentEnrollSuccessModal.tsx` | Principal / Office | Admission confirmation slip with generated Student ID and 1-click print slip CTA. |

---

## 4. Attendance Operations & Server-Locked Policy

| Design Reference Directory | Production Route | React Component / View | Role Scope | Key Functional Interactions |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/attendance_class_section_selector/` | `/attendance` | `src/pages/attendance/AttendanceDashboard.tsx` | All Roles (Scoped) | Class cards showing session status (Submitted Green, Window Open Yellow, Locked Gray). |
| `Designs/attendance_daily_attendance_register_class_10_a/` | `/attendance/register/:classId` | `src/pages/attendance/DailyAttendanceRegister.tsx` | Class Tutors / Principal | Present/Absent/Late/Excused toggle buttons, "Mark All Present" review modal, remarks input. |
| `Designs/attendance_marking_policy/` | `/settings/attendance-policy` | `src/pages/settings/AttendancePolicySettings.tsx` | Principal | Daily marking window config (07:45–09:15), 15m grace period, CBSE 75% threshold. |
| `Designs/attendance_submission_summary_audit_ledger_class_10_a/` | Modal / Tab on Register | `src/pages/attendance/AttendanceSummaryModal.tsx` | Class Tutors / Principal | Cryptographic submission receipt: Present/Absent counters, timestamp, audit record. |
| `Designs/attendance_late_correction_request_authorization/` | `/attendance/corrections` | `src/pages/attendance/AttendanceCorrections.tsx` | Class Tutors & Principal | Dual-custody correction queue: tutor submits reason -> Principal approves/rejects. |
| `Designs/attendance_ledger_analytics/` | `/reports/attendance` | `src/pages/reports/AttendanceReport.tsx` | Principal / Office | Monthly attendance register matrix, date-range picker, chronic absenteeism filter (<75%), CSV export. |

---

## 5. Assessment Cycles & Marks Entry

| Design Reference Directory | Production Route | React Component / View | Role Scope | Key Functional Interactions |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/assessment_types_configuration/` | `/settings/assessment-types` | `src/pages/settings/AssessmentTypeSettings.tsx` | Principal / Office | Assessment cycle definitions: Unit Test 1 (25m), UT 2 (25m), Half-Yearly (80m), Annual (80m). |
| `Designs/assessment_configuration/` | Modal on `/academics/assessments` | `src/pages/academics/AssessmentConfigModal.tsx` | Principal / Office | Max marks configuration, passing threshold, term association, weightage allocation. |
| `Designs/assessment_list_selection/` | `/academics/assessments` | `src/pages/academics/AssessmentList.tsx` | Teachers / Principal | Filterable list of assessment cycles, subject selectors, class assignment status. |
| `Designs/subject_wise_marks_entry_register/` | `/academics/marks/:assessmentId` | `src/pages/academics/MarksEntryRegister.tsx` | Subject Teacher / Admin | Spreadsheet-like mark sheet, roll number, max marks validation, absent toggle, draft save, finalize. |
| `Designs/student_academic_performance_report_aarav_singhania_class_10_a/` | `/reports/report-card/:studentId` | `src/pages/reports/StudentReportCard.tsx` | All Staff | Formal institutional CBSE report card formatted for A4 printing (`@media print`). |
| `Designs/print_ready_academic_performance_summary_ptm_aarav_singhania/` | `/reports/ptm-slip/:studentId` | `src/pages/reports/PTMSlip.tsx` | Class Tutors / Parents | Compact A4 Parent-Teacher Meeting progress slip with signatures and school crest. |
| `Designs/student_by_student_subject_comparison_class_10_a/` | `/performance/classes/:classId` | `src/pages/performance/ClassPerformanceLedger.tsx` | Class Tutors / Principal | Consolidated multi-subject grade matrix for Class 10-A, section average, student drill-down. |
| `Designs/academic_performance_comparison_report/` | `/reports/academic-comparison` | `src/pages/reports/AcademicComparisonReport.tsx` | Principal | Cross-section performance comparison (10-A vs 10-B), subject-wise failure rate indicators. |

---

## 6. Behaviour & Pastoral Care

| Design Reference Directory | Production Route | React Component / View | Role Scope | Key Functional Interactions |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/behaviour_records_directory/` | `/behaviour` | `src/pages/behaviour/BehaviourDirectory.tsx` | Authorized Staff | Incident & observation directory, category filters (Conduct, Punctuality, Commendation), severity chips. |
| `Designs/record_new_observation_incident/` | Modal on `/behaviour` | `src/pages/behaviour/NewObservationModal.tsx` | Authorized Staff | Incident creation form: student selector, category, factual description, action taken, follow-up date. |

---

## 7. Academic Structure & Teacher Assignments

| Design Reference Directory | Production Route | React Component / View | Role Scope | Key Functional Interactions |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/classes_sections_directory/` | `/classes` | `src/pages/admin/ClassesDirectory.tsx` | Principal / Office | Class 1 to 10 sections A & B cards, room allocation, class tutor, student head count. |
| `Designs/section_student_roster_class_10_a/` | `/classes/:classId/students` | `src/pages/admin/SectionRoster.tsx` | Class Tutors / Office | Sequential roll number roster, admission ID, student name, gender, attendance percentage. |
| `Designs/academic_year_management/` | `/settings/academic-years` | `src/pages/settings/AcademicYearSettings.tsx` | Principal / Office | Academic session manager (2025–2026 Active, 2024–2025 Archived), term dates. |
| `Designs/class_teacher_assignment_management/` | `/admin/class-teachers` | `src/pages/admin/ClassTeacherAssignments.tsx` | Principal / Office | Allocation table assigning faculty to Class/Sections, co-tutor support, duplicate assignment guard. |
| `Designs/role_and_assignment_matrix/` | `/admin/roles` | `src/pages/admin/RolePermissionMatrix.tsx` | Principal / Admin | Authoritative reference matrix defining permissions across all 4 staff roles. |
| `Designs/subject_faculty_assignment_matrix/` | `/admin/subject-teachers` | `src/pages/admin/SubjectFacultyAssignments.tsx` | Principal / Office | Matrix linking teachers to subject + section (e.g. Mr. Saxena -> Class 10-A Mathematics). |
| `Designs/staff_directory/` | `/staff` | `src/pages/admin/StaffDirectory.tsx` | Principal / Office | Faculty directory: Employee ID, Name, Department, Primary Role, Assigned Sections, Contact. |
| `Designs/staff_account_form/` | Modal on `/staff` | `src/pages/admin/StaffAccountModal.tsx` | Principal / Office | Staff account creation/editing: user identity, login email, initial temporary password, role selector. |

---

## 8. Governance, System Audit & Configuration

| Design Reference Directory | Production Route | React Component / View | Role Scope | Key Functional Interactions |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/school_administration_audit_log/` | `/audit-log` | `src/pages/audit/AuditLogDirectory.tsx` | Principal / Admin | Immutable system audit log: Timestamp, Actor, Role, Event Type, Resource, Target ID, Client IP. |
| `Designs/record_change_detail_marks_attendance_dual_custody_diff/` | Modal on `/audit-log` | `src/pages/audit/AuditDiffModal.tsx` | Principal / Auditor | Side-by-side diff showing exact changes made to marks or attendance (Old vs New value, author). |
| `Designs/system_configuration_confirmation_audit/` | `/settings/system-config` | `src/pages/settings/SystemSettings.tsx` | Principal / Admin | School identity configuration (HanuJai High School, Jaipur), CBSE affiliation details, address, logo. |
| `Designs/school_reports_directory/` | `/reports` | `src/pages/reports/ReportsHub.tsx` | Principal / Office | Central launch hub for generating school reports (Attendance Ledger, Report Cards, CBSE compliance). |
| `Designs/validation_submission_review_state/` | Reusable Modal | `src/components/ui/ConfirmationDialog.tsx` | All Staff | Pre-commit review sheet displaying summary of changes before finalizing irreversible operations. |
