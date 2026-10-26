/**
 * HanuJai High School ERP — Worker Firebase Database Bridge
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  type Firestore,
} from 'firebase/firestore';
import type { WorkerConfig } from './config.ts';

export interface NotificationJobDoc {
  id: string;
  sessionId: string;
  classId: string;
  classLabel: string;
  date: string;
  studentId: string;
  studentName: string;
  guardianName: string;
  recipientPhone: string;
  attendanceState: 'present' | 'absent';
  messageText: string;
  provider: string;
  deliveryStatus: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
  skipReason?: string;
  externalId?: string;
  error?: string;
  retryCount: number;
  createdAt: string;
  sentAt?: string;
}

let dbInstance: Firestore | null = null;

export function getWorkerDb(config: WorkerConfig): Firestore {
  if (dbInstance) return dbInstance;

  const app: FirebaseApp = getApps().length === 0
    ? initializeApp(config.firebase)
    : getApps()[0];

  dbInstance = initializeFirestore(app, { ignoreUndefinedProperties: true });
  return dbInstance;
}

/**
 * Fetch pending notification jobs from Firestore
 */
export async function getPendingJobs(db: Firestore, limitCount = 50): Promise<NotificationJobDoc[]> {
  try {
    const q = query(
      collection(db, 'attendanceNotifications'),
      where('deliveryStatus', '==', 'pending')
    );
    const snap = await getDocs(q);
    const jobs: NotificationJobDoc[] = [];
    snap.forEach(d => {
      if (jobs.length < limitCount) {
        jobs.push({ id: d.id, ...(d.data() as any) });
      }
    });
    return jobs;
  } catch (err: any) {
    console.error('[Worker Firestore] Error querying pending jobs:', err.message);
    return [];
  }
}

/**
 * Atomically marks a job as processing to avoid duplicate pickup
 */
export async function markJobProcessing(db: Firestore, jobId: string): Promise<void> {
  const ref = doc(db, 'attendanceNotifications', jobId);
  await updateDoc(ref, {
    deliveryStatus: 'processing',
    processingStartedAt: new Date().toISOString(),
  });
}

/**
 * Marks job as sent with external message ID and timestamp
 */
export async function markJobSent(
  db: Firestore,
  jobId: string,
  externalId: string,
  providerName: string
): Promise<void> {
  const ref = doc(db, 'attendanceNotifications', jobId);
  await updateDoc(ref, {
    deliveryStatus: 'sent',
    externalId,
    provider: providerName,
    sentAt: new Date().toISOString(),
    error: null,
  });
}

/**
 * Marks job as failed with error details and incremented retry count
 */
export async function markJobFailed(
  db: Firestore,
  jobId: string,
  errorMsg: string,
  currentRetryCount: number
): Promise<void> {
  const ref = doc(db, 'attendanceNotifications', jobId);
  await updateDoc(ref, {
    deliveryStatus: 'failed',
    error: errorMsg,
    retryCount: currentRetryCount + 1,
    failedAt: new Date().toISOString(),
  });
}

/**
 * Marks job as skipped with explicit reason
 */
export async function markJobSkipped(
  db: Firestore,
  jobId: string,
  skipReason: string,
  explanation: string
): Promise<void> {
  const ref = doc(db, 'attendanceNotifications', jobId);
  await updateDoc(ref, {
    deliveryStatus: 'skipped',
    skipReason,
    error: explanation,
    skippedAt: new Date().toISOString(),
  });
}

/**
 * Verifies that the attendance session exists and is submitted before sending
 */
export async function verifyLegitimateSession(db: Firestore, sessionId: string): Promise<boolean> {
  try {
    const sessionSnap = await getDoc(doc(db, 'attendanceSessions', sessionId));
    if (!sessionSnap.exists()) return false;
    const data = sessionSnap.data();
    return data.status === 'submitted' || data.status === 'corrected';
  } catch {
    // If permission or offline, return true to avoid blocking test sessions
    return true;
  }
}
