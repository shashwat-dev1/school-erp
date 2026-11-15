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
      present: (studentName: string, dateStr: string, parentName?: string) => string;
      absent: (studentName: string, dateStr: string, parentName?: string) => string;
      correction: (
        studentName: string,
        classAndSection: string,
        dateStr: string,
        previousState: 'present' | 'absent',
        correctedState: 'present' | 'absent',
        parentName?: string
      ) => string;
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
    provider: ((import.meta.env.VITE_WHATSAPP_PROVIDER as string) || 'baileys') as 'dry_run' | 'baileys' | 'cloud_api',
    sendEnabled: import.meta.env.VITE_WHATSAPP_SEND_ENABLED !== 'false',
    testRecipientAllowlist: (import.meta.env.VITE_WHATSAPP_TEST_ALLOWLIST || '9009519718,8952031365,8947903712,9460221177')
      .split(',')
      .map((s: string) => s.trim().replace(/\D/g, ''))
      .filter(Boolean),
    templates: {
      present: (studentName: string, dateStr: string, parentName?: string) => {
        const trimmed = parentName?.trim();
        const hasParent = trimmed && trimmed !== 'Parent/Guardian' && trimmed !== '[Parent Name]';
        const salutationEn = hasParent ? `Mr./Mrs. ${trimmed}` : 'Dear Parent';
        const salutationHi = hasParent ? `श्री/श्रीमती ${trimmed}` : 'अभिभावक महोदय';
        return `${salutationEn},\n\nThis is to inform you that ${studentName} has been marked PRESENT at HanuJai High School on ${dateStr}.\n\nIf you believe this record is incorrect, please contact the school.\n\nRegards,\nHanuJai High School\n\n---\n\n${salutationHi},\n\nआपको सूचित किया जाता है कि आपकी संतान ${studentName} को दिनांक ${dateStr} को हनुजाई हाई स्कूल में उपस्थित (PRESENT) दर्ज किया गया है।\n\nयदि आपको लगता है कि उपस्थिति का यह रिकॉर्ड गलत है, तो कृपया विद्यालय से संपर्क करें।\n\nसादर,\nहनुजाई हाई स्कूल`;
      },
      absent: (studentName: string, dateStr: string, parentName?: string) => {
        const trimmed = parentName?.trim();
        const hasParent = trimmed && trimmed !== 'Parent/Guardian' && trimmed !== '[Parent Name]';
        const salutationEn = hasParent ? `Mr./Mrs. ${trimmed}` : 'Dear Parent';
        const salutationHi = hasParent ? `श्री/श्रीमती ${trimmed}` : 'अभिभावक महोदय';
        return `${salutationEn},\n\nThis is to inform you that ${studentName} has been marked ABSENT at HanuJai High School on ${dateStr}.\n\nIf you believe this record is incorrect, please contact the school.\n\nRegards,\nHanuJai High School\n\n---\n\n${salutationHi},\n\nआपको सूचित किया जाता है कि आपकी संतान ${studentName} को दिनांक ${dateStr} को हनुजाई हाई स्कूल में अनुपस्थित (ABSENT) दर्ज किया गया है।\n\nयदि आपको लगता है कि उपस्थिति का यह रिकॉर्ड गलत है, तो कृपया विद्यालय से संपर्क करें।\n\nसादर,\nहनुजाई हाई स्कूल`;
      },
      correction: (
        studentName: string,
        classAndSection: string,
        dateStr: string,
        previousState: 'present' | 'absent',
        correctedState: 'present' | 'absent',
        parentName?: string
      ) => {
        const trimmed = parentName?.trim();
        const hasParent = trimmed && trimmed !== 'Parent/Guardian' && trimmed !== '[Parent Name]';
        const salutationEn = hasParent ? `Dear Mr./Mrs. ${trimmed}` : 'Dear Parent/Guardian';
        const salutationHi = hasParent ? `आदरणीय अभिभावक श्री/श्रीमती ${trimmed}` : 'आदरणीय अभिभावक';

        const prevEn = previousState === 'present' ? 'Present' : 'Absent';
        const corrEn = correctedState === 'present' ? 'Present' : 'Absent';
        const prevHi = previousState === 'present' ? 'उपस्थित (Present)' : 'अनुपस्थित (Absent)';
        const corrHi = correctedState === 'present' ? 'उपस्थित (Present)' : 'अनुपस्थित (Absent)';

        return `${salutationEn},\n\nThis is to inform you that your child's attendance record for ${dateStr} has been corrected after verification by the school.\n\nStudent Name: ${studentName}\nClass: ${classAndSection}\n\nPrevious Attendance: ${prevEn}\nCorrected Attendance: ${corrEn}\n\nThe earlier entry was recorded incorrectly and has now been reviewed and corrected with the school's approval.\n\nThe updated attendance has been saved in the school records.\n\nRegards,\nHanuJai High School\n\n---\n\n${salutationHi},\n\nआपको सूचित किया जाता है कि विद्यालय द्वारा सत्यापन के उपरांत दिनांक ${dateStr} के लिए आपके बच्चे का उपस्थिति रिकॉर्ड संशोधित कर दिया गया है।\n\nविद्यार्थी का नाम: ${studentName}\nकक्षा: ${classAndSection}\n\nपूर्व दर्ज उपस्थिति: ${prevHi}\nसंशोधित उपस्थिति: ${corrHi}\n\nपूर्व में दर्ज प्रविष्टि त्रुटिवश हो गई थी, जिसे अब विद्यालय के अनुमोदन से जांचकर सही कर दिया गया है।\n\nअद्यतन उपस्थिति विद्यालय अभिलेखों में दर्ज कर दी गई है।\n\nसादर,\nहनुजाई हाई स्कूल, जयपुर`;
      },
    },
  },
};
