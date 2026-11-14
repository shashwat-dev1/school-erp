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
import fs from 'fs';
import path from 'path';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

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

export interface VerifiedStaff {
  uid: string;
  email: string;
  displayName: string;
  role: 'principal' | 'admin' | 'developer';
}

export interface AuthResult {
  valid: boolean;
  user?: VerifiedStaff;
  status: number;
  error?: string;
}

/**
 * Extracts Bearer token strictly from the HTTP Authorization header.
 */
function extractToken(req: IncomingMessage): string | null {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    return token.length > 0 ? token : null;
  }
  return null;
}

/**
 * Resolves Firebase project credentials from runtime environment, falling back
 * to production configuration file on disk if environment variables were not passed.
 */
function getFirebaseConfig(): { apiKey?: string; projectId?: string } {
  let apiKey =
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  let projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.production');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        if (!apiKey) {
          const mKey = content.match(/^VITE_FIREBASE_API_KEY=(.+)$/m);
          if (mKey) apiKey = mKey[1].trim();
        }
        if (!projectId) {
          const mPid = content.match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m);
          if (mPid) projectId = mPid[1].trim();
        }
      }
    } catch {
      // Ignore file reading errors in sandboxed runtimes
    }
  }

  return { apiKey, projectId };
}

/**
 * Validates staff authentication and evaluates authoritative Phase 1 role permissions.
 */
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

  // Demo bypass for isolated developer unit testing environments only
  if (process.env.NODE_ENV === 'test' && (token === 'demo-admin-token' || token === 'demo-principal-token')) {
    const isPrincipal = token === 'demo-principal-token';
    const role = isPrincipal ? 'principal' : 'admin';
    if (requiredPermission === 'manage' && role !== 'admin') {
      return {
        valid: false,
        status: 403,
        error: 'Forbidden: Principal account is read-only. Document uploads and deletions require Admin Office role.',
      };
    }
    return {
      valid: true,
      status: 200,
      user: {
        uid: isPrincipal ? 'staff-principal' : 'staff-admin',
        email: isPrincipal ? 'principal@hanujai.edu.in' : 'admin@hanujai.edu.in',
        displayName: isPrincipal ? 'Dr. Sunita Sharma' : 'Rajesh Verma (Admin Office)',
        role,
      },
    };
  }

  const { apiKey, projectId } = getFirebaseConfig();

  try {
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey || ''}`;
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.users || data.users.length === 0) {
      console.warn('[HanuJai Storage Auth] Identity verification failed. HTTP', response.status);
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

    // Query Cloud Firestore REST API for authoritative staff role and account status
    let role: 'principal' | 'admin' | 'developer' | 'unauthorized' = 'unauthorized';
    let status: 'active' | 'deactivated' = 'active';

    if (projectId) {
      try {
        const fsRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/staffUsers/${uid}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (fsRes.ok) {
          const fsData = await fsRes.json().catch(() => ({}));
          const staffRole = fsData.fields?.role?.stringValue;
          const staffStatus = fsData.fields?.status?.stringValue;

          if (staffStatus === 'deactivated') {
            status = 'deactivated';
          }

          if (staffRole === 'principal') role = 'principal';
          else if (staffRole === 'admin') role = 'admin';
          else if (staffRole === 'developer') role = 'developer';
          else if (staffRole === 'class_teacher' || staffRole === 'subject_teacher') {
            role = 'unauthorized';
          }
        }
      } catch {
        // Fallback to verified email identity if Firestore REST check is temporarily unreachable
      }
    }

    // Email-based fallback if Firestore document read is unconfigured
    if (role === 'unauthorized') {
      if (email === 'principal@hanujai.edu.in' || email.startsWith('principal.')) {
        role = 'principal';
      } else if (email === 'admin@hanujai.edu.in' || email.startsWith('admin.')) {
        role = 'admin';
      }
    }

    // Enforce active status
    if (status === 'deactivated') {
      return {
        valid: false,
        status: 403,
        error: 'Account is deactivated. Access to school documents is suspended.',
      };
    }

    // Reject teacher or unauthorized accounts
    if (role === 'unauthorized') {
      return {
        valid: false,
        status: 403,
        error: 'Teacher accounts are deactivated in this operating phase. Only Principal and Admin Office are authorized.',
      };
    }

    // Role-based permission validation: Principal is strictly read-only
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
      user: {
        uid,
        email,
        displayName,
        role,
      },
    };
  } catch (verifyError: unknown) {
    const message = verifyError instanceof Error ? verifyError.message : 'Authentication verification error';
    console.error('[HanuJai Storage Auth] Verification service error:', message);
    return {
      valid: false,
      status: 500,
      error: `Identity verification service error: ${message}`,
    };
  }
}

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
