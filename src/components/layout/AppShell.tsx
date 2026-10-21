import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppShell: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--hhs-canvas)' }}>
      {/* Responsive Left Sidebar */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Operational Canvas */}
      <div className="hhs-main-layout">
        <Topbar onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} />

        <main className="hhs-main-canvas">
          <Outlet />
        </main>

        <footer
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--hhs-border)',
            backgroundColor: 'var(--hhs-surface)',
            fontSize: '0.74rem',
            color: 'var(--hhs-text-secondary)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
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
