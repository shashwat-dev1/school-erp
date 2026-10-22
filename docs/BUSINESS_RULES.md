# HanuJai High School ERP — Operational Business Rules & Domain Policy

This document defines the central, consistent policy model, role-based boundaries, and demonstration rules governing the HanuJai High School ERP system.

---

## 1. School Operational Model

- **Campus Scope**: Single private institutional pilot for **HanuJai High School**, Jaipur, Rajasthan, India.
- **Academic Structure**: Classes 1 through 10, each organized into Sections A and B (Total: 20 class sections).
- **Enrolment Scale**: Configurable demonstration dataset initialized with 1,000 enrolled students (50 students per section across 20 sections).
- **Academic Session**: Active demonstration session `2025–2026` (April 1, 2025 – March 31, 2026).
- **Demonstration Settings**: Affiliation identifiers, marking windows, and grading thresholds are clearly labeled demonstration defaults rather than rigid statutory claims.

---

## 2. Centralized Permission & Role Policy Model

The system enforces strict operational separation across four primary school roles. Navigation, direct routes, and data queries all derive from this single model:

### A. Principal (`principal`)
- **Mandate**: Overall institutional governance and high-level school operations.
- **Work Area**: Compact Executive Overview (Home, Students, Attendance, Results, School Setup). Maximum 5 navigation items.
- **Capabilities**:
  - School-wide metrics: Total students, present today, absent today, students needing attention.
  - Drill-down access into any class, section, student summary, or attendance register.
  - Review and authorize attendance correction requests (Dual-custody approval).
  - Review finalized marks and school-wide performance summaries.
  - Configure demonstration settings (session, marking windows, passing marks).
- **Constraints**:
  - Cannot approve an attendance correction request initiated by themselves (Rule SEC-201).
  - Does not see low-level developer logs, raw database identifiers, or technical error stacks.

### B. Office Staff (`office_admin`)
- **Mandate**: Parent and visitor inquiries, student admissions, attendance tracking, and official school documentation.
- **Work Area**: Administrative Inquiry Desk (Home, Students, Attendance, Results, Reports). Maximum 5 navigation items.
- **Capabilities**:
  - Instant student lookup for parents visiting the office (displays attendance percentage, enrolled class, recent examination grades, and general teacher notes).
  - Print parent-teacher meeting (PTM) slips and official student report cards.
  - View school-wide attendance completion status by class.
- **Boundaries**:
  - Cannot enter or edit subject assessment marks.
  - Cannot approve attendance corrections.
  - Restricted medical records and sensitive disciplinary details are withheld from ordinary student summaries.

### C. Class Teacher (`class_teacher`)
- **Mandate**: Daily classroom roll-call, pastoral care, and academic welfare for their **strictly assigned class section** (e.g., Class 10-A).
- **Work Area**: Class Workspace (My Class, Attendance, Results, Student Notes). Maximum 4 navigation items.
- **Capabilities**:
  - Mark daily morning attendance for assigned students.
  - Submit late attendance correction requests with mandatory reason notes.
  - Access parent phone numbers for absent students to enable immediate home outreach.
  - Review class performance summaries and log pastoral notes for assigned students.
- **Boundaries**:
  - **Zero access to unassigned classes** (a Class 10-A tutor cannot view or mark Class 9-B).
  - Cannot view school-wide administrative dashboards, system settings, or global staff audit ledgers.
  - Cannot approve their own attendance correction requests (Dual Custody).

### D. Subject Teacher (`subject_teacher`)
- **Mandate**: Subject-specific teaching, marks register entry, and subject evaluation for **strictly assigned subject and class combinations** (e.g., Mathematics for Classes 10-A, 10-B, and 9-A).
- **Work Area**: Teaching Register (My Classes, Enter Marks, Results, Student Notes). Maximum 4 navigation items.
- **Capabilities**:
  - Enter and save marks for assigned subjects and classes.
  - Track pending marks registers and submission status.
  - View class-level subject performance distributions.
- **Boundaries**:
  - **Zero access to marks for unassigned subjects** (a Mathematics teacher cannot view or edit Science or Hindi marks).
  - Cannot access morning daily attendance registers.
  - Cannot access school-wide administration settings or risk ledgers.

---

## 3. Student Record Access & Plain-Language Dossier Standard

### Parent Visit Simplicity Test
When a parent visits the school office or meets a teacher:
1. Staff searches for the student by name or admission number.
2. The summary displays immediately:
   - Student full name, admission number, roll number, class and section.
   - Attendance summary: Total days present, days absent, and attendance rate (%).
   - Academic results: Latest exam marks by subject with passing indicators.
   - Relevant teacher notes: Constructive remarks on participation and progress.
3. Detailed historical ledgers, full term archives, and pastoral case histories remain organized under secondary tabs rather than cluttering the initial screen.
4. Confidential medical details and sensitive administrative flags are withheld from routine inquiry views.

---

## 4. Attendance Rules & Dual-Custody Approval

1. **Daily Roll-Call**: Morning attendance is marked once per day by the assigned Class Teacher.
2. **Attendance States**:
   - `Present`: Student is present in class.
   - `Absent`: Student is absent.
   - `Late`: Student arrived after the scheduled morning bell.
   - `Excused`: Leave approved in advance with parent/guardian note.
3. **Dual-Custody Correction Protocol (SEC-201)**:
   - Once marked and submitted, an attendance register cannot be silently overwritten.
   - A correction request must be submitted with previous state, requested state, and reason.
   - The Principal or authorized administrator reviews and confirms the change.
   - Self-approval is blocked by permission logic.

---

## 5. Marks Entry & Academic Evaluation Rules

1. **Marks Bounds**:
   - Score obtained must be between `0` and the configured maximum marks for the assessment.
   - Values exceeding maximum marks are rejected with a clear plain-English warning.
2. **Absence Treatment**:
   - Absent students are recorded as `Absent` (`isAbsent: true`, `score: null`).
   - Absent students are never silently converted into a score of zero.
3. **Assessment Cycles**:
   - Periodic Test 1 (Max 25)
   - Periodic Test 2 (Max 25)
   - Half-Yearly Exam (Max 80)
   - Annual Exam (Max 80)

---

## 6. Plain-Language Vocabulary Standards

All user-facing screens use everyday school terminology instead of software engineering or data warehouse jargon:

| Technical / Old Term | Plain-Language Standard |
| :--- | :--- |
| Operational Hub / Master Matrix | **Home** |
| Risk Indicators / Risk Watchlist | **Students Who May Need Attention** |
| Assessment Matrix / Gradebook Schema | **Marks / Enter Marks** |
| Provisioning / Role Entitlements | **Staff Account Setup** |
| Data synchronization failed | **We couldn't save your changes. Please try again.** |
| Unauthorized resource access | **You do not have permission to view this page.** |
| No records returned | **No students found.** |
| Persistence failed | **We couldn't save this change.** |
| Configuration validation | **Check these settings.** |
| Pastoral intervention protocol | **Teacher Notes & Follow-up** |

---

## 7. Faculty Assignment Integrity Rules

- **Single Class Teacher Constraint (SEC-108)**: A faculty member may serve as the designated Class Teacher for at most one class section.
- **Subject-Class Allocation**: A faculty member may teach multiple subjects across different class sections, and can only access marks registers matching their active assignments.

---

## 8. Corrective Release Policy Rules (Defects A–F)

### Rule CR-101: Subject Teacher Academic Isolation (Defect A)
- When a Subject Teacher accesses class performance (`/performance/classes/:classId`), the interface must render a single-subject ledger strictly scoped to their assigned subject (e.g. Mathematics).
- Displays solely: Class Average (calculated from valid recorded marks), Total Students, and Marks to Review (< 33% or absent).
- Multi-subject cross-verification matrices, whole-class tutor watchlists, and cohort cards are inaccessible to subject teachers.
- A direct "Enter Marks" action provides seamless navigation to the active marks register.

### Rule CR-102: Student Notes Privacy & De-bureaucratization (Defect B)
- All statutory compliance claims, proctorial ledger labels, and candidate terminology are replaced with plain-language "Student Notes".
- Subject Teachers are strictly scoped to viewing notes they authored or notes for students enrolled in their assigned classes.
- School-wide disciplinary archives remain restricted to the Principal and authorized leadership.

### Rule CR-103: Canonical Assignment & Register Consistency (Defect C)
- Register counts (completed vs. draft) must derive directly from unique assignment and register records, never hardcoded.
- Duplicate class names in pending banners and redundant room labels ("Room Room 301") are strictly prohibited.

### Rule CR-104: Marks Entry Routing Guarantee (Defect D)
- All "Enter Marks" navigation triggers must resolve to canonical routes: `/academics/assessments/marks/:registerId` or `/academics/marks/:assessmentId/:classId/:subjectId`.
- No broken 404 routes or technical HTTP status messages are exposed to users. A friendly plain-language fallback is rendered with a direct return path.

### Rule CR-105: Warm Gold Institutional Palette Standard (Defect E)
- The application visual design is standardized on Warm Ivory (`#F8F6F0`), Deep Charcoal (`#28251F`), Antique Gold (`#795D2D`), Refined Gold (`#B99452`), Pale Gold (`#F3E8D0`), Warm Border (`#E5DED1`), and Muted Red (`#B7463F`).

