import type { AttendanceState } from './types';

export interface ComparableMark {
  score: number | null;
  maxMarks: number;
  isAbsent?: boolean;
}

export function normalizeMark(score: number | null, maxMarks: number): number | null {
  if (score === null || !Number.isFinite(score) || !Number.isFinite(maxMarks) || maxMarks <= 0) return null;
  return (score / maxMarks) * 100;
}

export function classMarkBenchmarks(marks: ComparableMark[]): { mean: number | null; highest: number | null; count: number } {
  const normalized = marks
    .filter(mark => !mark.isAbsent)
    .map(mark => normalizeMark(mark.score, mark.maxMarks))
    .filter((value): value is number => value !== null);
  if (normalized.length === 0) return { mean: null, highest: null, count: 0 };
  return {
    mean: normalized.reduce((sum, value) => sum + value, 0) / normalized.length,
    highest: Math.max(...normalized),
    count: normalized.length,
  };
}

export function filterRecordsByDateRange<T extends { date: string }>(records: T[], start: string, end: string): T[] {
  if (!start || !end || start > end) return [];
  return records.filter(record => record.date >= start && record.date <= end);
}

export function isCountedAsAbsent(state: AttendanceState | 'unmarked' | 'holiday' | 'day_off'): boolean {
  return state === 'absent';
}

export function isFinalizedResult(status: string): boolean {
  return status === 'finalized' || status === 'verified_locked';
}

export interface ChangeEvidence {
  earlier: { title: string; score: number | null; maxMarks: number };
  later: { title: string; score: number | null; maxMarks: number };
  absences?: number;
  notes?: string[];
  missing?: string[];
}

export function buildChangeExplanation(evidence: ChangeEvidence): string[] {
  const earlierPct = normalizeMark(evidence.earlier.score, evidence.earlier.maxMarks);
  const laterPct = normalizeMark(evidence.later.score, evidence.later.maxMarks);
  const lines = ['Possible contributing factors — these records show a change over time but do not establish its cause.'];
  if (earlierPct === null || laterPct === null) {
    lines.push('There is not enough recorded marks information to compare both assessments.');
  } else {
    const change = Math.round((laterPct - earlierPct) * 10) / 10;
    lines.push(`${evidence.earlier.title}: ${evidence.earlier.score}/${evidence.earlier.maxMarks} (${earlierPct.toFixed(1)}%); ${evidence.later.title}: ${evidence.later.score}/${evidence.later.maxMarks} (${laterPct.toFixed(1)}%); change: ${change > 0 ? '+' : ''}${change} percentage points.`);
  }
  if (evidence.absences !== undefined) lines.push(`${evidence.absences} absences were recorded between the assessment periods; this is relevant information to discuss.`);
  (evidence.notes || []).forEach(note => lines.push(`Teacher note: ${note}`));
  (evidence.missing || []).forEach(item => lines.push(`Incomplete data: ${item}`));
  return lines;
}
