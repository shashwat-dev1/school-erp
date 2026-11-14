/**
 * HanuJai High School ERP — Developer / System Administrator Provisioning Script
 * 
 * Secure administrative script to provision the root Developer account in Firebase Auth
 * and Cloud Firestore.
 * 
 * Usage:
 *   node scripts/provision_developer.cjs [email] [password]
 * Or via environment variables:
 *   DEVELOPER_EMAIL=... DEVELOPER_PASSWORD=... node scripts/provision_developer.cjs
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyC45xxyybCp03KlJ7fWsyxE8AVQY6tm988",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "hanujai-erp-demo.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "hanujai-erp-demo",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "hanujai-erp-demo.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "313448330186",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:313448330186:web:81028e9ef8d6e85520d533"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function provisionDeveloperAccount() {
  console.log('=== HanuJai ERP — Developer Role Provisioning ===\n');

  const email = process.argv[2] || process.env.DEVELOPER_EMAIL || 'developer@hanujai.edu.in';
  const password = process.argv[3] || process.env.DEVELOPER_PASSWORD || 'demo-password';

  console.log(`Target Developer Email: ${email}`);

  // 1. Firebase Authentication
  console.log('\n1. Checking Firebase Authentication...');
  let devAuthUid = null;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    devAuthUid = cred.user.uid;
    console.log(`✓ Firebase Auth account verified (UID: ${devAuthUid})`);
  } catch (authErr) {
    if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
      try {
        console.log(`Creating new Firebase Auth account for ${email}...`);
        const newCred = await createUserWithEmailAndPassword(auth, email, password);
        devAuthUid = newCred.user.uid;
        console.log(`✓ Successfully created Firebase Auth account (UID: ${devAuthUid})`);
      } catch (createErr) {
        console.error('Failed to create user in Firebase Auth:', createErr.message);
        throw createErr;
      }
    } else {
      console.warn(`Auth check notice: ${authErr.message}`);
    }
  }

  // 2. Provision Firestore document
  console.log('\n2. Provisioning Authoritative Role in Cloud Firestore (/staff)...');
  const now = new Date().toISOString();
  const devDocData = {
    id: 'staff-dev',
    email: email.toLowerCase().trim(),
    name: 'System Administrator',
    displayName: 'System Administrator (Developer)',
    fullName: 'System Administrator (Developer)',
    role: 'developer',
    employeeCode: 'DEV-ROOT-01',
    designation: 'ERP System Administrator',
    department: 'Systems & Infrastructure',
    phone: '+91 98290 11000',
    status: 'active',
    updatedAt: now,
  };

  if (devAuthUid) {
    devDocData.authUid = devAuthUid;
  }

  // Save canonical staff-dev record
  await setDoc(doc(db, 'staff', 'staff-dev'), devDocData, { merge: true });
  console.log('✓ Document /staff/staff-dev written with role: developer, status: active.');

  // If UID known, link /staff/{uid} for Firestore rules lookup
  if (devAuthUid) {
    await setDoc(doc(db, 'staff', devAuthUid), { ...devDocData, id: 'staff-dev' }, { merge: true });
    console.log(`✓ Document /staff/${devAuthUid} linked for request.auth.uid resolution.`);
  }

  // 3. Verification
  console.log('\n3. Verifying provisioned record in Firestore...');
  const verifySnap = await getDoc(doc(db, 'staff', 'staff-dev'));
  if (verifySnap.exists() && verifySnap.data().role === 'developer' && verifySnap.data().status === 'active') {
    console.log('✓ Verification PASSED: Developer account is fully active and authorized.');
  } else {
    throw new Error('Verification failed: Written record does not match expected developer schema.');
  }

  console.log('\n=== Developer Provisioning Complete ===');
  process.exit(0);
}

provisionDeveloperAccount().catch(err => {
  console.error('\nFatal Provisioning Error:', err);
  process.exit(1);
});

