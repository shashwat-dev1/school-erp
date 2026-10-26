/**
 * HanuJai High School ERP — Durable Queue Processor
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Polls Cloud Firestore attendanceNotifications collection,
 * applies safety filters and test allowlists, executes idempotent dispatch,
 * and records authoritative outcomes.
 */

import type { Firestore } from 'firebase/firestore';
import type { WorkerConfig } from './config.ts';
import type { BaileysManager } from './baileysManager.ts';
import {
  getPendingJobs,
  markJobProcessing,
  markJobSent,
  markJobFailed,
  markJobSkipped,
  verifyLegitimateSession,
  type NotificationJobDoc,
} from './firebase.ts';

export class QueueProcessor {
  private db: Firestore;
  private config: WorkerConfig;
  private baileys: BaileysManager;
  private isProcessing = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private inFlightJobIds = new Set<string>();

  constructor(db: Firestore, config: WorkerConfig, baileys: BaileysManager) {
    this.db = db;
    this.config = config;
    this.baileys = baileys;
  }

  public start(intervalMs = 5000): void {
    console.log(`[Queue] Queue processor active. Polling every ${intervalMs / 1000}s for pending attendance jobs...`);
    this.pollTimer = setInterval(() => this.processBatch(), intervalMs);
    // Initial immediate poll
    this.processBatch();
  }

  public stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public async processBatch(): Promise<void> {
    if (this.isProcessing) return;
    if (!this.baileys.isReady()) return;

    this.isProcessing = true;
    try {
      const pendingJobs = await getPendingJobs(this.db, 25);
      if (pendingJobs.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`[Queue] Discovered ${pendingJobs.length} pending notification job(s)...`);

      for (const job of pendingJobs) {
        if (this.inFlightJobIds.has(job.id)) continue;
        this.inFlightJobIds.add(job.id);

        try {
          await this.processSingleJob(job);
        } finally {
          this.inFlightJobIds.delete(job.id);
        }
      }
    } catch (err: any) {
      console.error('[Queue] Error during batch queue cycle:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSingleJob(job: NotificationJobDoc): Promise<void> {
    const rawPhone = (job.recipientPhone || '').trim();
    const digitsOnly = rawPhone.replace(/\D/g, '');

    // 1. Phone validation
    if (!digitsOnly || digitsOnly.length < 10) {
      console.log(`[Queue] Skipping ${job.studentName} (${job.id}): Missing or incomplete phone "${rawPhone}".`);
      await markJobSkipped(
        this.db,
        job.id,
        'missing_phone',
        'Parent/guardian primary mobile number is missing or invalid in student master record.'
      );
      return;
    }

    // 2. Session verification
    const isSessionValid = await verifyLegitimateSession(this.db, job.sessionId);
    if (!isSessionValid) {
      console.warn(`[Queue] Skipping ${job.studentName} (${job.id}): Attendance session ${job.sessionId} is not in submitted state.`);
      await markJobSkipped(
        this.db,
        job.id,
        'unverified_session',
        'Attendance register is not in submitted state.'
      );
      return;
    }

    // 3. Test Allowlist and Safe Mode Check
    const isAllowlisted = this.config.testAllowlist.length === 0 || this.config.testAllowlist.some(a => {
      return digitsOnly.endsWith(a) || a.endsWith(digitsOnly);
    });

    if (!this.config.sendEnabled) {
      // In safe/dry-run mode, if not in allowlist, skip safely
      if (!isAllowlisted) {
        console.log(`[Queue] Safe Skip: ${job.studentName} (${rawPhone}) - Not in WHATSAPP_TEST_ALLOWLIST and live sending is disabled.`);
        await markJobSkipped(
          this.db,
          job.id,
          'not_in_test_allowlist',
          'Live sending is disabled and recipient number is not in WHATSAPP_TEST_ALLOWLIST.'
        );
        return;
      }
    }

    // 4. Mark processing
    await markJobProcessing(this.db, job.id);

    // 5. Send message via Baileys socket
    console.log(`[Queue] Dispatching [${job.attendanceState.toUpperCase()}] alert for ${job.studentName} -> ${rawPhone}...`);
    const result = await this.baileys.sendMessage(rawPhone, job.messageText);

    if (result.success) {
      await markJobSent(this.db, job.id, result.externalId || `ext_${Date.now()}`, this.config.provider);
      console.log(`[Queue] ✓ Job ${job.id} completed. External ID: ${result.externalId}`);
    } else {
      console.error(`[Queue] ❌ Job ${job.id} failed: ${result.error}`);
      await markJobFailed(this.db, job.id, result.error || 'Dispatch failed', job.retryCount || 0);
    }
  }
}
