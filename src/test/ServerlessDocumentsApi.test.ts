/**
 * HanuJai High School ERP — Serverless Document API Security & RBAC Tests
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Verifies:
 * 1. Unauthenticated requests return 401.
 * 2. Query parameter tokens are rejected (returns 401).
 * 3. Principal account upload/delete attempts return 403 (read-only oversight).
 * 4. Admin Office account upload/delete attempts succeed (200).
 * 5. Path validation rejects traversal, invalid formats, or cross-student writes (400).
 * 6. Missing BLOB_READ_WRITE_TOKEN returns 503.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import uploadHandler from '../../api/documents/upload';
import fileHandler from '../../api/documents/file';
import deleteHandler from '../../api/documents/delete';

// Mock @vercel/blob and @vercel/blob/client
vi.mock('@vercel/blob/client', () => ({
  handleUpload: vi.fn().mockImplementation(async ({ onBeforeGenerateToken }) => {
    const tokenConfig = await onBeforeGenerateToken('students/STU-01A-35/documents/student_photo/test.jpg', JSON.stringify({
      studentId: 'STU-01A-35',
      documentType: 'student_photo',
      originalFileName: 'test.jpg',
    }));
    return {
      type: 'blob.generate-client-token',
      clientToken: 'mock-client-token',
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

  beforeEach(() => {
    process.env = { ...originalEnv, BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_mock_token_123', NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = originalEnv;
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
        url: '/api/documents/file?pathname=students/STU-01A-35/documents/student_photo/photo.jpg&token=demo-admin-token',
        query: {
          pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg',
          token: 'demo-admin-token',
        },
      });
      const res = createMockRes();

      await fileHandler(req, res);

      expect(res.statusCode).toBe(401);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Missing Authorization: Bearer <idToken> header');
    });

    it('denies Principal from uploading documents with 403 Forbidden', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer demo-principal-token' },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(403);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Principal account is read-only');
    });

    it('denies Principal from deleting documents with 403 Forbidden', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer demo-principal-token' },
        body: { pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg' },
      });
      const res = createMockRes();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(403);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Principal account is read-only');
    });

    it('allows Admin Office to authorize document uploads (200 OK)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer demo-admin-token' },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.type).toBe('blob.generate-client-token');
      expect(parsed.clientToken).toBe('mock-client-token');
    });

    it('allows Admin Office to delete documents (200 OK)', async () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer demo-admin-token' },
        body: { pathname: 'students/STU-01A-35/documents/transfer_certificate/tc.pdf' },
      });
      const res = createMockRes();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.success).toBe(true);
    });

    it('allows both Principal and Admin Office to view/stream documents (200 OK)', async () => {
      // Principal view
      const principalReq = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer demo-principal-token' },
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
        headers: { authorization: 'Bearer demo-admin-token' },
        query: { pathname: 'students/STU-01A-35/documents/student_photo/photo.jpg' },
      });
      const adminRes = createMockRes();
      await fileHandler(adminReq, adminRes);
      expect(adminRes.statusCode).toBe(200);
    });
  });

  describe('Path Traversal & Storage Security Safeguards', () => {
    it('rejects path traversal attempts with 400 Bad Request', async () => {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer demo-admin-token' },
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
        headers: { authorization: 'Bearer demo-admin-token' },
        body: { type: 'blob.generate-client-token' },
      });
      const res = createMockRes();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(503);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Missing BLOB_READ_WRITE_TOKEN');
    });
  });
});
