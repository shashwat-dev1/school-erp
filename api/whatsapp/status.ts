/**
 * HanuJai High School ERP — WhatsApp Worker Status & Diagnostics Endpoint
 * Endpoint: GET /api/whatsapp/status
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Returns operational status, connection state, and queue depth.
 * Prioritizes live response from active Render worker, with graceful
 * fallback to Cloud Firestore whatsappWorkerStatus/current when worker is sleeping.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { verifyStaffAuth, getFirebaseConfig } from '../documents/_auth';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const sendJson = (status: number, data: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end(JSON.stringify(data));
  };

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    return sendJson(405, { error: 'Method Not Allowed. Use GET.' });
  }

  const auth = await verifyStaffAuth(req);
  if (!auth.valid || !auth.user) {
    return sendJson(auth.status || 401, { error: auth.error || 'Unauthorized: Valid staff credentials required.' });
  }

  const workerUrl = process.env.WHATSAPP_WORKER_URL || 'https://hanujai-whatsapp-worker.onrender.com';
  const statusEndpoint = `${workerUrl.replace(/\/$/, '')}/status`;

  // 1. Try querying active worker with 2.5s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const workerRes = await fetch(statusEndpoint, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (workerRes.ok) {
      const data = await workerRes.json();
      return sendJson(200, {
        source: 'live_worker',
        workerActive: true,
        ...data,
      });
    }
  } catch {
    // Worker is asleep or unreachable
  }

  // 2. Fallback: Read last known status from Firestore REST API
  const { projectId } = getFirebaseConfig();
  if (projectId) {
    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/whatsappWorkerStatus/current`;
      const fsRes = await fetch(firestoreUrl);
      if (fsRes.ok) {
        const doc = await fsRes.json();
        const fields = doc.fields || {};
        const parsed: Record<string, any> = {};

        for (const [k, v] of Object.entries<any>(fields)) {
          if (v.stringValue !== undefined) parsed[k] = v.stringValue;
          else if (v.booleanValue !== undefined) parsed[k] = v.booleanValue;
          else if (v.integerValue !== undefined) parsed[k] = parseInt(v.integerValue, 10);
          else if (v.nullValue !== undefined) parsed[k] = null;
        }

        return sendJson(200, {
          source: 'firestore_snapshot',
          workerActive: false,
          workerStatus: 'sleeping',
          message: 'Worker is currently asleep on Render Free tier. Send /api/whatsapp/wake to spin up.',
          baileys: {
            connected: false,
            isRegistered: Boolean(parsed.isRegistered),
            userJid: parsed.userJid || null,
            lastDisconnectReason: parsed.lastDisconnectReason || null,
          },
          metrics: {
            queueDepth: parsed.queueDepth || 0,
            totalProcessed: parsed.totalProcessed || 0,
            totalFailed: parsed.totalFailed || 0,
            totalSkipped: parsed.totalSkipped || 0,
            lastSuccessfulMessage: parsed.lastSuccessfulMessage || null,
            lastWakeUpTime: parsed.lastWakeUpTime || null,
          },
          lastHeartbeat: parsed.lastHeartbeat || null,
          serverTime: new Date().toISOString(),
        });
      }
    } catch {
      // Ignored
    }
  }

  // 3. Default fallback
  return sendJson(200, {
    source: 'offline_default',
    workerActive: false,
    workerStatus: 'sleeping',
    message: 'Worker is asleep on Render Free tier. Wakes on-demand when attendance is submitted.',
    baileys: {
      connected: false,
      isRegistered: false,
      userJid: null,
    },
    metrics: {
      queueDepth: 0,
    },
    serverTime: new Date().toISOString(),
  });
}

