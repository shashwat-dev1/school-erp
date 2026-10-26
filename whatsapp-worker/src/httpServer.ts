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

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found. Available: /health, /status' }));
  });

  server.listen(config.workerPort, () => {
    console.log(`[HTTP Server] Health & status monitor listening on http://localhost:${config.workerPort}/health`);
  });

  return server;
}
