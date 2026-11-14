# HanuJai High School ERP — Vercel Private Blob Setup & Client Ownership Guide

**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Target Storage:** Vercel Private Blob (`hanujai-student-documents`)  
**Database:** Google Cloud Firestore (Metadata & Roles)  
**Authentication:** Firebase Authentication (Principal & Admin Office)  
**Security Level:** High — Private access only, zero public bucket exposure  

---

## 1. Executive Summary & Why Vercel Private Blob

To eliminate personal developer billing, credit card dependencies, and complex Cloudflare CORS configurations, HanuJai High School ERP stores all 9 mandatory student identity and enrollment documents directly in **Vercel Private Blob**, attached to the school's own Vercel project and billed directly to the school.

### System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HanuJai High School ERP                         │
│                    (Web & Native Mobile Application)                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
         ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     Firebase Authentication     │         │      Google Cloud Firestore     │
│   • Principal (Read-Only)       │         │   • Student Records             │
│   • Admin Office (Full Access)  │         │   • 9-Slot Document Metadata    │
│   • Issues Verified JWT Tokens  │         │   • Immutable Audit Events      │
└────────────────┬────────────────┘         └─────────────────────────────────┘
                 │
                 ▼ (Bearer JWT Auth)
┌────────────────────────────────────────────────────────────────────────┐
│                    Vercel Serverless API Functions                     │
│  • POST /api/documents/upload  (Generates client token via handleUpload)│
│  • GET  /api/documents/file    (Streams private blobs via get())       │
│  • POST /api/documents/delete  (Removes private blobs via del())       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Vercel Private Blob Store                        │
│                     (hanujai-student-documents)                        │
│   • Strictly Private Mode (HTTP 403 on direct URL access)              │
│   • 10MB per file maximum size limit                                   │
│   • Path: students/{studentId}/documents/{docType}/{id}-{filename}     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Step-by-Step Setup Guide (Client / School Administrator)

Follow these exact steps in the Vercel dashboard to provision the private storage store under the school's account:

### Step 1: Open Vercel Project
1. Log into your Vercel account at [https://vercel.com](https://vercel.com).
2. Open the project: **`hanujai-erp`** (or the production team project).

### Step 2: Create the Private Blob Store
1. Click the **Storage** tab in the top navigation bar of your Vercel dashboard.
2. Click **Create Database** (or **Create Store**).
3. Select **Blob (File Storage)** and click **Continue**.
4. Configure store parameters:
   - **Store Name:** `hanujai-student-documents`
   - **Access:** Select **`Private`** *(CRITICAL: Never choose Public. All student identity documents contain sensitive Aadhaar cards and birth certificates and must be Private).*
   - **Region:** Select **Washington, D.C. (iad1)** or nearest available server region.
5. Click **Create Store**.

### Step 3: Connect Store to Project
1. Once the store is created, navigate to its **Settings** or **Projects** tab.
2. Click **Connect Project**.
3. Select **`hanujai-erp`**.
4. Select all environments:
   - [x] Production
   - [x] Preview
   - [x] Development
5. Click **Connect**.
6. Vercel will automatically inject the required environment variable:
   - `BLOB_READ_WRITE_TOKEN`

### Step 4: Verify Environment Variables
Ensure the following variables are present in **Settings → Environment Variables**:

| Variable Name | Required By | Description |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Functions | Injected automatically by Vercel when store is linked |
| `VITE_FIREBASE_API_KEY` | Serverless Token Verifier | Firebase Web API key for server token validation |
| `VITE_FIREBASE_PROJECT_ID` | Firestore Repository | Firebase Project ID (`hanujai-erp-demo`) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication | Domain for Firebase Auth session |

### Step 5: Redeploy Project
1. Navigate to the **Deployments** tab.
2. Click **Redeploy** on the latest production deployment so the new `BLOB_READ_WRITE_TOKEN` is loaded into the serverless functions.
3. Test document upload in the web app under any student profile: `https://hanujai-erp.vercel.app/students/STU-01A-35`.

---

## 3. Storage Sizing, Limits & Pricing

### HanuJai High School Profile
- **Current Student Capacity:** ~1,000 students
- **Document Slots:** 9 mandatory slots per student
- **Total Possible Slots:** 9,000 documents
- **Average Compressed File Size:** 300 KB – 500 KB per document
- **Total Storage Estimate at 100% Completion:** ~4.0 GB to ~4.5 GB

### Vercel Blob Plan Comparison

| Feature | Vercel Hobby (Free) | Vercel Pro ($20 / month) |
|---|---|---|
| **Storage Included** | 250 MB | 500 GB |
| **Additional Storage** | N/A (Hard Cap) | \$0.023 / GB / month |
| **Max File Size** | 500 MB (API limit 10MB) | 5 TB (API limit 10MB) |
| **Read Operations** | 50,000 / month | 100,000,000 / month |
| **Write Operations** | 10,000 / month | 10,000,000 / month |
| **Bandwidth Included** | 1 GB / month | 1 TB / month |
| **Fit for HanuJai ERP** | Pilot / Testing (~50 students) | **Full School Deployment (~1,000 students)** |

> [!TIP]
> **Recommended Plan:**
> During initial testing and trial rollout (Class 10-A, ~40 students), the **Hobby (Free)** plan is completely sufficient.
> When rolling out to all 1,000 students across Nursery through Class 12, upgrade the project to **Vercel Pro ($20/month)**. The $20/month plan includes 500 GB, which easily accommodates 100× the school's 4.5 GB storage requirement for decades.

---

## 4. Future AWS S3 Migration Path

The HanuJai ERP codebase incorporates a strict **Storage Provider Abstraction Layer**:
- Interface: `src/services/storage/storageProvider.ts`
- Implementation: `src/services/storage/vercelBlobStorage.ts`

### Why This Protects the School
1. **Zero UI Changes:** The student profile, 9 document cards, progress bars, and modals only talk to `StorageProvider`.
2. **Zero Database Changes:** Firestore stores canonical storage paths (`students/{studentId}/documents/{docType}/{fileId}`) and standard download URLs.
3. **Seamless Switch:** If the school ever decides to move storage to an AWS S3 bucket in Mumbai (`ap-south-1`):
   - Implement `AwsS3StorageProvider implements StorageProvider`.
   - Swap the provider in `firestoreRepository.ts`.
   - All student profiles and history continue operating without disruption.

---

## 5. Security & Privacy Safeguards

1. **Private Blobs Exclusively:** Documents cannot be viewed by scraping or guessing URLs. Direct requests return HTTP 403 Forbidden.
2. **Role Enforcement:**
   - **Principal:** Strictly read-only oversight. Can preview and download documents; upload and delete buttons are hidden and blocked on the server with HTTP 403.
   - **Admin Office:** Can upload, replace, and delete documents.
   - **Teachers:** Deactivated in Phase 1; blocked on both client and server.
3. **Anti-Sniffing & Cache Control:** All documents served via `/api/documents/file` send `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-cache, no-store`.
4. **Audit Trail:** Every upload, replacement, and deletion logs an immutable audit event to the Firestore `auditEvents` collection with timestamp, uploader UID, student ID, and file metadata.
