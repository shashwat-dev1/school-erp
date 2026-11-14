/**
 * HanuJai High School ERP — Authenticated Private Document Deletion Endpoint
 * Endpoint: POST /api/documents/delete
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Implements secure deletion from Vercel Private Blob:
 * 1. Authenticates staff credentials (Admin Office only; Principal is strictly read-only).
 * 2. Validates and sanitizes storage path.
 * 3. Deletes private blob using @vercel/blob's `del(pathname)`.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { del } from '@vercel/blob';
import { verifyStaffAuth } from './_auth';

export default async function handler(
  req: IncomingMessage & { body?: any; query?: Record<string, string | string[]> },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
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
  if (!pathname && req.query && typeof req.query.pathname === 'string') {
    pathname = req.query.pathname;
  }

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

  if (pathname.includes('..') || pathname.includes('\0')) {
    return sendJson(400, { error: 'Invalid pathname traversal detected.' });
  }

  // Check BLOB_READ_WRITE_TOKEN
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[HanuJai Storage] Missing BLOB_READ_WRITE_TOKEN environment variable.');
    return sendJson(503, {
      error:
        'Vercel Private Blob store is not connected. Missing BLOB_READ_WRITE_TOKEN environment variable. ' +
        'Please follow VERCEL_BLOB_SETUP_GUIDE.md to link store "hanujai-student-documents" to your Vercel project.',
    });
  }

  // Verify staff authorization (Admin Office only)
  const authResult = await verifyStaffAuth(req, 'manage');
  if (!authResult.valid) {
    return sendJson(authResult.status, { error: authResult.error });
  }

  try {
    await del(pathname);
    return sendJson(200, {
      success: true,
      message: `Document at path "${pathname}" successfully deleted from Vercel Private Blob store.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Deletion failed.';
    console.error('[HanuJai Storage] Deletion error:', error);
    return sendJson(500, { error: `Failed to delete blob: ${message}` });
  }
}
