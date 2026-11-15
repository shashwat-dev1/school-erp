/**
 * HanuJai High School ERP — Serverless Document API Security & RBAC Tests
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Verifies:
 * 1. Missing environment variable (BLOB_READ_WRITE_TOKEN) returns 503.
 * 2. Unauthenticated requests return 401.
 * 3. Query parameter tokens are rejected with 401.
 * 4. Hardcoded bypass tokens ('demo-admin-token', 'demo-principal-token') are REJECTED with 401.
 * 5. Deactivated staff accounts return 403.
 * 6. Unregistered/missing staff accounts return 403 (fail-closed).
 * 7. Principal account upload/delete attempts return 403 (read-only oversight).
 * 8. Admin Office and Developer accounts upload/delete attempts succeed (200).
 * 9. Developer, Admin Office, and Principal can view/stream documents (200).
 * 10. Successful client-token generation returns correct JSON structure.
 * 11. Invalid student ID, slot name, or path mismatch returns 400.
 * 12. Path traversal attempts return 400.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import uploadHandler from '../../api/documents/upload';
import fileHandler from '../../api/documents/file';
import deleteHandler from '../../api/documents/delete';

// Mock @vercel/blob and @vercel/blob/client
vi.mock('@vercel/blob/client', () => ({
  handleUpload: vi.fn().mockImplementation(async ({ onBeforeGenerateToken, body }) => {
    const payload = body?.payload || {};
    const tokenConfig = await onBeforeGenerateToken(
      payload.pathname || 'students/STU-01A-35/documents/student_photo/test.jpg',
      payload.clientPayload || JSON.stringify({
        studentId: 'STU-01A-35',
        documentType: 'student_photo',
        originalFileName: 'test.jpg',
      })
    );
    return {
      type: 'blob.generate-client-token',
      clientToken: 'mock-client-token-12345',
      tokenConfig,
    };
  }),
}));

vi.mock('@vercel/blob', () => ({
  get: vi.fn().mockImplementation(async (pathname: string) => {
    if (pathname.includes('not_found')) return null;
    return {
      statusCode: 200,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      blob: {
        contentType: 'application/pdf',
        size: 13,
      },
      stream: null,
    };
  }),
  del: vi.fn().mockImplementation(async () => {}),
}));

function createMockReq(options: {
  method: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}) {
  return {
    method: options.method,
    url: options.url || '/',
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
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

describe('Serverless Documents API Security & RBAC Suite', () => {
  const originalEnv = process.env;

  const mockFetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
    // 1. Google Identity Toolkit lookup
    if (url.includes('identitytoolkit.googleapis.com')) {
      const body = JSON.parse(init?.body || '{}');
      const token = body.idToken;

      if (token === 'valid-admin-token') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            users: [{ localId: 'staff-admin-01', email: 'admin@hanujai.edu.in', displayName: 'Admin Officer' }],
          }),
        };
      }
      if (token === 'valid-principal-token') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            users: [{ localId: 'staff-principal-01', email: 'principal@hanujai.edu.in', displayName: 'Dr. Principal' }],
          }),
        };
      }
      if (token === 'valid-developer-token') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            users: [{ localId: 'staff-dev-01', email: 'dev@hanujai.edu.in', displayName: 'System Developer' }],
          }),
        };
      }
      if (token === 'deactivated-staff-token') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            users: [{ localId: 'staff-deactivated-01', email: 'former-admin@hanujai.edu.in', displayName: 'Former Admin' }],
          }),
        };
      }
      if (token === 'unregistered-staff-token') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            users: [{ localId: 'unknown-uid-999', email: 'stranger@hanujai.edu.in', displayName: 'Stranger' }],
          }),
        };
      }

      // Hardcoded test tokens without valid Identity Toolkit lookup fail with 401
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'INVALID_ID_TOKEN' } }),
      };
    }

    // 2. Cloud Firestore REST API for authoritative staff record
    if (url.includes('/databases/(default)/documents/staff/')) {
      if (url.endsWith('/staff/staff-admin-01')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              role: { stringValue: 'admin' },
              status: { stringValue: 'active' },
            },
          }),
        };
      }
      if (url.endsWith('/staff/staff-principal-01')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              role: { stringValue: 'principal' },
              status: { stringValue: 'active' },
            },
          }),
        };
      }
      if (url.endsWith('/staff/staff-dev-01')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              role: { stringValue: 'developer' },
              status: { stringValue: 'active' },
            },
          }),
        };
      }
      if (url.endsWith('/staff/staff-deactivated-01')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              role: { stringValue: 'admin' },
              status: { stringValue: 'deactivated' },
            },
          }),
        };
      }

      // Missing / 404
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { message: 'DOCUMENT_NOT_FOUND' } }),
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
      NODE_ENV: 'test',
    };
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  describe('Authentication & Authorization Enforcements', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = createMockReq({ method: 'POST', body: { type: 'blob.generate-client-token' } });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(401);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Missing Authorization: Bearer <idToken> header');
    });

    it('rejects tokens passed in URL query parameters with 401', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/documents/file?pathname=students/STU-01A-35/documents/student_photo/photo.jpg&token=valid-admin-token',
        query: {
          pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg',
          token: 'valid-admin-token',
        },
      });
      const res = createMockRes();

      await fileHandler(req, res);

      expect(res.statusCode).toBe(401);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Missing Authorization: Bearer <idToken> header');
    });

    it('rejects hardcoded demo-admin-token and demo-principal-token with 401 (Zero Test Bypasses)', async () => {
      const req1 = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer demo-admin-token' },
        body: { type: 'blob.generate-client-token' },
      });
      const res1 = createMockRes();
      await uploadHandler(req1, res1);
      expect(res1.statusCode).toBe(401);

      const req2 = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer demo-principal-token' },
        query: { pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg' },
      });
      const res2 = createMockRes();
      await fileHandler(req2, res2);
      expect(res2.statusCode).toBe(401);
    });

    it('rejects parent invitation tokens presented to staff endpoints with 401 Unauthorized', async () => {
      const parentRawToken = 'parent_invitation_random_token_64_chars_1234567890abcdef1234567890';

      // 1. Staff Upload Endpoint
      const uploadReq = createMockReq({
        method: 'POST',
        headers: { authorization: `Bearer ${parentRawToken}` },
        body: { type: 'blob.generate-client-token' },
      });
      const uploadRes = createMockRes();
      await uploadHandler(uploadReq, uploadRes);
      expect(uploadRes.statusCode).toBe(401);

      // 2. Staff File View Endpoint
      const fileReq = createMockReq({
        method: 'GET',
        headers: { authorization: `Bearer ${parentRawToken}` },
        query: { pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg' },
      });
      const fileRes = createMockRes();
      await fileHandler(fileReq, fileRes);
      expect(fileRes.statusCode).toBe(401);

      // 3. Staff Delete Endpoint
      const deleteReq = createMockReq({
        method: 'POST',
        headers: { authorization: `Bearer ${parentRawToken}` },
        body: { pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg' },
      });
      const deleteRes = createMockRes();
      await deleteHandler(deleteReq, deleteRes);
      expect(deleteRes.statusCode).toBe(401);
    });

    it('rejects unregistered staff records with 403 (Fail-Closed)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer unregistered-staff-token' },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(403);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Staff account record not found in authoritative school registry');
    });

    it('rejects deactivated staff accounts with 403', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer deactivated-staff-token' },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(403);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Account is deactivated or suspended');
    });

    it('denies Principal from uploading documents with 403 Forbidden', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer valid-principal-token' },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(403);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Principal view is strictly read-only');
    });

    it('denies Principal from deleting documents with 403 Forbidden', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer valid-principal-token' },
        body: { pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg' },
      });
      const res = createMockRes();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(403);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Principal view is strictly read-only');
    });

    it('allows Admin Office to authorize document uploads (200 OK)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer valid-admin-token' },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU-01A-35/documents/student_photo/1794000_photo.jpg',
            clientPayload: JSON.stringify({
              studentId: 'STU-01A-35',
              documentType: 'student_photo',
              originalFileName: 'photo.jpg',
            }),
          },
        },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.type).toBe('blob.generate-client-token');
      expect(parsed.clientToken).toBe('mock-client-token-12345');
    });

    it('allows Developer role to authorize document uploads (200 OK)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer valid-developer-token' },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU-01A-35/documents/student_photo/1794000_photo.jpg',
            clientPayload: JSON.stringify({
              studentId: 'STU-01A-35',
              documentType: 'student_photo',
              originalFileName: 'photo.jpg',
            }),
          },
        },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.type).toBe('blob.generate-client-token');
    });

    it('allows Admin Office to delete documents (200 OK)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer valid-admin-token' },
        body: { pathname: 'students/STU-01A-35/documents/transfer_certificate/tc.pdf' },
      });
      const res = createMockRes();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.success).toBe(true);
    });

    it('allows Developer to delete documents (200 OK)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer valid-developer-token' },
        body: { pathname: 'students/STU-01A-35/documents/transfer_certificate/tc.pdf' },
      });
      const res = createMockRes();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.success).toBe(true);
    });

    it('allows Developer, Admin Office, and Principal to view/stream documents (200 OK)', async () => {
      // Principal view
      const principalReq = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer valid-principal-token' },
        query: { pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg' },
      });
      const principalRes = createMockRes();
      await fileHandler(principalReq, principalRes);
      expect(principalRes.statusCode).toBe(200);
      expect(principalRes.headers['x-content-type-options']).toBe('nosniff');
      expect(principalRes.headers['cache-control']).toContain('private');

      // Admin view
      const adminReq = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer valid-admin-token' },
        query: { pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg' },
      });
      const adminRes = createMockRes();
      await fileHandler(adminReq, adminRes);
      expect(adminRes.statusCode).toBe(200);

      // Developer view
      const devReq = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer valid-developer-token' },
        query: { pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg' },
      });
      const devRes = createMockRes();
      await fileHandler(devReq, devRes);
      expect(devRes.statusCode).toBe(200);
    });
  });

  describe('Path Traversal & Storage Security Safeguards', () => {
    it('rejects path traversal attempts with 400 Bad Request', async () => {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer valid-admin-token' },
        query: { pathname: 'students/STU-01A-35/documents/../../../etc/passwd' },
      });
      const res = createMockRes();

      await fileHandler(req, res);

      expect(res.statusCode).toBe(400);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Invalid document path format');
    });

    it('returns 503 Service Unavailable when BLOB_READ_WRITE_TOKEN is unconfigured', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN;

      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer valid-admin-token' },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(503);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Missing BLOB_READ_WRITE_TOKEN');
    });

    it('rejects upload authorization with invalid student ID format (400)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer valid-admin-token' },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU$#INVALID/documents/student_photo/photo.jpg',
            clientPayload: JSON.stringify({
              studentId: 'STU$#INVALID',
              documentType: 'student_photo',
            }),
          },
        },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(400);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Invalid student ID format');
    });

    it('rejects upload authorization with invalid document category slot (400)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer valid-admin-token' },
        body: {
          type: 'blob.generate-client-token',
          payload: {
            pathname: 'students/STU-01A-35/documents/unauthorized_category/photo.jpg',
            clientPayload: JSON.stringify({
              studentId: 'STU-01A-35',
              documentType: 'unauthorized_category',
            }),
          },
        },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(400);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Invalid document slot');
    });
  });
});
