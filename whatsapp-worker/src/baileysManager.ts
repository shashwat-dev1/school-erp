/**
 * HanuJai High School ERP — Baileys WhatsApp Socket Manager
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Manages the persistent WebSocket connection, QR code pairing,
 * credential persistence in ./.baileys_auth/, and safe message dispatching.
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
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import type { WorkerConfig } from './config.ts';

export interface BaileysStatus {
  connected: boolean;
  userJid: string | null;
  qrAvailable: boolean;
  reconnectAttempts: number;
  lastDisconnectReason: string | null;
  authDirExists: boolean;
  hasCredentials: boolean;
}

export class BaileysManager {
  private config: WorkerConfig;
  private sock: WASocket | null = null;
  private isConnected = false;
  private qrAvailable = false;
  private userJid: string | null = null;
  private reconnectAttempts = 0;
  private lastDisconnectReason: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.config.provider === 'dry_run') {
      console.log('📍 Worker operating in Dry-Run mode. Baileys socket initialization bypassed.');
      return;
    }

    // Ensure auth directory exists
    if (!fs.existsSync(this.config.authDir)) {
      fs.mkdirSync(this.config.authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    // Use silent pino logger to keep terminal readable for QR and attendance notifications
    const logger = pino({ level: 'silent' });

    console.log(`Baileys Core Engine v${version.join('.')} (Latest: ${isLatest})`);
    console.log(`Authentication storage: ${this.config.authDir}\n`);

    this.sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrAvailable = true;
        console.log('\n================================================================================');
        console.log('  📲 SCAN THIS QR CODE WITH AUTHORIZED HANUJAI HIGH SCHOOL WHATSAPP:');
        console.log('  1. Open WhatsApp on the school mobile phone');
        console.log('  2. Tap Settings (iOS) or More Options ⋮ (Android) > Linked Devices');
        console.log('  3. Tap "Link a Device" and point camera at the QR code below:');
        console.log('================================================================================\n');
        qrcode.generate(qr, { small: true });
        console.log('\nWaiting for pairing scan...\n');
      }

      if (connection === 'close') {
        this.isConnected = false;
        this.qrAvailable = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const errMessage = lastDisconnect?.error?.message || 'Connection terminated';
        this.lastDisconnectReason = `Code ${statusCode}: ${errMessage}`;

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.warn(`[Baileys] Socket closed (${this.lastDisconnectReason}). Logged out: ${isLoggedOut}`);

        if (isLoggedOut) {
          console.error('\n⚠️  WHATSAPP ACCOUNT HAS LOGGED OUT OR SESSION REVOKED!');
          console.error('To reconnect, run: npm run whatsapp:logout and restart the worker to scan a new QR code.\n');
        } else if (!this.isShuttingDown) {
          this.reconnectAttempts++;
          const delaySec = Math.min(30, 5 * Math.pow(1.5, Math.min(this.reconnectAttempts, 5)));
          console.log(`[Baileys] Reconnecting in ${Math.round(delaySec)}s (Attempt #${this.reconnectAttempts})...`);
          this.reconnectTimeout = setTimeout(() => {
            this.initialize().catch(err => console.error('[Baileys] Reconnect failed:', err));
          }, delaySec * 1000);
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.qrAvailable = false;
        this.reconnectAttempts = 0;
        this.userJid = this.sock?.user?.id || 'Connected Device';

        console.log('================================================================================');
        console.log('  ✅ HANUJAI WHATSAPP DISPATCHER SUCCESSFULLY CONNECTED TO WHATSAPP!');
        console.log(`  Linked JID   : ${this.userJid}`);
        console.log(`  Session State: Persisted in ${this.config.authDir}`);
        console.log('================================================================================\n');
      }
    });
  }

  /**
   * Dispatches a single WhatsApp text message
   */
  public async sendMessage(
    rawPhone: string,
    messageText: string
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    if (this.config.dryRun || !this.config.sendEnabled) {
      console.log(`[Dry-Run Preview] Would send to ${rawPhone}:`);
      console.log(`--------------------------------------------------------------------------------`);
      console.log(messageText);
      console.log(`--------------------------------------------------------------------------------\n`);
      return {
        success: true,
        externalId: `sim_${Date.now()}`,
      };
    }

    if (!this.isConnected || !this.sock) {
      return {
        success: false,
        error: 'WhatsApp socket is not connected. Ensure worker has paired and is online.',
      };
    }

    // Clean Indian phone number
    const digitsOnly = rawPhone.replace(/\D/g, '');
    if (!digitsOnly || digitsOnly.length < 10) {
      return {
        success: false,
        error: `Invalid phone number format: "${rawPhone}". Expected at least 10 digits.`,
      };
    }

    // Normalize to Indian JID (91XXXXXXXXXX@s.whatsapp.net)
    const normalizedDigits = digitsOnly.length === 10
      ? `91${digitsOnly}`
      : digitsOnly.startsWith('91') && digitsOnly.length === 12
      ? digitsOnly
      : digitsOnly;

    const jid = `${normalizedDigits}@s.whatsapp.net`;

    try {
      console.log(`[Baileys] Transmitting attendance alert to ${jid}...`);
      const sentMsg = await this.sock.sendMessage(jid, { text: messageText });
      const externalId = sentMsg?.key?.id || `msg_${Date.now()}`;
      console.log(`[Baileys] ✓ Message accepted by WhatsApp network. ID: ${externalId}`);
      return {
        success: true,
        externalId,
      };
    } catch (err: any) {
      console.error(`[Baileys] ❌ Socket transmission failed for ${jid}:`, err.message);
      return {
        success: false,
        error: err.message || 'Unknown Baileys transmission error.',
      };
    }
  }

  public getStatus(): BaileysStatus {
    const credsFile = path.resolve(this.config.authDir, 'creds.json');
    return {
      connected: this.isConnected,
      userJid: this.userJid,
      qrAvailable: this.qrAvailable,
      reconnectAttempts: this.reconnectAttempts,
      lastDisconnectReason: this.lastDisconnectReason,
      authDirExists: fs.existsSync(this.config.authDir),
      hasCredentials: fs.existsSync(credsFile),
    };
  }

  public isReady(): boolean {
    return this.config.dryRun || (this.isConnected && this.sock !== null);
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {
        // Ignored during exit
      }
      this.sock = null;
    }
    this.isConnected = false;
  }
}
