# HanuJai High School ERP — System Architecture

## 1. High-Level Architectural Overview

HanuJai ERP is designed as a modular, client-side single-page application (SPA) backed by cloud services or local synthetic repositories. It avoids complex server-side runtimes, heavy containers, or monolithic relational schemas in favor of a clean, decoupled **Domain-Driven Repository Pattern**.

```
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     PRESENTATION TIER (React 18 + TS)                       |  |
|  |  +-----------------+  +-----------------+  +-----------------+  +---------+ |  |
|  |  | Principal View  |  | Office Desk     |  | Class Teacher   |  | Subject | |  |
|  |  +-----------------+  +-----------------+  +-----------------+  +---------+ |  |
|  |           |                   |                    |                 |      |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  |          APPLICATION SHELL (Sidebar, Topbar, Role Guard, Router)      |  |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |                                      |                                         |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  |           SHARED COMPONENT SYSTEM (Institutional Rigor Tokens)         |  |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  +--------------------------------------|--------------------------------------+  |
|                                         |                                         |
|  +-----------------------------------------------------------------------------+  |
|  |                       SERVICES & REPOSITORY LAYER                           |  |
|  |  +--------------------+  +--------------------+  +-----------------------+  |  |
|  |  | Attendance Service |  | Assessment Service |  | Student Record Service|  |  |
|  |  +--------------------+  +--------------------+  +-----------------------+  |  |
|  |                                      |                                         |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  |                 UNIFIED DATA PROVIDER INTERFACE                       |  |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  +----------------------/-------------------------------\----------------------+  |
+------------------------/---------------------------------\------------------------+
                        /                                   \
         [VITE_DATA_MODE=demo]                       [VITE_DATA_MODE=firebase]
                      v                                             v
+---------------------------------------+   +---------------------------------------+
|          LOCAL STORAGE DEMO STORE     |   |             FIREBASE CLOUD            |
|  - Deterministic 1,000-student seed   |   |  - Firebase Authentication            |
|  - In-browser mutation persistence    |   |  - Cloud Firestore (Rules Enforced)   |
|  - Instant reset capability           |   |  - Firebase Storage (Protected assets)|
+---------------------------------------+   +---------------------------------------+
```

---

## 2. Directory & Component Organization

The source code is organized into strict architectural boundaries inside `src/`:

```
src/
├── assets/                  # Institutional crest, SVG motifs, static images
├── components/              # Shared, reusable UI components (Institutional Rigor)
│   ├── layout/              # AppShell, Sidebar, Topbar, PageHeader, NavigationDrawer
│   ├── ui/                  # Button, FormInput, FormSelect, StatusBadge, MetricCard, Modal, Drawer, Tabs
│   ├── feedback/            # LoadingSpinner, EmptyState, ErrorBanner, ConfirmationDialog
│   └── tables/              # DataTable, TablePagination, TableHeader
├── config/                  # Firebase configuration, environment variable parsers
├── context/                 # AuthContext, SchoolYearContext, DataModeContext
├── domain/                  # Pure TypeScript domain models, entity interfaces, and validation schemas
├── hooks/                   # Custom hooks (useAuth, useRoleAccess, useStudents, useAttendance, useAssessments)
├── pages/                   # Top-level screen views grouped by workflow
│   ├── auth/                # StaffLogin
│   ├── dashboard/           # OperationsHub, PrincipalDashboard
│   ├── students/            # StudentDirectory, StudentProfile, NewAdmissionForm
│   ├── attendance/          # AttendanceSelector, DailyRegister, CorrectionApproval
│   ├── assessments/         # AssessmentSelector, MarksEntryRegister, ReportCard
│   ├── behaviour/           # IncidentDirectory, NewIncidentForm
│   ├── admin/               # AcademicYears, ClassTeacherAssignment, AuditLog, SystemSettings
│   └── error/               # AccessDenied, NotFound
├── services/                # Business logic and cross-cutting rules (Marking window, Attention rules)
├── data/                    # Unified repository abstractions
│   ├── provider.ts          # Unified DataProvider contract
│   ├── demo/                # Deterministic synthetic data generator & localStorage adapter
│   └── firebase/            # Firestore collection repositories & transaction handlers
├── styles/                  # Institutional Rigor design tokens (CSS variables, reset, print styles)
├── test/                    # Test utilities, mock factories, test setups
├── App.tsx                  # Main route tree with RoleGuard wrappers
└── main.tsx                 # React DOM mount point and context providers
```

---

## 3. Routing & Role-Based Navigation Architecture

Application navigation uses React Router v6 with declarative nested routes and high-order route guards:

### Role Guard Model (`RoleGuard.tsx`)
```tsx
<Route element={<RoleGuard allowedRoles={['principal', 'office_admin']} />}>
  <Route path="/admin/*" element={<AdminRoutes />} />
</Route>
```
If a logged-in user lacks the required permission:
1. They are redirected to `/unauthorized` with an informative error context explaining the missing role.
2. The user menu reflects their actual assigned role (e.g. "Class Teacher — 10-A").
3. Navigation links for unauthorized sections are automatically excluded from the sidebar and quick actions.

### Primary Route Tree
- `/login`: Public staff portal login.
- `/`: Role-aware redirect (Principal -> Operations Hub; Class Teacher -> My Class Register).
- `/students`: Master student directory.
- `/students/:id`: Detailed student profile (tabs for Overview, Academics, Behaviour, Audit).
- `/students/new`: New admission wizard.
- `/attendance`: Section selector.
- `/attendance/register/:classId`: Daily roll call register.
- `/attendance/corrections`: Late correction authorization workflow.
- `/assessments`: Assessment cycle selector.
- `/assessments/entry/:assessmentId/:classId/:subjectId`: Spreadsheet-like marks entry.
- `/behaviour`: Incident ledger and observation logging.
- `/reports`: Institutional reporting suite and printable A4 report cards.
- `/admin/*`: Academic session management, faculty allocations, audit log, policy setup.

---

## 4. Unified Data Provider Contract

To enable seamless switching between **Demo Mode** and **Firebase Mode**, all UI pages and components consume a unified `DataProvider` interface:

```typescript
export interface DataProvider {
  // School & Academic Sessions
  getSchoolSettings(): Promise<SchoolSettings>;
  getActiveAcademicYear(): Promise<AcademicYear>;
  
  // Classes & Assignments
  getClasses(yearId: string): Promise<ClassSection[]>;
  getClassTeacherAssignment(teacherId: string, yearId: string): Promise<ClassSection | null>;
  getSubjectAssignments(teacherId: string, yearId: string): Promise<SubjectAssignment[]>;
  
  // Students
  getStudents(filter: StudentFilter): Promise<PaginatedResult<StudentRecord>>;
  getStudentById(studentId: string): Promise<StudentRecord | null>;
  createStudent(data: NewStudentInput, actor: StaffUser): Promise<StudentRecord>;
  updateStudent(studentId: string, data: Partial<StudentRecord>, actor: StaffUser, reason: string): Promise<StudentRecord>;
  
  // Attendance
  getDailyAttendance(classId: string, date: string): Promise<AttendanceSession | null>;
  saveDailyAttendance(session: AttendanceSubmissionInput, actor: StaffUser): Promise<AttendanceSession>;
  requestAttendanceCorrection(request: AttendanceCorrectionInput, actor: StaffUser): Promise<AttendanceCorrection>;
  approveAttendanceCorrection(requestId: string, actor: StaffUser): Promise<void>;
  
  // Assessments & Marks
  getAssessmentCycles(yearId: string): Promise<AssessmentCycle[]>;
  getMarksRegister(assessmentId: string, classId: string, subjectId: string): Promise<MarksRegister>;
  saveMarksRegister(register: MarksSubmissionInput, actor: StaffUser): Promise<MarksRegister>;
  
  // Behaviour & Incidents
  getIncidents(filter: IncidentFilter): Promise<IncidentRecord[]>;
  createIncident(data: NewIncidentInput, actor: StaffUser): Promise<IncidentRecord>;
  
  // Audit Events
  getAuditEvents(filter: AuditFilter): Promise<AuditEvent[]>;
  logAuditEvent(event: NewAuditEventInput): Promise<void>;
}
```

UI components **never invoke Firebase SDK methods directly**; they invoke methods on the provider injected via `DataContext`.

---

## 5. Demo-Data Architecture & Local Persistence

1. **Deterministic Generation**:
   - Generates exactly 10 classes (`Class 1` through `Class 10`) with 2 sections each (`Section A` and `Section B`).
   - 391 synthetic students across Grades 7 through 12, with realistic Indian names (Aarav, Diya, Rohan, Ananya, etc.) and valid roll numbers.
   - 4 staff accounts pre-configured for instant prototype evaluation:
     - `principal@hanujai.edu.in` (Principal / Admin)
     - `admin@hanujai.edu.in` (Office Admin)
     - `teacher.10a@hanujai.edu.in` (Class Teacher, 10-A)
     - `math.teacher@hanujai.edu.in` (Subject Teacher, Mathematics)
2. **Local Mutation Persistence**:
   - Any attendance changes, marks entered, or student profiles created are written to `localStorage` under `hanujai_erp_demo_store`.
   - On page refresh, local edits persist seamlessly.
3. **Reset Capability**:
   - A global **"Reset Sample Data"** action in the topbar wipes the `localStorage` key and reinstantiates the fresh seed data.

---

## 6. Vercel Deployment Architecture

The application is engineered for zero-configuration, edge-optimized static deployment on Vercel:

### Configuration (`vercel.json`)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

### Environment Variables on Vercel
- All build-time secrets and Firebase config keys are managed exclusively in Vercel's Project Dashboard.
- `VITE_DATA_MODE=demo` is the safe default for preview environments; production branches can be switched to `firebase` with verified credentials.
- Zero server-side functions or Docker daemons are needed.
