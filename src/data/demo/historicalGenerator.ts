/**
 * HanuJai High School ERP — Complete 3-Year Historical Demo Data Generator
 * Campus: HanuJai High School, Vidyadhar Nagar, Jaipur, Rajasthan, India
 * 
 * Generates an internally consistent, deterministic 3-year historical dataset:
 * - Academic Sessions: 2023–2024, 2024–2025, 2025–2026
 * - 1,000 Enrolled Students with historical grade progression (e.g. Class 8 -> 9 -> 10)
 * - 12 Assessment Cycles (4 per year: UT1, UT2, Half-Yearly, Annual)
 * - Complete Marks Registers across all configured core subjects
 * - Persisted Daily Attendance Sessions following the CBSE Rajasthan school calendar
 * - Chronological Teacher Notes & Proctorial Care Records across the 3 years
 */

import type {
  AcademicYear,
  ClassSection,
  Subject,
  SubjectAssignment,
  StudentRecord,
  AssessmentCycle,
  MarksRegister,
  AttendanceSession,
  DailyAttendanceRecord,
  StudentMarkEntry,
  IncidentRecord,
} from '../../domain/types';
import { calculateGrade } from '../../domain/policy';

// ============================================================================
// 1. Academic Sessions (3 Complete Academic Years)
// ============================================================================
export const historicalAcademicYears: AcademicYear[] = [
  {
    id: 'year-2023-2024',
    label: '2023–2024',
    name: '2023–2024',
    startDate: '2023-04-03',
    endDate: '2024-03-30',
    isCurrent: false,
    status: 'archived',
    terms: [
      { id: 'term-1-2023', name: 'Term 1 (Apr–Sep)', startDate: '2023-04-03', endDate: '2023-09-30' },
      { id: 'term-2-2023', name: 'Term 2 (Oct–Mar)', startDate: '2023-10-01', endDate: '2024-03-30' },
    ],
  },
  {
    id: 'year-2024-2025',
    label: '2024–2025',
    name: '2024–2025',
    startDate: '2024-04-01',
    endDate: '2025-03-31',
    isCurrent: false,
    status: 'archived',
    terms: [
      { id: 'term-1-2024', name: 'Term 1 (Apr–Sep)', startDate: '2024-04-01', endDate: '2024-09-30' },
      { id: 'term-2-2024', name: 'Term 2 (Oct–Mar)', startDate: '2024-10-01', endDate: '2025-03-31' },
    ],
  },
  {
    id: 'year-2025-2026',
    label: '2025–2026',
    name: '2025–2026',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    isCurrent: true,
    status: 'active',
    terms: [
      { id: 'term-1-2025', name: 'Term 1 (Apr–Sep)', startDate: '2025-04-01', endDate: '2025-09-30' },
      { id: 'term-2-2025', name: 'Term 2 (Oct–Mar)', startDate: '2025-10-01', endDate: '2026-03-31' },
    ],
  },
];

// ============================================================================
// 2. Assessment Cycles (12 Cycles: 4 Per Academic Year)
// ============================================================================
export const historicalAssessmentCycles: AssessmentCycle[] = [
  // 2023–2024 Cycles (Archived / Finalized)
  {
    id: 'assess-ut1-2023',
    type: 'unit_test_1',
    title: 'Unit Test 1 (2023–24)',
    name: 'Unit Test 1',
    academicYearId: 'year-2023-2024',
    startDate: '2023-07-17',
    endDate: '2023-07-24',
    maxMarks: 25,
    passingMarks: 9,
    weightagePercent: 10,
    status: 'published',
  },
  {
    id: 'assess-ut2-2023',
    type: 'unit_test_2',
    title: 'Unit Test 2 (2023–24)',
    name: 'Unit Test 2',
    academicYearId: 'year-2023-2024',
    startDate: '2023-09-11',
    endDate: '2023-09-18',
    maxMarks: 25,
    passingMarks: 9,
    weightagePercent: 10,
    status: 'published',
  },
  {
    id: 'assess-hy-2023',
    type: 'half_yearly',
    title: 'Half-Yearly Examination (2023–24)',
    name: 'Half-Yearly Examination',
    academicYearId: 'year-2023-2024',
    startDate: '2023-11-20',
    endDate: '2023-12-02',
    maxMarks: 80,
    passingMarks: 27,
    weightagePercent: 30,
    status: 'published',
  },
  {
    id: 'assess-annual-2024',
    type: 'annual',
    title: 'Annual Examination (2023–24)',
    name: 'Annual Examination',
    academicYearId: 'year-2023-2024',
    startDate: '2024-02-26',
    endDate: '2024-03-12',
    maxMarks: 80,
    passingMarks: 27,
    weightagePercent: 50,
    status: 'published',
  },

  // 2024–2025 Cycles (Archived / Finalized)
  {
    id: 'assess-ut1-2024',
    type: 'unit_test_1',
    title: 'Unit Test 1 (2024–25)',
    name: 'Unit Test 1',
    academicYearId: 'year-2024-2025',
    startDate: '2024-07-15',
    endDate: '2024-07-22',
    maxMarks: 25,
    passingMarks: 9,
    weightagePercent: 10,
    status: 'published',
  },
  {
    id: 'assess-ut2-2024',
    type: 'unit_test_2',
    title: 'Unit Test 2 (2024–25)',
    name: 'Unit Test 2',
    academicYearId: 'year-2024-2025',
    startDate: '2024-09-09',
    endDate: '2024-09-16',
    maxMarks: 25,
    passingMarks: 9,
    weightagePercent: 10,
    status: 'published',
  },
  {
    id: 'assess-hy-2024',
    type: 'half_yearly',
    title: 'Half-Yearly Examination (2024–25)',
    name: 'Half-Yearly Examination',
    academicYearId: 'year-2024-2025',
    startDate: '2024-11-18',
    endDate: '2024-11-30',
    maxMarks: 80,
    passingMarks: 27,
    weightagePercent: 30,
    status: 'published',
  },
  {
    id: 'assess-annual-2025',
    type: 'annual',
    title: 'Annual Examination (2024–25)',
    name: 'Annual Examination',
    academicYearId: 'year-2024-2025',
    startDate: '2025-02-24',
    endDate: '2025-03-11',
    maxMarks: 80,
    passingMarks: 27,
    weightagePercent: 50,
    status: 'published',
  },

  // 2025–2026 Cycles (Current Session)
  {
    id: 'assess-ut1-2025',
    type: 'unit_test_1',
    title: 'Unit Test 1',
    name: 'Unit Test 1',
    academicYearId: 'year-2025-2026',
    startDate: '2025-07-14',
    endDate: '2025-07-21',
    maxMarks: 25,
    passingMarks: 9,
    weightagePercent: 10,
    status: 'locked',
  },
  {
    id: 'assess-ut2-2025',
    type: 'unit_test_2',
    title: 'Unit Test 2',
    name: 'Unit Test 2',
    academicYearId: 'year-2025-2026',
    startDate: '2025-09-08',
    endDate: '2025-09-15',
    maxMarks: 25,
    passingMarks: 9,
    weightagePercent: 10,
    status: 'published',
  },
  {
    id: 'assess-hy-2025',
    type: 'half_yearly',
    title: 'Half-Yearly Examination',
    name: 'Half-Yearly Examination',
    academicYearId: 'year-2025-2026',
    startDate: '2025-11-17',
    endDate: '2025-11-29',
    maxMarks: 80,
    passingMarks: 27,
    weightagePercent: 30,
    status: 'published',
  },
  {
    id: 'assess-annual-2026',
    type: 'annual',
    title: 'Annual Examination',
    name: 'Annual Examination',
    academicYearId: 'year-2025-2026',
    startDate: '2026-02-23',
    endDate: '2026-03-10',
    maxMarks: 80,
    passingMarks: 27,
    weightagePercent: 50,
    status: 'published',
  },
];

// ============================================================================
// 3. School Calendar & Instructional Days Generator
// ============================================================================
export interface SchoolCalendarDay {
  date: string;
  isSchoolDay: boolean;
  holidayReason?: string;
  academicYearId: string;
}

/**
 * Generates all instructional and holiday calendar days for a given academic year.
 * Excludes Sundays, 2nd & 4th Saturdays, Summer Vacation, Diwali Break, Winter Break, and National Holidays.
 */
export function generateAcademicCalendarDays(year: AcademicYear): SchoolCalendarDay[] {
  const days: SchoolCalendarDay[] = [];
  const start = new Date(`${year.startDate}T12:00:00Z`);
  const end = new Date(`${year.endDate}T12:00:00Z`);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const isoDate = d.toISOString().split('T')[0];
    const yearNum = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-indexed: 0 = Jan, 4 = May, 9 = Oct
    const dateNum = d.getUTCDate();
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 6 = Sat

    // 1. Sunday: Always off
    if (dayOfWeek === 0) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Sunday; weekly holiday', academicYearId: year.id });
      continue;
    }

    // 2. Second & Fourth Saturdays off (Rajasthan school rule)
    if (dayOfWeek === 6) {
      if ((dateNum >= 8 && dateNum <= 14) || (dateNum >= 22 && dateNum <= 28)) {
        days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Second / Fourth Saturday off', academicYearId: year.id });
        continue;
      }
    }

    // 3. Summer Vacation: May 15 to June 30
    if ((month === 4 && dateNum >= 15) || month === 5) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Summer Vacation', academicYearId: year.id });
      continue;
    }

    // 4. Diwali / Autumn Break: Year-specific Rajasthan dates
    // 2023: Nov 10 - Nov 15
    // 2024: Oct 30 - Nov 03
    // 2025: Oct 19 - Oct 25
    // 2026: Nov 06 - Nov 11 (Diwali in 2026 is Nov 8; October 1-25 are normal school days)
    if (yearNum === 2023 && month === 10 && dateNum >= 10 && dateNum <= 15) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Diwali & Autumn Break', academicYearId: year.id });
      continue;
    }
    if (yearNum === 2024 && ((month === 9 && dateNum >= 30) || (month === 10 && dateNum <= 3))) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Diwali & Autumn Break', academicYearId: year.id });
      continue;
    }
    if (yearNum === 2025 && month === 9 && dateNum >= 19 && dateNum <= 25) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Diwali & Autumn Break', academicYearId: year.id });
      continue;
    }
    if (yearNum === 2026 && month === 10 && dateNum >= 6 && dateNum <= 11) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Diwali & Autumn Break', academicYearId: year.id });
      continue;
    }

    // 5. Winter Break: Dec 25 to Jan 04
    if ((month === 11 && dateNum >= 25) || (month === 0 && dateNum <= 4)) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Winter Vacation', academicYearId: year.id });
      continue;
    }

    // 6. National Holidays
    if (month === 7 && dateNum === 15) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Independence Day', academicYearId: year.id });
      continue;
    }
    if (month === 9 && dateNum === 2) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Mahatma Gandhi Jayanti', academicYearId: year.id });
      continue;
    }
    if (month === 0 && dateNum === 26) {
      days.push({ date: isoDate, isSchoolDay: false, holidayReason: 'Republic Day', academicYearId: year.id });
      continue;
    }

    // Valid Instructional School Day
    days.push({ date: isoDate, isSchoolDay: true, academicYearId: year.id });
  }

  return days;
}

// ============================================================================
// 4. Compact Attendance Session Format for High-Efficiency LocalStorage
// ============================================================================
export interface CompactAttendanceSession {
  id: string;
  classId: string;
  classLabel: string;
  date: string;
  academicYearId: string;
  takenByStaffId: string;
  takenByStaffName: string;
  status: 'submitted' | 'draft' | 'corrected';
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  absentRolls: number[];
  lateRolls?: number[];
  excusedRolls?: number[];
  remarksByRoll?: Record<number, string>;
}

/**
 * Expands a CompactAttendanceSession into a full domain AttendanceSession.
 */
export function expandCompactSession(
  compact: CompactAttendanceSession,
  classStudents: StudentRecord[]
): AttendanceSession {
  const records: DailyAttendanceRecord[] = classStudents.map(student => {
    let state: DailyAttendanceRecord['state'] = 'present';
    if (compact.absentRolls?.includes(student.rollNumber)) {
      state = 'absent';
    } else if (compact.lateRolls?.includes(student.rollNumber)) {
      state = 'late';
    } else if (compact.excusedRolls?.includes(student.rollNumber)) {
      state = 'excused';
    }

    const defaultRemark = state === 'absent' ? 'Parent unnotified' : state === 'late' ? 'Morning bus delay' : state === 'excused' ? 'Medical / Activity leave' : undefined;
    const finalRemark = compact.remarksByRoll?.[student.rollNumber] || defaultRemark;

    const record: DailyAttendanceRecord = {
      studentId: student.id,
      studentName: student.fullName,
      rollNumber: student.rollNumber,
      state,
    };
    if (finalRemark) {
      record.remarks = finalRemark;
    }

    return record;
  });

  return {
    id: compact.id,
    classId: compact.classId,
    classLabel: compact.classLabel,
    date: compact.date,
    academicYearId: compact.academicYearId,
    takenByStaffId: compact.takenByStaffId,
    takenByStaffName: compact.takenByStaffName,
    markedByStaffId: compact.takenByStaffId,
    takenAt: `${compact.date}T08:35:00.000Z`,
    windowStart: '07:45',
    windowEnd: '09:15',
    isWindowOpen: false,
    status: compact.status,
    totalStudents: records.length,
    presentCount: records.filter(r => r.state === 'present').length,
    absentCount: records.filter(r => r.state === 'absent').length,
    lateCount: records.filter(r => r.state === 'late').length,
    excusedCount: records.filter(r => r.state === 'excused').length,
    records,
  };
}

/**
 * Compacts a full domain AttendanceSession into a lightweight representation.
 */
export function compactDomainSession(session: AttendanceSession): CompactAttendanceSession {
  const absentRolls: number[] = [];
  const lateRolls: number[] = [];
  const excusedRolls: number[] = [];
  const remarksByRoll: Record<number, string> = {};

  session.records.forEach(record => {
    if (record.state === 'absent') absentRolls.push(record.rollNumber);
    else if (record.state === 'late') lateRolls.push(record.rollNumber);
    else if (record.state === 'excused') excusedRolls.push(record.rollNumber);
    if (record.remarks) remarksByRoll[record.rollNumber] = record.remarks;
  });

  return {
    id: session.id,
    classId: session.classId,
    classLabel: session.classLabel,
    date: session.date,
    academicYearId: session.academicYearId,
    takenByStaffId: session.takenByStaffId,
    takenByStaffName: session.takenByStaffName,
    status: session.status,
    totalStudents: session.totalStudents,
    presentCount: session.presentCount,
    absentCount: session.absentCount,
    lateCount: session.lateCount,
    excusedCount: session.excusedCount,
    absentRolls,
    lateRolls: lateRolls.length ? lateRolls : undefined,
    excusedRolls: excusedRolls.length ? excusedRolls : undefined,
    remarksByRoll: Object.keys(remarksByRoll).length ? remarksByRoll : undefined,
  };
}

// ============================================================================
// 5. Subject Master List Across Classes 1–10
// ============================================================================
export const historicalSubjects: Subject[] = [
  // Class 10 Subjects
  { id: 'sub-math-10', code: 'MATH-10', name: 'Mathematics', gradeLevel: 10, type: 'core' },
  { id: 'sub-sci-10',  code: 'SCI-10',  name: 'Science', gradeLevel: 10, type: 'core' },
  { id: 'sub-eng-10',  code: 'ENG-10',  name: 'English Language & Lit', gradeLevel: 10, type: 'language' },
  { id: 'sub-hindi-10',code: 'HIN-10',  name: 'Hindi Course A', gradeLevel: 10, type: 'language' },
  { id: 'sub-sst-10',  code: 'SST-10',  name: 'Social Science', gradeLevel: 10, type: 'core' },

  // Class 9 Subjects
  { id: 'sub-math-09', code: 'MATH-09', name: 'Mathematics', gradeLevel: 9,  type: 'core' },
  { id: 'sub-sci-09',  code: 'SCI-09',  name: 'Science', gradeLevel: 9,  type: 'core' },
  { id: 'sub-eng-09',  code: 'ENG-09',  name: 'English Language & Lit', gradeLevel: 9,  type: 'language' },
  { id: 'sub-hindi-09',code: 'HIN-09',  name: 'Hindi Course A', gradeLevel: 9,  type: 'language' },
  { id: 'sub-sst-09',  code: 'SST-09',  name: 'Social Science', gradeLevel: 9,  type: 'core' },

  // Class 8 Subjects
  { id: 'sub-math-08', code: 'MATH-08', name: 'Mathematics', gradeLevel: 8,  type: 'core' },
  { id: 'sub-sci-08',  code: 'SCI-08',  name: 'Science', gradeLevel: 8,  type: 'core' },
  { id: 'sub-eng-08',  code: 'ENG-08',  name: 'English Language & Lit', gradeLevel: 8,  type: 'language' },
  { id: 'sub-hindi-08',code: 'HIN-08',  name: 'Hindi Course A', gradeLevel: 8,  type: 'language' },
  { id: 'sub-sst-08',  code: 'SST-08',  name: 'Social Science', gradeLevel: 8,  type: 'core' },

  // Class 7 Subjects
  { id: 'sub-math-07', code: 'MATH-07', name: 'Mathematics', gradeLevel: 7,  type: 'core' },
  { id: 'sub-sci-07',  code: 'SCI-07',  name: 'Science', gradeLevel: 7,  type: 'core' },
  { id: 'sub-eng-07',  code: 'ENG-07',  name: 'English Language & Lit', gradeLevel: 7,  type: 'language' },
  { id: 'sub-hindi-07',code: 'HIN-07',  name: 'Hindi Course A', gradeLevel: 7,  type: 'language' },
  { id: 'sub-sst-07',  code: 'SST-07',  name: 'Social Science', gradeLevel: 7,  type: 'core' },

  // Class 6 Subjects
  { id: 'sub-math-06', code: 'MATH-06', name: 'Mathematics', gradeLevel: 6,  type: 'core' },
  { id: 'sub-sci-06',  code: 'SCI-06',  name: 'Science', gradeLevel: 6,  type: 'core' },
  { id: 'sub-eng-06',  code: 'ENG-06',  name: 'English Language & Lit', gradeLevel: 6,  type: 'language' },
  { id: 'sub-hindi-06',code: 'HIN-06',  name: 'Hindi Course A', gradeLevel: 6,  type: 'language' },
  { id: 'sub-sst-06',  code: 'SST-06',  name: 'Social Science', gradeLevel: 6,  type: 'core' },
];

// ============================================================================
// 6. Faculty Assignments Across Classes
// ============================================================================
export const historicalSubjectAssignments: SubjectAssignment[] = [
  // Class 10-A
  { id: 'assign-10a-math', subjectId: 'sub-math-10', subjectName: 'Mathematics', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-003', teacherName: 'Shri Alok Saxena', academicYearId: 'year-2025-2026' },
  { id: 'assign-10a-sci',  subjectId: 'sub-sci-10',  subjectName: 'Science', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-004', teacherName: 'Smt. Priyanka Sen', academicYearId: 'year-2025-2026' },
  { id: 'assign-10a-eng',  subjectId: 'sub-eng-10',  subjectName: 'English Language & Lit', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-007', teacherName: 'Smt. Kavita Shekhawat', academicYearId: 'year-2025-2026' },
  { id: 'assign-10a-hin',  subjectId: 'sub-hindi-10',subjectName: 'Hindi Course A', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-010', teacherName: 'Shri Rameshwar Dayal', academicYearId: 'year-2025-2026' },
  { id: 'assign-10a-sst',  subjectId: 'sub-sst-10',  subjectName: 'Social Science', classId: 'class-10-a', classLabel: 'Class 10-A', teacherId: 'staff-006', teacherName: 'Shri Dinesh Rathore', academicYearId: 'year-2025-2026' },

  // Class 10-B
  { id: 'assign-10b-math', subjectId: 'sub-math-10', subjectName: 'Mathematics', classId: 'class-10-b', classLabel: 'Class 10-B', teacherId: 'staff-003', teacherName: 'Shri Alok Saxena', academicYearId: 'year-2025-2026' },
  { id: 'assign-10b-sci',  subjectId: 'sub-sci-10',  subjectName: 'Science', classId: 'class-10-b', classLabel: 'Class 10-B', teacherId: 'staff-004', teacherName: 'Smt. Priyanka Sen', academicYearId: 'year-2025-2026' },
  { id: 'assign-10b-eng',  subjectId: 'sub-eng-10',  subjectName: 'English Language & Lit', classId: 'class-10-b', classLabel: 'Class 10-B', teacherId: 'staff-007', teacherName: 'Smt. Kavita Shekhawat', academicYearId: 'year-2025-2026' },
  { id: 'assign-10b-hin',  subjectId: 'sub-hindi-10',subjectName: 'Hindi Course A', classId: 'class-10-b', classLabel: 'Class 10-B', teacherId: 'staff-010', teacherName: 'Shri Rameshwar Dayal', academicYearId: 'year-2025-2026' },
  { id: 'assign-10b-sst',  subjectId: 'sub-sst-10',  subjectName: 'Social Science', classId: 'class-10-b', classLabel: 'Class 10-B', teacherId: 'staff-006', teacherName: 'Shri Dinesh Rathore', academicYearId: 'year-2025-2026' },

  // Class 09-A
  { id: 'assign-09a-math', subjectId: 'sub-math-09', subjectName: 'Mathematics', classId: 'class-09-a', classLabel: 'Class 09-A', teacherId: 'staff-003', teacherName: 'Shri Alok Saxena', academicYearId: 'year-2025-2026' },
  { id: 'assign-09a-sci',  subjectId: 'sub-sci-09',  subjectName: 'Science', classId: 'class-09-a', classLabel: 'Class 09-A', teacherId: 'staff-004', teacherName: 'Smt. Priyanka Sen', academicYearId: 'year-2025-2026' },
  { id: 'assign-09a-eng',  subjectId: 'sub-eng-09',  subjectName: 'English Language & Lit', classId: 'class-09-a', classLabel: 'Class 09-A', teacherId: 'staff-007', teacherName: 'Smt. Kavita Shekhawat', academicYearId: 'year-2025-2026' },
  { id: 'assign-09a-hin',  subjectId: 'sub-hindi-09',subjectName: 'Hindi Course A', classId: 'class-09-a', classLabel: 'Class 09-A', teacherId: 'staff-010', teacherName: 'Shri Rameshwar Dayal', academicYearId: 'year-2025-2026' },
  { id: 'assign-09a-sst',  subjectId: 'sub-sst-09',  subjectName: 'Social Science', classId: 'class-09-a', classLabel: 'Class 09-A', teacherId: 'staff-006', teacherName: 'Shri Dinesh Rathore', academicYearId: 'year-2025-2026' },

  // Class 09-B
  { id: 'assign-09b-math', subjectId: 'sub-math-09', subjectName: 'Mathematics', classId: 'class-09-b', classLabel: 'Class 09-B', teacherId: 'staff-003', teacherName: 'Shri Alok Saxena', academicYearId: 'year-2025-2026' },
  { id: 'assign-09b-sci',  subjectId: 'sub-sci-09',  subjectName: 'Science', classId: 'class-09-b', classLabel: 'Class 09-B', teacherId: 'staff-004', teacherName: 'Smt. Priyanka Sen', academicYearId: 'year-2025-2026' },
  { id: 'assign-09b-eng',  subjectId: 'sub-eng-09',  subjectName: 'English Language & Lit', classId: 'class-09-b', classLabel: 'Class 09-B', teacherId: 'staff-007', teacherName: 'Smt. Kavita Shekhawat', academicYearId: 'year-2025-2026' },
  { id: 'assign-09b-hin',  subjectId: 'sub-hindi-09',subjectName: 'Hindi Course A', classId: 'class-09-b', classLabel: 'Class 09-B', teacherId: 'staff-010', teacherName: 'Shri Rameshwar Dayal', academicYearId: 'year-2025-2026' },
  { id: 'assign-09b-sst',  subjectId: 'sub-sst-09',  subjectName: 'Social Science', classId: 'class-09-b', classLabel: 'Class 09-B', teacherId: 'staff-006', teacherName: 'Shri Dinesh Rathore', academicYearId: 'year-2025-2026' },
];

// ============================================================================
// 7. Student Academic Progression & Cohort Enrolments
// ============================================================================
export interface StudentProgressionEntry {
  academicYearId: string;
  yearLabel: string;
  grade: number;
  classId: string;
  classLabel: string;
  section: 'A' | 'B';
  rollNumber: number;
}

/**
 * Returns the exact 3-year progression for a student currently in a given grade.
 */
export function getStudentProgression(
  currentGrade: number,
  currentSection: 'A' | 'B',
  enrollmentDate: string
): StudentProgressionEntry[] {
  const progression: StudentProgressionEntry[] = [];
  const sec = currentSection;

  // 1. Session 2023–2024
  if (currentGrade >= 3 && enrollmentDate <= '2023-04-30') {
    const grade23 = currentGrade - 2;
    progression.push({
      academicYearId: 'year-2023-2024',
      yearLabel: '2023–2024',
      grade: grade23,
      classId: `class-${grade23.toString().padStart(2, '0')}-${sec.toLowerCase()}`,
      classLabel: `Class ${grade23.toString().padStart(2, '0')}-${sec}`,
      section: sec,
      rollNumber: 1, // Will be assigned per student
    });
  }

  // 2. Session 2024–2025
  if (currentGrade >= 2 && enrollmentDate <= '2024-04-30') {
    const grade24 = currentGrade - 1;
    progression.push({
      academicYearId: 'year-2024-2025',
      yearLabel: '2024–2025',
      grade: grade24,
      classId: `class-${grade24.toString().padStart(2, '0')}-${sec.toLowerCase()}`,
      classLabel: `Class ${grade24.toString().padStart(2, '0')}-${sec}`,
      section: sec,
      rollNumber: 1,
    });
  }

  // 3. Session 2025–2026 (Current)
  progression.push({
    academicYearId: 'year-2025-2026',
    yearLabel: '2025–2026',
    grade: currentGrade,
    classId: `class-${currentGrade.toString().padStart(2, '0')}-${sec.toLowerCase()}`,
    classLabel: `Class ${currentGrade.toString().padStart(2, '0')}-${sec}`,
    section: sec,
    rollNumber: 1,
  });

  return progression;
}

// ============================================================================
// 8. Generate All 3-Year Historical Classes (20 Classes Per Academic Session)
// ============================================================================
export function generateAllHistoricalClasses(): ClassSection[] {
  const classes: ClassSection[] = [];
  const teacherByGrade: Record<number, { id: string; name: string }> = {
    10: { id: 'staff-003', name: 'Shri Alok Saxena' },
    9:  { id: 'staff-006', name: 'Shri Dinesh Rathore' },
    8:  { id: 'staff-008', name: 'Shri Mahesh Tiwari' },
    7:  { id: 'staff-010', name: 'Shri Rameshwar Dayal' },
    6:  { id: 'staff-012', name: 'Shri Gopal Soni' },
    5:  { id: 'staff-014', name: 'Shri Naresh Agarwal' },
    4:  { id: 'staff-016', name: 'Shri Vinod Mathur' },
    3:  { id: 'staff-018', name: 'Shri Ashok Tanwar' },
    2:  { id: 'staff-020', name: 'Shri Hemant Kulshreshtha' },
    1:  { id: 'staff-022', name: 'Smt. Suman Lata' },
  };

  historicalAcademicYears.forEach(year => {
    for (let grade = 10; grade >= 1; grade--) {
      for (const section of ['A', 'B'] as const) {
        const gradeStr = grade.toString().padStart(2, '0');
        const classId = `class-${gradeStr}-${section.toLowerCase()}`;
        const teacher = section === 'A' ? teacherByGrade[grade] : { id: `staff-0${grade + 10}`, name: `Smt. Faculty ${gradeStr}-${section}` };
        classes.push({
          id: classId,
          grade,
          gradeLevel: grade,
          section,
          label: `Class ${gradeStr}-${section}`,
          name: `Class ${gradeStr}-${section}`,
          academicYearId: year.id,
          classTeacherId: teacher.id,
          classTeacherName: teacher.name,
          roomNumber: `Room ${grade}0${section === 'A' ? '1' : '2'}`,
          studentCount: 50,
          maxCapacity: 50,
        });
      }
    }
  });

  return classes;
}

// ============================================================================
// 9. Generate All 1,000 Students with 3-Year Enrolment Progression
// ============================================================================
const FIRST_NAMES_M = ['Aarav', 'Rohan', 'Kabir', 'Ishaan', 'Harshvardhan', 'Devendra', 'Karan', 'Aditya', 'Varun', 'Nikhil', 'Manish', 'Siddharth', 'Arjun', 'Pranav', 'Yash', 'Gaurav', 'Kartik', 'Vivek', 'Ayush'];
const FIRST_NAMES_F = ['Ananya', 'Diya', 'Priya', 'Tanvi', 'Meera', 'Sneha', 'Riya', 'Kavya', 'Pooja', 'Shreya', 'Anushka', 'Ishita', 'Neha', 'Divya', 'Bhavya', 'Pallavi', 'Srishti', 'Deepika', 'Simran'];
const LAST_NAMES = ['Singhania', 'Sharma', 'Mehta', 'Patel', 'Verma', 'Gupta', 'Sen', 'Shekhawat', 'Joshi', 'Rajput', 'Bhati', 'Chauhan', 'Agarwal', 'Choudhary', 'Rathore', 'Tiwari', 'Khandelwal', 'Dayal', 'Rawat'];
const COLONIES = ['Malviya Nagar', 'Vidyadhar Nagar', 'Mansarovar', 'Vaishali Nagar', 'Civil Lines', 'Bani Park', 'C-Scheme', 'Raja Park', 'Tonk Road', 'Jhotwara'];

export function generateAllHistoricalStudents(): StudentRecord[] {
  const students: StudentRecord[] = [];

  for (let grade = 10; grade >= 1; grade--) {
    for (const section of ['A', 'B'] as const) {
      const gradeStr = grade.toString().padStart(2, '0');
      const classId = `class-${gradeStr}-${section.toLowerCase()}`;
      const classLabel = `Class ${gradeStr}-${section}`;
      const prefix = `STU-${gradeStr}${section}`;

      for (let roll = 1; roll <= 50; roll++) {
        const studentId = `${prefix}-${roll.toString().padStart(2, '0')}`;
        const isFemale = roll % 2 === 0;
        const firstNameList = isFemale ? FIRST_NAMES_F : FIRST_NAMES_M;
        let fName = firstNameList[(roll + grade * 3) % firstNameList.length];
        let lName = LAST_NAMES[(roll * 2 + grade) % LAST_NAMES.length];
        let attPct = Math.round((84 + ((roll * 7 + grade * 3) % 15)) * 10) / 10;
        let acadAvg = Math.round((72 + ((roll * 11 + grade * 5) % 24)) * 10) / 10;
        let enrollmentDate = '2023-04-03';
        let flags: any[] = [];

        // Baseline overrides for Class 10-A
        if (grade === 10 && section === 'A') {
          if (roll === 1) { // Aarav Singhania (Key demo persona)
            fName = 'Aarav';
            lName = 'Singhania';
            attPct = 88.5;
            acadAvg = 81.0;
            enrollmentDate = '2023-04-03'; // Long-standing student (all 3 years)
            flags = [
              { id: 'flag-01', code: 'ATT-01', type: 'attendance', severity: 'alert', title: '3 Consecutive Absences', reason: 'Absent on consecutive days in September without medical note.', triggeredAt: '2025-09-05T09:30:00Z', resolved: false },
              { id: 'flag-02', code: 'ACAD-04', type: 'academic', severity: 'warning', title: 'Performance Decline in Mathematics', reason: 'Drop from 22/25 (88%) in UT 1 to 15/25 (60%) in UT 2 in Mathematics.', triggeredAt: '2025-09-16T14:15:00Z', resolved: false },
            ];
          } else if (roll === 2) { // Ananya Sharma (Topper - full attendance)
            fName = 'Ananya';
            lName = 'Sharma';
            attPct = 96.5;
            acadAvg = 93.5;
            enrollmentDate = '2023-04-03';
          } else if (roll === 3) {
            fName = 'Devendra';
            lName = 'Bhati';
            attPct = 74.0;
            enrollmentDate = '2023-04-03';
            flags = [{ id: 'flag-05', code: 'ATT-03', type: 'attendance', severity: 'alert', title: 'Below 75% CBSE Threshold', reason: 'Cumulative attendance at 74.0% is below the mandatory 75% requirement.', triggeredAt: '2025-10-20T08:00:00Z', resolved: false }];
          } else if (roll === 4) {
            fName = 'Diya';
            lName = 'Patel';
            enrollmentDate = '2023-04-03';
          } else if (roll === 5) {
            fName = 'Harshvardhan';
            lName = 'Joshi';
            enrollmentDate = '2023-04-03';
          } else if (roll === 6) {
            fName = 'Ishaan';
            lName = 'Gupta';
            enrollmentDate = '2023-04-03';
          } else if (roll === 7) { // Kabir Verma (Attendance risk)
            fName = 'Kabir';
            lName = 'Verma';
            attPct = 72.0;
            acadAvg = 65.0;
            enrollmentDate = '2023-04-03';
            flags = [{ id: 'flag-03', code: 'ATT-03', type: 'attendance', severity: 'alert', title: 'Below 75% CBSE Threshold', reason: 'Cumulative attendance at 72.0% is below the mandatory 75% requirement.', triggeredAt: '2025-10-20T08:00:00Z', resolved: false }];
          } else if (roll === 8) {
            fName = 'Meera';
            lName = 'Rajput';
            enrollmentDate = '2023-04-03';
          } else if (roll === 9) {
            fName = 'Priya';
            lName = 'Sen';
            enrollmentDate = '2023-04-03';
          } else if (roll === 10) {
            fName = 'Riya';
            lName = 'Choudhary';
            enrollmentDate = '2023-04-03';
          } else if (roll === 11) {
            fName = 'Rohan';
            lName = 'Mehta';
            enrollmentDate = '2023-04-03';
          } else if (roll === 12) {
            fName = 'Tanvi';
            lName = 'Shekhawat';
            enrollmentDate = '2023-04-03';
          } else if (roll === 15) { // Admitted in previous academic year (2024–25)
            fName = 'Pooja';
            lName = 'Khandelwal';
            enrollmentDate = '2024-04-05';
          } else if (roll === 25) { // Admitted at start of current academic year (2025–26)
            fName = 'Ayush';
            lName = 'Chauhan';
            enrollmentDate = '2025-04-07';
          } else if (roll === 35) { // Admitted mid-term in current academic year (August 18, 2025)
            fName = 'Siddharth';
            lName = 'Rajput';
            enrollmentDate = '2025-08-18';
          }
        } else {
          // Graded enrolment dates for other classes
          if (grade === 1) {
            enrollmentDate = '2025-04-07';
          } else if (grade === 2) {
            enrollmentDate = '2024-04-05';
          } else if (roll === 48) {
            enrollmentDate = '2025-04-07'; // Current year admit
          } else if (roll === 49) {
            enrollmentDate = '2024-04-05'; // Previous year admit
          } else if (roll === 50) {
            enrollmentDate = '2025-08-18'; // Mid-term admit
          }
        }

        const progression = getStudentProgression(grade, section, enrollmentDate);
        progression.forEach(p => p.rollNumber = roll);

        const birthYear = 2026 - (grade + 5);
        const colony = COLONIES[(roll + grade) % COLONIES.length];

        students.push({
          id: studentId,
          admissionNumber: `ADM/${enrollmentDate.slice(0, 4)}/${grade * 100 + roll}`,
          rollNumber: roll,
          firstName: fName,
          lastName: lName,
          fullName: `${fName} ${lName}`,
          gender: isFemale ? 'F' : 'M',
          dateOfBirth: `${birthYear}-0${(roll % 9) + 1}-14`,
          enrollmentDate,
          classId,
          classLabel,
          academicYearId: 'year-2025-2026',
          status: 'enrolled',
          guardianName: `${lName === 'Sharma' || lName === 'Verma' ? 'Dr.' : 'Shri'} ${fName.slice(0, 3)}esh ${lName}`,
          guardianRelation: 'Father',
          primaryPhone: `+91 9829${grade} ${10000 + roll}`,
          residentialAddress: `Plot ${roll * 3}, Block B, ${colony}, Jaipur`,
          city: 'Jaipur',
          state: 'Rajasthan',
          pincode: '302020',
          attendancePercentage: attPct,
          academicAverage: acadAvg,
          activeFlags: flags,
          createdAt: `${enrollmentDate}T10:00:00Z`,
          updatedAt: '2026-10-21T08:00:00Z',
          // Attached historical enrolment progression
          ...( { previousEnrollments: progression } as any ),
        });
      }
    }
  }

  return students;
}

// ============================================================================
// 10. Generate All 3-Year Historical Marks Registers
// ============================================================================
export function generateAllHistoricalMarksRegisters(students: StudentRecord[]): MarksRegister[] {
  const registers: MarksRegister[] = [];

  // Core classes where 3-year progression is actively inspected
  const targetClasses = [
    { grade: 10, section: 'A', classId: 'class-10-a', label: 'Class 10-A', teacherId: 'staff-003', teacherName: 'Shri Alok Saxena' },
    { grade: 10, section: 'B', classId: 'class-10-b', label: 'Class 10-B', teacherId: 'staff-005', teacherName: 'Smt. Sunita Verma' },
    { grade: 9,  section: 'A', classId: 'class-09-a', label: 'Class 09-A', teacherId: 'staff-006', teacherName: 'Shri Dinesh Rathore' },
    { grade: 9,  section: 'B', classId: 'class-09-b', label: 'Class 09-B', teacherId: 'staff-007', teacherName: 'Smt. Kavita Shekhawat' },
    { grade: 8,  section: 'A', classId: 'class-08-a', label: 'Class 08-A', teacherId: 'staff-008', teacherName: 'Shri Mahesh Tiwari' },
    { grade: 8,  section: 'B', classId: 'class-08-b', label: 'Class 08-B', teacherId: 'staff-009', teacherName: 'Smt. Pooja Khandelwal' },
  ];

  historicalAssessmentCycles.forEach(cycle => {
    const yearId = cycle.academicYearId;

    targetClasses.forEach(cls => {
      // Find students who were in this class during this academic year
      const enrolledStudents = students.filter(s => {
        const prog = (s as any).previousEnrollments as StudentProgressionEntry[] | undefined;
        if (prog) {
          const match = prog.find(p => p.academicYearId === yearId && p.classId === cls.classId);
          return !!match && s.enrollmentDate <= cycle.endDate;
        }
        return s.classId === cls.classId && s.enrollmentDate <= cycle.endDate;
      });

      if (enrolledStudents.length === 0) return;

      // Core subjects for this grade
      const subjectsForGrade = historicalSubjects.filter(s => s.gradeLevel === cls.grade);

      subjectsForGrade.forEach(subject => {
        const isDraftEdge = yearId === 'year-2025-2026' && cls.classId === 'class-10-b' && subject.id === 'sub-math-10' && cycle.id === 'assess-ut2-2025';
        const isSubmittedEdge = yearId === 'year-2025-2026' && cls.classId === 'class-10-a' && subject.id === 'sub-sci-10' && cycle.id === 'assess-ut2-2025';
        const status = isDraftEdge ? 'draft' : isSubmittedEdge ? 'submitted' : 'finalized';

        const entries: StudentMarkEntry[] = enrolledStudents.map(student => {
          let marks: number | null = null;
          const isAbsent = false;

          // Deterministic marks for Aarav Singhania (STU-10A-01)
          if (student.id === 'STU-10A-01' && subject.name === 'Mathematics') {
            if (cycle.id === 'assess-ut1-2025') marks = 22;      // 22/25 (88%)
            else if (cycle.id === 'assess-ut2-2025') marks = 15; // 15/25 (60%)
            else if (cycle.id === 'assess-hy-2025') marks = 63;  // 63/80 (78.8%)
            else if (cycle.id === 'assess-annual-2026') marks = 71; // 71/80 (88.8%)
            else if (cycle.id === 'assess-ut1-2024') marks = 20; // Class 9 UT1 (80%)
            else if (cycle.id === 'assess-ut2-2024') marks = 21; // Class 9 UT2 (84%)
            else if (cycle.id === 'assess-hy-2024') marks = 62;  // Class 9 HY (77.5%)
            else if (cycle.id === 'assess-annual-2025') marks = 66; // Class 9 Ann (82.5%)
            else if (cycle.id === 'assess-ut1-2023') marks = 19; // Class 8 UT1 (76%)
            else if (cycle.id === 'assess-ut2-2023') marks = 20; // Class 8 UT2 (80%)
            else if (cycle.id === 'assess-hy-2023') marks = 60;  // Class 8 HY (75%)
            else if (cycle.id === 'assess-annual-2024') marks = 64; // Class 8 Ann (80%)
          } else if (student.id === 'STU-10A-02') { // Ananya Sharma (Topper: 92–96%)
            const pct = 0.94;
            marks = Math.round(cycle.maxMarks * pct);
          } else if (student.id === 'STU-10A-05') { // Kabir Verma (Attendance dip: 65%)
            const pct = 0.65;
            marks = Math.round(cycle.maxMarks * pct);
          } else {
            // Scaled based on student's baseline academic average
            const factor = cycle.maxMarks === 25 ? 0.25 : 0.8;
            const variance = ((student.rollNumber * 7 + subject.name.length * 3 + cycle.title.length) % 7) - 3;
            const raw = Math.round(student.academicAverage * factor) + variance;
            marks = Math.min(cycle.maxMarks, Math.max(cycle.passingMarks, raw));
          }

          const { grade, percentage } = calculateGrade(marks, cycle.maxMarks);

          return {
            studentId: student.id,
            studentName: student.fullName,
            rollNumber: student.rollNumber,
            marksObtained: marks,
            isAbsent,
            percentage: percentage || undefined,
            grade,
            remarks: marks! >= cycle.passingMarks ? 'Satisfactory' : 'Remedial Tutorial Required',
          };
        });

        registers.push({
          id: `reg-${cycle.id}-${cls.classId}-${subject.id}`,
          assessmentId: cycle.id,
          assessmentTitle: cycle.title,
          classId: cls.classId,
          classLabel: cls.label,
          subjectId: subject.id,
          subjectName: subject.name,
          maxMarks: cycle.maxMarks,
          passingMarks: cycle.passingMarks,
          teacherId: cls.teacherId,
          teacherName: cls.teacherName,
          status,
          lastSavedAt: `${cycle.endDate}T14:30:00Z`,
          entries,
        });
      });
    });
  });

  return registers;
}

// ============================================================================
// 11. Generate Persisted Daily Attendance Sessions Across the 3 Years
// ============================================================================
export function generateAllHistoricalAttendanceSessions(_students?: StudentRecord[]): CompactAttendanceSession[] {
  const sessions: CompactAttendanceSession[] = [];
  const allGeneratedClasses = generateAllHistoricalClasses();
  const seenClassIds = new Set<string>();
  const targetClasses: Array<{ classId: string; label: string; teacherId: string; teacherName: string }> = [];
  allGeneratedClasses.forEach(cls => {
    if (!seenClassIds.has(cls.id)) {
      seenClassIds.add(cls.id);
      targetClasses.push({
        classId: cls.id,
        label: cls.label,
        teacherId: cls.classTeacherId,
        teacherName: cls.classTeacherName,
      });
    }
  });

  historicalAcademicYears.forEach(year => {
    const calendarDays = generateAcademicCalendarDays(year);
    const schoolDays = calendarDays.filter(d => d.isSchoolDay);

    schoolDays.forEach(day => {
      const dateStr = day.date;

      targetClasses.forEach(cls => {
        // Enrolled roll numbers on this date
        const absentRolls: number[] = [];
        const lateRolls: number[] = [];
        const excusedRolls: number[] = [];
        const remarksByRoll: Record<number, string> = {};

        // Explicit attendance behaviour for Class 10-A
        if (cls.classId === 'class-10-a') {
          // Aarav Singhania (Roll 1):
          // In 2025–26 interval between UT1 (2025-07-21) and Half Yearly (2025-11-17):
          // Explicitly absent on 2025-09-02, 2025-09-03, 2025-10-14 (3 absences!).
          // Excused on 2025-08-19.
          if (dateStr === '2025-09-02' || dateStr === '2025-09-03') {
            absentRolls.push(1);
            remarksByRoll[1] = 'Viral fever reported by guardian';
          } else if (dateStr === '2025-10-14') {
            absentRolls.push(1);
            remarksByRoll[1] = 'Dental clinic visit';
          } else if (dateStr === '2025-08-19') {
            excusedRolls.push(1);
            remarksByRoll[1] = 'CBSE Zonal Science Exhibition duty';
          } else if (dateStr === '2026-10-14') {
            absentRolls.push(1);
            remarksByRoll[1] = 'Dental clinic visit';
          } else if (dateStr === '2026-10-06') {
            excusedRolls.push(1);
            remarksByRoll[1] = 'Inter-School debate representation';
          }

          // Kabir Verma (Roll 5 - 72% attendance): frequent absences
          const dayNum = parseInt(dateStr.slice(8, 10), 10);
          if (dayNum === 7 || dayNum === 8 || dayNum === 21) {
            absentRolls.push(5);
            remarksByRoll[5] = 'Unnotified absence';
          }

          // Random late rolls for other students
          if (dayNum % 11 === 0) lateRolls.push(6);
          if (dayNum % 13 === 0) lateRolls.push(11);
        } else {
          // Deterministic absences for other classes (1 to 3 absences per day)
          const hash = dateStr.charCodeAt(dateStr.length - 1) + cls.classId.charCodeAt(cls.classId.length - 1);
          const rollA = (hash % 45) + 2;
          absentRolls.push(rollA);
          if (hash % 3 === 0) absentRolls.push((rollA + 12) % 49 + 1);
        }

        const totalStudents = 50;
        const absentCount = absentRolls.length;
        const lateCount = lateRolls.length;
        const excusedCount = excusedRolls.length;
        const presentCount = totalStudents - absentCount - excusedCount;

        sessions.push({
          id: `att-${cls.classId}-${dateStr}`,
          classId: cls.classId,
          classLabel: cls.label,
          date: dateStr,
          academicYearId: year.id,
          takenByStaffId: cls.teacherId,
          takenByStaffName: cls.teacherName,
          status: 'submitted',
          totalStudents,
          presentCount,
          absentCount,
          lateCount,
          excusedCount,
          absentRolls,
          lateRolls: lateRolls.length ? lateRolls : undefined,
          excusedRolls: excusedRolls.length ? excusedRolls : undefined,
          remarksByRoll: Object.keys(remarksByRoll).length ? remarksByRoll : undefined,
        });
      });
    });
  });

  return sessions;
}

// ============================================================================
// 12. Generate Chronological Teacher Notes & Proctorial Care Records
// ============================================================================
export function generateAllHistoricalTeacherNotes(): IncidentRecord[] {
  return [
    // 2023–2024 Notes
    {
      id: 'inc-2023-01',
      studentId: 'STU-10A-01',
      studentName: 'Aarav Singhania',
      classId: 'class-08-a',
      classLabel: 'Class 08-A',
      date: '2023-11-25',
      category: 'commendation',
      severity: 'commendation',
      title: 'Class 8 Science Project Distinction',
      description: 'Awarded first position in Junior Science Fair for working hydraulic crane model.',
      actionTaken: 'Commendation certificate awarded during assembly.',
      loggedByStaffId: 'staff-008',
      loggedByStaffName: 'Shri Mahesh Tiwari',
      loggedByStaffRole: 'class_teacher',
      createdAt: '2023-11-25T11:00:00Z',
      parentNotified: true,
    },
    {
      id: 'inc-2023-02',
      studentId: 'STU-10A-02',
      studentName: 'Ananya Sharma',
      classId: 'class-08-a',
      classLabel: 'Class 08-A',
      date: '2023-12-10',
      category: 'commendation',
      severity: 'commendation',
      title: 'Inter-School Spell Bee Champion',
      description: 'Secured gold medal representing the school at District Spell Bee.',
      actionTaken: 'Special mention in annual magazine.',
      loggedByStaffId: 'staff-001',
      loggedByStaffName: 'Dr. Vikramaditya Sharma',
      loggedByStaffRole: 'principal',
      createdAt: '2023-12-10T12:00:00Z',
      parentNotified: true,
    },

    // 2024–2025 Notes
    {
      id: 'inc-2024-01',
      studentId: 'STU-10A-01',
      studentName: 'Aarav Singhania',
      classId: 'class-09-a',
      classLabel: 'Class 09-A',
      date: '2024-09-18',
      category: 'commendation',
      severity: 'commendation',
      title: 'Active Participation in Hindi Debate',
      description: 'Demonstrated strong oratory skills and represented Class 9 in Inter-House Hindi Debate.',
      actionTaken: 'Certificate of merit awarded.',
      loggedByStaffId: 'staff-006',
      loggedByStaffName: 'Shri Dinesh Rathore',
      loggedByStaffRole: 'class_teacher',
      createdAt: '2024-09-18T13:30:00Z',
      parentNotified: true,
    },
    {
      id: 'inc-2024-02',
      studentId: 'STU-10A-05',
      studentName: 'Kabir Verma',
      classId: 'class-09-a',
      classLabel: 'Class 09-A',
      date: '2024-11-12',
      category: 'punctuality',
      severity: 'notice',
      title: 'Morning Assembly Late Arrival',
      description: 'Arrived after national anthem on three consecutive mornings.',
      actionTaken: 'Parent notified; adjusted morning transit schedule.',
      loggedByStaffId: 'staff-006',
      loggedByStaffName: 'Shri Dinesh Rathore',
      loggedByStaffRole: 'class_teacher',
      createdAt: '2024-11-12T08:30:00Z',
      parentNotified: true,
    },

    // 2025–2026 Notes (Current Session)
    // Between UT1 (2025-07-21) and Half Yearly (2025-11-17):
    {
      id: 'inc-2025-01',
      studentId: 'STU-10A-01',
      studentName: 'Aarav Singhania',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      date: '2025-08-25',
      category: 'academic_integrity',
      severity: 'notice',
      title: 'Difficulty Observed in Algebraic Equations',
      description: 'Student struggled with multi-step quadratic and linear systems during classroom tutorials; recommended extra practice.',
      actionTaken: 'Assigned supplementary problem set with Shri Alok Saxena.',
      loggedByStaffId: 'staff-003',
      loggedByStaffName: 'Shri Alok Saxena',
      loggedByStaffRole: 'class_teacher',
      createdAt: '2025-08-25T14:15:00Z',
      parentNotified: true,
    },
    {
      id: 'inc-2025-02',
      studentId: 'STU-10A-01',
      studentName: 'Aarav Singhania',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      date: '2025-09-15',
      category: 'academic_integrity',
      severity: 'notice',
      title: 'Unit Test 2 Marks Review & Conference',
      description: 'Discussed Unit Test 2 marks decline (15/25, 60%) in Mathematics with student; scheduled remedial support.',
      actionTaken: 'Scheduled twice-weekly study hall tutorial.',
      loggedByStaffId: 'staff-003',
      loggedByStaffName: 'Shri Alok Saxena',
      loggedByStaffRole: 'class_teacher',
      createdAt: '2025-09-15T15:00:00Z',
      parentNotified: true,
    },
    {
      id: 'inc-2025-03',
      studentId: 'STU-10A-01',
      studentName: 'Aarav Singhania',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      date: '2025-10-12',
      category: 'punctuality',
      severity: 'notice',
      title: 'Parent Discussion Regarding September Absences',
      description: 'Telephonic conference with Shri Sanjay Singhania regarding 2 consecutive absences in September.',
      actionTaken: 'Guardian confirmed viral illness and submitted clinic receipt.',
      loggedByStaffId: 'staff-003',
      loggedByStaffName: 'Shri Alok Saxena',
      loggedByStaffRole: 'class_teacher',
      createdAt: '2025-10-12T10:45:00Z',
      parentNotified: true,
    },
    {
      id: 'inc-2025-04',
      studentId: 'STU-10A-01',
      studentName: 'Aarav Singhania',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      date: '2025-10-18',
      category: 'academic_integrity',
      severity: 'notice',
      title: 'Unsubmitted Mathematics Diagnostic Task',
      description: 'Student missed submission deadline for Unit Test 2 preparation workbook. Tutor conference completed.',
      actionTaken: 'Assigned supervised study hall tutorial with Shri Alok Saxena.',
      loggedByStaffId: 'staff-003',
      loggedByStaffName: 'Shri Alok Saxena',
      loggedByStaffRole: 'class_teacher',
      createdAt: '2025-10-18T12:30:00Z',
      parentNotified: true,
    },
    {
      id: 'inc-2025-05',
      studentId: 'STU-10A-02',
      studentName: 'Ananya Sharma',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      date: '2025-10-15',
      category: 'commendation',
      severity: 'commendation',
      title: '1st Position in State Science Olympiad',
      description: 'Secured gold medal and certificate of distinction in Junior State Science Congress.',
      actionTaken: 'Commended during School Morning Assembly; citation recorded in student dossier.',
      loggedByStaffId: 'staff-001',
      loggedByStaffName: 'Dr. Vikramaditya Sharma',
      loggedByStaffRole: 'principal',
      createdAt: '2025-10-15T11:00:00Z',
      parentNotified: true,
    },
    {
      id: 'inc-2025-06',
      studentId: 'STU-10A-05',
      studentName: 'Kabir Verma',
      classId: 'class-10-a',
      classLabel: 'Class 10-A',
      date: '2025-10-19',
      category: 'punctuality',
      severity: 'notice',
      title: 'Repeated Late Arrival at Morning Assembly',
      description: 'Arrived 20 minutes after national anthem on two consecutive school days.',
      actionTaken: 'Telephonic intimation to father Shri Ashok Verma; adjusted bus pickup route.',
      loggedByStaffId: 'staff-003',
      loggedByStaffName: 'Shri Alok Saxena',
      loggedByStaffRole: 'class_teacher',
      createdAt: '2025-10-19T09:15:00Z',
      parentNotified: true,
    },
  ];
}

