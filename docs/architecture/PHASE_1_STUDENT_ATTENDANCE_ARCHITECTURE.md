# HanuJai High School ERP — Phase 1 Architecture: Student Management & Attendance Only

## Executive Summary

Following strategic directives from school leadership (Principal and Director), the HanuJai High School ERP across both Web (`hanujai-erp`) and Mobile (`hanujai-erp-mobile`) has been simplified to focus exclusively on three mission-critical operational pillars:

1. **Student Information Management** — Student master ledger, identity, admission details, and guardian contact records.
2. **Daily Attendance Management** — Rapid morning roll-call (Present & Absent only; no Late status), multi-period history, and multi-class compliance reporting with genuine Excel exports.
3. **Automated WhatsApp Attendance Notifications** — Background delivery of bilingual notifications to parents, running silently without cluttering the teacher interface with technical worker queues.

All academic grading, marks registers, examination schedules, subject-teacher assignments, academic risk watchlists, and behavioral incident notes have been removed from active application surfaces and safely archived.

---

## 1. System Scope & Boundaries

| Module | Phase 1 Status | Operational Behavior |
| :--- | :--- | :--- |
| **Student Directory** | **ACTIVE** | Centralized student ledger with search, filtering by section, CSV exports, and detailed student profiles. |
| **Student Profile / Dossier** | **ACTIVE** | Basic information (Enrollment & Identity details, Parent/Guardian contacts) and 90-day attendance history with Excel download. |
| **Daily Attendance Register** | **ACTIVE** | Rapid morning roll call. Strictly **Present** or **Absent**. Saves to Firestore and enqueues WhatsApp dispatch jobs. |
| **Attendance Reporting** | **ACTIVE** | Multi-class and whole-school attendance ledger with multi-month presets (`Last 3 Months`, `Last 6 Months`, `Last 9 Months`, `Custom`) and genuine `.xlsx` spreadsheet exports. |
| **WhatsApp Dispatch** | **ACTIVE (BACKGROUND)** | Automated asynchronous background job dispatch. Technical worker queues and raw debug boxes removed from teacher UI. |
| **Marks & Examinations** | **REMOVED** | All marks entry, assessment cycles, report cards, and comparison charts removed and redirected. |
| **Teacher Incident Notes** | **REMOVED** | Behavioral logging, follow-up logs, and pastoral notes removed and redirected. |
| **Subject Teacher Experience** | **DISABLED** | Restricted in Phase 1. Only **Principal** and **Class Teacher** are active. |

---

## 2. Role-Based Access Control (RBAC) Matrix

### A. Principal (Executive Oversight)
- **Scope**: School-wide oversight across all ~1,000 enrolled students and 20 class sections.
- **Access Level**: Strictly **Read-Only**.
- **Dashboard**: School-wide student count, today's turnout percentage, section-by-section roll-call submission status, and 7-day attendance trajectory.
- **Restrictions**: Cannot submit attendance registers, edit student records, or approve modifications.

### B. Class Teacher (Classroom Responsibility)
- **Scope**: Exclusively assigned class section (e.g. Class 10-A, 50 enrolled students).
- **Access Level**: **Operational Authority**.
- **Dashboard**: Welcome banner with section label, enrolled/present/absent student breakdown, quick roll-call action, and immediate list of absent students with guardian phone numbers for direct communication.
- **Allowed Operations**: Submit morning attendance register, update student guardian phone/address records for assigned students, export section attendance Excel.

### C. Subject Teacher
- **Phase 1 Status**: Disabled. Any login attempt displays a clear Phase 1 scope notice.

---

## 3. Database Migration & Integrity Audit

A controlled migration was executed against the production demo Firebase database (`hanujai-erp-demo`):

### Pre-Deletion Backup
- **Archive File**: `hanujai-erp/backups/academic_notes_backup_2026_11_13.json` (3,812 KB).
- **Manifest File**: `hanujai-erp/backups/deletion_manifest_2026_11_13.json`.
- **Archived Collections**: `assessments` (12), `marksRegisters` (240), `incidents` (10), `studentFollowUps` (0), `subjectAssignments` (20), `subjects` (25). Total: 307 documents.

### Post-Cleanup Collection Verification
| Collection | Initial Docs | Post-Cleanup Docs | Status |
| :--- | :--- | :--- | :--- |
| `students` | 1000 | 1000 | **100% Intact** (`academicAverage` field stripped) |
| `classes` | 60 | 60 | **100% Intact** |
| `staff` | 26 | 26 | **100% Intact** (`assignedSubjects` field stripped) |
| `academicYears` | 3 | 3 | **100% Intact** |
| `schoolSettings` | 1 | 1 | **100% Intact** |
| `attendanceSessions` | 202 | 202 | **100% Intact** |
| `attendanceAggregates` | 202 | 202 | **100% Intact** |
| `attendanceCorrections` | 2 | 2 | **100% Intact** |
| `attendanceNotifications`| 400 | 400 | **100% Intact** |
| `auditEvents` | 4 | 4 | **100% Intact** |
| `assessments` | 12 | 0 | Cleanly Deleted |
| `marksRegisters` | 240 | 0 | Cleanly Deleted |
| `incidents` | 10 | 0 | Cleanly Deleted |
| `studentFollowUps` | 0 | 0 | Cleanly Deleted |
| `subjectAssignments` | 20 | 0 | Cleanly Deleted |
| `subjects` | 25 | 0 | Cleanly Deleted |

---

## 4. Diagnostics & Explanations

### Issue 1: "Why all 50 skipped" (Mobile Dashboard WhatsApp Card)
- **Root Cause**: The notification policy is designed to alert parents of **Absent** students to prevent spamming parents of students who are attending normally. When a teacher marks all 50 students as "Present", the worker marks all 50 notification jobs as "Skipped" (no action required). In demo pilot mode, only numbers on the pilot allowlist are dispatched.
- **Resolution**: The technical worker debug card (`50 Total, 0 Sent, 0 Pending, 50 Skipped`) and queue inspector have been removed from the teacher dashboard. Attendance confirmation now displays a clean, friendly status banner indicating that background automated absent notifications are active.

### Issue 2: "Uncaught Error: java.io.IOException: Failed to download remote update"
- **Root Cause**: Occurred when opening the application in Expo Go while the development machine's Metro server was disconnected or on a different network, causing Expo's dynamic bundle loader to fail with an I/O network exception.
- **Resolution**: Standalone Android APK builds (`eas build -p android --profile preview`) package all JavaScript assets directly inside the APK package, operating 100% offline without requiring Expo Go or a running Metro development server.
