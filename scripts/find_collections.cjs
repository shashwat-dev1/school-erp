const fs = require('fs');

const files = [
  'C:/Projects/School/hanujai-erp/src/data/firebase/firestoreRepository.ts',
  'C:/Projects/School/hanujai-erp-mobile/src/services/firestoreService.ts'
];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const regex = /(?:collection|doc)\s*\(\s*(?:db|db!)\s*,\s*['"]([^'"]+)['"]/g;
  const colls = new Set();
  let m;
  while ((m = regex.exec(content)) !== null) {
    colls.add(m[1]);
  }
  console.log('File:', f);
  console.log(Array.from(colls).sort());
});
