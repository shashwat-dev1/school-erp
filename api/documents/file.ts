/**
 * HanuJai High School ERP — Authenticated Private Document Delivery Endpoint
 * Endpoint: GET /api/documents/file
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Cross-Account Storage Architecture:
 * - Hosted on Account A (Website & Functions)
 * - Queries Account B's Private Blob Store using Account B's BLOB_READ_WRITE_TOKEN
 *
 * Security:
 * - Authentication is accepted ONLY via Authorization: Bearer <idToken> headers
 * - URL query parameter authentication is strictly prohibited
 * - Storage path is strictly validated against canonical schema
 * - Principal and Admin Office are authorized to view and download
 * - Teachers and deactivated users are denied (HTTP 403)
 * - Anti-sniffing, private cache control, and content disposition headers applied
 * - Sensitive tokens and document URLs are NEVER logged
 * - Self-contained execution guarantees zero ERR_MODULE_NOT_FOUND issues on Vercel ESM runtime
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import { get } from '@vercel/blob';

const CANONICAL_PATH_REGEX = /^students\/[A-Za-z0-9_-]+\/documents\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;

const FIREBASE_API_KEY =
  process.env.VITE_FIREBASE_API_KEY ||
  process.env.FIREBASE_API_KEY ||
  'AIzaSyC45xxyybCp03KlJ7fWsyxE8AVQY6tm988';

const FIREBASE_PROJECT_ID =
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  'hanujai-erp-demo';

interface VerifiedStaff {
  uid: string;
  email: string;
  displayName: string;
  role: 'principal' | 'admin' | 'developer';
}

interface AuthResult {
  valid: boolean;
  user?: VerifiedStaff;
  status: number;
  error?: string;
}

function extractToken(req: IncomingMessage): string | null {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    return token.length > 0 ? token : null;
  }
  return null;
}

async function verifyStaffAuth(
  req: IncomingMessage,
  requiredPermission: 'view' | 'manage' = 'view'
): Promise<AuthResult> {
  const token = extractToken(req);

  if (!token) {
    return {
      valid: false,
      status: 401,
      error: 'Authentication required. Missing Authorization: Bearer <idToken> header.',
    };
  }

  try {
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.users || data.users.length === 0) {
      return {
        valid: false,
        status: 401,
        error: 'Invalid, expired, or revoked authentication token. Please log in again.',
      };
    }

    const authUser = data.users[0];
    const email = (authUser.email || '').toLowerCase();
    const uid = authUser.localId;
    const displayName = authUser.displayName || email.split('@')[0];

    const fsRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/staff/${uid}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!fsRes.ok) {
      if (fsRes.status === 404) {
        return {
          valid: false,
          status: 403,
          error: 'Staff account record not found in authoritative school registry. Access denied.',
        };
      }
      return {
        valid: false,
        status: 403,
        error: `Authoritative staff verification failed (HTTP ${fsRes.status}). Access denied.`,
      };
    }

    const fsData = await fsRes.json().catch(() => ({}));
    const staffRole = fsData.fields?.role?.stringValue;
    const staffStatus = fsData.fields?.status?.stringValue || 'active';

    if (staffStatus === 'deactivated' || staffStatus === 'suspended') {
      return {
        valid: false,
        status: 403,
        error: 'Account is deactivated or suspended. Access to school documents is suspended.',
      };
    }

    let role: 'principal' | 'admin' | 'developer' | 'unauthorized' = 'unauthorized';
    if (staffRole === 'developer') role = 'developer';
    else if (staffRole === 'admin') role = 'admin';
    else if (staffRole === 'principal') role = 'principal';

    if (role === 'unauthorized') {
      return {
        valid: false,
        status: 403,
        error: 'Account role is not authorized for document operations. Teacher and unauthorized accounts are restricted.',
      };
    }

    if (requiredPermission === 'manage' && role === 'principal') {
      return {
        valid: false,
        status: 403,
        error: 'Permission Denied: Principal view is strictly read-only. Only Admin Office accounts can upload, replace, or delete student documents.',
      };
    }

    return {
      valid: true,
      status: 200,
      user: { uid, email, displayName, role },
    };
  } catch (verifyError: unknown) {
    const message = verifyError instanceof Error ? verifyError.message : 'Authentication verification error';
    return {
      valid: false,
      status: 500,
      error: `Identity verification service error: ${message}`,
    };
  }
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  res: ServerResponse
) {
  const sendJson = (status: number, data: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(405, { error: 'Method Not Allowed. Use GET to access documents.' });
  }

  // Cross-account token check (Account B Blob Store Token)
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    console.error('[HanuJai Storage] BLOB_READ_WRITE_TOKEN is not configured on server.');
    return sendJson(503, {
      error:
        'Vercel Private Blob store is not connected. Missing BLOB_READ_WRITE_TOKEN. ' +
        'Please follow VERCEL_BLOB_SETUP_GUIDE.md to add Account B store token to project settings.',
    });
  }

  // Parse query parameters
  let pathname = '';
  let isDownload = false;

  if (req.query) {
    pathname = (req.query.pathname as string) || '';
    isDownload = req.query.download === '1' || req.query.download === 'true';
  }

  if (!pathname && req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      pathname = parsedUrl.searchParams.get('pathname') || '';
      isDownload =
        parsedUrl.searchParams.get('download') === '1' || parsedUrl.searchParams.get('download') === 'true';
    } catch {
      // Ignore
    }
  }

  if (!pathname) {
    return sendJson(400, { error: 'Missing required query parameter: pathname' });
  }

  if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
    try {
      const urlObj = new URL(pathname);
      pathname = urlObj.pathname.replace(/^\//, '');
    } catch {
      return sendJson(400, { error: 'Invalid document URL format.' });
    }
  }

  if (pathname.includes('..') || pathname.includes('\0') || !CANONICAL_PATH_REGEX.test(pathname)) {
    return sendJson(400, {
      error: 'Invalid document path format. Must match canonical student document structure.',
    });
  }

  // Verify staff authentication (Header-only Bearer token; Principal & Admin Office authorized)
  const authResult = await verifyStaffAuth(req, 'view');
  if (!authResult.valid) {
    return sendJson(authResult.status, { error: authResult.error });
  }

  try {
    const blobResult = await get(pathname, {
      access: 'private',
      token: blobToken,
    });

    if (!blobResult) {
      return sendJson(404, { error: 'Document file not found in private cloud storage.' });
    }

    if (blobResult.statusCode === 304) {
      res.statusCode = 304;
      return res.end();
    }

    const contentType =
      blobResult.headers.get('content-type') || blobResult.blob.contentType || 'application/octet-stream';
    const fileName = pathname.split('/').pop() || 'document';
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      isDownload ? `attachment; filename="${safeFileName}"` : `inline; filename="${safeFileName}"`
    );

    // Stream blob response to client
    if (blobResult.stream) {
      const nodeStream = Readable.fromWeb(blobResult.stream as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve document.';
    console.error('[HanuJai Storage] Document stream error:', message);
    return sendJson(500, { error: `Storage retrieval failed: ${message}` });
  }
}
