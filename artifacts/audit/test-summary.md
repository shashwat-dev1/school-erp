# Audit command summary

Date: 23 October 2026

- npm test — exit 1. 3 files, 40 tests: 39 passed, 1 failed. Student Ledger render test in src/test/App.test.tsx timed out at 5 seconds. RoleAuthorization (23) and WorkflowCorrections (7) passed.
- npm run lint — exit 0. 0 errors, 20 warnings (explicit any and missing React hook dependencies).
- npm run build — exit 0. Vite built 1,662 modules. Main minified JS bundle is 737.46 kB; Vite emitted its >500 kB advisory.
- Firebase emulator — unavailable: no firebase.json, Firebase CLI or emulator process found. No rules tests or deployment run.

The app was observed in Sample Data mode. No write forms, reset operation, export download, or print action was performed.
