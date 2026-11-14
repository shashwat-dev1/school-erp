# HanuJai High School ERP — Two-Account Vercel Private Blob Architecture & Setup Guide

**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Document Repository:** 9-Slot Mandatory Student & Parent Identification  
**Target Store:** `hanujai-student-documents` (Private Access Mode)  
**Security Level:** High — Strictly private blobs, zero public URLs, Authorization Bearer header only  

---

## 1. Two-Account Architecture & Responsibility Separation

To preserve existing deployments while ensuring the school retains complete ownership and direct billing for all stored files, the system operates across two separate accounts:

| Component | Owner | Role & Responsibility |
|---|---|---|
| **Account A** | **Developer Account** | • Hosts and executes `hanujai-erp` web application & serverless API functions (`/api/documents/*`).<br>• Hosts source code and CI/CD pipelines.<br>• Incurs standard Vercel serverless compute execution billing. |
| **Account B** | **School / Client Account** | • Owns the Private Blob Store (`hanujai-student-documents`).<br>• Controls data ownership, retention, and access credentials.<br>• Incurs all storage, bandwidth, and Blob operation billing directly. |

> [!IMPORTANT]
> **No Website Transfer:** The existing website and its GitHub repository remain in Account A. The school does NOT take over website hosting or developer infrastructure. Cross-account access is handled securely via the store's read-write token.

---

## 2. Infrastructure Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HanuJai High School ERP                         │
│                    (Web & Native Mobile Application)                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
         ▼ (Firebase JWT)                                    ▼ (Direct Metadata)
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     Firebase Authentication     │         │      Google Cloud Firestore     │
│   • Principal (Read-Only)       │         │   • Student Records             │
│   • Admin Office (Full Access)  │         │   • 9-Slot Document Metadata    │
│   • Evaluates Staff Status      │         │   • Immutable Audit Events      │
└────────────────┬────────────────┘         └─────────────────────────────────┘
                 │
                 ▼ (Authorization: Bearer <idToken> — NO query params)
┌────────────────────────────────────────────────────────────────────────┐
│                  ACCOUNT A: Vercel Serverless Functions                │
│                     (Hosted on Developer Account)                      │
│                                                                        │
│  • POST /api/documents/upload                                          │
│    Verifies Admin Office role, validates slot/size/type, and calls:    │
│    handleUpload({ token: BLOB_READ_WRITE_TOKEN })                      │
│                                                                        │
│  • GET  /api/documents/file                                            │
│    Verifies Principal/Admin role, streams private blob via:            │
│    get(pathname, { access: 'private', token: BLOB_READ_WRITE_TOKEN })  │
│                                                                        │
│  • POST /api/documents/delete                                          │
│    Verifies Admin Office role, deletes private blob via:               │
│    del(pathname, { token: BLOB_READ_WRITE_TOKEN })                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼ (BLOB_READ_WRITE_TOKEN Authentication)
┌────────────────────────────────────────────────────────────────────────┐
│                  ACCOUNT B: Vercel Private Blob Store                  │
│                     (Owned by School / Client)                         │
│                                                                        │
│  • Store Name: hanujai-student-documents                               │
│  • Access Mode: Strictly Private (HTTP 403 on direct URL access)       │
│  • Storage Billing: Incurred directly by Account B                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Client-Side Setup Instructions (Account B)

These steps are executed by the school administrator in **Account B**:

### Step 1: Log in to Account B
Log into the school's official Vercel account at [https://vercel.com](https://vercel.com).

### Step 2: Create the Private Blob Store
1. In the top navigation bar, click **Storage**.
2. Click **Create Database** (or **Create Store**).
3. Select **Blob (File Storage)** and click **Continue**.
4. Configure store parameters:
   - **Store Name:** `hanujai-student-documents`
   - **Access:** Select **`Private`** *(CRITICAL: Never choose Public. All student identity documents contain sensitive Aadhaar cards and birth certificates and must be Private).*
   - **Region:** Choose the closest region (e.g. Washington, D.C. `iad1`).
5. Click **Create Store**.

### Step 3: Retrieve the Store Token
1. In Account B, click on the newly created `hanujai-student-documents` store.
2. Go to **Settings** (or the **Environment Variables / Connection Strings** panel).
3. Locate the **Read/Write Token** (format: `vercel_blob_rw_...`).
4. Copy the token string.

### Step 4: Securely Transfer the Token
> [!CAUTION]
> **Security Protocol:**
> Do NOT send this token via public chat channels, unencrypted email, or AI prompts (such as ChatGPT).
> Transfer it using a secure, zero-knowledge tool:
> - **Bitwarden Send** or **1Password Share** (one-time encrypted link with 1-hour expiration)
> - **Signal / WhatsApp encrypted direct message** directly to the designated developer.

---

## 4. Developer-Side Configuration Instructions (Account A)

These steps are executed by the developer in **Account A**:

### Step 1: Log in to Account A
Log into Account A at [https://vercel.com](https://vercel.com) and navigate to the **`hanujai-erp`** project.

### Step 2: Add Environment Variable
1. Go to **Settings → Environment Variables**.
2. Click **Add Variable**:
   - **Key:** `BLOB_READ_WRITE_TOKEN`
   - **Value:** Paste the token provided by Account B (`vercel_blob_rw_...`).
   - **Environments:** Check **Production**, **Preview**, and **Development**.
3. Click **Save**.

### Step 3: Redeploy the Website
1. Navigate to the **Deployments** tab.
2. Select the latest deployment and click **Redeploy**.
3. Once deployed, the serverless functions in Account A will use Account B's store token for all document operations.

### Step 4: Verification
1. Log in to `https://hanujai-erp.vercel.app` using Admin Office credentials.
2. Open any student profile (e.g. `STU-01A-35`).
3. Click **Documents** tab and upload a test document (e.g. Student Photograph or Birth Certificate).
4. Verify that:
   - Upload succeeds with real-time percentage progress.
   - Preview opens the image/PDF inside the modal.
   - Download saves the original file to disk.
   - Deletion removes the file cleanly.
   - Principal account view has upload and delete actions disabled.

---

## 5. Billing & Pricing Realities

### Cost Allocation
- **Blob Storage & Operations:** Billed to **Account B** (the school).
- **Website & Serverless Function Invocations:** Billed to **Account A** (the developer).
- Infrastructure billing is split by domain: file storage is owned and paid by the client; web hosting compute is run by the developer.

### Official Vercel Blob Pricing (Verified)

| Plan Tier | Storage Rate | Operations Rate | Included Allowances | Fit for HanuJai ERP |
|---|---|---|---|---|
| **Hobby (Free)** | Free up to 1 GB / month | • Reads: 10,000 / month<br>• Writes/Lists: 2,000 / month | 1 GB total storage | **Pilot / Trial Phase** (~50 students) |
| **Pro ($20/mo base)** | ~$0.023 / GB / month | • Reads: ~$0.40 per 1M ops<br>• Writes: ~$5.00 per 1M ops | Uses plan credits, then on-demand pay-as-you-go | **Full Institutional Rollout** (~1,000 students) |

### Sizing Estimate for HanuJai High School (~1,000 Students)
- 1,000 students × 9 document slots = 9,000 total documents.
- Average compressed scan size: ~400 KB to ~500 KB per document.
- **Total Storage Required:** ~4.0 GB to ~4.5 GB.
- **Estimated Monthly Cost on Vercel Pro:**
  - 4.5 GB × \$0.023/GB ≈ **\$0.10 / month** in storage!
  - 9,000 uploads once per year ≈ negligible fraction of a cent.

---

## 6. Security & Permission Architecture

1. **Strictly Header-Only Authentication:**
   - All serverless endpoints (`/api/documents/*`) accept Firebase ID tokens **exclusively through `Authorization: Bearer <idToken>` headers**.
   - URL query parameter tokens (`?token=...`) are explicitly blocked (returning HTTP 401).
   - This eliminates token leakage in browser history, server access logs, and HTTP referrers.

2. **Role-Based Server Enforcement:**
   - **Admin Office (`admin`):** Full authorization to upload, replace, preview, download, and delete documents.
   - **Principal (`principal`):** Strictly read-only oversight. Authorized to preview and download; upload and delete attempts are blocked on the server with HTTP 403 Forbidden.
   - **Teachers:** Deactivated in Phase 1; blocked on both client and server with HTTP 403 Forbidden.

3. **Server-Side Path Generation & Anti-Traversal:**
   - Canonical path pattern: `students/{studentId}/documents/{documentType}/{timestamp}_{filename}`.
   - The server validates student IDs (`/^[A-Za-z0-9_-]+$/`), document types (9 allowed categories), MIME types, and file sizes (10 MB for documents, 5 MB for student photos).
   - Path traversal attempts (`..`, null bytes, slashes) are rejected with HTTP 400 Bad Request.

4. **Private Storage Protection:**
   - The Blob Store access mode is **Private**.
   - Direct requests to public URLs return HTTP 403 Forbidden.
   - Files are served only through the authenticated `/api/documents/file` proxy with security headers (`X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache, no-store`).

5. **Log Hygiene:**
   - Authorization headers, raw tokens, and full document URLs are stripped from all console outputs and server logs.

---

## 7. Future AWS S3 Transition Path

The application utilizes a clean **Storage Provider Abstraction Layer**:
- Interface: `src/services/storage/storageProvider.ts`
- Implementation: `src/services/storage/vercelBlobStorage.ts`

If the school's requirements expand in future phases (e.g. multi-gigabyte video archives or compliance mandates requiring storage in AWS Mumbai `ap-south-1`):
1. An `AwsS3StorageProvider implements StorageProvider` class can be implemented.
2. The provider is swapped in `firestoreRepository.ts`.
3. **Zero changes** are needed in student profiles, Cloud Firestore schemas, or UI components.
