/**
 * HanuJai High School ERP — Serverless Document API Authentication Helper
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Security Architecture:
 * - ID tokens are accepted ONLY via the standard HTTP Authorization header ('Bearer <idToken>').
 * - URL query parameter authentication is STRICTLY PROHIBITED to prevent token leakage in
 *   browser history, proxy logs, referrer headers, and server access logs.
 * - ID tokens are verified server-side against Google Identity Toolkit.
 * - Authoritative roles and account status are verified against Cloud Firestore ('staff/{uid}').
 * - Fail-closed: missing staff records, deactivated accounts, and unauthorized roles are rejected.
 * - No email-prefix or string fallback heuristics.
 * - Zero hardcoded test token bypasses in production code.
 * - Sensitive tokens and document URLs are NEVER logged.
 */

import type { IncomingMessage } from 'http';
import fs from 'fs';
import path from 'path';

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
 * Rejects any tokens passed via URL parameters or query strings.
 */
export function extractToken(req: IncomingMessage): string | null {
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
export function getFirebaseConfig(): { apiKey?: string; projectId?: string } {
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
 * Allowed roles:
 * - 'developer': Full access (upload, replace, delete, download, view).
 * - 'admin': Can upload, replace, and delete documents. Can view/download documents.
 * - 'principal': Can view and download documents (strictly read-only). CANNOT upload, replace, or delete.
 * - Teachers / Others: Completely denied (HTTP 403).
 *
 * Strict Security Rules:
 * - Reads authoritative document from `staff/{uid}`.
 * - Fails closed on missing or deactivated records.
 * - Zero email-string heuristic fallback.
 * - Zero test bypass tokens in production code.
 */
export async function verifyStaffAuth(
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

    if (!projectId) {
      console.error('[HanuJai Storage Auth] Firebase project ID is not configured.');
      return {
        valid: false,
        status: 500,
        error: 'Authentication configuration error: missing projectId.',
      };
    }

    // Query Cloud Firestore REST API for authoritative staff record at `staff/${uid}`
    const fsRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/staff/${uid}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!fsRes.ok) {
      if (fsRes.status === 404) {
        console.warn(`[HanuJai Storage Auth] Staff record not found at staff/${uid} for email ${email}`);
        return {
          valid: false,
          status: 403,
          error: 'Staff account record not found in authoritative school registry. Access denied.',
        };
      }

      console.warn(`[HanuJai Storage Auth] Firestore staff verification failed with HTTP ${fsRes.status}`);
      return {
        valid: false,
        status: 403,
        error: `Authoritative staff verification failed (HTTP ${fsRes.status}). Access denied.`,
      };
    }

    const fsData = await fsRes.json().catch(() => ({}));
    const staffRole = fsData.fields?.role?.stringValue;
    const staffStatus = fsData.fields?.status?.stringValue || 'active';

    // Enforce active status: deactivated or suspended accounts are rejected
    if (staffStatus === 'deactivated' || staffStatus === 'suspended') {
      return {
        valid: false,
        status: 403,
        error: 'Account is deactivated or suspended. Access to school documents is suspended.',
      };
    }

    // Resolve authoritative role
    let role: 'principal' | 'admin' | 'developer' | 'unauthorized' = 'unauthorized';
    if (staffRole === 'developer') {
      role = 'developer';
    } else if (staffRole === 'admin') {
      role = 'admin';
    } else if (staffRole === 'principal') {
      role = 'principal';
    }

    // Reject teacher or unauthorized accounts
    if (role === 'unauthorized') {
      return {
        valid: false,
        status: 403,
        error: 'Account role is not authorized for document operations. Teacher and unauthorized accounts are restricted.',
      };
    }

    // Role-based permission validation: Principal is strictly read-only
    if (requiredPermission === 'manage' && role === 'principal') {
      return {
        valid: false,
        status: 403,
        error: 'Permission Denied: Principal view is strictly read-only. Only Admin Office and Developer accounts can upload, replace, or delete student documents.',
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
