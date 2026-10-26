/**
 * HanuJai High School ERP — WhatsApp Notification Service Types
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 */

import type { AttendanceState } from '../../domain/types';

export type NotificationDeliveryStatus = 
  | 'pending'      // Enqueued in database, awaiting sender worker
  | 'processing'   // Picked up by provider
  | 'sent'         // Dispatched / accepted by WhatsApp network or simulated in dry-run
  | 'failed'       // Transient or permanent transmission error
  | 'skipped';     // Skipped due to missing contact, absent consent, or allowlist restriction

export type NotificationSkipReason = 
  | 'missing_phone'
  | 'no_consent'
  | 'not_in_test_allowlist'
  | 'invalid_phone_format';

export interface WhatsAppNotificationJob {
  id: string; // Deterministic idempotency key: `att_${sessionId}_${studentId}`
  sessionId: string;
  classId: string;
  classLabel: string;
  date: string;
  studentId: string;
  studentName: string;
  guardianName: string;
  recipientPhone: string;
  attendanceState: AttendanceState;
  messageText: string;
  provider: 'dry_run' | 'baileys' | 'cloud_api';
  deliveryStatus: NotificationDeliveryStatus;
  skipReason?: NotificationSkipReason;
  externalId?: string;
  error?: string;
  retryCount: number;
  createdAt: string;
  sentAt?: string;
}

export interface WhatsAppStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  providerMode: 'dry_run' | 'baileys' | 'cloud_api';
  isLiveEnabled: boolean;
}

export interface SendResult {
  success: boolean;
  externalId?: string;
  skipReason?: NotificationSkipReason;
  error?: string;
}

export interface WhatsAppProvider {
  name: string;
  send(job: WhatsAppNotificationJob): Promise<SendResult>;
  getStatus(): Promise<{ ready: boolean; details: string }>;
}
