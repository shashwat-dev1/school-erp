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
      className={className}
      style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--hhs-border)',
        backgroundColor: 'transparent',
        overflowX: 'auto',
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '0.85rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--hhs-primary)' : 'var(--hhs-text-secondary)',
              cursor: 'pointer',
              position: 'relative',
              whiteSpace: 'nowrap',
              borderBottom: isActive ? '2px solid var(--hhs-primary)' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.15s ease',
            }}
          >
            {tab.icon && <span style={{ display: 'inline-flex' }}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  backgroundColor: isActive ? 'var(--hhs-primary-light)' : 'var(--hhs-surface-muted)',
                  color: isActive ? 'var(--hhs-primary-text)' : 'var(--hhs-text-secondary)',
                  fontWeight: 600,
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
