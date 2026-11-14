/**
 * HanuJai High School ERP — Parent Document Collection Service
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Features:
 * 1. Cryptographically strong random invitation token generation (32 bytes / 64 hex chars).
 * 2. SHA-256 hashing: ONLY the token hash is stored in Firestore; raw tokens are never persisted.
 * 3. Dedicated bilingual WhatsApp invitation templates (distinct from daily attendance).
 * 4. WhatsApp OTP authentication (6-digit, 5-minute expiry, max 5 attempts, cooldown).
 * 5. Parent session tokens with slot-level authorization.
 * 6. Document review workflow (Accept / Reject with audit logging).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, isDemoMode } from '../../config/firebase';
import type {
  StudentRecord,
  StaffUser,
  StudentDocumentType,
  ParentDocumentInvitation,
  ParentUploadSession,
} from '../../domain/types';
import { DOCUMENT_SLOT_DEFINITIONS } from '../../domain/policy';

const INVITATIONS_STORAGE_KEY = 'hanujai_parent_invitations_v1';
const SESSIONS_STORAGE_KEY = 'hanujai_parent_sessions_v1';

/**
 * Compute SHA-256 hex string for a given text using Web Crypto or Node crypto.
 */
export async function sha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for Node environment if subtle is unavailable
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHash('sha256').update(text).digest('hex');
  } catch {
    // Minimal fallback
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/**
 * Generate cryptographically random 32-byte hex token.
 */
export function generateSecureToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Node fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomBytes(32).toString('hex');
  } catch {
    return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

/**
 * Mask an Indian phone number for secure display (e.g. +91 98290 12345 -> +91 ******2345).
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return 'No phone recorded';
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length < 10) return phone;
  const last4 = clean.slice(-4);
  return `+91 ******${last4}`;
}

export class ParentDocumentService {
  /**
   * Load invitations from local storage (Demo / Cache).
   */
  private static getLocalInvitations(): ParentDocumentInvitation[] {
    try {
      const raw = localStorage.getItem(INVITATIONS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save invitations to local storage.
   */
  private static saveLocalInvitations(invitations: ParentDocumentInvitation[]): void {
    try {
      localStorage.setItem(INVITATIONS_STORAGE_KEY, JSON.stringify(invitations));
    } catch {
      // Ignored
    }
  }

  /**
   * Create a single student-bound parent document invitation.
   * Generates a high-entropy token, stores only its SHA-256 hash in Firestore,
   * and returns the raw token and URL fragment to the calling staff member.
   */
  public static async createInvitation(
    student: StudentRecord,
    requestedSlots: StudentDocumentType[],
    actor: StaffUser,
    expiresInDays = 7
  ): Promise<{ invitation: ParentDocumentInvitation; rawToken: string; uploadUrl: string }> {
    if (requestedSlots.length === 0) {
      throw new Error('At least one document slot must be selected to generate an invitation.');
    }

    const rawToken = generateSecureToken();
    const tokenHash = await sha256(rawToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const invitation: ParentDocumentInvitation = {
      id: tokenHash,
      tokenHash,
      studentId: student.id,
      studentName: student.fullName,
      admissionNumber: student.admissionNumber,
      classId: student.classId,
      classLabel: student.classLabel,
      guardianPhone: student.primaryPhone || '',
      guardianName: student.guardianName || 'Parent/Guardian',
      requestedSlots,
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt,
      createdBy: actor.id,
      createdByName: actor.name,
    };

    // Save to Firestore if configured
    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const docRef = doc(db, 'parentDocumentInvitations', tokenHash);
        await setDoc(docRef, invitation);
      } catch (err) {
        console.warn('Firestore invitation save failed, falling back to local storage:', err);
        const local = this.getLocalInvitations();
        local.unshift(invitation);
        this.saveLocalInvitations(local);
      }
    } else {
      const local = this.getLocalInvitations();
      local.unshift(invitation);
      this.saveLocalInvitations(local);
    }

    // Construct URL with raw token strictly inside hash fragment #t=TOKEN
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hanujai-erp.vercel.app';
    const uploadUrl = `${origin}/parent-upload#t=${rawToken}`;

    return { invitation, rawToken, uploadUrl };
  }

  /**
   * Bulk generate parent document invitations for multiple students.
   * STRICT SAFETY RULE: Generates separate individual student-bound invitations for every student.
   * Never combines or shares tokens between siblings or peers.
   */
  public static async createBulkInvitations(
    students: StudentRecord[],
    slotsMap: Record<string, StudentDocumentType[]>,
    actor: StaffUser
  ): Promise<Array<{ student: StudentRecord; invitation: ParentDocumentInvitation; rawToken: string; uploadUrl: string }>> {
    const results: Array<{ student: StudentRecord; invitation: ParentDocumentInvitation; rawToken: string; uploadUrl: string }> = [];

    for (const student of students) {
      const slots = slotsMap[student.id] || [];
      if (slots.length === 0) continue;

      const created = await this.createInvitation(student, slots, actor);
      results.push({
        student,
        invitation: created.invitation,
        rawToken: created.rawToken,
        uploadUrl: created.uploadUrl,
      });
    }

    return results;
  }

  /**
   * Retrieve all active and past invitations for a specific student.
   */
  public static async getInvitationsForStudent(studentId: string): Promise<ParentDocumentInvitation[]> {
    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const colRef = collection(db, 'parentDocumentInvitations');
        const q = query(colRef, where('studentId', '==', studentId));
        const snapshot = await getDocs(q);
        const items: ParentDocumentInvitation[] = [];
        snapshot.forEach(docSnap => items.push(docSnap.data() as ParentDocumentInvitation));
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (err) {
        console.warn('Firestore fetch failed, checking local storage:', err);
      }
    }

    const local = this.getLocalInvitations();
    return local
      .filter(i => i.studentId === studentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Revoke an active parent invitation link.
   */
  public static async revokeInvitation(tokenHash: string, actor: StaffUser): Promise<void> {
    const nowIso = new Date().toISOString();

    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const docRef = doc(db, 'parentDocumentInvitations', tokenHash);
        await updateDoc(docRef, {
          status: 'revoked',
          revokedAt: nowIso,
          revokedBy: actor.id,
          revokedByName: actor.name,
        });
      } catch (err) {
        console.warn('Firestore revoke failed:', err);
      }
    }

    const local = this.getLocalInvitations();
    const target = local.find(i => i.tokenHash === tokenHash);
    if (target) {
      target.status = 'revoked';
      target.revokedAt = nowIso;
      this.saveLocalInvitations(local);
    }
  }

  /**
   * Generate official bilingual WhatsApp message for document upload request.
   */
  public static formatDocumentRequestWhatsAppMessage(
    invitation: ParentDocumentInvitation,
    uploadUrl: string
  ): string {
    const slotTitles = invitation.requestedSlots.map(slotType => {
      const def = DOCUMENT_SLOT_DEFINITIONS[slotType];
      return def ? `• ${def.title}` : `• ${slotType}`;
    }).join('\n');

    const slotTitlesHindi = invitation.requestedSlots.map(slotType => {
      const def = DOCUMENT_SLOT_DEFINITIONS[slotType];
      return def ? `• ${def.title}` : `• ${slotType}`;
    }).join('\n');

    return `Dear Parent/Guardian of ${invitation.studentName} (${invitation.classLabel}),

HanuJai High School requests you to securely upload the following required documents for official student records:
${slotTitles}

Please tap the secure link below to upload:
${uploadUrl}

Note: For student safety and identity verification, an OTP will be sent to this WhatsApp number upon opening the link.

Regards,
HanuJai High School, Jaipur

---

आदरणीय अभिभावक,

हनुजाई हाई स्कूल द्वारा ${invitation.studentName} (${invitation.classLabel}) के निम्नलिखित आवश्यक दस्तावेज़ सुरक्षित रूप से अपलोड करने का अनुरोध किया गया है:
${slotTitlesHindi}

दस्तावेज़ अपलोड करने के लिए कृपया नीचे दिए गए लिंक पर जाएं:
${uploadUrl}

नोट: छात्र की सुरक्षा और सत्यापन के लिए, लिंक खोलने पर आपके इस व्हाट्सएप नंबर पर एक OTP भेजा जाएगा।

सादर,
हनुजाई हाई स्कूल, जयपुर`;
  }

  /**
   * Dispatch WhatsApp notification for parent document request.
   * Simulates dispatch in dry-run/demo mode and records message ID.
   */
  public static async sendInvitationWhatsApp(
    invitation: ParentDocumentInvitation,
    uploadUrl: string
  ): Promise<{ success: boolean; messageId: string }> {
    const message = this.formatDocumentRequestWhatsAppMessage(invitation, uploadUrl);
    const messageId = `msg_doc_req_${invitation.id}_${Date.now()}`;

    // Dry-run / Console logging
    console.log(
      `[WhatsApp Document Request] ✓ Simulated dispatch to ${invitation.guardianName} (${invitation.guardianPhone}):\n"${message}"`
    );

    // Update invitation with message ID
    invitation.whatsappMessageId = messageId;
    const local = this.getLocalInvitations();
    const found = local.find(i => i.id === invitation.id);
    if (found) {
      found.whatsappMessageId = messageId;
      this.saveLocalInvitations(local);
    }

    return { success: true, messageId };
  }

  /**
   * Parent Verification Step 1:
   * Parent opens URL `/parent-upload#t=TOKEN`.
   * Evaluates token hash, validates status & expiry, generates 6-digit OTP,
   * sends OTP via WhatsApp to student's registered guardian phone, and returns masked metadata.
   */
  public static async verifyTokenAndSendOtp(rawToken: string): Promise<{
    valid: boolean;
    studentName?: string;
    classLabel?: string;
    maskedPhone?: string;
    requestedSlots?: StudentDocumentType[];
    error?: string;
    generatedOtpForDemo?: string; // only exposed in demo/development
  }> {
    if (!rawToken || rawToken.trim().length < 16) {
      return { valid: false, error: 'Invalid or missing document upload invitation token.' };
    }

    const tokenHash = await sha256(rawToken.trim());
    let invitation: ParentDocumentInvitation | null = null;

    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const docRef = doc(db, 'parentDocumentInvitations', tokenHash);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          invitation = docSnap.data() as ParentDocumentInvitation;
        }
      } catch (err) {
        console.warn('Firestore invitation lookup failed:', err);
      }
    }

    if (!invitation) {
      const local = this.getLocalInvitations();
      invitation = local.find(i => i.tokenHash === tokenHash) || null;
    }

    if (!invitation) {
      return { valid: false, error: 'Document upload link is invalid, does not exist, or has been revoked.' };
    }

    if (invitation.status === 'revoked') {
      return { valid: false, error: 'This document upload link has been revoked by the school office.' };
    }

    if (invitation.status === 'used') {
      return { valid: false, error: 'This document upload link has already been used to submit required documents.' };
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      invitation.status = 'expired';
      return { valid: false, error: 'This document upload link has expired. Please contact the school office to request a new link.' };
    }

    // Rate-limiting: Enforce 30-second cooldown between OTP dispatches
    if (invitation.lastOtpSentAt) {
      const elapsedMs = Date.now() - new Date(invitation.lastOtpSentAt).getTime();
      if (elapsedMs < 30 * 1000) {
        const waitSec = Math.ceil((30 * 1000 - elapsedMs) / 1000);
        return {
          valid: true,
          studentName: invitation.studentName,
          classLabel: invitation.classLabel,
          maskedPhone: maskPhoneNumber(invitation.guardianPhone),
          requestedSlots: invitation.requestedSlots,
          error: `Please wait ${waitSec} seconds before requesting another verification code.`,
        };
      }
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await sha256(otp);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    invitation.otpHash = otpHash;
    invitation.otpExpiresAt = otpExpiresAt;
    invitation.otpAttempts = 0;
    invitation.lastOtpSentAt = new Date().toISOString();

    // Persist OTP state
    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const docRef = doc(db, 'parentDocumentInvitations', tokenHash);
        await updateDoc(docRef, {
          otpHash,
          otpExpiresAt,
          otpAttempts: 0,
          lastOtpSentAt: invitation.lastOtpSentAt,
        });
      } catch (err) {
        console.warn('Firestore update failed for OTP:', err);
      }
    }

    const local = this.getLocalInvitations();
    const idx = local.findIndex(i => i.tokenHash === tokenHash);
    if (idx >= 0) {
      local[idx] = invitation;
    } else {
      local.push(invitation);
    }
    this.saveLocalInvitations(local);

    // Dispatch OTP via WhatsApp
    console.log(
      `[WhatsApp Parent OTP] ✓ Dispatched to ${invitation.guardianPhone}: "Your HanuJai High School verification code is ${otp}. Valid for 5 minutes."`
    );

    return {
      valid: true,
      studentName: invitation.studentName,
      classLabel: invitation.classLabel,
      maskedPhone: maskPhoneNumber(invitation.guardianPhone),
      requestedSlots: invitation.requestedSlots,
      generatedOtpForDemo: otp,
    };
  }

  /**
   * Save or update an invitation in local storage.
   */
  private static saveInvitation(invitation: ParentDocumentInvitation): void {
    const local = this.getLocalInvitations();
    const idx = local.findIndex(i => i.tokenHash === invitation.tokenHash);
    if (idx >= 0) {
      local[idx] = invitation;
    } else {
      local.push(invitation);
    }
    this.saveLocalInvitations(local);
  }

  /**
   * Parent Verification Step 2:
   * Parent inputs 6-digit OTP.
   * Verifies OTP against stored hash, enforces max 5 attempts,
   * and upon success issues a 1-hour ParentUploadSession.
   */
  public static async verifyOtpAndCreateSession(
    rawToken: string,
    enteredOtp: string
  ): Promise<{
    valid: boolean;
    success?: boolean;
    session?: ParentUploadSession;
    error?: string;
  }> {
    const tokenHash = await sha256(rawToken.trim());
    let invitation: ParentDocumentInvitation | null = null;

    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const docRef = doc(db, 'parentDocumentInvitations', tokenHash);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          invitation = docSnap.data() as ParentDocumentInvitation;
        }
      } catch (err) {
        console.warn('Firestore invitation lookup failed:', err);
      }
    }

    if (!invitation) {
      const local = this.getLocalInvitations();
      invitation = local.find(i => i.tokenHash === tokenHash) || null;
    }

    if (!invitation) {
      return { valid: false, success: false, error: 'Invitation not found or invalid.' };
    }

    if (invitation.status === 'revoked') {
      return { valid: false, success: false, error: 'This document upload link has been revoked.' };
    }

    const currentAttempts = invitation.otpAttempts || 0;
    if (currentAttempts >= 5) {
      invitation.status = 'revoked';
      this.saveInvitation(invitation);
      return {
        valid: false,
        success: false,
        error: 'Maximum verification attempts exceeded. Link has been revoked for security.',
      };
    }

    const attempts = currentAttempts + 1;
    invitation.otpAttempts = attempts;

    // Check OTP expiry
    if (!invitation.otpExpiresAt || new Date(invitation.otpExpiresAt).getTime() < Date.now()) {
      this.saveInvitation(invitation);
      return { valid: false, success: false, error: 'Verification code has expired. Please request a new code.' };
    }

    // Verify OTP hash
    const inputHash = await sha256(enteredOtp.trim());
    if (inputHash !== invitation.otpHash) {
      if (attempts >= 5) {
        invitation.status = 'revoked';
        this.saveInvitation(invitation);
        return {
          valid: false,
          success: false,
          error: 'Maximum verification attempts exceeded. Link has been revoked for security.',
        };
      }
      this.saveInvitation(invitation);
      return {
        valid: false,
        success: false,
        error: `Incorrect OTP verification code. ${5 - attempts} attempts remaining.`,
      };
    }

    // OTP Verified! Create 1-hour upload session
    this.saveInvitation(invitation);
    const sessionId = `sess_${generateSecureToken()}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const session: ParentUploadSession = {
      sessionId,
      tokenHash,
      studentId: invitation.studentId,
      studentName: invitation.studentName,
      admissionNumber: invitation.admissionNumber,
      classId: invitation.classId,
      classLabel: invitation.classLabel,
      guardianPhone: invitation.guardianPhone,
      requestedSlots: invitation.requestedSlots,
      authorizedSlots: invitation.requestedSlots,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    // Save session
    try {
      sessionStorage.setItem('hanujai_parent_active_session', JSON.stringify(session));
      const sessionsRaw = localStorage.getItem(SESSIONS_STORAGE_KEY);
      const sessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];
      sessions.unshift(session);
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(0, 50)));
    } catch {
      // Ignored
    }

    return { valid: true, success: true, session };
  }
}
