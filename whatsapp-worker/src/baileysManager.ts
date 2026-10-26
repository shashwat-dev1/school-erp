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
import QRCode from 'qrcode';
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
  private currentQr: string | null = null;
  private currentQrSvg: string | null = null;
  private reconnectAttempts = 0;
  private lastDisconnectReason: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  public getQrData(): { qr: string | null; qrSvg: string | null } {
    return { qr: this.currentQr, qrSvg: this.currentQrSvg };
  }

  private async updatePublicQrPage(qr: string | null, isConnected = false, userJid: string | null = null): Promise<void> {
    try {
      const publicDir = path.resolve(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      const htmlPath = path.resolve(publicDir, 'whatsapp-qr.html');

      let htmlContent = '';
      if (isConnected) {
        htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HanuJai ERP — WhatsApp Connected</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #10b981; border-radius: 16px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { color: #10b981; margin: 0 0 12px 0; font-size: 22px; }
    p { color: #cbd5e1; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5; }
    .badge { background: #064e3b; color: #34d399; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h2>WhatsApp Linked Successfully!</h2>
    <p>The worker is authenticated and ready to dispatch attendance parent alerts.</p>
    <div class="badge">JID: ${userJid || 'Connected'}</div>
  </div>
</body>
</html>`;
      } else if (qr && this.currentQrSvg) {
        htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HanuJai ERP — WhatsApp Pairing QR</title>
  <meta http-equiv="refresh" content="5">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .qr-box { background: #ffffff; padding: 16px; border-radius: 12px; margin: 20px auto; width: 260px; height: 260px; display: flex; align-items: center; justify-content: center; }
    .qr-box svg { width: 100%; height: 100%; }
    .badge { background: #0ea5e9; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; letter-spacing: 0.05em; display: inline-block; margin-bottom: 12px; }
    h2 { margin: 0 0 8px 0; font-size: 20px; }
    p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0; }
    .phone-tag { color: #38bdf8; font-weight: 700; font-size: 15px; }
    .steps { text-align: left; background: #0f172a; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #cbd5e1; }
    .steps ol { margin: 0; padding-left: 20px; }
    .steps li { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">HanuJai High School ERP</span>
    <h2>Scan with WhatsApp</h2>
    <p>Designated Sender Phone: <span class="phone-tag">+91 95094 89381</span></p>
    <div class="qr-box">${this.currentQrSvg}</div>
    <div class="steps">
      <strong>Instructions:</strong>
      <ol>
        <li>Open WhatsApp on phone <strong>9509489381</strong></li>
        <li>Tap <strong>Settings</strong> (iOS) or <strong>⋮</strong> (Android) &gt; <strong>Linked Devices</strong></li>
        <li>Tap <strong>Link a Device</strong> and point your camera here</li>
      </ol>
    </div>
  </div>
</body>
</html>`;
      }

      if (htmlContent) {
        fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
      }
    } catch (err: any) {
      console.warn('[Baileys] Error updating public/whatsapp-qr.html:', err.message);
    }
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

    this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.currentQr = qr;
        this.qrAvailable = true;
        try {
          this.currentQrSvg = await QRCode.toString(qr, { type: 'svg', margin: 2 });
          await this.updatePublicQrPage(qr, false);
        } catch {
          // ignore
        }

        console.log('\n================================================================================');
        console.log('  📲 SCAN THIS QR CODE WITH AUTHORIZED HANUJAI HIGH SCHOOL WHATSAPP:');
        console.log('  Target Sender Mobile Phone: +91 95094 89381');
        console.log('  1. Open WhatsApp on phone 9509489381');
        console.log('  2. Tap Settings (iOS) or More Options ⋮ (Android) > Linked Devices');
        console.log('  3. Tap "Link a Device" and point camera at the QR code below:');
        console.log('  (You can also view it in browser at: http://localhost:5173/whatsapp-qr.html)');
        console.log('================================================================================\n');
        qrcode.generate(qr, { small: true });
        console.log('\nWaiting for pairing scan from phone 9509489381...\n');
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
        await this.updatePublicQrPage(null, true, this.userJid);

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
