# HanuJai High School ERP — iPhone & Mobile Responsive UI/UX Audit

**Document Reference:** `HHS-MOB-2026-V1`  
**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Scope:** Mobile Safari Ergonomics, Responsive Viewport Audit, Touch Targets, iOS Safe Area Insets  
**Classification:** Institutional Design Engineering Standard  
**Last Updated:** November 16, 2026  

---

## 1. Executive Summary & Defect Remediation

A focused mobile UI/UX engineering audit was performed to address layout defects identified in live production on iPhone Safari (captured in institutional incident report `media_1794776067832_3e7e7770.jpg`).

### Core Findings & Defects Remediated:
1. **Password Label & Hint Collision (Resolved):** In mobile viewports <= 390px, the `Password` label and `Default: demo-password` code hint collided due to a rigid flex container lacking wrapping rules and whitespace boundaries.
2. **Missing Developer Quick Sign-In (Resolved):** The Demo Quick Sign In card list displayed only Principal and Admin Office personas, omitting the newly promoted Developer root persona.
3. **Viewport Unit Stuttering on iOS Safari (Resolved):** Standard `100vh` caused vertical jumpiness and clipping behind Safari's dynamic bottom address and tab bar.
4. **Touch Target Sizing & Spacing (Hardened):** All interactive buttons, segmented filters, and attendance toggles calibrated to >= 44px × 44px conforming to Apple Human Interface Guidelines.
5. **Form Auto-Zoom Prevention (Hardened):** All input font sizes set to a minimum of 16px to prevent iOS Safari from automatically zooming into the page on field focus.

---

## 2. Detailed Viewport Analysis & Verification

### 2.1 Viewport 1: iPhone SE (375px × 667px)
- **Characteristics:** Narrowest supported modern smartphone viewport.
- **Audit Findings:**
  - Login Card margins reduced from `40px` to `20px` to provide comfortable typing width.
  - Student Directory table wrapped in `.hhs-table-container` with `-webkit-overflow-scrolling: touch` ensuring smooth lateral panning.
  - Daily Attendance Register roster item padding optimized (`10px 12px`) preventing horizontal truncation of student full names.
- **Verification Status:** **PASS (Clean layout, zero overflow)**

### 2.2 Viewport 2: iPhone 13 / 14 / 15 Standard (390px × 844px)
- **Characteristics:** Primary target viewport representing the majority of staff mobile devices.
- **Audit Findings:**
  - In `src/pages/auth/StaffLogin.tsx`:
    ```tsx
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
      <label className="hhs-label" htmlFor="staff-password" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
        Password
      </label>
      <span style={{ fontSize: '0.72rem', color: '#64748B', whiteSpace: 'nowrap' }}>
        Default: <code>demo-password</code>
      </span>
    </div>
    ```
    This explicit flex-wrap with `gap: 6px` and `whiteSpace: nowrap` completely eliminates the label collision observed in the user screenshot.
  - Added Developer Quick Sign In card with root persona details: "System Administrator (Developer)".
- **Verification Status:** **PASS (Defect eliminated, flawless visual hierarchy)**

### 2.3 Viewport 3: iPhone 15 / 16 Pro Max (430px × 932px)
- **Characteristics:** Large-screen smartphone with Dynamic Island.
- **Audit Findings:**
  - Full support for `100dvh` ensures the authentication card and application shell dynamically adapt as Safari's bottom toolbar collapses on scroll.
  - Safe area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) applied to fixed headers and sticky bottom action bars.
- **Verification Status:** **PASS (Optimal reading and touch zones)**

---

## 3. Apple Human Interface Guidelines (HIG) Compliance Matrix

| Apple HIG Requirement | Guideline Specification | HanuJai ERP Implementation | Compliance Status |
| :--- | :--- | :--- | :---: |
| **Touch Target Size** | Minimum 44pt × 44pt clickable area | Buttons: 44px - 48px height; inputs: 44px min-height; attendance toggles: 44px | **COMPLIANT** |
| **Input Font Sizing** | Text inputs >= 16px to prevent zoom | All `.hhs-input`, `.hhs-select` configured with `font-size: 16px` on mobile | **COMPLIANT** |
| **Dynamic Viewports** | Adapt to collapsible browser bars | `min-height: 100dvh` applied to `.hhs-main-canvas` and `.hhs-login-canvas` | **COMPLIANT** |
| **Safe Area Insets** | Keep content clear of notches & home bar | `padding-bottom: max(20px, env(safe-area-inset-bottom))` on sticky footers | **COMPLIANT** |
| **Tap Highlight Color** | Clean touch visual feedback | `-webkit-tap-highlight-color: transparent` across all interactive elements | **COMPLIANT** |
| **Momentum Scrolling** | Smooth native touch physics | `-webkit-overflow-scrolling: touch` on all table containers | **COMPLIANT** |

---

## 4. Key Pages Responsive Audit Breakdown

### 4.1 Staff Authentication Screen (`/login`)
- Clean vertical stack on mobile.
- Demo Quick Sign In cards render 3 distinct roles:
  1. Principal (`Dr. Vikramaditya Sharma`)
  2. Admin Office (`Admin Office`)
  3. System Administrator (`Developer`)
- Password visibility toggle has a 44px touch target.
- Zero horizontal scrollbar on body.

### 4.2 Student Master Directory (`/students`)
- Search bar and class select stack vertically on viewports < 600px.
- Segmented compliance control (`All Students` vs `< 75% Attendance`) smoothly scrolls horizontally without clipping.
- Student table scrolls horizontally within container; page headers remain fixed.
- Prominent "Import Data" button wraps cleanly into secondary action bar.

### 4.3 Daily Attendance Register (`/attendance/register`)
- Attendance status badges (`Present`, `Absent`) provide large thumb-friendly tap targets.
- Student admission ID and roll number rendered with tabular numbers (`font-variant-numeric: tabular-nums`).
- Sticky bottom summary bar displays live Present and Absent counts above the iOS home indicator bar.

### 4.4 Parent Document Upload Gateway (`/parent/upload`)
- Clean mobile-first single-column card layout.
- Clear file picker trigger with instant thumbnail/filename preview.
- Progress indicator shows percentage and upload duration.
- Success confirmation banner provides clear feedback that documents have been received by the school office.

### 4.5 Developer Console (`/developer`)
- Horizontal scrolling navigation bar with active tab indicator.
- Interactive Swagger UI and Firestore Data Dictionary formatted with horizontal overflow containers for tables and JSON previews.

