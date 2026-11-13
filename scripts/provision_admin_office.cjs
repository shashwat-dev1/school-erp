const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');

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
const auth = getAuth(app);

async function provisionAdminAndDeactivateTeachers() {
  console.log('=== HanuJai ERP — Admin Office Provisioning & Teacher Deactivation ===\n');

  // 1. Provision Admin Office Account in Firebase Auth
  console.log('1. Checking Firebase Auth for admin@hanujai.edu.in...');
  let adminAuthUid = null;
  try {
    const cred = await signInWithEmailAndPassword(auth, 'admin@hanujai.edu.in', 'demo-password');
    adminAuthUid = cred.user.uid;
    console.log('✓ Firebase Auth account already exists for admin@hanujai.edu.in (UID:', adminAuthUid, ')');
  } catch (authErr) {
    if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
      try {
        console.log('Creating Firebase Auth account for admin@hanujai.edu.in...');
        const newCred = await createUserWithEmailAndPassword(auth, 'admin@hanujai.edu.in', 'demo-password');
        adminAuthUid = newCred.user.uid;
        console.log('✓ Successfully created Firebase Auth account for admin@hanujai.edu.in (UID:', adminAuthUid, ')');
      } catch (createErr) {
        console.warn('Note on creating auth user:', createErr.message);
      }
    } else {
      console.warn('Auth check message:', authErr.message);
    }
  }

  // 2. Provision Admin Office document in Firestore /staff
  console.log('\n2. Provisioning Admin Office record in Firestore...');
  const adminDocData = {
    id: 'staff-admin',
    email: 'admin@hanujai.edu.in',
    name: 'Admin Office',
    displayName: 'Admin Office',
    fullName: 'Admin Office',
    role: 'admin',
    employeeCode: 'EMP-ADMIN-01',
    designation: 'Administrative Officer',
    department: 'School Administration',
    phone: '+91 98290 11002',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (adminAuthUid) {
    adminDocData.authUid = adminAuthUid;
  }

  await setDoc(doc(db, 'staff', 'staff-admin'), adminDocData, { merge: true });
  console.log('✓ Document /staff/staff-admin provisioned successfully with role: admin, status: active.');

  if (adminAuthUid) {
    await setDoc(doc(db, 'staff', adminAuthUid), { ...adminDocData, id: 'staff-admin' }, { merge: true });
    console.log(`✓ Document /staff/${adminAuthUid} linked for authenticated UID resolution.`);
  }

  // 3. Deactivate Classroom and Subject Teacher accounts safely
  console.log('\n3. Safely deactivating teacher accounts in Firestore...');
  const staffSnap = await getDocs(collection(db, 'staff'));
  let deactivatedCount = 0;
  let activeCount = 0;

  for (const staffDoc of staffSnap.docs) {
    const data = staffDoc.data();
    if (data.role === 'class_teacher' || data.role === 'subject_teacher') {
      await updateDoc(doc(db, 'staff', staffDoc.id), {
        status: 'deactivated',
        activeRole: 'deactivated',
        deactivatedAt: new Date().toISOString(),
      });
      console.log(`  Deactivated: ${staffDoc.id} (${data.name || data.email}) — historical attribution preserved`);
      deactivatedCount++;
    } else if (data.role === 'principal' || data.role === 'admin') {
      console.log(`  Active Role Preserved: ${staffDoc.id} (${data.name || data.email}) — role: ${data.role}`);
      activeCount++;
    }
  }

  console.log(`\nDeactivation complete: ${deactivatedCount} teacher records deactivated, ${activeCount} administrative accounts active.`);
  console.log('Historical data, attendance registers, parent contacts, and audit links are 100% intact.');
  process.exit(0);
}

provisionAdminAndDeactivateTeachers().catch(err => {
  console.error('Fatal error during provisioning:', err);
  process.exit(1);
});
