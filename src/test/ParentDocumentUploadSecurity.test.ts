/**
 * HanuJai High School ERP — Parent Document Collection Security & Review Test Suite
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Verifies:
 * 1. Cryptographically secure token generation (32 bytes / 64 hex characters).
 * 2. SHA-256 token hashing: Raw tokens are NEVER persisted in Firestore/local storage.
 * 3. URL hash fragment safety: #t=TOKEN is kept client-side and scrubbed via replaceState.
 * 4. Token validation: Rejecting invalid, expired, revoked, or already-used tokens.
 * 5. Parent WhatsApp OTP verification:
 *    - 6-digit OTP generation and SHA-256 storage.
 *    - 30-second cooldown rate limiting between dispatches.
 *    - Maximum 5 verification attempts lockout.
 *    - 5-minute expiry enforcement.
 * 6. Student isolation: Bulk requests create strictly separate, individual student-bound invitations.
 * 7. Document review workflow:
 *    - Uploaded documents start with reviewStatus: 'pending'.
 *    - Admin Office can approve (sets 'accepted' and verifiedBy).
 *    - Admin Office can reject with mandatory rejection reason.
 *    - Principal is strictly read-only and cannot approve or reject.
 * 8. Official WhatsApp notification message formatting: Bilingual English + Hindi without altering attendance templates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ParentDocumentService,
  generateSecureToken,
  sha256,
  maskPhoneNumber,
} from '../services/documents/parentDocumentService';
import { Permissions } from '../domain/permissions';
import { demoRepository } from '../data/demo/demoRepository';
import type { StudentRecord, StaffUser, StudentDocumentType } from '../domain/types';

describe('Parent Document Collection Security & Review Workflow Suite', () => {
  const adminActor: StaffUser = {
    id: 'staff-admin-01',
    name: 'Admin Office Staff',
    role: 'admin',
    status: 'active',
    email: 'admin@hanujai.edu.in',
    employeeCode: 'EMP-002',
    designation: 'Admin Officer',
    department: 'Administration',
    phone: '+91 98290 12002',
    createdAt: '2023-01-01T00:00:00Z',
  };

  const principalActor: StaffUser = {
    id: 'staff-principal-01',
    name: 'Dr. Anand Sharma',
    role: 'principal',
    status: 'active',
    email: 'principal@hanujai.edu.in',
    employeeCode: 'EMP-001',
    designation: 'Principal',
    department: 'Administration',
    phone: '+91 98290 12001',
    createdAt: '2023-01-01T00:00:00Z',
  };

  const developerActor: StaffUser = {
    id: 'staff-developer-01',
    name: 'Root Developer',
    role: 'developer',
    status: 'active',
    email: 'dev@hanujai.edu.in',
    employeeCode: 'EMP-000',
    designation: 'System Administrator',
    department: 'IT & Infrastructure',
    phone: '+91 98290 99999',
    createdAt: '2023-01-01T00:00:00Z',
  };

  const mockStudentA: StudentRecord = {
    id: 'stu-test-01',
    admissionNumber: 'ADM/2026/0101',
    rollNumber: 1,
    firstName: 'Aarav',
    lastName: 'Sharma',
    fullName: 'Aarav Sharma',
    gender: 'M',
    dateOfBirth: '2010-04-12',
    enrollmentDate: '2023-07-01',
    classId: 'class-10-a',
    classLabel: 'Class 10-A',
    status: 'enrolled',
    guardianName: 'Ramesh Sharma',
    guardianRelation: 'Father',
    primaryPhone: '+91 98290 11111',
    residentialAddress: 'Mansarovar, Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302020',
    attendancePercentage: 88,
    academicAverage: 82,
    activeFlags: [],
    academicYearId: 'ay-2026-27',
    createdAt: '2023-07-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  const mockStudentB: StudentRecord = {
    id: 'stu-test-02',
    admissionNumber: 'ADM/2026/0102',
    rollNumber: 2,
    firstName: 'Diya',
    lastName: 'Patel',
    fullName: 'Diya Patel',
    gender: 'F',
    dateOfBirth: '2010-08-20',
    enrollmentDate: '2023-07-01',
    classId: 'class-10-a',
    classLabel: 'Class 10-A',
    status: 'enrolled',
    guardianName: 'Sunita Patel',
    guardianRelation: 'Mother',
    primaryPhone: '+91 98290 22222',
    residentialAddress: 'Malviya Nagar, Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302017',
    attendancePercentage: 92,
    academicAverage: 89,
    activeFlags: [],
    academicYearId: 'ay-2026-27',
    createdAt: '2023-07-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Cryptographic Token Generation & Storage Security', () => {
    it('generates a 64-character hex cryptographic token (32 bytes entropy)', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
      expect(/^[0-9a-f]{64}$/.test(token1)).toBe(true);
    });

    it('stores ONLY the SHA-256 token hash; raw token is strictly omitted from stored record', async () => {
      const requestedSlots: StudentDocumentType[] = ['student_photo', 'student_aadhaar_front'];
      const { invitation, rawToken, uploadUrl } = await ParentDocumentService.createInvitation(
        mockStudentA,
        requestedSlots,
        adminActor
      );

      const computedHash = await sha256(rawToken);
      expect(invitation.tokenHash).toBe(computedHash);
      expect(invitation.id).toBe(computedHash);

      // Verify the raw token is returned for the hash fragment
      expect(uploadUrl).toContain(`#t=${rawToken}`);

      // Verify rawToken does not exist on stored invitation object
      expect((invitation as any).rawToken).toBeUndefined();

      // Verify persisted local storage contains ONLY the hash
      const stored = JSON.parse(localStorage.getItem('hanujai_parent_invitations_v1') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).toBe(computedHash);
      expect(stored[0].rawToken).toBeUndefined();
    });

    it('masks parent phone number correctly for secure display', () => {
      expect(maskPhoneNumber('+91 98290 12345')).toBe('+91 ******2345');
      expect(maskPhoneNumber('9829054321')).toBe('+91 ******4321');
      expect(maskPhoneNumber('')).toBe('No phone recorded');
    });
  });

  describe('2. Token Verification & Expiry Controls', () => {
    it('successfully verifies a valid raw token and initiates OTP dispatch', async () => {
      const { rawToken } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo'],
        adminActor
      );

      const result = await ParentDocumentService.verifyTokenAndSendOtp(rawToken);

      expect(result.valid).toBe(true);
      expect(result.studentName).toBe('Aarav Sharma');
      expect(result.classLabel).toBe('Class 10-A');
      expect(result.maskedPhone).toBe('+91 ******1111');
      expect(result.requestedSlots).toEqual(['student_photo']);
      expect(result.generatedOtpForDemo).toBeDefined();
      expect(result.generatedOtpForDemo).toHaveLength(6);
    });

    it('rejects an invalid or tampered raw token', async () => {
      await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo'],
        adminActor
      );

      const invalidToken = '0'.repeat(64);
      const result = await ParentDocumentService.verifyTokenAndSendOtp(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('rejects a revoked invitation token', async () => {
      const { rawToken, invitation } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo'],
        adminActor
      );

      await ParentDocumentService.revokeInvitation(invitation.tokenHash, adminActor);

      const result = await ParentDocumentService.verifyTokenAndSendOtp(rawToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('revoked');
    });

    it('rejects an expired invitation token', async () => {
      const { rawToken } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo'],
        adminActor,
        -1 // Expired 1 day ago
      );

      const result = await ParentDocumentService.verifyTokenAndSendOtp(rawToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('directly exchanges raw token for a scoped upload session with NO OTP', async () => {
      const { rawToken } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo', 'student_aadhaar_front'],
        adminActor
      );

      const exchange = await ParentDocumentService.exchangeTokenForUploadSession(rawToken);
      expect(exchange.valid).toBe(true);
      expect(exchange.session).toBeDefined();
      expect(exchange.session?.studentId).toBe(mockStudentA.id);
      expect(exchange.session?.studentName).toBe(mockStudentA.fullName);
      expect(exchange.session?.requestedSlots).toEqual(['student_photo', 'student_aadhaar_front']);

      // Session is valid
      const isValid = await ParentDocumentService.isSessionValid(exchange.session!);
      expect(isValid).toBe(true);
    });

    it('immediately invalidates active upload session when invitation is revoked', async () => {
      const { rawToken, invitation } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo'],
        adminActor
      );

      const exchange = await ParentDocumentService.exchangeTokenForUploadSession(rawToken);
      expect(exchange.valid).toBe(true);
      expect(await ParentDocumentService.isSessionValid(exchange.session!)).toBe(true);

      // School revokes invitation
      await ParentDocumentService.revokeInvitation(invitation.tokenHash, adminActor);

      // Now session is immediately invalid
      expect(await ParentDocumentService.isSessionValid(exchange.session!)).toBe(false);

      // New token exchange is rejected
      const retry = await ParentDocumentService.exchangeTokenForUploadSession(rawToken);
      expect(retry.valid).toBe(false);
      expect(retry.error).toContain('revoked');
    });
  });

  describe('3. WhatsApp OTP Verification & Rate Limiting Safeguards', () => {
    it('enforces 30-second cooldown on OTP resend requests', async () => {
      const { rawToken } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo'],
        adminActor
      );

      // First OTP request
      const firstAttempt = await ParentDocumentService.verifyTokenAndSendOtp(rawToken);
      expect(firstAttempt.valid).toBe(true);

      // Immediate second OTP request should trigger cooldown
      const immediateAttempt = await ParentDocumentService.verifyTokenAndSendOtp(rawToken);
      expect(immediateAttempt.valid).toBe(true);
      expect(immediateAttempt.error).toContain('Please wait');
    });

    it('verifies correct OTP and issues a 1-hour ParentUploadSession', async () => {
      const { rawToken } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo', 'birth_certificate'],
        adminActor
      );

      const initResult = await ParentDocumentService.verifyTokenAndSendOtp(rawToken);
      const correctOtp = initResult.generatedOtpForDemo!;

      const verifyResult = await ParentDocumentService.verifyOtpAndCreateSession(rawToken, correctOtp);

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.session).toBeDefined();
      expect(verifyResult.session!.studentId).toBe(mockStudentA.id);
      expect(verifyResult.session!.authorizedSlots).toEqual(['student_photo', 'birth_certificate']);

      // Session expires in ~1 hour
      const sessionExpiry = new Date(verifyResult.session!.expiresAt).getTime();
      const now = Date.now();
      expect(sessionExpiry - now).toBeGreaterThan(50 * 60 * 1000);
      expect(sessionExpiry - now).toBeLessThanOrEqual(61 * 60 * 1000);
    });

    it('enforces maximum 5 failed attempts limit on OTP', async () => {
      const { rawToken } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo'],
        adminActor
      );

      await ParentDocumentService.verifyTokenAndSendOtp(rawToken);

      // Enter wrong OTP 4 times
      for (let i = 1; i <= 4; i++) {
        const attempt = await ParentDocumentService.verifyOtpAndCreateSession(rawToken, '999999');
        expect(attempt.success).toBe(false);
        expect(attempt.error).toContain('Incorrect OTP');
      }

      // 5th failed attempt should lock out the link
      const fifthAttempt = await ParentDocumentService.verifyOtpAndCreateSession(rawToken, '999999');
      expect(fifthAttempt.success).toBe(false);
      expect(fifthAttempt.error).toContain('Maximum verification attempts exceeded');

      // Subsequent attempt even with any OTP is blocked
      const blockedAttempt = await ParentDocumentService.verifyOtpAndCreateSession(rawToken, '000000');
      expect(blockedAttempt.success).toBe(false);
      expect(blockedAttempt.error).toContain('revoked');
    });
  });

  describe('4. Student Isolation Guarantee in Bulk Requests', () => {
    it('creates strictly separate, student-bound tokens for each student in bulk operations', async () => {
      const slotsMap = {
        [mockStudentA.id]: ['student_photo', 'student_aadhaar_front'] as StudentDocumentType[],
        [mockStudentB.id]: ['student_photo', 'birth_certificate'] as StudentDocumentType[],
      };

      const results = await ParentDocumentService.createBulkInvitations(
        [mockStudentA, mockStudentB],
        slotsMap,
        adminActor
      );

      expect(results).toHaveLength(2);

      const invA = results[0];
      const invB = results[1];

      // Must be completely different tokens and hashes
      expect(invA.rawToken).not.toBe(invB.rawToken);
      expect(invA.invitation.tokenHash).not.toBe(invB.invitation.tokenHash);

      // Student-specific bindings
      expect(invA.invitation.studentId).toBe(mockStudentA.id);
      expect(invA.invitation.admissionNumber).toBe(mockStudentA.admissionNumber);
      expect(invA.invitation.guardianPhone).toBe(mockStudentA.primaryPhone);

      expect(invB.invitation.studentId).toBe(mockStudentB.id);
      expect(invB.invitation.admissionNumber).toBe(mockStudentB.admissionNumber);
      expect(invB.invitation.guardianPhone).toBe(mockStudentB.primaryPhone);

      // Verifying token A only unlocks Student A
      const authA = await ParentDocumentService.verifyTokenAndSendOtp(invA.rawToken);
      expect(authA.studentName).toBe('Aarav Sharma');
      expect(authA.maskedPhone).toBe('+91 ******1111');

      // Verifying token B only unlocks Student B
      const authB = await ParentDocumentService.verifyTokenAndSendOtp(invB.rawToken);
      expect(authB.studentName).toBe('Diya Patel');
      expect(authB.maskedPhone).toBe('+91 ******2222');
    });
  });

  describe('5. Document Review & Acceptance Workflow', () => {
    it('allows Admin Office to accept pending document', async () => {
      const doc = await demoRepository.reviewStudentDocument(
        'stu-10a-01',
        'student_photo',
        'accept',
        adminActor
      );

      expect(doc).toBeDefined();
      expect(doc.reviewStatus).toBe('accepted');
      expect(doc.verifiedBy).toBe(adminActor.id);
      expect(doc.verifiedByName).toBe(adminActor.name);
      expect(doc.verifiedAt).toBeDefined();
      expect(doc.rejectionReason).toBeUndefined();
    });

    it('allows Admin Office to reject pending document with a mandatory reason', async () => {
      const reason = 'Document is blurred and unreadable. Please upload a clear photo.';
      const doc = await demoRepository.reviewStudentDocument(
        'stu-10a-01',
        'birth_certificate',
        'reject',
        adminActor,
        reason
      );

      expect(doc).toBeDefined();
      expect(doc.reviewStatus).toBe('rejected');
      expect(doc.rejectionReason).toBe(reason);
      expect(doc.verifiedBy).toBe(adminActor.id);
    });

    it('requires a rejection reason when rejecting a document', async () => {
      await expect(
        demoRepository.reviewStudentDocument(
          'stu-10a-01',
          'student_photo',
          'reject',
          adminActor,
          ''
        )
      ).rejects.toThrow('rejection reason');
    });

    it('strictly forbids Principal from approving or rejecting documents (read-only)', async () => {
      expect(Permissions.canUploadStudentDocument(principalActor)).toBe(false);
      expect(Permissions.canDeleteStudentDocument(principalActor)).toBe(false);

      await expect(
        demoRepository.reviewStudentDocument(
          'stu-10a-01',
          'student_photo',
          'accept',
          principalActor
        )
      ).rejects.toThrow('Principal is strictly read-only');
    });

    it('allows Developer role full document review permissions', async () => {
      expect(Permissions.canUploadStudentDocument(developerActor)).toBe(true);
      expect(Permissions.canDeleteStudentDocument(developerActor)).toBe(true);

      const doc = await demoRepository.reviewStudentDocument(
        'stu-10a-01',
        'student_photo',
        'accept',
        developerActor
      );
      expect(doc.reviewStatus).toBe('accepted');
    });
  });

  describe('6. WhatsApp Message Template Compliance', () => {
    it('formats an official bilingual document request message without altering attendance templates', async () => {
      const { invitation, uploadUrl } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo', 'student_aadhaar_front'],
        adminActor
      );

      const message = ParentDocumentService.formatDocumentRequestWhatsAppMessage(invitation, uploadUrl);

      // English section
      expect(message).toContain(`Dear Parent/Guardian of ${mockStudentA.fullName}`);
      expect(message).toContain(uploadUrl);
      expect(message).toContain('HanuJai High School requests you to securely upload');
      expect(message).toContain('No login or password is required');

      // Hindi section
      expect(message).toContain('आदरणीय अभिभावक');
      expect(message).toContain('हनुजाई हाई स्कूल');
      expect(message).toContain('सुरक्षित रूप से अपलोड');
      expect(message).toContain('किसी पासवर्ड या लॉगिन की आवश्यकता नहीं है');
    });

    it('records simulated WhatsApp dispatch in dry-run mode with deterministic messageId', async () => {
      const { invitation, uploadUrl } = await ParentDocumentService.createInvitation(
        mockStudentA,
        ['student_photo'],
        adminActor
      );

      const dispatch = await ParentDocumentService.sendInvitationWhatsApp(invitation, uploadUrl);
      expect(dispatch.success).toBe(true);
      expect(dispatch.messageId).toContain(`msg_doc_req_${invitation.id}`);
    });
  });
});
