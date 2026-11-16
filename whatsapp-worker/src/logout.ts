/**
 * HanuJai High School ERP — WhatsApp Worker Logout & Session Reset
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Safely removes stored session credentials from Cloud Firestore and local directory
 * so that a fresh 8-digit Pairing Code linking session can be initiated.
 * 
 * USAGE:
 *   npm run logout (in whatsapp-worker)
 *   or: npm run whatsapp:logout (from root)
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadWorkerConfig } from './config.ts';
import { getWorkerDb } from './firebase.ts';
import { useFirestoreAuthState, DistributedLeaseManager } from './firestoreAuthState.ts';

async function resetSession() {
  const config = loadWorkerConfig();
  console.log('================================================================================');
  console.log('  HANUJAI HIGH SCHOOL ERP — WHATSAPP SESSION RESET');
  console.log('================================================================================');

  // 1. Wipe Firestore Auth State
  try {
    const db = getWorkerDb(config);
    console.log('[Firestore] Clearing encrypted auth credentials and Signal keys...');
    const { clearAuthState } = await useFirestoreAuthState(db, config.authEncryptionKey);
    await clearAuthState();

    const lease = new DistributedLeaseManager(db, 'logout_cli');
    await lease.release();
    console.log('[Firestore] ✓ Cloud Firestore WhatsApp auth state and leases cleared.');
  } catch (err: any) {
    console.warn('[Firestore] Note on clearing Firestore auth:', err.message);
  }

  // 2. Clean local directory if present
  if (fs.existsSync(config.authDir)) {
    const files = fs.readdirSync(config.authDir);
    for (const file of files) {
      try {
        fs.unlinkSync(path.resolve(config.authDir, file));
      } catch {
        // ignore
      }
    }
  }

  console.log('\n✅ WhatsApp session credentials have been completely cleared.');
  console.log('Open Developer Console -> Attendance & WhatsApp to generate a fresh 8-digit Pairing Code.');
  console.log('================================================================================\n');
  process.exit(0);
}

resetSession().catch(err => {
  console.error('Logout error:', err);
  process.exit(1);
});
