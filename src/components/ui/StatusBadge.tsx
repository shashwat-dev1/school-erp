import React from 'react';

export type BadgeVariant =
  | 'primary'
  | 'accent'
  | 'danger'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'lime'
  | 'yellow'
  | 'violet'
  | 'pink'
  | 'vermilion'
  | 'orange'
  | 'blue'
  | 'green'
  | 'coral';

export interface StatusBadgeProps {
  label?: string;
  status?: string;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  className?: string;
  solid?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  status,
  variant,
  icon,
  className = '',
  solid = false,
}) => {
  const displayLabel = label || status || '';

  // Infer variant if not explicitly given
  let computedVariant: BadgeVariant = variant || 'neutral';
  if (!variant && status) {
    const s = status.toLowerCase();
    if (s === 'enrolled' || s === 'active' || s === 'verified' || s === 'locked') {
      computedVariant = 'primary'; // Electric Blue
    } else if (s === 'present') {
      computedVariant = 'success'; // Apple Green
    } else if (s === 'alert' || s === 'critical' || s === 'suspended' || s === 'withdrawn' || s === 'absent') {
      computedVariant = 'danger'; // Coral Red
    } else if (s === 'warning' || s === 'late') {
      computedVariant = 'warning'; // Tangerine Orange
    } else if (s === 'attention' || s === 'flagged' || s === 'notice') {
      computedVariant = 'yellow'; // Canary Yellow
    } else if (s === 'pending' || s === 'submitted' || s === 'draft') {
      computedVariant = 'accent'; // Hot Pink
    } else if (s === 'excused' || s === 'archived') {
      computedVariant = 'violet'; // Deep Violet
    }
  }

  const solidClass = solid ? `hhs-badge-solid-${computedVariant}` : `hhs-badge-${computedVariant}`;

  return (
    <span className={`hhs-badge ${solidClass} ${className}`}>
      {icon && <span style={{ display: 'inline-flex', fontSize: '10px' }}>{icon}</span>}
      <span style={{ textTransform: 'capitalize' }}>{displayLabel}</span>
    </span>
  );
};
