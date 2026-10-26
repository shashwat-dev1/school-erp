/**
 * HanuJai High School ERP — Server-Side WhatsApp Worker (Baileys Integration)
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * EXECUTION ENVIRONMENT:
 * - Runs exclusively in a trusted, persistent Node.js background process (e.g., VPS, Docker, Railway, Render).
 * - NEVER runs in the browser, client bundle, or ephemeral serverless functions.
 * - Stores session credentials in ./.baileys_auth/ (strictly excluded by .gitignore).
 * 
 * USAGE:
 *   npm run whatsapp:worker
 */

import * as fs from 'fs';
import * as path from 'path';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  type Firestore,
} from 'firebase/firestore';

// 1. Load Local Environment
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf-8');
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    });
  }
  return env;
}

const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
};

const sendEnabled = (env.WHATSAPP_SEND_ENABLED || process.env.WHATSAPP_SEND_ENABLED) === 'true';
const allowlist = (env.WHATSAPP_TEST_ALLOWLIST || process.env.WHATSAPP_TEST_ALLOWLIST || '')
  .split(',')
  .map(s => s.trim().replace(/\D/g, ''))
  .filter(Boolean);

console.log('================================================================================');
console.log('  HANUJAI HIGH SCHOOL ERP — WHATSAPP NOTIFICATION DISPATCH WORKER');
console.log('  Campus: HanuJai High School, Vidyadhar Nagar, Jaipur, Rajasthan, India');
console.log('================================================================================');
console.log(`📍 Mode            : ${sendEnabled ? 'LIVE BROADCAST ENABLED' : 'DRY-RUN / RESTRICTED TEST MODE'}`);
console.log(`📍 Test Allowlist  : ${allowlist.length > 0 ? allowlist.join(', ') : 'None configured'}`);
console.log(`📍 Auth Directory  : ./.baileys_auth/ (Excluded from Git)\n`);

// Initialize Firestore
const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db: Firestore = initializeFirestore(fbApp, { ignoreUndefinedProperties: true });

let sock: WASocket | null = null;
let isConnected = false;

async function startBaileysWorker() {
  const authDir = path.resolve(process.cwd(), '.baileys_auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // Handle via qrcode-terminal explicitly
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📲 Scan this QR Code with the authorized HanuJai High School WhatsApp device:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.warn(`Connection closed due to: ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startBaileysWorker, 5000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      console.log('✅ HanuJai WhatsApp Dispatcher successfully connected to WhatsApp Web socket!');
      console.log('Polling Firestore queue for pending attendance notification jobs...\n');
    }
  });

  // Poll loop for pending jobs
  setInterval(async () => {
    if (!isConnected || !sock) return;

    try {
      const q = query(
        collection(db, 'attendanceNotifications'),
        where('deliveryStatus', '==', 'pending')
      );
      const snap = await getDocs(q);

      if (snap.empty) return;

      console.log(`Found ${snap.size} pending notification job(s) in queue...`);

      for (const d of snap.docs) {
        const job = d.data();
        const rawPhone = (job.recipientPhone || '').replace(/\D/g, '');

        if (!rawPhone || rawPhone.length < 10) {
          await updateDoc(doc(db, 'attendanceNotifications', d.id), {
            deliveryStatus: 'skipped',
            skipReason: 'missing_phone',
            error: 'Incomplete or missing parent phone number.',
          });
          continue;
        }

        // Check test allowlist
        if (!sendEnabled) {
          const isAllowed = allowlist.some(a => rawPhone.endsWith(a));
          if (!isAllowed) {
            console.log(`[Worker] Skipping ${job.studentName} (${rawPhone}) - Not in test allowlist and live send is disabled.`);
            await updateDoc(doc(db, 'attendanceNotifications', d.id), {
              deliveryStatus: 'skipped',
              skipReason: 'not_in_test_allowlist',
              error: 'Live send disabled and number is not in WHATSAPP_TEST_ALLOWLIST.',
            });
            continue;
          }
        }

        // Format JID
        const formattedJid = rawPhone.length === 10 ? `91${rawPhone}@s.whatsapp.net` : `${rawPhone}@s.whatsapp.net`;

        try {
          console.log(`[Worker] Sending attendance alert to ${job.studentName}'s parent (${formattedJid})...`);
          const sentMsg = await sock.sendMessage(formattedJid, { text: job.messageText });

          await updateDoc(doc(db, 'attendanceNotifications', d.id), {
            deliveryStatus: 'sent',
            externalId: sentMsg?.key?.id || `msg_${Date.now()}`,
            sentAt: new Date().toISOString(),
            provider: 'baileys',
          });

          console.log(`[Worker] ✓ Message delivered to ${formattedJid}`);
        } catch (sendErr: any) {
          console.error(`[Worker] ❌ Failed to dispatch to ${formattedJid}:`, sendErr.message);
          await updateDoc(doc(db, 'attendanceNotifications', d.id), {
            deliveryStatus: 'failed',
            error: sendErr.message || 'WhatsApp socket transmission failed.',
            retryCount: (job.retryCount || 0) + 1,
          });
        }
      }
    } catch (pollErr: any) {
      console.error('[Worker] Queue polling error:', pollErr.message);
    }
  }, 10000);
}

startBaileysWorker().catch(err => {
  console.error('Fatal Baileys Worker Error:', err);
  process.exit(1);
});
