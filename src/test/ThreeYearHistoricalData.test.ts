import { describe, it, expect, beforeEach } from 'vitest';
import { demoRepository } from '../data/demo/demoRepository';
import {
  historicalAcademicYears,
  generateAcademicCalendarDays,
} from '../data/demo/historicalGenerator';
import { buildChangeExplanation } from '../domain/academicAnalytics';

describe('HanuJai ERP — Complete 3-Year Historical Demonstration Dataset', () => {
  beforeEach(async () => {
    await demoRepository.resetDemoData();
  });

  describe('Scenario A: 3-Year Academic Calendar & Assessment Cycles', () => {
    it('configures exactly three full academic sessions (2023–2026)', async () => {
      const years = await demoRepository.getAcademicYears();
      expect(years).toHaveLength(3);
      expect(years.map(y => y.label)).toEqual(['2023–2024', '2024–2025', '2025–2026']);

      const activeYear = await demoRepository.getActiveAcademicYear();
      expect(activeYear.id).toBe('year-2025-2026');
      expect(activeYear.isCurrent).toBe(true);
    });

    it('configures exactly 12 assessment cycles (4 per year with standard CBSE weightages)', async () => {
      const cycles = await demoRepository.getAssessmentCycles();
      expect(cycles).toHaveLength(12);

      const cycles2023 = cycles.filter(c => c.academicYearId === 'year-2023-2024');
      const cycles2024 = cycles.filter(c => c.academicYearId === 'year-2024-2025');
      const cycles2025 = cycles.filter(c => c.academicYearId === 'year-2025-2026');

      expect(cycles2023).toHaveLength(4);
      expect(cycles2024).toHaveLength(4);
      expect(cycles2025).toHaveLength(4);

      // Verify max marks: UTs are 25, HY and Annual are 80
      cycles.forEach(c => {
        if (c.type === 'unit_test_1' || c.type === 'unit_test_2') {
          expect(c.maxMarks).toBe(25);
          expect(c.passingMarks).toBe(9);
        } else {
          expect(c.maxMarks).toBe(80);
          expect(c.passingMarks).toBe(27);
        }
      });
    });

    it('generates realistic calendar days excluding Rajasthan breaks, Sundays, and 2nd/4th Saturdays', () => {
      const year2025 = historicalAcademicYears.find(y => y.id === 'year-2025-2026')!;
      const days = generateAcademicCalendarDays(year2025);
      expect(days.length).toBeGreaterThan(360);

      const schoolDays = days.filter(d => d.isSchoolDay);
      // Rajasthan CBSE instructional days are typically 210–235 days
      expect(schoolDays.length).toBeGreaterThanOrEqual(210);
      expect(schoolDays.length).toBeLessThanOrEqual(240);

      // Check known national holidays are not school days
      const independenceDay = days.find(d => d.date === '2025-08-15');
      expect(independenceDay?.isSchoolDay).toBe(false);
      expect(independenceDay?.holidayReason).toContain('Independence Day');

      const gandhiJayanti = days.find(d => d.date === '2025-10-02');
      expect(gandhiJayanti?.isSchoolDay).toBe(false);

      const republicDay = days.find(d => d.date === '2026-01-26');
      expect(republicDay?.isSchoolDay).toBe(false);
    });
  });

  describe('Scenario B: 1,000 Students with Grade Progression', () => {
    it('generates exactly 1,000 enrolled students across 20 active sections', async () => {
      const res = await demoRepository.getStudents({ limit: 1200 });
      expect(res.total).toBe(1000);
      expect(res.items.length).toBe(1000);

      const classes = await demoRepository.getClasses();
      expect(classes).toHaveLength(20);
      classes.forEach(cls => {
        const classStudents = res.items.filter(s => s.classId === cls.id);
        expect(classStudents).toHaveLength(50);
      });
    });

    it('maintains consistent historical progression for long-standing students', async () => {
      const aarav = await demoRepository.getStudentById('STU-10A-01');
      expect(aarav).toBeDefined();
      expect(aarav!.fullName).toBe('Aarav Singhania');
      expect(aarav!.classId).toBe('class-10-a');

      const progression = (aarav as any).previousEnrollments;
      expect(progression).toBeDefined();
      expect(progression).toHaveLength(3);

      // 2023–2024: Class 8-A
      expect(progression[0]).toMatchObject({
        academicYearId: 'year-2023-2024',
        grade: 8,
        classId: 'class-08-a',
        rollNumber: 1,
      });

      // 2024–2025: Class 9-A
      expect(progression[1]).toMatchObject({
        academicYearId: 'year-2024-2025',
        grade: 9,
        classId: 'class-09-a',
        rollNumber: 1,
      });

      // 2025–2026: Class 10-A
      expect(progression[2]).toMatchObject({
        academicYearId: 'year-2025-2026',
        grade: 10,
        classId: 'class-10-a',
        rollNumber: 1,
      });
    });
  });

  describe('Scenario C: Recent Admissions Handling (No Fabricated Pre-Enrolment History)', () => {
    it('handles student admitted in previous year (2024–25) without fabricated 2023 history', async () => {
      const pooja = await demoRepository.getStudentById('STU-10A-15');
      expect(pooja).toBeDefined();
      expect(pooja!.enrollmentDate).toBe('2024-04-05');

      const progression = (pooja as any).previousEnrollments;
      expect(progression).toBeDefined();
      expect(progression).toHaveLength(2); // Only 2024–25 and 2025–26
      expect(progression.some((p: any) => p.academicYearId === 'year-2023-2024')).toBe(false);
      expect(progression[0].academicYearId).toBe('year-2024-2025');
      expect(progression[1].academicYearId).toBe('year-2025-2026');
    });

    it('handles student admitted in current year (2025–26) without fabricated prior history', async () => {
      const ayush = await demoRepository.getStudentById('STU-10A-25');
      expect(ayush).toBeDefined();
      expect(ayush!.enrollmentDate).toBe('2025-04-07');

      const progression = (ayush as any).previousEnrollments;
      expect(progression).toBeDefined();
      expect(progression).toHaveLength(1); // Only 2025–26
      expect(progression[0].academicYearId).toBe('year-2025-2026');
    });

    it('handles mid-term admitted student (2025-08-18) honestly in daily attendance', async () => {
      const siddharth = await demoRepository.getStudentById('STU-10A-35');
      expect(siddharth).toBeDefined();
      expect(siddharth!.enrollmentDate).toBe('2025-08-18');

      // Check attendance session BEFORE his enrollment date (e.g. 2025-07-21)
      const sessionBefore = await demoRepository.getAttendanceSession('class-10-a', '2025-07-21');
      expect(sessionBefore).toBeDefined();
      if (sessionBefore) {
        const record = sessionBefore.records.find(r => r.studentId === 'STU-10A-35');
        // Mid-term admit must NOT be included in attendance taken before admission date
        expect(record).toBeUndefined();
      }

      // Check attendance session AFTER his enrollment date (e.g. 2025-09-02)
      const sessionAfter = await demoRepository.getAttendanceSession('class-10-a', '2025-09-02');
      expect(sessionAfter).toBeDefined();
      if (sessionAfter) {
        const record = sessionAfter.records.find(r => r.studentId === 'STU-10A-35');
        expect(record).toBeDefined();
        expect(record!.studentName).toBe('Siddharth Rajput');
      }
    });
  });

  describe('Scenario D: 3-Year Historical Marks & Deterministic Benchmarks', () => {
    it('provides multi-year marks across 12 cycles for Aarav Singhania in Mathematics', async () => {
      const studentMarks = await demoRepository.getStudentMarksRegisters('STU-10A-01');
      expect(studentMarks.length).toBeGreaterThan(0);

      const mathRegisters = studentMarks.filter(r => r.subjectName === 'Mathematics');
      expect(mathRegisters).toHaveLength(12); // All 12 cycles across 3 years

      // Check specific scores for Aarav Singhania (STU-10A-01)
      const ut1_2025 = mathRegisters.find(r => r.assessmentId === 'assess-ut1-2025');
      const ut2_2025 = mathRegisters.find(r => r.assessmentId === 'assess-ut2-2025');
      const hy_2025 = mathRegisters.find(r => r.assessmentId === 'assess-hy-2025');
      const ann_2026 = mathRegisters.find(r => r.assessmentId === 'assess-annual-2026');

      expect(ut1_2025?.entries.find(e => e.studentId === 'STU-10A-01')?.marksObtained).toBe(22); // 22/25 (88%)
      expect(ut2_2025?.entries.find(e => e.studentId === 'STU-10A-01')?.marksObtained).toBe(15); // 15/25 (60%)
      expect(hy_2025?.entries.find(e => e.studentId === 'STU-10A-01')?.marksObtained).toBe(63);  // 63/80 (78.8%)
      expect(ann_2026?.entries.find(e => e.studentId === 'STU-10A-01')?.marksObtained).toBe(71); // 71/80 (88.8%)

      // Check Class 9 marks (2024–25)
      const ut1_2024 = mathRegisters.find(r => r.assessmentId === 'assess-ut1-2024');
      const hy_2024 = mathRegisters.find(r => r.assessmentId === 'assess-hy-2024');
      expect(ut1_2024?.entries.find(e => e.studentId === 'STU-10A-01')?.marksObtained).toBe(20);
      expect(hy_2024?.entries.find(e => e.studentId === 'STU-10A-01')?.marksObtained).toBe(62);

      // Check Class 8 marks (2023–24)
      const ut1_2023 = mathRegisters.find(r => r.assessmentId === 'assess-ut1-2023');
      const hy_2023 = mathRegisters.find(r => r.assessmentId === 'assess-hy-2023');
      expect(ut1_2023?.entries.find(e => e.studentId === 'STU-10A-01')?.marksObtained).toBe(19);
      expect(hy_2023?.entries.find(e => e.studentId === 'STU-10A-01')?.marksObtained).toBe(60);
    });

    it('verifies topper baseline consistency for Ananya Sharma (STU-10A-02)', async () => {
      const studentMarks = await demoRepository.getStudentMarksRegisters('STU-10A-02');
      const mathRegisters = studentMarks.filter(r => r.subjectName === 'Mathematics');
      expect(mathRegisters).toHaveLength(12);

      mathRegisters.forEach(reg => {
        const entry = reg.entries.find(e => e.studentId === 'STU-10A-02');
        expect(entry).toBeDefined();
        expect(entry!.marksObtained).not.toBeNull();
        const pct = (entry!.marksObtained! / reg.maxMarks) * 100;
        expect(pct).toBeGreaterThanOrEqual(90);
      });
    });
  });

  describe('Scenario E: Reasoning Interval Attendance & Non-Causal Explanation', () => {
    it('records exactly 3 absences for Aarav Singhania between UT1 and Half-Yearly (2025–26)', async () => {
      const sessions = await demoRepository.getAttendanceSessionsInRange('2025-07-24', '2025-11-20', ['class-10-a']);
      expect(sessions.length).toBeGreaterThan(60);

      let absentCount = 0;
      let excusedCount = 0;
      const absentDates: string[] = [];

      sessions.forEach(session => {
        const rec = session.records.find(r => r.studentId === 'STU-10A-01');
        if (rec) {
          if (rec.state === 'absent') {
            absentCount++;
            absentDates.push(session.date);
          } else if (rec.state === 'excused') {
            excusedCount++;
          }
        }
      });

      expect(absentCount).toBe(3);
      expect(absentDates).toContain('2025-09-02');
      expect(absentDates).toContain('2025-09-03');
      expect(absentDates).toContain('2025-10-14');
      expect(excusedCount).toBe(1); // 2025-08-19 CBSE Science exhibition duty
    });

    it('records 0 absences for Ananya Sharma in the same interval', async () => {
      const sessions = await demoRepository.getAttendanceSessionsInRange('2025-07-24', '2025-11-20', ['class-10-a']);
      expect(sessions.length).toBeGreaterThan(60);

      let absentCount = 0;
      sessions.forEach(session => {
        const rec = session.records.find(r => r.studentId === 'STU-10A-02');
        if (rec?.state === 'absent') absentCount++;
      });

      expect(absentCount).toBe(0);
    });

    it('builds non-causal explanation with recorded absences and ZERO incomplete data warnings', async () => {
      // Simulate Aarav Singhania: UT1 (22/25 = 88.0%) vs Half-Yearly (63/80 = 78.8%)
      const earlier = { title: 'Unit Test 1', score: 22, maxMarks: 25 };
      const later = { title: 'Half-Yearly Examination', score: 63, maxMarks: 80 };

      // Query sessions and incidents in the interval
      const sessions = await demoRepository.getAttendanceSessionsInRange('2025-07-24', '2025-11-20', ['class-10-a']);
      const absences = sessions.reduce((sum, s) => {
        const r = s.records.find(item => item.studentId === 'STU-10A-01');
        return sum + (r?.state === 'absent' ? 1 : 0);
      }, 0);

      const incidents = await demoRepository.getIncidents({ studentId: 'STU-10A-01', classId: 'class-10-a' });
      const notes = incidents
        .filter(n => n.date > '2025-07-24' && n.date <= '2025-11-20')
        .map(n => `${n.date}: ${n.title} — ${n.description}`);

      const explanation = buildChangeExplanation({
        earlier,
        later,
        absences,
        notes,
        missing: [],
      });

      // 1. Mandatory non-causal statement
      expect(explanation[0]).toBe('Possible contributing factors — these records show a change over time but do not establish its cause.');

      // 2. Score comparison
      expect(explanation[1]).toContain('Unit Test 1: 22/25 (88.0%)');
      expect(explanation[1]).toContain('Half-Yearly Examination: 63/80 (78.8%)');
      expect(explanation[1]).toContain('-9.2 percentage points');

      // 3. Evidence of recorded absences
      expect(explanation[2]).toBe('3 absences were recorded between the assessment periods; this is relevant information to discuss.');

      // 4. Chronological teacher notes
      expect(explanation.some(l => l.includes('Difficulty Observed in Algebraic Equations'))).toBe(true);
      expect(explanation.some(l => l.includes('Unit Test 2 Marks Review & Conference'))).toBe(true);
      expect(explanation.some(l => l.includes('Parent Discussion Regarding September Absences'))).toBe(true);

      // 5. Zero "Incomplete data" warnings
      expect(explanation.some(l => l.includes('Incomplete data'))).toBe(false);
    });

    it('builds non-causal explanation for Ananya Sharma showing 0 absences across complete sessions', () => {
      const earlier = { title: 'Unit Test 1', score: 24, maxMarks: 25 };
      const later = { title: 'Half-Yearly Examination', score: 75, maxMarks: 80 };

      const explanation = buildChangeExplanation({
        earlier,
        later,
        absences: 0,
        notes: ['2025-10-15: 1st Position in State Science Olympiad — Secured gold medal.'],
        missing: [],
      });

      expect(explanation[0]).toBe('Possible contributing factors — these records show a change over time but do not establish its cause.');
      expect(explanation[2]).toBe('0 absences were recorded between the assessment periods; this is relevant information to discuss.');
      expect(explanation.some(l => l.includes('Incomplete data'))).toBe(false);
    });
  });

  describe('Scenario F: Storage Footprint & Quota Safety', () => {
    it('keeps localStorage payload small to safely fit in 5MB quota', () => {
      const raw = localStorage.getItem('hanujai_erp_demo_store_v2');
      expect(raw).toBeDefined();
      if (raw) {
        const sizeBytes = raw.length * 2; // UTF-16 in JS string
        const sizeKB = Math.round(sizeBytes / 1024);
        // Payload must be well below 2.5MB (under 50% of the 5MB browser quota)
        expect(sizeKB).toBeLessThan(2500);
      }
    });

    it('preserves user modifications in localStorage overlay without corrupting baseline', async () => {
      const tutor = (await demoRepository.getStaffMembers()).find(s => s.id === 'staff-003')!;

      // Teacher submits attendance for a test date
      await demoRepository.submitDailyAttendance(
        {
          academicYearId: 'year-2025-2026',
          classId: 'class-10-a',
          date: '2026-10-22',
          records: [
            { studentId: 'STU-10A-01', state: 'present' },
            { studentId: 'STU-10A-02', state: 'absent' },
          ],
        },
        tutor
      );

      // Verify session exists
      const session = await demoRepository.getAttendanceSession('class-10-a', '2026-10-22');
      expect(session).toBeDefined();
      expect(session?.presentCount).toBe(1);
      expect(session?.absentCount).toBe(1);

      // Verify that after reset, it reverts to pristine baseline
      await demoRepository.resetDemoData();
      const sessionAfterReset = await demoRepository.getAttendanceSession('class-10-a', '2026-10-22');
      expect(sessionAfterReset).toBeNull();
    });
  });
});
