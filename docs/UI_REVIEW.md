# HanuJai High School ERP — UI & Usability Review Report

## 1. Executive Summary

As part of the comprehensive product redesign and quality recovery for HanuJai High School ERP, every registered route was inspected across multiple responsive viewports (Desktop: 1440×900, Tablet: 1024×768, Mobile: 390×844).

The visual identity was completely migrated from an overcrowded, generic green theme to a refined institutional palette: **Midnight Navy (`#19243A`)**, **Warm Paper Background (`#F7F6F2`)**, **Clean White (`#FFFFFF`)**, and **Primary Blue (`#3458D4`)**. Information density was reduced dramatically across all dashboards and student profiles, with all technical jargon replaced with plain, everyday school language.

---

## 2. Route Inventory & Authorization Matrix

| Route Path | Page Component | Allowed Roles | Default Navigation Item | Purpose & Workflow |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | `LoginPage` | Public | None | Staff authentication & demo credential selector |
| `/dashboard` | `RoleDashboardRouter` | All roles | **Home** (or role equivalent) | Dynamically routes to role-specific workspace |
| `/students` | `StudentList` | `principal`, `office_admin` | **Students** | Searchable directory across 1,000 students |
| `/students/:id` | `StudentDetail` | `principal`, `office_admin`, `class_teacher`* | Sub-route | 3-area compact dossier (Attendance, Marks, Notes) |
| `/attendance` | `DailyRegister` / `AttendanceSession` | `principal`, `office_admin`, `class_teacher` | **Attendance** | Roll-call register & class turnout ledger |
| `/attendance/corrections` | `CorrectionRequestList` | `principal`, `class_teacher` | Sub-route | Dual-custody correction review & submission |
| `/assessments` | `AssessmentList` / `MarksRegister` | `principal`, `subject_teacher` | **Results** / **Enter Marks** | Assessment schedule & subject marks entry |
| `/reports` | `ReportCenter` | `principal`, `office_admin` | **Results** / **Reports** | Term report cards, PTM slips, muster downloads |
| `/staff` | `StaffDirectory` | `principal`, `office_admin` | Sub-route under School Setup | Teacher allocations & faculty contacts |
| `/settings` | `SchoolSettings` | `principal` | **School Setup** | Session settings, bell timing, pass thresholds |
| `*` | `NotFoundPage` | Public | None | Friendly, plain-language 404 recovery page |

*\*Class teachers can only access profiles of students enrolled in their assigned section (e.g. Class 10-A).*

---

## 3. Viewport Testing & Visual Audit

All tests were performed on the running application (`http://localhost:5173/`) using automated browser subagents and real browser sessions.

### A. Desktop Viewport (1440 × 900)
- **Status**: **VERIFIED — EXCELLENT**
- **Inspected Screens**:
  - Principal Dashboard
  - Office Staff Inquiry Desk
  - Class Teacher Workspace (Class 10-A)
  - Subject Teacher Workspace (Mathematics)
  - Students Directory (1,000 students across 20 classes)
  - Fast Student Search with Dropdown
  - Student Profile (Compact Dossier)
  - Daily Attendance Register
  - Marks Entry Register
  - School Setup / Settings
- **Findings**:
  - High scannability: Layout respects a 10–15 second comprehension threshold.
  - Zero horizontal overflow.
  - Sidebar is capped at 5 clean items for administrators and 4 for teaching staff.
  - Typography hierarchy is crisp with aligned baselines and subtle borders (`#E2E5EB`).

### B. Tablet Viewport (1024 × 768)
- **Status**: **VERIFIED — RESPONSIVE**
- **Inspected Screens**:
  - Principal Dashboard
  - Student Profile & Dossier
- **Findings**:
  - Metric cards reflow cleanly into 2×2 grid without overlapping.
  - Tables maintain readable column spacing without horizontal clipping.
  - Action buttons retain adequate touch targets (minimum 40px height).

### C. Mobile Viewport (390 × 844)
- **Status**: **VERIFIED — RESPONSIVE**
- **Inspected Screens**:
  - Mobile Principal Dashboard
  - Mobile Navigation Drawer
- **Findings**:
  - Topbar collapses gracefully into brand logo, demo mode indicator, and hamburger trigger.
  - Mobile slide-over navigation drawer opens smoothly with a dedicated close button and scrim background.
  - Tapping a navigation link automatically closes the drawer and transitions the route.
  - Zero horizontal scrolling or cut-off cards.

---

## 4. Screenshot Evidence Inventory

All screenshots have been cataloged and saved to the QA artifacts repository:

| Role / Route | Viewport | Screenshot File Path |
| :--- | :--- | :--- |
| Principal Dashboard (1,000 students) | 1440 × 900 | `artifacts/qa/screenshots/desktop/principal_dashboard.png` |
| Office Staff Inquiry Desk | 1440 × 900 | `artifacts/qa/screenshots/desktop/office_staff_dashboard.png` |
| Class Teacher Workspace (Class 10-A) | 1440 × 900 | `artifacts/qa/screenshots/desktop/class_teacher_dashboard.png` |
| Subject Teacher Workspace (Math) | 1440 × 900 | `artifacts/qa/screenshots/desktop/subject_teacher_dashboard.png` |
| Fast Student Search Overlay | 1440 × 900 | `artifacts/qa/screenshots/desktop/students_search.png` |
| Student Search Results Live Dropdown | 1440 × 900 | `artifacts/qa/screenshots/desktop/student_search_results.png` |
| Student Directory (Filter & Roster) | 1440 × 900 | `artifacts/qa/screenshots/desktop/students_directory.png` |
| Student Profile (Compact Dossier) | 1440 × 900 | `artifacts/qa/screenshots/desktop/student_profile.png` |
| Daily Attendance Register | 1440 × 900 | `artifacts/qa/screenshots/desktop/attendance_register.png` |
| Marks Entry Register | 1440 × 900 | `artifacts/qa/screenshots/desktop/marks_entry.png` |
| School Setup & Settings | 1440 × 900 | `artifacts/qa/screenshots/desktop/school_setup.png` |
| Tablet Principal Dashboard | 1024 × 768 | `artifacts/qa/screenshots/tablet/principal_dashboard.png` |
| Tablet Student Profile | 1024 × 768 | `artifacts/qa/screenshots/tablet/student_profile.png` |
| Mobile Principal Dashboard | 390 × 844 | `artifacts/qa/screenshots/mobile/principal_dashboard.png` |
| Mobile Navigation Drawer | 390 × 844 | `artifacts/qa/screenshots/mobile/nav_drawer.png` |

---

## 5. Discovered Issues & Implemented Fixes

1. **Issue**: Old cached LocalStorage in browsers retained a legacy 13-student dataset, causing metric counters to show "13" instead of the expected 1,000 enrolled students.
   - **Fix**: Enhanced `src/data/demo/demoRepository.ts` to detect stores with `< 500` students on initial load and seamlessly re-seed the full 1,000 synthetic student dataset across all 20 class sections.
2. **Issue**: Principal dashboard previously contained excessive charts, risk gauge badges, and audit tables that overwhelmed viewers.
   - **Fix**: Redesigned `PrincipalDashboard.tsx` to strictly 4 metric cards (Total Students, Present Today, Absent Today, Needing Attention) and 2 concise supporting areas (Attendance by Class and Students Needing Attention) plus a prominent fast student search.
3. **Issue**: Student detail profile was over 1,500 lines long with medical records, disciplinary history, and audit metadata crammed onto the default view.
   - **Fix**: Redesigned `StudentDetail.tsx` to a clean 3-area default summary (Attendance Summary, Academic Results, Teacher Notes) with detailed history organized under secondary tabs.
4. **Issue**: Navigation sidebars displayed identical complex lists across all roles.
   - **Fix**: Refactored `Sidebar.tsx` to dynamically render role-specific navigation capped at 5 items for administrators and 4 items for teachers.
5. **Issue**: Technical software engineering terms were visible in UI text (e.g., "Risk Indicators", "Assessment Matrix", "Provisioning").
   - **Fix**: Systematically audited and translated all labels to plain everyday school English ("Students Who May Need Attention", "Marks", "Staff Setup").
6. **Issue**: Mobile drawer lacked an explicit, accessible close button and failed to dismiss when clicking outside or navigating.
   - **Fix**: Added explicit dismiss button and overlay backdrop handlers to `Sidebar.tsx`.

---

## 6. Verification Status & Remaining Scope

- **Automated Test Suite**: 27 / 27 tests passing (`npm test -- --run`).
- **TypeScript Type Checks**: 0 errors (`tsc -b`).
- **Production Build**: Successful bundle generated (`vite build`).
- **ESLint Code Quality**: 0 errors (`npm run lint`).
- **Browser Workflows**: Verified in live Chrome browser via automation subagent.
- **Known Remaining Scope for Production Launch**:
  - Firebase Cloud Deployment: Ready for production configuration once the school provides live Google Cloud / Firebase credentials and domain DNS records.
  - Real-time SMS / WhatsApp Gateway: Demo mode simulates parent notification; integration with Twilio / MSG91 is marked for post-pilot phase.

---

## 7. Critical Corrective Release Audit & Defect Verification (Defects A–F)

In response to school stakeholder feedback, a critical corrective release was executed to eliminate remaining inconsistencies, role leakage, and visual defects.

### Defect Verification Summary

| Defect | Original Problem | Corrective Implementation | Verification Status |
| :--- | :--- | :--- | :--- |
| **Defect A** | Subject teacher seeing cross-subject verification matrix, tutor list, and cohort language on `/performance/classes/class-10-a`. | Scoped strictly to Mathematics results with 3 clear cards: Class Average, Total Students, Marks to Review (<33% or absent). Removed all other subjects, tutor lists, and cohort badges. Added direct "Enter Marks" button. | **VERIFIED** (`class_performance_ledger_10a_*.png`) |
| **Defect B** | Student notes on `/behaviour` exposing proctorial ledger, statutory compliance, DPDP claims, and unrestricted school-wide history. | Converted to simple "Student Notes" page scoped to assigned classes and author ownership. Replaced bureaucratic jargon with plain school labels ("Date", "Student", "Type", "Note", "Action Taken"). | **VERIFIED** (`student_notes_page_*.png`, `student_notes_modal_*.png`) |
| **Defect C** | Subject teacher dashboard had duplicated classes in pending banner, 6 registers with mismatching drafts/completed, and "Room Room 301". | Seed data populated with canonical registers for classes 10-A, 10-B, and 9-A across cycles. Calculated counts strictly from unique assignments and registers. Fixed "Room Room 301" by stripping duplicate room labels. | **VERIFIED** (`subject_teacher_dashboard_*.png`) |
| **Defect D** | "Enter Marks" resulted in broken route ("HTTP 404 • Operational Route Missing"). | Added canonical routes (`/academics/assessments/marks/:registerId`, `/academics/marks/:assessmentId/:classId/:subjectId`, `/assessments/marks/:registerId`). Linked all buttons directly. Replaced technical 404 with friendly plain-language recovery view. | **VERIFIED** (`marks_entry_register_10a_*.png`) |
| **Defect E** | Dominant blue styling throughout interface. | Migrated to refined institutional warm gold palette: Warm Ivory (`#F8F6F0`), Deep Charcoal (`#28251F`), Antique Gold (`#795D2D`), Refined Gold (`#B99452`), Pale Gold (`#F3E8D0`), Warm Border (`#E5DED1`). | **VERIFIED** (All updated screenshots) |
| **Defect F** | Visual clutter and technical terminology ("Operations Hub", "Candidate", "Cohort", "Remedial"). | Standardized terminology across the application to "Home", "Student", "Results", "Marks to Review". Reduced element density. | **VERIFIED** (Full codebase audit & lint) |

### Corrective Release Screenshot Catalog

All evidence screenshots are stored under `artifacts/qa/screenshots/corrective/`:
1. `subject_teacher_dashboard_*.png`: Mathematics Teacher Dashboard with "Room 301", clean pending banner, and canonical registers.
2. `subject_teacher_dashboard_scrolled_*.png`: Full view of teaching schedule and assigned classes.
3. `class_performance_ledger_10a_*.png`: Clean Mathematics Results page for Class 10-A with Class Average, Total Students, Marks to Review, and Enter Marks action.
4. `marks_entry_register_10a_*.png`: Working Enter Marks register page reached seamlessly without 404 error.
5. `student_notes_page_*.png`: Simple, friendly Student Notes table scoped to assigned classes.
6. `student_notes_modal_*.png`: Add Note dialog with clear, plain-language form inputs.
7. `responsive_1024_768_*.png`: Tablet viewport audit (1024 × 768).
8. `responsive_768_1024_*.png`: Portrait tablet audit (768 × 1024).
9. `responsive_390_844_*.png`: Mobile viewport audit (390 × 844) with zero horizontal overflow.

---

## 8. Comprehensive Workflow Correction & Pilot Release Validation

Following extensive stakeholder walkthroughs, 10 workflow, navigation, export, and role boundaries defects were addressed and verified:

### Workflow Corrections & Verification Matrix

| Workflow / Defect Area | Previous Problem | Implemented Correction | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **1. Student Directory Navigation** | Clicking rows or student names did not navigate to the canonical dossier; users had to hunt for specific buttons. | Row click, student name, and admission number navigate directly to `/students/:id`. Added explicit "Quick View" button for the side drawer preview. | **VERIFIED**: Row click navigates to dossier at `/students/stu-10a-01`. |
| **2. Dedicated Attendance History** | Student attendance history was mixed with marks and behaviour in the dossier, lacking dedicated analysis. | Built `/students/:id/attendance` featuring attendance KPIs, date-by-date attendance log, status remarks, and genuine Excel `.xlsx` export only (no print button, no academic/marks clutter). Linked from Student Dossier Area 1 and Attendance Ledger. | **VERIFIED**: Loaded `/students/stu-10a-01/attendance`, verified clean attendance-only interface and `.xlsx` export. |
| **3. Reports Hub Streamlining** | Reports Hub was congested with statutory CBSE affiliation claims, print engines, and promotional cards. | Streamlined to 3 core tools: (1) Attendance Ledger (`/reports/attendance`), (2) Academic Performance Comparison (`/reports/academic-comparison`), (3) Student Follow-up (`/reports/student-followup`). Prominently placed action card for Class Academic Summary (`/reports/class-summary`). Purged all promotional/bureaucratic jargon. | **VERIFIED**: Inspected `/reports`; clean 3-card layout + Class Summary action card. |
| **4. Genuine Excel (.xlsx) Register Export** | Attendance exports were raw flat text or broken format. | Implemented `downloadAttendanceRegisterXlsx` using `xlsx` library, generating genuine multi-column `.xlsx` matrix with P, A, L, HD, OFF, and HOLIDAY plus summary legend. | **VERIFIED**: Unit tested in `WorkflowCorrections.test.ts` and verified in browser. |
| **5. Class Academic Summary Report** | Missing combined grade-level reporting across parallel sections of the same grade. | Implemented `/reports/class-summary` supporting multi-section selection with same-grade validation (e.g. 10-A + 10-B combined Class 10 report; blocks mixing 9th and 10th grades). Displays score distribution bands (≥90%, 75-89%, 60-74%, 33-59%, <33%), weakest subjects, top/bottom 10 lists, CSV export, and print stylesheet. | **VERIFIED**: Tested combination of 10-A + 10-B; verified band metrics and weakest subjects. |
| **6. CSV Export Fix (Empty Downloads)** | CSV downloads were empty (0 bytes) or corrupted due to `encodeURI` truncating data URLs at `#` (`Roll #`, `Admission #`). | Replaced data URIs with `downloadCsv` utility utilizing `Blob` and `URL.createObjectURL`. Applied across Student Directory, Attendance, Class Performance Ledger, and Marks Entry Register. | **VERIFIED**: Exports generate full CSV files with correct column headers. |
| **7. Class Teacher Attendance Policy** | Missing clear time policy; confusing read-only banners; dual-custody jargon. | Enforced 3-day edit window policy (today + previous 2 calendar days editable normally; older changes require non-empty justification reason recorded with audit history). Removed all awkward banners and bureaucratic jargon. | **VERIFIED**: Class 10-A daily register tests today edit without prompt, past date prompts for non-empty justification before saving. |
| **8. Student Follow-up & Intervention Persistence** | "Log Formal Intervention Action" opened a mock browser `alert(...)`. | Built functional **Record Follow-up** modal persisting interventions to repository (`recordStudentFollowUp`) with category (Guardian Contacted, Parent Meeting Planned, Extra Subject Support, etc.), notes, actor, and timestamp. Read-only oversight for Principal. | **VERIFIED**: Recorded intervention for Aarav Singhania; verified persistence in follow-up history drawer. |
| **9. Principal Read-Only Oversight** | Principal saw editing controls or patronizing read-only error banners across registers and actions. | Removed editing controls from Principal UI across daily register and follow-up actions while keeping school-wide read access. Guarded repository mutation methods to prevent unauthorized writes. | **VERIFIED**: Principal has school-wide view with no edit buttons; unit tests pass. |
| **10. Subject Teacher Workspace** | Subject Teacher had confusing metrics and lacked assessment cycle breakdown per assigned class. | Redesigned dashboard metrics: "Unique Assigned Classes" vs "Total Marks Registers". Added per-class assessment cycle drill-down tabs (UT-1 Finalized / View Results, UT-2 Draft / Enter Marks). Marks Entry Register locks context (class, subject, cycle). | **VERIFIED**: Clicked "Enter Marks" on UT-2 for 10-A; opened with locked context and clean input grid. |

## 9. Pilot Release Final Functional & Usability Verification (FR-0 through FR-7)

Following the complete implementation of Functional Requirements v1.0, the pilot was verified against all architectural and visual specifications.

### Comprehensive Requirements Verification

| Requirement ID | Requirement Scope | Implementation & Behavior | Verification Status |
| :--- | :--- | :--- | :--- |
| **FR-0** | Visual Design System | Refined palette applied across all routes: Warm Ivory (`#F8F6F0`), White (`#FFFFFF`), Deep Charcoal (`#28251F`), Antique Gold (`#80632F`), Muted Olive/Sage (`#777B60`), Muted Red (`#B7463F`), Warm Border (`#E5DED1`). Authentic school logo rendered in sidebar, login, and reports with crisp proportions. | **VERIFIED** (`erp_home_*.png`) |
| **FR-1** | Student Dossier | Student directory navigates to canonical dossier (`/students/:id`). Concise default layout structured into 3 clear areas: (1) Attendance, (2) Academic results, (3) Teacher notes. | **VERIFIED** (`/students/STU-10A-01`) |
| **FR-2** | Evidence-Based Explanations | "Explain a change in marks" evidence panel displays score change, attendance during the reporting interval, and relevant teacher notes. Strictly uses non-causal phrasing ("Possible contributing factors — these records show a change over time but do not establish its cause"). | **VERIFIED** (`marks_explanation_*.png`) |
| **FR-3 & FR-4** | Academic Performance Charts & Benchmarks | Recharts integration in Student Dossier supporting 3 views: (a) Single subject across assessments, (b) All subjects within one assessment, (c) Overall academic progress. Time range filtering (3m, 6m, 1y, 2y, 3y). Missing marks render as gaps (`connectNulls={false}`, never zero). Displays Class Mean and Class Highest benchmarks without revealing student identities. Simple SVG breakdown bars preserved below chart. | **VERIFIED** (`academic_trends_*.png`) |
| **FR-5** | Custom-Date Attendance | Custom-date attendance with presets (Today, Last 3 Days, Last 7 Days, Custom range) and multi-class selection for Principal. Distinguishes Present, Absent, OFF, School Holiday, and Unmarked (never treated as absent). Subject Teacher restricted to aggregate turnout only. | **VERIFIED** (`attendance_reports_*.png`) |
| **FR-6** | Real Excel (.xlsx) Register Export | Generates genuine `.xlsx` binary workbook using SheetJS with first columns: `S. No.`, `Roll No.`, `Student Name`, followed by date columns, `Total Present`, `Total Absent`, and `Attendance %`. Legend explains P, A, OFF, HOLIDAY, UNMARKED (and omits L by default unless configured). Re-parsed and verified in automated test suite. | **VERIFIED** (`WorkflowCorrections.test.ts`) |
| **FR-7** | Deterministic Demo Dataset | Deterministic PRNG seed data (~1,000 synthetic students, 20 sections across classes 1–10). Resettable, relational integrity preserved, no silent demo fallbacks in Firebase mode. | **VERIFIED** (`seedData.ts`, `demoRepository.ts`) |
| **Role Permissions** | Access Boundaries | Principal is school-wide read-only. Class Teacher scoped to assigned section (Class 10-A). Subject Teacher scoped to assigned subjects/classes with aggregate attendance only. Dual-responsibility teacher (Shri Alok Saxena: 10-A Class Teacher + Math across 10-A, 10-B, 9-A, 9-B). | **VERIFIED** (`RoleAuthorization.test.tsx`) |

### Verification Evidence & Test Execution

- **Automated Test Suite**: 57 / 57 passing (`npm test -- --run`)
  - `src/test/RoleAuthorization.test.tsx` (25 tests): Principal read-only, Class Teacher section scoping, Subject Teacher restrictions, Dual-responsibility teacher.
  - `src/test/WorkflowCorrections.test.ts` (11 tests): Excel `.xlsx` re-parsing, column headers, legend 'L' omission, non-causal explanation wording, missing mark gaps, benchmark calculations, teacher note permissions.
  - `src/test/App.test.tsx` (11 tests): Route handling, Student Ledger, Teacher notes label.
  - `src/test/AcademicAnalytics.test.ts` (10 tests): Historical range calculations, mark normalization, non-causal evidence aggregation.
- **Production Bundle Build**: 0 errors (`npm run build` -> `tsc -b && vite build`)
- **Code Quality**: 0 errors (`npm run lint`)
- **Live Browser Walkthrough**: Verified with browser automation subagent at `http://localhost:5173/`
  - Desktop viewports (1440 × 900, 1024 × 768)
  - Mobile viewport (390 × 844) with responsive navigation drawer and zero overflow
  - Video recording: `erp_full_verification_1792749643852.webp`

---

## 10. Student Academic Performance Page Repair & UI/UX Redesign (Task 4)

In response to stakeholder review and attached defect screenshots, a complete redesign and underlying data-presentation repair was executed for the HanuJai High School ERP, focusing on the Student Academic Performance experience and application-wide filter ergonomics.

### A. Root-Cause Analysis: Repeated Labels, Zig-Zag Lines & Redundant Progress Bars

1. **Repeated Labels & Misleading Zig-Zag Trend Line**:
   - **Root Cause**: In `StudentDetail.tsx`, the subject selection state defaulted to `'all'`. When computing chart points, the code mapped over all 20 records (5 subjects across 4 assessment cycles for Class 10-A), using `cycle.title` as the X-axis key. Consequently, "Unit Test 1" appeared 5 times sequentially on the X-axis, followed by repeated instances of "Unit Test 2", "Half Yearly", etc. A single continuous line was drawn connecting marks across different subjects (e.g., Mathematics 88% → Science 72% → English 91%), creating a deceptive zig-zag artifact that implied a wild fluctuation in a single academic trajectory.
   - **Corrective Fix**: Separated data selectors strictly into three independent modes:
     - **`subjectResultRows`**: Strictly one data point per assessment cycle for the single chosen subject.
     - **`assessmentResultRows`**: Strictly one data point per subject for the single chosen assessment cycle.
     - **`progressCycleRows`**: Strictly one aggregate data point per assessment cycle calculated as $\frac{\sum \text{obtained}}{\sum \text{maxMarks}}$.
   - **Result**: Labels never repeat on the X-axis. Trends accurately represent true academic progression without cross-subject pollution.

2. **Redundant Progress Bars**:
   - **Root Cause**: The original page duplicated the Recharts visualization with an exhaustive vertical list of SVG progress bars repeating the identical cycle titles, dates, marks, and percentages.
   - **Corrective Fix**: Purged the redundant progress bars list from the default view. Replaced it with four compact KPI summary metric cards (Latest Result, Previous Result, Score Change in % pts with directional indicators, and Period Average vs. Class Mean).

3. **Excessive Vertical Height & Wall of Records**:
   - **Root Cause**: A continuous scroll table containing dozens of rows across all subjects overwhelmed the page.
   - **Corrective Fix**: Replaced the monolithic table with an active-view table tailored to the active mode (e.g. Subject Progress shows only that subject's cycles; Subject Comparison shows only that assessment's subjects; Overall Progress shows cycle aggregates with an on-demand expandable subject breakdown). The complete historical register transcript is placed in a collapsible drawer, collapsed by default.

### B. Rebuilt Filter System & Institutional Component Library

1. **Reusable `SegmentedControl` Component (`src/components/ui/SegmentedControl.tsx`)**:
   - Built an accessible, keyboard-friendly segmented control for switching viewing modes (`Subject Progress` | `Subject Comparison` | `Overall Progress`) and time ranges (`3M`, `6M`, `1Y`, `2Y`, `3Y`).
   - Uses the institutional antique-gold active indicator (`#80632F` on ivory/white) with smooth transitions.

2. **Reusable `FilterToolbar` Component (`src/components/ui/FilterToolbar.tsx`)**:
   - Provides an organized, responsive container for filters with label badges, count indicators, and clean spacing.

3. **Global Custom Dropdown Styling (`.hhs-select`)**:
   - Integrated a custom inline SVG chevron (`data:image/svg+xml... stroke='%2380632F'`).
   - Standardized height (36px), padding, border (`#E5DED1`), hover border (`#D1C7B7`), and focus ring (`rgba(128, 99, 47, 0.2)`).
   - Applied globally in `designSystem.css` so all `<select>` controls match the design system.

### C. Strict 5-Colour Institutional Palette Enforced

| Purpose | Colour | Applied Elements |
|---|---|---|
| Main page background | Warm ivory `#F8F6F0` | `body`, `#root`, page canvas |
| Surfaces & cards | White `#FFFFFF` | Cards, modal panels, filter toolbars, active tabs |
| Primary text & headings | Deep charcoal `#28251F` | All headings, table headers, primary data text |
| Primary action & accent | Antique gold `#80632F` | Active navigation, buttons, active segmented tabs, student chart series, focus rings |
| Supporting indicator | Muted sage `#777B60` | Class average chart series, secondary indicators, supporting badges |
| Destructive / Error only | Muted red `#B7463F` | Attendance deficits, missing records, destructive actions |
| Borders & dividers | Warm neutral `#E5DED1` | Card outlines, table cell borders, input borders |

### D. Verification Evidence (Task 4)

- **Automated Tests**: 57 / 57 passing (`npm test -- --run`).
- **Production Build**: 0 errors (`npm run build`).
- **ESLint**: 0 errors (`npm run lint`).
- **Browser Automation Verification**:
  - Live walkthrough recorded: `academic_ui_redesign_1792752653269.webp`.
  - Screenshots captured:
    - `subject_progress_view_*.png`: Mathematics progress across distinct cycles without repetition; 4 KPI cards; compact table.
    - `subject_comparison_view_*.png`: Bar chart comparing 5 subjects for Unit Test 1 against class mean and highest benchmark.
    - `overall_progress_view_*.png`: Trajectory line chart across cycles; cycle summary table with inline subject breakdown.
    - `historical_transcript_expanded_*.png`: Full historical transcript expanding and collapsing smoothly.
  - Viewports verified: Desktop (1440×900) and Mobile (390×844) with zero overflow.



