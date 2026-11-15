/**
 * HanuJai High School ERP — Dedicated Server-Side Parent Document Upload Endpoint
 * Endpoint: POST /api/documents/parent-upload
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Security Architecture:
 * - Unauthenticated parent access via single-use / student-bound bearer tokens.
 * - Raw token is validated and hashed with SHA-256 on EVERY upload request.
 * - Student ID and permitted document slots are strictly derived from the verified invitation.
 * - Cross-student upload is strictly rejected (path must match verified studentId).
 * - Only explicitly authorized document slots are accepted.
 * - Storage credentials (BLOB_READ_WRITE_TOKEN) remain strictly server-side.
 * - Writes authoritative document metadata with uploadedByRole: 'parent' (never synthetic admin).
 * - Supports immediate revocation and expiry.
 * - No OTP or secondary verification required.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getFirebaseConfig } from './_auth';
import {
  extractParentToken,
  verifyParentInvitation,
  verifyParentInvitationByHash,
  toFirestoreFields,
  type VerifiedParentInvitation,
} from './_parentAuth';
import {
  getFirestoreServerAuthHeaders,
  verifyParentUploadSessionToken,
  getPrivacyPreservingParentActor,
} from './_serviceAccountAuth';

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
    return sendJson(405, { error: 'Method Not Allowed. Use POST for parent document upload.' });
  }

  // Cross-account storage token check (Account B Blob Store Token)
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    console.error('[HanuJai Storage] BLOB_READ_WRITE_TOKEN is not configured on server.');
    return sendJson(503, {
      error: 'Vercel Private Blob store is not connected. Missing BLOB_READ_WRITE_TOKEN.',
    });
  }

  // Safe body extraction
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

  let verifiedInvitation: VerifiedParentInvitation | undefined;

  // Authorize client-token generation request using parent upload session token or invitation token
  if (body.type === 'blob.generate-client-token' || !body.type) {
    const rawToken = extractParentToken(req, body);
    if (!rawToken) {
      return sendJson(401, {
        error: 'Authentication required. Missing document upload invitation token or session token.',
      });
    }

    // 1. Check if token is a cryptographically signed upload session token
    if (rawToken.includes('.')) {
      const sessionResult = verifyParentUploadSessionToken(rawToken);
      if (!sessionResult.valid || !sessionResult.payload) {
        return sendJson(403, {
          error: sessionResult.error || 'Upload session token is invalid or expired. Please refresh the page.',
        });
      }

      // Re-verify against live Firestore invitation record to guarantee immediate revocation
      const authResult = await verifyParentInvitationByHash(sessionResult.payload.tokenHash);
      if (!authResult.valid || !authResult.invitation) {
        return sendJson(authResult.status, {
          error: authResult.error || 'Document upload link is invalid, expired, or revoked.',
        });
      }

      verifiedInvitation = authResult.invitation;
    } else {
      // 2. Fall back to raw invitation bearer token
      const authResult = await verifyParentInvitation(rawToken);
      if (!authResult.valid || !authResult.invitation) {
        return sendJson(authResult.status, {
          error: authResult.error || 'Document upload link is invalid, expired, or revoked.',
        });
      }

      verifiedInvitation = authResult.invitation;
    }
  }

  try {
    const jsonResponse = await handleUpload({
      token: blobToken,
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!verifiedInvitation) {
          throw new Error('Unauthorized: missing verified parent invitation.');
        }

        let payload: {
          token?: string;
          studentId?: string;
          documentType?: string;
          originalFileName?: string;
          contentType?: string;
          fileSize?: number;
        } = {};

        if (clientPayload) {
          try {
            payload = JSON.parse(clientPayload);
          } catch {
            // Ignore parse errors on optional payload
          }
        }

        const documentType = (payload.documentType || '').trim();
        if (!documentType || !ALLOWED_DOCUMENT_SLOTS.has(documentType)) {
          throw new Error(
            `Invalid document slot "${documentType}". Must be one of the official HanuJai ERP document categories.`
          );
        }

        // STRICT INVITATION SCOPE ENFORCEMENT:
        // Document slot MUST be one of the permitted slots in the verified invitation
        const permittedSlots = new Set(verifiedInvitation.requestedSlots);
        if (!permittedSlots.has(documentType)) {
          throw new Error(
            `Unauthorized: Document category "${documentType}" is not permitted for this upload link.`
          );
        }

        // STRICT CROSS-STUDENT ACCESS PREVENTION:
        // Target student ID is strictly bound to the verified invitation student ID
        const verifiedStudentId = verifiedInvitation.studentId;
        const canonicalPrefix = `students/${verifiedStudentId}/documents/${documentType}/`;
        if (!pathname.startsWith(canonicalPrefix)) {
          throw new Error(`Unauthorized upload path. Must start strictly with ${canonicalPrefix}`);
        }

        const isPhoto = documentType === 'student_photo';
        const allowedTypes = isPhoto ? PHOTO_CONTENT_TYPES : ALLOWED_CONTENT_TYPES;
        const maximumSizeInBytes = isPhoto ? MAX_PHOTO_SIZE : MAX_DOCUMENT_SIZE;

        return {
          allowedContentTypes: allowedTypes,
          maximumSizeInBytes,
          tokenPayload: JSON.stringify({
            isParentUpload: true,
            studentId: verifiedStudentId,
            documentType,
            guardianPhone: verifiedInvitation.guardianPhone,
            guardianName: verifiedInvitation.guardianName,
            tokenHash: verifiedInvitation.tokenHash,
            originalFileName: payload.originalFileName || `${documentType}.pdf`,
            fileSize: payload.fileSize || 0,
            contentType: payload.contentType || 'application/octet-stream',
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let payload: any = {};
        if (tokenPayload) {
          try {
            payload = JSON.parse(tokenPayload);
          } catch {
            // Ignore
          }
        }

        const studentId = payload.studentId;
        const documentType = payload.documentType;
        const tokenHash = payload.tokenHash || '';
        const originalFileName = payload.originalFileName || blob.pathname.split('/').pop() || `${documentType}.pdf`;
        const nowIso = new Date().toISOString();

        const { projectId, apiKey } = getFirebaseConfig();
        const { actorId, actorName } = getPrivacyPreservingParentActor(tokenHash);

        if (projectId && studentId && documentType) {
          try {
            const authHeaders = await getFirestoreServerAuthHeaders();

            // 1. Write authoritative document metadata record to Firestore
            // Privacy: Uses pseudonymized parent reference; does NOT record phone numbers in document records
            const docRecord = {
              id: `${studentId}_${documentType}`,
              studentId,
              documentType,
              originalFileName,
              fileSize: payload.fileSize || 0,
              contentType: blob.contentType || payload.contentType || 'application/octet-stream',
              storagePath: blob.pathname,
              storageUrl: blob.url,
              status: 'pending_verification',
              reviewStatus: 'pending',
              uploadedAt: nowIso,
              uploadedBy: actorId,
              uploadedByName: actorName,
              uploadedByRole: 'parent',
              version: 1,
              isPresent: true,
            };

            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/students/${studentId}/documents/${documentType}?key=${apiKey || ''}`;
            await fetch(firestoreUrl, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
              },
              body: JSON.stringify({ fields: toFirestoreFields(docRecord) }),
            });

            // 2. Append audit log event
            // Privacy: Uses privacy-preserving actor ID; phone details stay strictly in restricted invitation collection
            const auditEvent = {
              timestamp: nowIso,
              actorId,
              actorName,
              actorRole: 'parent',
              action: 'parent_document_uploaded',
              resource: 'student_documents',
              targetId: `${studentId}/${documentType}`,
              summary: `Parent uploaded ${documentType} for student ${studentId} (${originalFileName})`,
              details: {
                studentId,
                documentType,
                originalFileName,
                storagePath: blob.pathname,
                tokenHash: tokenHash ? tokenHash.substring(0, 16) : '',
              },
              clientIp: '127.0.0.1',
            };

            const auditUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/auditEvents?key=${apiKey || ''}`;
            await fetch(auditUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
              },
              body: JSON.stringify({ fields: toFirestoreFields(auditEvent) }),
            });
          } catch (writeErr) {
            console.error('[HanuJai Storage] Failed to write parent document metadata to Firestore:', writeErr);
          }
        }

        const sanitizedPath = blob.pathname.replace(/^students\/([^/]+)\/documents\/([^/]+)\/.*$/, 'students/$1/documents/$2/[FILE]');
        console.info(`[HanuJai Storage] Parent upload completed successfully: ${sanitizedPath}`);
      },
    });

    return sendJson(200, jsonResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Parent upload initialization failed.';
    console.error('[HanuJai Storage] parent handleUpload error:', message);
    return sendJson(400, { error: message });
  }
}
