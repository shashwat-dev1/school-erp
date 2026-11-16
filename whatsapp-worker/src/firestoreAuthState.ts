/**
 * HanuJai High School ERP — Firestore-Backed Baileys Authentication State & Signal Key Store
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Provides encrypted, persistent session storage in Cloud Firestore for Baileys WebSocket clients.
 * Eliminates dependency on ephemeral container filesystems (e.g. Render Free tier sleep/restart).
 * 
 * Security:
 * - Credentials and Signal keys are encrypted at rest using AES-256-GCM.
 * - Key updates are persisted immediately before keys.set resolves.
 * - Distributed lease prevents multiple workers from corrupting auth state simultaneously.
 */

import * as crypto from 'crypto';
import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataSet,
  SignalKeyStore,
} from '@whiskeysockets/baileys';
import {
  initAuthCreds,
  BufferJSON,
  proto,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import type { Firestore } from 'firebase/firestore';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';

/**
 * AES-256-GCM Authenticated Encryption for WhatsApp Auth State at Rest
 */
export class AuthEncryption {
  private key: Buffer;

  constructor(secretOrKey?: string) {
    if (secretOrKey && secretOrKey.length === 64 && /^[0-9a-fA-F]+$/.test(secretOrKey)) {
      this.key = Buffer.from(secretOrKey, 'hex');
    } else if (secretOrKey && secretOrKey.length >= 16) {
      this.key = crypto.createHash('sha256').update(secretOrKey).digest();
    } else {
      // Deterministic institutional key fallback
      this.key = crypto.createHash('sha256').update('HanuJai-High-School-WhatsApp-Auth-Master-Key-2026').digest();
    }
  }

  public encrypt(plaintext: string): { iv: string; tag: string; ciphertext: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const tag = cipher.getAuthTag().toString('hex');
    return {
      iv: iv.toString('hex'),
      tag,
      ciphertext,
    };
  }

  public decrypt(payload: { iv: string; tag: string; ciphertext: string }): string {
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    let plaintext = decipher.update(payload.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }
}

/**
 * Normalizes category and key ID into a valid, safe Firestore document ID
 */
export function toFirestoreDocId(category: string, id: string): string {
  const safeCat = category.replace(/\//g, '__').replace(/:/g, '-');
  const safeId = id.replace(/\//g, '__').replace(/:/g, '-');
  return `${safeCat}___${safeId}`;
}

/**
 * Distributed Lease Manager to guarantee strictly ONE active WhatsApp socket across instances
 */
export class DistributedLeaseManager {
  private db: Firestore;
  private workerId: string;
  private leaseTtlMs: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isHoldingLease = false;

  constructor(db: Firestore, workerId: string, leaseTtlMs = 60000) {
    this.db = db;
    this.workerId = workerId;
    this.leaseTtlMs = leaseTtlMs;
  }

  public getWorkerId(): string {
    return this.workerId;
  }

  public hasLease(): boolean {
    return this.isHoldingLease;
  }

  /**
   * Attempts to acquire the exclusive distributed lease via Firestore transaction
   */
  public async acquire(): Promise<boolean> {
    const leaseRef = doc(this.db, 'whatsappWorkerLease', 'active');
    const now = Date.now();
    const expiresAt = new Date(now + this.leaseTtlMs).toISOString();

    try {
      const acquired = await runTransaction(this.db, async (tx) => {
        const snap = await tx.get(leaseRef);
        if (snap.exists()) {
          const data = snap.data();
          const currentExpiry = data.expiresAt ? new Date(data.expiresAt).getTime() : 0;
          if (data.status === 'active' && currentExpiry > now && data.ownerId !== this.workerId) {
            console.warn(`[Lease] Active lease held by another worker: "${data.ownerId}" until ${data.expiresAt}`);
            return false;
          }
        }
        tx.set(leaseRef, {
          ownerId: this.workerId,
          acquiredAt: new Date(now).toISOString(),
          heartbeatAt: new Date(now).toISOString(),
          expiresAt,
          status: 'active',
        }, { merge: true });
        return true;
      });

      if (acquired) {
        this.isHoldingLease = true;
        this.startHeartbeat();
        console.log(`[Lease] ✓ Exclusively acquired WhatsApp worker lease (ID: ${this.workerId}, TTL: ${this.leaseTtlMs / 1000}s)`);
      }
      return acquired;
    } catch (err: any) {
      console.warn('[Lease] Transaction error during lease acquisition:', err.message);
      return false;
    }
  }

  /**
   * Heartbeat renewal of active lease
   */
  public async renew(): Promise<boolean> {
    if (!this.isHoldingLease) return false;
    const leaseRef = doc(this.db, 'whatsappWorkerLease', 'active');
    const now = Date.now();
    const expiresAt = new Date(now + this.leaseTtlMs).toISOString();

    try {
      await updateDoc(leaseRef, {
        heartbeatAt: new Date(now).toISOString(),
        expiresAt,
        status: 'active',
      });
      return true;
    } catch (err: any) {
      console.warn('[Lease] Failed to renew heartbeat:', err.message);
      return false;
    }
  }

  /**
   * Graceful release of the lease on shutdown
   */
  public async release(): Promise<void> {
    this.stopHeartbeat();
    if (!this.isHoldingLease) return;
    this.isHoldingLease = false;
    try {
      const leaseRef = doc(this.db, 'whatsappWorkerLease', 'active');
      await updateDoc(leaseRef, {
        status: 'released',
        releasedAt: new Date().toISOString(),
        expiresAt: new Date(0).toISOString(),
      });
      console.log(`[Lease] Released worker lease for ${this.workerId}.`);
    } catch {
      // Ignored during shutdown
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      await this.renew();
    }, Math.floor(this.leaseTtlMs / 3));
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export interface FirestoreAuthStateResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAuthState: () => Promise<void>;
  encryption: AuthEncryption;
}

/**
 * Creates a complete Baileys-compliant database-backed AuthenticationState
 * targeting Cloud Firestore with AES-256-GCM encryption at rest.
 */
export async function useFirestoreAuthState(
  db: Firestore,
  encryptionKey?: string
): Promise<FirestoreAuthStateResult> {
  const enc = new AuthEncryption(encryptionKey);
  const credsRef = doc(db, 'whatsappAuthState', 'creds');

  // 1. Load initial credentials from Firestore
  let creds: AuthenticationCreds;
  try {
    const snap = await getDoc(credsRef);
    if (snap.exists()) {
      const payload = snap.data() as { iv: string; tag: string; ciphertext: string };
      const decrypted = enc.decrypt(payload);
      creds = JSON.parse(decrypted, BufferJSON.reviver);
      console.log(`[Firestore Auth] Loaded existing credentials (registered: ${Boolean(creds.registered)})`);
    } else {
      console.log('[Firestore Auth] No stored credentials found in Firestore. Generating fresh keys...');
      creds = initAuthCreds();
    }
  } catch (err: any) {
    console.warn('[Firestore Auth] Error loading stored creds, initializing fresh:', err.message);
    creds = initAuthCreds();
  }

  // 2. Credential persistence callback
  const saveCreds = async () => {
    try {
      const jsonStr = JSON.stringify(creds, BufferJSON.replacer);
      const encrypted = enc.encrypt(jsonStr);
      await setDoc(credsRef, {
        ...encrypted,
        registered: Boolean(creds.registered),
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Firestore Auth] Failed to persist credentials:', err.message);
      throw err;
    }
  };

  // 3. SignalKeyStore implementation for individual key documents
  const rawKeyStore: SignalKeyStore = {
    get: async (type, ids) => {
      const data: Record<string, any> = {};
      await Promise.all(
        ids.map(async (id) => {
          const docId = toFirestoreDocId(type, id);
          try {
            const keySnap = await getDoc(doc(db, 'whatsappAuthKeys', docId));
            if (keySnap.exists()) {
              const keyPayload = keySnap.data() as { iv: string; tag: string; ciphertext: string };
              const decrypted = enc.decrypt(keyPayload);
              let value = JSON.parse(decrypted, BufferJSON.reviver);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            } else {
              data[id] = null;
            }
          } catch {
            data[id] = null;
          }
        })
      );
      return data;
    },
    set: async (dataset: SignalDataSet) => {
      const operations: Array<{ type: 'set' | 'delete'; ref: any; data?: any }> = [];
      const nowIso = new Date().toISOString();

      for (const category in dataset) {
        for (const id in dataset[category]) {
          const value = dataset[category][id];
          const docId = toFirestoreDocId(category, id);
          const keyRef = doc(db, 'whatsappAuthKeys', docId);

          if (value === null || value === undefined) {
            operations.push({ type: 'delete', ref: keyRef });
          } else {
            const jsonStr = JSON.stringify(value, BufferJSON.replacer);
            const encrypted = enc.encrypt(jsonStr);
            operations.push({
              type: 'set',
              ref: keyRef,
              data: {
                ...encrypted,
                category,
                keyId: id,
                updatedAt: nowIso,
              },
            });
          }
        }
      }

      // Execute in transactional Firestore batches of max 400 operations
      const BATCH_SIZE = 400;
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const slice = operations.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const op of slice) {
          if (op.type === 'delete') {
            batch.delete(op.ref);
          } else {
            batch.set(op.ref, op.data);
          }
        }
        await batch.commit();
      }
    },
    clear: async () => {
      try {
        const snap = await getDocs(collection(db, 'whatsappAuthKeys'));
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        batch.delete(credsRef);
        await batch.commit();
        console.log('[Firestore Auth] Cleared all auth keys and credentials from Firestore.');
      } catch (err: any) {
        console.warn('[Firestore Auth] Failed to clear keys:', err.message);
      }
    },
  };

  const clearAuthState = async () => {
    if (rawKeyStore.clear) {
      await rawKeyStore.clear();
    }
  };

  return {
    state: {
      creds,
      keys: makeCacheableSignalKeyStore(rawKeyStore, pino({ level: 'silent' }) as any),
    },
    saveCreds,
    clearAuthState,
    encryption: enc,
  };
}
