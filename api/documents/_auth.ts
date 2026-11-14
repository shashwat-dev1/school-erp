/**
 * HanuJai High School ERP — Serverless Document API Authentication Helper
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Security Architecture:
 * - ID tokens are accepted ONLY via the standard HTTP Authorization header ('Bearer <idToken>').
 * - URL query parameter authentication is STRICTLY PROHIBITED to prevent token leakage in
 *   browser history, proxy logs, referrer headers, and server access logs.
 * - ID tokens are verified server-side against Google Identity Toolkit.
 * - Authoritative roles and account status are verified against Cloud Firestore ('staffUsers').
 * - Sensitive tokens and document URLs are NEVER logged.
 */

import type { IncomingMessage } from 'http';

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
 * Validates staff authentication and evaluates authoritative Phase 1 role permissions.
 * Allowed roles:
 * - 'admin': Can upload, replace, and delete documents. Can view/download documents.
 * - 'principal': Can view and download documents (strictly read-only). CANNOT upload, replace, or delete.
 * - Teachers: Completely deactivated from document access.
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

  const apiKey =
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  try {
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey || ''}`;
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    const data = await response.json();

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

    // Query Cloud Firestore REST API for authoritative staff role and account status
    let role: 'principal' | 'admin' | 'developer' | 'unauthorized' = 'unauthorized';
    let status: 'active' | 'deactivated' = 'active';

    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    if (projectId) {
      try {
        const fsRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/staffUsers/${uid}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (fsRes.ok) {
          const fsData = await fsRes.json();
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

    // Role-based permission validation
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
    return {
      valid: false,
      status: 500,
      error: `Identity verification service error: ${message}`,
    };
  }
}
