/**
 * HanuJai High School ERP — Authoritative Staff Identity & Provisioning Audit
 * 
 * Audits and verifies the canonical /staff/{firebaseUid} records in Cloud Firestore.
 * Ensures strict role separation:
 * - Developer: nyWReUDvXvYPlLWH6HGpHYFwkwt2
 * - Admin Office: C5TZOc8KVchct90sd9Qf6yyrjas2
 * - Principal: xZqEMv9w1XQb8CLWdfWv3i8rClj1
 * 
 * DOES NOT delete or modify ambiguous records automatically.
 * DOES NOT expose sensitive secrets.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyC45xxyybCp03KlJ7fWsyxE8AVQY6tm988",
  authDomain: "hanujai-erp-demo.firebaseapp.com",
  projectId: "hanujai-erp-demo",
  storageBucket: "hanujai-erp-demo.firebasestorage.app",
  messagingSenderId: "313448330186",
  appId: "1:313448330186:web:81028e9ef8d6e85520d533"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CANONICAL_PERSONAS = [
  {
    authUid: 'nyWReUDvXvYPlLWH6HGpHYFwkwt2',
    expectedRole: 'developer',
    expectedName: 'System Administrator',
    expectedEmail: 'developer@hanujai.edu.in',
    description: 'Root System Administrator (Developer)'
  },
  {
    authUid: 'C5TZOc8KVchct90sd9Qf6yyrjas2',
    expectedRole: 'admin',
    expectedName: 'Admin Office',
    expectedEmail: 'admin@hanujai.edu.in',
    description: 'Administrative Office (Daily Attendance & Operations)'
  },
  {
    authUid: 'xZqEMv9w1XQb8CLWdfWv3i8rClj1',
    expectedRole: 'principal',
    expectedName: 'Dr. Vikramaditya Sharma',
    expectedEmail: 'principal@hanujai.edu.in',
    description: 'Principal (Executive Read-Only Oversight & Correction Approval)'
  }
];

async function runAudit() {
  console.log('========================================================================');
  console.log('HANUJAI HIGH SCHOOL ERP — AUTHORITATIVE STAFF IDENTITY AUDIT');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('========================================================================\n');

  let allValid = true;

  for (const persona of CANONICAL_PERSONAS) {
    console.log(`Checking Persona: ${persona.description}`);
    console.log(`  Canonical Path: staff/${persona.authUid}`);

    const docRef = doc(db, 'staff', persona.authUid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      console.error(`  [FAIL] Document staff/${persona.authUid} does NOT exist!`);
      allValid = false;
      continue;
    }

    const data = snap.data();
    const roleMatches = data.role === persona.expectedRole;
    const emailMatches = data.email === persona.expectedEmail;
    const statusMatches = data.status === 'active';
    const authUidMatches = data.authUid === persona.authUid;

    console.log(`  - Role: ${data.role} ${roleMatches ? '[OK]' : '[MISMATCH! Expected: ' + persona.expectedRole + ']'}`);
    console.log(`  - Email: ${data.email} ${emailMatches ? '[OK]' : '[MISMATCH!]'}`);
    console.log(`  - Status: ${data.status} ${statusMatches ? '[OK]' : '[MISMATCH!]'}`);
    console.log(`  - authUid: ${data.authUid} ${authUidMatches ? '[OK]' : '[MISMATCH!]'}`);

    if (!roleMatches || !emailMatches || !statusMatches) {
      allValid = false;
    }
    console.log('');
  }

  // Audit legacy / demo placeholder records without deleting them
  console.log('Auditing Legacy/Demo Placeholder Records:');
  for (const legacyId of ['staff-dev', 'staff-admin', 'staff-001']) {
    const snap = await getDoc(doc(db, 'staff', legacyId));
    if (snap.exists()) {
      const data = snap.data();
      console.log(`  - staff/${legacyId}: Exists (role: ${data.role}, email: ${data.email}) -> Status: Retained as historical/demo placeholder.`);
    } else {
      console.log(`  - staff/${legacyId}: Not present.`);
    }
  }

  console.log('\n========================================================================');
  if (allValid) {
    console.log('AUDIT RESULT: ALL CANONICAL STAFF IDENTITIES FULLY VERIFIED & SEPARATED');
  } else {
    console.error('AUDIT RESULT: ONE OR MORE STAFF IDENTITIES HAVE DISCREPANCIES');
  }
  console.log('========================================================================');

  process.exit(allValid ? 0 : 1);
}

runAudit();
