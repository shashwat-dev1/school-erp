# HanuJai High School ERP — Operational Business Rules & Domain Rationale

This document defines the core operational business rules, authorization boundaries, and demonstration defaults governing the HanuJai High School ERP system.

---

## 1. School Operational Model

- **Campus Scope**: Single institutional instance for **HanuJai High School**, Jaipur, Rajasthan, India.
- **Academic Structure**: Classes 1 through 10, each organized into Sections A and B (Total: 20 class sections).
- **Enrolment Planning Scale**: Nominal capacity of 40 students per section (~760 to 800 students total).
- **Academic Session**: Active session `2025–2026` (April 1, 2025 to March 31, 2026).
- **Demonstration Settings**: Board affiliation identifiers, attendance marking windows, and grading thresholds are editable demonstration defaults for pilot evaluation, clearly labeled to distinguish them from confirmed statutory mandates.

---

## 2. Role-Based & Assignment-Based Access Control (RBAC & ABAC)

The system enforces strict operational separation across four primary staff roles:

### A. Principal (`principal`)
- **Executive Mandate**: Holistic institutional oversight and governance.
- **Capabilities**:
  - Full school-wide access across all 20 sections and student master ledgers.
  - View aggregate daily attendance muster, class turnout comparisons, and session completion rates.
  - Final sign-off on dual-custody attendance correction requests.
  - Marks finalization and academic audit oversight.
  - Full access to the non-repudiable system audit log.
  - Management of institutional policies, academic calendar, and faculty allocations.
- **Constraint**: Cannot counter-approve an attendance correction requested by themselves (Rule SEC-201).

### B. Office Administrator (`office_admin`)
- **Operational Mandate**: Student admissions, directory lookup, record compliance, parent communication, and official reports.
- **Capabilities**:
  - Searchable student directory across all classes for enrollment and parent inquiries.
  - View school-wide operational attendance snapshots and section rosters.
  - Access approved statutory and operational reports (e.g., student report cards, attendance audits).
  - Staff directory management.
- **Boundaries**:
  - Cannot enter or modify subject assessment marks.
  - Cannot approve attendance corrections.
  - Cannot alter institutional security policies or access confidential disciplinary notes.

### C. Class Teacher (`class_teacher`)
- **Classroom Mandate**: Pastoral care, daily roll-call, and holistic academic progress for their **assigned section** (e.g., Class 10-A).
- **Capabilities**:
  - Mark daily attendance register for their assigned section during the morning window (07:45–09:15).
  - Submit late attendance correction requests with mandatory reason and parent note.
  - Inspect nominal roll roster and parent emergency contacts for their assigned section.
  - View consolidated subject marks matrix for their assigned students.
  - Review student care flags and log pastoral observations for their assigned section.
- **Boundaries**:
  - **Zero access to other class sections** (e.g., a Class 10-A tutor cannot mark or view Class 09-B roll).
  - Cannot view whole-school operations hub or global audit ledger.
  - Cannot approve their own correction requests (Dual Custody).

### D. Subject Teacher (`subject_teacher`)
- **Pedagogical Mandate**: Teaching and scholastic evaluation for assigned subjects and classes (e.g., Mathematics for Classes 10-A, 10-B, and 09-A).
- **Capabilities**:
  - Enter and draft assessment marks for their assigned subject and class combinations.
  - Calculate CBSE continuous evaluation grades and view subject cohort distributions.
  - View students enrolled in classes they teach (academic context).
- **Boundaries**:
  - **Zero access to marks for unassigned subjects** (e.g., a Math teacher cannot read or alter Hindi or Science marks).
  - No access to classroom daily roll-call registers.
  - No access to school-wide risk watchlists or global audit stream.

---

## 3. Operational Attendance Rules

1. **Morning Roll-Call Window**: Configured from `07:45` to `09:15` IST with a 15-minute grace period. Outside this window, session registers transition to locked state.
2. **Attendance States**:
   - `Present`: Student is physically present in the classroom.
   - `Absent`: Student is not present.
   - `Late`: Student arrived during the grace period.
   - `Excused`: Prior verified medical or official school leave.
3. **Session Completion**: A session is marked complete only upon explicit submission by the assigned class teacher. Unmarked students are distinguished from absent students.
4. **Dual-Custody Correction Protocol (Rule SEC-201)**:
   - Any modification to an already submitted attendance session requires a formal correction request.
   - The Class Tutor submits previous state, proposed state, and mandatory justification.
   - The Principal reviews and provides digital counter-authorization.
   - Self-approval is strictly rejected by the permission engine.

---

## 4. Academic Evaluation & Grading Rules

1. **CBSE 9-Point Grading Scale**:
   - `A1`: 91% – 100% (Grade Point: 10.0)
   - `A2`: 81% – 90.99% (Grade Point: 9.0)
   - `B1`: 71% – 80.99% (Grade Point: 8.0)
   - `B2`: 61% – 70.99% (Grade Point: 7.0)
   - `C1`: 51% – 60.99% (Grade Point: 6.0)
   - `C2`: 41% – 50.99% (Grade Point: 5.0)
   - `D`: 33% – 40.99% (Grade Point: 4.0) — Passing Boundary
   - `E1`: 21% – 32.99% — Remedial Support Required
   - `E2`: Below 21% — Critical Shortfall
2. **Marks Integrity**:
   - Marks obtained must never exceed configured maximum marks.
   - Absenteeism is explicitly recorded as `ABS` (`isAbsent: true`, `marksObtained: null`) and is never silently transformed into zero.
3. **Continuous Assessment Cycles**:
   - Unit Test 1 (Max 25, Pass 9, Weight 10%)
   - Unit Test 2 (Max 25, Pass 9, Weight 10%)
   - Half-Yearly Examination (Max 80, Pass 27, Weight 30%)
   - Annual Examination (Max 80, Pass 27, Weight 50%)

---

## 5. Transparent Rule-Based Care Indicators

Flags are explainable, empirical triggers grounded in quantitative evidence:
- **`#ATT-01` (3 Consecutive Absences)**: Absent on 3 consecutive school days without parent communication. Recommended action: Tutor phone outreach.
- **`#ATT-03` (Statutory Shortfall)**: Cumulative attendance below statutory 75.0% minimum. Recommended action: PTM conference and formal shortfall notice.
- **`#ACAD-04` (Performance Drop >20%)**: Drop exceeding 20% between comparable cycles in core subjects. Recommended action: Remedial tutorial support.

No speculative AI or stigmatizing labels are utilized.

---

## 6. Faculty Assignment Integrity (Rule SEC-108)

- **Single Class Teacher Constraint**: A faculty member may serve as the Class Teacher for at most **one** section to guarantee dedicated pastoral oversight.
- **Subject-Class Allocation**: Faculty may teach multiple subjects across multiple classes within an institutional workload limit of 24 periods per week.
