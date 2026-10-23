/**
 * HanuJai High School ERP — Safe, Idempotent Firebase Seeding & Migration Workflow
 * Campus: HanuJai High School, Vidyadhar Nagar, Jaipur, Rajasthan, India
 * 
 * Capabilities:
 * - Reads full 3-year demonstration dataset deterministically.
 * - Idempotent: checks existing documents or merges safely without generating duplicates.
 * - Respects Cloud Firestore 500-operation batch limits (uses 400-op chunks).
 * - Preserves all 1,000 student profiles, 3 academic years, 12 assessment cycles,
 *   240 marks registers (11,690 entries), teacher notes, and attendance sessions.
 * - Provides execution modes:
 *     --mode=standard (default: all core master data, marks, notes + recent & reasoning interval attendance)
 *     --mode=complete (all 14,120 historical attendance sessions across 3 years)
 *     --verify-only   (audits existing records in Firestore without writing)
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';

// Domain and Generator Imports
import {
  initialSettings,
  initialStaff,
  initialAttendanceSessions,
  initialAttendanceCorrections,
  initialAuditEvents,
} from '../src/data/demo/seedData';
import {
  historicalAcademicYears,
  historicalAssessmentCycles,
  historicalSubjects,
  historicalSubjectAssignments,
  generateAllHistoricalClasses,
  generateAllHistoricalStudents,
  generateAllHistoricalMarksRegisters,
  generateAllHistoricalAttendanceSessions,
  generateAllHistoricalTeacherNotes,
  expandCompactSession,
} from '../src/data/demo/historicalGenerator';
import type { AttendanceSession, AttendanceAggregate } from '../src/domain/types';

// ============================================================================
// 1. Environment & Configuration Loader
// ============================================================================
function loadLocalEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf-8');
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        env[key] = val;
      }
    });
  }
  return env;
}

const localEnv = loadLocalEnv();

function getEnvVar(key: string): string {
  return process.env[key] || localEnv[key] || '';
}

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID'),
};

// ============================================================================
// 2. Batch Writer Helper (Strict 400-op ceiling per batch)
// ============================================================================
class BatchManager {
  private db: Firestore;
  private currentBatch: WriteBatch;
  private opsInBatch = 0;
  private totalCommitted = 0;
  private readonly BATCH_LIMIT = 400;

  constructor(db: Firestore) {
    this.db = db;
    this.currentBatch = writeBatch(this.db);
  }

  public async set<T extends Record<string, any>>(collectionName: string, docId: string, data: T, merge = true): Promise<void> {
    const docRef = doc(this.db, collectionName, docId);
    const sanitized = JSON.parse(JSON.stringify(data));
    this.currentBatch.set(docRef, sanitized, { merge });
    this.opsInBatch++;

    if (this.opsInBatch >= this.BATCH_LIMIT) {
      await this.commit();
    }
  }

  public async commit(): Promise<void> {
    if (this.opsInBatch > 0) {
      await this.currentBatch.commit();
      this.totalCommitted += this.opsInBatch;
      this.currentBatch = writeBatch(this.db);
      this.opsInBatch = 0;
    }
  }

  public getTotalCommitted(): number {
    return this.totalCommitted;
  }
}

// ============================================================================
// 3. Main Seeding & Verification Workflow
// ============================================================================
async function run() {
  const args = process.argv.slice(2);
  const isVerifyOnly = args.includes('--verify-only');
  const isCompleteMode = args.includes('--mode=complete') || args.includes('--full-attendance');

  console.log('================================================================================');
  console.log('  HANUJAI HIGH SCHOOL ERP — CLOUD FIRESTORE SEEDING & MIGRATION UTILITY');
  console.log('  Campus: HanuJai High School, Jaipur, Rajasthan, India');
  console.log('================================================================================\n');

  if (args.includes('--help') || args.includes('-h')) {
    console.log('USAGE:');
    console.log('  npm run seed:firebase [-- [options]]\n');
    console.log('OPTIONS:');
    console.log('  --mode=standard    (Default) Seeds all master data, 1,000 students, 240 marks registers,');
    console.log('                     teacher notes, recent sessions, and calibration reasoning intervals (~1,600 writes).');
    console.log('  --mode=complete    Seeds all master data PLUS all 14,120 historical attendance sessions');
    console.log('                     across all 20 classes and 3 academic years (~15,600 writes).');
    console.log('  --verify-only      Audits existing Firestore collections and counts documents without writing.');
    console.log('  --confirm-production Bypasses safety guard if project ID contains "prod" or "live".');
    console.log('  --help, -h         Displays this help message.\n');
    process.exit(0);
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('❌ ERROR: Missing required Firebase configuration!');
    console.error('Please configure your Firebase credentials in .env.local:');
    console.error('  VITE_FIREBASE_API_KEY=<your-api-key>');
    console.error('  VITE_FIREBASE_AUTH_DOMAIN=<your-project-id>.firebaseapp.com');
    console.error('  VITE_FIREBASE_PROJECT_ID=<your-project-id>');
    console.error('  VITE_FIREBASE_STORAGE_BUCKET=<your-project-id>.firebasestorage.app');
    console.error('  VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>');
    console.error('  VITE_FIREBASE_APP_ID=<app-id>\n');
    process.exit(1);
  }

  console.log(`📍 Target Project ID: ${firebaseConfig.projectId}`);
  console.log(`📍 Execution Mode   : ${isVerifyOnly ? 'VERIFY ONLY (No writes)' : isCompleteMode ? 'COMPLETE (Includes all 14,120 historical sessions)' : 'STANDARD (Master data, marks, notes, 20 active sessions + reasoning interval)'}\n`);

  // Protect Genuine Production School Database
  const isProdKeyword = /prod|live|real|official/i.test(firebaseConfig.projectId);
  if (isProdKeyword && !args.includes('--confirm-production')) {
    console.error('⚠️  CRITICAL SAFETY INTERVENTION:');
    console.error(`The target project ID "${firebaseConfig.projectId}" appears to be a genuine production environment.`);
    console.error('To protect real student records, the demo dataset must not be seeded into a production database.');
    console.error('If this is intentional, pass --confirm-production. Otherwise, create a dedicated demo Firebase project.\n');
    process.exit(1);
  }

  // Initialize Firebase Client
  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  let db: Firestore;
  try {
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    db = getFirestore(app);
  }

  if (isVerifyOnly) {
    await verifyDatabase(db);
    return;
  }

  console.log('⏳ Generating deterministic demonstration fixtures...');
  const students = generateAllHistoricalStudents();
  const marksRegisters = generateAllHistoricalMarksRegisters(students);
  const classes = generateAllHistoricalClasses();
  const notes = generateAllHistoricalTeacherNotes();
  const compactAttendance = generateAllHistoricalAttendanceSessions(students);

  console.log(`✓ Fixtures generated: ${students.length} students, ${classes.length} classes, ${marksRegisters.length} marks registers, ${compactAttendance.length} attendance sessions.`);
  console.log('🚀 Initiating idempotent batch migration into Cloud Firestore...\n');

  const batchManager = new BatchManager(db);
  const summary: Record<string, { target: number; migrated: number }> = {};

  // 1. School Settings (1 doc)
  console.log('→ Migrating School Settings & Policy...');
  await batchManager.set('schoolSettings', initialSettings.id, initialSettings);
  summary['School Settings'] = { target: 1, migrated: 1 };

  // 2. Academic Years (3 docs)
  console.log('→ Migrating Academic Years (2023–2026)...');
  for (const year of historicalAcademicYears) {
    await batchManager.set('academicYears', year.id, year);
  }
  summary['Academic Years'] = { target: historicalAcademicYears.length, migrated: historicalAcademicYears.length };

  // 3. Classes & Sections (20 Active + Historical)
  console.log('→ Migrating Classes & Sections...');
  for (const cls of classes) {
    // Stable doc ID: class-10-a for active year, class-10-a-2023-2024 for archive if needed
    const docId = cls.academicYearId === 'year-2025-2026' ? cls.id : `${cls.id}-${cls.academicYearId}`;
    await batchManager.set('classes', docId, cls);
  }
  summary['Classes & Sections'] = { target: classes.length, migrated: classes.length };

  // 4. Subjects (25 docs)
  console.log('→ Migrating Curriculum Subjects...');
  for (const sub of historicalSubjects) {
    await batchManager.set('subjects', sub.id, sub);
  }
  summary['Subjects'] = { target: historicalSubjects.length, migrated: historicalSubjects.length };

  // 5. Subject Faculty Assignments (20 docs)
  console.log('→ Migrating Subject Faculty Assignments...');
  for (const assign of historicalSubjectAssignments) {
    await batchManager.set('subjectAssignments', assign.id, assign);
  }
  summary['Subject Assignments'] = { target: historicalSubjectAssignments.length, migrated: historicalSubjectAssignments.length };

  // 6. Faculty Staff Directory (22 docs)
  console.log('→ Migrating Faculty Staff Accounts...');
  for (const st of initialStaff) {
    await batchManager.set('staff', st.id, st);
  }
  summary['Staff Users'] = { target: initialStaff.length, migrated: initialStaff.length };

  // 7. Student Master Directory (1,000 docs)
  console.log('→ Migrating 1,000 Enrolled Students (with 3-Year Progression)...');
  for (const stud of students) {
    await batchManager.set('students', stud.id, stud);
  }
  summary['Students'] = { target: students.length, migrated: students.length };

  // 8. Assessment Cycles (12 docs)
  console.log('→ Migrating 12 CBSE Assessment Cycles...');
  for (const cycle of historicalAssessmentCycles) {
    await batchManager.set('assessments', cycle.id, cycle);
  }
  summary['Assessment Cycles'] = { target: historicalAssessmentCycles.length, migrated: historicalAssessmentCycles.length };

  // 9. Marks Registers (240 registers, 11,690 entries)
  console.log('→ Migrating 240 Marks Registers (11,690 evaluated student marks)...');
  for (const reg of marksRegisters) {
    await batchManager.set('marksRegisters', reg.id, reg);
  }
  summary['Marks Registers'] = { target: marksRegisters.length, migrated: marksRegisters.length };

  // 10. Teacher Notes & Proctorial Care (10 docs)
  console.log('→ Migrating Teacher Notes & Proctorial Care Records...');
  for (const note of notes) {
    await batchManager.set('incidents', note.id, note);
  }
  summary['Teacher Notes'] = { target: notes.length, migrated: notes.length };

  // 11. Attendance Corrections (2 docs)
  console.log('→ Migrating Dual-Custody Attendance Correction Records...');
  for (const corr of initialAttendanceCorrections) {
    await batchManager.set('attendanceCorrections', corr.id, corr);
  }
  summary['Attendance Corrections'] = { target: initialAttendanceCorrections.length, migrated: initialAttendanceCorrections.length };

  // 12. Audit Stream (4 docs)
  console.log('→ Migrating System Audit Log Stream...');
  for (const audit of initialAuditEvents) {
    await batchManager.set('auditEvents', audit.id, audit);
  }
  summary['Audit Events'] = { target: initialAuditEvents.length, migrated: initialAuditEvents.length };

  // 13. Attendance Sessions & Aggregates
  console.log('→ Migrating Attendance Sessions & Aggregates...');
  let attendanceCount = 0;

  // A. Initial 20 Sessions for recent live registers
  for (const sess of initialAttendanceSessions) {
    await batchManager.set('attendanceSessions', sess.id, sess);
    await batchManager.set('attendanceAggregates', `att-aggregate-${sess.classId}-${sess.date}`, {
      classId: sess.classId,
      date: sess.date,
      totalStudents: sess.totalStudents,
      presentCount: sess.presentCount,
      absentCount: sess.absentCount,
      lateCount: sess.lateCount,
      excusedCount: sess.excusedCount,
    } satisfies AttendanceAggregate);
    attendanceCount++;
  }

  // B. Historical Attendance Sessions
  const classStudentsMap = new Map<string, typeof students>();
  classes.forEach(c => {
    classStudentsMap.set(c.id, students.filter(s => s.classId === c.id));
  });

  if (isCompleteMode) {
    console.log(`   Expanding and committing all ${compactAttendance.length} historical attendance sessions...`);
    for (const compact of compactAttendance) {
      const classStudents = classStudentsMap.get(compact.classId) || [];
      const enrolled = classStudents.filter(s => s.enrollmentDate <= compact.date);
      const expanded: AttendanceSession = expandCompactSession(compact, enrolled);
      await batchManager.set('attendanceSessions', expanded.id, expanded);
      await batchManager.set('attendanceAggregates', `att-aggregate-${expanded.classId}-${expanded.date}`, {
        classId: expanded.classId,
        date: expanded.date,
        totalStudents: expanded.totalStudents,
        presentCount: expanded.presentCount,
        absentCount: expanded.absentCount,
        lateCount: expanded.lateCount,
        excusedCount: expanded.excusedCount,
      } satisfies AttendanceAggregate);
      attendanceCount++;
    }
  } else {
    // Standard Mode: Seed the key reasoning intervals & representative samples
    // 1) Class 10-A sessions between 2025-07-24 and 2025-11-20 (Aarav's 3 absences test)
    // 2) Class 10-A sessions around mid-term admission (2025-07-21, 2025-09-02)
    const selectedSessions = compactAttendance.filter(c => {
      if (c.classId === 'class-10-a' && c.date >= '2025-07-01' && c.date <= '2025-11-30') return true;
      if (c.date === '2025-04-07' || c.date === '2025-04-08' || c.date === '2025-08-18') return true;
      return false;
    });

    console.log(`   Seeding ${selectedSessions.length} critical reasoning and calibration attendance sessions...`);
    for (const compact of selectedSessions) {
      const classStudents = classStudentsMap.get(compact.classId) || [];
      const enrolled = classStudents.filter(s => s.enrollmentDate <= compact.date);
      const expanded: AttendanceSession = expandCompactSession(compact, enrolled);
      await batchManager.set('attendanceSessions', expanded.id, expanded);
      await batchManager.set('attendanceAggregates', `att-aggregate-${expanded.classId}-${expanded.date}`, {
        classId: expanded.classId,
        date: expanded.date,
        totalStudents: expanded.totalStudents,
        presentCount: expanded.presentCount,
        absentCount: expanded.absentCount,
        lateCount: expanded.lateCount,
        excusedCount: expanded.excusedCount,
      } satisfies AttendanceAggregate);
      attendanceCount++;
    }
  }
  summary['Attendance Sessions'] = { target: attendanceCount, migrated: attendanceCount };

  // Final Commit of remaining batch items
  await batchManager.commit();

  console.log('\n================================================================================');
  console.log('  MIGRATION COMPLETE — SUMMARY AUDIT LEDGER');
  console.log('================================================================================');
  console.log('| Collection / Domain Entity       | Target Records | Persisted to Firestore |');
  console.log('|----------------------------------|----------------|------------------------|');
  for (const [entity, counts] of Object.entries(summary)) {
    console.log(`| ${entity.padEnd(32)} | ${counts.target.toString().padStart(14)} | ${counts.migrated.toString().padStart(22)} |`);
  }
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Firestore Write Operations Committed: ${batchManager.getTotalCommitted()}`);
  console.log('================================================================================\n');

  console.log('✅ Demonstration dataset successfully persisted in Cloud Firestore.');
  console.log('You can now switch VITE_DATA_MODE=firebase and deploy to Vercel.');
}

// ============================================================================
// 4. Verification Mode
// ============================================================================
async function verifyDatabase(db: Firestore) {
  console.log('🔍 Auditing existing Firestore collections...');

  const collectionsToCheck = [
    'schoolSettings',
    'academicYears',
    'classes',
    'subjects',
    'subjectAssignments',
    'staff',
    'students',
    'assessments',
    'marksRegisters',
    'incidents',
    'attendanceSessions',
    'attendanceAggregates',
    'attendanceCorrections',
    'auditEvents',
  ];

  console.log('| Collection Name          | Document Count | Status       |');
  console.log('|--------------------------|----------------|--------------|');

  for (const collName of collectionsToCheck) {
    try {
      const snap = await getDocs(collection(db, collName));
      const count = snap.size;
      const status = count > 0 ? '✓ Populated' : '⚠ Empty';
      console.log(`| ${collName.padEnd(24)} | ${count.toString().padStart(14)} | ${status.padEnd(12)} |`);
    } catch (e: any) {
      console.log(`| ${collName.padEnd(24)} | ${'ERROR'.padStart(14)} | ${e.message.slice(0, 12)} |`);
    }
  }

  // Cross-Record Relationship Check for Aarav Singhania
  try {
    const aaravSnap = await getDoc(doc(db, 'students', 'STU-10A-01'));
    if (aaravSnap.exists()) {
      const data = aaravSnap.data();
      console.log(`\n✓ Referential Check: Found Student STU-10A-01 (${data.fullName}) in ${data.classLabel}.`);
    } else {
      console.log('\n⚠ Referential Check: Student STU-10A-01 not found.');
    }
  } catch (err: any) {
    console.log(`\n⚠ Referential Check Error: ${err.message}`);
  }
}

run().catch(err => {
  console.error('\n❌ Fatal Migration Error:', err);
  process.exit(1);
});
