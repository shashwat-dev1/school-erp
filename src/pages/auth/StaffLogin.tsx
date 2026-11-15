/**
 * HanuJai High School ERP — Staff Desk Authentication
 * Design Identity: Regal Academic SaaS
 * Institutional Gateway for Leadership and Teaching Faculty
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { initialStaff, defaultDeveloperUser } from '../../data/demo/seedData';
import { Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import hanujaiLogo from '../../assets/hanujai_logo.png';

export const StaffLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error: authError } = useAuth();

  const [email, setEmail] = useState('admin@hanujai.edu.in');
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
    setPassword('demo-password');
    setLocalError(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      {/* Outer Regal Academic Container */}
      <div
        className="hhs-login-card-container"
        style={{
          width: '100%',
          maxWidth: '920px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 25px -5px rgba(10, 25, 49, 0.12), 0 8px 10px -6px rgba(10, 25, 49, 0.06)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '1.05fr 1.2fr',
        }}
      >
        <style>{`
          @media (max-width: 820px) {
            .hhs-login-card-container {
              grid-template-columns: 1fr !important;
              max-width: 440px !important;
              margin: 0 auto !important;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
            }
            .hhs-login-brand-panel {
              display: none !important;
            }
            .hhs-login-mobile-brand-header {
              display: flex !important;
            }
            .hhs-login-form-panel {
              padding: 24px 20px !important;
            }
            .hhs-login-persona-grid {
              grid-template-columns: 1fr !important;
            }
            .hhs-input, .hhs-select, .hhs-textarea {
              font-size: 16px !important; /* Prevents iOS Safari auto-zoom */
            }
          }
          @media (min-width: 821px) {
            .hhs-login-mobile-brand-header {
              display: none !important;
            }
          }
        `}</style>

        {/* Left: Royal Navy Crest & Heritage Column */}
        <div
          className="hhs-login-brand-panel"
          style={{
            backgroundColor: '#0A1931',
            padding: '40px 32px',
            color: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
              <img
                src={hanujaiLogo}
                alt="HanuJai High School Crest"
                style={{
                  height: '64px',
                  width: '64px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
                }}
              />
              <div>
                <span
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 800,
                    fontSize: '1.25rem',
                    color: '#FFFFFF',
                    lineHeight: 1.2,
                    display: 'block',
                  }}
                >
                  HanuJai High School
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#F5A623',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Endeavor to Excel
                </span>
              </div>
            </div>

            <p style={{ color: '#CBD5E1', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '20px' }}>
              Staff portal for daily attendance and student management.
            </p>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px', fontSize: '0.72rem', color: '#64748B' }}>
            HanuJai High School
          </div>
        </div>

        {/* Right: Authentication Form & Quick Persona Selector */}
        <div
          className="hhs-login-form-panel"
          style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          {/* Mobile Brand Header (Visible only on <= 820px) */}
          <div
            className="hhs-login-mobile-brand-header"
            style={{
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid #E2E8F0',
            }}
          >
            <img
              src={hanujaiLogo}
              alt="HanuJai High School Crest"
              style={{
                height: '44px',
                width: '44px',
                objectFit: 'contain',
              }}
            />
            <div>
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  color: '#0A1931',
                  lineHeight: 1.2,
                  display: 'block',
                }}
              >
                HanuJai High School
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#D97706',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Endeavor to Excel • Jaipur
              </span>
            </div>
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <h2
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#0A1931',
                margin: '0 0 4px 0',
              }}
            >
              Staff Authentication
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>
              Enter your credentials to access your authorized workspace.
            </p>
          </div>

          {/* Error Message */}
          {(localError || authError) && (
            <div
              style={{
                marginBottom: '18px',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />
              <div>{localError || authError}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                Staff Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@hanujai.edu.in"
                className="hhs-input"
                style={{ height: '42px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}
                disabled={isLoading}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Password
                </label>
                <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                  Default: <code style={{ backgroundColor: '#F1F5F9', padding: '1px 5px', borderRadius: '4px', fontSize: '0.70rem' }}>demo-password</code>
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter security password"
                  className="hhs-input"
                  style={{ height: '42px', borderRadius: '8px', width: '100%', boxSizing: 'border-box', paddingRight: '40px' }}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                backgroundColor: '#0A1931',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                height: '44px',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(10, 25, 49, 0.25)',
                marginTop: '4px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#152238')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0A1931')}
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

          {/* Quick Demo Persona Switcher */}
          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #E2E8F0' }}>
            <div
              style={{
                fontSize: '0.70rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#64748B',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={14} color="#0A1931" />
              <span>Demo Quick Sign In:</span>
            </div>

            <div
              className="hhs-login-persona-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}
            >
              {[
                defaultDeveloperUser,
                initialStaff.find(s => s.role === 'principal' && s.status === 'active'),
                initialStaff.find(s => s.role === 'admin' && s.status === 'active'),
              ]
                .filter(Boolean)
                .map((s: any) => {
                  const isSelected = email.toLowerCase() === s.email.toLowerCase();
                  const roleBadge = s.role === 'developer'
                    ? 'Developer'
                    : s.role === 'principal'
                    ? 'Principal'
                    : 'Admin Office';

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectPersona(s.email)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: isSelected ? '1.5px solid #F5A623' : '1px solid #E2E8F0',
                        backgroundColor: isSelected ? '#FEF3C7' : '#F8FAFC',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.76rem', color: isSelected ? '#92400E' : '#0A1931' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '2px' }}>
                        {roleBadge}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
