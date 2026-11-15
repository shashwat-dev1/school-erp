# HanuJai High School ERP — Functional Requirements Specification (FRS)

**Document Reference:** `HHS-FRS-2026-V1`  
**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Scope:** Phase 1 Core Production Pilot (Student Data, Daily Attendance, WhatsApp Notifications, Document Management, Parent Document Collection, Excel Ingestion)  
**Classification:** Institutional Engineering Standard  
**Last Updated:** November 16, 2026  

---

## 1. Executive Summary & Operational Scope

HanuJai High School ERP is a purpose-built institutional platform engineered for secondary and senior secondary operations in Jaipur, Rajasthan, India. Phase 1 focuses strictly on core administrative throughput and communication reliability.

### 1.1 In-Scope Functional Domains
1. **Staff Identity & Authentication Lifecycle:** Multi-tier authentication via Firebase Auth and Firestore with three distinct roles: `developer`, `admin`, and `principal`.
2. **Student Master Directory:** Complete student dossiers, demographics, guardian contacts, enrollment tracking, and active class allocations.
3. **Daily Attendance Management:** Daily morning attendance register entry, review, submission, automatic locking, and compliance tracking.
4. **Attendance Correction & Approval Workflow:** Audited correction workflow enabling Admin Office to request changes to locked registers, subject to Principal approval.
5. **Private Document Storage Management:** Centralized management of 9 mandatory student document slots using Private Vercel Blob storage with 5-minute signed download URLs.
6. **Parent-Facing Zero-OTP Document Collection:** Cryptographically secure (256-bit entropy), student-bound upload links for parents without requiring logins or OTPs.
7. **Automated WhatsApp Notification Engine:** Bilingual (Hindi and English) notifications sent to parents for daily attendance and document reminders via a dedicated Baileys background worker.
8. **Student Excel Data Ingestion:** 7-column bulk Excel import accessible to Developer and Admin Office roles directly from the Students Directory.
9. **Developer & Infrastructure Workstation:** Schema introspection, database backups/snapshots, system health monitoring, and interactive OpenAPI 3.0 Swagger portal.

### 1.2 Explicitly De-Scoped Domains (Phase 1)
- Academic marks entry, examinations, grade calculations, report card generation.
- Teacher login and individual subject faculty assignment portals.

---

## 2. Role-Based Access Control (RBAC) Specification

| Capability / Module | Developer (`developer`) | Admin Office (`admin`) | Principal (`principal`) | Public / Parent |
| :--- | :---: | :---: | :---: | :---: |
| **System Administration Console** | Full Access (R/W) | Denied (403) | Denied (403) | Denied (403) |
| **OpenAPI Swagger & DB Explorer** | Full Access (R/W) | Denied (403) | Denied (403) | Denied (403) |
| **Student Directory & Profile View** | Full Access (R/W) | Full Access (R/W) | Read-Only (R) | Denied (403) |
| **Student Enrollment / Edit** | Full Access (R/W) | Full Access (R/W) | Read-Only (R) | Denied (403) |
| **Excel Student Ingestion** | Full Access (R/W) | Full Access (R/W) | Read-Only (R) | Denied (403) |
| **Daily Attendance Register Entry** | Full Access (R/W) | Full Access (R/W) | Read-Only (R) | Denied (403) |
| **Attendance Correction Request** | Full Access (R/W) | Create Request (W) | Read-Only (R) | Denied (403) |
| **Attendance Correction Approval** | Approve/Reject (W) | Denied (403) | Approve/Reject (W) | Denied (403) |
| **Staff Document Upload & Delete** | Full Access (R/W) | Full Access (R/W) | Read-Only (R) | Denied (403) |
| **Parent Document Upload Link** | Full Access (R/W) | Generate Link (W) | Read-Only (R) | Upload Permitted Slots |
| **WhatsApp Notification Queue** | Full Access (R/W) | Trigger Dispatches | Read-Only (R) | Receive Messages |
| **Audit Log Directory** | Full Inspection (R) | Full Inspection (R) | Full Inspection (R) | Denied (403) |

---

## 3. Detailed Functional Requirements

### 3.1 Authentication & Staff Identity (FR-AUTH)
- **FR-AUTH-01:** System must authenticate staff using institutional email (`@hanujai.edu.in`) and passwords via Firebase Authentication.
- **FR-AUTH-02 (Critical Resolution):** System must resolve authenticated user `developer@hanujai.edu.in` strictly to role `developer` and name `System Administrator`. Any mismatched Firestore staff document must self-heal automatically upon login.
- **FR-AUTH-03:** Session tokens must expire in accordance with Firebase Auth token lifecycle. Explicit logout must purge all local and session storage keys.
- **FR-AUTH-04:** Accounts marked with status `deactivated` (including classroom teacher accounts) must be rejected at login with an operational notification explaining Phase 1 scope.

### 3.2 Student Management (FR-STU)
- **FR-STU-01:** Paginated ledger displaying admission number, roll number, full name, class/section, gender, guardian details, primary phone, and attendance percentage.
- **FR-STU-02:** Instant filtering across 20 school classes, text search (name, roll, admission number), and compliance filter (`< 75% Attendance`).
- **FR-STU-03:** Multi-student row selection enabling batch operations (e.g. bulk parent document upload requests).
- **FR-STU-04:** Fixed 7-column Excel ingestion directly accessible from Students List:
  - Column 1: Admission Number (Unique string)
  - Column 2: Roll Number (Positive integer)
  - Column 3: Full Name (Valid string)
  - Column 4: Gender (`M`, `F`, `O`)
  - Column 5: Class ID (e.g., `class-10-a`)
  - Column 6: Guardian Name
  - Column 7: Mobile Number (`+91` format, 10 digits)
- **FR-STU-05:** Pre-ingestion validation preview displaying total rows, valid rows, invalid rows with line-by-line errors, and duplicate collision warnings.

### 3.3 Daily Attendance Management (FR-ATT)
- **FR-ATT-01:** Daily register accessible to Admin Office and Developer for any authorized class section.
- **FR-ATT-02:** Single-click toggles for `Present` (green), `Absent` (red), `Late`, and `Half Day`.
- **FR-ATT-03:** Immediate register locking upon submission. Once locked, direct edits by Admin Office are strictly disabled.
- **FR-ATT-04:** Automatic calculation of class-level present count, absent count, and attendance percentage.
- **FR-ATT-05:** Automatic enqueueing of parent WhatsApp notification jobs for all enrolled students in the submitted register.

### 3.4 Attendance Correction Workflow (FR-CORR)
- **FR-CORR-01:** Admin Office can initiate a correction request on any locked register for a specific student.
- **FR-CORR-02:** Request must capture: session ID, student ID, date, current status, proposed status, and mandatory justification (minimum 10 characters).
- **FR-CORR-03:** Principal and Developer receive pending correction requests in a dedicated review queue.
- **FR-CORR-04:** Principal approval updates the attendance session record, recalculates monthly aggregates, and appends an immutable audit event.
- **FR-CORR-05:** Principal rejection records review notes and leaves the locked attendance register unchanged.

### 3.5 Student Document Management (FR-DOC)
- **FR-DOC-01:** System enforces exactly 9 mandatory document categories:
  1. `aadhaar_card` (Student Aadhaar Card)
  2. `birth_certificate` (Municipal Birth Certificate)
  3. `transfer_certificate` (Previous School TC)
  4. `previous_marksheet` (Previous Class Marksheet)
  5. `caste_certificate` (Category/Caste Certificate)
  6. `income_certificate` (BPL/EWS Certificate)
  7. `disability_certificate` (Medical Disability Certificate)
  8. `student_photo` (Passport Photo)
  9. `parent_signature` (Guardian Specimen Signature)
- **FR-DOC-02:** Storage in Private Vercel Blob store (`access: "private"`). No public URLs permitted.
- **FR-DOC-03:** Documents downloaded via time-limited signed URLs with strict 5-minute (300 seconds) expiration.
- **FR-DOC-04:** File validation: maximum size 5MB; MIME types restricted to `application/pdf`, `image/jpeg`, `image/png`.

### 3.6 Parent Document Collection Portal (FR-PARENT)
- **FR-PARENT-01:** Zero-OTP, zero-password upload gateway accessible via secure WhatsApp invitation link.
- **FR-PARENT-02:** Link contains 256-bit cryptographically secure token. Only SHA-256 token hash is stored in Firestore.
- **FR-PARENT-03:** Verification endpoint (`GET /api/documents/parent-verify`) validates token hash, expiration (72h), and revocation status.
- **FR-PARENT-04:** Upon successful verification, server issues short-lived HMAC-SHA256 session token (max 60m TTL) bound to student ID and permitted slots.
- **FR-PARENT-05:** Upload endpoint (`POST /api/documents/parent-upload`) requires valid HMAC session token and verifies live invitation status.
- **FR-PARENT-06:** PII minimization: parent phone number must never be persisted in document metadata or audit events.

### 3.7 WhatsApp Notification Pipeline (FR-WA)
- **FR-WA-01:** Dedicated background worker powered by Baileys connecting to institutional WhatsApp gateway.
- **FR-WA-02:** Bilingual message templates (Hindi & English) for attendance notifications and document reminders.
- **FR-WA-03:** Queue processing with rate limiting (1.5s - 3s delay per message) to prevent WhatsApp spam bans.
- **FR-WA-04:** Status tracking for each notification job (`pending`, `processing`, `sent`, `failed`).

### 3.8 Developer Console & Diagnostics (FR-DEV)
- **FR-DEV-01:** Comprehensive Firestore Schema Explorer and Data Dictionary covering all 14 collections with field types and security rules.
- **FR-DEV-02:** Interactive OpenAPI 3.0 Swagger UI portal with environment selector (Production, Staging, Local) and test console.
- **FR-DEV-03:** System health probes monitoring Firestore, Vercel Blob, Firebase Auth, and WhatsApp worker status.
- **FR-DEV-04:** Database backup snapshots creation and pre-migration checkpoint management.

