/**
 * HanuJai High School ERP — WhatsApp Worker On-Demand Wake Endpoint
 * Endpoint: POST /api/whatsapp/wake (also accepts GET)
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Invoked immediately after attendance jobs are committed to Cloud Firestore.
 * Dispatches an authenticated wake-up request to the Render Free Web Service
 * using the server-side WHATSAPP_WAKE_SECRET.
 * 
 * Security:
 * - Shared secret is NEVER exposed to the frontend or browser.
 * - Non-blocking: If Render is cold-starting, returns status 'waking' without blocking attendance.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { verifyStaffAuth } from '../documents/_auth';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const sendJson = (status: number, data: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end(JSON.stringify(data));
  };

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 1. Authorize calling staff (Principal, Admin Office, or Developer)
  const auth = await verifyStaffAuth(req);
  if (!auth.valid || !auth.user) {
    return sendJson(auth.status || 401, { error: auth.error || 'Unauthorized: Valid staff credentials required.' });
  }

  // 2. Resolve worker URL and shared wake secret
  const workerUrl = process.env.WHATSAPP_WORKER_URL || 'https://hanujai-whatsapp-worker.onrender.com';
  const wakeSecret = process.env.WHATSAPP_WAKE_SECRET || 'hanujai_whatsapp_wake_shared_secret_2026';

  const wakeEndpoint = `${workerUrl.replace(/\/$/, '')}/wake`;

  console.log(`[WhatsApp Wake API] Dispatching wake request to Render worker: ${wakeEndpoint}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s bounded timeout

    const wakeRes = await fetch(wakeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-wake-secret': wakeSecret,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (wakeRes.ok) {
      const data = await wakeRes.json().catch(() => ({}));
      return sendJson(200, {
        success: true,
        status: 'awake',
        message: 'WhatsApp worker confirmed awake and processing queue.',
        workerDetails: data,
      });
    } else {
      return sendJson(200, {
        success: true,
        status: 'waking',
        message: `Wake request reached worker (HTTP ${wakeRes.status}). Worker is starting.`,
      });
    }
  } catch (err: any) {
    // If request timed out or network pending, Render container is cold-starting
    console.log(`[WhatsApp Wake API] Worker wake dispatched (cold-starting): ${err.message}`);
    return sendJson(200, {
      success: true,
      status: 'waking',
      message: 'Wake request dispatched. Render Free Web Service is cold-starting (~30-60s). Queue is durable in Firestore.',
    });
  }
}
