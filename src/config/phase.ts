/**
 * HanuJai High School ERP — Phase 1 Configuration & Feature Scoping
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Strict Phase 1 Focus:
 * 1. Maintain a small, clearly identified set of demo student records (~20 students).
 * 2. Allow Class Teachers to mark each student Present or Absent through a mobile-friendly screen.
 * 3. Send a WhatsApp attendance notification to parent/guardian for every Present or Absent record.
 * 
 * Non-destructive: Phase 2+ features remain intact in code but are hidden from the active Phase 1 UI.
 */

export interface PhaseConfig {
  currentPhase: number;
  phase1Only: boolean;
  features: {
    studentsDirectory: boolean;
    dailyAttendance: boolean;
    allowLateStatus: boolean;
    whatsappNotifications: boolean;
    academicPerformance: boolean;
    marksEntry: boolean;
    academicComparison: boolean;
    advancedReports: boolean;
    threeYearProgression: boolean;
    pastoralNotes: boolean;
  };
  demoCohort: {
    targetClassId: string;
    targetClassLabel: string;
    limit: number;
  };
  whatsapp: {
    provider: 'dry_run' | 'baileys' | 'cloud_api';
    sendEnabled: boolean;
    testRecipientAllowlist: string[];
    templates: {
      present: (studentName: string, dateStr: string) => string;
      absent: (studentName: string, dateStr: string) => string;
    };
  };
}

export const PHASE_CONFIG: PhaseConfig = {
  currentPhase: 1,
  phase1Only: true,
  features: {
    studentsDirectory: true,
    dailyAttendance: true,
    allowLateStatus: false,
    whatsappNotifications: true,
    // Phase 2+ modules (code & data preserved, hidden from active Phase 1 interface)
    academicPerformance: false,
    marksEntry: false,
    academicComparison: false,
    advancedReports: false,
    threeYearProgression: false,
    pastoralNotes: false,
  },
  demoCohort: {
    targetClassId: 'class-10-a',
    targetClassLabel: 'Class 10-A',
    limit: 20, // Focus cohort for Phase 1 daily roll call
  },
  whatsapp: {
    provider: ((import.meta.env.VITE_WHATSAPP_PROVIDER as string) || 'dry_run') as 'dry_run' | 'baileys' | 'cloud_api',
    sendEnabled: import.meta.env.VITE_WHATSAPP_SEND_ENABLED === 'true',
    testRecipientAllowlist: (import.meta.env.VITE_WHATSAPP_TEST_ALLOWLIST || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean),
    templates: {
      present: (studentName: string, dateStr: string) =>
        `Dear Parent/Guardian, ${studentName} has been marked PRESENT at HanuJai High School on ${dateStr}. If you believe this attendance record is incorrect, please contact the school.`,
      absent: (studentName: string, dateStr: string) =>
        `Dear Parent/Guardian, ${studentName} has been marked ABSENT at HanuJai High School on ${dateStr}. If this is unexpected, please contact the school.`,
    },
  },
};
