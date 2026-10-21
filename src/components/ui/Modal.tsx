import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '540px',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="hhs-modal-backdrop" onClick={onClose}>
      <div
        className="hhs-modal-sheet"
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="hhs-card-header">
          <div>
            <h3 className="hhs-headline-sm">{title}</h3>
            {subtitle && (
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--hhs-text-secondary)', display: 'flex' }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="hhs-card-body">{children}</div>

        {footer && (
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: 'var(--hhs-surface-muted)',
              borderTop: '1px solid var(--hhs-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="hhs-body-md" style={{ color: 'var(--hhs-text-primary)' }}>
        {message}
      </p>
    </Modal>
  );
};
