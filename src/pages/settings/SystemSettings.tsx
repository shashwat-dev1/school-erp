import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { SchoolSettings } from '../../domain/types';
import {
  Save,
  RotateCcw,
  CheckCircle2,
  Database,
} from 'lucide-react';

export const SystemSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const { provider, isDemo } = useData();

  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await provider.getSchoolSettings();
        if (!isMounted) return;
        setSettings(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load system settings.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !currentUser) return;
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await provider.updateSchoolSettings(settings, currentUser);
      setSettings(updated);
      setSuccessMsg('Institutional Identity and Configuration successfully saved to audit register.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update system settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDemoData = async () => {
    if (!window.confirm('Are you sure you want to reset all data back to the clean demonstration seed state? Any modifications made during this demo session will be reset.')) {
      return;
    }

    setIsResetting(true);
    try {
      if (provider.resetDemoData) {
        await provider.resetDemoData();
      }
      alert('Demo data successfully reinitialized to original pilot seed state. Page will reload.');
      window.location.reload();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reset demo data.');
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading || !settings) {
    return <LoadingState message="Loading system configuration..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Institutional System & Identity Configuration"
        subtitle="School identity, CBSE affiliation credentials, localized timezones, and pilot demo controls."
        roleScope="System Governance"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Settings', to: '/settings/system-config' },
        ]}
      />

      {error && <ErrorBanner message={error} />}
      {successMsg && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--hhs-primary-light)',
            color: 'var(--hhs-primary-text)',
            borderRadius: 'var(--hhs-radius-base)',
            border: '1px solid var(--hhs-primary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Demo Mode Notice & Reset Panel */}
      {isDemo && (
        <div
          className="hhs-panel"
          style={{
            borderLeft: '4px solid var(--hhs-accent)',
            backgroundColor: 'var(--hhs-accent-light)',
            marginBottom: '20px',
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--hhs-accent-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={16} />
              <span>Interactive Pilot Demo Mode Active</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--hhs-text-primary)', lineHeight: 1.4 }}>
              Operating on synthetic, deterministic in-browser storage. Changes persist across reloads in this browser. You can reset to the original clean sample dataset at any time.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetDemoData}
            disabled={isResetting}
            className="hhs-btn hhs-btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff' }}
          >
            <RotateCcw size={14} />
            <span>{isResetting ? 'Resetting...' : 'Reset to Clean Demo Data'}</span>
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Institutional Identity Card */}
          <div className="hhs-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              Institutional Identity
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="hhs-label" htmlFor="school-name">School Formal Name</label>
                <input
                  id="school-name"
                  required
                  className="hhs-input"
                  value={settings.institutionName}
                  onChange={e => setSettings({ ...settings, institutionName: e.target.value })}
                />
              </div>

              <div>
                <label className="hhs-label" htmlFor="school-loc">Campus City / Location</label>
                <input
                  id="school-loc"
                  required
                  className="hhs-input"
                  value={settings.campusLocation}
                  onChange={e => setSettings({ ...settings, campusLocation: e.target.value })}
                />
              </div>

              <div>
                <label className="hhs-label" htmlFor="school-tagline">Institutional Motto / Tagline</label>
                <input
                  id="school-tagline"
                  required
                  className="hhs-input"
                  value={settings.tagline}
                  onChange={e => setSettings({ ...settings, tagline: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="hhs-label" htmlFor="school-email">Registrar Email</label>
                  <input
                    id="school-email"
                    type="email"
                    required
                    className="hhs-input"
                    value={settings.contactEmail}
                    onChange={e => setSettings({ ...settings, contactEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="hhs-label" htmlFor="school-phone">Central Telephone</label>
                  <input
                    id="school-phone"
                    required
                    className="hhs-input"
                    value={settings.contactPhone}
                    onChange={e => setSettings({ ...settings, contactPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Regulatory & Affiliation Card */}
          <div className="hhs-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              Board Affiliation &amp; Statutory Quorum
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="hhs-label" htmlFor="cbse-affil">CBSE Affiliation Number</label>
                <input
                  id="cbse-affil"
                  required
                  className="hhs-input"
                  value={settings.affiliationNumber || '1730249'}
                  onChange={e => setSettings({ ...settings, affiliationNumber: e.target.value })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  Affiliated to Central Board of Secondary Education, New Delhi
                </span>
              </div>

              <div>
                <label className="hhs-label" htmlFor="founded-yr">Founded Year</label>
                <input
                  id="founded-yr"
                  type="number"
                  required
                  className="hhs-input"
                  value={settings.foundedYear}
                  onChange={e => setSettings({ ...settings, foundedYear: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="hhs-label" htmlFor="acad-sess">Active Academic Session</label>
                <input
                  id="acad-sess"
                  disabled
                  className="hhs-input"
                  value={settings.activeAcademicYearId}
                  style={{ backgroundColor: 'var(--hhs-surface-muted)', color: 'var(--hhs-text-secondary)' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button
            type="submit"
            disabled={isSaving}
            className="hhs-btn hhs-btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving Configuration...' : 'Commit System Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
