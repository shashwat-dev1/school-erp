import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        padding: '64px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: '520px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--hhs-radius-container)',
          backgroundColor: 'var(--hhs-surface-muted)',
          border: '1px solid var(--hhs-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
        }}
      >
        <FileQuestion size={28} color="var(--hhs-text-secondary)" />
      </div>

      <span className="hhs-badge hhs-badge-accent" style={{ marginBottom: '12px' }}>
        HTTP 404 • Operational Route Missing
      </span>

      <h1 className="hhs-headline-lg" style={{ marginBottom: '8px' }}>
        Record or Screen Not Found
      </h1>

      <p className="hhs-body-md" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '24px' }}>
        The requested school ledger, session, or record URL does not exist or has been archived under another academic session.
      </p>

      <button
        onClick={() => navigate('/')}
        className="hhs-btn hhs-btn-primary"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <Home size={15} />
        <span>Return to Operations Hub</span>
      </button>
    </div>
  );
};
