/**
 * HanuJai High School ERP — Serverless Parent Document Collection API Test Suite
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Verifies:
 * 1. Dedicated Parent Token Verification Endpoint (POST /api/documents/parent-verify)
 *    - Valid 64-char token returns 200 with sanitized session & masked phone number.
 *    - Missing token returns 400.
 *    - Invalid / unknown token returns 404.
 *    - Revoked token returns 403.
 *    - Expired token returns 403.
 * 2. Dedicated Parent Upload Endpoint (POST /api/documents/parent-upload)
 *    - Valid token with permitted document slot issues scoped client token (200 OK).
 *    - Unauthorized document slot (not in invitation requestedSlots) returns 400.
 *    - Tampered cross-student path attempt returns 400.
 *    - Missing token returns 401.
 *    - Revoked / expired token returns 403.
 *    - Successful upload writes metadata with uploadedByRole: 'parent' (never synthetic admin).
 *    - No OTP or secondary verification required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import parentVerifyHandler from '../../api/documents/parent-verify';
import parentUploadHandler from '../../api/documents/parent-upload';
import crypto from 'crypto';

// Mock @vercel/blob/client
vi.mock('@vercel/blob/client', () => ({
  handleUpload: vi.fn().mockImplementation(async ({ onBeforeGenerateToken, onUploadCompleted, body, request }) => {
    if (body?.type === 'blob.upload-completed') {
      const sig = request?.headers?.['x-vercel-signature'];
      if (!sig) {
        throw new Error('Vercel Blob: Missing callback signature');
      }
      if (sig !== 'valid-mock-signature') {
        throw new Error('Vercel Blob: Invalid callback signature');
      }
      if (onUploadCompleted) {
        await onUploadCompleted({
          blob: body.payload.blob,
          tokenPayload: body.payload.tokenPayload,
        });
      }
      return { type: 'blob.upload-completed', response: 'ok' };
    }

    const payload = body?.payload || {};
    const tokenConfig = await onBeforeGenerateToken(
      payload.pathname || 'students/STU-TEST-01/documents/student_photo/test.jpg',
      payload.clientPayload || JSON.stringify({
        token: 'valid_test_parent_token_64chars_abcdef0123456789abcdef0123456789abcd',
        studentId: 'STU-TEST-01',
        documentType: 'student_photo',
        originalFileName: 'test.jpg',
      })
    );
    return {
      type: 'blob.generate-client-token',
      clientToken: 'mock-parent-client-token-999',
      tokenConfig,
    };
  }),
}));

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

const VALID_TOKEN = 'valid_test_parent_token_64chars_abcdef0123456789abcdef0123456789abcd';
const VALID_HASH = sha256Hex(VALID_TOKEN);

const REVOKED_TOKEN = 'revoked_test_parent_token_64chars_00000000000000000000000000000000';
const REVOKED_HASH = sha256Hex(REVOKED_TOKEN);

const EXPIRED_TOKEN = 'expired_test_parent_token_64chars_11111111111111111111111111111111';
const EXPIRED_HASH = sha256Hex(EXPIRED_TOKEN);

const DYNAMIC_TOKEN = 'dynamic_test_parent_token_64chars_22222222222222222222222222222222';
const DYNAMIC_HASH = sha256Hex(DYNAMIC_TOKEN);
let dynamicTokenStatus = 'active';

function createMockReq(options: {
  method: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  return {
    method: options.method,
    url: options.url || '/',
    headers: options.headers || {},
    body: options.body || {},
    readableEnded: true,
    on: vi.fn((event, cb) => {
      if (event === 'end') cb();
    }),
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    setHeader(key: string, val: string) {
      res.headers[key.toLowerCase()] = val;
    },
    end(data?: any) {
      res.body = data;
    },
  };
  return res;
}

describe('Serverless Parent Document API Architecture (P0 Remediation)', () => {
  const originalEnv = process.env;

  const mockFetch = vi.fn().mockImplementation(async (url: string) => {
    // Firestore REST API for parentDocumentInvitations/{tokenHash}
    if (url.includes('/parentDocumentInvitations/')) {
      if (url.includes(VALID_HASH)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              studentId: { stringValue: 'STU-TEST-01' },
              studentName: { stringValue: 'Aarav Sharma' },
              admissionNumber: { stringValue: '2024/0101' },
              classLabel: { stringValue: 'Class 10-A' },
              guardianName: { stringValue: 'Ramesh Sharma' },
              guardianPhone: { stringValue: '+91 98290 12345' },
              requestedSlots: {
                arrayValue: {
                  values: [
                    { stringValue: 'student_photo' },
                    { stringValue: 'student_aadhaar_front' },
                  ],
                },
              },
              status: { stringValue: 'active' },
              expiresAt: { stringValue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
            },
          }),
        };
      }

      if (url.includes(REVOKED_HASH)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              studentId: { stringValue: 'STU-TEST-01' },
              studentName: { stringValue: 'Aarav Sharma' },
              status: { stringValue: 'revoked' },
            },
          }),
        };
      }

      if (url.includes(EXPIRED_HASH)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              studentId: { stringValue: 'STU-TEST-01' },
              studentName: { stringValue: 'Aarav Sharma' },
              status: { stringValue: 'active' },
              expiresAt: { stringValue: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
            },
          }),
        };
      }

      if (url.includes(DYNAMIC_HASH)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              studentId: { stringValue: 'STU-TEST-01' },
              studentName: { stringValue: 'Aarav Sharma' },
              admissionNumber: { stringValue: '2024/0101' },
              classLabel: { stringValue: 'Class 10-A' },
              guardianName: { stringValue: 'Ramesh Sharma' },
              guardianPhone: { stringValue: '+91 98290 12345' },
              requestedSlots: {
                arrayValue: {
                  values: [{ stringValue: 'student_photo' }],
                },
              },
              status: { stringValue: dynamicTokenStatus },
              expiresAt: { stringValue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
            },
          }),
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { message: 'DOCUMENT_NOT_FOUND' } }),
      };
    }

    // Authoritative Firestore document write
    if (url.includes('/students/') && url.includes('/documents/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: 'projects/hanujai-test-project/databases/(default)/documents/students/STU-TEST-01/documents/student_photo' }),
      };
    }

    // Authoritative Firestore audit event write
    if (url.includes('/auditEvents')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: 'projects/hanujai-test-project/databases/(default)/documents/auditEvents/mock-audit-id' }),
      };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  });

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_mock_token_123',
      VITE_FIREBASE_API_KEY: 'test_api_key_123',
      VITE_FIREBASE_PROJECT_ID: 'hanujai-test-project',
      FIREBASE_AUTH_ACCESS_TOKEN: 'mock-google-service-account-oauth-token',
      NODE_ENV: 'test',
    };
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  describe('1. Parent Token Verification API (POST /api/documents/parent-verify)', () => {
    it('verifies a valid token and returns 200 with sanitized metadata, masked phone, and signed uploadSessionToken', async () => {
      const req = createMockReq({
        method: 'POST',
        body: { token: VALID_TOKEN },
      });
      const res = createMockRes();

      await parentVerifyHandler(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.valid).toBe(true);
      expect(data.session.studentName).toBe('Aarav Sharma');
      expect(data.session.studentId).toBe('STU-TEST-01');
      expect(data.session.admissionNumber).toBe('2024/0101');
      expect(data.session.maskedPhone).toBe('+91 ******2345');
      expect(data.session.requestedSlots).toEqual(['student_photo', 'student_aadhaar_front']);
      // Distinct, short-lived, HMAC-signed upload session token capability
      expect(data.session.uploadSessionToken).toBeDefined();
      expect(typeof data.session.uploadSessionToken).toBe('string');
      expect(data.session.uploadSessionToken).toContain('.');
    });

    it('rejects an invalid token with 404', async () => {
      const req = createMockReq({
        method: 'POST',
        body: { token: 'unknown_token_value_not_in_firestore_00000000000000' },
      });
      const res = createMockRes();

      await parentVerifyHandler(req, res);

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.body);
      expect(data.valid).toBe(false);
      expect(data.error).toContain('invalid, does not exist, or has been revoked');
    });

    it('rejects a revoked token with 403', async () => {
      const req = createMockReq({
        method: 'POST',
        body: { token: REVOKED_TOKEN },
      });
      const res = createMockRes();

      await parentVerifyHandler(req, res);

      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.body);
      expect(data.valid).toBe(false);
      expect(data.error).toContain('revoked');
    });

    it('rejects an expired token with 403', async () => {
      const req = createMockReq({
        method: 'POST',
        body: { token: EXPIRED_TOKEN },
      });
      const res = createMockRes();

      await parentVerifyHandler(req, res);

      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.body);
      expect(data.valid).toBe(false);
      expect(data.error).toContain('expired');
    });

    it('rejects request with missing token with 400', async () => {
      const req = createMockReq({
        method: 'POST',
        body: {},
      });
      const res = createMockRes();

      await parentVerifyHandler(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.valid).toBe(false);
      expect(data.error).toContain('Missing document upload invitation token');
    });
  });

  describe('2. Parent Document Upload API (POST /api/documents/parent-upload)', () => {
    it('authorizes upload for an explicitly permitted document slot (200 OK)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-parent-token': VALID_TOKEN },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU-TEST-01/documents/student_photo/photo.jpg',
            clientPayload: JSON.stringify({
              token: VALID_TOKEN,
              studentId: 'STU-TEST-01',
              documentType: 'student_photo',
              originalFileName: 'photo.jpg',
            }),
          },
        },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.type).toBe('blob.generate-client-token');
      expect(data.clientToken).toBe('mock-parent-client-token-999');
    });

    it('rejects upload attempt for an unpermitted document slot (400)', async () => {
      // 'transfer_certificate' was not requested for this student (only student_photo & aadhaar)
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-parent-token': VALID_TOKEN },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU-TEST-01/documents/transfer_certificate/tc.pdf',
            clientPayload: JSON.stringify({
              token: VALID_TOKEN,
              studentId: 'STU-TEST-01',
              documentType: 'transfer_certificate',
              originalFileName: 'tc.pdf',
            }),
          },
        },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('is not permitted for this upload link');
    });

    it('rejects cross-student tampering attempts (400)', async () => {
      // Attacker attempts to upload to another student's path (STU-VICTIM-99)
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-parent-token': VALID_TOKEN },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU-VICTIM-99/documents/student_photo/photo.jpg',
            clientPayload: JSON.stringify({
              token: VALID_TOKEN,
              studentId: 'STU-VICTIM-99',
              documentType: 'student_photo',
            }),
          },
        },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('Unauthorized upload path. Must start strictly with students/STU-TEST-01');
    });

    it('rejects upload attempt with missing token with 401', async () => {
      const req = createMockReq({
        method: 'POST',
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(401);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('Missing document upload invitation token');
    });

    it('rejects upload attempt with revoked token with 403', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-parent-token': REVOKED_TOKEN },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('revoked');
    });

    it('immediately invalidates an in-flight upload session if the invitation is revoked after initial verification', async () => {
      // 1. Initial verification passes
      dynamicTokenStatus = 'active';
      const verifyReq = createMockReq({
        method: 'POST',
        body: { token: DYNAMIC_TOKEN },
      });
      const verifyRes = createMockRes();
      await parentVerifyHandler(verifyReq, verifyRes);
      expect(verifyRes.statusCode).toBe(200);

      // 2. Admin revokes the invitation in Firestore
      dynamicTokenStatus = 'revoked';

      // 3. In-flight upload attempt with the same token is immediately rejected
      const uploadReq = createMockReq({
        method: 'POST',
        headers: { 'x-parent-token': DYNAMIC_TOKEN },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU-TEST-01/documents/student_photo/photo.jpg',
            clientPayload: JSON.stringify({
              token: DYNAMIC_TOKEN,
              studentId: 'STU-TEST-01',
              documentType: 'student_photo',
            }),
          },
        },
      });
      const uploadRes = createMockRes();
      await parentUploadHandler(uploadReq, uploadRes);

      expect(uploadRes.statusCode).toBe(403);
      const data = JSON.parse(uploadRes.body);
      expect(data.error).toContain('revoked');
    });

    it('rejects upload attempt with expired token with 403', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-parent-token': EXPIRED_TOKEN },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('expired');
    });

    it('returns 503 when BLOB_READ_WRITE_TOKEN is not configured', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN;

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-parent-token': VALID_TOKEN },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(503);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('Missing BLOB_READ_WRITE_TOKEN');
    });

    it('handles blob.upload-completed callback: verifies signature and writes metadata with uploadedByRole: parent', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: {
          'x-vercel-signature': 'valid-mock-signature',
        },
        body: {
          type: 'blob.upload-completed',
          payload: {
            blob: {
              pathname: 'students/STU-TEST-01/documents/student_photo/verified_photo.jpg',
              url: 'https://vercel-storage.com/verified_photo.jpg',
              contentType: 'image/jpeg',
            },
            tokenPayload: JSON.stringify({
              isParentUpload: true,
              studentId: 'STU-TEST-01',
              documentType: 'student_photo',
              guardianPhone: '+91 98290 12345',
              guardianName: 'Ramesh Sharma',
              tokenHash: VALID_HASH,
              originalFileName: 'verified_photo.jpg',
              fileSize: 204800,
            }),
          },
        },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.type).toBe('blob.upload-completed');

      // Verify Firestore PATCH was called to write metadata with uploadedByRole: 'parent'
      const docWriteCalls = mockFetch.mock.calls.filter(call =>
        call[0].includes('/students/STU-TEST-01/documents/student_photo')
      );
      expect(docWriteCalls.length).toBeGreaterThan(0);
      const docWriteBody = JSON.parse(docWriteCalls[0][1].body);
      expect(docWriteBody.fields.uploadedByRole.stringValue).toBe('parent');
      // Privacy-preserving pseudonymized reference (never raw phone number)
      expect(docWriteBody.fields.uploadedBy.stringValue).toBe(`parent_invite_${VALID_HASH.substring(0, 16)}`);
      expect(docWriteBody.fields.uploadedByName.stringValue).toBe('Parent / Guardian');
      expect(docWriteBody.fields.reviewStatus.stringValue).toBe('pending');
      expect(docWriteBody.fields.status.stringValue).toBe('pending_verification');
      // Confirmed: guardian phone number is NOT in document record
      expect(docWriteBody.fields.guardianPhone).toBeUndefined();

      // Verify Firestore POST was called for audit event with privacy-preserving actorId
      const auditCalls = mockFetch.mock.calls.filter(call => call[0].includes('/auditEvents'));
      expect(auditCalls.length).toBeGreaterThan(0);
      const auditBody = JSON.parse(auditCalls[0][1].body);
      expect(auditBody.fields.actorRole.stringValue).toBe('parent');
      expect(auditBody.fields.actorId.stringValue).toBe(`parent_invite_${VALID_HASH.substring(0, 16)}`);
      expect(auditBody.fields.actorName.stringValue).toBe('Parent / Guardian');
      expect(auditBody.fields.action.stringValue).toBe('parent_document_uploaded');
      expect(auditBody.fields.guardianPhone).toBeUndefined();

      // Verify Google Service Account authorization header was attached
      const authHeaderPresent = docWriteCalls[0][1].headers.Authorization;
      expect(authHeaderPresent).toBe('Bearer mock-google-service-account-oauth-token');
    });

    it('authorizes upload via dedicated short-lived HMAC uploadSessionToken (200 OK)', async () => {
      // 1. Verify parent invitation to obtain uploadSessionToken
      const verifyReq = createMockReq({
        method: 'POST',
        body: { token: VALID_TOKEN },
      });
      const verifyRes = createMockRes();
      await parentVerifyHandler(verifyReq, verifyRes);
      expect(verifyRes.statusCode).toBe(200);
      const verifyData = JSON.parse(verifyRes.body);
      const uploadSessionToken = verifyData.session.uploadSessionToken;
      expect(uploadSessionToken).toBeDefined();

      // 2. Perform upload authorization using the issued uploadSessionToken
      const uploadReq = createMockReq({
        method: 'POST',
        headers: { 'x-parent-session-token': uploadSessionToken },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU-TEST-01/documents/student_photo/photo.jpg',
            clientPayload: JSON.stringify({
              token: uploadSessionToken,
              studentId: 'STU-TEST-01',
              documentType: 'student_photo',
              originalFileName: 'photo.jpg',
            }),
          },
        },
      });
      const uploadRes = createMockRes();
      await parentUploadHandler(uploadReq, uploadRes);

      expect(uploadRes.statusCode).toBe(200);
      const uploadData = JSON.parse(uploadRes.body);
      expect(uploadData.type).toBe('blob.generate-client-token');
      expect(uploadData.clientToken).toBe('mock-parent-client-token-999');
    });

    it('rejects upload authorization with a forged or tampered uploadSessionToken (403)', async () => {
      const forgedSessionToken = 'eyJ0b2tlblNoYXNoIjoiZmFrZSJ9.forged_signature_that_does_not_match';
      const uploadReq = createMockReq({
        method: 'POST',
        headers: { 'x-parent-session-token': forgedSessionToken },
        body: { type: 'blob.generate-client-token' },
      });
      const uploadRes = createMockRes();
      await parentUploadHandler(uploadReq, uploadRes);

      expect(uploadRes.statusCode).toBe(403);
      const uploadData = JSON.parse(uploadRes.body);
      expect(uploadData.error).toContain('Invalid session token signature');
    });

    it('re-verifies live Firestore record during uploadSessionToken use and blocks revoked invitation (403)', async () => {
      // 1. Obtain uploadSessionToken for dynamic token
      dynamicTokenStatus = 'active';
      const verifyReq = createMockReq({
        method: 'POST',
        body: { token: DYNAMIC_TOKEN },
      });
      const verifyRes = createMockRes();
      await parentVerifyHandler(verifyReq, verifyRes);
      expect(verifyRes.statusCode).toBe(200);
      const uploadSessionToken = JSON.parse(verifyRes.body).session.uploadSessionToken;

      // 2. Admin revokes invitation in Firestore
      dynamicTokenStatus = 'revoked';

      // 3. Upload attempt with the unexpired session token is still rejected by live check
      const uploadReq = createMockReq({
        method: 'POST',
        headers: { 'x-parent-session-token': uploadSessionToken },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU-TEST-01/documents/student_photo/photo.jpg',
            clientPayload: JSON.stringify({
              token: uploadSessionToken,
              studentId: 'STU-TEST-01',
              documentType: 'student_photo',
            }),
          },
        },
      });
      const uploadRes = createMockRes();
      await parentUploadHandler(uploadReq, uploadRes);

      expect(uploadRes.statusCode).toBe(403);
      const uploadData = JSON.parse(uploadRes.body);
      expect(uploadData.error).toContain('revoked');
    });

    it('rejects forged blob.upload-completed callback with missing signature (400)', async () => {
      const initialFetchCount = mockFetch.mock.calls.length;
      const req = createMockReq({
        method: 'POST',
        headers: {}, // No x-vercel-signature header
        body: {
          type: 'blob.upload-completed',
          payload: {
            blob: {
              pathname: 'students/STU-TEST-01/documents/student_photo/forged.jpg',
            },
          },
        },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('Missing callback signature');
      // Proves no metadata was written
      expect(mockFetch.mock.calls.length).toBe(initialFetchCount);
    });

    it('rejects forged blob.upload-completed callback with invalid signature (400)', async () => {
      const initialFetchCount = mockFetch.mock.calls.length;
      const req = createMockReq({
        method: 'POST',
        headers: {
          'x-vercel-signature': 'forged_attacker_signature',
        },
        body: {
          type: 'blob.upload-completed',
          payload: {
            blob: {
              pathname: 'students/STU-TEST-01/documents/student_photo/forged.jpg',
            },
          },
        },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('Invalid callback signature');
      // Proves no metadata was written
      expect(mockFetch.mock.calls.length).toBe(initialFetchCount);
    });

    it('handles Firestore metadata write failures gracefully without unhandled crashes', async () => {
      // Mock fetch to reject when posting to Firestore
      mockFetch.mockImplementationOnce(async (url: string) => {
        if (url.includes('/students/')) {
          throw new Error('Firestore connection failure simulation');
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const req = createMockReq({
        method: 'POST',
        headers: {
          'x-vercel-signature': 'valid-mock-signature',
        },
        body: {
          type: 'blob.upload-completed',
          payload: {
            blob: {
              pathname: 'students/STU-TEST-01/documents/student_photo/photo.jpg',
              url: 'https://vercel-storage.com/photo.jpg',
            },
            tokenPayload: JSON.stringify({
              studentId: 'STU-TEST-01',
              documentType: 'student_photo',
            }),
          },
        },
      });
      const res = createMockRes();

      await parentUploadHandler(req, res);

      // Handler finishes safely and returns 200 (webhook acknowledged)
      expect(res.statusCode).toBe(200);
    });
  });
});

