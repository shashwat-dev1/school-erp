/**
 * HanuJai High School ERP — Worker Status Check CLI
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Inspects local auth state, queries the active worker HTTP server,
 * and checks Firestore queue totals.
 * 
 * USAGE:
 *   npm run status (in whatsapp-worker)
 *   or: npm run whatsapp:status (from root)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { loadWorkerConfig } from './config.ts';
import { getWorkerDb } from './firebase.ts';
import { collection, getDocs } from 'firebase/firestore';

async function checkStatus() {
  const config = loadWorkerConfig();
  console.log('================================================================================');
  console.log('  HANUJAI HIGH SCHOOL ERP — WHATSAPP WORKER STATUS AUDIT');
  console.log('================================================================================');

  // 1. Local Auth Check
  const credsFile = path.resolve(config.authDir, 'creds.json');
  const hasCreds = fs.existsSync(credsFile);
  console.log(`📁 Auth Directory    : ${config.authDir}`);
  console.log(`🔑 Credentials File  : ${hasCreds ? '✓ EXISTS (.baileys_auth/creds.json)' : '❌ NOT FOUND (Requires QR scan)'}`);

  // 2. Active Worker HTTP Health Probe
  console.log(`\n🌐 Probing Active Worker HTTP Server (Port ${config.workerPort})...`);
  const workerStatus = await new Promise<any>((resolve) => {
    const req = http.get(`http://localhost:${config.workerPort}/status`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(null);
    });
  });

  if (workerStatus) {
    console.log(`✓ Worker Process     : ONLINE (PID Active, Uptime: ${workerStatus.uptimeSeconds}s)`);
    console.log(`✓ WhatsApp Socket    : ${workerStatus.baileys?.connected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}`);
    console.log(`✓ Linked JID         : ${workerStatus.baileys?.userJid || 'None'}`);
    console.log(`✓ Mode               : ${workerStatus.mode}`);
    console.log(`✓ Allowlist Count    : ${workerStatus.testAllowlistCount} configured`);
  } else {
    console.log(`⚠ Worker Process     : OFFLINE (No response on port ${config.workerPort})`);
    console.log(`  To start the worker, run: npm run whatsapp:worker`);
  }

  // 3. Firestore Queue Check
  console.log('\n📊 Auditing Cloud Firestore attendanceNotifications Queue...');
  try {
    const db = getWorkerDb(config);
    const snap = await getDocs(collection(db, 'attendanceNotifications'));
    let pending = 0, sent = 0, failed = 0, skipped = 0;
    snap.forEach(d => {
      const data = d.data();
      if (data.deliveryStatus === 'pending' || data.deliveryStatus === 'processing') pending++;
      else if (data.deliveryStatus === 'sent') sent++;
      else if (data.deliveryStatus === 'failed') failed++;
      else if (data.deliveryStatus === 'skipped') skipped++;
    });

    console.log(`| Status      | Count |`);
    console.log(`|-------------|-------|`);
    console.log(`| Pending     | ${pending.toString().padStart(5)} |`);
    console.log(`| Sent        | ${sent.toString().padStart(5)} |`);
    console.log(`| Failed      | ${failed.toString().padStart(5)} |`);
    console.log(`| Skipped     | ${skipped.toString().padStart(5)} |`);
    console.log(`| Total Jobs  | ${snap.size.toString().padStart(5)} |`);
  } catch (err: any) {
    console.warn(`  Could not query Firestore queue: ${err.message}`);
  }

  console.log('================================================================================\n');
  process.exit(0);
}

checkStatus().catch(err => {
  console.error('Status check error:', err);
  process.exit(1);
});
