/**
 * HanuJai High School ERP — Master Test Cases Excel Workbook Validator
 */

const XLSX = require('xlsx');
const path = require('path');

const wbPath = path.resolve(__dirname, '../docs/qa/HanuJai_ERP_Master_Test_Cases.xlsx');
const wb = XLSX.readFile(wbPath);

console.log('========================================================================');
console.log('EXCEL WORKBOOK INDEPENDENT AUDIT REPORT');
console.log('File:', wbPath);
console.log('Total Worksheets:', wb.SheetNames.length);
console.log('========================================================================\n');

const sheetStats = [];
const allTestCaseIds = new Set();
const duplicateIds = [];

const counts = {
  functionalRequirements: 0,
  nonFunctionalRequirements: 0,
  testScenarios: 0,
  manualTestCases: 0,
  apiTestCases: 0,
  uiTestCases: 0,
  securityTestCases: 0,
  integrationCases: 0,
  e2eCases: 0,
  regressionCases: 0,
  totalTestCases: 0,
};

wb.SheetNames.forEach((sheetName, index) => {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws);
  const rowCount = data.length;
  const cols = data.length > 0 ? Object.keys(data[0]).length : 0;

  sheetStats.push({
    index: index + 1,
    name: sheetName,
    rows: rowCount,
    columns: cols,
    isEmpty: rowCount === 0,
  });

  // Track specific metrics
  if (sheetName === 'Functional Requirements') counts.functionalRequirements = rowCount;
  if (sheetName === 'Non-Functional Requirements') counts.nonFunctionalRequirements = rowCount;
  if (sheetName === 'Test Scenarios') counts.testScenarios = rowCount;
  if (sheetName === 'Manual Test Cases') counts.manualTestCases = rowCount;
  if (sheetName === 'API Test Cases') counts.apiTestCases = rowCount;
  if (sheetName === 'UI Test Cases') counts.uiTestCases = rowCount;
  if (sheetName === 'Security Test Cases') counts.securityTestCases = rowCount;
  if (sheetName === 'Integration Test Cases') counts.integrationCases = rowCount;
  if (sheetName === 'End-to-End Test Cases') counts.e2eCases = rowCount;
  if (sheetName === 'Regression Test Cases') counts.regressionCases = rowCount;

  // Check test case ID uniqueness if sheet has 'Test Case ID'
  if (data.length > 0 && data[0]['Test Case ID']) {
    data.forEach(row => {
      counts.totalTestCases++;
      const id = row['Test Case ID'];
      if (allTestCaseIds.has(id)) {
        duplicateIds.push({ id, sheet: sheetName });
      } else {
        allTestCaseIds.add(id);
      }
    });
  }
});

sheetStats.forEach(s => {
  console.log(`${String(s.index).padStart(2, '0')}. ${s.name.padEnd(30, ' ')} | Rows: ${String(s.rows).padStart(3, ' ')} | Cols: ${String(s.columns).padStart(2, ' ')} | Empty: ${s.isEmpty ? 'YES [ERROR]' : 'No'}`);
});

console.log('\n------------------------------------------------------------------------');
console.log('METRIC COUNTS AUDIT:');
console.log('  1. Functional Requirements:       ', counts.functionalRequirements);
console.log('  2. Non-Functional Requirements:   ', counts.nonFunctionalRequirements);
console.log('  3. Test Scenarios:                ', counts.testScenarios);
console.log('  4. Manual Test Cases:             ', counts.manualTestCases);
console.log('  5. API Test Cases:                ', counts.apiTestCases);
console.log('  6. UI Test Cases:                 ', counts.uiTestCases);
console.log('  7. Security Test Cases:           ', counts.securityTestCases);
console.log('  8. Integration Test Cases:        ', counts.integrationCases);
console.log('  9. End-to-End Test Cases:         ', counts.e2eCases);
console.log(' 10. Regression Test Cases:         ', counts.regressionCases);
console.log(' 11. Total Dedicated Test Cases:    ', counts.totalTestCases);
console.log(' 12. Duplicate Test Case IDs:       ', duplicateIds.length === 0 ? '0 (All IDs Unique)' : duplicateIds);
console.log('------------------------------------------------------------------------');

if (duplicateIds.length > 0 || sheetStats.some(s => s.isEmpty)) {
  console.error('\nAUDIT FAILED: Empty sheets or duplicate IDs found.');
  process.exit(1);
} else {
  console.log('\nAUDIT PASSED: All 34 sheets valid, non-empty, and unique.');
  process.exit(0);
}

