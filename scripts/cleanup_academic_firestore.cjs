const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc, deleteField } = require('firebase/firestore');

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

const collectionsToDelete = [
  'assessments',
  'marksRegisters',
  'incidents',
  'studentFollowUps',
  'subjectAssignments',
  'subjects'
];

async function deleteCollectionDocs(colName) {
  console.log(`\nFetching documents from '${colName}'...`);
  const snap = await getDocs(collection(db, colName));
  console.log(`Found ${snap.size} documents in '${colName}'.`);

  if (snap.empty) return;

  const docs = snap.docs;
  const chunkSize = 400;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + chunkSize);
    chunk.forEach(d => {
      batch.delete(d.ref);
    });
    await batch.commit();
    console.log(`Deleted batch of ${chunk.length} docs from '${colName}' (${i + chunk.length}/${docs.length})`);
  }
}

async function stripStudentAcademicAverage() {
  console.log(`\nInspecting 'students' collection to remove 'academicAverage'...`);
  const snap = await getDocs(collection(db, 'students'));
  console.log(`Found ${snap.size} students. Checking for 'academicAverage'...`);

  let countWithField = 0;
  const docsToUpdate = [];
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.academicAverage !== undefined) {
      countWithField++;
      docsToUpdate.push(d.ref);
    }
  });

  console.log(`${countWithField} students have 'academicAverage'. Stripping field...`);

  const chunkSize = 400;
  for (let i = 0; i < docsToUpdate.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = docsToUpdate.slice(i, i + chunkSize);
    chunk.forEach(ref => {
      batch.update(ref, { academicAverage: deleteField() });
    });
    await batch.commit();
    console.log(`Stripped 'academicAverage' in batch of ${chunk.length} (${i + chunk.length}/${docsToUpdate.length})`);
  }
}

async function stripStaffAssignedSubjects() {
  console.log(`\nInspecting 'staff' collection to remove 'assignedSubjects'...`);
  const snap = await getDocs(collection(db, 'staff'));
  console.log(`Found ${snap.size} staff. Checking for 'assignedSubjects'...`);

  let countWithField = 0;
  const docsToUpdate = [];
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.assignedSubjects !== undefined) {
      countWithField++;
      docsToUpdate.push(d.ref);
    }
  });

  console.log(`${countWithField} staff have 'assignedSubjects'. Stripping field...`);

  const chunkSize = 400;
  for (let i = 0; i < docsToUpdate.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = docsToUpdate.slice(i, i + chunkSize);
    chunk.forEach(ref => {
      batch.update(ref, { assignedSubjects: deleteField() });
    });
    await batch.commit();
    console.log(`Stripped 'assignedSubjects' in batch of ${chunk.length} (${i + chunk.length}/${docsToUpdate.length})`);
  }
}

async function runCleanup() {
  console.log('====================================================');
  console.log('Starting Phase 1 Firestore Academic Cleanup...');
  console.log('Target Project:', firebaseConfig.projectId);
  console.log('====================================================');

  for (const col of collectionsToDelete) {
    await deleteCollectionDocs(col);
  }

  await stripStudentAcademicAverage();
  await stripStaffAssignedSubjects();

  console.log('\n====================================================');
  console.log('Cleanup complete! Verifying remaining collections...');
  console.log('====================================================');
}

runCleanup().then(() => {
  console.log('Migration finished successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
