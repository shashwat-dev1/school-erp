import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const variantClass = `hhs-btn-${variant}`;
  const sizeClass = size === 'sm' ? 'hhs-btn-sm' : size === 'lg' ? 'hhs-btn-lg' : '';

  return (
    <button
      className={`hhs-btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span style={{ width: '14px', height: '14px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
      ) : (
        icon && <span style={{ display: 'inline-flex' }}>{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
