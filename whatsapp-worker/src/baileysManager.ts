/**
 * HanuJai High School ERP — Baileys WhatsApp Socket Manager (Zero-Cost Architecture)
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Manages the persistent WebSocket connection, 8-digit Pairing Code registration,
 * Cloud Firestore AES-256-GCM authentication persistence, and safe message dispatching.
 * 
 * Zero-Cost Architecture Guarantees:
 * - NO QR codes generated or displayed.
 * - Complete auth state (credentials and Signal keys) saved in Cloud Firestore.
 * - Survives Render Free sleep and cold starts without requiring re-pairing.
 * - Single-instance enforcement via DistributedLeaseManager.
 */

import * as crypto from 'crypto';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type ConnectionState,
  type AuthenticationState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import type { Firestore } from 'firebase/firestore';
import { doc, setDoc } from 'firebase/firestore';
import type { WorkerConfig } from './config.ts';
import {
  useFirestoreAuthState,
  DistributedLeaseManager,
} from './firestoreAuthState.ts';

export interface BaileysStatus {
  connected: boolean;
  isRegistered: boolean;
  userJid: string | null;
  reconnectAttempts: number;
  lastDisconnectReason: string | null;
  activePairingCodeAvailable: boolean;
  hasCredentials: boolean;
  hasLease: boolean;
  workerId: string;
}

export class BaileysManager {
  private config: WorkerConfig;
  private db: Firestore;
  private sock: WASocket | null = null;
  private isConnected = false;
  private isRegistered = false;
  private userJid: string | null = null;
  private reconnectAttempts = 0;
  private lastDisconnectReason: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private authState: AuthenticationState | null = null;
  private saveCredsFn: (() => Promise<void>) | null = null;
  private clearAuthStateFn: (() => Promise<void>) | null = null;
  private leaseManager: DistributedLeaseManager;
  private workerId: string;

  // In-memory short-lived pairing code (cleared on connection or 120s TTL)
  private pairingCodeState: {
    code: string;
    phoneNumber: string;
    expiresAt: number;
  } | null = null;

  constructor(config: WorkerConfig, db: Firestore) {
    this.config = config;
    this.db = db;
    this.workerId = `worker_render_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.leaseManager = new DistributedLeaseManager(db, this.workerId, 60000);
  }

  public getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Initializes the Baileys connection using Firestore-backed state.
   */
  public async initialize(): Promise<void> {
    if (this.config.provider === 'dry_run') {
      console.log('📍 Worker operating in Dry-Run mode. Baileys socket initialization bypassed.');
      this.isRegistered = true;
      this.isConnected = true;
      await this.publishStatusDoc();
      return;
    }

    // 1. Acquire distributed lease to prevent multiple workers from running simultaneously
    const acquiredLease = await this.leaseManager.acquire();
    if (!acquiredLease) {
      console.warn('[Baileys] Another worker currently holds the active WhatsApp lease. Standing by in secondary mode.');
      await this.publishStatusDoc();
      return;
    }

    // 2. Load Firestore-backed Authentication State
    console.log('[Baileys] Loading encrypted authentication state from Cloud Firestore...');
    const { state, saveCreds, clearAuthState } = await useFirestoreAuthState(
      this.db,
      this.config.authEncryptionKey
    );

    this.authState = state;
    this.saveCredsFn = saveCreds;
    this.clearAuthStateFn = clearAuthState;
    this.isRegistered = Boolean(state.creds.registered);

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[Baileys] Core Engine v${version.join('.')} (Latest: ${isLatest})`);
    console.log(`[Baileys] Stored Session Registered: ${this.isRegistered ? '🟢 YES (Existing Session)' : '🟡 NO (Pairing Required)'}`);

    // If not registered and no active pairing requested, don't open socket until requested
    // to prevent unsolicited QR attempts or unnecessary keep-alives.
    if (!this.isRegistered && !this.pairingCodeState) {
      console.log('[Baileys] Account not yet registered. Awaiting Developer Pairing Code request.');
      await this.publishStatusDoc();
      return;
    }

    await this.startSocket(version);
  }

  private async startSocket(version: [number, number, number]): Promise<void> {
    if (!this.authState) return;

    // Silent pino logger keeps standard out clean for operational logs
    const logger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      version,
      logger,
      auth: this.authState,
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      defaultQueryTimeoutMs: 60000,
      syncFullHistory: false,
      browser: ['HanuJai ERP Dispatcher', 'Chrome', '120.0.0.0'],
    });

    if (this.saveCredsFn) {
      this.sock.ev.on('creds.update', async () => {
        if (this.saveCredsFn) {
          await this.saveCredsFn();
        }
      });
    }

    this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      // Ensure NO QR is ever rendered or printed
      if (qr) {
        // QR emitted by Baileys is intentionally ignored in pairing-code mode
      }

      if (connection === 'close') {
        this.isConnected = false;
        this.sock = null;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const errMessage = lastDisconnect?.error?.message || 'Connection terminated';
        this.lastDisconnectReason = `Code ${statusCode}: ${errMessage}`;

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.warn(`[Baileys] Socket closed (${this.lastDisconnectReason}). Logged out: ${isLoggedOut}`);

        if (isLoggedOut) {
          console.error('\n⚠️  WHATSAPP SESSION HAS BEEN REVOKED OR LOGGED OUT BY WHATSAPP!');
          this.isRegistered = false;
          this.userJid = null;
          if (this.clearAuthStateFn) {
            await this.clearAuthStateFn();
          }
          await this.publishStatusDoc();
        } else if (!this.isShuttingDown) {
          this.reconnectAttempts++;
          // Exponential backoff with jitter
          const baseDelay = Math.min(30000, 3000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 5)));
          const jitter = Math.floor(Math.random() * 2000);
          const totalDelayMs = baseDelay + jitter;

          console.log(`[Baileys] Temporary disconnect. Reconnecting in ${Math.round(totalDelayMs / 1000)}s (Attempt #${this.reconnectAttempts})...`);
          this.reconnectTimeout = setTimeout(() => {
            this.initialize().catch(err => console.error('[Baileys] Reconnect failed:', err));
          }, totalDelayMs);
          await this.publishStatusDoc();
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.isRegistered = true;
        this.reconnectAttempts = 0;
        this.userJid = this.sock?.user?.id || 'Connected Device';
        this.pairingCodeState = null; // Clear active pairing code upon connection

        console.log('================================================================================');
        console.log('  ✅ HANUJAI WHATSAPP DISPATCHER SUCCESSFULLY CONNECTED!');
        console.log(`  Linked JID      : ${this.userJid}`);
        console.log('  Session State   : Securely Encrypted & Persisted in Cloud Firestore');
        console.log('================================================================================\n');

        await this.publishStatusDoc();
      }
    });
  }

  /**
   * Generates an 8-character Baileys Pairing Code for linking without QR
   */
  public async requestPairingCode(phoneNumber: string): Promise<string> {
    if (this.isRegistered && this.isConnected) {
      throw new Error('WhatsApp account is already registered and active. To link a different number, unlink/log out first.');
    }

    // Clean Indian / international phone number: digits only with country code
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 10) {
      throw new Error(`Invalid phone number "${phoneNumber}". Provide full mobile number including country code (e.g. 919509489381).`);
    }

    const normalizedPhone = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;

    console.log(`[Baileys] Initiating 8-digit Pairing Code request for target phone: +${normalizedPhone}...`);

    // Ensure lease is held
    if (!this.leaseManager.hasLease()) {
      const acquired = await this.leaseManager.acquire();
      if (!acquired) {
        throw new Error('Could not acquire exclusive worker lease. Another instance is active.');
      }
    }

    // Load auth state if needed
    if (!this.authState) {
      const { state, saveCreds, clearAuthState } = await useFirestoreAuthState(
        this.db,
        this.config.authEncryptionKey
      );
      this.authState = state;
      this.saveCredsFn = saveCreds;
      this.clearAuthStateFn = clearAuthState;
    }

    const { version } = await fetchLatestBaileysVersion();
    if (!this.sock || !this.isConnected) {
      if (this.sock) {
        try { this.sock.end(undefined); } catch {}
        this.sock = null;
      }
      await this.startSocket(version);
      // Wait for socket handshake before requesting pairing code
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!this.sock || typeof this.sock.requestPairingCode !== 'function') {
      throw new Error('Baileys socket does not support requestPairingCode.');
    }

    let rawCode: string;
    try {
      rawCode = await this.sock.requestPairingCode(normalizedPhone);
    } catch (err: any) {
      console.warn(`[Baileys] Pairing code attempt encountered "${err.message}", reinitializing fresh socket...`);
      if (this.sock) {
        try { this.sock.end(undefined); } catch {}
        this.sock = null;
      }
      await this.startSocket(version);
      await new Promise(r => setTimeout(r, 3500));
      if (!this.sock || typeof this.sock.requestPairingCode !== 'function') {
        throw new Error('Baileys socket does not support requestPairingCode.');
      }
      rawCode = await this.sock.requestPairingCode(normalizedPhone);
    }
    const code = rawCode.trim();

    // Store in-memory with 120-second TTL (NEVER LOGGED)
    this.pairingCodeState = {
      code,
      phoneNumber: normalizedPhone,
      expiresAt: Date.now() + 120000,
    };

    console.log('[Baileys] ✓ 8-digit pairing code successfully generated and ready for developer presentation.');

    await this.publishStatusDoc();
    return code;
  }

  /**
   * Returns active pairing code if still valid (< 120s)
   */
  public getActivePairingCode(): { code: string; phoneNumber: string; remainingSeconds: number } | null {
    if (!this.pairingCodeState) return null;
    const now = Date.now();
    if (now > this.pairingCodeState.expiresAt) {
      this.pairingCodeState = null;
      return null;
    }
    return {
      code: this.pairingCodeState.code,
      phoneNumber: this.pairingCodeState.phoneNumber,
      remainingSeconds: Math.max(0, Math.round((this.pairingCodeState.expiresAt - now) / 1000)),
    };
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
      console.log('--------------------------------------------------------------------------------');
      console.log(messageText);
      console.log('--------------------------------------------------------------------------------\n');
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

    const digitsOnly = rawPhone.replace(/\D/g, '');
    if (!digitsOnly || digitsOnly.length < 10) {
      return {
        success: false,
        error: `Invalid phone number format: "${rawPhone}". Expected at least 10 digits.`,
      };
    }

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

  /**
   * Unlinks WhatsApp account and wipes session credentials
   */
  public async logout(): Promise<void> {
    console.log('[Baileys] Logging out WhatsApp session and wiping Firestore authentication state...');
    this.isShuttingDown = true;
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch {
        try {
          this.sock.end(undefined);
        } catch {
          // ignore
        }
      }
      this.sock = null;
    }

    if (this.clearAuthStateFn) {
      await this.clearAuthStateFn();
    }

    this.isConnected = false;
    this.isRegistered = false;
    this.userJid = null;
    this.pairingCodeState = null;
    this.isShuttingDown = false;

    await this.publishStatusDoc();
  }

  public getStatus(): BaileysStatus {
    return {
      connected: this.isConnected,
      isRegistered: this.isRegistered,
      userJid: this.userJid,
      reconnectAttempts: this.reconnectAttempts,
      lastDisconnectReason: this.lastDisconnectReason,
      activePairingCodeAvailable: Boolean(this.getActivePairingCode()),
      hasCredentials: Boolean(this.authState?.creds),
      hasLease: this.leaseManager.hasLease(),
      workerId: this.workerId,
    };
  }

  public isReady(): boolean {
    return this.config.dryRun || (this.isConnected && this.sock !== null);
  }

  /**
   * Publishes sanitized worker state to Cloud Firestore document: whatsappWorkerStatus/current
   */
  public async publishStatusDoc(): Promise<void> {
    try {
      const statusRef = doc(this.db, 'whatsappWorkerStatus', 'current');
      const status = this.getStatus();
      await setDoc(statusRef, {
        workerStatus: status.connected ? 'online' : status.isRegistered ? 'connecting' : 'awaiting_pairing',
        connected: status.connected,
        isRegistered: status.isRegistered,
        userJid: status.userJid,
        workerId: this.workerId,
        hasLease: status.hasLease,
        reconnectAttempts: status.reconnectAttempts,
        lastDisconnectReason: status.lastDisconnectReason,
        lastHeartbeat: new Date().toISOString(),
        liveSendEnabled: this.config.sendEnabled,
        dryRun: this.config.dryRun,
        provider: this.config.provider,
      }, { merge: true });
    } catch (err: any) {
      console.warn('[Baileys] Error updating whatsappWorkerStatus doc:', err.message);
    }
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
    await this.leaseManager.release();
    await this.publishStatusDoc();
  }
}
