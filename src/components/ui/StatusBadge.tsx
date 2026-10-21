import React from 'react';

export type BadgeVariant = 'primary' | 'accent' | 'danger' | 'neutral';

export interface StatusBadgeProps {
  label?: string;
  status?: string;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  status,
  variant,
  icon,
  className = '',
}) => {
  const displayLabel = label || status || '';

  // Infer variant if not explicitly given
  let computedVariant: BadgeVariant = variant || 'neutral';
  if (!variant && status) {
    const s = status.toLowerCase();
    if (s === 'enrolled' || s === 'active' || s === 'verified' || s === 'locked') {
      computedVariant = 'primary';
    } else if (s === 'alert' || s === 'critical' || s === 'suspended' || s === 'withdrawn') {
      computedVariant = 'danger';
    } else if (s === 'warning' || s === 'pending' || s === 'submitted' || s === 'draft') {
      computedVariant = 'accent';
    }
  }

  return (
    <span className={`hhs-badge hhs-badge-${computedVariant} ${className}`}>
      {icon && <span style={{ display: 'inline-flex', fontSize: '10px' }}>{icon}</span>}
      <span style={{ textTransform: 'capitalize' }}>{displayLabel}</span>
    </span>
  );
};
