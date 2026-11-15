# HanuJai High School ERP — Comprehensive API Documentation & Specification

**Document Reference:** `HHS-API-2026-V1`  
**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Scope:** Phase 1 RESTful APIs, OpenAPI 3.0.3, Vercel Serverless Functions  
**Classification:** Institutional Engineering Standard  
**Last Updated:** November 16, 2026  

---

## 1. Overview & Base Environments

HanuJai High School ERP provides secure RESTful APIs designed for institutional operations and seamless integration with parent portals and notification workers.

### 1.1 Base URLs
- **Production:** `https://hanujai-erp.vercel.app`
- **Staging:** `https://hanujai-staging.vercel.app`
- **Local Development:** `http://localhost:5173`

### 1.2 Authentication Schemes
1. **`StaffBearerAuth`:** Bearer token (Firebase Authentication ID token) passed in the `Authorization: Bearer <token>` header. Enforces staff identity and role validation.
2. **`ParentTokenAuth`:** 256-bit cryptographically random token passed in the `x-parent-token: <hex-token>` header for initial verification.
3. **`ParentSessionAuth`:** Short-lived HMAC-SHA256 session token passed in the `x-parent-session-token: <hmac-token>` header for authorized parent document uploads.

---

## 2. Serverless Document Storage & Parent Endpoints

### 2.1 Staff Document Upload
- **Endpoint:** `POST /api/documents/upload`
- **Authentication:** `StaffBearerAuth` (Admin Office, Developer)
- **Content-Type:** `multipart/form-data`
- **Query Parameters:**
  - `studentId` (string, required): Student identifier (e.g., `stu-10a-01`).
  - `type` (string, required): Document slot (one of the 9 required categories).
- **Body:** `file` (binary, max 5MB, PDF/JPG/PNG).
- **Response:**
  - `200 OK`: Upload completed successfully; metadata stored.
  - `400 Bad Request`: File size exceeds 5MB or invalid MIME type.
  - `401 Unauthorized`: Missing or invalid staff bearer token.
  - `403 Forbidden`: Insufficient role authority (Principal has read-only access).

### 2.2 Get Signed Document Download URL
- **Endpoint:** `GET /api/documents/file`
- **Authentication:** `StaffBearerAuth` (All staff roles)
- **Query Parameters:**
  - `studentId` (string, required): Student ID.
  - `type` (string, required): Document category slot.
- **Response (200 OK):**
  ```json
  {
    "downloadUrl": "https://blob.vercel-storage.com/...",
    "expiresAt": "2026-11-16T08:35:00.000Z"
  }
  ```
  *Note: Download URLs automatically expire after 300 seconds (5 minutes).*

### 2.3 Staff Document Deletion
- **Endpoint:** `DELETE /api/documents/delete`
- **Authentication:** `StaffBearerAuth` (Admin Office, Developer)
- **Query Parameters:**
  - `studentId` (string, required)
  - `type` (string, required)
- **Response:**
  - `200 OK`: Document soft/hard deleted and audit trail appended.
  - `403 Forbidden`: Principal cannot delete student documents.

### 2.4 Parent Invitation Token Verification
- **Endpoint:** `GET /api/documents/parent-verify`
- **Authentication:** `ParentTokenAuth` (`x-parent-token` header)
- **Description:** Validates 256-bit invitation token. Computes SHA-256 hash, queries `parentDocumentInvitations`, checks expiration (72h) and revocation status. Issues a short-lived HMAC upload session token.
- **Response (200 OK):**
  ```json
  {
    "valid": true,
    "invitationId": "inv-a9f8b1c2",
    "studentId": "stu-10a-01",
    "studentName": "Aarav Sharma",
    "admissionNumber": "HHS-2024-001",
    "className": "Class 10-A",
    "requestedSlots": ["aadhaar_card", "birth_certificate"],
    "uploadSessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2026-11-16T09:00:00.000Z"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Missing or malformed `x-parent-token` header.
  - `403 Forbidden`: Invitation has expired, been revoked, or already completed.

### 2.5 Parent Document Upload
- **Endpoint:** `POST /api/documents/parent-upload`
- **Authentication:** `ParentSessionAuth` (`x-parent-session-token` header)
- **Query Parameters:**
  - `slot` (string, required): Document slot being uploaded (must match `requestedSlots`).
- **Content-Type:** `multipart/form-data`
- **Body:** `file` (binary, max 5MB).
- **Description:** Validates HMAC session token, ensures target slot is authorized, verifies live invitation status in Firestore, writes file to Private Vercel Blob store, and writes metadata via Google OAuth 2.0 service account credentials.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Document uploaded successfully.",
    "documentType": "aadhaar_card",
    "status": "pending_verification"
  }
  ```

---

## 3. Core Administrative Endpoints (Data Layer)

### 3.1 Student Management
- `GET /api/students`: List paginated students with class, search, and attendance compliance filtering.
- `GET /api/students/{id}`: Detailed student profile with enrollment, family contacts, and document checklist.
- `POST /api/students`: Enroll a new student (Admin Office & Developer).
- `POST /api/students/import`: Bulk 7-column Excel ingestion with preview validation.

### 3.2 Daily Attendance
- `GET /api/attendance/sessions`: Query attendance sessions by date and class ID.
- `POST /api/attendance/sessions`: Submit daily class register; automatically locks register and queues WhatsApp notifications.

### 3.3 Attendance Corrections
- `GET /api/attendance/corrections`: List correction requests filtered by state (`pending`, `approved`, `rejected`).
- `POST /api/attendance/corrections`: Submit an audited correction request with mandatory justification.
- `PUT /api/attendance/corrections/{id}/approve`: Principal approves correction and updates register ledger.
- `PUT /api/attendance/corrections/{id}/reject`: Principal rejects correction with review remarks.

### 3.4 Developer Operations
- `GET /api/developer/health`: Deep health probes on Firestore, Vercel Blob, Firebase Auth, and WhatsApp worker.
- `GET /api/developer/snapshots`: List available database backup checkpoints.
- `POST /api/developer/snapshots`: Create full system state snapshot.

