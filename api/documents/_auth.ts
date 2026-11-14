/**
 * HanuJai High School ERP — Serverless Document API Authentication Helper
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Verifies Firebase Auth ID tokens without requiring Firebase Admin private keys
 * by calling Google Identity Toolkit's official REST endpoint.
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
 * Extracts Bearer token from HTTP request Authorization header or query parameter
 */
export function extractToken(req: IncomingMessage & { query?: Record<string, string | string[]> }): string | null {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Fallback to query parameter (e.g. for direct file streaming in <img> or <iframe>)
  if (req.query && typeof req.query.token === 'string') {
    return req.query.token.trim();
  }

  // In Node IncomingMessage url parsing fallback
  if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const tokenParam = parsedUrl.searchParams.get('token');
      if (tokenParam) return tokenParam.trim();
    } catch {
      // Ignore URL parse failure
    }
  }

  return null;
}

/**
 * Validates staff authentication and evaluates Phase 1 role permissions.
 * Allowed roles:
 * - 'admin': Can upload, replace, and delete documents. Can view/download documents.
 * - 'principal': Can view and download documents (strictly read-only). Cannot upload or delete.
 */
export async function verifyStaffAuth(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  requiredPermission: 'view' | 'manage' = 'view'
): Promise<AuthResult> {
  const token = extractToken(req);

  if (!token) {
    return {
      valid: false,
      status: 401,
      error: 'Authentication required. Missing Authorization Bearer token or token parameter.',
    };
  }

  // Demo bypass for local developer testing if explicitly authorized
  if (process.env.NODE_ENV !== 'production' && (token === 'demo-admin-token' || token === 'demo-principal-token')) {
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

  if (!apiKey) {
    console.warn('[HanuJai Auth] Missing VITE_FIREBASE_API_KEY on server. Checking token format...');
  }

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
        error: 'Invalid, expired or revoked authentication token. Please log in again.',
      };
    }

    const authUser = data.users[0];
    const email = (authUser.email || '').toLowerCase();
    const uid = authUser.localId;
    const displayName = authUser.displayName || email.split('@')[0];

    // Determine role from verified identity
    let role: 'principal' | 'admin' | 'developer' = 'admin';

    if (email.includes('principal') || email === 'principal@hanujai.edu.in') {
      role = 'principal';
    } else if (email.includes('admin') || email === 'admin@hanujai.edu.in') {
      role = 'admin';
    } else {
      // Query Firestore REST API to check staff role
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

            if (staffStatus === 'deactivated' || staffRole === 'class_teacher' || staffRole === 'subject_teacher') {
              return {
                valid: false,
                status: 403,
                error: 'Teacher accounts are deactivated in this operating phase. Only Principal and Admin Office are authorized.',
              };
            }

            if (staffRole === 'principal') role = 'principal';
            else if (staffRole === 'admin') role = 'admin';
            else if (staffRole === 'developer') role = 'developer';
          }
        } catch (fsErr) {
          console.warn('[HanuJai Auth] Non-fatal Firestore role lookup error:', fsErr);
        }
      }
    }

    // Role-based access validation:
    // 'manage' requires admin or developer
    if (requiredPermission === 'manage' && role === 'principal') {
      return {
        valid: false,
        status: 403,
        error: 'Permission Denied: Principal view is strictly read-only. Only Admin Office accounts can upload or delete student documents.',
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
    const message = verifyError instanceof Error ? verifyError.message : 'Authentication verification failure';
    return {
      valid: false,
      status: 500,
      error: `Token verification service error: ${message}`,
    };
  }
}
