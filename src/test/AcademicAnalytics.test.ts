import { describe, expect, it } from 'vitest';
import {
  buildChangeExplanation,
  classMarkBenchmarks,
  filterRecordsByDateRange,
  isCountedAsAbsent,
  isFinalizedResult,
  normalizeMark,
} from '../domain/academicAnalytics';

describe('requirements analytics rules', () => {
  it('normalizes scores with different maximum marks', () => {
    expect(normalizeMark(18, 20)).toBe(90);
    expect(normalizeMark(72, 80)).toBe(90);
    expect(normalizeMark(null, 20)).toBeNull();
  });

  it('calculates class mean and highest comparable normalized score, omitting missing and absent marks', () => {
    expect(classMarkBenchmarks([
      { score: 18, maxMarks: 20 },
      { score: 72, maxMarks: 80 },
      { score: null, maxMarks: 80 },
      { score: 80, maxMarks: 80, isAbsent: true },
    ])).toEqual({ mean: 90, highest: 90, count: 2 });
  });

  it('filters records inclusively by date and returns no rows for an invalid range', () => {
    const rows = [{ date: '2026-10-01' }, { date: '2026-10-02' }, { date: '2026-10-03' }];
    expect(filterRecordsByDateRange(rows, '2026-10-02', '2026-10-03')).toEqual(rows.slice(1));
    expect(filterRecordsByDateRange(rows, '2026-10-04', '2026-10-02')).toEqual([]);
  });

  it('never counts unmarked, holiday, leave, or day off as absent', () => {
    expect(isCountedAsAbsent('absent')).toBe(true);
    expect(isCountedAsAbsent('unmarked')).toBe(false);
    expect(isCountedAsAbsent('holiday')).toBe(false);
    expect(isCountedAsAbsent('day_off')).toBe(false);
    expect(isCountedAsAbsent('excused')).toBe(false);
  });

  it('only treats finalized or verified locked registers as final results', () => {
    expect(isFinalizedResult('finalized')).toBe(true);
    expect(isFinalizedResult('verified_locked')).toBe(true);
    expect(isFinalizedResult('draft')).toBe(false);
    expect(isFinalizedResult('submitted')).toBe(false);
  });

  it('uses cautious, evidence-based explanation wording and reports insufficient marks history', () => {
    const explanation = buildChangeExplanation({
      earlier: { title: 'Unit Test 1', score: 22, maxMarks: 25 },
      later: { title: 'Unit Test 2', score: 15, maxMarks: 25 },
      absences: 2,
      notes: ['Teacher recorded a missed assignment.'],
    }).join(' ');
    expect(explanation).toContain('Possible contributing factors');
    expect(explanation).toContain('2 absences were recorded');
    expect(explanation).not.toMatch(/caused|because|due to/i);

    const insufficient = buildChangeExplanation({
      earlier: { title: 'Unit Test 1', score: null, maxMarks: 25 },
      later: { title: 'Unit Test 2', score: 15, maxMarks: 25 },
    }).join(' ');
    expect(insufficient).toContain('not enough recorded marks information');
  });
});
