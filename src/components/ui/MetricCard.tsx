import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral' | string;
  trendLabel?: string;
  accent?: 'primary' | 'accent' | 'danger' | 'info';
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  subValue,
  trend,
  trendLabel,
  accent = 'primary',
  icon,
  badge,
  className = '',
}) => {
  const displaySub = subValue || subtitle;

  return (
    <div className={`hhs-metric-card ${accent} ${className}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="hhs-metric-label">{label}</span>
        {icon && <span style={{ color: 'var(--hhs-text-secondary)', display: 'inline-flex' }}>{icon}</span>}
      </div>

      <div className="hhs-metric-value">{value}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        {displaySub && <span className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>{displaySub}</span>}
        {trendLabel && (
          <span
            className="hhs-badge"
            style={{
              fontSize: '0.68rem',
              color: trend === 'up' ? 'var(--hhs-primary-text)' : trend === 'down' ? 'var(--hhs-danger-text)' : 'inherit',
              backgroundColor: trend === 'up' ? 'var(--hhs-primary-light)' : trend === 'down' ? 'var(--hhs-danger-light)' : 'var(--hhs-surface-muted)',
            }}
          >
            {trendLabel}
          </span>
        )}
        {badge && <span>{badge}</span>}
      </div>
    </div>
  );
};
