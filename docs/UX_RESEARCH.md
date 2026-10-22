# HanuJai High School ERP — UX Research & Simplification Guide

## 1. Executive Research Summary

This document establishes the user experience foundation for simplifying the HanuJai School ERP. School staff (principals, teachers, and office administrative clerks) are domain professionals, not software engineers or data analysts. Their daily software interactions occur in high-pressure, time-constrained school environments where clutter, technical jargon, and multi-step cognitive overhead directly disrupt administrative and pedagogical work.

---

## 2. Core Research Principles & Practical Application

### Principle 1: Progressive Disclosure & Information Density
- **Authority / Source**: [Nielsen Norman Group (NN/g) — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- **Core Finding**: Present only the vital information initially required for immediate decision-making. Defer secondary details, exhaustive histories, and complex configuration options behind purposeful, deliberate interactions.
- **Application to HanuJai ERP**:
  - The Principal Dashboard previously displayed every section's attendance, examination status, raw audit logs, and complex risk cards simultaneously. We reduce this to **four vital daily numbers** and **two compact supporting lists** (attendance by class and students needing attention).
  - Student profiles will show three high-priority summary sections (Attendance, Marks, and Notes). Detailed audit logs, historical disciplinary records, and extended guardian data move into secondary views.

### Principle 2: Plain Language & Mental Models
- **Authority / Source**: [GOV.UK Service Manual — Writing for user interfaces](https://www.gov.uk/service-manual/design/writing-for-user-interfaces) & [Plain Language Association International (PLAIN)](https://plainlanguagenetwork.org/)
- **Core Finding**: Use simple, familiar, everyday words that match users' real-world vocabulary. Technical terms (such as "provisioning", "persistence", "operational telemetry", "risk watchlists") increase cognitive friction and lead to user uncertainty.
- **Application to HanuJai ERP**:
  - *"Operational Hub"* → **Home**
  - *"Risk Indicators / Watchlist"* → **Students Needing Attention**
  - *"Consolidated Assessment Matrix"* → **Class Marks & Results**
  - *"Attendance Muster"* → **Daily Attendance**
  - *"Dual-Custody Logged"* → **Principal Approved**
  - *"Data Synchronization Failed"* → **Couldn't save changes. Please try again.**
  - *"No records returned"* → **No students found.**

### Principle 3: Role-Specific Task Navigation (Job-to-be-Done)
- **Authority / Source**: [Nielsen Norman Group (NN/g) — Role-Based Dashboards and Portals](https://www.nngroup.com/articles/dashboards-preattentive-processing/)
- **Core Finding**: Different job roles require fundamentally different operational workspaces. Forcing all staff to share a 15-item monolithic sidebar creates disorientation and increases error rates. Top-level navigation should be capped at 4 to 5 core items per role.
- **Application to HanuJai ERP**:
  - **Principal**: Home, Students, Attendance, Results, School Setup.
  - **Office Staff**: Home, Students, Attendance, Results, Reports.
  - **Class Teacher**: My Class, Attendance, Results, Student Notes.
  - **Subject Teacher**: My Classes, Enter Marks, Results, Student Notes.

### Principle 4: Scannable Dashboard Hierarchy (10–15 Second Test)
- **Authority / Source**: [Stephen Few — Information Dashboard Design](https://www.perceptualedge.com/)
- **Core Finding**: An effective executive dashboard must be scannable in 10 to 15 seconds. It must answer three primary questions:
  1. *Where am I?* (Clear page title and session context)
  2. *What do I need to know right now?* (Top-line KPI metric cards with clear labels)
  3. *What action should I take next?* (Clear list of exceptions/issues requiring attention)
- **Application to HanuJai ERP**:
  - Remove empty decorative graphs, redundant attendance percentages, and decorative gauges.
  - Replace them with four clean, compact cards: **Total Students**, **Present Today**, **Absent Today**, and **Students Needing Attention**.
  - Clicking any metric immediately navigates directly to the relevant list (e.g. clicking Absent count shows the list of absent students).

### Principle 5: The "Parent-At-The-Desk" Office Workflow
- **Domain Context**: At school administrative desks, parents frequently arrive unannounced to ask about their child's attendance, recent test results, and general conduct.
- **Core Finding**: The office clerk needs a fast student search bar directly on their home screen. Opening a student profile must immediately display:
  - The student's photo, name, class, and roll number.
  - Total days present vs absent with a simple percentage.
  - Recent subject marks and exam grades.
  - High-level teacher notes.
  - One-click print/export button for the official progress slip.
  - Zero requirement to navigate through separate attendance registers, marks ledgers, and audit tools.

---

## 3. Design System & Palette Specification

To transition from the overly dark green and crowded interface to a calm, institutional, premium aesthetic:

| Token Name | Color Hex | Role in Application |
| :--- | :--- | :--- |
| **Midnight Navy** | `#19243A` | Sidebar, main brand identity, dominant headings, primary structure |
| **Clean White** | `#FFFFFF` | Card backgrounds, table surfaces, input backgrounds |
| **Warm Paper Canvas** | `#F7F6F2` | Page background, calming subtle contrast |
| **Primary Blue** | `#3458D4` | Primary call-to-action buttons, active navigation item, links |
| **Soft Blue-Grey** | `#E9EDF5` | Hover states, secondary action buttons, subtle active tags |
| **Secondary Text** | `#657083` | Subtitles, table headers, metadata, helper text |
| **Subtle Border** | `#E2E5EB` | Clean hairline table and card dividers (1px solid) |
| **Muted Amber** | `#D99A37` | Needs attention, pending review, draft states |
| **Muted Red** | `#B94141` | Absent students, critical errors, rejection actions |

---

## 4. Implementation Checklist
- [x] Document UX principles in `docs/UX_RESEARCH.md`.
- [ ] Transform `src/styles/designSystem.css` to the Navy/White/Warm Paper palette.
- [ ] Simplify `src/components/layout/Sidebar.tsx` to max 5 items per role.
- [ ] Simplify `src/components/layout/Topbar.tsx` to clean, restrained actions.
- [ ] Redesign `PrincipalDashboard.tsx` with 4 compact metric cards, student search, class attendance overview, and attention list.
- [ ] Redesign `OfficeDashboard.tsx` around the quick parent-visit search and report workflows.
- [ ] Redesign `ClassTeacherDashboard.tsx` around the assigned section's daily roll call and performance.
- [ ] Redesign `SubjectTeacherDashboard.tsx` around pending marks entry for assigned subjects.
- [ ] Simplify `StudentDetail.tsx` into a clean 3-part layout (Attendance, Marks, Notes).
- [ ] Audit and rewrite labels across all pages into plain, everyday English.
- [ ] Test responsively across 1440px, 1024px, 768px, and 390px viewports.
- [ ] Capture comprehensive QA screenshots and document in `docs/UI_REVIEW.md`.
- [ ] Run test suite (`npm test`), linter (`npm run lint`), and build (`npm run build`).
