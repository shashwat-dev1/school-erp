import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { AcademicYear } from '../../domain/types';
import { Edit } from 'lucide-react';

export const AcademicYearSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearName, setYearName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadYears = async () => {
    try {
      const data = await provider.getAcademicYears();
      setYears(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load academic years.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadYears();
  }, [provider]);

  const handleOpenEdit = (yr: AcademicYear) => {
    setEditingYear(yr);
    setYearName(yr.label);
    setStartDate(yr.startDate);
    setEndDate(yr.endDate);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYear || !currentUser) return;
    setIsSaving(true);
    try {
      const updated = await provider.updateAcademicYear(
        editingYear.id,
        {
          label: yearName,
          startDate,
          endDate,
        },
        currentUser
      );
      setYears(prev => prev.map(y => (y.id === updated.id ? updated : y)));
      setIsModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update academic year.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading academic year governance..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Academic Year & Session Management"
        subtitle="School calendar cycles, term boundaries, and statutory examination gazette seals."
        roleScope="Administrative Policy"
        breadcrumbs={[
          { label: 'Operations Hub', to: '/' },
          { label: 'Settings', to: '/settings/system-config' },
          { label: 'Academic Years', to: '/settings/academic-years' },
        ]}
      />

      {error && <ErrorBanner message={error} />}

      {/* KPI Cards Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Active Academic Session</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            AY 2025–26
          </div>
          <div className="hhs-metric-sub">01 Apr 2025 – 31 Mar 2026</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Current Operational Term</div>
          <div className="hhs-metric-value">
            Term II
          </div>
          <div className="hhs-metric-sub">Mid-Term Evaluation Window</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Historical Sealed Volumes</div>
          <div className="hhs-metric-value">
            14 Gazettes
          </div>
          <div className="hhs-metric-sub">Archival records locked</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">CBSE Affiliation Compliance</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.15rem', color: 'var(--hhs-primary)' }}>
            180 Days Target
          </div>
          <div className="hhs-metric-sub">Statutory Instruction Mandate</div>
        </div>
      </div>

      {/* Academic Years Table */}
      <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--hhs-border)',
            backgroundColor: 'var(--hhs-surface-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              Institutional Session Register
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Session dates dictate active attendance roll calls and examination weightages
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">Master Calendar</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Session Identifier</th>
                <th>Academic Year Label</th>
                <th>Session Start Date</th>
                <th>Session End Date</th>
                <th>Operational Status</th>
                <th style={{ textAlign: 'right', width: '90px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {years.map(yr => (
                <tr key={yr.id}>
                  <td>
                    <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                      {yr.id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                      {yr.label}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-primary)' }}>
                      {yr.startDate}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-primary)' }}>
                      {yr.endDate}
                    </div>
                  </td>
                  <td>
                    <StatusBadge
                      status={yr.status === 'active' ? 'active' : 'inactive'}
                      label={yr.status === 'active' ? 'Active Session' : 'Archived Volume'}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleOpenEdit(yr)}
                      className="hhs-btn hhs-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px', height: '28px' }}
                    >
                      <Edit size={13} />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Edit Academic Session: ${editingYear?.label}`}
        subtitle="Changes to session boundary dates apply to all institutional attendance registers."
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="hhs-label" htmlFor="ay-name">Session Name</label>
            <input
              id="ay-name"
              required
              className="hhs-input"
              value={yearName}
              onChange={e => setYearName(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="hhs-label" htmlFor="ay-start">Start Date</label>
              <input
                id="ay-start"
                type="date"
                required
                className="hhs-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="hhs-label" htmlFor="ay-end">End Date</label>
              <input
                id="ay-end"
                type="date"
                required
                className="hhs-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="hhs-btn hhs-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="hhs-btn hhs-btn-primary"
            >
              {isSaving ? 'Updating...' : 'Commit Session Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
