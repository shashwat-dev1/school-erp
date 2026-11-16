/**
 * HanuJai High School ERP — WhatsApp Worker Pairing Code Generation Endpoint
 * Endpoint: POST /api/whatsapp/pair
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Developer-only privileged endpoint: Requests an 8-digit Baileys Pairing Code
 * from the worker to link the school WhatsApp phone without QR scanning.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { verifyStaffAuth } from '../documents/_auth';

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err: any) {
        reject(new Error(`Invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', err => reject(err));
  });
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

  // 1. Authorize calling staff — Strictly Developer Only
  const auth = await verifyStaffAuth(req);
  if (!auth.valid || !auth.user) {
    return sendJson(auth.status || 401, { error: auth.error || 'Unauthorized: Valid staff credentials required.' });
  }

  if (auth.user.role !== 'developer') {
    return sendJson(403, {
      error: 'Forbidden: WhatsApp device pairing is restricted strictly to Developer / System Administrator accounts.',
    });
  }

  // 2. Read phone number
  let body: any;
  try {
    body = await readJsonBody(req);
  } catch (err: any) {
    return sendJson(400, { error: err.message });
  }

  const rawPhone = body.phoneNumber;
  if (!rawPhone) {
    return sendJson(400, { error: 'Missing required field: phoneNumber (e.g. 919509489381).' });
  }

  const workerUrl = process.env.WHATSAPP_WORKER_URL || 'https://hanujai-whatsapp-worker.onrender.com';
  const wakeSecret = process.env.WHATSAPP_WAKE_SECRET || 'hanujai_whatsapp_wake_shared_secret_2026';
  const pairEndpoint = `${workerUrl.replace(/\/$/, '')}/pair`;

  console.log(`[WhatsApp Pair API] Requesting pairing code from worker for ${rawPhone}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for socket handshake

    const workerRes = await fetch(pairEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-wake-secret': wakeSecret,
      },
      body: JSON.stringify({ phoneNumber: rawPhone }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const workerData = await workerRes.json().catch(() => ({}));

    if (!workerRes.ok) {
      return sendJson(workerRes.status, {
        success: false,
        error: workerData.error || 'Worker rejected pairing code request.',
      });
    }

    return sendJson(200, {
      success: true,
      pairingCode: workerData.pairingCode,
      phoneNumber: workerData.phoneNumber,
      expiresInSeconds: workerData.expiresInSeconds || 120,
      instructions: workerData.instructions || [
        '1. Open WhatsApp on the target mobile device.',
        '2. Go to Settings > Linked Devices > Link a Device.',
        '3. Tap "Link with phone number instead".',
        '4. Enter the 8-digit pairing code above.',
      ],
    });
  } catch (err: any) {
    console.error('[WhatsApp Pair API] Failed to reach worker:', err.message);
    return sendJson(504, {
      success: false,
      error: `Could not connect to WhatsApp worker at ${workerUrl}. If Render is asleep, call /api/whatsapp/wake first, wait ~30s, and retry. Error: ${err.message}`,
    });
  }
}

