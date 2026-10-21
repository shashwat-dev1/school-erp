import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../ui/Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Records Found',
  description = 'There are no active records matching the selected parameters.',
  icon,
  actionLabel,
  onAction,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        backgroundColor: 'var(--hhs-surface)',
        border: '1px solid var(--hhs-border)',
        borderRadius: 'var(--hhs-radius-container)',
        textAlign: 'center',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: 'var(--hhs-surface-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--hhs-text-secondary)',
          marginBottom: '8px',
        }}
      >
        {icon || <Inbox size={22} />}
      </div>
      <h4 className="hhs-headline-sm">{title}</h4>
      <p className="hhs-body-sm" style={{ maxWidth: '380px', color: 'var(--hhs-text-secondary)' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <div style={{ marginTop: '12px' }}>
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
