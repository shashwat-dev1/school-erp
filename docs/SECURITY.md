# HanuJai High School ERP — Security Architecture & Rules Specification

## 1. Threat Model & Institutional Security Principles

School Enterprise Resource Planning systems handle sensitive pupil records, disciplinary histories, teacher evaluations, and official board examination scores. HanuJai ERP applies a strict **Zero-Trust, Deny-by-Default** security posture.

### Core Security Mandates
1. **Never Expose Privileged Credentials**: Zero Firebase Admin SDK private keys, service-account JSON files, or database root credentials exist in client-side bundles.
2. **Server-Enforced Authorization**: UI hiding or disabling buttons is treated merely as visual ergonomics; the true authorization boundary is enforced at the Cloud Firestore Security Rules layer.
3. **Data Minimization**: Staff members can only query the exact subset of records required for their active instructional or administrative duty.
4. **Immutable Audit Trail**: Every sensitive mutation (marks modification, late attendance correction, profile update) creates an append-only audit event recording the actor, timestamp, client IP, old values, and new values.

---

## 2. Authentication & Role Claims Model

The system uses Firebase Authentication for identity verification combined with Firestore custom user documents (`staff/{uid}`) to resolve active roles:

### The 4 Staff Roles & Permissions
```
+--------------------+----------------------------------------------------------------------------+
| Staff Role         | Server-Enforced Capabilities                                               |
+--------------------+----------------------------------------------------------------------------+
| principal          | Full read/write access across all collections; dual-custody approval.      |
| office_admin       | Read/write access to students, staff directory, and basic session data.    |
| class_teacher      | Read/write attendance ONLY for assigned class; read section mark sheets.  |
| subject_teacher    | Read/write marks ONLY for assigned subject + class tuple; no attendance.   |
+--------------------+----------------------------------------------------------------------------+
```

---

## 3. Cloud Firestore Security Rules Baseline (`firestore.rules`)

The system deploys a comprehensive deny-by-default ruleset:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/staff/$(request.auth.uid)).data;
    }

    function hasRole(role) {
      return isAuthenticated() && getUserData().role == role;
    }

    function isPrincipal() {
      return hasRole('principal') || hasRole('admin');
    }

    function isOfficeStaff() {
      return hasRole('office_staff') || hasRole('office_admin') || hasRole('admin');
    }

    function isAssignedClassTeacher(classId) {
      return isAuthenticated() && (
        getUserData().role == 'class_teacher' && 
        getUserData().assignedClassId == classId
      );
    }

    function isAssignedSubjectTeacher(classId, subjectId) {
      return isAuthenticated() && (
        getUserData().role == 'subject_teacher' &&
        subjectId in getUserData().assignedSubjects &&
        classId in getUserData().assignedClasses
      );
    }

    // Default: Deny all reads and writes
    match /{document=**} {
      allow read, write: if false;
    }

    // School Settings & Academic Years: Read by all staff, written only by Principal
    match /schoolSettings/{settingId} {
      allow read: if isAuthenticated();
      allow write: if isPrincipal();
    }

    match /academicYears/{yearId} {
      allow read: if isAuthenticated();
      allow write: if isPrincipal() || isOfficeStaff();
    }

    // Classes & Sections: Read by all staff, written by Admin
    match /classes/{classId} {
      allow read: if isAuthenticated();
      allow write: if isPrincipal() || isOfficeStaff();
    }

    // Staff Accounts: Read by all authenticated staff, written only by Principal
    match /staff/{staffId} {
      allow read: if isAuthenticated();
      allow write: if isPrincipal();
    }

    // Student Master Records:
    // - Read: Principal, Office, or assigned Section/Subject Teachers
    // - Write / Enroll: Office Staff or Principal
    match /students/{studentId} {
      allow read: if isAuthenticated() && (
        isPrincipal() ||
        isOfficeStaff() ||
        isAssignedClassTeacher(resource.data.classId) ||
        (getUserData().role == 'subject_teacher' && resource.data.classId in getUserData().assignedClasses)
      );
      allow create, update: if isPrincipal() || isOfficeStaff();
      allow delete: if false; // Soft-deletes only (status = 'archived')
    }

    // Attendance Sessions & Daily Registers:
    // - Read: Principal, Office Staff, or assigned Class Teacher
    // - Create: Assigned Class Teacher or Principal
    match /attendanceSessions/{sessionId} {
      allow read: if isAuthenticated() && (
        isPrincipal() || 
        isOfficeStaff() || 
        isAssignedClassTeacher(resource.data.classId)
      );
      
      allow create: if isAuthenticated() && (
        isPrincipal() || 
        isAssignedClassTeacher(request.resource.data.classId)
      );

      // In-place updates after submission are locked; corrections require approval
      allow update: if isPrincipal();
    }

    // Attendance Correction Requests (SEC-201 Dual Custody):
    match /attendanceCorrections/{correctionId} {
      allow read: if isAuthenticated() && (
        isPrincipal() || 
        isOfficeStaff() ||
        resource.data.requestedByStaffId == request.auth.uid ||
        isAssignedClassTeacher(resource.data.classId)
      );
      
      // Class teacher or Principal can request a correction
      allow create: if isAuthenticated() && (
        isPrincipal() || 
        isAssignedClassTeacher(request.resource.data.classId)
      ) && request.resource.data.requestedByStaffId == request.auth.uid;

      // SEC-201: Principal can approve/reject, but CANNOT approve their own request (separation of duties)
      allow update: if isAuthenticated() && isPrincipal() && (
        resource.data.requestedByStaffId != request.auth.uid
      );

      allow delete: if false;
    }

    // Assessment Definitions:
    match /assessments/{assessmentId} {
      allow read: if isAuthenticated();
      allow write: if isPrincipal() || isOfficeStaff();
    }

    // Marks Registers:
    // - Read: Principal or assigned Class Teacher for that class
    // - Write: Assigned Subject Teacher for that specific subject and class, or Principal
    match /marksRegisters/{registerId} {
      allow read: if isAuthenticated() && (
        isPrincipal() || 
        isAssignedClassTeacher(resource.data.classId) ||
        isAssignedSubjectTeacher(resource.data.classId, resource.data.subjectId)
      );

      // Subject teachers can create and save drafts; cannot modify finalized records or un-finalize
      allow create, update: if isAuthenticated() && (
        isPrincipal() || (
          isAssignedSubjectTeacher(request.resource.data.classId, request.resource.data.subjectId) &&
          (resource == null || resource.data.status != 'finalized') &&
          request.resource.data.status != 'finalized'
        )
      );

      allow delete: if false;
    }

    // Behaviour & Disciplinary Incidents:
    match /incidents/{incidentId} {
      allow read: if isAuthenticated() && (
        isPrincipal() || 
        isAssignedClassTeacher(resource.data.classId)
      );
      allow create: if isAuthenticated() && (
        isPrincipal() ||
        isAssignedClassTeacher(request.resource.data.classId) ||
        (getUserData().role == 'subject_teacher' && request.resource.data.classId in getUserData().assignedClasses)
      );
      allow update, delete: if isPrincipal();
    }

    // System Audit Log: Append-only, prevents forgery of actor identity
    match /auditEvents/{eventId} {
      allow read: if isPrincipal();
      allow create: if isAuthenticated() && request.resource.data.actorId == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```

---

## 4. Firebase Storage Security Rules (`storage.rules`)

Storage is restricted exclusively to authorized administrative staff and homeroom tutors:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Default deny all
    match /{allPaths=**} {
      allow read, write: if false;
    }

    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserData() {
      return firestore.get(/databases/(default)/documents/staff/$(request.auth.uid)).data;
    }

    function isStaffAuthorized() {
      return isAuthenticated() && (
        getUserData().role == 'principal' ||
        getUserData().role == 'admin' ||
        getUserData().role == 'office_admin' ||
        getUserData().role == 'office_staff' ||
        getUserData().role == 'class_teacher'
      );
    }

    // Student identity scans and medical records (Max 5MB, PDF/JPEG/PNG only)
    // Restricted to administrative staff and homeroom tutors only
    match /students/{studentId}/{documentName} {
      allow read: if isStaffAuthorized();
      allow write: if isStaffAuthorized() && (
        request.resource.size < 5 * 1024 * 1024 &&
        request.resource.contentType.matches('image/(jpeg|png)|application/pdf')
      );
    }
  }
}
```

---

## 5. Demo Mode vs. Firebase Mode Security Boundary

To eliminate any ambiguity between presentation states and live infrastructure:

| Attribute | Demo Mode (`VITE_DATA_MODE=demo`) | Firebase Mode (`VITE_DATA_MODE=firebase`) |
| :--- | :--- | :--- |
| **Credentials Required** | Zero | Valid Firebase Web API keys |
| **Data Storage Location** | Browser `localStorage` (Isolated) | Google Cloud Firestore |
| **Network Requests** | Local in-memory / zero outbound | HTTPS to `googleapis.com` |
| **UI Visual Indicator** | Persistent Amber Banner & Pill: "Demo Mode — Sample Data" | Clean Institutional Status: "Campus Connected" |
| **Data Reset Action** | Available (1-click wipe to seed baseline) | Disabled (Requires DB migration script) |
| **Silent Fallback** | Not Applicable | **Strictly Prohibited**: If Firestore fails, show error; never silently fallback to demo data |

---

## 6. Staff Account Provisioning Procedure

When moving from prototype to live campus evaluation:

1. **Step 1: Administrator Provisioning**
   - The Principal's Google account is provisioned via Firebase Authentication Console (`principal@hanujai.edu.in`).
   - A document is created in `staff/{uid}` with `role: "principal"`.
2. **Step 2: Faculty Onboarding**
   - The Principal or Office Admin uses the ERP interface (`/staff/new`) to create staff profiles.
   - Staff members are assigned explicit role tags (`office_admin`, `class_teacher`, `subject_teacher`).
   - Class Teachers are linked to their specific section (`assignedClassId: "class-10-a"`).
   - Subject Teachers are linked to an array of authorized subjects and classes.
3. **Step 3: First Login & Temporary Credential Rollover**
   - Faculty members receive an institutional email link to configure their private password.
