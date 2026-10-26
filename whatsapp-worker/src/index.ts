/**
 * HanuJai High School ERP — Dedicated Server-Side WhatsApp Worker
 * Campus: HanuJai High School, Vidyadhar Nagar, Jaipur, Rajasthan, India
 * 
 * EXECUTION ENVIRONMENT:
 * - Runs exclusively in a trusted, persistent Node.js background process.
 * - Connects to WhatsApp Web via Baileys socket.
 * - Stores session credentials in ./.baileys_auth/ (excluded by .gitignore).
 * - Polls Cloud Firestore attendanceNotifications queue and dispatches attendance alerts.
 * 
 * USAGE:
 *   npm start (inside whatsapp-worker)
 *   or: npm run whatsapp:worker (from project root)
 */

import { loadWorkerConfig } from './config.ts';
import { getWorkerDb } from './firebase.ts';
import { BaileysManager } from './baileysManager.ts';
import { QueueProcessor } from './queueProcessor.ts';
import { startStatusServer } from './httpServer.ts';

async function main() {
  const config = loadWorkerConfig();

  console.log('================================================================================');
  console.log('  HANUJAI HIGH SCHOOL ERP — WHATSAPP DISPATCH WORKER');
  console.log('  Campus: HanuJai High School, Vidyadhar Nagar, Jaipur, Rajasthan, India');
  console.log('================================================================================');
  console.log(`📍 Provider Mode   : ${config.provider.toUpperCase()}`);
  console.log(`📍 Live Sending    : ${config.sendEnabled ? '🟢 ENABLED (REAL MESSAGES WILL BE SENT)' : '🔴 DISABLED (DRY-RUN / RESTRICTED TEST MODE)'}`);
  console.log(`📍 Dry-Run Mode    : ${config.dryRun ? 'TRUE (Previews only)' : 'FALSE'}`);
  console.log(`📍 Test Allowlist  : ${config.testAllowlist.length > 0 ? config.testAllowlist.join(', ') : 'None configured (All non-test numbers skipped)'}`);
  console.log(`📍 Auth Directory  : ${config.authDir}`);
  console.log(`📍 Health Endpoint : http://localhost:${config.workerPort}/health\n`);

  // 1. Initialize Firestore
  const db = getWorkerDb(config);
  console.log(`✓ Connected to Cloud Firestore (Project: ${config.firebase.projectId})`);

  // 2. Initialize Baileys Socket Manager
  const baileys = new BaileysManager(config);
  await baileys.initialize();

  // 3. Start Local Health/Status Monitor
  const server = startStatusServer(config, baileys);

  // 4. Start Queue Processor
  const queue = new QueueProcessor(db, config, baileys);
  queue.start(5000);

  // 5. Clean Shutdown Handling
  const handleExit = async (signal: string) => {
    console.log(`\n[Worker] Received ${signal}. Initiating clean shutdown...`);
    queue.stop();
    server.close();
    await baileys.shutdown();
    console.log('[Worker] Shutdown complete. Exiting cleanly.');
    process.exit(0);
  };

  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));
}

main().catch(err => {
  console.error('\n❌ Fatal WhatsApp Worker Error:', err);
  process.exit(1);
});
