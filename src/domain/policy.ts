/**
 * HanuJai High School ERP — Central Institutional Policy & Configuration Layer
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Single source of truth for all configurable school rules, operational defaults,
 * and demonstration policies.
 * 
 * NOTE: Values marked as "DEMO_DEFAULT" are editable demonstration defaults 
 * for pilot evaluation and do not represent confirmed institutional board policy.
 */

import type { AttendancePolicy } from './types';

export const INSTITUTIONAL_CONFIG = {
  // Campus Identity (Configurable Demo Defaults)
  institutionName: 'HanuJai High School',
  institutionShortName: 'HanuJai',
  campusLocation: 'Sector 3, Vidyadhar Nagar, Jaipur, Rajasthan 302039',
  contactEmail: 'admin@hanujai.edu.in',
  contactPhone: '+91 141 2780198',
  foundedYear: 1998,
  
  // Demonstrative Board Affiliation (Configurable Demonstration Values)
  cbseAffiliationNumber: 'CBSE/AFF/1730198',
  cbseSchoolCode: '30198',
  affiliationStatus: 'Provisional Senior Secondary Affiliation (Demonstration Setting)',
  
  // Academic Session (Configurable)
  activeAcademicYearId: 'year-2025-2026',
  activeAcademicYearLabel: '2025–2026',
  
  // Planning Scale: 10 Grades, 2 Sections each = 20 Sections (50 students/section = 1,000 total)
  totalGrades: 10,
  sectionsPerGrade: ['A', 'B'] as const,
  nominalCapacityPerSection: 50,
  
  // Operational Attendance Policy (Configurable Demonstration Values)
  attendance: {
    dailyMarkingWindowStart: '07:45',
    dailyMarkingWindowEnd: '09:15',
    gracePeriodMinutes: 15,
    minimumAttendancePercentage: 75.0, // Statutory CBSE 75% attendance threshold
    dualCustodyCorrectionRequired: true, // Class Teacher requests -> Principal approves
    allowSelfApproval: false, // Rule SEC-201: Requester cannot counter-approve own request
  } satisfies AttendancePolicy & { allowSelfApproval: boolean },

  // Academic Grading Scale (CBSE 9-Point Continuous Evaluation Scale)
  gradingScale: [
    { grade: 'A1', minPercentage: 91, maxPercentage: 100, gradePoint: 10.0, description: 'Outstanding performance' },
    { grade: 'A2', minPercentage: 81, maxPercentage: 90.99, gradePoint: 9.0, description: 'Excellent scholastic achievement' },
    { grade: 'B1', minPercentage: 71, maxPercentage: 80.99, gradePoint: 8.0, description: 'Very Good' },
    { grade: 'B2', minPercentage: 61, maxPercentage: 70.99, gradePoint: 7.0, description: 'Good' },
    { grade: 'C1', minPercentage: 51, maxPercentage: 60.99, gradePoint: 6.0, description: 'Above Average' },
    { grade: 'C2', minPercentage: 41, maxPercentage: 50.99, gradePoint: 5.0, description: 'Average' },
    { grade: 'D',  minPercentage: 33, maxPercentage: 40.99, gradePoint: 4.0, description: 'Pass / Marginal' },
    { grade: 'E1', minPercentage: 21, maxPercentage: 32.99, gradePoint: 0.0, description: 'Essential Repeat / Remedial Required' },
    { grade: 'E2', minPercentage: 0,  maxPercentage: 20.99, gradePoint: 0.0, description: 'Critical Shortfall / Remedial Required' },
  ],

  // Passing Criteria
  passingPercentage: 33.0,

  // Transparent Rule-Based Care Indicators (Explainable Quantitative Risk Triggers)
  riskRules: {
    'ATT-01': {
      code: 'ATT-01',
      title: '3 Consecutive Absences',
      threshold: 3,
      description: 'Triggered when a student is absent on 3 consecutive operational school days without parental leave note.',
      recommendedAction: 'Immediate telephonic outreach to primary guardian by Class Tutor.',
    },
    'ATT-03': {
      code: 'ATT-03',
      title: 'Attendance Shortfall Below 75%',
      threshold: 75.0,
      description: 'Cumulative session attendance below statutory 75.0% minimum threshold.',
      recommendedAction: 'Schedule Parent-Teacher Conference (PTM) & formal shortfall notification.',
    },
    'ACAD-04': {
      code: 'ACAD-04',
      title: 'Academic Score Drop (>20%)',
      threshold: 20.0,
      description: 'Performance decline exceeding 20% across comparable assessment cycles in core subjects.',
      recommendedAction: 'Assign subject remedial tutorial and clinical diagnostics with faculty.',
    },
  },
} as const;

/**
 * Calculates CBSE Grade and Grade Point from obtained and maximum marks.
 */
export function calculateGrade(marksObtained: number | null, maxMarks: number): { grade: string; gradePoint: number; percentage: number | null } {
  if (marksObtained === null || maxMarks <= 0) {
    return { grade: '—', gradePoint: 0, percentage: null };
  }
  const percentage = (marksObtained / maxMarks) * 100;
  for (const item of INSTITUTIONAL_CONFIG.gradingScale) {
    if (percentage >= item.minPercentage) {
      return { grade: item.grade, gradePoint: item.gradePoint, percentage: Math.round(percentage * 10) / 10 };
    }
  }
  return { grade: 'E2', gradePoint: 0, percentage: Math.round(percentage * 10) / 10 };
}

/**
 * Validates whether current time falls within the configured morning roll-call window.
 */
export function isAttendanceWindowActive(
  now: Date = new Date(),
  policy: AttendancePolicy = INSTITUTIONAL_CONFIG.attendance
): { isOpen: boolean; start: string; end: string } {
  const currentHours = now.getHours().toString().padStart(2, '0');
  const currentMins = now.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMins}`;
  
  const isOpen = currentTimeStr >= policy.dailyMarkingWindowStart && currentTimeStr <= policy.dailyMarkingWindowEnd;
  return {
    isOpen,
    start: policy.dailyMarkingWindowStart,
    end: policy.dailyMarkingWindowEnd,
  };
}

/**
 * Checks whether a specific HH:MM time string is inside the morning roll-call window.
 */
export function isMorningRollCallWindowOpen(
  timeStr: string,
  policy: AttendancePolicy = INSTITUTIONAL_CONFIG.attendance
): boolean {
  return timeStr >= policy.dailyMarkingWindowStart && timeStr <= policy.dailyMarkingWindowEnd;
}

/**
 * Returns current school-local date (YYYY-MM-DD) in Asia/Kolkata timezone.
 */
export function getSchoolLocalDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Returns formatted school-local display date (e.g. 21 October 2026).
 */
export function formatSchoolDisplayDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return dateStr;
  }
}

