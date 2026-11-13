const fs = require('fs');
const path = require('path');
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

const academicCollections = [
  'assessments',
  'marksRegisters',
  'incidents',
  'studentFollowUps',
  'subjectAssignments',
  'subjects'
];

async function runBackup() {
  console.log(`Starting backup of academic and notes collections from project: ${firebaseConfig.projectId}...`);
  const backupData = {
    projectId: firebaseConfig.projectId,
    timestamp: new Date().toISOString(),
    collections: {},
    summary: {}
  };

  let totalDocs = 0;

  for (const colName of academicCollections) {
    try {
      const snap = await getDocs(collection(db, colName));
      const docs = snap.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
      backupData.collections[colName] = docs;
      backupData.summary[colName] = docs.length;
      totalDocs += docs.length;
      console.log(`- Backed up '${colName}': ${docs.length} documents`);
    } catch (err) {
      console.error(`Error backing up collection ${colName}:`, err);
      process.exit(1);
    }
  }

  backupData.summary.totalDocuments = totalDocs;

  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, 'academic_notes_backup_2026_11_13.json');
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`\nBackup successfully written to: ${backupFile}`);
  console.log(`File size: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);
  console.log(`Total documents archived: ${totalDocs}`);

  // Also write deletion manifest
  const manifestFile = path.join(backupDir, 'deletion_manifest_2026_11_13.json');
  const manifest = {
    projectId: firebaseConfig.projectId,
    createdAt: backupData.timestamp,
    backupFile: backupFile,
    collectionsToDelete: backupData.summary,
    collectionsPreserved: [
      'students',
      'classes',
      'staff',
      'academicYears',
      'schoolSettings',
      'attendanceSessions',
      'attendanceAggregates',
      'attendanceCorrections',
      'attendanceNotifications',
      'auditEvents'
    ]
  };
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Deletion manifest written to: ${manifestFile}`);
  process.exit(0);
}

runBackup();
