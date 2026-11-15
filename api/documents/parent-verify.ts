/**
 * HanuJai High School ERP — Dedicated Parent Invitation Verification Endpoint
 * Endpoint: POST /api/documents/parent-verify
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Security Architecture:
 * - Unauthenticated parent access via single-use / student-bound bearer tokens.
 * - Raw token is hashed with SHA-256 and verified server-side.
 * - Does not require OTP, password, or Firebase Auth login.
 * - Does not expose internal database IDs, raw token hashes, or unrequested data.
 * - Masks guardian phone numbers.
 * - Fails closed on revoked, expired, or invalid tokens.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import {
  extractParentToken,
  verifyParentInvitation,
  maskPhoneNumber,
} from './_parentAuth';
import { mintParentUploadSessionToken } from './_serviceAccountAuth';

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
    return sendJson(405, { error: 'Method Not Allowed. Use POST for invitation token verification.' });
  }

  // Parse body safely
  let body: any = {};
  try {
    if (req.body) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } else {
      const rawBody = await new Promise<string>((resolve, reject) => {
        let acc = '';
        req.on('data', chunk => (acc += chunk));
        req.on('end', () => resolve(acc));
        req.on('error', reject);
      });
      body = JSON.parse(rawBody || '{}');
    }
  } catch {
    return sendJson(400, { error: 'Invalid JSON request body.' });
  }

  const rawToken = extractParentToken(req, body);
  if (!rawToken) {
    return sendJson(400, {
      valid: false,
      error: 'Missing document upload invitation token. Please open the link sent by the school.',
    });
  }

  const result = await verifyParentInvitation(rawToken);
  if (!result.valid || !result.invitation) {
    return sendJson(result.status, {
      valid: false,
      error: result.error || 'Document upload link is invalid, expired, or revoked.',
    });
  }

  const inv = result.invitation;

  // Mint cryptographically signed, short-lived parent upload session token (upload capability)
  const { sessionToken, expiresAtIso } = mintParentUploadSessionToken(
    inv.tokenHash,
    inv.studentId,
    inv.requestedSlots,
    inv.expiresAt
  );

  // Issue verified session response (sanitized for parent web client)
  return sendJson(200, {
    valid: true,
    session: {
      tokenHash: inv.tokenHash,
      uploadSessionToken: sessionToken,
      studentId: inv.studentId,
      studentName: inv.studentName,
      admissionNumber: inv.admissionNumber,
      classLabel: inv.classLabel,
      guardianName: inv.guardianName,
      maskedPhone: maskPhoneNumber(inv.guardianPhone),
      requestedSlots: inv.requestedSlots,
      expiresAt: expiresAtIso,
    },
  });
}

