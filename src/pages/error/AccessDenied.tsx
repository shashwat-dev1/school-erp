import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AccessDenied: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <div
      style={{
        padding: '64px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: '560px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--hhs-radius-container)',
          backgroundColor: 'var(--hhs-danger-light)',
          border: '1px solid #f0bcb8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
        }}
      >
        <ShieldAlert size={28} color="var(--hhs-danger)" />
      </div>

      <span className="hhs-badge hhs-badge-danger" style={{ marginBottom: '12px' }}>
        Access Restricted • Desk Authorization Required
      </span>

      <h1 className="hhs-headline-lg" style={{ marginBottom: '8px' }}>
        Desk Authorization Policy
      </h1>

      <p className="hhs-body-md" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '24px' }}>
        Your current role (<strong>{currentUser?.role || 'Unassigned'}</strong>) does not hold clearance for this institutional screen. School policy strictly enforces separation of concerns between Principal, Registrar, Class Tutors, and Faculty.
      </p>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => navigate(-1)}
          className="hhs-btn hhs-btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={15} />
          <span>Return to Previous Screen</span>
        </button>

        <button
          onClick={() => navigate('/')}
          className="hhs-btn hhs-btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Home size={15} />
          <span>Go to Operations Hub</span>
        </button>
      </div>
    </div>
  );
};
