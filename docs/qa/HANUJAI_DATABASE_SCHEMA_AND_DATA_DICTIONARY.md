# HanuJai High School ERP — Cloud Firestore Database Schema & Data Dictionary

**Document Reference:** `HHS-DBD-2026-V1`  
**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Scope:** Phase 1 Complete 14 Cloud Firestore Collections & Subcollections  
**Classification:** Institutional Database Architecture Specification  
**Last Updated:** November 16, 2026  

---

## 1. Cloud Firestore Architecture Principles

HanuJai High School ERP utilizes Google Cloud Firestore in Datastore Native mode (`asia-south1` Mumbai). The database is structured to balance low-latency reads for daily school administration with strict data isolation, append-only auditability, and role-based security enforcement.

### Key Architectural Guidelines
1. **Document Size Constraint:** All documents strictly maintained under 100 KB (well within Firestore 1MB limit). Large files stored exclusively in Private Vercel Blob store.
2. **Denormalization for Fast Queries:** Frequently accessed aggregates (e.g. cumulative attendance percentage on student documents) are denormalized and maintained via atomic transactions.
3. **Immutable Audit Trail:** `auditEvents` collection is strictly append-only; update and delete permissions are blocked at the database engine level via `firestore.rules`.
4. **Token Security:** Raw parent invitation tokens are never persisted in the database; only their 64-character SHA-256 hexadecimal digests are stored in `parentDocumentInvitations`.

---

## 2. Complete Collections Summary (14 Collections)

| Collection ID | Purpose | Document ID Format | Security Read | Security Write |
| :--- | :--- | :--- | :--- | :--- |
| **`schoolSettings`** | Global campus metadata, affiliation numbers | Singleton `config` | Staff (Dev/Admin/Prin) | Developer only |
| **`systemSettings`** | System feature flags, rate limits, storage policies | Singleton `system_config` | Staff (Dev/Admin/Prin) | Developer only |
| **`academicYears`** | Academic calendar sessions & active year pointer | Canonical slug `ay-YYYY-YY` | Staff (Dev/Admin/Prin) | Developer only |
| **`classes`** | Class and section definitions (Nursery - 10th) | Canonical slug `class-10-a` | Staff (Dev/Admin/Prin) | Developer only |
| **`staff`** | Staff identity, roles, and Firebase Auth bindings | Auth UID or canonical slug | Staff (Dev/Admin/Prin) | Developer or Self UID |
| **`students`** | Enrolled student master directory | Composite `stu-10a-01` | Staff (Dev/Admin/Prin) | Admin & Developer |
| **`students/{id}/documents`** | 9 mandatory student document slots metadata | Slot type (e.g. `aadhaar_card`) | Staff (Dev/Admin/Prin) | Admin & Developer |
| **`attendanceSessions`** | Daily class attendance registers (locked upon submit) | Composite `att-{class}-{date}` | Staff (Dev/Admin/Prin) | Admin & Developer |
| **`attendanceCorrections`**| Audited correction requests & Principal review | Unique slug `corr-{ts}-{rand}` | Staff (Dev/Admin/Prin) | Admin (create), Prin (review) |
| **`attendanceNotifications`**| Parent WhatsApp dispatch job queue | Unique job ID `notif-{id}` | Staff (Dev/Admin/Prin) | Admin & Developer |
| **`attendanceAggregates`** | Monthly and cumulative attendance metrics | Composite `agg-{stu}-{month}` | Staff (Dev/Admin/Prin) | Admin & Developer |
| **`parentDocumentInvitations`**| 256-bit parent token SHA-256 hashes & status | Unique slug `inv-{hashPrefix}`| Staff (Dev/Admin/Prin) | Admin & Developer |
| **`parentUploadSessions`** | Scoped HMAC parent upload session capabilities | Unique slug `sess-{hashPrefix}`| Staff (Admin/Dev) | Server Processes |
| **`auditEvents`** | Append-only institutional audit trail | Unique ID `evt-{ts}-{rand}` | Staff (Dev/Admin/Prin) | Authenticated Actor Match |
| **`developerSnapshots`** | Full database backup checkpoints & rollback state | Unique slug `snap-{ts}-{label}`| Developer only | Developer only |

---

## 3. Detailed Data Dictionary by Collection

### 3.1 `schoolSettings`
- **Purpose:** Campus identity, CBSE affiliation, address, primary institutional contacts.
- **Rules:** Read by authenticated staff; create/update restricted to Developer; delete denied.
- **Fields:**
  - `name` (`string`, Required): Full legal name of institution ("HanuJai High School").
  - `code` (`string`, Required): State/board registration code ("HHS-JPR-01").
  - `affiliationNumber` (`string`, Required): Affiliation number ("RAJ-SEC-89211").
  - `city` (`string`, Required): Campus city ("Jaipur").
  - `state` (`string`, Required): State ("Rajasthan").
  - `primaryPhone` (`string`, Required): Main campus phone number ("+91 141 2780000").
  - `currentAcademicYearId` (`string`, Required): Active academic year reference ("ay-2024-25").

### 3.2 `systemSettings`
- **Purpose:** Application-wide runtime flags, storage quotas, and security configuration.
- **Fields:**
  - `maintenanceMode` (`boolean`, Required): Whether application is undergoing maintenance.
  - `allowParentUploads` (`boolean`, Required): Master switch for parent document upload gateway.
  - `maxDocumentSizeBytes` (`number`, Required): Maximum permitted document upload size (5242880 bytes / 5MB).
  - `invitationTokenTtlHours` (`number`, Required): Parent link validity period (72 hours).
  - `uploadSessionTtlMinutes` (`number`, Required): Scoped HMAC upload session duration (60 minutes).

### 3.3 `academicYears`
- **Purpose:** Annual academic cycles and active session tracking.
- **Indexes:** `isCurrent ASC`.
- **Fields:**
  - `id` (`string`, Required): Session identifier (e.g., "ay-2024-25").
  - `label` (`string`, Required): Display title ("Academic Year 2024-2025").
  - `startDate` (`string`, Required): ISO date ("2024-04-01").
  - `endDate` (`string`, Required): ISO date ("2025-03-31").
  - `isCurrent` (`boolean`, Required): True for active session.

### 3.4 `classes`
- **Purpose:** School class sections from Nursery through Class 10 with section identifiers.
- **Indexes:** `grade ASC, section ASC`.
- **Fields:**
  - `id` (`string`, Required): Class slug ("class-10-a").
  - `label` (`string`, Required): Display name ("Class 10-A").
  - `grade` (`number | string`, Required): Grade level (Nursery, LKG, UKG, 1-10).
  - `section` (`string`, Required): Section letter ("A" or "B").
  - `capacity` (`number`, Required): Maximum student seating (e.g., 40).

### 3.5 `staff`
- **Purpose:** Staff identity, role definitions, and Firebase Authentication UID mapping.
- **Indexes:** `email ASC`, `role ASC, status ASC`.
- **Fields:**
  - `id` (`string`, Required): Firebase Auth UID or system slug.
  - `authUid` (`string`, Optional): Linked Firebase Auth UID.
  - `email` (`string`, Required): Institutional staff email ("developer@hanujai.edu.in").
  - `name` (`string`, Required): Full legal staff name.
  - `displayName` (`string`, Optional): User-friendly display name.
  - `role` (`string`, Required): One of `developer`, `admin`, `principal`, `class_teacher`, `subject_teacher`.
  - `employeeCode` (`string`, Required): Institutional staff code ("DEV-ROOT-01").
  - `designation` (`string`, Required): Official job title.
  - `department` (`string`, Required): Functional department.
  - `phone` (`string`, Required): Contact mobile number.
  - `status` (`string`, Required): Lifecycle state (`active`, `on_leave`, `suspended`, `deactivated`).
  - `createdAt` (`string`, Required): ISO timestamp.

### 3.6 `students`
- **Purpose:** Central student enrollment records and guardian contacts.
- **Indexes:** `classId ASC, rollNumber ASC`, `fullName ASC`, `admissionNumber ASC`.
- **Fields:**
  - `id` (`string`, Required): Student slug ("stu-10a-01").
  - `admissionNumber` (`string`, Required): Unique admission number ("HHS-2024-001").
  - `rollNumber` (`number`, Required): Roll number in section (1).
  - `fullName` (`string`, Required): Student legal full name ("Aarav Sharma").
  - `gender` (`string`, Required): Gender ("M", "F", "O").
  - `classId` (`string`, Required): Enrolled class ID ("class-10-a").
  - `guardianName` (`string`, Required): Primary guardian name ("Rajesh Sharma").
  - `guardianRelation` (`string`, Required): Relationship ("Father", "Mother", "Guardian").
  - `primaryPhone` (`string`, Required): Parent WhatsApp contact number ("+91 98290 12345").
  - `residentialAddress` (`string`, Optional): Residential address.
  - `status` (`string`, Required): Enrollment state (`active`, `inactive`, `transferred`, `graduated`).
  - `attendancePercentage` (`number`, Optional): Calculated cumulative attendance rate (92.4).

### 3.7 `students/{studentId}/documents` (Subcollection)
- **Purpose:** Metadata and storage pointers for each of the 9 mandatory student document slots.
- **Indexes:** `status ASC`, `uploadedAt DESC`.
- **Fields:**
  - `documentType` (`string`, Required): Slot identifier (e.g. `aadhaar_card`).
  - `status` (`string`, Required): Verification status (`pending`, `verified`, `rejected`, `missing`).
  - `blobUrl` (`string`, Optional): Private Vercel Blob store URL.
  - `fileSize` (`number`, Optional): Document size in bytes.
  - `mimeType` (`string`, Optional): File MIME type (`application/pdf`, `image/jpeg`).
  - `uploadedBy` (`string`, Required): Uploader identity or pseudonymized token ref.
  - `uploadedAt` (`string`, Required): ISO timestamp.

### 3.8 `attendanceSessions`
- **Purpose:** Daily class attendance registers containing student-by-student presence/absence statuses.
- **Indexes:** `date DESC, classId ASC`.
- **Fields:**
  - `id` (`string`, Required): Composite ID ("att-class-10-a-2026-11-16").
  - `date` (`string`, Required): Register date in YYYY-MM-DD format ("2026-11-16").
  - `classId` (`string`, Required): Class section ID ("class-10-a").
  - `status` (`string`, Required): Lifecycle state (`submitted`, `locked`).
  - `submittedBy` (`string`, Required): Staff ID who submitted register ("staff-admin").
  - `submittedAt` (`string`, Required): ISO submission timestamp.
  - `presentCount` (`number`, Required): Total present students (32).
  - `absentCount` (`number`, Required): Total absent students (2).
  - `records` (`array of maps`, Required): Student attendance array:
    - `studentId`: string
    - `status`: "present" | "absent" | "late" | "half_day"
    - `remarks`: string

### 3.9 `attendanceCorrections`
- **Purpose:** Audited attendance correction requests submitted by Admin Office and reviewed by Principal.
- **Indexes:** `status ASC, requestedAt DESC`, `sessionId ASC`.
- **Fields:**
  - `id` (`string`, Required): Correction request ID ("corr-20261116-01").
  - `sessionId` (`string`, Required): Attendance session ID.
  - `studentId` (`string`, Required): Student ID.
  - `classId` (`string`, Required): Class section ID.
  - `date` (`string`, Required): Date of attendance record.
  - `currentStatus` (`string`, Required): Current recorded status ("absent").
  - `proposedStatus` (`string`, Required): Requested corrected status ("present").
  - `reason` (`string`, Required): Mandatory justification (minimum 10 characters).
  - `status` (`string`, Required): Review state (`pending`, `approved`, `rejected`).
  - `requestedBy` (`string`, Required): Staff ID of requester ("staff-admin").
  - `requestedAt` (`string`, Required): ISO timestamp.
  - `reviewedBy` (`string`, Optional): Principal ID who reviewed.
  - `reviewedAt` (`string`, Optional): ISO timestamp.

### 3.10 `attendanceNotifications`
- **Purpose:** Notification queue for daily attendance WhatsApp dispatches.
- **Indexes:** `status ASC, scheduledAt ASC`.
- **Fields:**
  - `id` (`string`, Required): Job ID ("notif-20261116-001").
  - `studentId` (`string`, Required): Student ID.
  - `date` (`string`, Required): Attendance date.
  - `phone` (`string`, Required): Target parent WhatsApp number.
  - `message` (`string`, Required): Bilingual message payload (Hindi & English).
  - `status` (`string`, Required): Job status (`pending`, `processing`, `sent`, `failed`).
  - `sentAt` (`string`, Optional): ISO timestamp.

### 3.11 `parentDocumentInvitations`
- **Purpose:** Cryptographic token hashes and permissions for parent-facing zero-OTP upload links.
- **Indexes:** `tokenHash ASC`, `studentId ASC`, `status ASC`.
- **Fields:**
  - `id` (`string`, Required): Invitation ID ("inv-a9f8b1c2").
  - `studentId` (`string`, Required): Target student ID ("stu-10a-01").
  - `tokenHash` (`string`, Required): 64-char SHA-256 hex digest of random 256-bit token.
  - `requestedSlots` (`array of strings`, Required): Permitted document slots (e.g. `["aadhaar_card"]`).
  - `status` (`string`, Required): State (`active`, `revoked`, `completed`, `expired`).
  - `expiresAt` (`string`, Required): Expiry timestamp (72h default).
  - `createdAt` (`string`, Required): Creation timestamp.
  - `createdBy` (`string`, Required): Staff ID who issued invitation.

### 3.12 `auditEvents`
- **Purpose:** Append-only immutable system audit log capturing all privileged operational events.
- **Indexes:** `timestamp DESC`, `action ASC`, `actorId ASC`.
- **Fields:**
  - `id` (`string`, Required): Event ID ("evt-109283").
  - `action` (`string`, Required): Audit action code ("ATTENDANCE_SUBMIT", "DOCUMENT_UPLOAD").
  - `actorId` (`string`, Required): UID of authenticated user or pseudonymized token ref.
  - `actorRole` (`string`, Required): Role at time of action.
  - `targetType` (`string`, Required): Entity type ("student", "attendance", "document").
  - `targetId` (`string`, Required): Target record ID.
  - `timestamp` (`string`, Required): ISO timestamp.
  - `metadata` (`map`, Optional): Structured context payload.

