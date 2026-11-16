/**
 * HanuJai High School ERP — Durable Queue Processor (Zero-Cost Architecture)
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Polls Cloud Firestore attendanceNotifications collection,
 * applies crash recovery for stalled jobs, executes idempotent dispatch,
 * and records authoritative outcomes and operational metrics.
 */

import type { Firestore } from 'firebase/firestore';
import { doc, setDoc } from 'firebase/firestore';
import type { WorkerConfig } from './config.ts';
import type { BaileysManager } from './baileysManager.ts';
import {
  getPendingJobs,
  markJobProcessing,
  markJobSent,
  markJobFailed,
  markJobSkipped,
  verifyLegitimateSession,
  recoverStalledJobs,
  type NotificationJobDoc,
} from './firebase.ts';

export class QueueProcessor {
  private db: Firestore;
  private config: WorkerConfig;
  private baileys: BaileysManager;
  private isProcessing = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private inFlightJobIds = new Set<string>();

  // Operational metrics
  private totalProcessed = 0;
  private totalFailed = 0;
  private totalSkipped = 0;
  private lastSuccessfulMessage: string | null = null;
  private lastWakeUpTime: string | null = null;

  constructor(db: Firestore, config: WorkerConfig, baileys: BaileysManager) {
    this.db = db;
    this.config = config;
    this.baileys = baileys;
    this.lastWakeUpTime = new Date().toISOString();
  }

  public recordWakeUp(): void {
    this.lastWakeUpTime = new Date().toISOString();
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

  public async processBatch(): Promise<{ processedCount: number; pendingCount: number }> {
    if (this.isProcessing) return { processedCount: 0, pendingCount: 0 };
    if (!this.baileys.isReady()) return { processedCount: 0, pendingCount: 0 };

    this.isProcessing = true;
    let cycleProcessed = 0;

    try {
      // 1. Crash recovery: recover any jobs stuck in 'processing' for > 5 minutes
      await recoverStalledJobs(this.db, 300000);

      // 2. Fetch pending jobs
      const pendingJobs = await getPendingJobs(this.db, 25);
      if (pendingJobs.length === 0) {
        await this.publishMetricsDoc(0);
        return { processedCount: 0, pendingCount: 0 };
      }

      console.log(`[Queue] Discovered ${pendingJobs.length} pending notification job(s)...`);

      for (const job of pendingJobs) {
        if (this.inFlightJobIds.has(job.id)) continue;
        this.inFlightJobIds.add(job.id);

        try {
          await this.processSingleJob(job);
          cycleProcessed++;
        } finally {
          this.inFlightJobIds.delete(job.id);
        }
      }

      await this.publishMetricsDoc(Math.max(0, pendingJobs.length - cycleProcessed));
      return { processedCount: cycleProcessed, pendingCount: Math.max(0, pendingJobs.length - cycleProcessed) };
    } catch (err: any) {
      console.error('[Queue] Error during batch queue cycle:', err.message);
      return { processedCount: cycleProcessed, pendingCount: 0 };
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
      this.totalSkipped++;
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
      this.totalSkipped++;
      return;
    }

    // 3. Test Allowlist and Safe Mode Check
    const hasAllowlist = this.config.testAllowlist.length > 0;
    const isAllowlisted = !hasAllowlist || this.config.testAllowlist.some(a => {
      return digitsOnly.endsWith(a) || a.endsWith(digitsOnly);
    });

    if (hasAllowlist && !isAllowlisted) {
      console.log(`[Queue] Safe Skip: ${job.studentName} (${rawPhone}) - Recipient not in WHATSAPP_TEST_ALLOWLIST.`);
      await markJobSkipped(
        this.db,
        job.id,
        'not_in_test_allowlist',
        'Recipient number is not on the verified test allowlist.'
      );
      this.totalSkipped++;
      return;
    }

    if (!this.config.sendEnabled) {
      console.log(`[Queue] Safe Skip: ${job.studentName} (${rawPhone}) - Live sending disabled.`);
      await markJobSkipped(
        this.db,
        job.id,
        'unverified_session',
        'Live message sending is disabled in worker configuration.'
      );
      this.totalSkipped++;
      return;
    }

    // 4. Mark processing
    await markJobProcessing(this.db, job.id);

    // 5. Send message via Baileys socket
    console.log(`[Queue] Dispatching [${job.attendanceState.toUpperCase()}] alert for ${job.studentName} -> ${rawPhone}...`);
    const result = await this.baileys.sendMessage(rawPhone, job.messageText);

    if (result.success) {
      const extId = result.externalId || `ext_${Date.now()}`;
      await markJobSent(this.db, job.id, extId, this.config.provider);
      this.totalProcessed++;
      this.lastSuccessfulMessage = new Date().toISOString();
      console.log(`[Queue] ✓ Job ${job.id} completed. External ID: ${extId}`);
    } else {
      console.error(`[Queue] ❌ Job ${job.id} failed: ${result.error}`);
      await markJobFailed(this.db, job.id, result.error || 'Dispatch failed', job.retryCount || 0);
      this.totalFailed++;
    }
  }

  public getMetrics() {
    return {
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      totalSkipped: this.totalSkipped,
      lastSuccessfulMessage: this.lastSuccessfulMessage,
      lastWakeUpTime: this.lastWakeUpTime,
    };
  }

  /**
   * Publishes sanitized queue metrics to Cloud Firestore document: whatsappWorkerStatus/current
   */
  public async publishMetricsDoc(queueDepth = 0): Promise<void> {
    try {
      const statusRef = doc(this.db, 'whatsappWorkerStatus', 'current');
      await setDoc(statusRef, {
        queueDepth,
        totalProcessed: this.totalProcessed,
        totalFailed: this.totalFailed,
        totalSkipped: this.totalSkipped,
        lastSuccessfulMessage: this.lastSuccessfulMessage,
        lastWakeUpTime: this.lastWakeUpTime,
        lastHeartbeat: new Date().toISOString(),
      }, { merge: true });
    } catch (err: any) {
      console.warn('[Queue] Error updating metrics doc:', err.message);
    }
  }
}
