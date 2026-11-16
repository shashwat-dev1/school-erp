/**
 * HanuJai High School ERP — Central Attendance WhatsApp Notification Templates
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Principal-approved, authoritative bilingual attendance notification templates
 * for HanuJai High School.
 * 
 * Order of composition:
 * 1. English message
 * 2. English sign-off
 * 3. Clear paragraph separation
 * 4. Hindi message
 * 5. Hindi sign-off
 */

export const SCHOOL_NAME_EN = 'HanuJai High School';
export const SCHOOL_NAME_HI = 'हनुजय हाई स्कूल';

export const SIGN_OFF_ENGLISH = `Regards,\nHanuJai High School\nSchool Administration`;

export const SIGN_OFF_HINDI = `सादर,\nहनुजय हाई स्कूल\nविद्यालय प्रशासन`;

/**
 * Validates dynamic placeholder parameters to ensure no undefined, null, or empty values.
 */
function validateParameters(studentName: string, date: string): { cleanName: string; cleanDate: string } {
  if (!studentName || typeof studentName !== 'string' || !studentName.trim()) {
    throw new Error('Student name is required and cannot be empty.');
  }
  const cleanName = studentName.trim();
  if (cleanName.toLowerCase() === 'undefined' || cleanName.toLowerCase() === 'null') {
    throw new Error('Student name cannot be "undefined" or "null".');
  }

  if (!date || typeof date !== 'string' || !date.trim()) {
    throw new Error('Attendance date is required and cannot be empty.');
  }
  const cleanDate = date.trim();
  if (cleanDate.toLowerCase() === 'undefined' || cleanDate.toLowerCase() === 'null') {
    throw new Error('Attendance date cannot be "undefined" or "null".');
  }

  return { cleanName, cleanDate };
}

/**
 * Generates the English section of the PRESENT attendance notification.
 */
export function generatePresentEnglishMessage(studentName: string, date: string): string {
  const { cleanName, cleanDate } = validateParameters(studentName, date);
  return `Dear Parent\n\nAttendance for your ward Master ${cleanName} has been marked PRESENT at HanuJai High School on ${cleanDate}.\n\n${SIGN_OFF_ENGLISH}`;
}

/**
 * Generates the Hindi section of the PRESENT attendance notification.
 */
export function generatePresentHindiMessage(studentName: string, date: string): string {
  const { cleanName, cleanDate } = validateParameters(studentName, date);
  return `आदरणीय अभिभावक\n\nआपको सूचित किया जाता है की ${cleanName} कि दिनांक ${cleanDate} को हनुजय हाई स्कूल में उपस्थिति (PRESENT) दर्ज कि गई है।\n\n${SIGN_OFF_HINDI}`;
}

/**
 * Generates the complete bilingual PRESENT attendance notification.
 * Combines English and Hindi sections separated by a clear paragraph break.
 */
export function generatePresentAttendanceMessage(studentName: string, date: string): string {
  const english = generatePresentEnglishMessage(studentName, date);
  const hindi = generatePresentHindiMessage(studentName, date);
  return `${english}\n\n${hindi}`;
}

/**
 * Generates the English section of the ABSENT attendance notification.
 */
export function generateAbsentEnglishMessage(studentName: string, date: string): string {
  const { cleanName, cleanDate } = validateParameters(studentName, date);
  return `Dear Parent\n\nAttendance for your ward Master ${cleanName} has been marked ABSENT at HanuJai High School on ${cleanDate}. Please share the leave application/ medical certificate.\n\n${SIGN_OFF_ENGLISH}`;
}

/**
 * Generates the Hindi section of the ABSENT attendance notification.
 */
export function generateAbsentHindiMessage(studentName: string, date: string): string {
  const { cleanName, cleanDate } = validateParameters(studentName, date);
  return `आदरणीय अभिभावक\n\nआपको सूचित किया जाता है की ${cleanName} कि दिनांक ${cleanDate} को हनुजय हाई स्कूल में अनुपस्थिति (ABSENT) दर्ज कि गई है। लीव एप्लिकेशन/ मेडिकल सर्टिफिकेट जमा करें।\n\n${SIGN_OFF_HINDI}`;
}

/**
 * Generates the complete bilingual ABSENT attendance notification.
 * Combines English and Hindi sections separated by a clear paragraph break.
 */
export function generateAbsentAttendanceMessage(studentName: string, date: string): string {
  const english = generateAbsentEnglishMessage(studentName, date);
  const hindi = generateAbsentHindiMessage(studentName, date);
  return `${english}\n\n${hindi}`;
}

/**
 * Unified dispatch function: validates attendance status ('present' | 'absent')
 * and generates the correct bilingual notification message.
 */
export function generateAttendanceNotificationMessage(params: {
  studentName: string;
  date: string;
  status: 'present' | 'absent' | string;
}): {
  messageText: string;
  templateType: 'present' | 'absent';
} {
  const normalizedStatus = (params.status || '').toLowerCase().trim();

  if (normalizedStatus === 'present') {
    return {
      messageText: generatePresentAttendanceMessage(params.studentName, params.date),
      templateType: 'present',
    };
  }

  if (normalizedStatus === 'absent') {
    return {
      messageText: generateAbsentAttendanceMessage(params.studentName, params.date),
      templateType: 'absent',
    };
  }

  throw new Error(`Invalid attendance status: "${params.status}". Status must be either 'present' or 'absent'.`);
}

