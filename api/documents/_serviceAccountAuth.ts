/**
 * HanuJai High School ERP — Google Cloud Service Account & Upload Session Auth Helper
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Security Architecture:
 * - Serverless identity for Cloud Firestore REST operations.
 * - Signs Google OAuth 2.0 JWTs (RS256) using Node.js native crypto (zero external npm dependencies).
 * - Exchanges JWT for short-lived Google Cloud access tokens with scope 'https://www.googleapis.com/auth/datastore'.
 * - Least-privilege IAM: Requires only 'roles/datastore.user' (Cloud Datastore User).
 * - Private keys and service account credentials remain strictly server-side in Vercel environment variables.
 * - Mints and verifies tamper-proof HMAC-SHA256 parent upload session tokens.
 * - Privacy preservation: Generates anonymized actor IDs (never exposes raw guardian phone numbers).
 */

import crypto from 'crypto';

interface ServiceAccountConfig {
  clientEmail: string;
  privateKey: string;
  projectId?: string;
}

let cachedAccessToken: string | null = null;
let cachedTokenExpiryMs = 0;

/**
 * Base64URL encoding helper.
 */
function base64url(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Safely extracts service account credentials from server environment.
 * Accepts either:
 * - FIREBASE_SERVICE_ACCOUNT_KEY (full JSON string)
 * - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */
export function getServiceAccountConfig(): ServiceAccountConfig | null {
  const jsonKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (jsonKey && jsonKey.trim()) {
    try {
      const parsed = JSON.parse(jsonKey);
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
          projectId: parsed.project_id,
        };
      }
    } catch {
      console.error('[HanuJai Service Auth] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON.');
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    // Correct escaped newlines in environment variable strings
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    return {
      clientEmail: clientEmail.trim(),
      privateKey: privateKey.trim(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    };
  }

  return null;
}

/**
 * Requests or returns cached Google OAuth 2.0 access token for Cloud Firestore.
 */
export async function getFirestoreServerAccessToken(): Promise<string | null> {
  // Return cached token if valid for at least another 60 seconds
  if (cachedAccessToken && cachedTokenExpiryMs > Date.now() + 60_000) {
    return cachedAccessToken;
  }

  // Check for explicit mock or staging access token
  if (process.env.FIREBASE_AUTH_ACCESS_TOKEN) {
    return process.env.FIREBASE_AUTH_ACCESS_TOKEN;
  }

  const config = getServiceAccountConfig();
  if (!config) {
    return null;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64url(
      JSON.stringify({
        iss: config.clientEmail,
        sub: config.clientEmail,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/datastore',
      })
    );

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(config.privateKey, 'base64url');
    const assertion = `${header}.${payload}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!tokenRes.ok) {
      console.error(
        '[HanuJai Service Auth] Google OAuth token exchange failed with HTTP',
        tokenRes.status
      );
      return null;
    }

    const tokenData = await tokenRes.json();
    if (tokenData.access_token) {
      cachedAccessToken = tokenData.access_token;
      cachedTokenExpiryMs = Date.now() + (tokenData.expires_in || 3600) * 1000;
      return cachedAccessToken;
    }

    return null;
  } catch (err) {
    console.error('[HanuJai Service Auth] Failed to generate Firestore access token:', err);
    return null;
  }
}

/**
 * Returns HTTP authorization headers for privileged server-side Firestore operations.
 */
export async function getFirestoreServerAuthHeaders(): Promise<Record<string, string>> {
  const token = await getFirestoreServerAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Resolves HMAC secret used for minting and verifying upload session tokens.
 */
function getSessionHmacSecret(): string {
  return (
    process.env.PARENT_SESSION_SECRET ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    'hanujai-default-internal-session-secret-key-salt'
  );
}

export interface ParentUploadSessionPayload {
  tokenHash: string;
  studentId: string;
  requestedSlots: string[];
  issuedAt: number;
  expiresAt: number;
  capability: 'parent_upload_only';
}

/**
 * Mints a cryptographically signed, short-lived parent upload session token (HMAC-SHA256).
 * Max lifetime: 60 minutes or invitation expiration, whichever is earlier.
 */
export function mintParentUploadSessionToken(
  tokenHash: string,
  studentId: string,
  requestedSlots: string[],
  invitationExpiresAtIso?: string
): { sessionToken: string; expiresAtIso: string } {
  const now = Date.now();
  const maxSessionDurationMs = 60 * 60 * 1000; // 60 minutes
  let expiryTimeMs = now + maxSessionDurationMs;

  if (invitationExpiresAtIso) {
    const invExpiryMs = new Date(invitationExpiresAtIso).getTime();
    if (!isNaN(invExpiryMs) && invExpiryMs < expiryTimeMs) {
      expiryTimeMs = invExpiryMs;
    }
  }

  const payload: ParentUploadSessionPayload = {
    tokenHash,
    studentId,
    requestedSlots,
    issuedAt: now,
    expiresAt: expiryTimeMs,
    capability: 'parent_upload_only',
  };

  const payloadB64 = base64url(JSON.stringify(payload));
  const hmac = crypto
    .createHmac('sha256', getSessionHmacSecret())
    .update(payloadB64)
    .digest('base64url');

  return {
    sessionToken: `${payloadB64}.${hmac}`,
    expiresAtIso: new Date(expiryTimeMs).toISOString(),
  };
}

/**
 * Verifies and parses a parent upload session token.
 * Validates HMAC signature, capability, and expiry.
 */
export function verifyParentUploadSessionToken(
  sessionTokenString: string
): { valid: boolean; payload?: ParentUploadSessionPayload; error?: string } {
  if (!sessionTokenString || !sessionTokenString.includes('.')) {
    return { valid: false, error: 'Invalid session token format.' };
  }

  const [payloadB64, providedHmac] = sessionTokenString.split('.');
  if (!payloadB64 || !providedHmac) {
    return { valid: false, error: 'Malformed session token parts.' };
  }

  const expectedHmac = crypto
    .createHmac('sha256', getSessionHmacSecret())
    .update(payloadB64)
    .digest('base64url');

  const providedBuf = Buffer.from(providedHmac);
  const expectedBuf = Buffer.from(expectedHmac);

  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { valid: false, error: 'Invalid session token signature.' };
  }

  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload: ParentUploadSessionPayload = JSON.parse(jsonStr);

    if (payload.capability !== 'parent_upload_only') {
      return { valid: false, error: 'Invalid token capability.' };
    }

    if (payload.expiresAt <= Date.now()) {
      return { valid: false, error: 'Upload session has expired. Please refresh the invitation link.' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Failed to decode session token payload.' };
  }
}

/**
 * Privacy preservation: Generates an internal pseudonymized parent actor reference.
 * Prevents leaking guardian phone numbers in document metadata or audit logs.
 */
export function getPrivacyPreservingParentActor(tokenHash: string): {
  actorId: string;
  actorName: string;
} {
  const shortId = tokenHash ? tokenHash.substring(0, 16) : 'unknown';
  return {
    actorId: `parent_invite_${shortId}`,
    actorName: 'Parent / Guardian',
  };
}

