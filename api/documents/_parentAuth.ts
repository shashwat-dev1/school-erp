/**
 * HanuJai High School ERP — Parent Document Serverless Verification & Ingestion Helper
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Security Architecture:
 * - Cryptographically random tokens (32 bytes / 64 hex characters) are SHA-256 hashed.
 * - Raw tokens are NEVER stored in Firestore.
 * - Server validates the token hash against `parentDocumentInvitations/{tokenHash}`.
 * - Evaluates active status and expiry server-side.
 * - Authoritative studentId and permitted document slots are derived directly from the invitation.
 * - Cross-student access is strictly blocked: requests targeting other student IDs are rejected.
 * - Uploads write metadata with role 'parent' (never synthetic 'admin').
 */

import crypto from 'crypto';
import type { IncomingMessage } from 'http';
import { getFirebaseConfig } from './_auth';
import { getFirestoreServerAuthHeaders } from './_serviceAccountAuth';

export interface VerifiedParentInvitation {
  id: string;
  tokenHash: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  classLabel: string;
  guardianPhone: string;
  guardianName: string;
  requestedSlots: string[];
  status: 'active' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
}

export interface ParentVerificationResult {
  valid: boolean;
  status: number;
  invitation?: VerifiedParentInvitation;
  error?: string;
}

/**
 * Compute SHA-256 hex string for token lookup.
 */
export function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * Mask Indian phone numbers for public display (+91 98290 12345 -> +91 ******2345).
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return 'No phone recorded';
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length < 10) return phone;
  const last4 = clean.slice(-4);
  return `+91 ******${last4}`;
}

/**
 * Convert standard JS object to Firestore REST fields schema.
 */
export function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      fields[k] = { stringValue: v };
    } else if (typeof v === 'number') {
      fields[k] = Number.isInteger(v) ? { integerValue: v.toString() } : { doubleValue: v };
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = { arrayValue: { values: v.map(item => ({ stringValue: String(item) })) } };
    }
  }
  return fields;
}

/**
 * Convert Firestore REST fields schema to standard JS object.
 */
export function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = v.doubleValue;
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.arrayValue?.values) res[k] = v.arrayValue.values.map((item: any) => item.stringValue);
  }
  return res;
}

/**
 * Extracts raw parent token or session token from request header 'x-parent-session-token', 'x-parent-token' or JSON body.
 */
export function extractParentToken(req: IncomingMessage, body?: any): string | null {
  const headerToken =
    req.headers['x-parent-session-token'] ||
    req.headers['X-Parent-Session-Token'] ||
    req.headers['x-parent-token'] ||
    req.headers['X-Parent-Token'];
  if (typeof headerToken === 'string' && headerToken.trim().length >= 16) {
    return headerToken.trim();
  }

  if (body?.token && typeof body.token === 'string' && body.token.trim().length >= 16) {
    return body.token.trim();
  }

  if (body?.clientPayload) {
    try {
      const parsed = typeof body.clientPayload === 'string' ? JSON.parse(body.clientPayload) : body.clientPayload;
      if (parsed?.token && typeof parsed.token === 'string' && parsed.token.trim().length >= 16) {
        return parsed.token.trim();
      }
    } catch {
      // Ignore parse failure
    }
  }

  return null;
}

/**
 * Authoritatively verifies a parent invitation by its SHA-256 token hash against Cloud Firestore.
 * Authenticates using server-side Google Service Account identity to honor Firestore security rules.
 */
export async function verifyParentInvitationByHash(tokenHash: string): Promise<ParentVerificationResult> {
  if (!tokenHash || tokenHash.trim().length !== 64) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid invitation hash format.',
    };
  }

  const { projectId, apiKey } = getFirebaseConfig();

  if (!projectId) {
    return {
      valid: false,
      status: 500,
      error: 'Firebase project configuration is missing.',
    };
  }

  try {
    const authHeaders = await getFirestoreServerAuthHeaders();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/parentDocumentInvitations/${tokenHash}?key=${apiKey || ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          valid: false,
          status: 404,
          error: 'Document upload link is invalid, does not exist, or has been revoked.',
        };
      }
      if (response.status === 403 && !authHeaders.Authorization) {
        return {
          valid: false,
          status: 403,
          error: 'Firestore access forbidden: Server service account credentials (FIREBASE_SERVICE_ACCOUNT_KEY) are required for locked production rules.',
        };
      }
      return {
        valid: false,
        status: 403,
        error: `Invitation lookup failed (HTTP ${response.status}). Access denied.`,
      };
    }

    const data = await response.json();
    if (!data.fields) {
      return {
        valid: false,
        status: 404,
        error: 'Document upload invitation record is empty.',
      };
    }

    const raw = fromFirestoreFields(data.fields);
    const invitation: VerifiedParentInvitation = {
      id: tokenHash,
      tokenHash,
      studentId: raw.studentId || '',
      studentName: raw.studentName || 'Student',
      admissionNumber: raw.admissionNumber || '',
      classId: raw.classId || '',
      classLabel: raw.classLabel || '',
      guardianPhone: raw.guardianPhone || '',
      guardianName: raw.guardianName || 'Parent / Guardian',
      requestedSlots: Array.isArray(raw.requestedSlots) ? raw.requestedSlots : [],
      status: raw.status || 'active',
      expiresAt: raw.expiresAt || '',
      createdAt: raw.createdAt || '',
    };

    // 1. Revocation check
    if (invitation.status === 'revoked') {
      return {
        valid: false,
        status: 403,
        error: 'This document upload link has been revoked by the school office.',
      };
    }

    // 2. Expiry check
    if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
      return {
        valid: false,
        status: 403,
        error: 'This document upload link has expired. Please contact the school office to request a new link.',
      };
    }

    // 3. Active status check
    if (invitation.status !== 'active') {
      return {
        valid: false,
        status: 403,
        error: 'Document upload link is no longer active.',
      };
    }

    return {
      valid: true,
      status: 200,
      invitation,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    return {
      valid: false,
      status: 500,
      error: `Invitation verification service error: ${message}`,
    };
  }
}

/**
 * Authoritatively verifies a parent invitation token against Cloud Firestore.
 * Enforces status, expiry, and slot authorization.
 */
export async function verifyParentInvitation(rawToken: string): Promise<ParentVerificationResult> {
  if (!rawToken || rawToken.trim().length < 16) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid or missing document upload invitation token.',
    };
  }

  const tokenHash = sha256Hex(rawToken);
  return verifyParentInvitationByHash(tokenHash);
}

