/**
 * HanuJai High School ERP — Manual WhatsApp Message Test CLI
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Allows the school administrator to verify WhatsApp delivery
 * by dispatching a single controlled test alert to their own mobile phone.
 * 
 * USAGE:
 *   npm run test:send -- --to=919829012345 [--state=present|absent] [--student="Student Name"]
 *   or: npm run whatsapp:test -- --to=919829012345
 */

import { loadWorkerConfig } from './config.ts';
import { BaileysManager } from './baileysManager.ts';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  let lastKey: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx > 0) {
        const key = arg.substring(2, eqIdx).trim();
        const val = arg.substring(eqIdx + 1).trim();
        parsed[key] = val;
        lastKey = key;
      } else {
        const key = arg.substring(2).trim();
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          parsed[key] = args[i + 1];
          i++;
        } else {
          parsed[key] = 'true';
        }
        lastKey = key;
      }
    } else if (lastKey) {
      parsed[lastKey] = `${parsed[lastKey]} ${arg}`.trim();
    }
  }
  return parsed;
}

async function runTestSend() {
  const args = parseArgs();
  const config = loadWorkerConfig();

  const to = args.to || args.phone || config.testAllowlist[0];
  const state = (args.state || 'present').toLowerCase() as 'present' | 'absent';
  let student = args.student || '';

  // Intelligent parent & student lookup for demo testing
  let parent = args.parent || args.guardian;
  const toDigits = to ? to.replace(/\D/g, '') : '';

  const knownMap: Record<string, { parent: string; student: string }> = {
    '9009519718': { parent: 'Shashwat', student: 'Aarav Singhania' },
  };

  for (const [phone, item] of Object.entries(knownMap)) {
    if (toDigits.endsWith(phone)) {
      if (!parent) parent = item.parent;
      if (!student) student = item.student;
      break;
    }
  }

  if (!parent && student) {
    const lower = student.toLowerCase();
    if (lower.includes('aarav') || lower.includes('singhania')) parent = 'Shashwat';
  }

  student = student || 'Aarav Singhania';
  parent = parent || 'Parent/Guardian';
  const parentHindi = parent === 'Parent/Guardian' ? 'अभिभावक' : parent;

  console.log('================================================================================');
  console.log('  HANUJAI HIGH SCHOOL ERP — WHATSAPP MANUAL DISPATCH TEST');
  console.log('================================================================================');

  if (!to) {
    console.error('❌ Missing target recipient phone number!');
    console.error('Usage:');
    console.error('  npm run whatsapp:test -- --to=919009519718 [--state=present|absent] [--student="Aarav Singhania"] [--parent="Shashwat"]');
    console.error('Or set WHATSAPP_TEST_ALLOWLIST in .env.local\n');
    process.exit(1);
  }

  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const messageText = state === 'present'
    ? `Mr./Mrs. ${parent},\n\nThis is to inform you that ${student} has been marked PRESENT at HanuJai High School on ${todayStr}.\n\nIf you believe this record is incorrect, please contact the school.\n\nRegards,\nHanuJai High School\n\n---\n\nश्री/श्रीमती ${parentHindi},\n\nआपको सूचित किया जाता है कि आपकी संतान ${student} को दिनांक ${todayStr} को हनुजाई हाई स्कूल में उपस्थित (PRESENT) दर्ज किया गया है।\n\nयदि आपको लगता है कि उपस्थिति का यह रिकॉर्ड गलत है, तो कृपया विद्यालय से संपर्क करें।\n\n सादर,\nहनुजाई हाई स्कूल`
    : `Mr./Mrs. ${parent},\n\nThis is to inform you that ${student} has been marked ABSENT at HanuJai High School on ${todayStr}.\n\nIf you believe this record is incorrect, please contact the school.\n\nRegards,\nHanuJai High School\n\n---\n\nश्री/श्रीमती ${parentHindi},\n\nआपको सूचित किया जाता है कि आपकी संतान ${student} को दिनांक ${todayStr} को हनुजाई हाई स्कूल में अनुपस्थित (ABSENT) दर्ज किया गया है।\n\nयदि आपको लगता है कि उपस्थिति का यह रिकॉर्ड गलत है, तो कृपया विद्यालय से संपर्क करें।\n\n सादर,\nहनुजाई हाई स्कूल`;

  console.log(`📍 Recipient Mobile : ${to}`);
  console.log(`📍 Status Type      : ${state.toUpperCase()}`);
  console.log(`📍 Student Name     : ${student}`);
  console.log(`📍 Parent / Guardian: ${parent}`);
  console.log(`📍 Date             : ${todayStr}`);
  console.log(`📍 Live Sending     : ${config.sendEnabled ? '🟢 ENABLED' : '🔴 DISABLED (Dry-Run Preview)'}\n`);

  console.log('--- Message Text Preview ---');
  console.log(messageText);
  console.log('----------------------------\n');

  if (!config.sendEnabled) {
    console.log('ℹ️  WHATSAPP_SEND_ENABLED is currently "false" in configuration.');
    console.log('To send a real message to this phone number:');
    console.log('1. Set WHATSAPP_SEND_ENABLED=true in .env.local');
    console.log(`2. Add your phone number (${to.replace(/\D/g, '')}) to WHATSAPP_TEST_ALLOWLIST in .env.local`);
    console.log('3. Re-run this command.\n');
    return;
  }

  // Live dispatch
  console.log('Connecting to WhatsApp socket to dispatch test alert...');
  const baileys = new BaileysManager(config);
  await baileys.initialize();

  // Wait up to 15s for connection
  let attempts = 0;
  while (!baileys.isReady() && attempts < 30) {
    await new Promise(r => setTimeout(r, 500));
    attempts++;
  }

  if (!baileys.isReady()) {
    console.error('❌ Could not establish WhatsApp socket connection. Please check QR pairing with "npm run whatsapp:worker".');
    await baileys.shutdown();
    process.exit(1);
  }

  const result = await baileys.sendMessage(to, messageText);
  if (result.success) {
    console.log(`\n✅ TEST MESSAGE SUCCESSFULLY SENT to ${to}!`);
    console.log(`Message External ID: ${result.externalId}`);
    console.log('Check your WhatsApp mobile app to confirm receipt.\n');
  } else {
    console.error(`\n❌ Failed to dispatch message: ${result.error}\n`);
  }

  await baileys.shutdown();
}

runTestSend().catch(err => {
  console.error('Fatal error during test dispatch:', err);
  process.exit(1);
});
