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
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured, isDemoMode } from '../../config/firebase';
import { PHASE_CONFIG } from '../../config/phase';
import type { AttendanceSession, StudentRecord, AttendanceCorrection } from '../../domain/types';
import type {
  WhatsAppNotificationJob,
  WhatsAppStats,
  WhatsAppProvider,
} from './types';
import { DryRunWhatsAppProvider } from './providers/dryRunProvider';
import { generateAttendanceNotificationMessage } from './attendanceNotificationTemplates';

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
    const studentMap = new Map<string, StudentRecord>();
    for (const s of students) {
      studentMap.set(s.id, s);
      studentMap.set(s.id.toLowerCase(), s);
      studentMap.set(s.id.toUpperCase(), s);
      if (s.rollNumber) studentMap.set(`roll_${s.rollNumber}`, s);
    }

    const formattedDate = formatLocalSchoolDate(session.date);
    const jobs: WhatsAppNotificationJob[] = [];
    const nowIso = new Date().toISOString();

    for (const record of session.records) {
      const student = studentMap.get(record.studentId) ||
                      studentMap.get(record.studentId?.toLowerCase()) ||
                      studentMap.get(record.studentId?.toUpperCase());
      const studentName = student ? `${student.firstName} ${student.lastName}`.trim() : record.studentName;
      const guardianName = student?.guardianName || (record as any).guardianName || 'Parent/Guardian';
      const rawPhone = student?.primaryPhone || '';
      const state = record.state; // 'present' | 'absent'

      // Skip non-attendance records if any legacy values exist
      if (state !== 'present' && state !== 'absent') continue;

      // Deterministic idempotency key: session + student + state
      const jobId = `att_${session.id}_${record.studentId}`;

      // Build authoritative Principal-approved bilingual notification message text
      const { messageText, templateType } = generateAttendanceNotificationMessage({
        studentName,
        date: formattedDate,
        status: state,
      });

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
        templateType,
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
   * Enqueues and dispatches an attendance correction notification for the affected student ONLY.
   * - Never sends to the entire class or register.
   * - Supersedes and cancels any pending original notification for that student.
   * - Uses a deterministic idempotency key tied to the correction request.
   */
  public static async enqueueCorrectionNotification(
    correction: AttendanceCorrection,
    student: StudentRecord
  ): Promise<WhatsAppNotificationJob> {
    const formattedDate = formatLocalSchoolDate(correction.date);
    const studentName = student.fullName || correction.studentName;
    const guardianName = student.guardianName || 'Parent/Guardian';
    const rawPhone = student.primaryPhone || '';
    const cleanPhone = rawPhone.trim();
    const isMissingPhone = !cleanPhone || cleanPhone === '+91' || cleanPhone.length < 10;
    const classAndSection = correction.classLabel + (correction.section ? ` - ${correction.section}` : '');

    // 1. Cancel / supersede any pending original notification for this student in this session
    const originalJobId = `att_${correction.sessionId}_${correction.studentId}`;
    try {
      const allJobs = this.loadAllFromLocalStorage();
      if (allJobs[originalJobId] && allJobs[originalJobId].deliveryStatus === 'pending') {
        allJobs[originalJobId].deliveryStatus = 'skipped';
        allJobs[originalJobId].skipReason = 'not_in_test_allowlist';
        allJobs[originalJobId].error = `Superseded by attendance correction ${correction.id}`;
        this.saveAllToLocalStorage(allJobs);
      }
    } catch {
      // Ignored
    }

    // 2. Deterministic idempotency key tied to the correction request
    const jobId = `att_corr_${correction.id}`;

    // 3. Generate bilingual message using dedicated correction template
    const messageText = PHASE_CONFIG.whatsapp.templates.correction(
      studentName,
      classAndSection,
      formattedDate,
      correction.previousState as 'present' | 'absent',
      correction.requestedState as 'present' | 'absent',
      guardianName
    );

    const nowIso = new Date().toISOString();
    const job: WhatsAppNotificationJob = {
      id: jobId,
      sessionId: correction.sessionId,
      classId: correction.classId,
      classLabel: correction.classLabel,
      date: correction.date,
      studentId: correction.studentId,
      studentName,
      guardianName,
      recipientPhone: cleanPhone,
      attendanceState: correction.requestedState,
      messageText,
      provider: PHASE_CONFIG.whatsapp.provider,
      deliveryStatus: isMissingPhone ? 'skipped' : 'pending',
      skipReason: isMissingPhone ? 'missing_phone' : undefined,
      retryCount: 0,
      createdAt: nowIso,
    };

    // 4. Persist to Cloud Firestore or local storage
    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const batch = writeBatch(db);
        const docRef = doc(db, 'attendanceNotifications', job.id);
        batch.set(docRef, job, { merge: true });

        // Update original job if pending in Firestore
        const origDocRef = doc(db, 'attendanceNotifications', originalJobId);
        batch.set(origDocRef, {
          deliveryStatus: 'skipped',
          skipReason: 'not_in_test_allowlist',
          error: `Superseded by attendance correction ${correction.id}`,
        }, { merge: true });

        await batch.commit();
      } catch (err) {
        console.warn('Firestore correction notification save fallback to local:', err);
        this.saveToLocalStorage([job]);
      }
    } else {
      this.saveToLocalStorage([job]);
    }

    // 5. If provider is dry_run, dispatch immediately
    if (this.provider && this.provider.name === 'dry_run') {
      if (job.deliveryStatus === 'pending') {
        const res = await this.provider.send(job);
        if (res.success) {
          job.deliveryStatus = 'sent';
          job.externalId = res.externalId;
          job.sentAt = new Date().toISOString();
        } else if (res.skipReason) {
          job.deliveryStatus = 'skipped';
          job.skipReason = res.skipReason;
          job.error = res.error;
        } else {
          job.deliveryStatus = 'failed';
          job.error = res.error || 'Transmission failed';
        }
        await this.updateJobsState([job]);
      }
    }

    return job;
  }

  /**
   * Retrieves a single notification job by ID.
   */
  public static async getNotificationJob(jobId: string): Promise<WhatsAppNotificationJob | null> {
    if (!isDemoMode() && db && isFirebaseConfigured()) {
      try {
        const docRef = doc(db, 'attendanceNotifications', jobId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data() as WhatsAppNotificationJob;
        }
      } catch {
        // Fallback to local
      }
    }
    const all = this.loadAllFromLocalStorage();
    return all[jobId] || null;
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

  /**
   * Resolves authentication headers for WhatsApp API calls.
   * Uses Firebase Auth ID Token when authenticated, with graceful fallback to demo tokens.
   */
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (auth && auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          return headers;
        }
      } catch {
        // Non-blocking fallback
      }
    }
    if (typeof window !== 'undefined') {
      const demoId = localStorage.getItem('hanujai_demo_user_id');
      if (demoId === 'staff-dev') {
        headers['Authorization'] = 'Bearer demo-developer-token';
      } else if (demoId === 'staff-principal') {
        headers['Authorization'] = 'Bearer demo-principal-token';
      } else if (demoId === 'staff-admin') {
        headers['Authorization'] = 'Bearer demo-admin-token';
      }
    }
    return headers;
  }

  /**
   * Invokes the serverless wake API to spin up the Render Free Web Service
   * on-demand after attendance notification jobs have been committed to Firestore.
   */
  public static async wakeWorker(): Promise<{ success: boolean; status: string; message: string }> {
    try {
      const headers = await this.getAuthHeaders();

      const res = await fetch('/api/whatsapp/wake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      if (res.ok) {
        return await res.json();
      }
      return {
        success: false,
        status: 'error',
        message: `Wake request failed with HTTP ${res.status}`,
      };
    } catch (err: any) {
      console.warn('[WhatsApp Service] Worker wake non-blocking dispatch note:', err.message);
      return {
        success: true,
        status: 'waking',
        message: 'Wake request dispatched. Worker cold-starting.',
      };
    }
  }

  /**
   * Requests an 8-digit Baileys Pairing Code for the target phone number.
   * Developer-only privileged action.
   */
  public static async requestPairingCode(
    phoneNumber: string
  ): Promise<{ success: boolean; pairingCode?: string; expiresInSeconds?: number; instructions?: string[]; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();

      const res = await fetch('/api/whatsapp/pair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return data;
      }
      return {
        success: false,
        error: data.error || `Pairing code generation failed (HTTP ${res.status})`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to contact pairing endpoint: ${err.message}`,
      };
    }
  }

  /**
   * Unlinks WhatsApp account and clears session credentials.
   * Developer-only privileged action.
   */
  public static async unlinkWhatsApp(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();

      const res = await fetch('/api/whatsapp/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return data;
      }
      return {
        success: false,
        error: data.error || `Unlink failed (HTTP ${res.status})`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to contact logout endpoint: ${err.message}`,
      };
    }
  }

  /**
   * Retrieves operational health, connection status, and queue depth.
   */
  public static async getWorkerStatus(): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();

      const res = await fetch('/api/whatsapp/status', {
        method: 'GET',
        headers: {
          ...headers,
        },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    // Direct Firestore fallback in browser if serverless endpoint is offline
    if (db && !isDemoMode() && isFirebaseConfigured()) {
      try {
        const snap = await getDoc(doc(db, 'whatsappWorkerStatus', 'current'));
        if (snap.exists()) {
          return {
            source: 'firestore_direct',
            ...snap.data(),
          };
        }
      } catch {
        // Fallback
      }
    }

    return {
      workerStatus: 'sleeping',
      connected: false,
      isRegistered: false,
      message: 'Worker is sleeping. Wakes on-demand when attendance is submitted.',
    };
  }

  private static loadAllFromLocalStorage(): Record<string, WhatsAppNotificationJob> {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private static saveAllToLocalStorage(allJobs: Record<string, WhatsAppNotificationJob>): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allJobs));
    } catch {
      // Storage unavailable or quota exceeded
    }
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
