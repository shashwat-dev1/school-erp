import React from 'react';

export interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading operational records...' }) => {
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
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          border: '3px solid var(--hhs-border)',
          borderTopColor: 'var(--hhs-primary)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <span className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', fontWeight: 500 }}>
        {message}
      </span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
