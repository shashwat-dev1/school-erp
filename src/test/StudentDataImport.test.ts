import { describe, it, expect, beforeEach } from 'vitest';
import { DeveloperService, type SpreadsheetColumnMap } from '../services/developer/developerService';
import { demoRepository } from '../data/demo/demoRepository';
import { defaultDeveloperUser } from '../data/demo/seedData';
import { Permissions } from '../domain/permissions';
import type { StudentRecord, ClassSection, StaffUser } from '../domain/types';

describe('HANUJAI ERP — Student Data Import & Migration Engine', () => {
  beforeEach(async () => {
    localStorage.clear();
    if (demoRepository.resetDemoData) {
      await demoRepository.resetDemoData();
    }
  });

  const getDeveloper = (): StaffUser => defaultDeveloperUser;

  describe('1. Header Auto-Detection & Column Mapping', () => {
    it('accurately auto-maps standard 7-column school template headers', () => {
      const headers = [
        'Admission Number (SR No.)',
        'Roll Number',
        'Student Full Name',
        'Class',
        'Section',
        'Gender',
        'WhatsApp Mobile Number',
      ];

      const mapping = DeveloperService.detectColumnMapping(headers);

      expect(mapping.admissionNumber).toBe('Admission Number (SR No.)');
      expect(mapping.rollNumber).toBe('Roll Number');
      expect(mapping.fullName).toBe('Student Full Name');
      expect(mapping.class).toBe('Class');
      expect(mapping.section).toBe('Section');
      expect(mapping.gender).toBe('Gender');
      expect(mapping.mobile).toBe('WhatsApp Mobile Number');
    });

    it('auto-maps alternative header variations (e.g. SR No, Name of student, Phone)', () => {
      const headers = [
        'SR No',
        'Attendance register roll no',
        'Name of student',
        'Grade',
        'Sec',
        'Sex',
        'Parent Mobile',
      ];

      const mapping = DeveloperService.detectColumnMapping(headers);

      expect(mapping.admissionNumber).toBe('SR No');
      expect(mapping.rollNumber).toBe('Attendance register roll no');
      expect(mapping.fullName).toBe('Name of student');
      expect(mapping.class).toBe('Grade');
      expect(mapping.section).toBe('Sec');
      expect(mapping.gender).toBe('Sex');
      expect(mapping.mobile).toBe('Parent Mobile');
    });
  });

  describe('2. Phone & Data Normalization', () => {
    it('normalizes 10-digit, +91, and spaced Indian mobile numbers', () => {
      expect(DeveloperService.normalizePhone('9829155001')).toEqual({ clean: '9829155001', isValid: true });
      expect(DeveloperService.normalizePhone('+91 98291 55001')).toEqual({ clean: '9829155001', isValid: true });
      expect(DeveloperService.normalizePhone('919829155001')).toEqual({ clean: '9829155001', isValid: true });
      expect(DeveloperService.normalizePhone('09829155001')).toEqual({ clean: '9829155001', isValid: true });

      // Invalid cases
      expect(DeveloperService.normalizePhone('12345').isValid).toBe(false);
      expect(DeveloperService.normalizePhone('').isValid).toBe(false);
      expect(DeveloperService.normalizePhone('1829155001').isValid).toBe(false); // Does not start with 6-9
    });

    it('normalizes gender representations to M / F / Other', () => {
      expect(DeveloperService.normalizeGender('Male')).toBe('M');
      expect(DeveloperService.normalizeGender('m')).toBe('M');
      expect(DeveloperService.normalizeGender('Boy')).toBe('M');
      expect(DeveloperService.normalizeGender('Female')).toBe('F');
      expect(DeveloperService.normalizeGender('Girl')).toBe('F');
      expect(DeveloperService.normalizeGender('')).toBe('Other');
    });

    it('splits full names into firstName and lastName properly', () => {
      expect(DeveloperService.splitFullName('Aarav Sharma')).toEqual({ firstName: 'Aarav', lastName: 'Sharma' });
      expect(DeveloperService.splitFullName('Kabir Singh Verma')).toEqual({ firstName: 'Kabir', lastName: 'Singh Verma' });
      expect(DeveloperService.splitFullName('Ananya')).toEqual({ firstName: 'Ananya', lastName: '' });
    });
  });

  describe('3. Spreadsheet Validation & Duplicate Detection', () => {
    const existingClasses: ClassSection[] = [
      { id: 'class-10-a', label: 'Class 10-A', name: 'Class 10-A', grade: 10, section: 'A', roomNumber: '101', classTeacherId: 'staff-001', classTeacherName: 'Teacher', academicYearId: 'ay-2025-2026', studentCount: 35, maxCapacity: 40 },
    ];

    const mapping: SpreadsheetColumnMap = {
      admissionNumber: 'Admission No',
      rollNumber: 'Roll',
      fullName: 'Name',
      class: 'Class',
      section: 'Section',
      gender: 'Gender',
      mobile: 'Mobile',
    };

    it('flags rows with missing mandatory student names or admission numbers', () => {
      const rows = [
        { 'Admission No': '', 'Roll': '1', 'Name': 'Test Student', 'Class': '10', 'Section': 'A', 'Gender': 'M', 'Mobile': '9829155001' },
        { 'Admission No': 'ADM/001', 'Roll': '2', 'Name': '', 'Class': '10', 'Section': 'A', 'Gender': 'M', 'Mobile': '9829155002' },
      ];

      const summary = DeveloperService.validateSpreadsheet(rows, mapping, [], existingClasses);

      expect(summary.totalRows).toBe(2);
      expect(summary.invalidRows).toBe(2);
      expect(summary.records[0].validationErrors).toContain('Missing Admission Number (SR No.)');
      expect(summary.records[1].validationErrors).toContain('Missing Student Full Name');
    });

    it('flags duplicate admission numbers within the spreadsheet file', () => {
      const rows = [
        { 'Admission No': 'ADM/DUPLICATE/01', 'Roll': '1', 'Name': 'Student One', 'Class': '10', 'Section': 'A', 'Gender': 'M', 'Mobile': '9829155001' },
        { 'Admission No': 'ADM/DUPLICATE/01', 'Roll': '2', 'Name': 'Student Two', 'Class': '10', 'Section': 'A', 'Gender': 'F', 'Mobile': '9829155002' },
      ];

      const summary = DeveloperService.validateSpreadsheet(rows, mapping, [], existingClasses);

      expect(summary.duplicateRows).toBe(1);
      expect(summary.records[1].validationErrors.some(e => e.includes('Duplicate admission number'))).toBe(true);
    });

    it('matches existing students by admission number as primary identifier and flags updates', () => {
      const existing: StudentRecord[] = [
        {
          id: 'STU-10A-01',
          admissionNumber: 'ADM/2023/1042',
          rollNumber: 1,
          firstName: 'Aarav',
          lastName: 'Singhania',
          fullName: 'Aarav Singhania',
          gender: 'M',
          dateOfBirth: '2010-08-14',
          enrollmentDate: '2023-04-05',
          classId: 'class-10-a',
          classLabel: 'Class 10-A',
          academicYearId: 'ay-2025-2026',
          status: 'enrolled',
          guardianName: 'Shashwat',
          guardianRelation: 'Father',
          primaryPhone: '+91 90095 19718',
          residentialAddress: 'Jaipur',
          city: 'Jaipur',
          state: 'Rajasthan',
          pincode: '302001',
          attendancePercentage: 88.5,
          academicAverage: 81.0,
          activeFlags: [],
          createdAt: '2023-04-05T00:00:00Z',
          updatedAt: '2023-04-05T00:00:00Z',
        },
      ];

      // Upload with updated mobile number
      const rows = [
        {
          'Admission No': 'ADM/2023/1042',
          'Roll': '1',
          'Name': 'Aarav Singhania',
          'Class': '10',
          'Section': 'A',
          'Gender': 'M',
          'Mobile': '9829155099', // Updated phone
        },
      ];

      const summary = DeveloperService.validateSpreadsheet(rows, mapping, existing, existingClasses);

      expect(summary.updateRows).toBe(1);
      expect(summary.records[0].status).toBe('update');
      expect(summary.records[0].matchingStudentId).toBe('STU-10A-01');
      expect(summary.records[0].diffFields?.some(d => d.field === 'primaryPhone')).toBe(true);
    });
  });

  describe('4. Safe Execution & Rollback Workflows', () => {
    it('safely updates existing student without overwriting non-empty fields with blank Excel cells', async () => {
      const dev = getDeveloper();
      const allStudentsRes = await demoRepository.getStudents({ limit: 10 });
      const targetStudent = allStudentsRes.items[0];

      expect(targetStudent.guardianName).toBeTruthy();
      expect(targetStudent.residentialAddress).toBeTruthy();

      // Spreadsheet row with blank guardianName and address
      const mapping: SpreadsheetColumnMap = {
        admissionNumber: 'Admission No',
        rollNumber: 'Roll',
        fullName: 'Name',
        class: 'Class',
        section: 'Section',
        gender: 'Gender',
        mobile: 'Mobile',
      };

      const rows = [
        {
          'Admission No': targetStudent.admissionNumber,
          'Roll': String(targetStudent.rollNumber),
          'Name': targetStudent.fullName,
          'Class': '10',
          'Section': 'A',
          'Gender': targetStudent.gender,
          'Mobile': '9829155999', // New mobile
        },
      ];

      const classes = await demoRepository.getClasses();
      const summary = DeveloperService.validateSpreadsheet(rows, mapping, allStudentsRes.items, classes);

      const result = await DeveloperService.executeImport(
        summary,
        'update_or_add',
        'test_update.xlsx',
        dev,
        demoRepository
      );

      expect(result.updatedCount).toBe(1);

      // Verify that non-empty fields were NOT overwritten by blank cells
      const updated = await demoRepository.getStudentById(targetStudent.id);
      expect(updated).not.toBeNull();
      expect(updated!.guardianName).toBe(targetStudent.guardianName); // Preserved!
      expect(updated!.residentialAddress).toBe(targetStudent.residentialAddress); // Preserved!
      expect(updated!.primaryPhone).toContain('9829155999'); // Updated!
    });

    it('requires explicit "RESTORE" confirmation to revert an import snapshot', async () => {
      const dev = getDeveloper();

      const snapshot = {
        id: 'snap-test-01',
        batchId: 'BATCH-TEST',
        timestamp: new Date().toISOString(),
        filename: 'test.xlsx',
        mode: 'update_or_add' as const,
        operatorId: dev.id,
        operatorName: dev.name,
        description: 'Test snapshot',
        studentCountBefore: 10,
        createdStudentIds: [],
        previousStudentStates: [],
      };

      DeveloperService.saveSnapshot(snapshot);

      // Attempting with wrong confirmation text
      await expect(
        DeveloperService.rollbackSnapshot('snap-test-01', 'yes', dev, demoRepository)
      ).rejects.toThrow(/Rollback requires exact confirmation text "RESTORE"/i);

      // Attempting with exact "RESTORE"
      const res = await DeveloperService.rollbackSnapshot('snap-test-01', 'RESTORE', dev, demoRepository);
      expect(res.revertedCount).toBe(0);
    });
  });

  describe('5. Approved 7-Column Schema & Header Verification Suite', () => {
    it('generates the official 7-column template with sample data and guidelines sheet', () => {
      const wb = DeveloperService.generateStudentTemplateWorkbook();
      expect(wb.SheetNames).toContain('Student Records');
      expect(wb.SheetNames).toContain('Sample Reference');

      expect(DeveloperService.OFFICIAL_TEMPLATE_COLUMNS).toHaveLength(7);
      expect(DeveloperService.OFFICIAL_TEMPLATE_COLUMNS).toEqual([
        'Admission Number (SR No.)',
        'Roll Number',
        'Student Full Name',
        'Class',
        'Section',
        'Gender',
        'WhatsApp Mobile Number',
      ]);
    });

    it('accurately parses date strings across ISO, Indian DMY, and numeric formats', () => {
      expect(DeveloperService.normalizeDate('2010-08-14')).toEqual({ iso: '2010-08-14', isValid: true });
      expect(DeveloperService.normalizeDate('14/08/2010')).toEqual({ iso: '2010-08-14', isValid: true });
      expect(DeveloperService.normalizeDate('14-08-2010')).toEqual({ iso: '2010-08-14', isValid: true });
      expect(DeveloperService.normalizeDate('invalid-date').isValid).toBe(false);
      expect(DeveloperService.normalizeDate('').isValid).toBe(false);
    });

    it('strictly checks required columns during header verification', () => {
      const validHeaders = [
        'Admission Number (SR No.)',
        'Roll Number',
        'Student Full Name',
        'Class',
        'Section',
        'Gender',
        'WhatsApp Mobile Number',
      ];

      const res = DeveloperService.verifySpreadsheetHeaders(validHeaders);
      expect(res.isValid).toBe(true);
      expect(res.missingRequiredColumns).toHaveLength(0);

      // Missing required admission number & mobile
      const incompleteHeaders = [
        'Student Full Name',
        'Class',
        'Section',
      ];

      const incompleteRes = DeveloperService.verifySpreadsheetHeaders(incompleteHeaders);
      expect(incompleteRes.isValid).toBe(false);
      expect(incompleteRes.missingRequiredColumns).toContain('Admission Number (SR No.)');
      expect(incompleteRes.missingRequiredColumns).toContain('WhatsApp Mobile Number');
    });

    it('allows Admin Office and Developer to import students while forbidding Principal', () => {
      const dev = getDeveloper();
      const admin = { ...dev, id: 'staff-admin', role: 'admin' as const, name: 'Admin Office' };
      const principal = { ...dev, id: 'staff-principal', role: 'principal' as const, name: 'Principal' };

      expect(Permissions.canImportStudents(dev)).toBe(true);
      expect(Permissions.canImportStudents(admin)).toBe(true);
      expect(Permissions.canImportStudents(principal)).toBe(false);
      expect(Permissions.canImportStudents(null)).toBe(false);
    });
  });
});
