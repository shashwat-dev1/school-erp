const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

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

async function inspectClasses() {
  const q = query(collection(db, 'classes'), limit(3));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
    console.log('Class ID:', d.id);
    console.log('Data:', d.data());
  });
  process.exit(0);
}

inspectClasses();

