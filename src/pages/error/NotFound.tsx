import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const homeLabel =
    currentUser?.role === 'class_teacher'
      ? 'Return to My Class'
      : currentUser?.role === 'subject_teacher'
      ? 'Return to My Classes'
      : 'Return to Home';

  return (
    <div
      style={{
        padding: '64px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: '480px',
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
        Page Not Found
      </span>

      <h1 className="hhs-headline-lg" style={{ marginBottom: '8px' }}>
        We couldn't find this page
      </h1>

      <p className="hhs-body-md" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '24px' }}>
        The link you followed may be incorrect or the requested school record could not be found.
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => navigate(-1)}
          className="hhs-btn hhs-btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={15} />
          <span>Go Back</span>
        </button>

        <button
          onClick={() => navigate('/')}
          className="hhs-btn hhs-btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Home size={15} />
          <span>{homeLabel}</span>
        </button>
      </div>
    </div>
  );
};
