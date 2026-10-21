import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppShell: React.FC = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--hhs-canvas)' }}>
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Operational Canvas */}
      <div
        style={{
          marginLeft: 'var(--hhs-sidebar-width)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <Topbar />

        <main
          style={{
            flex: 1,
            padding: '24px 32px',
            maxWidth: '1280px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </main>

        <footer
          style={{
            padding: '16px 32px',
            borderTop: '1px solid var(--hhs-border)',
            backgroundColor: 'var(--hhs-surface)',
            fontSize: '0.74rem',
            color: 'var(--hhs-text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>HanuJai High School ERP</strong> &#8226; Jaipur, Rajasthan, India &#8226; Est. 1998
          </div>
          <div>
            Academic Session 2025–2026 &#8226; Internal Operational Platform
          </div>
        </footer>
      </div>
    </div>
  );
};
