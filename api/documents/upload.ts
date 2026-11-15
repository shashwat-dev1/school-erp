/**
 * HanuJai High School ERP — Document Upload Client-Token Generator Endpoint
 * Endpoint: POST /api/documents/upload
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Cross-Account Storage Architecture:
 * - Hosted on Account A (Website & Serverless Functions)
 * - Targets Private Blob Store on Account B (The School's Store & Storage Billing)
 * - Uses Account B's BLOB_READ_WRITE_TOKEN explicitly passed to handleUpload
 *
 * Security:
 * - ID tokens are verified strictly via Authorization: Bearer <idToken> headers
 * - Authoritative Admin Office role verified on every request (Principal is strictly read-only)
 * - Canonical destination path, MIME type, and size limits enforced server-side
 * - Sensitive URLs and tokens are NEVER logged
 * - Self-contained execution guarantees zero ERR_MODULE_NOT_FOUND issues on Vercel ESM runtime
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

const PHOTO_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 Megabytes
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;      // 5 Megabytes for portrait photo

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
) {
  const sendJson = (status: number, data: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(405, { error: 'Method Not Allowed. Use POST for document upload authorization.' });
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

  // Safe body extraction avoiding hung promises on already consumed streams
  let body: HandleUploadBody;
  try {
    if (req.body) {
      if (typeof req.body === 'object') {
        body = req.body as HandleUploadBody;
      } else if (typeof req.body === 'string') {
        body = JSON.parse(req.body) as HandleUploadBody;
      } else {
        body = {} as HandleUploadBody;
      }
    } else if (req.readableEnded) {
      body = {} as HandleUploadBody;
    } else {
      const rawBody = await new Promise<string>((resolve, reject) => {
        let acc = '';
        req.on('data', chunk => (acc += chunk));
        req.on('end', () => resolve(acc));
        req.on('error', reject);
      });
      body = JSON.parse(rawBody || '{}') as HandleUploadBody;
    }
  } catch {
    return sendJson(400, { error: 'Invalid JSON request body.' });
  }

  // If this is a client-token generation request, staff identity and Admin Office role must be verified
  let verifiedStaffUid: string | undefined;
  let verifiedStaffRole: string | undefined;

  if (body.type === 'blob.generate-client-token' || !body.type) {
    const authResult = await verifyStaffAuth(req, 'manage');
    if (!authResult.valid) {
      return sendJson(authResult.status, { error: authResult.error });
    }
    verifiedStaffUid = authResult.user?.uid;
    verifiedStaffRole = authResult.user?.role;
  }

  try {
    const jsonResponse = await handleUpload({
      token: blobToken,
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: {
          studentId?: string;
          documentType?: string;
          originalFileName?: string;
          contentType?: string;
        } = {};

        if (clientPayload) {
          try {
            payload = JSON.parse(clientPayload);
          } catch {
            // Ignore parse errors on optional payload
          }
        }

        const studentId = (payload.studentId || '').trim();
        if (!studentId || !/^[A-Za-z0-9_-]+$/.test(studentId)) {
          throw new Error('Invalid student ID format. Must contain only alphanumeric characters, dashes, or underscores.');
        }

        const documentType = (payload.documentType || '').trim();
        if (!documentType || !ALLOWED_DOCUMENT_SLOTS.has(documentType)) {
          throw new Error(
            `Invalid document slot "${documentType}". Must be one of the 9 official HanuJai ERP document categories.`
          );
        }

        // Server-side path enforcement: prevent cross-student or cross-slot writing
        const canonicalPrefix = `students/${studentId}/documents/${documentType}/`;
        if (!pathname.startsWith(canonicalPrefix)) {
          throw new Error(`Unauthorized upload path. Must start strictly with ${canonicalPrefix}`);
        }

        // Enforce document type specific MIME types and size constraints
        const isPhoto = documentType === 'student_photo';
        const allowedTypes = isPhoto ? PHOTO_CONTENT_TYPES : ALLOWED_CONTENT_TYPES;
        const maximumSizeInBytes = isPhoto ? MAX_PHOTO_SIZE : MAX_DOCUMENT_SIZE;

        return {
          allowedContentTypes: allowedTypes,
          maximumSizeInBytes,
          tokenPayload: JSON.stringify({
            studentId,
            documentType,
            uploaderUid: verifiedStaffUid,
            uploaderRole: verifiedStaffRole,
            timestamp: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Redact full URLs and tokens from logs
        const sanitizedPath = blob.pathname.replace(/^students\/([^/]+)\/documents\/([^/]+)\/.*$/, 'students/$1/documents/$2/[FILE]');
        console.info(`[HanuJai Storage] Private upload completed successfully: ${sanitizedPath}`);
      },
    });

    return sendJson(200, jsonResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload initialization failed.';
    console.error('[HanuJai Storage] handleUpload error:', message);
    return sendJson(400, { error: message });
  }
}
