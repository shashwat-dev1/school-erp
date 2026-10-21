# HanuJai High School ERP — Project Brief

## 1. Product Objective & Context

**HanuJai High School**, established in 1998 in Jaipur, Rajasthan, India, requires a dedicated, internal School Enterprise Resource Planning (ERP) platform. The institution operates Grades 1 through 10 with two sections per grade (approximately 1,000 enrolled students).

This application is built from the ground up to replace fragmented manual ledgers and generic software with a single-school operational backbone engineered around the **Restrained Utilitarian Modernism** design philosophy codified in the school's design specification (`Designs/institutional_rigor/DESIGN.md`).

### Absolute Architectural Boundary: Single-School Deployment
This project is **strictly an internal, single-school ERP**:
- **No Multi-Tenancy**: Zero tenant switching, organization registration, or multi-tenant database partitioning.
- **No SaaS Machinery**: No subscriptions, payment gateways, self-service school onboarding, or billing tiers.
- **No Parent/Student Portals in Phase 1**: The initial release is exclusively for internal school faculty and administrative leadership.
- **No Core Rewrite of Upstream Reference**: The previous Gibbon PHP/MySQL repository at `C:\Projects\School\core` serves purely as an isolated, read-only functional reference for legacy school workflows. The new system is built with a modern React + TypeScript + Firebase/Vite architecture.

---

## 2. Primary Users & Role Architecture

The ERP recognizes four operational staff roles, each with strict, server-enforced boundaries:

1. **Principal / School Administrator (`principal`)**
   - Strategic and operational oversight across the entire school campus.
   - Live campus dashboards: total enrolments, daily attendance rates, unexcused absence counters, and CBSE compliance warnings (75% threshold).
   - School-wide student follow-up watchlist and explainable student care registry.
   - Dual-custody authorization for retrospective attendance and assessment grade modifications.
   - Academic cycle management, class teacher allocations, and immutable audit log inspection.

2. **Office Administration (`office_admin`)**
   - Student admissions, enrollments, master record maintenance, and transfer documentation.
   - Staff directory maintenance and basic academic session setup.
   - Verification of enrollment collision states and document archiving.

3. **Class Teachers (`class_teacher`)**
   - Scoped strictly to their assigned class and section (e.g., Class 10-A).
   - Daily morning roll call (Present, Absent, Late, Excused) enforced by a server-side marking window (e.g., 07:45 AM – 09:15 AM IST).
   - Consolidated cross-subject performance tracking for their specific section.
   - Section student follow-up lists and initiating late-attendance correction requests.

4. **Subject Teachers (`subject_teacher`)**
   - Scoped strictly to assigned subjects and assigned class sections (e.g., Class 10-A Mathematics).
   - Marks entry for configured examination cycles (Unit Test 1, Unit Test 2, Half-Yearly, Annual Examination).
   - Subject-level grade validation and performance analytics.
   - Hard server-side security prevents subject teachers from viewing or mutating unauthorized subjects' records.

---

## 3. Technology Stack & Key Decisions

| Tier | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18 / TypeScript / Vite** | Instant HMR development, compile-time type safety across complex school domains, and fast static bundle generation. |
| **Routing** | **React Router v6** | Declarative nested routing, role-based route guards, and clean deep linking. |
| **Design System** | **Vanilla CSS + CSS Variables** | Faithful implementation of `Designs/institutional_rigor/DESIGN.md`. Eliminates runtime CSS frameworks, supports tabular figures (`tnum`), 4px/8px incremental grid, and crisp institutional styling. |
| **Icons** | **Lucide React** | Consistent, restrained outline icons conforming to the utilitarian aesthetic. |
| **Authentication** | **Firebase Authentication** | Secure staff email/password authentication, session management, and custom token claims for role resolution. |
| **Database** | **Cloud Firestore** | Document-based schema with real-time capabilities and fine-grained, deny-by-default security rules (`firestore.rules`). |
| **Asset Storage** | **Firebase Storage** | Only where required for approved document workflows (e.g., admission documents, medical certificates). |
| **Deployment** | **Vercel** | Edge-optimized static asset delivery, zero-server maintenance, and automated preview branch builds. |
| **Testing** | **Vitest + React Testing Library** | Lightning-fast unit and component testing verifying role-based access, domain validations, and UI state rendering. |

---

## 4. Dual-Data Mode Architecture

To support local evaluation, presentation, and automated testing without demanding active cloud credentials on day one, the application features an explicit dual-data mode:

### A. Demo Mode (`VITE_DATA_MODE=demo`)
- Powered by a deterministic, synthetic dataset mirroring a 1,000-student school (Classes 1–10, Sections A & B).
- Mutations are persisted locally in `localStorage` for the current browser session.
- Features a persistent, non-intrusive **"Demo Mode — Sample Data"** indicator pill in the application topbar.
- Provides a 1-click **"Reset Sample Data"** action to return the workspace to its deterministic baseline.
- Never simulates cloud connectivity or masks synchronization failures.

### B. Firebase Mode (`VITE_DATA_MODE=firebase`)
- Connects directly to Cloud Firestore and Firebase Authentication using environment variables.
- Requires explicit configuration in `.env.local`.
- If credentials or security rules deny access, explicit error banners are shown; the app **never silently falls back to demo data**.

---

## 5. Prototype Objectives & Scope Limitations

### Objectives of Phase 1
1. Clean repository structure with zero legacy PHP, MySQL, or Docker dependencies.
2. Complete documentation covering the project brief, design inventory, system architecture, and security rules.
3. Production-buildable React + TypeScript + Vite project matching the Institutional Rigor design tokens.
4. Comprehensive shared component library (app shell, sidebar, topbar, tables, forms, status badges, modals).
5. Robust domain models covering all 12 core school operational entities.
6. Centralized Firebase configuration module and local demo data repository with full reset capabilities.
7. Passing automated test suite and clean Vercel deployment readiness.

### Exclusions & Phase 2+ Scope
- Phase 1 does not implement all 48 screens in one go; it builds the reusable component foundations, application shell, authentication workflow, and operational dashboard.
- Parent and student self-service accounts are reserved for future phases.
- Real production student PII is strictly forbidden; all seed data is synthetic.
