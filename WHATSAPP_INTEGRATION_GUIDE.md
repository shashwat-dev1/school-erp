# HanuJai High School ERP — WhatsApp Parent Notification Architecture & Integration Guide
**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Phase:** 1 (Student Roster + Daily Attendance + WhatsApp Parent Notifications)  
**Authoritative Backend:** Cloud Firestore & Node.js Messaging Worker  

---

## 1. Executive Summary & Phase 1 Objectives

Following leadership review with the School Principal and Director, HanuJai High School ERP Phase 1 concentrates strictly on three capabilities:
1. **Student Master Data:** Managing a controlled demo cohort (Class 10-A, 20 students) without altering or deleting the comprehensive underlying school records.
2. **Mobile Daily Attendance:** Providing Class Teachers with a mobile-optimised attendance screen featuring **Present** and **Absent** choices only (Admission numbers and "Late" statuses removed, First name on line 1 and Last name on line 2 on mobile, touch targets $\ge 44\text{px}$).
3. **Daily WhatsApp Notifications:** Automatically dispatching respectful parent/guardian attendance alerts for **both Present and Absent students** immediately after the daily register is saved and submitted to Firebase.

---

## 2. Notification Message Templates

Both Present and Absent attendance states are communicated to parents. Message text is centrally configured in `src/config/phase.ts` using the exact approved templates:

### Present Notification
```text
Mr./Mrs. {Parent Name},

This is to inform you that {Student Name} has been marked PRESENT at HanuJai High School on {Date}.

If you believe this record is incorrect, please contact the school.

Regards,  
HanuJai High School

---

आदरणीय श्री/श्रीमती {Parent Name},

आपको सूचित किया जाता है कि आपकी संतान {Student Name} को दिनांक {Date} को हनुजाई हाई स्कूल में उपस्थित (PRESENT) दर्ज किया गया है।

यदि आपको लगता है कि उपस्थिति का यह रिकॉर्ड गलत है, तो कृपया विद्यालय से संपर्क करें।

 सादर,  
हनुजाई हाई स्कूल
```

### Absent Notification
```text
Mr./Mrs. {Parent Name},

This is to inform you that {Student Name} has been marked ABSENT at HanuJai High School on {Date}.

If you believe this record is incorrect, please contact the school.

Regards,  
HanuJai High School

---

आदरणीय श्री/श्रीमती {Parent Name},

आपको सूचित किया जाता है कि आपकी संतान {Student Name} को दिनांक {Date} को हनुजाई हाई स्कूल में अनुपस्थित (ABSENT) दर्ज किया गया है।

यदि आपको लगता है कि उपस्थिति का यह रिकॉर्ड गलत है, तो कृपया विद्यालय से संपर्क करें।

सादर,  
हनुजाई हाई स्कूल
```

*Note: Dates are formatted using the school's local timezone (Asia/Kolkata / IST).*

---

## 3. Architecture & Provider Abstraction

To ensure the school's core attendance workflow remains durable and independent of any single messaging vendor or library, a strict provider abstraction layer is established under `src/services/whatsapp/`:

```
┌────────────────────────────────────────────────────────┐
│     Daily Attendance Register (Web ERP / Mobile)       │
│         [Save & Submit Register] (Class Teacher)       │
└──────────────────────────┬─────────────────────────────┘
                           │ 1. Commit Attendance Session
                           ▼
┌────────────────────────────────────────────────────────┐
│          Authoritative Cloud Firestore Database        │
│    - Collection: attendanceSessions                    │
│    - Collection: attendanceNotifications (Durable Q)   │
└──────────────────────────┬─────────────────────────────┘
                           │ 2. Enqueue Notification Jobs
                           ▼
┌────────────────────────────────────────────────────────┐
│      WhatsApp Notification Service (Idempotent Q)      │
│  Idempotency Key: att_{sessionId}_{studentId}          │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     Dry-Run Provider          │   │ Server-side Baileys Worker    │
│  (Default / Preview Mode)     │   │ (Standalone Node.js Process)  │
│ - Zero external socket needed │   │ - QR Pairing                  │
│ - Simulates send & receipts   │   │ - Multi-file auth state       │
│ - Live sending disabled       │   │ - Dedicated VPS / Docker host │
└───────────────────────────────┘   └───────────────────────────────┘
```

### Components
1. **`WhatsAppProvider` Interface (`src/services/whatsapp/types.ts`)**: Defines `send(job: WhatsAppNotificationJob): Promise<NotificationSendResult>`.
2. **`DryRunWhatsAppProvider` (`src/services/whatsapp/providers/dryRunProvider.ts`)**: Simulates dispatch, validates recipient phone numbers, checks test allowlists, and protects against unauthorized live broadcasts.
3. **`WhatsAppNotificationService` (`src/services/whatsapp/whatsappService.ts`)**: Orchestrates durable Firestore batch writes, deduplication, retry policies, and session metrics.
4. **`scripts/whatsappWorker.ts`**: Standalone, detached Node.js server-side worker powered by `@whiskeysockets/baileys`.

---

## 4. Evaluation of Proposed Baileys Pilot

### A. Package & Runtime API
- Package: `@whiskeysockets/baileys` (installed with `qrcode-terminal`).
- Authentication API: `useMultiFileAuthState` safely persisted to a local state directory (`.baileys_auth/`).
- Connection Lifecycle: Manages `connection.update` for QR rendering, credentials saving (`creds.update`), and graceful handling of `DisconnectReason.loggedOut` vs transient network interruptions.

### B. Security & Credential Isolation
- **Client-Side Prohibition:** Baileys is **strictly prohibited** from running inside React components, browser bundles, Vite client-side code, or Vercel edge functions.
- **Credential Storage:** Session tokens and pairing keys are stored exclusively in `.baileys_auth/`.
- **Git Protection:** `.gitignore` explicitly excludes:
  ```gitignore
  .baileys_auth/
  baileys_auth_info/
  auth_info_baileys/
  *.session.json
  *.qr.png
  ```

### C. Hosting Constraints (Vercel Frontend vs Persistent Worker)
- **Vercel Serverless Architecture:** Vercel functions are stateless and ephemeral with strict execution timeouts (typically 10–60 seconds). They **cannot** maintain continuous WebSocket connections or persist credentials across invocations.
- **Production Hosting Requirement:** The ERP web frontend remains hosted on Vercel. The Baileys worker must run on an environment supporting long-running persistent processes (e.g. AWS EC2, DigitalOcean Droplet, Railway, Render Background Worker, or a Dockerized on-premise container).
- The worker communicates asynchronously by polling or subscribing to `attendanceNotifications` where `deliveryStatus == 'pending'`.

---

## 5. Operational & Account Risks: Baileys vs Official WhatsApp Business Platform

| Evaluation Factor | Baileys (@whiskeysockets/baileys) Pilot | Official WhatsApp Business Platform (Cloud API) |
| :--- | :--- | :--- |
| **Meta Platform Approval** | Unofficial reverse-engineered WhatsApp Web protocol client | Officially licensed Meta Graph API service |
| **Account Ban Risk** | **HIGH RISK.** Automated bulk messaging via personal/business WhatsApp numbers can trigger automated spam detection and permanent account suspension. | **ZERO RISK.** Authorised enterprise route with approved sender profile. |
| **Connection Stability** | Dependent on continuous WebSocket connection; phone app may disconnect or de-link session periodically. | RESTful webhook architecture with 99.9% uptime SLA hosted directly by Meta. |
| **Message Throughput** | Limited to approximately 10–15 messages per minute to prevent socket rate-limiting. | Scales from 1,000 to 100,000+ messages per day based on Meta messaging tier. |
| **Message Templates** | Arbitrary text (no pre-approval required, but higher ban susceptibility). | Pre-approved utility notification templates (`attendance_alert`) with strict format validation. |
| **Recommended Use** | Controlled sandbox testing with allowlisted school administration SIM cards only. | **Mandatory recommendation for live school-wide parent operations.** |

---

## 6. Safe Pilot & Live-Send Controls

To prevent accidental dispatch to real parents during evaluation:

1. **Default Dry-Run Mode:**
   `src/config/phase.ts` sets `sendEnabled: false`. The frontend interface displays a prominent `Dry-Run Mode (Safe Preview)` pill. All notifications are simulated and logged to Firestore without external network socket transmission.

2. **Test Recipient Allowlist:**
   When testing live sends via `scripts/whatsappWorker.ts`, the worker checks `TEST_RECIPIENT_ALLOWLIST`. Only verified test numbers (e.g. Principal and IT Coordinator's test SIMs) receive real test messages. All other demo student records are marked `skipped: 'demo_recipient_not_allowlisted'`.

3. **Parent Consent & Privacy Safeguards:**
   - Parent mobile numbers in the demo cohort are masked in the directory and logs (`+91 98000 •••••`).
   - If a student's contact is missing or invalid, the notification job is marked `skipped: 'missing_phone'`.
   - Message bodies strictly convey basic attendance status (no academic grades or personal notes).

---

## 7. Durable Queue & Idempotency Rules

Duplicate notifications are prevented by design:
- **Deterministic Key:** Each job ID is formed as `att_${sessionId}_${studentId}`.
- **Idempotent Batch Writes:** Re-submitting the register updates the existing job document using `{ merge: true }` rather than generating duplicate queue records.
- **Status Progression:** `pending` $\rightarrow$ `processing` $\rightarrow$ `sent` (or `failed` / `skipped`).
- **Correction Handling:** If an attendance record is corrected after initial submission, the system records the update and requires an explicit correction re-trigger rather than sending repeated blasts on every keystroke.

---

## 8. Operating the Baileys Worker (Pilot Environment)

### Step 1: Install Dependencies & Verify
```bash
cd C:\Projects\School\hanujai-erp
npm run build
```

### Step 2: Configure Environment Variables
Create a local `.env` or set environment variables:
```env
WHATSAPP_PROVIDER=baileys
WHATSAPP_SEND_ENABLED=false
WHATSAPP_TEST_ALLOWLIST=+919829012345
```

### Step 3: Run the Worker
```bash
npm run whatsapp:worker
```
- A QR code will appear in the terminal.
- Scan the QR code using the dedicated school pilot WhatsApp account (**Settings > Linked Devices > Link a Device**).
- The worker authenticates, creates `.baileys_auth/`, and begins polling for submitted registers.
