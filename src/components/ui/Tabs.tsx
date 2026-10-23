import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div
      role="tablist"
      className={`hhs-tabs-container ${className}`}
      style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '2px solid var(--hhs-border)',
        backgroundColor: 'transparent',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              minHeight: '44px',
              flexShrink: 0,
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '0.84rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--pop-deep-violet)' : 'var(--hhs-text-secondary)',
              cursor: 'pointer',
              position: 'relative',
              whiteSpace: 'nowrap',
              borderBottom: isActive ? '3px solid var(--pop-deep-violet)' : '3px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.16s ease',
            }}
          >
            {tab.icon && <span style={{ display: 'inline-flex', color: isActive ? 'var(--pop-deep-violet)' : 'inherit' }}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '1px 7px',
                  borderRadius: '9999px',
                  backgroundColor: isActive ? 'var(--pop-deep-violet-tint)' : 'var(--hhs-surface-muted)',
                  color: isActive ? 'var(--pop-deep-violet)' : 'var(--hhs-text-secondary)',
                  fontWeight: 700,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
