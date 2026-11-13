const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

const allCollections = [
  'students',
  'classes',
  'staff',
  'academicYears',
  'schoolSettings',
  'attendanceSessions',
  'attendanceAggregates',
  'attendanceCorrections',
  'attendanceNotifications',
  'auditEvents',
  'assessments',
  'marksRegisters',
  'incidents',
  'studentFollowUps',
  'subjectAssignments',
  'subjects'
];

async function checkCounts() {
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Checking collection document counts:');
  for (const colName of allCollections) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`- ${colName}: ${snap.size} documents`);
    } catch (err) {
      console.log(`- ${colName}: ERROR (${err.message})`);
    }
  }
  process.exit(0);
}

checkCounts();
