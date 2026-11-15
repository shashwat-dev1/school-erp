# HanuJai High School ERP — System Architecture & Design Specification

**Document Reference:** `HHS-ARC-2026-V1`  
**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Scope:** Phase 1 Multi-Tier Cloud Architecture  
**Classification:** Institutional Architecture Specification  
**Last Updated:** November 16, 2026  

---

## 1. High-Level Architecture Overview

HanuJai High School ERP is architected as a modern, decoupled, multi-tier institutional cloud platform. The architecture emphasizes high security, auditability, operational fault-tolerance, and seamless parent communication.

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                        |
|                                                                                       |
|   +---------------------------+  +--------------------------+  +------------------+   |
|   |   Staff Web Application   |  |   Parent Upload Portal   |  |  Expo Mobile App |   |
|   |  (React 18 / TypeScript)  |  |  (Zero-OTP Crypto Link)  |  |  (React Native)  |   |
|   +---------------------------+  +--------------------------+  +------------------+   |
+-------------------------------------------|-------------------------------------------+
                                            | HTTPS / TLS 1.3
+-------------------------------------------v-------------------------------------------+
|                              EDGE & SERVERLESS BACKEND                                |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   |                        Vercel Edge Network & Routing                          |   |
|   +-------------------------------------------------------------------------------+   |
|   |  Serverless Functions (/api):                                                 |   |
|   |  - /api/documents/upload          (Staff direct upload to Blob)              |   |
|   |  - /api/documents/file            (Private presigned download URLs)          |   |
|   |  - /api/documents/delete          (Staff document removal with audit)        |   |
|   |  - /api/documents/parent-verify   (256-bit token verify & HMAC session mint)  |   |
|   |  - /api/documents/parent-upload   (Parent upload to authorized slot)         |   |
|   +-------------------------------------------------------------------------------+   |
+-------------------------------------------|-------------------------------------------+
                     |                      |                      |
                     v                      v                      v
+-----------------------------+ +---------------------+ +-------------------------------+
|     DATA & AUTH TIER        | |    STORAGE TIER     | |      INTEGRATION TIER         |
|                             | |                     | |                               |
|   +---------------------+   | |   +---------------+ | |   +-----------------------+   |
|   |  Firebase Auth      |   | |   | Vercel Blob   | | |   | WhatsApp Worker Host  |   |
|   |  (Staff Identity)   |   | |   | (Private)     | | |   | (Node.js / Baileys)   |   |
|   +---------------------+   | |   | Encrypted     | | |   +-----------------------+   |
|   |  Cloud Firestore    |   | |   | 9 Slot Types  | | |   | Rajasthan Gateway     |   |
|   |  (asia-south1)      |   | |   +---------------+ | |   | (+91 Parent Messaging)|   |
|   |  14 Collections     |   | +---------------------+ |   +-----------------------+   |
|   +---------------------+   |                         +-------------------------------+
+-----------------------------+
```

---

## 2. Component Design & Responsibility Matrix

### 2.1 Staff Web Application
- **Stack:** React 18.3, TypeScript 5.6, Vite 5.4, React Router 6.28, Lucide React, Recharts.
- **Responsibilities:**
  - Dynamic route protection based on staff role (`developer`, `admin`, `principal`).
  - Student directory management with instant client-side filtering of up to 1,000 records.
  - Daily morning attendance marking with single-click Present/Absent toggles and submit locking.
  - Principal-exclusive attendance correction approval queue.
  - Student document management with upload, preview, and signed URL retrieval.
  - Developer Workstation with interactive OpenAPI 3.0 Swagger UI and Firestore Schema Data Dictionary.
  - 7-column bulk Excel student data ingestion.

### 2.2 Parent Document Collection Gateway
- **Stack:** Dedicated serverless endpoint and lightweight client view.
- **Security Paradigm:** Zero-OTP, zero-password cryptographic verification.
  - Parents receive unique invitation links over WhatsApp: `https://hanujai-erp.vercel.app/parent/upload#t=<256-bit-token>`.
  - Token is hashed client-side or sent over HTTPS headers to `/api/documents/parent-verify`.
  - Only SHA-256 token hashes are stored in Firestore collection `parentDocumentInvitations`.
  - Server verifies expiration (72h default), revocation, and active status.
  - Server issues a short-lived HMAC-SHA256 session token (max 60m TTL) strictly bound to student ID and permitted slots.
  - Browser immediately scrubs the `#t=...` hash from address bar using `history.replaceState`.
  - Uploads via `/api/documents/parent-upload` enforce slot permissions and record metadata via authenticated Google service account.

### 2.3 Storage Architecture (Private Vercel Blob)
- **Store Configuration:** Client-owned dedicated Vercel Blob store (`access: "private"`).
- **Blob Object Naming Convention:**
  `students/{studentId}/documents/{documentType}/{timestamp}_{filename}`
- **Presigned Download Flow:**
  - Staff requests document view via `/api/documents/file?studentId=...&type=...`.
  - Serverless function verifies staff identity and authorization.
  - Calls `@vercel/blob` `getDownloadUrl()` with 300-second (5-minute) expiration.
  - Returns ephemeral signed URL and logs view event in `auditEvents`.

### 2.4 Standalone WhatsApp Background Worker
- **Stack:** Node.js, `@whiskeysockets/baileys`, Pino logging.
- **Process Model:** Dedicated standalone long-running daemon decoupled from web serverless infrastructure.
- **Queue Mechanism:** Polling Firestore collection `attendanceNotifications` where `status == 'pending'`.
- **Throttling & Anti-Ban:**
  - Jittered dispatch delay: 1,500ms to 3,000ms between messages.
  - Max batch burst: 50 messages per window before cool-down.
  - Automatic retry with exponential backoff on transient network disconnects.

---

## 3. Data Flow Diagrams

### 3.1 Daily Attendance Register & WhatsApp Notification Flow

```
+--------------+               +---------------+               +-----------------+               +-----------------+
| Admin Office |               |   App Shell   |               | Cloud Firestore |               | WhatsApp Worker |
+--------------+               +---------------+               +-----------------+               +-----------------+
       |                               |                                |                                 |
       | 1. Select Class & Date        |                                |                                 |
       |------------------------------>|                                |                                 |
       | 2. Mark Present / Absent      |                                |                                 |
       |------------------------------>|                                |                                 |
       | 3. Click Submit Register      |                                |                                 |
       |------------------------------>|                                |                                 |
       |                               | 4. Create attendanceSession    |                                 |
       |                               |    (status: 'locked')          |                                 |
       |                               |------------------------------->|                                 |
       |                               | 5. Enqueue Notification Jobs   |                                 |
       |                               |    in attendanceNotifications  |                                 |
       |                               |------------------------------->|                                 |
       |                               | 6. Append auditEvent           |                                 |
       |                               |------------------------------->|                                 |
       |                               |                                | 7. Poll pending jobs            |
       |                               |                                |<--------------------------------|
       |                               |                                | 8. Update status: 'processing'  |
       |                               |                                |<--------------------------------|
       |                               |                                | 9. Dispatch WhatsApp message    |
       |                               |                                |    to parent phone numbers      |
       |                               |                                | 10. Update status: 'sent'       |
       |                               |                                |<--------------------------------|
```

### 3.2 Parent Document Upload Cryptographic Verification Flow

```
+--------+             +---------------+             +-----------------------+             +-----------------+
| Parent |             | Browser / URL |             | Vercel Serverless API |             | Cloud Firestore |
+--------+             +---------------+             +-----------------------+             +-----------------+
    |                          |                                 |                                  |
    | 1. Tap WhatsApp Link     |                                 |                                  |
    |    (contains #t=token)   |                                 |                                  |
    |------------------------->|                                 |                                  |
    |                          | 2. Extract token & scrub hash   |                                  |
    |                          |    history.replaceState()       |                                  |
    |                          | 3. GET /api/parent-verify       |                                  |
    |                          |    (Header: x-parent-token)     |                                  |
    |                          |-------------------------------->|                                  |
    |                          |                                 | 4. Compute SHA-256(token)        |
    |                          |                                 | 5. Lookup tokenHash in           |
    |                          |                                 |    parentDocumentInvitations     |
    |                          |                                 |--------------------------------->|
    |                          |                                 | 6. Check expiry, status active   |
    |                          |                                 |<---------------------------------|
    |                          |                                 | 7. Mint HMAC uploadSessionToken  |
    |                          | 8. Return student info, slots,  |    (bind studentId & slots)      |
    |                          |    and uploadSessionToken       |                                  |
    |                          |<--------------------------------|                                  |
    | 9. Select Document (PDF) |                                 |                                  |
    |------------------------->|                                 |                                  |
    | 10. Click Upload         | 11. POST /api/parent-upload     |                                  |
    |                          |     (slot=aadhaar_card, file)   |                                  |
    |                          |-------------------------------->|                                  |
    |                          |                                 | 12. Validate HMAC session token  |
    |                          |                                 | 13. Verify slot in allowedSlots  |
    |                          |                                 | 14. Upload to Private Blob Store |
    |                          |                                 | 15. Write metadata to Firestore  |
    |                          |                                 |     via Service Account OAuth 2.0|
    |                          |                                 |--------------------------------->|
    |                          | 16. Return 200 OK (Uploaded)    |                                  |
    |                          |<--------------------------------|                                  |
    | 17. Success Feedback     |                                 |                                  |
    |<-------------------------|                                 |                                  |
```

---

## 4. Disaster Recovery & Snapshot Architecture

- **Pre-Migration Snapshots:** Before any large-scale student Excel ingestion or batch operation, the Developer can trigger a database snapshot from the Developer Console.
- **Snapshot Contents:** Complete serialization of `students`, `classes`, `staff`, `schoolSettings`, and `academicYears`.
- **Restoration Safety:** Rollback executes within an atomic Firestore batch or controlled transaction to prevent partial state corruption.
- **Audit Traceability:** Every snapshot creation and restoration event is permanently logged in `auditEvents`.

