/**
 * HanuJai High School ERP — Document Upload Client-Token Generator Endpoint
 * Endpoint: POST /api/documents/upload
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Implements Vercel Blob's handleUpload pattern:
 * 1. Authenticates staff credentials (Admin Office only; Principal is strictly read-only).
 * 2. Enforces 10MB size limits and allowed MIME types (JPEG, PNG, WebP, PDF).
 * 3. Enforces 9 approved student document slot categories.
 * 4. Generates a signed client upload token allowing direct streaming to Vercel Private Blob.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { verifyStaffAuth } from './_auth';

const ALLOWED_DOCUMENT_SLOTS = new Set([
  'student_aadhaar_front',
  'student_aadhaar_back',
  'birth_certificate',
  'transfer_certificate',
  'student_photo',
  'father_aadhaar_front',
  'father_aadhaar_back',
  'mother_aadhaar_front',
  'mother_aadhaar_back',
]);

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Megabytes

export default async function handler(
  req: IncomingMessage & { body?: any; query?: Record<string, string | string[]> },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  // Helper for JSON response in Node environment
  const sendJson = (status: number, data: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(405, { error: 'Method Not Allowed. Use POST for document upload token generation.' });
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

  // Parse body if not already parsed
  let body: HandleUploadBody;
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body as HandleUploadBody;
    } else {
      const rawBody = await new Promise<string>((resolve, reject) => {
        let acc = '';
        req.on('data', chunk => (acc += chunk));
        req.on('end', () => resolve(acc));
        req.on('error', reject);
      });
      body = JSON.parse(rawBody || '{}') as HandleUploadBody;
    }
  } catch (parseErr) {
    return sendJson(400, { error: 'Invalid JSON request body.' });
  }

  // Verify staff authentication and management permission (Admin Office only)
  const authResult = await verifyStaffAuth(req, 'manage');
  if (!authResult.valid) {
    return sendJson(authResult.status, { error: authResult.error });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: { studentId?: string; documentType?: string; originalFileName?: string } = {};
        if (clientPayload) {
          try {
            payload = JSON.parse(clientPayload);
          } catch {
            // Treat as raw string
          }
        }

        const documentType = payload.documentType;
        if (documentType && !ALLOWED_DOCUMENT_SLOTS.has(documentType)) {
          throw new Error(
            `Invalid document slot "${documentType}". Must be one of the 9 official HanuJai ERP document categories.`
          );
        }

        // Return token parameters for client upload
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({
            studentId: payload.studentId || 'unknown',
            documentType: documentType || 'document',
            uploaderId: authResult.user?.uid,
            uploaderRole: authResult.user?.role,
            timestamp: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.info(
          `[HanuJai ERP] Private blob uploaded: ${blob.pathname} (${blob.contentType}) tokenPayload: ${tokenPayload}`
        );
      },
    });

    return sendJson(200, jsonResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload initialization failed.';
    console.error('[HanuJai Storage] handleUpload error:', error);
    return sendJson(400, { error: message });
  }
}
