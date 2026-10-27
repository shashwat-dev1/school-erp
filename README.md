# HanuJai High School ERP — Jaipur

<p align="center">
  <img src="public/assets/hanujai_logo.png" alt="HanuJai High School Crest" width="120" style="object-fit: contain;" />
</p>

<p align="center">
  <strong>Dedicated Internal School Enterprise Resource Planning Platform</strong><br>
  HanuJai High School, Vidyadhar Nagar, Jaipur, Rajasthan 302039<br>
  Affiliated to the Central Board of Secondary Education (CBSE), Affiliation #1730249
</p>

---

## 📌 Executive Architecture & Phase 1 Scope

HanuJai High School ERP is a modern, high-performance institutional portal engineered to streamline school administration, teaching faculty workflows, and student records.

The current approved production milestone is **Phase 1**:
1. **Authenticated Faculty Portals:** Role-Based Access Control (RBAC) supporting **Principal**, **Class Teacher**, and **Subject Teacher** roles.
2. **Class Teacher Daily Roll Call:** Intuitive, touch-friendly morning attendance register for authorized sections with live Present, Absent, Unmarked, and Turnout rate calculations.
3. **Bilingual Parent WhatsApp Notifications:** Automated, asynchronous WhatsApp alerts in English & Hindi notifying parents of daily Present or Absent attendance status via a durable Cloud Firestore outbox queue.

---

## 📚 Essential Documentation

| Document | Description |
|---|---|
| 📖 [**Complete System Architecture**](docs/architecture/HANUJAI_ERP_SYSTEM_ARCHITECTURE.md) | **Authoritative system design**: Component trees, storage matrix, auth rules, attendance sequence diagrams, WhatsApp & WebSocket architecture, Vercel compatibility, and maintenance guide. |
| 💬 [**WhatsApp Integration & Setup Guide**](WHATSAPP_SETUP_GUIDE.md) | Setup instructions for the `@whiskeysockets/baileys` Node.js daemon, QR pairing on sender phone `9509489381`, allowlists, and queue processing. |
| 🚀 [**Firebase & Vercel Deployment Guide**](VERCEL_FIREBASE_DEPLOYMENT_GUIDE.md) | Firestore indexes, security rules deployment, and Vercel edge SPA hosting guide. |

---

## 🎨 Visual Identity & Design System

The system strictly adheres to the approved 11-colour institutional pop palette:
- **Electric Blue (`#1F6BFF`):** Primary institutional brand, active navigation, main submit actions.
- **Burnt Vermilion (`#E4572E`):** Distinctive accents, secondary badges, key highlights.
- **Lime Green (`#B7F000`):** Interactive accents and positive highlights (paired with dark text `#202033`).
- **Canary Yellow (`#FFE600`):** Pending states, attention banners, draft indicators.
- **Tangerine Orange (`#FF7A00`):** Warning badges, secondary action indicators, review alerts.
- **Deep Violet (`#6425D0`):** Secondary branding, leadership tabs, navigation accents.
- **Apple Green (`#7ED957`):** Turnout percentages, Present attendance pills, verified delivery badges.
- **Coral Red (`#FF4D4F`):** Absent attendance pills, system warnings, failed message badges.
- **Cool Canvas (`#F5F7FC`):** Crisp near-white page background.
- **Crisp Surface (`#FFFFFF`):** High-contrast cards and dialog surfaces.
- **Dark Text (`#202033`):** High-contrast typographic foundation (WCAG AAA compliant).

---

## 💻 Quick Start & Local Development

### Prerequisites
- Node.js 22.6+ or 24.x (Tested on Node v24.11.1)
- Windows PowerShell or Unix Terminal

### 1. Web Application (Frontend)
```powershell
cd C:\Projects\School\hanujai-erp
npm install
npm run dev
```
Access the application at `http://localhost:5173`.

### 2. Dedicated WhatsApp Dispatch Worker
```powershell
# From project root:
npm run whatsapp:worker

# Check daemon & pairing status:
npm run whatsapp:status

# To disconnect and clear linked session:
npm run whatsapp:logout
```
*(When pairing, scan the QR code displayed in the terminal or navigate to `http://localhost:5173/whatsapp-qr.html` using the designated sender phone `+91 95094 89381`)*.

---

## 🛡️ WhatsApp & Vercel Compatibility Summary
The web application deploys to Vercel as a static Single Page Application (`dist/`). The Baileys WhatsApp client runs as a **separate persistent Node.js background process** (e.g. on Railway, Render, Fly.io, or VPS) and communicates with the web app exclusively via Cloud Firestore. Baileys cannot run continuously on Vercel Functions due to serverless execution limits, lack of persistent writable disk for auth state, and WhatsApp's requirement for a continuous keep-alive socket. See [Section F of the Architecture Document](docs/architecture/HANUJAI_ERP_SYSTEM_ARCHITECTURE.md#section-f--whatsapp--websocket-architecture) for the full technical evaluation.
