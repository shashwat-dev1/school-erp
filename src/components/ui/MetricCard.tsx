import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  subtext?: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral' | string | { value: string; isPositive?: boolean };
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
  subtext,
  subValue,
  trend,
  trendLabel,
  accent = 'primary',
  icon,
  badge,
  className = '',
}) => {
  const displaySub = subtext || subValue || subtitle;

  let computedTrendLabel = trendLabel;
  let isPositiveTrend: boolean | undefined = undefined;

  if (typeof trend === 'object' && trend !== null) {
    computedTrendLabel = trend.value;
    isPositiveTrend = trend.isPositive;
  } else if (typeof trend === 'string') {
    if (trend === 'up') isPositiveTrend = true;
    else if (trend === 'down') isPositiveTrend = false;
  }

  return (
    <div className={`hhs-metric-card ${accent} ${className}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="hhs-metric-label">{label}</span>
        {icon && <span style={{ color: 'var(--hhs-text-secondary)', display: 'inline-flex' }}>{icon}</span>}
      </div>

      <div className="hhs-metric-value">{value}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        {displaySub && <span className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>{displaySub}</span>}
        {computedTrendLabel && (
          <span
            className="hhs-badge"
            style={{
              fontSize: '0.68rem',
              color: isPositiveTrend === true
                ? 'var(--hhs-primary-text)'
                : isPositiveTrend === false
                ? 'var(--hhs-danger-text)'
                : 'inherit',
              backgroundColor: isPositiveTrend === true
                ? 'var(--hhs-primary-light)'
                : isPositiveTrend === false
                ? 'var(--hhs-danger-light)'
                : 'var(--hhs-surface-muted)',
            }}
          >
            {computedTrendLabel}
          </span>
        )}
        {badge && <span>{badge}</span>}
      </div>
    </div>
  );
};
