/**
 * HanuJai High School ERP — WhatsApp Worker Logout & Session Reset
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Safely removes stored session credentials from ./.baileys_auth/
 * so that a fresh QR code pairing session can be initiated.
 * 
 * USAGE:
 *   npm run logout (in whatsapp-worker)
 *   or: npm run whatsapp:logout (from root)
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadWorkerConfig } from './config.ts';

function resetSession() {
  const config = loadWorkerConfig();
  console.log('================================================================================');
  console.log('  HANUJAI HIGH SCHOOL ERP — WHATSAPP SESSION RESET');
  console.log('================================================================================');
  console.log(`Target Session Directory: ${config.authDir}\n`);

  if (!fs.existsSync(config.authDir)) {
    console.log('✓ Session directory does not exist. No credentials to remove.');
    return;
  }

  const files = fs.readdirSync(config.authDir);
  if (files.length === 0) {
    console.log('✓ Session directory is already empty.');
    return;
  }

  console.log(`Found ${files.length} session file(s). Removing credentials safely...`);
  for (const file of files) {
    const fullPath = path.resolve(config.authDir, file);
    try {
      fs.unlinkSync(fullPath);
    } catch (e: any) {
      console.warn(`Could not delete ${file}: ${e.message}`);
    }
  }

  console.log('\n✅ WhatsApp session credentials have been completely cleared.');
  console.log('On next worker start (npm run whatsapp:worker), a fresh QR code will be generated for scanning.');
  console.log('================================================================================\n');
}

resetSession();
