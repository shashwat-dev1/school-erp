# HanuJai High School ERP — Master Quality Assurance & Test Strategy

**Document Reference:** `HHS-TST-2026-V1`  
**Campus:** HanuJai High School, Jaipur, Rajasthan, India  
**Scope:** Phase 1 Master QA Testing Framework, Pyramids, Tooling, and Quality Gates  
**Classification:** Institutional Engineering Standard  
**Last Updated:** November 16, 2026  

---

## 1. Quality Assurance Philosophy & Objectives

The HanuJai ERP Quality Assurance Strategy guarantees institutional reliability, role segregation, and zero data corruption before real student data is ingested.

### Key Quality Principles
1. **Eval-First Verification:** Automated regressions run continuously; every bug fix must be accompanied by reproducible automated tests.
2. **Multi-Layer Defense:** Security and RBAC validated across unit tests, component tests, serverless handler suites, and live Firestore rules.
3. **Traceability:** 100% of functional requirements mapped to test scenarios and test cases in the master workbook (`HanuJai_ERP_Master_Test_Cases.xlsx`).
4. **Mobile-First Responsive Ergonomics:** Mandatory verification on iPhone viewports (375px, 390px, 430px) to prevent touch defects or layout collisions.

---

## 2. Testing Pyramid & Tooling Stack

```
                     / \
                    /   \
                   / E2E \       Playwright / Browser Workflows
                  /-------\
                 /  Integ  \     Serverless API Tests, Blob Webhooks,
                /-----------\    Firestore Rules Emulator Tests
               /  Component  \   React Testing Library, Route Guards,
              /---------------\  Modal Behaviour, Data Tables
             /      Unit       \ Vitest, Domain Functions, Token Entropy,
            /-------------------\ Hash Generation, Self-Healing Auth
```

### 2.1 Test Execution Engines
- **Unit & Component Testing:** Vitest 2.1 + React Testing Library + `@testing-library/jest-dom`.
- **Database & Security Testing:** Direct Firestore mock & integration suites validating `firestore.rules`.
- **API Testing:** Node `node-mocks-http` simulating Vercel Serverless Function HTTP requests/responses.
- **Build Quality:** Strict TypeScript compilation (`tsc -b`) and Vite production bundling.
- **Master Test Case Repository:** Professional 34-worksheet Excel workbook (`docs/qa/HanuJai_ERP_Master_Test_Cases.xlsx`).

---

## 3. Test Coverage Matrix by Module

| Module Under Test | Automated Unit Tests | Component / UI Tests | Integration Tests | Total Automated Tests |
| :--- | :---: | :---: | :---: | :---: |
| **Authentication & Self-Healing** | 8 tests | 10 tests | 6 tests | **24 tests** |
| **Attendance Authorization & Register** | 15 tests | 17 tests | 19 tests | **51 tests** |
| **Attendance Correction Workflow** | 19 tests | 12 tests | 8 tests | **39 tests** |
| **Serverless Documents Storage API** | 17 tests | 8 tests | 6 tests | **31 tests** |
| **Serverless Parent Document API** | 16 tests | 10 tests | 6 tests | **32 tests** |
| **Developer Console & Security** | 8 tests | 8 tests | 5 tests | **21 tests** |
| **Student Ingestion & Excel Import** | 10 tests | 6 tests | 0 tests | **16 tests** |
| **Total Verified Automated Tests** | **93 tests** | **71 tests** | **50 tests** | **214 tests (100% Pass)** |

---

## 4. Test Environments & Staging Strategy

### 4.1 Local Development (`localhost:5173`)
- Fast HMR with Vite.
- In-memory mock repositories and fallback demo modes.
- Vitest instant watch mode.

### 4.2 Staging Cloud Environment (`hanujai-staging.vercel.app`)
- Connected to Google Cloud Firestore (`asia-south1`).
- Private Vercel Blob store integration.
- Full parent upload handshake testing via staging WhatsApp links.

### 4.3 Production Environment (`hanujai-erp.vercel.app`)
- Production branch (`main`).
- Vercel Edge CDN distribution.
- Zero synthetic bypass accounts allowed.

---

## 5. Defect Management & Severity SLAs

| Severity Level | Definition | Target Resolution Time | Gate Impact |
| :--- | :--- | :--- | :--- |
| **P0 (Critical / Blocker)** | Privilege escalation, data loss, parent upload security flaw, login blocked | Immediate (< 4 hours) | **Blocks Deployment** |
| **P1 (Major / Workflow)** | Core workflow broken without workaround (e.g. attendance submit error) | < 24 hours | **Blocks Deployment** |
| **P2 (Moderate)** | Non-blocking functional defect with manual workaround | < 72 hours | Allows Staging Deployment |
| **P3 (Minor / Trivial)** | Visual cosmetic glitch, text typo, minor spacing misalignment | Next Sprint | Informational |

---

## 6. Exit Criteria for Production Readiness
1. **Automated Suite:** 100% pass rate across all 16 test files (214 tests).
2. **Compilation & Build:** `tsc -b` and `vite build` complete with zero errors or warnings.
3. **Security Invariants:**
   - 256-bit parent token entropy confirmed.
   - Zero raw parent tokens written to Firestore.
   - Private Vercel Blob store with signed download URLs (5-minute TTL).
   - Developer login strictly resolves to Developer role.
   - Admin Office authorized for Daily Register.
4. **Mobile Quality:** Verified on iPhone SE (375px), iPhone 13 (390px), and iPhone Pro Max (430px) with touch targets >= 44px.
5. **Documentation & Deliverables:** Master Excel workbook and all 11 technical specifications published in `docs/qa/`.

