# HanuJai ERP — Complete ZIP Audit

**Artifact reviewed:** `school-erp-main.zip`  
**Archive size:** approximately 23 MB  
**Archive inventory:** 267 ZIP entries (182 files plus directory entries); approximately 25.93 MB uncompressed  
**Project:** React + TypeScript + Vite, Firebase Auth/Firestore/Storage, Vercel  
**Review focus:** What has been created, folder-by-folder/file-by-file inventory, actual role/business logic, Firebase readiness, Stitch coverage, prototype quality, and the corrective implementation direction.

## 1. Executive verdict

This is a substantive prototype foundation, not just a set of screenshots. It contains a React app, a shared component layer, a data-provider abstraction, local demo persistence, a Firestore repository, Firestore/Storage rules, ten UI-oriented smoke tests, documentation, and 48 exported Stitch designs.

It is **not yet a reliable role-aware school ERP prototype**. The application currently lets different staff roles reach a largely shared operational experience, several screens expose data outside the role's natural scope, many displayed metrics are hard-coded, the sample data is internally inconsistent, and the Firebase implementation/rules are incomplete or mismatched in important places. The ZIP does not include `.git`, `node_modules`, or Firebase project state, so this archive cannot prove GitHub commit history, deployed status, or a successful build.

The right next move is not a visual rewrite. It is a domain/authorization correction pass, followed by dashboard and screen refinements, then automated role-matrix tests and visual verification.

## 2. Archive inventory

| Area | Contents | What it is for | Audit result |
|---|---|---|---|
| `Designs/` | 48 screen folders; each includes `code.html` and `screen.png`; one `institutional_rigor/DESIGN.md` | Stitch visual references and design rules | Useful design source; individual screens are not production React components. |
| `docs/` | `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DESIGN_INVENTORY.md`, `SCREEN_ROUTE_MAP.md`, `SECURITY.md` | Intended requirements, architecture, screen mapping and security model | Useful direction, but multiple claims do not match implementation. |
| `src/components/` | Auth guard, shell, navigation, feedback states, table and common controls | Reusable UI components | Good start; route and data scope decisions are still scattered. |
| `src/pages/` | Login, students, attendance, academic, administration, behaviour, reports, risk, audit and settings screens | Actual React screen implementation | Many flows exist, but multiple screens use all-role data or hard-coded assignments. |
| `src/data/` | `DataProvider`, demo repository/seeds, Firestore repository | Unifies local demo and cloud persistence | Good abstraction idea; the methods do not consistently enforce actor-specific scope and Firebase methods are partial. |
| `src/domain/` | `types.ts` | TypeScript school entities | Domain contains aliases and fixed policy assumptions that need normalization. |
| `src/context/` | `AuthContext.tsx`, `DataContext.tsx` | Global user/data mode state | Supports demo and Firebase modes; demo login and role-scoping need correction. |
| `src/config/` | `firebase.ts` | Firebase initialization and mode switch | Centralized configuration; Firebase mode requires actual setup and seed/provisioning. |
| `src/styles/` | `designSystem.css` | Design tokens and shared styles | Visual tokens are consistent with the Stitch design direction, but responsive breakpoints are largely absent. |
| Root configuration | Vite, TypeScript, ESLint, Vitest, Vercel, Firebase rules, package manifest and environment example | Development, test and deploy setup | Appropriate stack; rules and documentation overstate actual readiness. |

The ZIP contains 182 files: 48 design PNGs, 48 design HTML exports, one `DESIGN.md`, 56 `.tsx` files, 11 `.ts` files, five JSON files, six Markdown files including design documentation, two rules files, one JS config, one CSS file, one SVG logo, and `.env.example`. (The exact file extension grouping depends on whether root config files are counted with application source.)

## 3. Architecture as actually implemented

### Runtime/data flow

1. `src/main.tsx` mounts React providers and the router.
2. `src/App.tsx` defines React Router routes and wraps the application shell in `RoleGuard`.
3. `src/components/layout/AppShell.tsx` displays the fixed sidebar, topbar, routed page body and fixed institutional footer.
4. `src/context/AuthContext.tsx` provides current user, login/logout, and demo role switching.
5. `src/context/DataContext.tsx` selects a data provider.
6. `src/data/index.ts` chooses either `demoRepository` or `firestoreRepository` based on `VITE_DATA_MODE`.
7. `src/data/provider.ts` defines a broad school-domain interface.
8. Each page calls provider methods directly and builds its own UI state.
9. In Firebase mode, Firestore Security Rules become the true data boundary; in demo mode, browser `localStorage` provides convenience/presentation persistence only.

The separation between React pages and the data provider is directionally good. However, most read methods take filters but not an explicit authorization scope, and the demo repository returns whole-school datasets for many methods. Several pages also perform business logic directly inside large components. As a result, role policy is not a single coherent decision system.

## 4. High-priority findings

### P0 — Role-specific dashboards and scope are materially wrong

**Evidence:** `src/App.tsx` routes `/` to `OperationsHub` for every role. `src/pages/dashboard/OperationsHub.tsx` reads current role to change the title and one or two action labels, but loads `getClasses()`, `getStudents({ limit: 100})`, and `getAuditEvents({ limit: 8})` with no current-user scope. It then shows the same overall sections table, care flags and audit ledger to all users. Only the heading and a top action vary by role.

The hub also displays hard-coded metrics such as `96.8%`, `18 / 20`, a fallback `780` enrolment figure, an always-active roll-call window, simulated section completion (`idx !== 1 && idx !== 5`), and fixed 07:45–09:15 timings. It does not calculate those KPIs from the selected date's attendance sessions. The effect depends on `provider`, not `currentUser`, so switching personas does not reload a scoped dashboard.

**Impact:** A Class 10-A teacher can be shown school-wide sections, care flags and event history. A subject teacher sees a principal-style school operations dashboard. The experience is not aligned to how the jobs function.

### P0 — Route guard coverage is incomplete

Only the main shell is wrapped in an authentication `RoleGuard`; a subset of admin/settings/audit routes adds role restrictions. Routes such as `/students`, `/students/:id`, `/attendance`, `/attendance/register/:classId`, `/attendance/corrections`, `/classes`, `/assessments`, `/academics/marks/:assessmentId`, `/performance/classes/:classId`, `/risk-watchlist`, `/behaviour`, `/reports`, report cards and `/admin/roles` have no route-level role/assignment guard in `App.tsx`.

The sidebar hiding items is not enough. A user can type a URL directly. Some Firebase rules may reject a request, but demo mode uses the local repository, so it can still expose other records in the presentation prototype.

### P0 — Demo repository is not scope-aware

`src/data/provider.ts` does not consistently pass an authenticated scope into read methods. `DemoRepository.getClasses()` and `getStudents()` return school-wide data unless a filter is passed by the page. `getStudentById()` returns a record solely by ID. `getConsolidatedClassMarks()` and `getRiskWatchlist()` similarly operate over requested or whole-school data without verifying that the current actor is entitled to the record. This makes role differences largely cosmetic in demo mode.

### P0 — Firebase rules are weaker or inconsistent with the documented security model

`firestore.rules` begins with deny-all, but subsequent rules grant overly broad permissions or have fields that do not match application models:

- `/students/{studentId}` is readable by every authenticated staff account, without assignment-based limits.
- `/staff/{staffId}` is readable by every authenticated staff account.
- `/classes/{classId}` and `/academicYears/{yearId}` are readable by all authenticated accounts.
- No explicit match rules exist for `/subjects/{subjectId}` or `/subjectAssignments/{assignmentId}`, even though the Firestore repository reads both collections. With the global deny rule, those operations will be denied until rules are added.
- The attendance-correction rule checks `resource.data.requestedBy`, but the TypeScript model/repository use `requestedByStaffId`; the requesting teacher may therefore not be able to read their own request under the intended rule.
- Attendance-window rules compare `request.time` (a timestamp) to `request.resource.data.windowStart`/`windowEnd`, while the application stores values such as `'07:45'` and `'09:15'` as strings. These are not compatible comparison types and do not constitute valid time-window enforcement.
- The attendance create rule trusts the incoming document's window boundaries rather than comparing against an authoritative policy.
- The mark-register rule blocks only a status equal to `'final_locked'`; the domain type uses `'verified_locked'` and `'finalized'`, so the status policy is out of sync.
- Incident creation is allowed for any authenticated user without checking a class/subject assignment.
- Audit events can be created by any authenticated client with client-provided actor data. They are append-only by update/delete rule, but not trustworthy if the client can forge actor/summary fields.
- Storage rules let any authenticated user read and write files under any student's path (subject only to basic file type/size rules); they do not check role or student assignment.

Do not declare these security guarantees valid until they are corrected and tested against Firebase Emulator or equivalent rules tests. For production-grade audit and time enforcement, some operations may need a trusted server-side function rather than trusting the browser.

### P1 — Seed data conflicts with the stated school model

`docs/PROJECT_BRIEF.md` says 10 classes × two sections and a deterministic 1,000-student synthetic dataset. Actual `src/data/demo/seedData.ts` has 12 class-section records only for grades 5–10 and 13 explicit student records (11 in 10-A and two in 10-B). Yet the section metadata reports around 37–40 students per section. Metrics based on actual records will not match section headcounts; the dashboard compensates with separate fabricated numbers.

Teacher assignments are also inconsistent: class sections are assigned to people whose role or `assignedClassId` does not match the class-teacher assignment. One staff member is a class teacher for several sections in `initialClasses` while their profile has only `class-10-a`; some sections list the subject teacher, office admin or principal as class teacher. The seed subject identifiers also conflict with hard-coded page defaults, e.g. `sub-math-10` versus `subj-math`.

### P1 — Several operations are partially implemented or hard-coded in Firebase mode

`src/data/firebase/firestoreRepository.ts` contains incomplete mapping and filtering:

- `getStudents()` implements a basic Firestore fetch and ignores search, status, page and page-size filters; it returns all fetched docs as one page.
- `submitDailyAttendance()` stores student IDs as student names, uses roll number `0`, copies the class ID into class label, hard-codes the marking window and sets `isWindowOpen: true` regardless of actual time.
- `requestAttendanceCorrection()` hard-codes `class-10-a`, `Class 10-A` and the current date rather than deriving class/date from the actual session/student.
- `saveMarksRegister()` hard-codes max marks `100`, pass marks `33`, and stores subject/class/assessment IDs as display labels; it does not append the corresponding audit event.
- `getConsolidatedClassMarks()` returns an empty `matrix` and `subjectAverages`, so it is not a real consolidated report in Firebase mode.
- `getRiskWatchlist()` returns `consecutiveAbsences: 0` and `academicDropPercent: 0` for every item rather than calculating the rules from records.
- `createStudent()` hard-codes academic year, class label fallback, city, state and postcode; it has no demonstrated transaction covering duplicate admission check and create.
- `createStaffMember()` creates a Firestore staff document but does not create/link a Firebase Authentication account; its generated document ID is not necessarily the authenticated UID used by `getCurrentStaffUser()`.
- `updateAttendancePolicy()` replaces the full `attendancePolicy` map with the partial object passed by the UI, potentially dropping settings not included in that update.
- multiple mutations are performed with separate writes and audit writes, so a partial failure can leave state changed without an audit entry.

These are significant if Firebase mode is intended for actual demonstration. Demo mode may cover interactions that aren't yet viable in Firebase mode, but it must show that it is demo mode.

### P1 — Login/demo behavior is too permissive and misleading

`src/context/AuthContext.tsx` accepts a known demo email without validating the password; when an unrecognized email is entered, it silently falls back to the first staff user (the principal). `src/pages/auth/StaffLogin.tsx` pre-populates the principal email and a demo password even though that screen may be used in Firebase mode. Demo persona controls are useful for a pitch, but the login must never silently turn an invalid identity into Principal. In Firebase mode, missing config leaves `auth` null; the login handler has no explicit user-facing branch for that case.

### P1 — Design/layout responsiveness needs a true pass

`src/styles/designSystem.css` has the shared token/component styles but only one `@media` block for print; it has essentially no responsive breakpoints. `AppShell.tsx` reserves a fixed 240px sidebar/margin and uses desktop-oriented content padding. Many screens implement wide tables, multiple columns, fixed inline sizing and long information panels. The design export contact sheets also show many screens with high information density and some exported mobile login material with a large black region next to the mobile layout.

The implementation should be tested at 1440×900, 1024×768, 768×1024, 390×844 and 360×800, with no overlap, clipped actions or body-level horizontal overflow. Don't simply reproduce any defects seen in `screen.png`.

### P1 — Unverified institutional rules have been over-specified

The implementation embeds CBSE identity, affiliation numbers, rule references, 75% thresholds, precise attendance times, grace periods, “zero-period” classes and statutory language throughout UI, seed data and reports. Values conflict: the seed settings use an affiliation string ending `1730198`, other UI/report screens show `1730249`, and other places show no central config. These assumptions are not proven by the ZIP. Keep board/affiliation and school policies configurable and label sample values as demo values until verified by school administration.

### P2 — Documentation and test coverage do not match the source

- `docs/SCREEN_ROUTE_MAP.md` and `docs/DESIGN_INVENTORY.md` refer to files presented as separate components that do not exist as separate files, including `src/pages/academics/AssessmentConfigModal.tsx`, `src/pages/attendance/AttendanceSummaryModal.tsx`, and several student modal files. Some behavior exists inline in larger pages, but the documentation says the components exist separately.
- The map advertises routes/states that are not separate routes in `src/App.tsx`; some are modals/tabs, which is fine if accurately documented. Example: student enrollment and editing are modals inside `StudentDirectory`/`StudentDetail`, not their own routes. The attendance submission summary is a modal in `DailyAttendanceRegister`. A distinct class-teacher and subject-teacher home screen is absent; both roles use `OperationsHub`.
- `src/test/App.test.tsx` has 10 UI-render smoke tests, but it lacks meaningful role-matrix assertions across every protected route, assigned class/subject data isolation, correction approval flows, dashboard KPI calculation and Firestore rules tests. Its “unauthorized routes” test checks an unknown route/404, not a protected route denied to a real staff role.
- There is no root `README.md` in the archive, despite good internal docs.
- The docs claim cryptographic token claims are enforced, but actual rules use `getUserData()` from `staff/{uid}` fields; there is no shown custom-claims implementation.

### Verification limitation

I inspected the source statically. I could not confirm a fresh production build/test pass in this review environment because the ZIP does not include `node_modules`; `npm ci --offline` fails because a required package is not cached (`ENOTCACHED`), and the network install attempt did not complete in the review session. This is **not** evidence that the project's build fails; it means build/test status remains unverified from this archive review.

## 5. Role model the application should implement

These rules follow the school workflow described by the user, with conservative defaults for sensitive data. Antigravity should check the actual code and may refine the policy where a better operational interpretation is justified; it must explain the rationale and implement one consistent policy everywhere.

| Capability | Principal | Office Admin | Class Teacher | Subject Teacher |
|---|---|---|---|---|
| School-wide overview | Yes | Operational overview only | No | No |
| Student directory | All students | All students for office duties | Assigned section only | Students in assigned subject/class assignments only, minimal fields |
| Full student profile | All authorized fields | Operational/enrollment fields; report access if needed for school office | Students in assigned section; academic/class context | Minimal academic context for assigned subject; no broad guardian/address/medical view by default |
| Attendance dashboard | All sections | School-wide counts/status | Own assigned section only | No class-wide attendance register; at most relevant attendance summary if justified |
| Mark attendance | Override/authorized administration only if defined | No routine teacher marking | Assigned section only, within configured window | No |
| Submit attendance correction | Review/manage | Operational visibility as configured, not automatic approval | Request correction for assigned section | No |
| Approve own/other correction | Approve; never self-approve the original change | Only if explicitly delegated; default no | Never approve own request | No |
| Marks entry | Oversight/controlled correction | View/report, no subject marks editing by default | View consolidated marks for assigned section; no subject entry unless separately assigned | Enter marks only for each assigned `(classSection, subject, academicYear)` pair |
| View other subjects' marks | Yes, authorized | School report view as explicitly allowed | Yes, for own assigned section | No, unless separately assigned to that subject/class |
| Behaviour records | School-wide authorized records | Sensitive detail restricted by default | Assigned section and permitted records | Create/view only permitted notes for assigned students; confidential behaviour details restricted by default |
| Risk watchlist | School-wide | Operational summaries where useful; sensitive details restricted | Assigned-section students only | No school-wide or cross-subject risk list; relevant subject follow-up only |
| Staff and assignments | Manage | Operational staff lookup; assignment changes only if delegated | Own profile/assignment only | Own profile/assignments only |
| Academic and attendance policies | Manage | View, not change, unless delegated | No | No |
| Audit log | School-wide sensitive audit access | Restricted/operational history only | Own actions or own-section relevant history | Own actions/own subject history only |

Important: Office Admin should be able to search the school-wide student records and open appropriate student performance reports for parent/office enquiries, as the original requirement specified. That does **not** imply permission to edit marks, change teacher assignments, approve attendance corrections or read every confidential disciplinary note.

## 6. Folder/file inventory

### Root files

| Path | Purpose | Notes |
|---|---|---|
| `.env.example` | Documents data mode and Firebase client settings | Demo mode is default; values are intentionally blank. |
| `.gitignore` | Excludes dependencies, build output, env files, Firebase caches and test artifacts | Appropriate base; check no real secrets are committed. |
| `package.json` | Declares the React/Vite/Firebase app, build/lint/test scripts and dependencies | Stack is suitable for the intended Vercel/Firebase pilot. |
| `package-lock.json` | Locks npm dependency graph | Standard dependency lockfile. |
| `index.html` | Vite HTML entry shell/title/metadata | Must be consistent with product title and should not claim unverified school status. |
| `eslint.config.js` | ESLint flat config | Lint setup. |
| `vite.config.ts` | React plugin, dev host/port, output folder and manual chunks | Build config; currently enables source maps in `dist`, which should be reviewed before a public pilot. |
| `vitest.config.ts` | Vitest + jsdom setup | Test runner config. |
| `tsconfig.json` | Main TypeScript compiler configuration | Build type checking. |
| `tsconfig.node.json` | TypeScript config for Node/Vite config | Build tooling types. |
| `firestore.rules` | Firestore document authorization rules | Has gaps/mismatches listed above. |
| `storage.rules` | Firebase Storage access rules | Too broad for student files; needs role/record scope. |
| `vercel.json` | Static build settings, SPA rewrite, asset cache headers | Appropriate basis for Vite SPA deployment. |
| `src/vite-env.d.ts` | Vite/client type environment declarations | TypeScript environment support. |
| `src/main.tsx` | React entry point and providers | App bootstrapping. |
| `src/App.tsx` | Route tree | Authenticated shell exists; route-level authorization is incomplete. |
| `src/assets/logo.svg` | Current school/product logo graphic | Synthetic/prototype asset; verify school mark before representing it as official. |

### Documentation files

| Path | Intended purpose | Audit notes |
|---|---|---|
| `docs/PROJECT_BRIEF.md` | School scope, roles, stack, prototype goals | Helpful requirements source, but its “1,000-student seed” claim does not match the 13 explicit student seed records. It also embeds unverified CBSE assumptions. |
| `docs/ARCHITECTURE.md` | Application architecture and data flow | Good conceptual overview; actual role/data provider behavior does not meet the claimed scope in several places. |
| `docs/DESIGN_INVENTORY.md` | Design-by-design intent, roles and implementation notes | Useful, but includes unverified statutory assumptions and paths/claims that don't match actual implementation. |
| `docs/SCREEN_ROUTE_MAP.md` | Stitch designs mapped to routes/components | Must be synchronized to actual paths/routes; several modal file references aren't separate files. |
| `docs/SECURITY.md` | Threat model and intended role rules | Treat as a target specification, not proof; actual `firestore.rules` do not yet meet several stated guarantees. |
| `Designs/institutional_rigor/DESIGN.md` | Shared typography, colour, spacing and UI rules from Stitch | Keep as the visual reference; fix the screens' layout defects rather than copying them literally. |

### Source: application shell, shared components, state and domain

| Path | What it creates |
|---|---|
| `src/components/auth/RoleGuard.tsx` | Checks login state and optional role list before rendering route children. It does not independently check class/subject assignments. |
| `src/components/layout/AppShell.tsx` | Fixed sidebar, topbar, central page area and footer. Desktop-first layout has no full responsive sidebar strategy. |
| `src/components/layout/Sidebar.tsx` | Role-conditional navigation. Hard-codes Class 10-A URLs/labels; several menu items do not match actual data scope. |
| `src/components/layout/Topbar.tsx` | Session display, demo-mode badge/reset, demo role switcher and user menu. Role options are tied to one Class 10-A teacher and one Mathematics teacher. |
| `src/components/layout/PageHeader.tsx` | Reusable title, subtitle, breadcrumbs, role-scope label and actions. |
| `src/components/tables/DataTable.tsx` | Generic table component and table behavior. Validate pagination/sorting semantics are actually applied consistently by consumers. |
| `src/components/ui/Button.tsx` | Reusable button UI. |
| `src/components/ui/Drawer.tsx` | Slide-over details/evidence drawer. |
| `src/components/ui/FormControls.tsx` | Shared form controls. |
| `src/components/ui/MetricCard.tsx` | Compact KPI/metric display. |
| `src/components/ui/Modal.tsx` | Shared modal/dialog. |
| `src/components/ui/StatusBadge.tsx` | Shared status styling. |
| `src/components/ui/Tabs.tsx` | Shared tab navigation. |
| `src/components/feedback/EmptyState.tsx` | Empty-data view. |
| `src/components/feedback/ErrorBanner.tsx` | Error feedback. |
| `src/components/feedback/LoadingState.tsx` | Loading feedback. |
| `src/context/AuthContext.tsx` | Holds user/session state and demo/Firebase sign-in paths. Demo login silently falls back to Principal for unknown email. |
| `src/context/DataContext.tsx` | Makes selected provider, data mode and reset action available to screens. |
| `src/config/firebase.ts` | Initializes Firebase client services and selects demo or Firebase mode. Missing Firebase config is logged but requires a clearer user-facing failure. |
| `src/domain/types.ts` | Types for staff, school settings, academic years, classes, subjects, students, attendance, assessment, marks, incidents, risk and audit. Contains alias fields and fixed-policy assumptions. |
| `src/styles/designSystem.css` | Pine/warm-white visual tokens and base component styling. Only `@media print` was found; responsive behavior must be added. |

### Source: data providers and seed repositories

| Path | What it creates | Audit notes |
|---|---|---|
| `src/data/provider.ts` | Typed `DataProvider` interface for school operations | Good abstraction; many read methods lack explicit scope context, letting implementation/page behavior determine visibility. |
| `src/data/index.ts` | Chooses demo or Firestore provider | Clean mode switch; don't permit silent fallback on Firebase failures. |
| `src/data/demo/seedData.ts` | Synthetic school/staff/class/student/attendance/marks/incident/audit data | Not a 1,000-student coherent seed: 12 sections and 13 explicit student records; class counts and assignments do not match those records. |
| `src/data/demo/demoRepository.ts` | LocalStorage-backed mutations and queries for demo mode | Core mutations/persistence are implemented, but reads are generally not actor-scoped; multiple hard-coded IDs/times; fake `clientIp`; not a security boundary. |
| `src/data/firebase/firestoreRepository.ts` | Firestore-backed methods implementing the same provider | Several operations are placeholder/incomplete as detailed in P1 findings; rules need to align with the repository. |

### Source: domain pages

| Path | Intended function | Important observation |
|---|---|---|
| `src/pages/auth/StaffLogin.tsx` | Staff login and demo persona selection | Defaults to principal-like credentials; the demo fallback can grant Principal for unrecognized email. |
| `src/pages/dashboard/OperationsHub.tsx` | Current dashboard/operations hub | Shared across all four roles; currentUser changes title/actions but not fetched data scope; some KPIs are fabricated/hard-coded. Primary target for redesign. |
| `src/pages/students/StudentDirectory.tsx` | Student search, filters, student summary and enroll modal | Fetches a broad list; needs role-aware roster scope. Enrollment modal is inline. |
| `src/pages/students/StudentDetail.tsx` | Student profile tabs, academic/attendance/behaviour/history and edit modal | Fetch is by student ID; access to full details must be scoped to role/assignment. Edit modal is inline. |
| `src/pages/attendance/AttendanceDashboard.tsx` | Daily section attendance overview | Loads all classes and all corrections, then marks an assigned section visually but does not restrict the class list for class teachers. |
| `src/pages/attendance/DailyAttendanceRegister.tsx` | Mark attendance for a class and confirm submission | Has default `class-10-a`, hard-coded academic year/times in parts; route/assignment must be checked at data boundary. |
| `src/pages/attendance/AttendanceCorrections.tsx` | Correction request/approval queue | UI `canApprove` includes office admin, but the stated dual-custody process says Principal counter-authorization; reconcile the policy and Firebase rules. |
| `src/pages/academics/AssessmentList.tsx` | Browse/create assessment cycles; inline configuration modal | Uses role to hide some configuration actions, but route/record access needs a central policy. Some sample labels/cycles are fixed. |
| `src/pages/academics/MarksEntryRegister.tsx` | Editable marks-entry register | Loads all cycles/classes/subjects from provider; defaults to `class-10-a` and inconsistent `subj-math`; Firebase rules must restrict each assignment pair. |
| `src/pages/performance/ClassPerformanceLedger.tsx` | Consolidated subject-wise class performance | Must allow class teachers only for assigned section; subject teachers must not see all subjects' marks. |
| `src/pages/admin/ClassesDirectory.tsx` | Classes and sections directory | Should be administrative for office/principal; class teachers may need only their own section, not admin management of all classes. |
| `src/pages/admin/SectionRoster.tsx` | Student roster for a class/section | Route can be entered directly; needs assignment-level authorization and safe student fields by role. |
| `src/pages/admin/ClassTeacherAssignments.tsx` | Assign class teachers | Administrative configuration; route should be restricted. |
| `src/pages/admin/SubjectFacultyAssignments.tsx` | Assign subjects/classes to teachers | Administrative configuration; assignments must become the source of truth for data scoping. |
| `src/pages/admin/StaffDirectory.tsx` | Staff list/search/role details | Appropriate for administrator/office permission; should not be broadly accessible. |
| `src/pages/admin/StaffAccountModal.tsx` | Staff create/edit modal | Hard-coded `class-10-a` and subject ID examples; Firebase account creation must link Auth UID with staff doc. |
| `src/pages/admin/RolePermissionMatrix.tsx` | Role/permission matrix UI | Route currently has no RoleGuard in `App.tsx`. It claims token-claim enforcement, but source shows roles read from staff document fields. |
| `src/pages/behaviour/BehaviourDirectory.tsx` | Behaviour/incident list | Route is open to every authenticated role in the router; incident rules are broader than desired. |
| `src/pages/behaviour/NewObservationModal.tsx` | Add observation/incident modal | Should limit selectable students and accessible records by teacher assignment and incident visibility. |
| `src/pages/risk/RiskWatchlist.tsx` | School/student risk watchlist and evidence | Route and provider are not scoped to assigned section/subject. Should be principal school-wide, class-teacher assigned-section only, subject teacher excluded from cross-subject risks by default. |
| `src/features/risk/RiskEvidenceDrawer.tsx` | Detailed explanation of a risk flag | Includes hard-coded CBSE and fixed remedial recommendations. Must use configured rules and relevant evidence, not invented policy. |
| `src/pages/reports/ReportsHub.tsx` | Report directory | Contains CBSE-labelled report descriptions; report visibility needs role policy. |
| `src/pages/reports/StudentReportCard.tsx` | Printable individual academic report card | Has synthetic marks and hard-coded affiliation/CBSE status text. Data must be derived from actual selected student/report context. |
| `src/pages/reports/PTMSlip.tsx` | Parent-teacher meeting print summary | Includes hard-coded 07:45 remedial clinic and CBSE claims; content must be data/policy-driven. |
| `src/pages/reports/AttendanceReport.tsx` | Attendance reporting and export | Starts from Class 10-A and fixed threshold/CBSE copy; scope and metrics must be role/date/config aware. |
| `src/pages/reports/AcademicComparisonReport.tsx` | Compare class/subject performance | Contains hard-coded CBSE session labels and needs correct comparison denominators. |
| `src/pages/audit/AuditLogDirectory.tsx` | Searchable school audit log | Must be restricted to Principal and possibly own relevant history for staff; current global event feed is sensitive. |
| `src/pages/audit/AuditDiffModal.tsx` | Inspect before/after record diffs | Ensure data is real change history; no forged or missing events. |
| `src/pages/settings/SystemSettings.tsx` | School identity and system configuration | Contains hard-coded affiliation fallback and sample identity. |
| `src/pages/settings/AcademicYearSettings.tsx` | Configure academic year | Has CBSE copy and assumptions. |
| `src/pages/settings/AssessmentTypeSettings.tsx` | Assessment type/grading scale configuration | CBSE grading scale is hard-coded; should be configurable pending school confirmation. |
| `src/pages/settings/AttendancePolicySettings.tsx` | Attendance marking window and thresholds | Contains sample default values, but UI must mark them as configurable; do not call them confirmed policy. |
| `src/pages/error/AccessDenied.tsx` | Denied-access experience | Exists; must be triggered by role and assignment boundaries on direct URL. |
| `src/pages/error/NotFound.tsx` | Unknown route page | Exists. |
| `src/pages/common/PhasePlaceholder.tsx` | Placeholder for deferred feature | Avoid routing primary pitch workflows to nonfunctional placeholders. |
| `src/test/App.test.tsx` | 10 React smoke tests | Mostly asserts screens/rendered text; no proper role isolation or Firebase rules test suite. |
| `src/test/setup.ts` | Test setup | Shared test initialization. |

### Root config / runtime files

| Path | Purpose | Notes |
|---|---|---|
| `package.json` | App dependencies and scripts | Version set uses React 18, React Router 6, Firebase 11, Vite 5 and Vitest 2; don't upgrade blindly in the same pass as business-logic changes. |
| `package-lock.json` | Reproducible npm resolution | Retain and update only via npm workflow. |
| `index.html` | SPA document shell | Keep titles and metadata accurate. |
| `eslint.config.js` | Lint conventions | Use before completion. |
| `tsconfig.json`, `tsconfig.node.json` | TypeScript compile configs | `npm run build` expects `tsc -b` first. |
| `vite.config.ts` | Vite compile/dev server config | `sourcemap: true` is enabled for production `dist`; review whether that is wanted in a public pilot. |
| `vitest.config.ts` | Vitest setup | Tests are configured for jsdom and React. |
| `.env.example` | Public Firebase client env names and `VITE_DATA_MODE=demo` | Correct to avoid actual secrets, but client Firebase values do not themselves protect data; rules do. |
| `.gitignore` | Excludes `node_modules`, `dist`, env/local and common tooling artifacts | Good base. |
| `vercel.json` | Build `npm run build`, output `dist`, SPA rewrite and asset caching | Appropriate for Vite SPA routing. |
| `firestore.rules` | Firestore authorization policy | Needs correction/tests as above. |
| `storage.rules` | Storage authorization policy | Needs stricter assignment/role checks. |

## 7. Audit of all 48 Stitch screen exports

Each of these design folders contains `code.html` and `screen.png`; `Designs/institutional_rigor/DESIGN.md` is the shared design reference. The HTML exports are not the running application: all 48 exported `code.html` files reference Tailwind via CDN; they also reference Google-hosted fonts, with some using Google-hosted images. Keep them as reference material, not as production pages or an HTML iframe gallery.

| # | Design folder | Intended screen | Current coverage / corrective note |
|---:|---|---|---|
| 1 | `academic_performance_comparison_report` | Cross-class/subject comparison report | Component/route exists as `AcademicComparisonReport`; remove unverified CBSE claims and make comparison values consistent with chosen filters. |
| 2 | `academic_year_management` | Academic-year management | `AcademicYearSettings` exists; settings are still built around one hard-coded session in places. |
| 3 | `access_denied` | Permission-denied screen | `AccessDenied` exists; ensure actual authorization failures route here. |
| 4 | `add_student_new_admission_enrollment_form` | Student enrollment form | Inline modal in `StudentDirectory`; role and class defaults hard-coded. |
| 5 | `assessment_configuration` | Create/edit assessment configuration | Inline modal in `AssessmentList`, not a separate file as docs suggest. |
| 6 | `assessment_list_selection` | Assessment list and selection | `AssessmentList` exists; assigned classes/subjects need scoped options. |
| 7 | `assessment_types_configuration` | Assessment types and grading setup | `AssessmentTypeSettings` exists; CBSE scale/policy cannot be assumed. |
| 8 | `attendance_class_section_selector` | Attendance overview by section | `AttendanceDashboard` exists but currently loads all classes for all roles. |
| 9 | `attendance_daily_attendance_register_class_10_a` | Class/section daily register | `DailyAttendanceRegister` exists; fixed Class 10-A links and policy strings need to become data-driven. |
| 10 | `attendance_late_correction_request_authorization` | Late correction request and approval | `AttendanceCorrections` exists; role approval policy is inconsistent across UI/rules. |
| 11 | `attendance_ledger_analytics` | Attendance trend/analytics | `AttendanceReport` exists; correct scope, date filtering and data-derived metrics are needed. |
| 12 | `attendance_marking_policy` | Configure attendance window/policy | `AttendancePolicySettings` exists; policy values must remain sample/configurable and server enforcement must be real. |
| 13 | `attendance_submission_summary_audit_ledger_class_10_a` | Attendance submission receipt/audit summary | Inline modal in daily attendance register; no distinct component file despite docs. Confirm the receipt is generated from saved register data. |
| 14 | `behaviour_records_directory` | Incident/observation directory | `BehaviourDirectory` exists; route/data scope too broad by default. |
| 15 | `class_performance_overview_class_10_a` | Section performance overview | `ClassPerformanceLedger` exists; must check assigned-class scope. |
| 16 | `class_teacher_assignment_management` | Class-teacher assignment administration | `ClassTeacherAssignments` exists; reconcile one-to-one assignment source of truth and seed inconsistencies. |
| 17 | `class_teacher_s_assigned_student_follow_up_list` | Assigned class follow-up list | No clearly separate class-teacher home/list route; ensure watchlist is restricted to that teacher's class. |
| 18 | `classes_sections_directory` | Classes and sections | `ClassesDirectory` exists; class teachers shouldn't use a school-wide admin-management view unless explicitly permitted. |
| 19 | `edit_student_profile_master_record_aarav_singhania` | Edit student master record | Inline modal in `StudentDetail`; ensure field-level access and audit trail. |
| 20 | `individual_risk_explanation_evidence_panel` | Evidence drawer explaining risk flags | `RiskEvidenceDrawer` exists; hard-coded legal/policy claims need removal or configuration. |
| 21 | `principal_administration_dashboard` | Principal/administrator dashboard | `OperationsHub` currently serves all roles; must become a principal-specific view. |
| 22 | `principal_dashboard_alert_selected_cbse_compliance` | Dashboard with selected alert | Same hub; avoid unverified CBSE rule display and derive alerts from real sample data. |
| 23 | `principal_dashboard_standard_overview` | Principal overview state | Same hub; should be a principal-only dashboard state rather than role-shared screen. |
| 24 | `print_ready_academic_performance_summary_ptm_aarav_singhania` | Printable PTM summary | `PTMSlip` exists; remove hard-coded policy/clinic copy and implement accurate print behavior. |
| 25 | `record_change_detail_marks_attendance_dual_custody_diff` | Before/after change detail | `AuditDiffModal` exists; requires trustworthy underlying audit events. |
| 26 | `record_new_observation_incident` | New student observation | `NewObservationModal` exists; student chooser and access must be assignment-scoped. |
| 27 | `role_and_assignment_matrix` | Role/assignment policy matrix | `RolePermissionMatrix` exists; it is not protected in router and its security text overclaims custom-claim enforcement. |
| 28 | `school_administration_audit_log` | School-wide audit log | `AuditLogDirectory` exists; restrict school-wide feed to Principal. |
| 29 | `school_reports_directory` | Report catalogue | `ReportsHub` exists; correct role-specific report visibility and unverified CBSE wording. |
| 30 | `school_wide_student_follow_up_watchlist` | School-wide watchlist | `RiskWatchlist` exists; principal-only whole-school view; class teachers see assigned class only; subject teachers don't see cross-subject risk by default. |
| 31 | `section_student_roster_class_10_a` | Section roster | `SectionRoster` exists; URL class ID must be checked against user assignments. |
| 32 | `staff_account_form` | Create/edit staff | Inline `StaffAccountModal`; Firebase version currently does not provision matching Firebase Auth identity. |
| 33 | `staff_directory` | Staff list | `StaffDirectory` exists; limit to permitted administration roles. |
| 34 | `staff_login_desktop_all_states` | Desktop login | `StaffLogin` exists; demo auth is permissive and should not silently fall back to Principal. |
| 35 | `staff_login_mobile_390px_all_states` | Mobile login | Same component, but CSS has almost no responsive breakpoints; exported reference includes a black area. Recreate the responsive layout, not the defect. |
| 36 | `student_academic_performance_report_aarav_singhania_class_10_a` | Printable/report-card academic summary | `StudentReportCard` exists; affiliation and board status are hard-coded/inconsistent. |
| 37 | `student_behaviour_history` | Student behaviour tab | Tab exists in `StudentDetail`; restrict rows by role, student assignment and confidentiality. |
| 38 | `student_by_student_subject_comparison_class_10_a` | Student-by-subject marks matrix | `ClassPerformanceLedger` is the likely screen; confirm missing/absent marks aren't shown as zero. |
| 39 | `student_chronological_change_history` | Student change history | Student detail history tab exists; ensure only authorized people can see it. |
| 40 | `student_directory_enrollment_ledger` | Student directory | `StudentDirectory` exists; currently broad list must be role/assignment-aware. |
| 41 | `student_form_validation_errors_duplicate_collision_state` | Enrollment validation/duplicate state | Some duplicate collision behavior exists in demo repository; verify UI state and Firebase atomic uniqueness check. |
| 42 | `student_profile_academic_performance_aarav_singhania` | Student academic tab | Tab exists, but Firebase consolidated matrices and student report data need validation. |
| 43 | `student_profile_overview_aarav_singhania` | Student overview | `StudentDetail` exists; avoid exposing home address/guardian details to all teacher roles by default. |
| 44 | `student_record_created_successful_save_confirmation_state` | Enrollment success receipt | No separately documented success modal file; current submit closes the enrollment modal and updates local list. Add a clear confirmation state if the pitch flow requires it. |
| 45 | `subject_faculty_assignment_matrix` | Subject assignment matrix | `SubjectFacultyAssignments` exists; correct hard-coded IDs and use canonical assignment records. |
| 46 | `subject_wise_marks_entry_register` | Subject marks entry | `MarksEntryRegister` exists; class/subject defaults, all-subject pickers and Firebase field mapping need correction. |
| 47 | `system_configuration_confirmation_audit` | School identity/config confirmation | `SystemSettings` exists; affiliation fallback values conflict. |
| 48 | `validation_submission_review_state` | Confirm high-consequence submission | Reusable `Modal` exists; review/confirmation states are embedded in page code rather than being a consistent cross-feature pattern. |

## 8. Current implementation vs. the product the school needs

### Principal
A proper principal dashboard should summarize the whole school: enrolled student total; attendance totals for the selected date; absent and unmarked counts; section completion; class/subject comparisons; school-wide follow-up watchlist; and recent sensitive actions. Principal should not have to search through every class roster just to understand the school pulse.

### Office Admin
A proper office workspace should prioritize student lookup/admissions, master-record completion, section rosters, school-wide operational attendance snapshots and print/export of appropriate student performance reports. Office staff should not automatically gain the ability to edit marks, change attendance policies, approve their own changes, or browse every confidential disciplinary note merely because they can see school-wide student performance.

### Class Teacher
A proper class teacher home should be restricted to the class/section assignment. It should show that section's count, today's present/absent/unmarked students, register submission state, class roster, consolidated marks across subjects for that section, relevant student follow-ups, and the teacher's own pending correction requests. It should **not** show the other 19 sections, all-school counts, other-class risk records or the global audit ledger.

### Subject Teacher
A subject teacher home should be based on the teacher's actual subject-assignment pairs. It should show marks registers needing entry, upcoming assessments, incomplete registers and the assigned class rosters needed to enter marks. It should not show a principal operations hub, all-school roll-call data, class-teacher administrative controls, unrelated subject marks, or school-wide behaviour/risk data.

### Shared implementation approach
Use a common set of design components, but implement distinct home dashboards for each role. A shared component is appropriate for metric cards or page tables; one shared data feed is not appropriate if the roles have different responsibilities.

## 9. Corrective implementation order

1. **Model the business roles and assignments first.** Define one canonical role/assignment policy in code and a role-by-route/action matrix. Resolve whether the current user's assignment is authoritative and eliminate hard-coded Class 10-A links/defaults.
2. **Implement role-specific dashboards.** Principal, office admin, class teacher and subject teacher should each get the right landing page and only the information that supports their job.
3. **Enforce scoping in all screen routes and data providers.** A hidden sidebar item is not an authorization boundary. Direct URL, student ID, class ID, assessment ID and subject ID must all be checked.
4. **Make demo and Firebase behavior consistent.** Demo mode should demonstrate the same role boundaries (but labelled as local sample data). Firebase mode must use actual rules/assignment checks; don't claim that front-end checks secure cloud data.
5. **Reconcile Firestore schema, rules and provider methods.** Add missing collection rules, fix mismatched fields/enums, secure attendance correction and audit data, and implement or clearly disable incomplete Firebase-mode operations.
6. **Correct seed data.** Generate a deterministic and internally consistent 20-section sample school dataset at the stated demo scale, or label the smaller illustrative dataset honestly. All displayed counts must derive from the same records.
7. **Remove/neutralize invented school policies.** Keep attendance times, thresholds, grading scales, affiliation identifiers and board details configurable; show unconfirmed values as demo settings rather than official facts.
8. **Fix responsiveness and information density.** No overlapping action bars, clipped tables or fixed desktop assumptions on phone. Keep minimal surface layout; avoid dumping all data on every page.
9. **Expand automated tests.** Add explicit tests for each role on dashboards, route matrix, direct-URL access, class/subject-scoped data, marks access, correction approval, and accurate KPIs. Add Firestore Rules tests with the Firebase emulator where available.
10. **Reconcile docs and verify.** Update screen-to-route mappings and security claims only after implementation. Run install/build/test/lint in Antigravity's environment and report real results.

## 10. The autonomous engineering brief for Antigravity

Use the revised implementation prompt supplied in the conversation after reviewing this report. Its key operating rule should be: inspect the code and infer sensible school business rules yourself, challenge flawed inherited decisions, and implement the coherent solution instead of mechanically preserving everything in the current prototype. Do not invent official school policy or use client-only checks as a substitute for security.
