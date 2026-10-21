import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = '480px',
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
    <div className="hhs-modal-backdrop" onClick={onClose} style={{ justifyContent: 'flex-end', padding: 0 }}>
      <div
        style={{
          width,
          maxWidth: '100%',
          height: '100%',
          backgroundColor: 'var(--hhs-surface)',
          borderLeft: '1px solid var(--hhs-border)',
          boxShadow: 'var(--hhs-shadow-level-3)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--hhs-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: 'var(--hhs-surface)',
          }}
        >
          <div>
            <h3 className="hhs-headline-sm">{title}</h3>
            {subtitle && <p className="hhs-body-sm" style={{ marginTop: '2px' }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--hhs-text-secondary)',
              display: 'flex',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>{children}</div>

        {footer && (
          <div
            style={{
              padding: '12px 20px',
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
