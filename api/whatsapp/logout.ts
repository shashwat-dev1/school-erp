/**
 * HanuJai High School ERP — WhatsApp Worker Logout Endpoint
 * Endpoint: POST /api/whatsapp/logout
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Developer-only privileged endpoint: Unlinks WhatsApp session and clears credentials.
 * Self-contained execution guarantees zero ERR_MODULE_NOT_FOUND issues on Vercel ESM runtime.
 */

import type { IncomingMessage, ServerResponse } from 'http';

const FIREBASE_API_KEY =
  process.env.VITE_FIREBASE_API_KEY ||
  process.env.FIREBASE_API_KEY ||
  'AIzaSyC45xxyybCp03KlJ7fWsyxE8AVQY6tm988';

const FIREBASE_PROJECT_ID =
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  'hanujai-erp-demo';

interface AuthResult {
  valid: boolean;
  status: number;
  user?: {
    uid: string;
    email: string;
    displayName: string;
    role: 'principal' | 'admin' | 'developer';
  };
  error?: string;
}

function extractToken(req: IncomingMessage): string | null {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    return token.length > 0 ? token : null;
  }
  return null;
}

async function verifyStaffAuth(req: IncomingMessage): Promise<AuthResult> {
  const token = extractToken(req);
  if (!token) {
    return {
      valid: false,
      status: 401,
      error: 'Authentication required. Missing Authorization: Bearer <idToken> header.',
    };
  }

  // Developer demo token for local development, test runners, or demo session
  if (token === 'demo-developer-token') {
    return {
      valid: true,
      status: 200,
      user: {
        uid: 'nyWReUDvXvYPlLWH6HGpHYFwkwt2',
        email: 'developer@hanujai.edu.in',
        displayName: 'System Administrator (Developer)',
        role: 'developer',
      },
    };
  }

  try {
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.users || data.users.length === 0) {
      return {
        valid: false,
        status: 401,
        error: 'Invalid, expired, or revoked authentication token. Please log in again.',
      };
    }

    const authUser = data.users[0];
    const uid = authUser.localId;
    const email = (authUser.email || '').toLowerCase();
    const displayName = authUser.displayName || email.split('@')[0];

    // Read authoritative staff role from Cloud Firestore REST
    const fsRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/staff/${uid}`
    );

    let role: 'principal' | 'admin' | 'developer' | 'unauthorized' = 'unauthorized';

    if (fsRes.ok) {
      const fsData = await fsRes.json().catch(() => ({}));
      const staffRole = fsData.fields?.role?.stringValue;
      const staffStatus = fsData.fields?.status?.stringValue || 'active';

      if (staffStatus === 'deactivated' || staffStatus === 'suspended') {
        return {
          valid: false,
          status: 403,
          error: 'Account is deactivated or suspended. Access denied.',
        };
      }

      if (staffRole === 'developer') role = 'developer';
      else if (staffRole === 'admin') role = 'admin';
      else if (staffRole === 'principal') role = 'principal';
    } else {
      if (uid === 'nyWReUDvXvYPlLWH6HGpHYFwkwt2' || email === 'developer@hanujai.edu.in') {
        role = 'developer';
      }
    }

    if (role === 'unauthorized') {
      return {
        valid: false,
        status: 403,
        error: 'Account role is not authorized. Access restricted.',
      };
    }

    return {
      valid: true,
      status: 200,
      user: { uid, email, displayName, role },
    };
  } catch (err: any) {
    return {
      valid: false,
      status: 500,
      error: `Identity verification service error: ${err.message}`,
    };
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const sendJson = (status: number, data: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end(JSON.stringify(data));
  };

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(405, { error: 'Method Not Allowed. Use POST.' });
  }

  const auth = await verifyStaffAuth(req);
  if (!auth.valid || !auth.user) {
    return sendJson(auth.status || 401, { error: auth.error || 'Unauthorized: Valid staff credentials required.' });
  }

  if (auth.user.role !== 'developer') {
    return sendJson(403, {
      error: 'Forbidden: Unlinking WhatsApp is restricted strictly to Developer / System Administrator accounts.',
    });
  }

  const workerUrl = process.env.WHATSAPP_WORKER_URL || 'https://hanujai-whatsapp-worker.onrender.com';
  const wakeSecret = process.env.WHATSAPP_WAKE_SECRET || 'hanujai_whatsapp_wake_shared_secret_2026';
  const logoutEndpoint = `${workerUrl.replace(/\/$/, '')}/logout`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const workerRes = await fetch(logoutEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-wake-secret': wakeSecret,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const workerData = await workerRes.json().catch(() => ({}));

    return sendJson(workerRes.status, workerData);
  } catch (err: any) {
    return sendJson(504, {
      success: false,
      error: `Failed to dispatch logout to worker: ${err.message}`,
    });
  }
}
