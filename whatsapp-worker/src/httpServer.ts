/**
 * HanuJai High School ERP — Worker Status & Health Check HTTP Server
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 */

import * as http from 'http';
import type { WorkerConfig } from './config.ts';
import type { BaileysManager } from './baileysManager.ts';

export function startStatusServer(
  config: WorkerConfig,
  baileys: BaileysManager
): http.Server {
  const startTime = Date.now();

  const server = http.createServer((req, res) => {
    const url = req.url || '/';

    // CORS headers for local inspection
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url === '/health' || url === '/') {
      const baileysStatus = baileys.getStatus();
      const isHealthy = config.dryRun || baileysStatus.connected;

      res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            service: 'HanuJai High School WhatsApp Worker',
            status: isHealthy ? 'healthy' : 'degraded',
            provider: config.provider,
            liveSendEnabled: config.sendEnabled,
            dryRun: config.dryRun,
            connected: baileysStatus.connected,
            uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
      return;
    }

    if (url === '/status') {
      const baileysStatus = baileys.getStatus();
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
            testAllowlist: config.testAllowlist.map(s => `${s.slice(0, 3)}****${s.slice(-3)}`),
            baileys: baileysStatus,
            uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
            serverTime: new Date().toISOString(),
          },
          null,
          2
        )
      );
      return;
    }

    if (url === '/qr') {
      const baileysStatus = baileys.getStatus();
      const qrData = baileys.getQrData();
      if (baileysStatus.connected) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#10b981;text-align:center;padding:50px;"><h2>✅ WhatsApp Connected!</h2><p>Linked JID: ${baileysStatus.userJid}</p></body></html>`);
        return;
      }
      if (qrData.qrSvg) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="5"></head><body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;"><div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;text-align:center;"><h2 style="margin:0 0 8px;">Scan with WhatsApp</h2><p style="color:#94a3b8;font-size:14px;margin:0 0 16px;">Target Sender Phone: <strong style="color:#38bdf8;">+91 95094 89381</strong></p><div style="background:#fff;padding:16px;border-radius:12px;margin:0 auto 16px;width:260px;height:260px;">${qrData.qrSvg}</div><p style="color:#cbd5e1;font-size:12px;">Open WhatsApp on 9509489381 &gt; Linked Devices &gt; Link a Device</p></div></body></html>`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="3"></head><body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;text-align:center;padding:50px;"><h2>⏳ Generating QR Code...</h2><p>Please wait a moment...</p></body></html>`);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found. Available: /health, /status, /qr' }));
  });

  server.listen(config.workerPort, () => {
    console.log(`[HTTP Server] Health & status monitor listening on http://localhost:${config.workerPort}/health`);
  });

  return server;
}
