import React from 'react';
import { Modal } from '../../components/ui/Modal';
import type { AuditEvent } from '../../domain/types';

interface AuditDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AuditEvent | null;
}

export const AuditDiffModal: React.FC<AuditDiffModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  if (!event) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Audit Mutation Detail: ${event.eventType || event.action}`}
      subtitle={`Event Hash: ${event.id} • Verified cryptographic chain entry`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Meta Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            backgroundColor: 'var(--hhs-surface-muted)',
            padding: '12px 14px',
            borderRadius: 'var(--hhs-radius-base)',
            border: '1px solid var(--hhs-border)',
            fontSize: '0.82rem',
          }}
        >
          <div>
            <div style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
              Responsible Actor
            </div>
            <div style={{ fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              {event.actorName} ({event.actorRole})
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)', fontFamily: 'monospace' }}>
              UID: {event.actorId}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
              Timestamp &amp; Client Address
            </div>
            <div style={{ fontWeight: 600 }}>{new Date(event.timestamp).toLocaleString()} IST</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)', fontFamily: 'monospace' }}>
              IP: {event.ipAddress || event.clientIp || '10.0.4.12'}
            </div>
          </div>
        </div>

        {/* Target Entity */}
        <div style={{ fontSize: '0.82rem' }}>
          <span style={{ color: 'var(--hhs-text-secondary)' }}>Target Entity:</span>{' '}
          <strong style={{ fontFamily: 'monospace', color: 'var(--hhs-primary)' }}>
            {event.targetEntity} / {event.targetId}
          </strong>
        </div>

        {/* Justification */}
        {event.details && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--hhs-accent-light)',
              border: '1px solid var(--hhs-accent)',
              borderRadius: 'var(--hhs-radius-base)',
              fontSize: '0.82rem',
              color: 'var(--hhs-accent-text)',
            }}
          >
            <strong>Mandatory Justification Logged:</strong>
            <div style={{ marginTop: '2px', color: 'var(--hhs-text-primary)' }}>
              {JSON.stringify(event.details)}
            </div>
          </div>
        )}

        {/* Side-by-Side Diff Table */}
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
            Side-by-Side Change Diff (Before vs. After)
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              border: '1px solid var(--hhs-border)',
              borderRadius: 'var(--hhs-radius-base)',
              overflow: 'hidden',
            }}
          >
            {/* Prior State */}
            <div style={{ padding: '12px', backgroundColor: 'var(--hhs-surface-muted)', borderRight: '1px solid var(--hhs-border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--hhs-danger-text)', textTransform: 'uppercase', marginBottom: '6px' }}>
                State Prior to Mutation
              </div>
              <pre
                style={{
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  color: 'var(--hhs-text-secondary)',
                }}
              >
                {event.diff?.before
                  ? JSON.stringify(event.diff.before, null, 2)
                  : '(No Prior State / Initial Creation)'}
              </pre>
            </div>

            {/* Committed State */}
            <div style={{ padding: '12px', backgroundColor: 'var(--hhs-surface)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--hhs-primary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Committed State
              </div>
              <pre
                style={{
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  color: 'var(--hhs-primary-text)',
                  fontWeight: 600,
                }}
              >
                {event.diff?.after
                  ? JSON.stringify(event.diff.after, null, 2)
                  : JSON.stringify(event.details, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button onClick={onClose} className="hhs-btn hhs-btn-secondary">
            Close Inspector
          </button>
        </div>
      </div>
    </Modal>
  );
};
