/**
 * HanuJai High School ERP — Authenticated Private Document Deletion Endpoint
 * Endpoint: POST /api/documents/delete
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Cross-Account Storage Architecture:
 * - Hosted on Account A (Website & Functions)
 * - Targets Account B's Private Blob Store using Account B's BLOB_READ_WRITE_TOKEN
 *
 * Security:
 * - Accepts tokens strictly via Authorization: Bearer <idToken> headers
 * - Enforces Admin Office credentials (Principal is strictly read-only and blocked with 403)
 * - Validates storage path against canonical pattern
 * - Sensitive tokens and document URLs are NEVER logged
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { del } from '@vercel/blob';
import { verifyStaffAuth } from './_auth';

const CANONICAL_PATH_REGEX = /^students\/[A-Za-z0-9_-]+\/documents\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
) {
  const sendJson = (status: number, data: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return sendJson(405, { error: 'Method Not Allowed. Use POST or DELETE to remove documents.' });
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

  // Parse body if not already parsed
  let body: { pathname?: string } = {};
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else {
      const rawBody = await new Promise<string>((resolve, reject) => {
        let acc = '';
        req.on('data', chunk => (acc += chunk));
        req.on('end', () => resolve(acc));
        req.on('error', reject);
      });
      body = JSON.parse(rawBody || '{}');
    }
  } catch {
    return sendJson(400, { error: 'Invalid JSON request body.' });
  }

  let pathname = body.pathname;
  if (!pathname) {
    return sendJson(400, { error: 'Missing required field: pathname' });
  }

  // Sanitize and validate pathname
  if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
    try {
      const urlObj = new URL(pathname);
      pathname = urlObj.pathname.replace(/^\//, '');
    } catch {
      return sendJson(400, { error: 'Invalid document URL provided.' });
    }
  }

  if (pathname.includes('..') || pathname.includes('\0') || !CANONICAL_PATH_REGEX.test(pathname)) {
    return sendJson(400, {
      error: 'Invalid document path format. Must match canonical student document structure.',
    });
  }

  // Verify staff authorization (Header-only Bearer token; Admin Office only)
  const authResult = await verifyStaffAuth(req, 'manage');
  if (!authResult.valid) {
    return sendJson(authResult.status, { error: authResult.error });
  }

  try {
    await del(pathname, {
      token: blobToken,
    });

    const sanitizedPath = pathname.replace(/^students\/([^/]+)\/documents\/([^/]+)\/.*$/, 'students/$1/documents/$2/[FILE]');
    console.info(`[HanuJai Storage] Private document deleted successfully: ${sanitizedPath}`);

    return sendJson(200, {
      success: true,
      message: 'Document successfully removed from private cloud storage.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Deletion failed.';
    console.error('[HanuJai Storage] Deletion error:', message);
    return sendJson(500, { error: `Failed to delete document from storage: ${message}` });
  }
}
