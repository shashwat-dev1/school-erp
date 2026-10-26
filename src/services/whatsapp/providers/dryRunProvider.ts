/**
 * HanuJai High School ERP — WhatsApp Dry-Run / Preview Provider
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 * 
 * Safely simulates WhatsApp notification delivery without sending real messages
 * or requiring live network credentials.
 */

import type { WhatsAppProvider, WhatsAppNotificationJob, SendResult } from '../types';
import { PHASE_CONFIG } from '../../../config/phase';

export class DryRunWhatsAppProvider implements WhatsAppProvider {
  public name = 'dry_run';

  public async send(job: WhatsAppNotificationJob): Promise<SendResult> {
    const cleanPhone = (job.recipientPhone || '').trim();

    // 1. Check for missing phone number
    if (!cleanPhone || cleanPhone === '+91' || cleanPhone === '+91 98290') {
      return {
        success: false,
        skipReason: 'missing_phone',
        error: 'Parent phone number is empty or incomplete in student dossier.',
      };
    }

    // 2. In live mode with restricted test allowlist:
    if (PHASE_CONFIG.whatsapp.sendEnabled && PHASE_CONFIG.whatsapp.testRecipientAllowlist.length > 0) {
      const isAllowed = PHASE_CONFIG.whatsapp.testRecipientAllowlist.some(allowed => 
        cleanPhone.replace(/\D/g, '').endsWith(allowed.replace(/\D/g, ''))
      );
      if (!isAllowed) {
        return {
          success: false,
          skipReason: 'not_in_test_allowlist',
          error: `Recipient ${cleanPhone} is not on the verified test-recipient allowlist.`,
        };
      }
    }

    // 3. Successful simulated transmission
    const simulatedId = `dry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.info(`[WhatsApp Dry-Run] ✓ Simulated dispatch to ${job.guardianName} (${cleanPhone}): "${job.messageText}"`);

    return {
      success: true,
      externalId: simulatedId,
    };
  }

  public async getStatus(): Promise<{ ready: boolean; details: string }> {
    return {
      ready: true,
      details: 'Safe Preview / Dry-Run Mode Active (Zero network messages sent)',
    };
  }
}
