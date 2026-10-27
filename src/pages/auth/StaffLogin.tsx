import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { initialStaff } from '../../data/demo/seedData';
import { Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import hanujaiLogo from '../../assets/hanujai_logo.png';

export const StaffLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error: authError } = useAuth();
  const { dataMode } = useData();

  const [email, setEmail] = useState('principal@hanujai.edu.in');
  const [password, setPassword] = useState('demo-password');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Return location if redirected from a guarded route
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setLocalError(msg);
    }
  };

  const selectPersona = (staffEmail: string) => {
    setEmail(staffEmail);
    setPassword(dataMode === 'demo' ? 'demo-password' : 'HanuJai#2026!');
    setLocalError(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--hhs-canvas)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Institutional Header */}
      <header
        style={{
          borderBottom: '1px solid var(--hhs-border)',
          backgroundColor: 'var(--hhs-surface)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={hanujaiLogo}
            alt="HanuJai High School Crest"
            style={{ height: '48px', width: '48px', objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--hhs-text-primary)' }}>
              HanuJai High School
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
              Jaipur, Rajasthan • Staff Administration ERP
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
          <span className="hhs-badge hhs-badge-primary" style={{ fontSize: '0.7rem' }}>
            CBSE Affiliated
          </span>
          <span style={{ color: 'var(--hhs-border)' }}>|</span>
          <span>Academic Session 2025–2026</span>
        </div>
      </header>

      {/* Main Form Center */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '440px' }}>
          {/* Card */}
          <div
            style={{
              backgroundColor: 'var(--hhs-surface)',
              borderRadius: 'var(--hhs-radius-container)',
              border: '1px solid var(--hhs-border)',
              boxShadow: 'var(--hhs-shadow-level-2)',
              padding: '32px',
            }}
          >
            {/* Header info */}
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                <img
                  src={hanujaiLogo}
                  alt="HanuJai High School Crest"
                  style={{
                    height: '68px',
                    width: '68px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 2px 8px rgba(31, 107, 255, 0.15))',
                  }}
                />
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span
                  style={{
                    backgroundColor: 'var(--pop-electric-blue-tint)',
                    color: 'var(--pop-electric-blue)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid var(--pop-electric-blue)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Authorized Staff Access
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--hhs-text-muted)' }}>
                  ({dataMode === 'demo' ? 'Sample Data' : 'Cloud Mode'})
                </span>
              </div>
              <h1 className="hhs-headline-md" style={{ marginBottom: '4px', fontSize: '1.3rem', fontWeight: 800 }}>
                Staff Authentication
              </h1>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                Single-school internal portal for Leadership and Teaching Faculty.
              </p>
            </div>

            {/* Error Message */}
            {(localError || authError) && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '12px 14px',
                  borderRadius: 'var(--hhs-radius-base)',
                  backgroundColor: 'var(--hhs-danger-light)',
                  border: '1px solid rgba(255, 77, 79, 0.35)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  color: 'var(--hhs-danger-text)',
                  fontSize: '0.82rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Authentication Failed</div>
                  <div>{localError || authError}</div>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="hhs-label" htmlFor="staff-email">
                  Staff ID or Institutional Email
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@hanujai.edu.in"
                  className="hhs-input"
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="hhs-label" htmlFor="staff-password" style={{ marginBottom: 0 }}>
                    Password
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
                    {dataMode === 'demo' ? 'Any password in demo' : 'Standard credentials'}
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="staff-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter security password"
                    className="hhs-input"
                    disabled={isLoading}
                    autoComplete="current-password"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--hhs-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--hhs-primary)' }} />
                  <span style={{ color: 'var(--hhs-text-secondary)' }}>Maintain active desk session</span>
                </label>
                <span className="tnum" style={{ color: 'var(--hhs-text-muted)', fontSize: '0.72rem' }}>
                  IST +05:30
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="hhs-btn hhs-btn-primary"
                style={{
                  width: '100%',
                  height: '40px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '8px',
                }}
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Quick Staff Persona Switcher (Allows reviewers to easily sign in) */}
            <div
              style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid var(--hhs-border)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--hhs-text-secondary)',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ShieldCheck size={14} color="var(--hhs-primary)" />
                <span>Select Authorized Staff Persona:</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                {initialStaff.slice(0, 3).map(s => {
                  const isSelected = email.toLowerCase() === s.email.toLowerCase();
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectPersona(s.email)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 'var(--hhs-radius-base)',
                        border: isSelected ? '1px solid var(--hhs-primary)' : '1px solid var(--hhs-border)',
                        backgroundColor: isSelected ? 'var(--hhs-primary-light)' : 'var(--hhs-surface-hover)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.74rem', color: isSelected ? 'var(--hhs-primary)' : 'var(--hhs-text-primary)' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--hhs-text-secondary)' }}>
                        {s.designation}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer security pill */}
          <div
            style={{
              marginTop: '16px',
              textAlign: 'center',
              fontSize: '0.72rem',
              color: 'var(--hhs-text-muted)',
              lineHeight: 1.4,
            }}
          >
            <div>HanuJai High School ERP • Jaipur, Rajasthan</div>
            <div>Single-School Operational Pilot • Academic Year 2025–2026</div>
          </div>
        </div>
      </main>

      {/* Institutional bottom footer */}
      <footer
        style={{
          borderTop: '1px solid var(--hhs-border)',
          backgroundColor: 'var(--hhs-surface)',
          padding: '12px 24px',
          fontSize: '0.72rem',
          color: 'var(--hhs-text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>© 2025–2026 HanuJai High School, Vidyadhar Nagar, Jaipur, Rajasthan 302039</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>Campus Desk: +91 141 2234567</span>
          <span>•</span>
          <span>admin.it@hanujai.edu.in</span>
        </div>
      </footer>
    </div>
  );
};
