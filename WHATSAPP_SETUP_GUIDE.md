# HanuJai High School ERP — Complete WhatsApp Integration & Setup Guide

**Campus:** HanuJai High School, Vidyadhar Nagar, Jaipur, Rajasthan 302039  
**Pilot Phase:** Phase 1 (Student Roll Call & Daily Present/Absent WhatsApp Alerts)  
**Target Environment:** Local Windows PowerShell (`C:\Projects\School\hanujai-erp`) & Persistent Node.js Worker  
**Engine:** `@whiskeysockets/baileys` (v7.0.0-rc14) + Cloud Firestore Queue + Native Node.js ESM  

---

## Architecture Overview

```
┌───────────────────────────────────────┐         ┌──────────────────────────────────────────────┐
│  HanuJai React / Vite Web Application │         │  Dedicated Persistent Node.js Worker Process │
│  (Vercel / Local http://localhost:5173)│         │  (Local PowerShell / Docker / Cloud VM)       │
└──────────────────┬────────────────────┘         └──────────────────────┬───────────────────────┘
                   │                                                     │
                   │ 1. Teacher marks attendance                         │
                   │ 2. Submits register                                 │
                   │ 3. Writes session & enqueue jobs                    │ 4. Polls pending jobs (every 5s)
                   ▼                                                     ▼ 5. Normalizes phone (+91)
┌────────────────────────────────────────────────────────────────────────┴───────────────────────┐
│                           Google Cloud Firestore Database                                      │
│  - attendanceSessions/{sessionId}     (Authoritative teacher roll call records)                │
│  - attendanceNotifications/{jobId}    (Durable, idempotent outbox queue)                       │
│  - students/{studentId}               (Master directory with guardian phone numbers)           │
└────────────────────────────────────────────────────────────────────────┬───────────────────────┘
                                                                         │
                                                                         │ 6. Validates allowlist & session
                                                                         │ 7. Baileys WebSocket dispatch
                                                                         ▼
                                                          ┌──────────────────────────────┐
                                                          │   WhatsApp Web Network       │
                                                          │   (Parent Mobile WhatsApp)   │
                                                          └──────────────────────────────┘
```

> [!IMPORTANT]
> **Why Baileys Runs as a Separate Persistent Worker and NOT inside Vercel Functions:**  
> The React/Vite website is deployed on Vercel as static frontend assets (`dist/`). WhatsApp Web protocol requires an uninterrupted, stateful, outgoing TLS WebSocket connection with persistent cryptographic credentials. Vercel Functions spin down after execution (max 10–60s on standard plans, up to 300s on Fluid Compute) and have ephemeral filesystems, making it impossible to maintain a permanent WhatsApp socket or store auth state reliably.  
> The worker is therefore isolated into a dedicated Node.js process (`scripts/whatsappWorker.ts` / `whatsapp-worker/`). For production, run the worker on a persistent container platform (e.g. Railway, Render, Fly.io, or VPS) with an attached persistent disk volume for `.baileys_auth/`.  
> For the comprehensive technical evaluation and documentation citations, see: [HanuJai ERP System Architecture — Section F](docs/architecture/HANUJAI_ERP_SYSTEM_ARCHITECTURE.md#section-f--whatsapp--websocket-architecture).

---

## Part A: Installation & Environment Setup

### 1. Requirements
* **Operating System:** Windows 10/11 (PowerShell) or Linux/macOS
* **Node.js:** v22.6+ or v24.x (Installed: Node v24.11.1 with native `--experimental-strip-types`)
* **Project Directory:** `C:\Projects\School\hanujai-erp`

### 2. Verify Node Version
Open Windows PowerShell and check your Node version:
```powershell
cd C:\Projects\School\hanujai-erp
node -v
```
*(Must output `v22.x` or `v24.x`)*

### 3. Install Dependencies
Dependencies are already configured in `package.json`:
```powershell
npm install
```

### 4. Configure Local Environment (`.env.local`)
Inspect or edit `C:\Projects\School\hanujai-erp\.env.local`. Ensure the following keys are present:

```ini
# Data Mode
VITE_DATA_MODE=firebase

# Firebase Credentials (Already pre-configured for HanuJai pilot)
VITE_FIREBASE_API_KEY=AIzaSyC45xxyybCp03KlJ7fWsyxE8AVQY6tm988
VITE_FIREBASE_AUTH_DOMAIN=hanujai-erp-demo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hanujai-erp-demo
VITE_FIREBASE_STORAGE_BUCKET=hanujai-erp-demo.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=313448330186
VITE_FIREBASE_APP_ID=1:313448330186:web:81028e9ef8d6e85520d533

# WhatsApp Phase 1 Worker Configuration
WHATSAPP_PROVIDER=baileys
VITE_WHATSAPP_PROVIDER=baileys

# Master Live Send Switch (Keep 'false' for initial pairing & dry-run test)
WHATSAPP_SEND_ENABLED=false
VITE_WHATSAPP_SEND_ENABLED=false

# Dry-run flag: 'true' prevents network dispatch
WHATSAPP_DRY_RUN=true

# Persistent WhatsApp Web Session Directory (Excluded from Git via .gitignore)
WHATSAPP_AUTH_DIR=./.baileys_auth

# Test Recipient Phone Number Allowlist (Put your test phone number here, e.g. 919829012345)
WHATSAPP_TEST_ALLOWLIST=
VITE_WHATSAPP_TEST_ALLOWLIST=

# Worker Local Health Check & Status Server Port
WHATSAPP_WORKER_PORT=5050
```

---

## Part B: WhatsApp Pairing (One-Time Setup)

You will pair the school's authorized phone using the terminal QR code.

### Step 1: Start the WhatsApp Worker
In Windows PowerShell, run:
```powershell
npm run whatsapp:worker
```
*(Or inside `whatsapp-worker`: `cd whatsapp-worker; npm start`)*

### Step 2: Scan the QR Code
1. The terminal will output the HanuJai banner and render a compact terminal QR code.
2. Open **WhatsApp** on the mobile phone you wish to send attendance alerts from.
3. Tap **Settings** (iOS) or **More options ⋮** (Android) > **Linked Devices**.
4. Tap **Link a Device** and point your phone camera at the QR code in PowerShell.

### Step 3: Verify Successful Pairing
Once scanned, the worker terminal will display:
```
================================================================================
  ✅ HANUJAI WHATSAPP DISPATCHER SUCCESSFULLY CONNECTED TO WHATSAPP!
  Linked JID   : 9198XXXXXXXX@s.whatsapp.net
  Session State: Persisted in C:\Projects\School\hanujai-erp\.baileys_auth
================================================================================
```
The session credentials are securely persisted in `C:\Projects\School\hanujai-erp\.baileys_auth/creds.json`.

> [!TIP]
> **Persistent Reconnection:** On subsequent restarts, the worker automatically reuses `.baileys_auth/` and connects without asking you to scan again unless you deliberately log out.

---

## Part C: Dry-Run Testing (Safe Simulation Mode)

Before sending any live messages, verify that the worker and UI interact safely without contacting the WhatsApp network.

### 1. Check Worker & Queue Health
In a separate PowerShell window, check worker status:
```powershell
npm run whatsapp:status
```
You will see:
```
📁 Auth Directory    : C:\Projects\School\hanujai-erp\.baileys_auth
🔑 Credentials File  : ✓ EXISTS (.baileys_auth/creds.json)
🌐 Probing Active Worker HTTP Server (Port 5050)...
✓ Worker Process     : ONLINE (PID Active, Uptime: 42s)
✓ WhatsApp Socket    : 🟢 CONNECTED
📊 Auditing Cloud Firestore attendanceNotifications Queue...
```

### 2. Test Dry-Run from Daily Register UI
1. Open the web ERP: `http://localhost:5173/attendance/register/class-10-a`
2. Sign in as **Shri Rajeshwar Choudhary** (Senior Class 10-A Tutor).
3. Mark students: click **All Present** or toggle a few students to **Absent**.
4. Click **Save & Submit Register** and confirm the submission in the modal.
5. In the **WhatsApp Parent Notifications** status panel at the bottom of the register:
   - Notice: 20 Notification Jobs enqueued with deterministic IDs (`att_...`).
   - If `WHATSAPP_SEND_ENABLED=false` or number is not in allowlist, the worker safely marks demo numbers as `Skipped` (`not_in_test_allowlist`), protecting random phone numbers from receiving test messages.

---

## Part D: Manual Live Test (Sending Real WhatsApp Messages)

When you are ready to test live sending with your personal WhatsApp number:

### Step 1: Add Your Number to Allowlist & Enable Live Sending
Open `C:\Projects\School\hanujai-erp\.env.local` and update:
```ini
# 1. Enable live sending
WHATSAPP_SEND_ENABLED=true
VITE_WHATSAPP_SEND_ENABLED=true

# 2. Disable dry-run
WHATSAPP_DRY_RUN=false

# 3. Add your mobile number (country code 91 + 10 digits, e.g. 919829012345)
WHATSAPP_TEST_ALLOWLIST=919829012345
VITE_WHATSAPP_TEST_ALLOWLIST=919829012345
```
Save the file.

### Step 2: Send a One-Shot Test Message via CLI
Run the dedicated test CLI tool:

**Test Present Message:**
```powershell
npm run whatsapp:test -- --to=919829012345 --state=present --student="Aarav Sharma"
```

**Test Absent Message:**
```powershell
npm run whatsapp:test -- --to=919829012345 --state=absent --student="Aarav Sharma"
```

Expected output in PowerShell:
```
================================================================================
  HANUJAI HIGH SCHOOL ERP — WHATSAPP MANUAL DISPATCH TEST
================================================================================
📍 Recipient Mobile : 919829012345
📍 Status Type      : PRESENT
📍 Student Name     : Aarav Sharma
📍 Date             : 26 Oct 2026
📍 Live Sending     : 🟢 ENABLED

Connecting to WhatsApp socket to dispatch test alert...
[Baileys] Transmitting attendance alert to 919829012345@s.whatsapp.net...
[Baileys] ✓ Message accepted by WhatsApp network. ID: 3EB0...

✅ TEST MESSAGE SUCCESSFULLY SENT to 919829012345!
```
Check your WhatsApp phone: the message will be delivered instantly!

### Step 3: Test Live Attendance Submission through Web ERP
1. In `C:\Projects\School\hanujai-erp\src\data\demo\seedData.ts` (or via Firestore), update Aarav Sharma's `primaryPhone` to your test number:
   ```ts
   primaryPhone: '+91 98290 12345', // Replace with your 10-digit number
   ```
2. In the web interface (`http://localhost:5173/attendance/register/class-10-a`):
   - Mark Aarav as **Present** or **Absent**.
   - Click **Save & Submit Register**.
3. Watch the worker terminal:
   ```
   [Queue] Discovered 20 pending notification job(s)...
   [Queue] Dispatching [PRESENT] alert for Aarav Sharma -> +91 98290 12345...
   [Baileys] ✓ Message accepted by WhatsApp network. ID: 3EB0...
   [Queue] ✓ Job att_class-10-a_... completed.
   [Queue] Safe Skip: Diya Patel - Not in WHATSAPP_TEST_ALLOWLIST.
   ```
4. Only your allowlisted number receives the WhatsApp notification. All demo numbers are skipped with reason `not_in_test_allowlist`.

### Step 4: Disabling Live Sending Immediately
To pause live sending at any time, simply set in `.env.local`:
```ini
WHATSAPP_SEND_ENABLED=false
WHATSAPP_DRY_RUN=true
```
No restart of the web app is required; the worker immediately stops sending network messages.

---

## Part E: Session Management & Logout

### How to Disconnect or Re-Pair WhatsApp
If you want to un-link your WhatsApp phone or pair a different number:
```powershell
npm run whatsapp:logout
```
This safely clears the credentials in `.baileys_auth/`.  
When you run `npm run whatsapp:worker` next time, a fresh QR code will be generated.

---

## Part F: Persistent Hosting (Production Deployment)

For production operation when the school is in session, the worker should run 24/7 on a persistent host:

| Platform | Deployment Type | State Persistence Strategy |
| :--- | :--- | :--- |
| **Windows School Server** | Windows Service / PM2 | `.baileys_auth/` stored on local drive |
| **Linux VPS (Ubuntu / Debian)** | systemd service / PM2 | `/var/lib/hanujai-whatsapp/.baileys_auth` |
| **Railway / Render / Fly.io** | Node.js Worker Container | Persistent Volume Mount to `/app/.baileys_auth` |
| **Vercel** | Frontend ONLY | **DO NOT run worker on Vercel** (Socket cannot stay alive) |

### Running with PM2 (Recommended for Persistent Background Operation)
```powershell
# Install PM2 globally if not installed
npm install -g pm2

# Start the worker with auto-restart on crashes or reboots
pm2 start scripts/whatsappWorker.ts --name "hanujai-whatsapp-worker" --node-args="--experimental-strip-types"

# Save process list
pm2 save
```

---

## Part G: Troubleshooting Common Issues

### 1. QR Code is Garbled in Terminal
* **Cause:** Terminal font width or non-monospace font.
* **Remedy:** Maximize PowerShell window or switch PowerShell font to `Consolas` or `Cascadia Code`.

### 2. "Connection closed due to: loggedOut" (Code 401)
* **Cause:** The WhatsApp session was unlinked from the phone app (Linked Devices > Log out).
* **Remedy:** Run `npm run whatsapp:logout` and restart `npm run whatsapp:worker` to scan a new QR code.

### 3. "Parent mobile number missing or invalid" (Skipped)
* **Cause:** Student record in master directory has empty `primaryPhone` or less than 10 digits.
* **Remedy:** Check student dossier in Student Directory and enter valid 10-digit Indian mobile number.

### 4. Port 5050 Conflict
* **Cause:** Another application is using port 5050.
* **Remedy:** Change `WHATSAPP_WORKER_PORT=5055` in `.env.local`.

---

## Summary of All Available Commands

| Command | Purpose |
| :--- | :--- |
| `npm run whatsapp:worker` | Starts the persistent WhatsApp worker process and displays QR code if not paired |
| `npm run whatsapp:status` | Audits local auth state, queries active worker HTTP server, and counts Firestore queue |
| `npm run whatsapp:test` | Sends a single controlled test alert to your phone (CLI manual test) |
| `npm run whatsapp:logout` | Disconnects the linked session and removes `.baileys_auth/` files |
| `npm test` | Runs all 77 automated test suites including Phase 1 WhatsApp queue logic |
| `npm run build` | Compiles production TypeScript bundle with Vite |
