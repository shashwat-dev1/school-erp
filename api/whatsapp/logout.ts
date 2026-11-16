/**
 * HanuJai High School ERP — WhatsApp Worker Logout Endpoint
 * Endpoint: POST /api/whatsapp/logout
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Developer-only privileged endpoint: Unlinks WhatsApp session and clears credentials.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { verifyStaffAuth } from '../documents/_auth';

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

