import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export type AlertType = 'danger' | 'warning' | 'info' | 'success';

export interface ErrorBannerProps {
  type?: AlertType;
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  type = 'danger',
  title,
  message,
  action,
  className = '',
}) => {
  const getStyles = () => {
    switch (type) {
      case 'warning':
        return {
          bg: 'var(--hhs-accent-light)',
          border: 'var(--hhs-accent)',
          text: 'var(--hhs-accent-text)',
          icon: <AlertTriangle size={18} />,
        };
      case 'info':
        return {
          bg: 'var(--hhs-info-light)',
          border: 'var(--hhs-info)',
          text: 'var(--hhs-info)',
          icon: <Info size={18} />,
        };
      case 'success':
        return {
          bg: 'var(--hhs-primary-light)',
          border: 'var(--hhs-primary)',
          text: 'var(--hhs-primary-text)',
          icon: <CheckCircle2 size={18} />,
        };
      default:
        return {
          bg: 'var(--hhs-danger-light)',
          border: 'var(--hhs-danger)',
          text: 'var(--hhs-danger-text)',
          icon: <AlertCircle size={18} />,
        };
    }
  };

  const style = getStyles();

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--hhs-radius-container)',
        color: style.text,
        fontSize: '0.85rem',
      }}
    >
      <span style={{ display: 'flex', marginTop: '1px', flexShrink: 0 }}>{style.icon}</span>
      <div style={{ flex: 1 }}>
        {title && <strong style={{ display: 'block', marginBottom: '2px', fontWeight: 600 }}>{title}</strong>}
        <span style={{ lineHeight: 1.4 }}>{message}</span>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
