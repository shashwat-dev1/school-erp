/**
 * HanuJai High School ERP — Worker Status & Authenticated Control HTTP Server
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Endpoints:
 * - GET  /health   : Sanitized health check for monitors and keep-alive pings (200 OK)
 * - GET  /status   : Operational metrics and connection status
 * - POST /wake     : Authenticated wake-up endpoint invoked by ERP serverless function
 * - POST /pair     : Authenticated endpoint to generate 8-digit Baileys Pairing Code
 * - POST /logout   : Authenticated endpoint to unlink session and wipe credentials
 */

import * as http from 'http';
import type { WorkerConfig } from './config.ts';
import type { BaileysManager } from './baileysManager.ts';
import type { QueueProcessor } from './queueProcessor.ts';

function readJsonBody(req: http.IncomingMessage, maxBytes = 10240): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxBytes) {
        reject(new Error('Request payload exceeds maximum permitted size.'));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err: any) {
        reject(new Error(`Malformed JSON body: ${err.message}`));
      }
    });

    req.on('error', err => reject(err));
  });
}

function verifyAuthSecret(req: http.IncomingMessage, configSecret: string): boolean {
  if (!configSecret) return false;

  const headerSecret = req.headers['x-worker-wake-secret'] as string | undefined;
  if (headerSecret && headerSecret === configSecret) return true;

  const authHeader = req.headers['authorization'] as string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.substring(7).trim();
    if (bearer === configSecret) return true;
  }

  return false;
}

export function startStatusServer(
  config: WorkerConfig,
  baileys: BaileysManager,
  queue: QueueProcessor
): http.Server {
  const startTime = Date.now();

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method?.toUpperCase() || 'GET';

    // CORS headers for secure ERP and local inspection
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-worker-wake-secret, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 1. GET /health or GET /
    if ((url === '/health' || url === '/') && method === 'GET') {
      const baileysStatus = baileys.getStatus();
      const isHealthy = config.dryRun || baileysStatus.connected || baileysStatus.isRegistered;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            service: 'HanuJai High School WhatsApp Worker',
            status: isHealthy ? 'healthy' : 'awaiting_pairing',
            provider: config.provider,
            liveSendEnabled: config.sendEnabled,
            dryRun: config.dryRun,
            connected: baileysStatus.connected,
            isRegistered: baileysStatus.isRegistered,
            hasLease: baileysStatus.hasLease,
            workerId: baileysStatus.workerId,
            uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
      return;
    }

    // 2. GET /status
    if (url === '/status' && method === 'GET') {
      const baileysStatus = baileys.getStatus();
      const metrics = queue.getMetrics();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            service: 'HanuJai High School WhatsApp Worker',
            mode: config.sendEnabled ? 'LIVE DISPATCH' : 'DRY-RUN / TEST RESTRICTED',
            provider: config.provider,
            liveSendEnabled: config.sendEnabled,
            dryRun: config.dryRun,
            testAllowlistCount: config.testAllowlist.length,
            baileys: baileysStatus,
            metrics,
            uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
            serverTime: new Date().toISOString(),
          },
          null,
          2
        )
      );
      return;
    }

    // 3. POST /wake — Authenticated on-demand wake from ERP attendance submission
    if (url === '/wake' && (method === 'POST' || method === 'GET')) {
      const isAuthorized = verifyAuthSecret(req, config.wakeSecret);
      if (!isAuthorized) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing x-worker-wake-secret.' }));
        return;
      }

      console.log('[HTTP Server] Received authenticated /wake request from ERP.');
      queue.recordWakeUp();

      // Trigger immediate background batch queue cycle
      const queueCyclePromise = queue.processBatch();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'awake',
          workerId: baileys.getWorkerId(),
          timestamp: new Date().toISOString(),
          message: 'WhatsApp worker is awake. Queue processor cycle initiated.',
        })
      );

      // Await queue cycle in background
      queueCyclePromise.catch(err => console.error('[Wake] Queue cycle error:', err));
      return;
    }

    // 4. POST /pair — Authenticated pairing code generation for Developer Console
    if (url === '/pair' && method === 'POST') {
      const isAuthorized = verifyAuthSecret(req, config.wakeSecret);
      if (!isAuthorized) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing x-worker-wake-secret.' }));
        return;
      }

      try {
        const body = await readJsonBody(req);
        const phoneNumber = body.phoneNumber;
        if (!phoneNumber) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required field: phoneNumber (e.g. 919509489381).' }));
          return;
        }

        const pairingCode = await baileys.requestPairingCode(phoneNumber);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            pairingCode,
            phoneNumber: phoneNumber.replace(/\D/g, ''),
            expiresInSeconds: 120,
            instructions: [
              '1. Open WhatsApp on the target mobile device.',
              '2. Go to Settings > Linked Devices > Link a Device.',
              '3. Tap "Link with phone number instead" at the bottom of the screen.',
              '4. Enter the 8-digit pairing code shown above.',
            ],
          })
        );
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message || 'Pairing code generation failed.' }));
      }
      return;
    }

    // 5. POST /logout — Authenticated session unlink and credential wipe
    if (url === '/logout' && method === 'POST') {
      const isAuthorized = verifyAuthSecret(req, config.wakeSecret);
      if (!isAuthorized) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing x-worker-wake-secret.' }));
        return;
      }

      try {
        await baileys.logout();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            message: 'WhatsApp session unlinked and Firestore credentials wiped cleanly.',
          })
        );
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message || 'Logout failed.' }));
      }
      return;
    }

    // 6. Deprecated /qr endpoint
    if (url === '/qr') {
      res.writeHead(410, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'QR code pairing is deprecated. Use the 8-digit Pairing Code via Developer Console.',
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found. Available: /health, /status, /wake, /pair, /logout' }));
  });

  server.listen(config.workerPort, '0.0.0.0', () => {
    console.log(`[HTTP Server] Health & control server listening on port ${config.workerPort} (/health, /status, /wake, /pair, /logout)`);
  });

  return server;
}
