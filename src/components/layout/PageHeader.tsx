import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  roleScope?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  badge,
  roleScope,
}) => {
  return (
    <div
      style={{
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.74rem',
            color: 'var(--hhs-text-secondary)',
          }}
        >
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>/</span>}
              {b.to ? (
                <Link
                  to={b.to}
                  style={{
                    color: 'var(--hhs-text-secondary)',
                    textDecoration: 'none',
                  }}
                >
                  {b.label}
                </Link>
              ) : (
                <span style={{ color: 'var(--hhs-text-primary)', fontWeight: 600 }}>{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title & Actions Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="hhs-headline-lg">{title}</h1>
            {roleScope && (
              <span className="hhs-badge hhs-badge-primary">
                {roleScope}
              </span>
            )}
            {badge && <span>{badge}</span>}
          </div>
          {subtitle && (
            <p className="hhs-body-sm" style={{ marginTop: '2px', color: 'var(--hhs-text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="hhs-page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
