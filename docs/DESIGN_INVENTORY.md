# HanuJai High School ERP — Design Inventory

This document catalogs every design screen exported from Google Stitch located in the `Designs/` reference directory. Every screen has been analyzed for its structural components, user roles, interactive workflows, and necessary corrections for production implementation.

---

## 1. Authentication & System Access

| Screen Name & Relative Path | Intended Route | Primary Role | Key Interactions Shown | Production Corrections & Implementation Notes |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/staff_login_desktop_all_states/` | `/login` | Anonymous Staff | Username/password inputs, role preview switcher, alert states (Invalid credentials, Locked account, Session timeout). | Replace hardcoded HTML validation with managed React form state; integrate with Firebase Auth & Demo auth provider. |
| `Designs/staff_login_mobile_390px_all_states/` | `/login` (Mobile Viewport) | Anonymous Staff | 390px mobile card layout, touch-friendly input targets (40px min), inline error pills. | Provide responsive breakpoint switching rather than a standalone mobile page; use flex-column layout on screens under 840px. |
| `Designs/access_denied/` | `/unauthorized` | All Authenticated Roles | Authoritative 403 Forbidden state, explanation of missing role privileges, "Return to My Desk" button. | Ensure dynamic messaging indicating required permissions (e.g., "Class Teacher privileges required for Class 10-A attendance"). |

---

## 2. Institutional Leadership & Principal Dashboards

| Screen Name & Relative Path | Intended Route | Primary Role | Key Interactions Shown | Production Corrections & Implementation Notes |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/principal_administration_dashboard/` | `/` or `/dashboard` | Principal / Administrator | KPI metrics (Enrolled: 391, Today's Attendance: 96.4%, Unexcused: 14), Quick Action launcher, Watchlist snippet. | Connect metrics to dynamic Firestore/Demo store; eliminate static numbers. Support date picker for historical daily roll calls. |
| `Designs/principal_dashboard_standard_overview/` | `/dashboard/overview` | Principal / Administrator | Department-level progress, section attendance comparison table, upcoming examination milestones. | Implement sortable columns and tabular figures (`tnum`) for percentage alignments. |
| `Designs/principal_dashboard_alert_selected_cbse_compliance/` | `/dashboard?alert=cbse` | Principal / Administrator | Highlighted alert state for CBSE minimum 75% attendance rule threshold; list of students at risk. | Implement transparent mathematical rule (#ATT-03) explaining why each student is flagged; provide 1-click parent notice dispatch. |
| `Designs/individual_risk_explanation_evidence_panel/` | `/students/:id/risk-panel` | Principal / Class Teacher | Drawer/modal showing explainable audit evidence (e.g. Rule #ATT-01: 3 consecutive unexcused absences, Rule #ACAD-04: >15% drop). | Avoid black-box machine learning; render explicit chronological event triggers. Provide "Acknowledge & Schedule Counseling" action. |
| `Designs/school_wide_student_follow_up_watchlist/` | `/reports/watchlist` | Principal / Office Admin | Multi-filter table (Chronic Absentees, Academic Drop, Disciplinary Escalations), assigned mentor tracking. | Add CSV export, multi-select batch follow-up status updates, and status chips (`status-badge-alert`, `status-badge-pending`). |

---

## 3. Academic Structure & Class Management

| Screen Name & Relative Path | Intended Route | Primary Role | Key Interactions Shown | Production Corrections & Implementation Notes |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/classes_sections_directory/` | `/classes` | Principal / Office Admin | Grid of 10 Classes (Sections A & B), assigned Class Teacher, active student head count, room allocation. | Standardize Indian class naming (`Class 10-A`, `Class 09-B`). Link each card to section roster and attendance register. |
| `Designs/section_student_roster_class_10_a/` | `/classes/:classId/students` | Class Teacher / Office Admin | Sequential roll number roster, admission ID, student name, gender, attendance percentage badge, risk tags. | Implement live search filter by name or admission number; include 1-click navigation to student master profile. |
| `Designs/class_performance_overview_class_10_a/` | `/classes/:classId/performance` | Class Teacher / Principal | Cross-subject grade matrix for Class 10-A, section average per subject, distribution curves. | Implement strict role scoping: only assigned Class Teacher and Principal can view the cross-subject consolidated sheet. |
| `Designs/class_teacher_s_assigned_student_follow_up_list/` | `/my-class/follow-ups` | Class Teacher | Filtered view of assigned section students requiring attention; follow-up status tags, parent contact logs. | Include modal dialog for adding teacher notes and logging parent phone consultations. |
| `Designs/class_teacher_assignment_management/` | `/admin/class-teachers` | Principal / Office Admin | Allocation table assigning faculty to Class/Sections, co-tutor support, academic session locking. | Prevent duplicate primary tutor assignments per section; log assignment changes to system audit log. |
| `Designs/role_and_assignment_matrix/` | `/admin/roles` | Principal / Admin | Matrix defining capabilities for the 4 staff roles across Student Records, Attendance, Marks, and Audit. | Make matrix an authoritative reference; enforce permissions in route guards and Firestore rules. |
| `Designs/subject_faculty_assignment_matrix/` | `/admin/subject-teachers` | Principal / Office Admin | Assignment matrix linking teachers to specific subject + class combinations (e.g. Mr. Sharma -> Class 10-A Mathematics). | Crucial server-side security anchor: subject teachers can ONLY enter marks for assigned subject-class tuples. |
| `Designs/academic_year_management/` | `/admin/academic-years` | Principal / Office Admin | Academic session manager (2025–2026 Active, 2024–2025 Archived), term dates, session transition safeguards. | Enforce that only one academic year is active at any time; archive past years as read-only. |

---

## 4. Student Records & Admissions

| Screen Name & Relative Path | Intended Route | Primary Role | Key Interactions Shown | Production Corrections & Implementation Notes |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/student_directory_enrollment_ledger/` | `/students` | All Staff (Scoped) | Paginated master student directory, search bar, class/section filter dropdown, status filter (Active, Left). | Use tabular figures (`tnum`) on roll numbers; support pagination and instant search debouncing. |
| `Designs/student_profile_overview_aarav_singhania/` | `/students/:id` | All Staff (Scoped) | Comprehensive student master record: personal identity, enrollment date, guardian contacts, emergency phone. | Ensure sensitive guardian details (financial/income) are hidden from subject teachers; show authorized contact cards. |
| `Designs/student_profile_academic_performance_aarav_singhania/` | `/students/:id/academics` | Teachers / Principal | Historical assessment transcript, subject marks, grade points, term comparison bar charts. | Dynamic calculation of percentage and CBSE grade brackets (A1, A2, B1, etc.) based on configured assessment rules. |
| `Designs/student_behaviour_history/` | `/students/:id/behaviour` | Authorized Staff | Chronological log of student commendations, disciplinary notices, late reporting entries, and follow-ups. | Display logging staff member's name and role; enforce edit locks on historical entries after 48 hours. |
| `Designs/student_chronological_change_history/` | `/students/:id/audit` | Principal / Office Admin | Immutable change log showing every modification to student profile (Old value vs New value, editor, timestamp). | Pull directly from Firestore `auditEvents` collection; display clear visual diff blocks. |
| `Designs/edit_student_profile_master_record_aarav_singhania/` | `/students/:id/edit` | Office Admin / Principal | Master record editing form with validation, section reassignment, and mandatory "Reason for Change" field. | Require non-empty revision notes before submission to feed the audit ledger. |
| `Designs/add_student_new_admission_enrollment_form/` | `/students/new` | Office Admin / Principal | New student enrollment wizard: identity, DOB picker, guardian details, class allocation, document uploads. | Include client-side validation for phone numbers (10 digits), DOB sanity checks, and admission number formatting. |
| `Designs/student_form_validation_errors_duplicate_collision_state/` | `/students/new` (Error State) | Office Admin | Visual inline error banners highlighting duplicate admission numbers or Aadhaar/National ID collisions. | Implement pre-check validation against existing student ledger before triggering Firestore transaction. |
| `Designs/student_record_created_successful_save_confirmation_state/` | `/students/new/success` | Office Admin | Confirmation receipt card displaying generated Student ID, summary details, and "Print Admission Slip" CTA. | Provide printable admission slip format and direct link to new student's profile. |

---

## 5. Attendance Operations & Server-Locked Policy

| Screen Name & Relative Path | Intended Route | Primary Role | Key Interactions Shown | Production Corrections & Implementation Notes |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/attendance_class_section_selector/` | `/attendance` | Class Teachers / Principal | Card grid of classes showing marking status: Green (Submitted), Yellow (Window Open), Gray (Locked). | Filter card list to only assigned class for Class Teachers; show all 20 sections for Principal. |
| `Designs/attendance_daily_attendance_register_class_10_a/` | `/attendance/register/:classId` | Class Teacher | Interactive roll call table: Present, Absent, Late, Excused toggle buttons, "Mark All Present" shortcut, marking window countdown. | Enforce server-side marking window (e.g. 07:45 – 09:15 AM); disable submission when window is closed. |
| `Designs/attendance_marking_policy/` | `/admin/attendance-policy` | Principal / Administrator | Configuration of daily marking window start/end times, late arrival grace period (15 mins), correction authorization rules. | Store settings in `schoolSettings` Firestore document; enforce time boundaries on Firestore security rules. |
| `Designs/attendance_submission_summary_audit_ledger_class_10_a/` | `/attendance/summary/:sessionId` | Class Teacher / Principal | Cryptographic/audit submission receipt: 38 Present, 2 Absent, submission timestamp, teacher signature token. | Generate unique immutable audit hash for each completed daily register submission. |
| `Designs/attendance_late_correction_request_authorization/` | `/attendance/corrections` | Class Teacher & Principal | Dual-authorization workflow for late changes: student selector, original state, new state, reason, Principal approval. | Two-step workflow: Class Teacher submits request -> Principal approves -> register updates and logs to audit ledger. |
| `Designs/attendance_ledger_analytics/` | `/reports/attendance` | Principal / Office Admin | Monthly attendance heatmap, section vs. section comparison, chronic absenteeism tracker (<75%). | Enable date-range filtering, section grouping, and CSV export for compliance reporting. |

---

## 6. Assessment Cycles & Marks Entry

| Screen Name & Relative Path | Intended Route | Primary Role | Key Interactions Shown | Production Corrections & Implementation Notes |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/assessment_types_configuration/` | `/admin/assessments/types` | Principal / Academic Head | Configuration of institutional cycles: Unit Test 1 (25m), Unit Test 2 (25m), Half-Yearly (80m), Annual (80m). | Prevent deleting assessment types once marks have been entered; support active/archived status toggles. |
| `Designs/assessment_configuration/` | `/admin/assessments/setup` | Principal / Office Admin | Assessment definition setup: maximum marks, passing score, academic year, weightage (e.g. UT 10%, Annual 50%). | Validate that weightages sum to 100%; associate with applicable class grades. |
| `Designs/assessment_list_selection/` | `/assessments` | Subject / Class Teachers | Dropdown/card selector for active assessment cycle, subject, and assigned class section. | Filter dropdowns to only classes/subjects the authenticated teacher is authorized to grade. |
| `Designs/subject_wise_marks_entry_register/` | `/assessments/entry/:id` | Subject Teacher | Spreadsheet-like marks entry register: student roll, name, max marks (e.g. /100), input field, validation indicator, draft save. | Enforce tabular figures (`tnum`); provide keyboard navigation (Enter/Tab moving down/across); validate `marks <= maxMarks`. |
| `Designs/student_academic_performance_report_aarav_singhania_class_10_a/` | `/reports/report-card/:id` | Principal / Class Teacher | Institutional formal report card: subject breakdown, marks obtained, percentage, grade, attendance %, remarks. | Implement print media styles (`@media print`) stripping navigation bars for crisp A4 paper output. |
| `Designs/print_ready_academic_performance_summary_ptm_aarav_singhania/` | `/reports/ptm-slip/:id` | Class Teacher / Parent | Compact A4 Parent-Teacher Meeting summary slip with school crest, subject scores, signature blocks. | Pure CSS print optimization; page-break avoidance on signatures. |
| `Designs/student_by_student_subject_comparison_class_10_a/` | `/reports/comparison/:classId` | Class Teacher / Principal | Dense comparison matrix showing all students in section across all 5 core subjects, section rank, standard deviation. | Horizontal scrolling table with sticky student name column for desktop ergonomics. |
| `Designs/academic_performance_comparison_report/` | `/reports/academic-comparison` | Principal / Academic Head | Cross-section performance analytics (Class 10-A vs 10-B), subject-wise failure rate indicators. | Clean bar comparison components matching the Institutional Rigor aesthetic (no flashy 3D charts). |

---

## 7. Behaviour, Audit & Administrative Operations

| Screen Name & Relative Path | Intended Route | Primary Role | Key Interactions Shown | Production Corrections & Implementation Notes |
| :--- | :--- | :--- | :--- | :--- |
| `Designs/behaviour_records_directory/` | `/behaviour` | Authorized Staff | Incident ledger with filter by category (Academic Dishonesty, Dress Code, Exemplary Conduct, Bullying). | Include role-based visibility: sensitive disciplinary incidents visible only to Principal and assigned Class Teacher. |
| `Designs/record_new_observation_incident/` | `/behaviour/new` | Authorized Staff | Incident creation form: student picker, date/time, category, severity level, description, recommended action. | Enforce non-empty description; send automated notification flag to Principal dashboard. |
| `Designs/record_change_detail_marks_attendance_dual_custody_diff/` | `/audit/diff/:id` | Principal / Auditor | Side-by-side diff showing exact changes made to marks or attendance (Old value in red, New value in green, author). | Provide clear dual-custody verification tags ("Authorized by Principal Sharma on 21 Oct 2026"). |
| `Designs/school_administration_audit_log/` | `/admin/audit-log` | Principal / Admin | Immutable system audit log: Timestamp, Actor, Role, Event Type, Resource, Target ID, Client IP. | Deny-by-default write access: audit log records are written exclusively via server functions/trusted repository layer. |
| `Designs/school_reports_directory/` | `/reports` | Principal / Office Admin | Hub for generating school reports (Attendance Ledger, Subject Matrix, CBSE Compliance, PTM Slips). | Group reports into clear operational categories with direct generation triggers. |
| `Designs/staff_directory/` | `/staff` | Principal / Office Admin | Staff faculty directory: Employee ID, Name, Department, Primary Role, Assigned Sections, Contact. | Include status filters (Active / On Leave); search by teacher name or subject. |
| `Designs/staff_account_form/` | `/staff/new` or `/staff/:id/edit` | Principal / Office Admin | Staff account creation/editing: user identity, login email, initial temporary password, role selector. | In Firebase mode, create Firebase Auth user and link to Firestore `staff` document. |
| `Designs/system_configuration_confirmation_audit/` | `/admin/system-config` | Principal / Administrator | School identity configuration (HanuJai High School, Jaipur), CBSE affiliation details, address, logo, review dialog. | Modal confirmation before updating core institutional settings; log changes to system audit log. |
| `Designs/validation_submission_review_state/` | `/admin/review-submission` | All Staff | Pre-commit review sheet displaying summary of changes before finalizing irreversible operations. | Generic reusable modal component for confirming high-consequence operations (e.g. final grade submission, student withdrawal). |

---

## 8. Summary of Reusable Component Extractions

The 48 design screens consistently decompose into 12 core reusable component families:

1. **Application Shell (`AppShell`, `Sidebar`, `Topbar`, `UserMenu`)**: Fixed 240px sidebar, 64px topbar, breadcrumb navigation, active session pill, and demo-mode indicator.
2. **Data Tables & Matrices (`DataTable`, `TablePagination`, `TableHeader`)**: 1px `#DFE3DF` structural borders, `#E9ECE8` header fills, tabular numerals (`tnum`), and hover highlights.
3. **Status Badges & Chips (`StatusBadge`)**: Restrained 22px badges with 3px radius (`status-badge-recorded`, `status-badge-pending`, `status-badge-alert`).
4. **Form Controls & Inputs (`FormInput`, `FormSelect`, `FormTextarea`)**: 36px/40px heights, 1px border, focus ring in pine green `#31594E`.
5. **Metric Cards (`MetricCard`, `MetricGrid`)**: Flat white cards with left accent borders (Pine Green, Ochre, Terracotta, Slate).
6. **Modals & Dialogs (`Modal`, `ConfirmationDialog`)**: 8px corner radius, grounded architectural shadow, 40% dark overlay.
7. **Drawers & Evidence Panels (`Drawer`, `EvidencePanel`)**: Slide-over panel for student risk explanations and audit trails.
8. **Tabs & Filter Bars (`Tabs`, `FilterBar`)**: Methodical utilitarian tab bars with active bottom indicator lines.
9. **Search & Action Bars (`SearchBar`, `ActionButtonGroup`)**: Debounced search inputs with quick shortcut triggers.
10. **Print Layouts (`PrintableReportCard`, `PrintablePTMSlip`)**: Print-optimized CSS rules for standard A4 institutional stationery.
11. **State Containers (`LoadingState`, `EmptyState`, `ErrorBanner`)**: Authoritative error banners and calm empty states.
12. **Audit & Diff Blocks (`AuditDiffViewer`)**: Side-by-side green/red value comparison blocks for dual-custody verification.
