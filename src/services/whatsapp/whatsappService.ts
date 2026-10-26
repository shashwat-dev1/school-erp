/**
 * HanuJai High School ERP — WhatsApp Notification Service
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Manages the durable notification queue, duplicate prevention, idempotency keys,
 * and dispatching via the configured WhatsApp provider.
 */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, isDemoMode } from '../../config/firebase';
import { PHASE_CONFIG } from '../../config/phase';
import type { AttendanceSession, StudentRecord } from '../../domain/types';
import type {
  WhatsAppNotificationJob,
  WhatsAppStats,
  WhatsAppProvider,
} from './types';
import { DryRunWhatsAppProvider } from './providers/dryRunProvider';

const LOCAL_STORAGE_KEY = 'hanujai_whatsapp_notifications_v1';

function formatLocalSchoolDate(dateIso: string): string {
  try {
    const parts = dateIso.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  } catch {
    // Fallback
  }
  return dateIso;
}

export class WhatsAppNotificationService {
  private static provider: WhatsAppProvider | null =
    PHASE_CONFIG.whatsapp.provider === 'dry_run' ? new DryRunWhatsAppProvider() : null;

  public static setProvider(p: WhatsAppProvider | null) {
    this.provider = p;
  }

  public static getProviderName(): 'dry_run' | 'baileys' | 'cloud_api' {
    return PHASE_CONFIG.whatsapp.provider;
  }

  /**
   * Enqueues durable notification jobs in Cloud Firestore (or local cache)
   * immediately after an attendance register has been saved and submitted.
   * Uses deterministic idempotency keys to prevent duplicate messages.
   */
  public static async enqueueSessionNotifications(
    session: AttendanceSession,
    students: StudentRecord[]
  ): Promise<WhatsAppNotificationJob[]> {
    const studentMap = new Map<string, StudentRecord>(students.map(s => [s.id, s]));
    const formattedDate = formatLocalSchoolDate(session.date);
    const jobs: WhatsAppNotificationJob[] = [];
    const nowIso = new Date().toISOString();

    for (const record of session.records) {
      const student = studentMap.get(record.studentId);
      const studentName = student ? `${student.firstName} ${student.lastName}`.trim() : record.studentName;
      const guardianName = student?.guardianName || 'Parent/Guardian';
      const rawPhone = student?.primaryPhone || '';
      const state = record.state; // 'present' | 'absent'

      // Skip non-attendance records if any legacy values exist
      if (state !== 'present' && state !== 'absent') continue;

      // Deterministic idempotency key: session + student + state
      const jobId = `att_${session.id}_${record.studentId}`;

      // Build respectful school notification message text
      const messageText = state === 'present'
        ? PHASE_CONFIG.whatsapp.templates.present(studentName, formattedDate, guardianName)
        : PHASE_CONFIG.whatsapp.templates.absent(studentName, formattedDate, guardianName);

      // Initial validation of phone
      const cleanPhone = rawPhone.trim();
      const isMissingPhone = !cleanPhone || cleanPhone === '+91' || cleanPhone.length < 10;

      const job: WhatsAppNotificationJob = {
        id: jobId,
        sessionId: session.id,
        classId: session.classId,
        classLabel: session.classLabel,
        date: session.date,
        studentId: record.studentId,
        studentName,
        guardianName,
        recipientPhone: cleanPhone,
        attendanceState: state,
        messageText,
        provider: PHASE_CONFIG.whatsapp.provider,
        deliveryStatus: isMissingPhone ? 'skipped' : 'pending',
        skipReason: isMissingPhone ? 'missing_phone' : undefined,
        retryCount: 0,
        createdAt: nowIso,
      };

      jobs.push(job);
    }

    // Persist to Cloud Firestore or Local Cache
    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const batch = writeBatch(db);
        for (const j of jobs) {
          const docRef = doc(db, 'attendanceNotifications', j.id);
          batch.set(docRef, j, { merge: true });
        }
        await batch.commit();
      } catch (err) {
        console.warn('Cloud Firestore batch notification save fallback to local:', err);
        this.saveToLocalStorage(jobs);
      }
    } else {
      this.saveToLocalStorage(jobs);
    }

    // Auto-process simulated dispatch only when an explicit dry-run simulator provider is active
    if (this.provider && this.provider.name === 'dry_run') {
      const processedJobs: WhatsAppNotificationJob[] = [];
      for (const j of jobs) {
        if (j.deliveryStatus === 'pending') {
          const res = await this.provider.send(j);
          if (res.success) {
            j.deliveryStatus = 'sent';
            j.externalId = res.externalId;
            j.sentAt = new Date().toISOString();
          } else if (res.skipReason) {
            j.deliveryStatus = 'skipped';
            j.skipReason = res.skipReason;
            j.error = res.error;
          } else {
            j.deliveryStatus = 'failed';
            j.error = res.error || 'Transmission failed';
          }
        }
        processedJobs.push(j);
      }
      await this.updateJobsState(processedJobs);
      return processedJobs;
    }

    // When provider is 'baileys' or 'cloud_api' and running live in browser,
    // jobs remain 'pending' in Firestore for the dedicated server-side Node.js worker.
    return jobs;
  }

  /**
   * Retrieves all notification records for an attendance session.
   */
  public static async getSessionNotifications(sessionId: string): Promise<{
    jobs: WhatsAppNotificationJob[];
    stats: WhatsAppStats;
  }> {
    let jobs: WhatsAppNotificationJob[] = [];

    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const q = query(
          collection(db, 'attendanceNotifications'),
          where('sessionId', '==', sessionId)
        );
        const snap = await getDocs(q);
        jobs = snap.docs.map(d => d.data() as WhatsAppNotificationJob);
      } catch (err) {
        console.warn('Failed to load notifications from Firestore, using local fallback:', err);
        jobs = this.loadFromLocalStorage(sessionId);
      }
    } else {
      jobs = this.loadFromLocalStorage(sessionId);
    }

    // Compute metrics
    const stats: WhatsAppStats = {
      total: jobs.length,
      pending: jobs.filter(j => j.deliveryStatus === 'pending' || j.deliveryStatus === 'processing').length,
      sent: jobs.filter(j => j.deliveryStatus === 'sent').length,
      failed: jobs.filter(j => j.deliveryStatus === 'failed').length,
      skipped: jobs.filter(j => j.deliveryStatus === 'skipped').length,
      providerMode: PHASE_CONFIG.whatsapp.provider,
      isLiveEnabled: PHASE_CONFIG.whatsapp.sendEnabled,
    };

    return { jobs, stats };
  }

  /**
   * Retries an individual notification job.
   */
  public static async retryJob(job: WhatsAppNotificationJob): Promise<WhatsAppNotificationJob> {
    const updatedJob = { ...job, retryCount: job.retryCount + 1 };
    if (this.provider) {
      const res = await this.provider.send(updatedJob);
      if (res.success) {
        updatedJob.deliveryStatus = 'sent';
        updatedJob.externalId = res.externalId;
        updatedJob.sentAt = new Date().toISOString();
        updatedJob.error = undefined;
      } else if (res.skipReason) {
        updatedJob.deliveryStatus = 'skipped';
        updatedJob.skipReason = res.skipReason;
        updatedJob.error = res.error;
      } else {
        updatedJob.deliveryStatus = 'failed';
        updatedJob.error = res.error || 'Retry transmission failed';
      }
    } else {
      // Re-queue as pending for the background worker
      updatedJob.deliveryStatus = 'pending';
      updatedJob.error = undefined;
    }

    await this.updateJobsState([updatedJob]);
    return updatedJob;
  }

  private static async updateJobsState(jobs: WhatsAppNotificationJob[]): Promise<void> {
    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const batch = writeBatch(db);
        for (const j of jobs) {
          const docRef = doc(db, 'attendanceNotifications', j.id);
          batch.set(docRef, j, { merge: true });
        }
        await batch.commit();
      } catch {
        // Fallback to local storage
      }
    }
    this.saveToLocalStorage(jobs);
  }

  private static saveToLocalStorage(newJobs: WhatsAppNotificationJob[]): void {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const existing: Record<string, WhatsAppNotificationJob> = raw ? JSON.parse(raw) : {};
      for (const j of newJobs) {
        existing[j.id] = j;
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }

  private static loadFromLocalStorage(sessionId: string): WhatsAppNotificationJob[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const map: Record<string, WhatsAppNotificationJob> = JSON.parse(raw);
      return Object.values(map).filter(j => j.sessionId === sessionId);
    } catch {
      return [];
    }
  }
}
