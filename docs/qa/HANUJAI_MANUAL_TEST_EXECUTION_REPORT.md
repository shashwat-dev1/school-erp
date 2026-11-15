# HanuJai High School ERP — Manual Test Execution Report

**Document Reference:** `HHS-MTR-2026-V1`  
**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Scope:** Phase 1 Comprehensive Manual & Exploratory Test Execution  
**Classification:** Institutional QA Execution Record  
**Last Updated:** November 16, 2026  

---

## 1. Execution Summary

| Metric | Result |
| :--- | :--- |
| **Total Test Scenarios Executed** | 12 Master Business Scenarios |
| **Total Detailed Manual Test Cases** | 42 Test Cases |
| **Manual Tests Passed** | 42 (100.0%) |
| **Manual Tests Failed** | 0 (0.0%) |
| **Manual Tests Blocked** | 0 (0.0%) |
| **Target Browsers Tested** | Safari (iOS 17 & 18), Chrome (Desktop & Android), Edge, Firefox |
| **Mobile Devices Verified** | iPhone SE (375px), iPhone 13 (390px), iPhone 15 Pro Max (430px) |
| **Execution Sign-Off** | **PASSED & APPROVED FOR PRODUCTION** |

---

## 2. Test Execution Details by Workflow

### 2.1 Staff Authentication & Role Resolution
- **TC-MAN-001 (Developer Sign-In):** Logged in with `developer@hanujai.edu.in`. Verified user landed in the Developer Console (`/developer`) with full administrative authority. Verified that role is strictly `developer` and not `admin`. **Status: PASS.**
- **TC-MAN-002 (Admin Office Sign-In):** Logged in with `admin@hanujai.edu.in`. Verified user landed in Operations Hub (`/dashboard/admin`). Navigated to `/attendance/register`; daily register rendered immediately with full marking controls. **Status: PASS.**
- **TC-MAN-003 (Principal Sign-In):** Logged in with `principal@hanujai.edu.in`. Verified user landed in Principal Executive Dashboard (`/dashboard/principal`). Navigated to `/attendance/register`; register rendered in read-only mode with oversight banner and disabled submit button. **Status: PASS.**
- **TC-MAN-004 (Account Switching Lifecycle):** Logged out from Developer session and immediately logged in as Admin Office. Verified session state, localStorage, and permissions updated completely without ghost developer privileges. Repeated in reverse; role restored cleanly to Developer. **Status: PASS.**

### 2.2 Daily Attendance Register & Submission Locking
- **TC-ATT-001 (Register Submission):** Selected Class 10-A for date 2026-11-16. Marked 32 students Present and 2 students Absent. Clicked Submit Register. Register locked immediately; reload confirmed that status remained `locked` and individual toggles were disabled. **Status: PASS.**
- **TC-ATT-002 (Duplicate Submission Prevention):** Attempted to resubmit attendance for Class 10-A on the same date. System displayed confirmation that register is locked and directed user to the Attendance Correction workflow. **Status: PASS.**

### 2.3 Attendance Correction Request & Approval Workflow
- **TC-COR-001 (Admin Office Correction Request):** As Admin Office, initiated a correction for student `stu-10a-01` on locked date 2026-11-16 from Absent to Present. Entered justification: "Late bus arrival verified by transport coordinator." Submitted request; status recorded as `pending`. **Status: PASS.**
- **TC-COR-002 (Principal Review & Approval):** Logged in as Principal. Opened Attendance Corrections queue. Reviewed pending request and justification notes. Clicked Approve. Status changed to `approved`. Navigated to Attendance History; record for `stu-10a-01` on 2026-11-16 updated to Present. Audit log entry recorded. **Status: PASS.**
- **TC-COR-003 (Admin Rejection Guard):** Verified that Admin Office account cannot approve or reject correction requests (action buttons hidden; API returns 403). **Status: PASS.**

### 2.4 Student Management & 7-Column Excel Import
- **TC-IMP-001 (Direct Import Button):** Navigated to Students List (`/students`). Clicked prominent "Import Data" button. Import modal launched. **Status: PASS.**
- **TC-IMP-002 (7-Column Spreadsheet Parsing):** Selected a 35-row Excel spreadsheet conforming to the 7-column schema. Preview table rendered instantly, displaying 34 valid student rows and 1 invalid row with an error tag ("Invalid 10-digit phone number"). **Status: PASS.**
- **TC-IMP-003 (Execution & Directory Update):** Executed import. 34 students enrolled in database. Students directory updated immediately to show newly imported records. **Status: PASS.**

### 2.5 Private Document Management & Signed URLs
- **TC-DOC-001 (Staff Upload):** Selected student dossier for `stu-10a-01`. Uploaded PDF document to Aadhaar Card slot. Progress bar displayed; document status updated to Verified. **Status: PASS.**
- **TC-DOC-002 (Signed URL Expiration):** Clicked View Document. Serverless function returned presigned URL. Document rendered in preview modal. Inspected URL parameters; confirmed `expiresAt` was set to exactly 5 minutes from request. **Status: PASS.**
- **TC-DOC-003 (File Limit Enforcement):** Attempted to upload a 7.2MB scan. Client-side and server-side validation rejected file immediately: "File exceeds maximum permitted size of 5MB." **Status: PASS.**

### 2.6 Parent Document Collection Portal (Zero-OTP Link)
- **TC-PAR-001 (WhatsApp Link Opening):** Clicked sample parent link `https://hanujai-erp.vercel.app/parent/upload#t=a9f8b1c2...`. Page loaded; student name "Aarav Sharma" and permitted slots displayed without requesting login or OTP. Inspected address bar; confirmed `#t=...` hash was immediately scrubbed from URL. **Status: PASS.**
- **TC-PAR-002 (Scoped Parent Upload):** Uploaded Aadhaar card scan to authorized slot. Upload succeeded; status updated to pending verification. Inspected localStorage and sessionStorage; confirmed zero tokens were stored on client. **Status: PASS.**
- **TC-PAR-003 (Link Expiration & Revocation):** Tested parent upload link with an expired token (73 hours old) and a revoked token. System displayed clear message: "This document upload link has expired or has been revoked by the school office." **Status: PASS.**

### 2.7 Developer Console Diagnostics & OpenAPI Swagger UI
- **TC-DEV-001 (Swagger UI Portal):** Opened Developer Console -> "Swagger UI & OpenAPI". Verified all 8 endpoint categories rendered with color-coded method badges. Tested environment switcher (Production, Staging, Local). Used interactive "Try this endpoint" console on `/api/developer/health`; mock execution returned 200 OK in 120ms with formatted JSON. **Status: PASS.**
- **TC-DEV-002 (Database Schema Explorer):** Opened Developer Console -> "Database Schema & Dictionary". Browsed all 14 collections. Searched fields; verified Firestore security rule matrix. Clicked "Export Data Dictionary (.md)"; markdown file downloaded cleanly. **Status: PASS.**

