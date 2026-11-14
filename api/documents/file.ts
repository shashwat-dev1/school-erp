/**
 * HanuJai High School ERP — Authenticated Private Document Delivery Endpoint
 * Endpoint: GET /api/documents/file
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Implements secure private streaming from Vercel Private Blob:
 * 1. Authenticates staff credentials (Principal & Admin Office authorized for viewing).
 * 2. Validates and sanitizes storage path.
 * 3. Fetches private blob using @vercel/blob's `get(pathname, { access: 'private' })`.
 * 4. Streams response with anti-sniffing, private cache-control, and inline/attachment disposition.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import { get } from '@vercel/blob';
import { verifyStaffAuth } from './_auth';

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
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

  // Sanitize and validate pathname
  // If a full Vercel Blob URL was passed, extract the pathname
  if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
    try {
      const urlObj = new URL(pathname);
      pathname = urlObj.pathname.replace(/^\//, '');
    } catch {
      return sendJson(400, { error: 'Invalid document URL provided.' });
    }
  }

  // Prevent path traversal
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

  // Verify staff authentication (view permission: Principal & Admin Office authorized)
  const authResult = await verifyStaffAuth(req, 'view');
  if (!authResult.valid) {
    return sendJson(authResult.status, { error: authResult.error });
  }

  try {
    const blobResult = await get(pathname, { access: 'private' });

    if (!blobResult) {
      return sendJson(404, { error: `Document file not found at path: ${pathname}` });
    }

    const contentType = blobResult.headers.get('content-type') || 'application/octet-stream';
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
      const blob = await blobResult.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());
      res.end(buffer);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve document.';
    console.error('[HanuJai Storage] Document get error:', error);
    return sendJson(500, { error: `Storage retrieval failed: ${message}` });
  }
}
