import React from 'react';

export interface FilterToolbarProps {
  children: React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  statusInfo?: React.ReactNode;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  children,
  onReset,
  resetLabel = 'Reset Filters',
  className = '',
  style,
  statusInfo,
}) => {
  return (
    <div
      className={`hhs-filter-toolbar ${className}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '12px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px', flex: '1 1 auto' }}>
        {children}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {statusInfo && (
          <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
            {statusInfo}
          </div>
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            style={{ height: 'var(--hhs-control-height)', padding: '0 12px' }}
          >
            {resetLabel}
          </button>
        )}
      </div>
    </div>
  );
};
