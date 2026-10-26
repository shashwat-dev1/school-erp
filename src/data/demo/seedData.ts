/**
 * HanuJai High School ERP — Deterministic Synthetic Seed Data
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Strict single-school planning scale: Classes 1 to 10 (Sections A & B = 20 sections).
 * Exactly 1,000 total enrolled students (20 sections × 50 students/section).
 * Deterministic generation ensures 100% internal mathematical consistency.
 */

import type {
  SchoolSettings,
  AcademicYear,
  ClassSection,
  Subject,
  SubjectAssignment,
  StaffUser,
  StudentRecord,
  AssessmentCycle,
  MarksRegister,
  AttendanceSession,
  AttendanceCorrection,
  IncidentRecord,
  AuditEvent,
  DailyAttendanceRecord,
  StudentMarkEntry,
} from '../../domain/types';
import { INSTITUTIONAL_CONFIG, calculateGrade, getSchoolLocalDate } from '../../domain/policy';

// ============================================================================
// 1. School Settings & Identity (Configurable Demo Defaults)
// ============================================================================
export const initialSettings: SchoolSettings = {
  id: 'hhs-settings-jaipur',
  institutionName: INSTITUTIONAL_CONFIG.institutionName,
  institutionShortName: INSTITUTIONAL_CONFIG.institutionShortName,
  tagline: 'Vidya Dadati Vinayam • Excellence in Character & Learning',
  campusLocation: INSTITUTIONAL_CONFIG.campusLocation,
  foundedYear: INSTITUTIONAL_CONFIG.foundedYear,
  affiliationNumber: INSTITUTIONAL_CONFIG.cbseAffiliationNumber,
  contactEmail: INSTITUTIONAL_CONFIG.contactEmail,
  contactPhone: INSTITUTIONAL_CONFIG.contactPhone,
  activeAcademicYearId: INSTITUTIONAL_CONFIG.activeAcademicYearId,
  attendancePolicy: {
    dailyMarkingWindowStart: INSTITUTIONAL_CONFIG.attendance.dailyMarkingWindowStart,
    dailyMarkingWindowEnd: INSTITUTIONAL_CONFIG.attendance.dailyMarkingWindowEnd,
    gracePeriodMinutes: INSTITUTIONAL_CONFIG.attendance.gracePeriodMinutes,
    minimumAttendancePercentage: INSTITUTIONAL_CONFIG.attendance.minimumAttendancePercentage,
    dualCustodyCorrectionRequired: INSTITUTIONAL_CONFIG.attendance.dualCustodyCorrectionRequired,
  },
};

// ============================================================================
// 2. Academic Session Calendar
// ============================================================================
export const initialAcademicYears: AcademicYear[] = [
  {
    id: 'year-2025-2026',
    label: '2025–2026',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    isCurrent: true,
    status: 'active',
    terms: [
      { id: 'term-1', name: 'Term 1 (Apr–Sep)', startDate: '2025-04-01', endDate: '2025-09-30' },
      { id: 'term-2', name: 'Term 2 (Oct–Mar)', startDate: '2025-10-01', endDate: '2026-03-31' },
    ],
  },
  {
    id: 'year-2024-2025',
    label: '2024–2025',
    startDate: '2024-04-01',
    endDate: '2025-03-31',
    isCurrent: false,
    status: 'archived',
    terms: [
      { id: 'term-1-prev', name: 'Term 1 (Apr–Sep)', startDate: '2024-04-01', endDate: '2024-09-30' },
      { id: 'term-2-prev', name: 'Term 2 (Oct–Mar)', startDate: '2024-10-01', endDate: '2025-03-31' },
    ],
  },
];

export const initialAcademicYear = initialAcademicYears[0];

// ============================================================================
// 3. Faculty Staff Directory (22 Distinct Staff Members adhering to Rule SEC-108)
// ============================================================================
export const initialStaff: StaffUser[] = [
  // 1. Principal & Executive Leadership
  {
    id: 'staff-001',
    email: 'principal@hanujai.edu.in',
    name: 'Dr. Vikramaditya Sharma',
    role: 'principal',
    employeeCode: 'EMP-1998-001',
    designation: 'Principal & Head of School',
    department: 'School Administration',
    phone: '+91 98290 11001',
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
  },
  // 2. Class Teacher (Class 10-A) - Senior Hindi & Moral Education Faculty
  {
    id: 'staff-002',
    email: 'rajeshwar.choudhary@hanujai.edu.in',
    name: 'Shri Rajeshwar Choudhary',
    role: 'class_teacher',
    employeeCode: 'EMP-2012-045',
    designation: 'Senior Class 10-A Tutor & Faculty',
    department: 'Languages',
    phone: '+91 98290 33045',
    assignedClassId: 'class-10-a',
    assignedClassLabel: 'Class 10-A',
    assignedSubjects: ['sub-hin-10', 'sub-hin-09'],
    assignedClasses: ['class-10-a', 'class-10-b'],
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
  },
  // 3. Class Teacher (Class 10-A) & Mathematics Faculty (Dual-Responsibility Teacher)
  {
    id: 'staff-003',
    email: 'alok.saxena@hanujai.edu.in',
    name: 'Shri Alok Saxena',
    role: 'class_teacher',
    employeeCode: 'EMP-2016-088',
    designation: 'Class 10-A Tutor & Mathematics Faculty',
    department: 'Mathematics',
    phone: '+91 98290 44088',
    assignedClassId: 'class-10-a',
    assignedClassLabel: 'Class 10-A',
    assignedSubjects: ['sub-math-10', 'sub-math-09'],
    assignedClasses: ['class-10-a', 'class-10-b', 'class-09-a', 'class-09-b'],
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
  },
  // 3. Dedicated Subject Teacher: Science Faculty
  {
    id: 'staff-004',
    email: 'priyanka.sen@hanujai.edu.in',
    name: 'Smt. Priyanka Sen',
    role: 'subject_teacher',
    employeeCode: 'EMP-2018-092',
    designation: 'TGT Science Faculty',
    department: 'Science',
    phone: '+91 98290 66092',
    assignedSubjects: ['sub-sci-10', 'sub-sci-09'],
    assignedClasses: ['class-10-a', 'class-10-b', 'class-09-a', 'class-09-b'],
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
  },
  // 5 to 22: Individual Dedicated Class Teachers for each remaining section (SEC-108)
  { id: 'staff-005', email: 'tutor.10b@hanujai.edu.in', name: 'Smt. Sunita Verma', role: 'class_teacher', employeeCode: 'EMP-2014-052', designation: 'PGT Chemistry', department: 'Science', phone: '+91 98290 55005', assignedClassId: 'class-10-b', assignedClassLabel: 'Class 10-B', assignedSubjects: ['sub-sci-10'], assignedClasses: ['class-10-a', 'class-10-b'], status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-006', email: 'tutor.09a@hanujai.edu.in', name: 'Shri Dinesh Rathore', role: 'class_teacher', employeeCode: 'EMP-2015-061', designation: 'TGT Social Studies', department: 'Social Sciences', phone: '+91 98290 55006', assignedClassId: 'class-09-a', assignedClassLabel: 'Class 09-A', assignedSubjects: ['sub-sst-10'], assignedClasses: ['class-09-a'], status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-007', email: 'tutor.09b@hanujai.edu.in', name: 'Smt. Kavita Shekhawat', role: 'class_teacher', employeeCode: 'EMP-2017-074', designation: 'TGT English', department: 'Languages', phone: '+91 98290 55007', assignedClassId: 'class-09-b', assignedClassLabel: 'Class 09-B', assignedSubjects: ['sub-eng-10'], assignedClasses: ['class-09-b'], status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-008', email: 'tutor.08a@hanujai.edu.in', name: 'Shri Mahesh Tiwari', role: 'class_teacher', employeeCode: 'EMP-2018-081', designation: 'TGT Science', department: 'Science', phone: '+91 98290 55008', assignedClassId: 'class-08-a', assignedClassLabel: 'Class 08-A', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-009', email: 'tutor.08b@hanujai.edu.in', name: 'Smt. Pooja Khandelwal', role: 'class_teacher', employeeCode: 'EMP-2019-093', designation: 'TGT Mathematics', department: 'Mathematics', phone: '+91 98290 55009', assignedClassId: 'class-08-b', assignedClassLabel: 'Class 08-B', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-010', email: 'tutor.07a@hanujai.edu.in', name: 'Shri Rameshwar Dayal', role: 'class_teacher', employeeCode: 'EMP-2016-068', designation: 'TGT Hindi', department: 'Languages', phone: '+91 98290 55010', assignedClassId: 'class-07-a', assignedClassLabel: 'Class 07-A', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-011', email: 'tutor.07b@hanujai.edu.in', name: 'Smt. Anju Bhargava', role: 'class_teacher', employeeCode: 'EMP-2018-089', designation: 'TGT Sanskrit', department: 'Languages', phone: '+91 98290 55011', assignedClassId: 'class-07-b', assignedClassLabel: 'Class 07-B', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-012', email: 'tutor.06a@hanujai.edu.in', name: 'Shri Gopal Soni', role: 'class_teacher', employeeCode: 'EMP-2017-076', designation: 'TGT General Science', department: 'Science', phone: '+91 98290 55012', assignedClassId: 'class-06-a', assignedClassLabel: 'Class 06-A', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-013', email: 'tutor.06b@hanujai.edu.in', name: 'Smt. Seema Rawat', role: 'class_teacher', employeeCode: 'EMP-2020-104', designation: 'TGT Social Studies', department: 'Social Sciences', phone: '+91 98290 55013', assignedClassId: 'class-06-b', assignedClassLabel: 'Class 06-B', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-014', email: 'tutor.05a@hanujai.edu.in', name: 'Shri Naresh Agarwal', role: 'class_teacher', employeeCode: 'EMP-2015-058', designation: 'PRT Senior', department: 'Primary', phone: '+91 98290 55014', assignedClassId: 'class-05-a', assignedClassLabel: 'Class 05-A', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-015', email: 'tutor.05b@hanujai.edu.in', name: 'Smt. Rekha Jain', role: 'class_teacher', employeeCode: 'EMP-2019-095', designation: 'PRT', department: 'Primary', phone: '+91 98290 55015', assignedClassId: 'class-05-b', assignedClassLabel: 'Class 05-B', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-016', email: 'tutor.04a@hanujai.edu.in', name: 'Shri Vinod Mathur', role: 'class_teacher', employeeCode: 'EMP-2018-085', designation: 'PRT', department: 'Primary', phone: '+91 98290 55016', assignedClassId: 'class-04-a', assignedClassLabel: 'Class 04-A', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-017', email: 'tutor.04b@hanujai.edu.in', name: 'Smt. Deepa Goyal', role: 'class_teacher', employeeCode: 'EMP-2021-112', designation: 'PRT', department: 'Primary', phone: '+91 98290 55017', assignedClassId: 'class-04-b', assignedClassLabel: 'Class 04-B', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-018', email: 'tutor.03a@hanujai.edu.in', name: 'Shri Ashok Tanwar', role: 'class_teacher', employeeCode: 'EMP-2016-069', designation: 'PRT', department: 'Primary', phone: '+91 98290 55018', assignedClassId: 'class-03-a', assignedClassLabel: 'Class 03-A', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-019', email: 'tutor.03b@hanujai.edu.in', name: 'Smt. Vandana Shrimali', role: 'class_teacher', employeeCode: 'EMP-2020-108', designation: 'PRT', department: 'Primary', phone: '+91 98290 55019', assignedClassId: 'class-03-b', assignedClassLabel: 'Class 03-B', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-020', email: 'tutor.02a@hanujai.edu.in', name: 'Shri Hemant Kulshreshtha', role: 'class_teacher', employeeCode: 'EMP-2017-078', designation: 'PRT', department: 'Primary', phone: '+91 98290 55020', assignedClassId: 'class-02-a', assignedClassLabel: 'Class 02-A', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-021', email: 'tutor.02b@hanujai.edu.in', name: 'Smt. Neetu Meena', role: 'class_teacher', employeeCode: 'EMP-2021-115', designation: 'PRT', department: 'Primary', phone: '+91 98290 55021', assignedClassId: 'class-02-b', assignedClassLabel: 'Class 02-B', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-022', email: 'tutor.01a@hanujai.edu.in', name: 'Smt. Suman Lata', role: 'class_teacher', employeeCode: 'EMP-2014-049', designation: 'Headmistress Primary', department: 'Primary', phone: '+91 98290 55022', assignedClassId: 'class-01-a', assignedClassLabel: 'Class 01-A', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
  { id: 'staff-023', email: 'tutor.01b@hanujai.edu.in', name: 'Smt. Bhavna Pareek', role: 'class_teacher', employeeCode: 'EMP-2022-124', designation: 'PRT Junior', department: 'Primary', phone: '+91 98290 55023', assignedClassId: 'class-01-b', assignedClassLabel: 'Class 01-B', status: 'active', createdAt: '2023-01-01T00:00:00Z' },
];

// ============================================================================
// 4. Academic Structure: Classes 1 to 10 (Sections A & B = 20 Sections)
// ============================================================================
export const initialClasses: ClassSection[] = [
  { id: 'class-10-a', grade: 10, section: 'A', label: 'Class 10-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-003', classTeacherName: 'Shri Alok Saxena', roomNumber: 'Room 301', studentCount: 50, maxCapacity: 50 },
  { id: 'class-10-b', grade: 10, section: 'B', label: 'Class 10-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-005', classTeacherName: 'Smt. Sunita Verma', roomNumber: 'Room 302', studentCount: 50, maxCapacity: 50 },
  { id: 'class-09-a', grade: 9,  section: 'A', label: 'Class 09-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-006', classTeacherName: 'Shri Dinesh Rathore', roomNumber: 'Room 201', studentCount: 50, maxCapacity: 50 },
  { id: 'class-09-b', grade: 9,  section: 'B', label: 'Class 09-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-007', classTeacherName: 'Smt. Kavita Shekhawat', roomNumber: 'Room 202', studentCount: 50, maxCapacity: 50 },
  { id: 'class-08-a', grade: 8,  section: 'A', label: 'Class 08-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-008', classTeacherName: 'Shri Mahesh Tiwari', roomNumber: 'Room 101', studentCount: 50, maxCapacity: 50 },
  { id: 'class-08-b', grade: 8,  section: 'B', label: 'Class 08-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-009', classTeacherName: 'Smt. Pooja Khandelwal', roomNumber: 'Room 102', studentCount: 50, maxCapacity: 50 },
  { id: 'class-07-a', grade: 7,  section: 'A', label: 'Class 07-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-010', classTeacherName: 'Shri Rameshwar Dayal', roomNumber: 'Room 103', studentCount: 50, maxCapacity: 50 },
  { id: 'class-07-b', grade: 7,  section: 'B', label: 'Class 07-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-011', classTeacherName: 'Smt. Anju Bhargava', roomNumber: 'Room 104', studentCount: 50, maxCapacity: 50 },
  { id: 'class-06-a', grade: 6,  section: 'A', label: 'Class 06-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-012', classTeacherName: 'Shri Gopal Soni', roomNumber: 'Room 105', studentCount: 50, maxCapacity: 50 },
  { id: 'class-06-b', grade: 6,  section: 'B', label: 'Class 06-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-013', classTeacherName: 'Smt. Seema Rawat', roomNumber: 'Room 106', studentCount: 50, maxCapacity: 50 },
  { id: 'class-05-a', grade: 5,  section: 'A', label: 'Class 05-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-014', classTeacherName: 'Shri Naresh Agarwal', roomNumber: 'Room 001', studentCount: 50, maxCapacity: 50 },
  { id: 'class-05-b', grade: 5,  section: 'B', label: 'Class 05-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-015', classTeacherName: 'Smt. Rekha Jain', roomNumber: 'Room 002', studentCount: 50, maxCapacity: 50 },
  { id: 'class-04-a', grade: 4,  section: 'A', label: 'Class 04-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-016', classTeacherName: 'Shri Vinod Mathur', roomNumber: 'Room P01', studentCount: 50, maxCapacity: 50 },
  { id: 'class-04-b', grade: 4,  section: 'B', label: 'Class 04-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-017', classTeacherName: 'Smt. Deepa Goyal', roomNumber: 'Room P02', studentCount: 50, maxCapacity: 50 },
  { id: 'class-03-a', grade: 3,  section: 'A', label: 'Class 03-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-018', classTeacherName: 'Shri Ashok Tanwar', roomNumber: 'Room P03', studentCount: 50, maxCapacity: 50 },
  { id: 'class-03-b', grade: 3,  section: 'B', label: 'Class 03-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-019', classTeacherName: 'Smt. Vandana Shrimali', roomNumber: 'Room P04', studentCount: 50, maxCapacity: 50 },
  { id: 'class-02-a', grade: 2,  section: 'A', label: 'Class 02-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-020', classTeacherName: 'Shri Hemant Kulshreshtha', roomNumber: 'Room P05', studentCount: 50, maxCapacity: 50 },
  { id: 'class-02-b', grade: 2,  section: 'B', label: 'Class 02-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-021', classTeacherName: 'Smt. Neetu Meena', roomNumber: 'Room P06', studentCount: 50, maxCapacity: 50 },
  { id: 'class-01-a', grade: 1,  section: 'A', label: 'Class 01-A', academicYearId: 'year-2025-2026', classTeacherId: 'staff-022', classTeacherName: 'Smt. Suman Lata', roomNumber: 'Room P07', studentCount: 50, maxCapacity: 50 },
  { id: 'class-01-b', grade: 1,  section: 'B', label: 'Class 01-B', academicYearId: 'year-2025-2026', classTeacherId: 'staff-023', classTeacherName: 'Smt. Bhavna Pareek', roomNumber: 'Room P08', studentCount: 50, maxCapacity: 50 },
];

// ============================================================================
// 5. Subjects & Faculty Allocations
// ============================================================================
export const initialSubjects: Subject[] = [
  { id: 'sub-math-10', code: 'MATH-10', name: 'Mathematics', gradeLevel: 10, type: 'core' },
  { id: 'sub-sci-10',  code: 'SCI-10',  name: 'Science', gradeLevel: 10, type: 'core' },
  { id: 'sub-eng-10',  code: 'ENG-10',  name: 'English Language & Lit', gradeLevel: 10, type: 'language' },
  { id: 'sub-hindi-10',code: 'HIN-10',  name: 'Hindi Course A', gradeLevel: 10, type: 'language' },
  { id: 'sub-sst-10',  code: 'SST-10',  name: 'Social Science', gradeLevel: 10, type: 'core' },
  { id: 'sub-math-09', code: 'MATH-09', name: 'Mathematics', gradeLevel: 9,  type: 'core' },
  { id: 'sub-sci-09',  code: 'SCI-09',  name: 'Science', gradeLevel: 9,  type: 'core' },
  { id: 'sub-hindi-09',code: 'HIN-09',  name: 'Hindi Course A', gradeLevel: 9,  type: 'language' },
];

export const initialSubjectAssignments: SubjectAssignment[] = [
  { id: 'assign-01', subjectId: 'sub-math-10', subjectName: 'Mathematics', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-003', teacherName: 'Shri Alok Saxena', academicYearId: 'year-2025-2026' },
  { id: 'assign-02', subjectId: 'sub-math-10', subjectName: 'Mathematics', classId: 'class-10-b', classLabel: 'Class 10-B', teacherId: 'staff-003', teacherName: 'Shri Alok Saxena', academicYearId: 'year-2025-2026' },
  { id: 'assign-03', subjectId: 'sub-sci-10',  subjectName: 'Science', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-004', teacherName: 'Smt. Priyanka Sen', academicYearId: 'year-2025-2026' },
  { id: 'assign-04', subjectId: 'sub-sci-10',  subjectName: 'Science', classId: 'class-10-b', classLabel: 'Class 10-B', teacherId: 'staff-004', teacherName: 'Smt. Priyanka Sen', academicYearId: 'year-2025-2026' },
  { id: 'assign-05', subjectId: 'sub-hindi-10', subjectName: 'Hindi Course A', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-010', teacherName: 'Shri Rameshwar Dayal', academicYearId: 'year-2025-2026' },
  { id: 'assign-06', subjectId: 'sub-eng-10',  subjectName: 'English Language & Lit', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-007', teacherName: 'Smt. Kavita Shekhawat', academicYearId: 'year-2025-2026' },
  { id: 'assign-07', subjectId: 'sub-sst-10',  subjectName: 'Social Science', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-006', teacherName: 'Shri Dinesh Rathore', academicYearId: 'year-2025-2026' },
  { id: 'assign-08', subjectId: 'sub-math-09', subjectName: 'Mathematics', classId: 'class-09-a', classLabel: 'Class 09-A', teacherId: 'staff-003', teacherName: 'Shri Alok Saxena', academicYearId: 'year-2025-2026' },
  { id: 'assign-09', subjectId: 'sub-math-09', subjectName: 'Mathematics', classId: 'class-09-b', classLabel: 'Class 09-B', teacherId: 'staff-003', teacherName: 'Shri Alok Saxena', academicYearId: 'year-2025-2026' },
];

// ============================================================================
// 6. Deterministic Synthetic Student Generation (760 Students across 20 Sections)
// ============================================================================
const FIRST_NAMES_M = ['Aarav', 'Rohan', 'Kabir', 'Ishaan', 'Harshvardhan', 'Devendra', 'Karan', 'Aditya', 'Varun', 'Nikhil', 'Manish', 'Siddharth', 'Arjun', 'Pranav', 'Yash', 'Gaurav', 'Kartik', 'Vivek', 'Ayush'];
const FIRST_NAMES_F = ['Ananya', 'Diya', 'Priya', 'Tanvi', 'Meera', 'Sneha', 'Riya', 'Kavya', 'Pooja', 'Shreya', 'Anushka', 'Ishita', 'Neha', 'Divya', 'Bhavya', 'Pallavi', 'Srishti', 'Deepika', 'Simran'];
const LAST_NAMES = ['Singhania', 'Sharma', 'Mehta', 'Patel', 'Verma', 'Gupta', 'Sen', 'Shekhawat', 'Joshi', 'Rajput', 'Bhati', 'Chauhan', 'Agarwal', 'Choudhary', 'Rathore', 'Tiwari', 'Khandelwal', 'Dayal', 'Rawat'];
const COLONIES = ['Malviya Nagar', 'Vidyadhar Nagar', 'Mansarovar', 'Vaishali Nagar', 'Civil Lines', 'Bani Park', 'C-Scheme', 'Raja Park', 'Tonk Road', 'Jhotwara'];

function generateSyntheticStudents(): StudentRecord[] {
  const students: StudentRecord[] = [];

  // Seed baseline explicit students for Class 10-A (Preserves existing tests and UI links)
  const baseline10A: Partial<StudentRecord>[] = [
    { id: 'STU-10A-01', rollNumber: 1, firstName: 'Aarav', lastName: 'Singhania', gender: 'M', attendancePercentage: 88.5, academicAverage: 81.0, guardianName: 'Shashwat', primaryPhone: '+91 90095 19718', activeFlags: [
      { id: 'flag-01', code: 'ATT-01', type: 'attendance', severity: 'alert', title: '3 Consecutive Absences', reason: 'Rule #ATT-01: Absent on consecutive operational days without parent medical note.', triggeredAt: '2026-10-20T09:30:00Z', resolved: false },
      { id: 'flag-02', code: 'ACAD-04', type: 'academic', severity: 'warning', title: 'Performance Decline (-28% in Math)', reason: 'Rule #ACAD-04: Drop from 22/25 (88%) in UT 1 to 15/25 (60%) in UT 2 in Mathematics.', triggeredAt: '2026-10-18T14:15:00Z', resolved: false },
    ]},
    { id: 'STU-10A-02', rollNumber: 2, firstName: 'Ananya', lastName: 'Sharma', gender: 'F', attendancePercentage: 96.0, academicAverage: 92.5, guardianName: 'Nitin', primaryPhone: '+91 89520 31365', activeFlags: [] },
    { id: 'STU-10A-03', rollNumber: 3, firstName: 'Rohan', lastName: 'Mehta', gender: 'M', attendancePercentage: 91.5, academicAverage: 78.0, guardianName: 'Vijaya', primaryPhone: '+91 89479 03712', activeFlags: [] },
    { id: 'STU-10A-04', rollNumber: 4, firstName: 'Diya', lastName: 'Patel', gender: 'F', attendancePercentage: 94.0, academicAverage: 88.0, guardianName: 'Bhavesh Patel', primaryPhone: '+91 98291 55004', activeFlags: [] },
    { id: 'STU-10A-05', rollNumber: 5, firstName: 'Kabir', lastName: 'Verma', gender: 'M', attendancePercentage: 72.0, academicAverage: 65.0, guardianName: 'Ashok Verma', primaryPhone: '+91 98291 55005', activeFlags: [
      { id: 'flag-03', code: 'ATT-03', type: 'attendance', severity: 'alert', title: 'Below 75% CBSE Threshold', reason: 'Rule #ATT-03: Attendance at 72.0% is below the mandatory 75% requirement.', triggeredAt: '2026-10-20T08:00:00Z', resolved: false }
    ]},
    { id: 'STU-10A-06', rollNumber: 6, firstName: 'Ishaan', lastName: 'Gupta', gender: 'M', attendancePercentage: 97.0, academicAverage: 94.0, guardianName: 'Rajeev Gupta', primaryPhone: '+91 98291 55006', activeFlags: [] },
    { id: 'STU-10A-07', rollNumber: 7, firstName: 'Priya', lastName: 'Sen', gender: 'F', attendancePercentage: 89.0, academicAverage: 74.0, guardianName: 'Arun Sen', primaryPhone: '+91 98291 55007', activeFlags: [] },
    { id: 'STU-10A-08', rollNumber: 8, firstName: 'Tanvi', lastName: 'Shekhawat', gender: 'F', attendancePercentage: 93.0, academicAverage: 91.0, guardianName: 'Bhanwar Singh Shekhawat', primaryPhone: '+91 98291 55008', activeFlags: [] },
    { id: 'STU-10A-09', rollNumber: 9, firstName: 'Harshvardhan', lastName: 'Joshi', gender: 'M', attendancePercentage: 81.0, academicAverage: 69.5, guardianName: 'Manoj Joshi', primaryPhone: '+91 98291 55009', activeFlags: [] },
    { id: 'STU-10A-10', rollNumber: 10, firstName: 'Meera', lastName: 'Rajput', gender: 'F', attendancePercentage: 95.0, academicAverage: 86.0, guardianName: 'Surendra Rajput', primaryPhone: '+91 98291 55010', activeFlags: [] },
    { id: 'STU-10A-11', rollNumber: 11, firstName: 'Devendra', lastName: 'Bhati', gender: 'M', attendancePercentage: 74.0, academicAverage: 73.0, guardianName: 'Govind Bhati', primaryPhone: '+91 98291 55011', activeFlags: [
      { id: 'flag-05', code: 'ATT-03', type: 'attendance', severity: 'alert', title: 'Below 75% CBSE Threshold', reason: 'Rule #ATT-03: Attendance at 74.0% is below the mandatory 75% requirement.', triggeredAt: '2026-10-20T08:00:00Z', resolved: false }
    ]},
    { id: 'STU-10A-12', rollNumber: 12, firstName: 'Riya', lastName: 'Choudhary', gender: 'F', attendancePercentage: 92.0, academicAverage: 84.0, guardianName: 'Mahaveer Choudhary', primaryPhone: '+91 98291 55012', activeFlags: [] },
  ];

  // Baseline explicit students for Class 10-B
  const baseline10B: Partial<StudentRecord>[] = [
    { id: 'STU-10B-01', rollNumber: 1, firstName: 'Karan', lastName: 'Chauhan', gender: 'M', attendancePercentage: 92.0, academicAverage: 85.0, guardianName: 'Vikram Chauhan', primaryPhone: '+91 98292 66001', activeFlags: [] },
    { id: 'STU-10B-02', rollNumber: 2, firstName: 'Sneha', lastName: 'Agarwal', gender: 'F', attendancePercentage: 95.0, academicAverage: 89.0, guardianName: 'Sunil Agarwal', primaryPhone: '+91 98292 66002', activeFlags: [] },
  ];

  // Populate all 20 sections with 50 students each (Total: 1,000 students)
  initialClasses.forEach((cls) => {
    const gradeNum = cls.grade;
    const sec = cls.section;
    const prefix = `STU-${gradeNum.toString().padStart(2, '0')}${sec}`;

    for (let roll = 1; roll <= 50; roll++) {
      const studentId = `${prefix}-${roll.toString().padStart(2, '0')}`;
      
      // Check if baseline override exists
      if (cls.id === 'class-10-a') {
        const found = baseline10A.find(b => b.rollNumber === roll);
        if (found) {
          students.push({
            id: found.id || studentId,
            admissionNumber: `ADM/2023/${1000 + roll}`,
            rollNumber: roll,
            firstName: found.firstName || 'Student',
            lastName: found.lastName || 'LastName',
            fullName: `${found.firstName} ${found.lastName}`,
            gender: found.gender || (roll % 2 === 0 ? 'F' : 'M'),
            dateOfBirth: '2010-08-14',
            enrollmentDate: '2023-04-05',
            classId: cls.id,
            classLabel: cls.label,
            academicYearId: 'year-2025-2026',
            status: 'enrolled',
            guardianName: found.guardianName || `${found.lastName} Guardian`,
            guardianRelation: 'Father',
            primaryPhone: found.primaryPhone || `+91 98291 ${55000 + roll}`,
            residentialAddress: `Flat ${400 + roll}, Royal Palms, Malviya Nagar, Jaipur`,
            city: 'Jaipur',
            state: 'Rajasthan',
            pincode: '302017',
            attendancePercentage: found.attendancePercentage || 90.0,
            academicAverage: found.academicAverage || 80.0,
            activeFlags: found.activeFlags || [],
            createdAt: '2023-04-05T10:00:00Z',
            updatedAt: '2026-10-21T08:00:00Z',
          });
          continue;
        }
      }

      if (cls.id === 'class-10-b') {
        const found = baseline10B.find(b => b.rollNumber === roll);
        if (found) {
          students.push({
            id: found.id || studentId,
            admissionNumber: `ADM/2023/${2000 + roll}`,
            rollNumber: roll,
            firstName: found.firstName || 'Student',
            lastName: found.lastName || 'LastName',
            fullName: `${found.firstName} ${found.lastName}`,
            gender: found.gender || (roll % 2 === 0 ? 'F' : 'M'),
            dateOfBirth: '2010-05-11',
            enrollmentDate: '2023-04-05',
            classId: cls.id,
            classLabel: cls.label,
            academicYearId: 'year-2025-2026',
            status: 'enrolled',
            guardianName: found.guardianName || `${found.lastName} Guardian`,
            guardianRelation: 'Father',
            primaryPhone: found.primaryPhone || `+91 98292 ${66000 + roll}`,
            residentialAddress: `G-${roll}, Vidyadhar Nagar, Jaipur`,
            city: 'Jaipur',
            state: 'Rajasthan',
            pincode: '302039',
            attendancePercentage: found.attendancePercentage || 92.0,
            academicAverage: found.academicAverage || 85.0,
            activeFlags: found.activeFlags || [],
            createdAt: '2023-04-05T10:00:00Z',
            updatedAt: '2026-10-21T08:00:00Z',
          });
          continue;
        }
      }

      // Deterministic generation for other rolls and classes
      const isFemale = roll % 2 === 0;
      const firstNameList = isFemale ? FIRST_NAMES_F : FIRST_NAMES_M;
      const fName = firstNameList[(roll + gradeNum * 3) % firstNameList.length];
      const lName = LAST_NAMES[(roll * 2 + gradeNum) % LAST_NAMES.length];
      const colony = COLONIES[(roll + gradeNum) % COLONIES.length];
      const birthYear = 2026 - (gradeNum + 5);
      
      // Calculate realistic attendance and performance
      const attPct = Math.round((82 + ((roll * 7 + gradeNum * 3) % 17)) * 10) / 10;
      const acadAvg = Math.round((70 + ((roll * 11 + gradeNum * 5) % 26)) * 10) / 10;
      
      const flags = [];
      if (attPct < 75) {
        flags.push({
          id: `flag-${studentId}-att`,
          code: 'ATT-03' as const,
          type: 'attendance' as const,
          severity: 'alert' as const,
          title: 'Below 75% CBSE Threshold',
          reason: `Rule #ATT-03: Attendance at ${attPct}% is below the mandatory 75% requirement.`,
          triggeredAt: '2026-10-20T08:00:00Z',
          resolved: false,
        });
      }

      students.push({
        id: studentId,
        admissionNumber: `ADM/202${gradeNum > 5 ? '3' : '4'}/${gradeNum * 100 + roll}`,
        rollNumber: roll,
        firstName: fName,
        lastName: lName,
        fullName: `${fName} ${lName}`,
        gender: isFemale ? 'F' : 'M',
        dateOfBirth: `${birthYear}-0${(roll % 9) + 1}-15`,
        enrollmentDate: '2024-04-05',
        classId: cls.id,
        classLabel: cls.label,
        academicYearId: 'year-2025-2026',
        status: 'enrolled',
        guardianName: `${lName === 'Sharma' || lName === 'Verma' ? 'Dr.' : 'Shri'} ${fName.slice(0, 3)}esh ${lName}`,
        guardianRelation: 'Father',
        primaryPhone: `+91 9829${gradeNum} ${10000 + roll}`,
        residentialAddress: `Plot ${roll * 3}, Block B, ${colony}, Jaipur`,
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302020',
        attendancePercentage: attPct,
        academicAverage: acadAvg,
        activeFlags: flags,
        createdAt: '2024-04-05T10:00:00Z',
        updatedAt: '2026-10-21T08:00:00Z',
      });
    }
  });

  return students;
}

export const initialStudents: StudentRecord[] = generateSyntheticStudents();

// ============================================================================
// 7. Assessment Definitions & Cycles
// ============================================================================
export const initialAssessments: AssessmentCycle[] = [
  {
    id: 'assess-ut1-2025',
    type: 'unit_test_1',
    title: 'Unit Test 1',
    academicYearId: 'year-2025-2026',
    startDate: '2025-07-15',
    endDate: '2025-07-22',
    maxMarks: 25,
    passingMarks: 9,
    weightagePercent: 10,
    status: 'locked',
  },
  {
    id: 'assess-ut2-2025',
    type: 'unit_test_2',
    title: 'Unit Test 2',
    academicYearId: 'year-2025-2026',
    startDate: '2025-09-10',
    endDate: '2025-09-17',
    maxMarks: 25,
    passingMarks: 9,
    weightagePercent: 10,
    status: 'published',
  },
  {
    id: 'assess-hy-2025',
    type: 'half_yearly',
    title: 'Half-Yearly Examination',
    academicYearId: 'year-2025-2026',
    startDate: '2025-11-20',
    endDate: '2025-12-02',
    maxMarks: 80,
    passingMarks: 27,
    weightagePercent: 30,
    status: 'published',
  },
  {
    id: 'assess-annual-2026',
    type: 'annual',
    title: 'Annual Examination',
    academicYearId: 'year-2025-2026',
    startDate: '2026-02-25',
    endDate: '2026-03-12',
    maxMarks: 80,
    passingMarks: 27,
    weightagePercent: 50,
    status: 'published',
  },
];

// ============================================================================
// 8. Marks Registers (Class 10-A and 10-B across Cycles)
// ============================================================================
function generateMarksRegister(
  assessmentId: string,
  classId: string,
  subjectId: string,
  maxMarks: number,
  passingMarks: number,
  status: 'draft' | 'submitted' | 'verified_locked' | 'finalized'
): MarksRegister {
  const cls = initialClasses.find(c => c.id === classId) || initialClasses[0];
  const sub = initialSubjects.find(s => s.id === subjectId) || initialSubjects[0];
  const assess = initialAssessments.find(a => a.id === assessmentId) || initialAssessments[0];
  const classStudents = initialStudents.filter(s => s.classId === classId);

  const entries: StudentMarkEntry[] = classStudents.map((s, idx) => {
    // Deterministic marks distribution
    const isAbsent = assessmentId === 'assess-ut2-2025' && subjectId === 'sub-sci-10' && idx === 10;
    let marks: number | null = null;
    if (!isAbsent) {
      if (s.id === 'STU-10A-01' && assessmentId === 'assess-ut2-2025' && subjectId === 'sub-math-10') {
        marks = 15; // Trigger for ACAD-04
      } else if (s.id === 'STU-10A-01' && assessmentId === 'assess-ut1-2025' && subjectId === 'sub-math-10') {
        marks = 22;
      } else {
        const factor = maxMarks === 25 ? 0.25 : 0.8;
        const base = Math.round(s.academicAverage * factor);
        marks = Math.min(maxMarks, Math.max(passingMarks, base + ((idx % 5) - 2)));
      }
    }

    const { grade, percentage } = calculateGrade(marks, maxMarks);
    return {
      studentId: s.id,
      studentName: s.fullName,
      rollNumber: s.rollNumber,
      marksObtained: marks,
      isAbsent,
      percentage: percentage || undefined,
      grade,
      remarks: isAbsent ? 'Medical Leave Reported' : marks! >= passingMarks ? 'Satisfactory' : 'Needs Remedial Tutorial',
    };
  });

  const assignment = initialSubjectAssignments.find(item => item.classId === classId && item.subjectId === subjectId);
  const teacher = assignment ? initialStaff.find(item => item.id === assignment.teacherId) : undefined;
  return {
    id: `reg-${assessmentId}-${classId}-${subjectId}`,
    assessmentId,
    assessmentTitle: assess.title,
    classId: cls.id,
    classLabel: cls.label,
    subjectId: sub.id,
    subjectName: sub.name,
    maxMarks,
    passingMarks,
    teacherId: assignment?.teacherId || 'staff-003',
    teacherName: teacher?.name || 'Assigned Teacher',
    status,
    lastSavedAt: '2026-10-21T09:45:00Z',
    entries,
  };
}

export const initialMarksRegisters: MarksRegister[] = initialSubjectAssignments.flatMap(assignment =>
  initialAssessments.map(assessment => {
    const isDraftEdge = assignment.classId === 'class-10-b' && assignment.subjectId === 'sub-math-10' && assessment.id === 'assess-ut2-2025';
    const isSubmittedEdge = assignment.classId === 'class-10-a' && assignment.subjectId === 'sub-sci-10' && assessment.id === 'assess-ut2-2025';
    const status = isDraftEdge ? 'draft' : isSubmittedEdge ? 'submitted' : 'finalized';
    return generateMarksRegister(assessment.id, assignment.classId, assignment.subjectId, assessment.maxMarks, assessment.passingMarks, status);
  })
);

// ============================================================================
// 9. Daily Attendance Sessions (Today: 2026-10-21 for all 20 Sections)
// ============================================================================
function generateTodayAttendanceSessions(): AttendanceSession[] {
  const today = getSchoolLocalDate();
  return initialClasses.map((cls, idx) => {
    const classStudents = initialStudents.filter(s => s.classId === cls.id);
    const isSubmitted = idx < 16 || cls.id === 'class-10-a'; // Keep the dual-role teacher's section recorded; Class 10-B remains the draft edge case.
    
    const records: DailyAttendanceRecord[] = classStudents.map((s, rIdx) => {
      let state: 'present' | 'absent' | 'late' | 'excused' = 'present';
      
      // Seed absences matching flags
      if (cls.id === 'class-10-a') {
        if (s.id === 'STU-10A-01' || s.id === 'STU-10A-05' || s.id === 'STU-10A-11') {
          state = 'absent';
        } else if (rIdx === 6) {
          state = 'late';
        } else if (rIdx === 7) {
          state = 'excused';
        }
      } else {
        if (rIdx === 3 || rIdx === 15) {
          state = 'absent';
        } else if (rIdx === 8) {
          state = 'late';
        }
      }

      const rec: DailyAttendanceRecord = {
        studentId: s.id,
        studentName: s.fullName,
        rollNumber: s.rollNumber,
        state,
      };
      if (state === 'absent') rec.remarks = 'Parent unnotified';
      else if (state === 'late') rec.remarks = 'Morning bus delay';
      return rec;
    });

    const presentCount = records.filter(r => r.state === 'present').length;
    const absentCount = records.filter(r => r.state === 'absent').length;
    const lateCount = records.filter(r => r.state === 'late').length;
    const excusedCount = records.filter(r => r.state === 'excused').length;

    return {
      id: `att-${cls.id}-${today}`,
      classId: cls.id,
      classLabel: cls.label,
      date: today,
      academicYearId: 'year-2025-2026',
      takenByStaffId: cls.classTeacherId,
      takenByStaffName: cls.classTeacherName,
      takenAt: `${today}T08:35:00.000Z`,
      windowStart: INSTITUTIONAL_CONFIG.attendance.dailyMarkingWindowStart,
      windowEnd: INSTITUTIONAL_CONFIG.attendance.dailyMarkingWindowEnd,
      isWindowOpen: true,
      status: isSubmitted ? 'submitted' : 'draft',
      totalStudents: classStudents.length,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      records,
    };
  });
}

export const initialAttendanceSessions: AttendanceSession[] = generateTodayAttendanceSessions();

// ============================================================================
// 10. Attendance Correction Requests (Dual-Custody Flow)
// ============================================================================
export const initialAttendanceCorrections: AttendanceCorrection[] = [
  {
    id: 'corr-001',
    sessionId: 'att-class-10-a-2026-10-21',
    classId: 'class-10-a',
    classLabel: 'Class 10-A',
    date: '2026-10-21',
    studentId: 'STU-10A-01',
    studentName: 'Aarav Singhania',
    previousState: 'absent',
    requestedState: 'present',
    mandatoryReason: 'Medical certificate produced for morning clinic attendance; student attended post-break periods.',
    requestedByStaffId: 'staff-003',
    requestedByStaffName: 'Shri Rajeshwar Choudhary',
    requestedAt: '2026-10-21T11:30:00Z',
    status: 'pending_principal',
  },
  {
    id: 'corr-002',
    sessionId: 'att-class-10-a-2026-10-20',
    classId: 'class-10-a',
    classLabel: 'Class 10-A',
    date: '2026-10-20',
    studentId: 'STU-10A-05',
    studentName: 'Kabir Verma',
    previousState: 'absent',
    requestedState: 'excused',
    mandatoryReason: 'Official representation in Inter-School District Debate Championship.',
    requestedByStaffId: 'staff-003',
    requestedByStaffName: 'Shri Rajeshwar Choudhary',
    requestedAt: '2026-10-20T14:10:00Z',
    status: 'approved',
    reviewedByStaffId: 'staff-001',
    reviewedByStaffName: 'Dr. Vikramaditya Sharma',
    reviewedAt: '2026-10-20T16:00:00Z',
    reviewRemarks: 'Verified against Physical Education and Cultural Council activity roster.',
  },
];

// ============================================================================
// 11. Behaviour & Proctorial Care Records
// ============================================================================
export const initialIncidents: IncidentRecord[] = [
  {
    id: 'inc-001',
    studentId: 'STU-10A-01',
    studentName: 'Aarav Singhania',
    classId: 'class-10-a',
    classLabel: 'Class 10-A',
    date: '2026-10-18',
    category: 'academic_integrity',
    severity: 'notice',
    title: 'Unsubmitted Mathematics Diagnostic Task',
    description: 'Student missed submission deadline for Unit Test 2 preparation workbook. Tutor conference completed.',
    actionTaken: 'Assigned supervised study hall tutorial with Shri Alok Saxena.',
    loggedByStaffId: 'staff-003',
    loggedByStaffName: 'Shri Rajeshwar Choudhary',
    loggedByStaffRole: 'class_teacher',
    createdAt: '2026-10-18T12:30:00Z',
    parentNotified: true,
  },
  {
    id: 'inc-002',
    studentId: 'STU-10A-05',
    studentName: 'Kabir Verma',
    classId: 'class-10-a',
    classLabel: 'Class 10-A',
    date: '2026-10-19',
    category: 'punctuality',
    severity: 'notice',
    title: 'Repeated Late Arrival at Morning Assembly',
    description: 'Arrived 20 minutes after national anthem on two consecutive school days.',
    actionTaken: 'Telephonic intimation to father Shri Ashok Verma; adjusted bus pickup route.',
    loggedByStaffId: 'staff-003',
    loggedByStaffName: 'Shri Rajeshwar Choudhary',
    loggedByStaffRole: 'class_teacher',
    createdAt: '2026-10-19T09:15:00Z',
    parentNotified: true,
  },
  {
    id: 'inc-003',
    studentId: 'STU-10A-02',
    studentName: 'Ananya Sharma',
    classId: 'class-10-a',
    classLabel: 'Class 10-A',
    date: '2026-10-15',
    category: 'commendation',
    severity: 'commendation',
    title: '1st Position in State Science Olympiad',
    description: 'Secured gold medal and certificate of distinction in Junior State Science Congress.',
    actionTaken: 'Commended during School Morning Assembly; citation recorded in student dossier.',
    loggedByStaffId: 'staff-001',
    loggedByStaffName: 'Dr. Vikramaditya Sharma',
    loggedByStaffRole: 'principal',
    createdAt: '2026-10-15T11:00:00Z',
    parentNotified: true,
  },
];

// ============================================================================
// 12. Non-Repudiable System Audit Stream
// ============================================================================
export const initialAuditEvents: AuditEvent[] = [
  {
    id: 'audit-001',
    timestamp: '2026-10-21T08:35:10Z',
    actorId: 'staff-003',
    actorName: 'Shri Rajeshwar Choudhary',
    actorRole: 'class_teacher',
    action: 'attendance_submitted',
    resource: 'attendanceSessions',
    targetId: 'att-class-10-a-2026-10-21',
    summary: 'Submitted daily morning attendance register for Class 10-A (35 Present, 3 Absent, 1 Late).',
    clientIp: '192.168.1.45',
  },
  {
    id: 'audit-002',
    timestamp: '2026-10-21T09:45:22Z',
    actorId: 'staff-004',
    actorName: 'Shri Alok Saxena',
    actorRole: 'subject_teacher',
    action: 'marks_submitted',
    resource: 'marksRegisters',
    targetId: 'reg-assess-ut2-2025-class-10-a-sub-math-10',
    summary: 'Saved and submitted Unit Test 2 marks register for Mathematics in Class 10-A.',
    clientIp: '192.168.1.88',
  },
  {
    id: 'audit-003',
    timestamp: '2026-10-21T11:30:05Z',
    actorId: 'staff-003',
    actorName: 'Shri Rajeshwar Choudhary',
    actorRole: 'class_teacher',
    action: 'attendance_corrected',
    resource: 'attendanceCorrections',
    targetId: 'corr-001',
    summary: 'Initiated dual-custody attendance correction request for Aarav Singhania (Class 10-A).',
    clientIp: '192.168.1.45',
  },
  {
    id: 'audit-004',
    timestamp: '2026-10-20T16:00:15Z',
    actorId: 'staff-001',
    actorName: 'Dr. Vikramaditya Sharma',
    actorRole: 'principal',
    action: 'attendance_corrected',
    resource: 'attendanceCorrections',
    targetId: 'corr-002',
    summary: 'Approved attendance correction request #corr-002 for Kabir Verma (Class 10-A: absent -> excused).',
    clientIp: '192.168.1.10',
  },
];
