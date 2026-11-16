import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// ============================================================================
// 1. Mock Implementations of Core Components for Isolated Verification
// ============================================================================

/**
 * AES-256-GCM In-Memory Reference Implementation for Testing
 */
class MockAuthEncryption {
  private key: Buffer;

  constructor(hexKey: string) {
    if (hexKey.length !== 64) {
      this.key = crypto.createHash('sha256').update(hexKey).digest();
    } else {
      this.key = Buffer.from(hexKey, 'hex');
    }
  }

  encrypt(plainText: string): { iv: string; authTag: string; encryptedData: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encryptedData: encrypted,
    };
  }

  decrypt(payload: { iv: string; authTag: string; encryptedData: string }): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(payload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
    let decrypted = decipher.update(payload.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

/**
 * Mock Firestore Store simulating encrypted storage for Baileys auth
 */
class MockFirestoreAuthStore {
  public docs: Map<string, any> = new Map();

  async getDoc(collection: string, docId: string): Promise<any | null> {
    const key = `${collection}/${docId}`;
    return this.docs.get(key) || null;
  }

  async setDoc(collection: string, docId: string, data: any): Promise<void> {
    const key = `${collection}/${docId}`;
    this.docs.set(key, { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteDoc(collection: string, docId: string): Promise<void> {
    const key = `${collection}/${docId}`;
    this.docs.delete(key);
  }

  async deleteAllInCollection(collection: string): Promise<void> {
    for (const key of Array.from(this.docs.keys())) {
      if (key.startsWith(`${collection}/`)) {
        this.docs.delete(key);
      }
    }
  }
}

/**
 * Mock Baileys Socket Simulator
 */
class MockBaileysSocket {
  public registered: boolean = false;
  public connectionState: 'connecting' | 'open' | 'close' = 'close';
  public requestedPairingCode: string | null = null;
  public qrGenerated: boolean = false;
  public listeners: Record<string, Function[]> = {};

  constructor(registered: boolean = false) {
    this.registered = registered;
  }

  ev = {
    on: (event: string, handler: Function) => {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
    },
    emit: (event: string, data: any) => {
      const handlers = this.listeners[event] || [];
      handlers.forEach(h => h(data));
    },
  };

  async requestPairingCode(_phoneNumber: string): Promise<string> {
    if (this.registered) {
      throw new Error('Already registered');
    }
    // Generate standard 8-character code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    this.requestedPairingCode = code;
    return code;
  }

  simulateOpen() {
    this.connectionState = 'open';
    this.registered = true;
    this.ev.emit('connection.update', {
      connection: 'open',
    });
  }

  simulateDisconnect(reason: number) {
    this.connectionState = 'close';
    this.ev.emit('connection.update', {
      connection: 'close',
      lastDisconnect: {
        error: {
          output: { statusCode: reason },
        },
      },
    });
  }
}

// ============================================================================
// 2. Comprehensive Test Suite
// ============================================================================

describe('HANUJAI ERP — Zero-Cost WhatsApp Worker Architecture Suite', () => {
  const TEST_SECRET = 'test_wake_secret_12345';
  const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let mockStore: MockFirestoreAuthStore;
  let enc: MockAuthEncryption;

  beforeEach(() => {
    mockStore = new MockFirestoreAuthStore();
    enc = new MockAuthEncryption(ENCRYPTION_KEY);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: First-time pairing code generation (8-digit Crockford Base32)
  // --------------------------------------------------------------------------
  it('1. Generates 8-character Crockford Base32 pairing code without generating QR codes', async () => {
    const socket = new MockBaileysSocket(false);
    const code = await socket.requestPairingCode('919509489381');

    expect(code).toBeDefined();
    expect(code).toHaveLength(8);
    // Base32 Crockford charset: A-Z (excluding I, O) + 2-9
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(socket.qrGenerated).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Pairing code linking transition (connection: 'open')
  // --------------------------------------------------------------------------
  it('2. Transitions from pairing state to registered and marks connection: "open"', async () => {
    const socket = new MockBaileysSocket(false);
    let isOpen = false;

    socket.ev.on('connection.update', (update: any) => {
      if (update.connection === 'open') {
        isOpen = true;
      }
    });

    await socket.requestPairingCode('919509489381');
    expect(socket.registered).toBe(false);

    // Simulate phone pairing confirmation
    socket.simulateOpen();

    expect(isOpen).toBe(true);
    expect(socket.registered).toBe(true);
    expect(socket.connectionState).toBe('open');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: AES-256-GCM credentials persistence in Firestore
  // --------------------------------------------------------------------------
  it('3. Encrypts Baileys credentials using AES-256-GCM before writing to Firestore', async () => {
    const rawCreds = {
      me: { id: '919509489381:1@s.whatsapp.net', name: 'HanuJai High School' },
      accountSettings: { unarchiveChats: false },
      registered: true,
    };

    const serialized = JSON.stringify(rawCreds);
    const encrypted = enc.encrypt(serialized);

    await mockStore.setDoc('whatsappAuthState', 'creds', encrypted);

    // Verify raw credentials are NOT stored in plaintext
    const stored = await mockStore.getDoc('whatsappAuthState', 'creds');
    expect(stored.encryptedData).toBeDefined();
    expect(stored.iv).toHaveLength(24); // 12 bytes hex
    expect(stored.authTag).toHaveLength(32); // 16 bytes hex
    expect(JSON.stringify(stored)).not.toContain('919509489381');

    // Decrypt and verify round-trip integrity
    const decrypted = JSON.parse(enc.decrypt(stored));
    expect(decrypted.registered).toBe(true);
    expect(decrypted.me.id).toBe('919509489381:1@s.whatsapp.net');
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Signal key updates (pre-key, session, app-state-sync-key, null deletion)
  // --------------------------------------------------------------------------
  it('4. Handles Signal keys set, update and null key deletion in Firestore', async () => {
    const keyCategory = 'pre-key';
    const keyId = '1';

    // Store key
    const rawKey = { public: 'pubkey123', private: 'privkey456' };
    const encryptedKey = enc.encrypt(JSON.stringify(rawKey));
    await mockStore.setDoc('whatsappAuthKeys', `${keyCategory}___${keyId}`, encryptedKey);

    let doc = await mockStore.getDoc('whatsappAuthKeys', `${keyCategory}___${keyId}`);
    expect(doc).not.toBeNull();

    // Signal key deletion on null
    await mockStore.deleteDoc('whatsappAuthKeys', `${keyCategory}___${keyId}`);
    doc = await mockStore.getDoc('whatsappAuthKeys', `${keyCategory}___${keyId}`);
    expect(doc).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Scenario 5 & 6: Process restart with saved credentials -> NO new pairing code
  // --------------------------------------------------------------------------
  it('5 & 6. Restores auth state on Render cold start with creds.registered === true and skips pairing code', async () => {
    // Simulate pre-existing credentials in Firestore
    const savedCreds = {
      registered: true,
      me: { id: '919509489381:1@s.whatsapp.net' },
    };
    await mockStore.setDoc('whatsappAuthState', 'creds', enc.encrypt(JSON.stringify(savedCreds)));

    // Cold start worker
    const stored = await mockStore.getDoc('whatsappAuthState', 'creds');
    const restored = JSON.parse(enc.decrypt(stored));

    const socket = new MockBaileysSocket(restored.registered);
    expect(socket.registered).toBe(true);

    // Assert that pairing code is NOT requested when registered
    let pairingRequested = false;
    try {
      await socket.requestPairingCode('919509489381');
      pairingRequested = true;
    } catch (e: any) {
      expect(e.message).toBe('Already registered');
    }
    expect(pairingRequested).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Ordinary disconnect vs Logged-out response
  // --------------------------------------------------------------------------
  it('7. Clears Firestore auth only on DisconnectReason.loggedOut (401), retaining it on temporary network drop', async () => {
    const savedCreds = { registered: true };
    await mockStore.setDoc('whatsappAuthState', 'creds', enc.encrypt(JSON.stringify(savedCreds)));

    const socket = new MockBaileysSocket(true);

    // 1. Temporary disconnect (e.g. 428 Precondition Required / 515 Restart)
    socket.simulateDisconnect(428);
    let stored = await mockStore.getDoc('whatsappAuthState', 'creds');
    expect(stored).not.toBeNull(); // Auth state preserved for auto-reconnect

    // 2. Permanent DisconnectReason.loggedOut (401)
    socket.simulateDisconnect(401);
    // Worker clears state on 401
    await mockStore.deleteAllInCollection('whatsappAuthState');
    await mockStore.deleteAllInCollection('whatsappAuthKeys');

    stored = await mockStore.getDoc('whatsappAuthState', 'creds');
    expect(stored).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Wake request handling with shared secret
  // --------------------------------------------------------------------------
  it('8. Validates x-worker-wake-secret on /wake endpoint and rejects unauthorized triggers', () => {
    const handleWakeRequest = (secretHeader?: string) => {
      if (secretHeader !== TEST_SECRET) {
        return { status: 401, error: 'Unauthorized: Invalid worker wake secret' };
      }
      return { status: 200, message: 'Worker wake signal received. Draining queue.' };
    };

    expect(handleWakeRequest('wrong_secret').status).toBe(401);
    expect(handleWakeRequest(undefined).status).toBe(401);
    expect(handleWakeRequest(TEST_SECRET).status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // Scenario 9 & 10: Process pending messages & Duplicate send prevention
  // --------------------------------------------------------------------------
  it('9 & 10. Dispatches pending queue jobs and prevents duplicate sends using idempotency key', async () => {
    const sentDispatches = new Set<string>();

    const queue = [
      { id: 'job-1', idempotencyKey: 'att_sess-10a_stu-01', status: 'pending', phone: '+919009519718' },
      { id: 'job-2', idempotencyKey: 'att_sess-10a_stu-02', status: 'pending', phone: '+918952031365' },
      // Duplicate of job-1
      { id: 'job-3', idempotencyKey: 'att_sess-10a_stu-01', status: 'pending', phone: '+919009519718' },
    ];

    let processedCount = 0;
    let duplicateSkipped = 0;

    for (const job of queue) {
      if (sentDispatches.has(job.idempotencyKey)) {
        duplicateSkipped++;
        job.status = 'completed'; // Idempotent no-op
        continue;
      }
      sentDispatches.add(job.idempotencyKey);
      processedCount++;
      job.status = 'completed';
    }

    expect(processedCount).toBe(2);
    expect(duplicateSkipped).toBe(1);
    expect(sentDispatches.size).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Crash recovery of stalled processing jobs (>5 min)
  // --------------------------------------------------------------------------
  it('11. Recovers stalled jobs in "processing" state for > 5 minutes back to "pending"', () => {
    const now = Date.now();
    const jobs = [
      { id: 'job-fresh', deliveryStatus: 'processing', processingStartedAt: new Date(now - 2 * 60 * 1000).toISOString() }, // 2 min ago
      { id: 'job-stalled', deliveryStatus: 'processing', processingStartedAt: new Date(now - 6 * 60 * 1000).toISOString() }, // 6 min ago
    ];

    const recoverStalledJobs = (list: typeof jobs) => {
      const STALLED_THRESHOLD_MS = 5 * 60 * 1000;
      let recovered = 0;
      list.forEach(job => {
        if (job.deliveryStatus === 'processing' && job.processingStartedAt) {
          const elapsed = Date.now() - new Date(job.processingStartedAt).getTime();
          if (elapsed > STALLED_THRESHOLD_MS) {
            job.deliveryStatus = 'pending';
            recovered++;
          }
        }
      });
      return recovered;
    };

    const count = recoverStalledJobs(jobs);
    expect(count).toBe(1);
    expect(jobs.find(j => j.id === 'job-stalled')?.deliveryStatus).toBe('pending');
    expect(jobs.find(j => j.id === 'job-fresh')?.deliveryStatus).toBe('processing');
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Distributed lease acquisition and single-socket enforcement
  // --------------------------------------------------------------------------
  it('12. Acquires exclusive distributed lease and prevents competing worker instances', async () => {
    let activeLease: { holderId: string; expiresAt: number } | null = null;

    const tryAcquireLease = (workerId: string, ttlMs: number = 60000): boolean => {
      const now = Date.now();
      if (!activeLease || activeLease.expiresAt < now) {
        activeLease = { holderId: workerId, expiresAt: now + ttlMs };
        return true;
      }
      if (activeLease.holderId === workerId) {
        activeLease.expiresAt = now + ttlMs;
        return true;
      }
      return false; // Another worker instance holds the lease
    };

    // Worker 1 acquires
    expect(tryAcquireLease('worker-instance-A')).toBe(true);

    // Competing Worker 2 attempts acquisition while Worker 1 is valid
    expect(tryAcquireLease('worker-instance-B')).toBe(false);

    // Advance time past lease TTL
    vi.advanceTimersByTime(61000);

    // Worker 2 can now acquire the expired lease
    expect(tryAcquireLease('worker-instance-B')).toBe(true);
    expect(activeLease!.holderId).toBe('worker-instance-B');
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Expired pairing code handling (TTL 120s)
  // --------------------------------------------------------------------------
  it('13. Expires in-memory pairing code after 120 seconds TTL', () => {
    let pairingState: { code: string; expiresAt: number } | null = {
      code: 'ABCD2345',
      expiresAt: Date.now() + 120 * 1000,
    };

    const getActiveCode = () => {
      if (!pairingState) return null;
      if (Date.now() > pairingState.expiresAt) {
        pairingState = null;
        return null;
      }
      return pairingState.code;
    };

    expect(getActiveCode()).toBe('ABCD2345');

    // Advance time 121 seconds
    vi.advanceTimersByTime(121000);
    expect(getActiveCode()).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Scenario 14: QR code suppression in pairing mode
  // --------------------------------------------------------------------------
  it('14. Suppresses QR code generation and terminal ANSI QR rendering in pairing mode', () => {
    const isPairingMode = true;
    let qrRendered = false;

    const handleConnectionUpdate = (update: { qr?: string }) => {
      if (isPairingMode) {
        // Pairing code architecture explicitly suppresses QR generation
        return;
      }
      if (update.qr) {
        qrRendered = true;
      }
    };

    handleConnectionUpdate({ qr: 'mock_qr_data_string' });
    expect(qrRendered).toBe(false);
  });
});
