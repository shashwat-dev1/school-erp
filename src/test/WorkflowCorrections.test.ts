import { describe, it, expect, beforeEach } from 'vitest';
import { demoRepository } from '../data/demo/demoRepository';
import { initialStaff, initialStudents } from '../data/demo/seedData';
import * as XLSX from 'xlsx';
import { createAttendanceRegisterWorkbook } from '../utils/exportUtils';
import {
  normalizeMark,
  classMarkBenchmarks,
  isCountedAsAbsent,
  isFinalizedResult,
  buildChangeExplanation,
  filterRecordsByDateRange,
} from '../domain/academicAnalytics';
import { Permissions } from '../domain/permissions';

describe('Workflow Corrections & Domain Logic Validation', () => {
  beforeEach(async () => {
    localStorage.clear();
    if (demoRepository.resetDemoData) {
      await demoRepository.resetDemoData();
    }
  });

  const getPrincipal = () => initialStaff.find(s => s.role === 'principal')!;
  const getClassTeacher = () => initialStaff.find(s => s.role === 'class_teacher' && s.assignedClassId === 'class-10-a')!;
  const getSubjectTeacher = () => initialStaff.find(s => s.role === 'subject_teacher')!;

  describe('1. Student Follow-up & Interventions', () => {
    it('allows Class Teacher to record follow-up action with note, date, and actor details', async () => {
      const teacher = getClassTeacher();
      const student = initialStudents[0];

      const record = await demoRepository.recordStudentFollowUp(
        {
          studentId: student.id,
          actionType: 'guardian_contacted',
          actionLabel: 'Guardian contacted',
          note: 'Discussed recent absence patterns with father. Medical note promised.',
          followUpDate: '2026-10-28',
          statusUpdate: 'in_progress',
        },
        teacher
      );

      expect(record.id).toBeDefined();
      expect(record.studentId).toBe(student.id);
      expect(record.actionType).toBe('guardian_contacted');
      expect(record.actorId).toBe(teacher.id);
      expect(record.actorName).toBe(teacher.name);
      expect(record.actorRole).toBe('class_teacher');
      expect(record.note).toContain('Discussed recent absence patterns');

      const history = await demoRepository.getStudentFollowUps(student.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].id).toBe(record.id);
    });

    it('rejects Principal recording follow-up mutations due to read-only policy', async () => {
      const principal = getPrincipal();
      const student = initialStudents[0];

      await expect(
        demoRepository.recordStudentFollowUp(
          {
            studentId: student.id,
            actionType: 'other',
            actionLabel: 'Principal follow-up',
            note: 'Principal inspection note.',
          },
          principal
        )
      ).rejects.toThrow(/read-only/i);
    });
  });

  describe('2. Teacher Notes Permission Boundary (Safest Option)', () => {
    it('allows Class Teacher to log notes on their assigned class section only', () => {
      const classTeacher = getClassTeacher();
      expect(Permissions.canLogIncident(classTeacher, 'class-10-a')).toBe(true);
      expect(Permissions.canLogIncident(classTeacher, 'class-10-b')).toBe(false);
    });

    it('denies Principal and Subject Teacher from creating teacher notes', () => {
      const principal = getPrincipal();
      const subjectTeacher = getSubjectTeacher();
      expect(Permissions.canLogIncident(principal, 'class-10-a')).toBe(false);
      expect(Permissions.canLogIncident(subjectTeacher, 'class-10-a')).toBe(false);
    });
  });

  describe('3. Academic Analytics, Normalization & Benchmarks (FR-3 & FR-4)', () => {
    it('normalizes marks accurately and does not treat missing marks or null as zero', () => {
      expect(normalizeMark(20, 25)).toBe(80);
      expect(normalizeMark(72, 80)).toBe(90);
      expect(normalizeMark(null, 25)).toBeNull();
      expect(normalizeMark(0, 25)).toBe(0);
    });

    it('computes class mean and highest score benchmark without student identities', () => {
      const marks = [
        { score: 20, maxMarks: 25 }, // 80%
        { score: 25, maxMarks: 25 }, // 100%
        { score: 15, maxMarks: 25 }, // 60%
        { score: null, maxMarks: 25, isAbsent: true }, // absent excluded from benchmark
      ];

      const benchmarks = classMarkBenchmarks(marks);
      expect(benchmarks.count).toBe(3);
      expect(benchmarks.mean).toBeCloseTo(80, 1);
      expect(benchmarks.highest).toBe(100);
    });

    it('excludes draft or unsubmitted marks from finalized results', () => {
      expect(isFinalizedResult('finalized')).toBe(true);
      expect(isFinalizedResult('verified_locked')).toBe(true);
      expect(isFinalizedResult('draft')).toBe(false);
      expect(isFinalizedResult('submitted')).toBe(false);
    });

    it('filters records accurately by date range without leaking out-of-range records', () => {
      const records = [
        { date: '2026-10-01', id: '1' },
        { date: '2026-10-15', id: '2' },
        { date: '2026-10-20', id: '3' },
        { date: '2026-10-25', id: '4' },
      ];

      const filtered = filterRecordsByDateRange(records, '2026-10-10', '2026-10-22');
      expect(filtered).toHaveLength(2);
      expect(filtered.map(r => r.id)).toEqual(['2', '3']);
    });
  });

  describe('4. Evidence-Based Academic Change Explanation (FR-2)', () => {
    it('uses non-causal phrasing ("Possible contributing factors", "relevant information to discuss")', () => {
      const explanation = buildChangeExplanation({
        earlier: { title: 'Unit Test 1', score: 22, maxMarks: 25 },
        later: { title: 'Unit Test 2', score: 15, maxMarks: 25 },
        absences: 4,
        notes: ['Student missed 2 revision classes.'],
      });

      expect(explanation[0]).toContain('Possible contributing factors');
      expect(explanation[0]).toContain('do not establish its cause');
      expect(explanation.some(l => l.includes('4 absences were recorded between the assessment periods; this is relevant information to discuss'))).toBe(true);
      expect(explanation.some(l => l.includes('Teacher note: Student missed 2 revision classes.'))).toBe(true);
    });

    it('states clearly when there is insufficient history to compare', () => {
      const explanation = buildChangeExplanation({
        earlier: { title: 'Unit Test 1', score: null, maxMarks: 25 },
        later: { title: 'Unit Test 2', score: 18, maxMarks: 25 },
      });

      expect(explanation.some(l => l.includes('not enough recorded marks information'))).toBe(true);
    });
  });

  describe('5. Attendance Logic: Unmarked Is Never Counted as Absent (FR-5)', () => {
    it('correctly classifies absent vs unmarked, holiday, and day off', () => {
      expect(isCountedAsAbsent('absent')).toBe(true);
      expect(isCountedAsAbsent('unmarked')).toBe(false);
      expect(isCountedAsAbsent('holiday')).toBe(false);
      expect(isCountedAsAbsent('day_off')).toBe(false);
      expect(isCountedAsAbsent('present')).toBe(false);
    });

    it('strictly checks 75% attendance threshold', () => {
      const isBelowThreshold = (pct: number) => pct < 75.0;
      expect(isBelowThreshold(74.9)).toBe(true);
      expect(isBelowThreshold(75.0)).toBe(false);
      expect(isBelowThreshold(75.1)).toBe(false);
    });
  });

  describe('6. Grade-Level Class Academic Summary Validation', () => {
    it('validates that all selected sections belong to the exact same grade', () => {
      const validateSameGrade = (sections: Array<{ grade: number }>) => {
        if (sections.length === 0) return false;
        const targetGrade = sections[0].grade;
        return sections.every(s => s.grade === targetGrade);
      };

      expect(validateSameGrade([{ grade: 10 }, { grade: 10 }])).toBe(true);
      expect(validateSameGrade([{ grade: 10 }, { grade: 9 }])).toBe(false);
    });
  });

  describe('7. Genuine Excel (.xlsx) Register Generation & Re-parsing (FR-6)', () => {
    it('generates real .xlsx with first columns [S. No., Roll No., Student Name], dates, and omits L from legend by default', () => {
      const wb = createAttendanceRegisterWorkbook({
        scopeTitle: 'Class 10-A',
        dateHeaders: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'],
        students: [
          {
            admissionNumber: 'ADM/2023/1001',
            rollNumber: 1,
            studentName: 'Aarav Singhania',
            classLabel: 'Class 10-A',
            attendanceByDate: {
              '2026-10-19': 'P',
              '2026-10-20': 'A',
              '2026-10-21': 'OFF',
              '2026-10-22': 'HOLIDAY',
              '2026-10-23': 'UNMARKED',
            },
          },
          {
            admissionNumber: 'ADM/2023/1002',
            rollNumber: 2,
            studentName: 'Ananya Sharma',
            classLabel: 'Class 10-A',
            attendanceByDate: {
              '2026-10-19': 'P',
              '2026-10-20': 'P',
              '2026-10-21': 'P',
              '2026-10-22': 'P',
              '2026-10-23': 'P',
            },
          },
        ],
        includeApprovedLeave: false, // by default omitted from legend
      });

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(1000);

      const parsedWb = XLSX.read(buffer, { type: 'buffer' });
      expect(parsedWb.SheetNames).toContain('Attendance Register');
      const parsedRows = XLSX.utils.sheet_to_json(parsedWb.Sheets['Attendance Register'], { header: 1, blankrows: true }) as unknown[][];

      const headerIndex = parsedRows.findIndex(row => row.includes('Student Name'));
      expect(headerIndex).toBeGreaterThanOrEqual(0);
      const headers = parsedRows[headerIndex] as string[];

      // First columns must be S. No., Roll No., Student Name, followed by dates
      expect(headers.slice(0, 3)).toEqual(['S. No.', 'Roll No.', 'Student Name']);
      expect(headers.slice(3, 8)).toEqual(['19 Oct', '20 Oct', '21 Oct', '22 Oct', '23 Oct']);
      expect(headers.slice(8)).toEqual(['Total Present', 'Total Absent', 'Attendance %']);

      const studentRows = parsedRows.slice(headerIndex + 1).filter(row => typeof row[0] === 'number');
      expect(studentRows).toHaveLength(2);
      expect(studentRows[0][2]).toBe('Aarav Singhania');
      expect(studentRows[0].slice(3, 8)).toEqual(['P', 'A', 'OFF', 'HOLIDAY', 'UNMARKED']);
      expect(studentRows[0][8]).toBe(1); // Present
      expect(studentRows[0][9]).toBe(1); // Absent
      expect(studentRows[0][10]).toBe('50.0%'); // 1 / (1 + 1)

      // Verify legend contains P, A, OFF, HOLIDAY, UNMARKED and omits L
      expect(parsedRows.some(row => row.includes('P') && row.includes('Present'))).toBe(true);
      expect(parsedRows.some(row => row.includes('A') && row.includes('Absent'))).toBe(true);
      expect(parsedRows.some(row => row.includes('OFF') && row.includes('Scheduled school day off'))).toBe(true);
      expect(parsedRows.some(row => row.includes('HOLIDAY') && row.includes('School holiday'))).toBe(true);
      expect(parsedRows.some(row => row.includes('UNMARKED') && row.includes('No attendance record entered'))).toBe(true);
      expect(parsedRows.some(row => row.includes('Approved leave'))).toBe(false);
    });

    it('includes L in legend when includeApprovedLeave is explicitly true', () => {
      const wb = createAttendanceRegisterWorkbook({
        scopeTitle: 'Class 10-A',
        dateHeaders: ['2026-10-23'],
        students: [
          {
            admissionNumber: 'ADM/2023/1001',
            rollNumber: 1,
            studentName: 'Aarav Singhania',
            classLabel: 'Class 10-A',
            attendanceByDate: { '2026-10-23': 'P' },
          },
        ],
        includeApprovedLeave: true,
      });

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const parsedWb = XLSX.read(buffer, { type: 'buffer' });
      const parsedRows = XLSX.utils.sheet_to_json(parsedWb.Sheets['Attendance Register'], { header: 1, blankrows: true }) as unknown[][];
      expect(parsedRows.some(row => row.includes('L') && row.includes('Approved leave'))).toBe(true);
    });

    it('blocks empty register workbooks with an explicit error', () => {
      expect(() =>
        createAttendanceRegisterWorkbook({
          scopeTitle: 'Class 10-A',
          dateHeaders: ['2026-10-23'],
          students: [],
        })
      ).toThrow(/select at least one date and one student/i);
    });
  });

  describe('8. Reconciliation Integrity across Views', () => {
    it('underlying record reconciles with normalized percentage and attendance metrics', async () => {
      const student = initialStudents[0];
      const consolidated = await demoRepository.getConsolidatedClassMarks(student.classId);
      expect(consolidated.matrix[student.id]).toBeDefined();

      const studentSubjects = consolidated.matrix[student.id];
      const validEntries = Object.values(studentSubjects).filter(
        (entry): entry is NonNullable<typeof entry> => entry !== null && !entry.isAbsent && entry.marksObtained !== null
      );

      expect(validEntries.length).toBeGreaterThan(0);
      validEntries.forEach(entry => {
        const pct = normalizeMark(entry.marksObtained, 25);
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
      });
    });
  });
});
