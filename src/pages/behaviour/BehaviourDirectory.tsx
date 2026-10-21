import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { NewObservationModal } from './NewObservationModal';
import type { IncidentRecord, StudentRecord } from '../../domain/types';
import {
  Plus,
  Download,
  Search,
  Lock,
} from 'lucide-react';

export const BehaviourDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { provider } = useData();

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchIncidents = async () => {
    try {
      const [incRes, studRes] = await Promise.all([
        provider.getIncidents(),
        provider.getClassStudents('class-10-a'),
      ]);
      setIncidents(incRes);
      setStudents(studRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load behaviour records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchIncidents();
  }, [provider]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inc.studentName.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q) ||
        inc.id.toLowerCase().includes(q);

      const matchesCat = categoryFilter === 'all' || inc.category === categoryFilter;
      const matchesSev = severityFilter === 'all' || inc.severity === severityFilter;

      return matchesSearch && matchesCat && matchesSev;
    });
  }, [incidents, searchQuery, categoryFilter, severityFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = incidents.length;
    const commendations = incidents.filter(i => i.severity === 'commendation').length;
    const notices = incidents.filter(i => i.severity === 'notice').length;
    const critical = incidents.filter(i => i.severity === 'critical' || i.severity === 'disciplinary').length;

    return { total, commendations, notices, critical };
  }, [incidents]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Reference ID',
      'Date Logged',
      'Student Name',
      'Class',
      'Category',
      'Severity',
      'Summary Title',
      'Factual Description',
      'Action Taken',
      'Logged By',
    ];

    const rows = filteredIncidents.map(i => [
      i.id,
      i.date,
      `"${i.studentName}"`,
      i.classId,
      i.category,
      i.severity,
      `"${i.title}"`,
      `"${i.description}"`,
      `"${i.actionTaken || 'None'}"`,
      `"${i.loggedByName}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Behaviour_Records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <LoadingState message="Loading pastoral care & observation records..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Student Behaviour & Observation Ledger"
        subtitle="Pastoral care and proctorial observation dossier governed under statutory child protection protocols."
        roleScope="Senior Wing Proctorial Ledger"
        breadcrumbs={[
          { label: 'Operations Hub', to: '/' },
          { label: 'Pastoral Care', to: '/behaviour' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExportCSV}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              <span>Export Summary (CSV)</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Record New Observation</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* DPDP Act Compliance & Confidentiality Notice */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--hhs-surface-muted)',
          borderLeft: '4px solid var(--hhs-primary)',
          borderRadius: 'var(--hhs-radius-base)',
          marginBottom: '16px',
          fontSize: '0.8rem',
          color: 'var(--hhs-text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <Lock size={16} style={{ color: 'var(--hhs-primary)', flexShrink: 0 }} />
        <span>
          <strong>Confidential Proctorial Dossier:</strong> Records maintained under Digital Personal Data Protection (DPDP) Act 2023. Entries are immutable, auditable, and accessible only to authorized faculty mentors and school leadership.
        </span>
      </div>

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
          <div className="hhs-metric-label">Total Observations</div>
          <div className="hhs-metric-value">{stats.total} Entries</div>
          <div className="hhs-metric-sub">Session 2025–26</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Commendations &amp; Honours</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {stats.commendations} Commendations
          </div>
          <div className="hhs-metric-sub">Exemplary academic/sports merit</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Proctorial Notices</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-accent-text)' }}>
            {stats.notices} Notices
          </div>
          <div className="hhs-metric-sub">Punctuality and dress code</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Disciplinary / Formal Action</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-danger-text)' }}>
            {stats.critical} Cases
          </div>
          <div className="hhs-metric-sub">Guardian alignment initiated</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="hhs-panel"
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          backgroundColor: 'var(--hhs-surface)',
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--hhs-text-muted)' }}
          />
          <input
            type="text"
            className="hhs-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, summary, proctor ID..."
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>Category:</label>
          <select
            className="hhs-select"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Categories</option>
            <option value="conduct_discipline">Conduct &amp; Discipline</option>
            <option value="punctuality">Punctuality &amp; Uniform</option>
            <option value="academic_integrity">Academic Integrity</option>
            <option value="commendation">Commendations</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>Classification:</label>
          <select
            className="hhs-select"
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Classifications</option>
            <option value="commendation">Commendation</option>
            <option value="notice">Notice</option>
            <option value="disciplinary">Disciplinary</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
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
              Proctorial Observation Register
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Sequential chronological entries • Factual records only
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">
            Showing {filteredIncidents.length} of {incidents.length} Records
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Date &amp; ID</th>
                <th style={{ width: '160px' }}>Student Candidate</th>
                <th style={{ width: '120px' }}>Classification</th>
                <th>Observation Summary &amp; Description</th>
                <th>Action Taken &amp; Intervention</th>
                <th style={{ width: '140px' }}>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map(inc => {
                const isCommendation = inc.severity === 'commendation';
                const isNotice = inc.severity === 'notice';

                return (
                  <tr key={inc.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{inc.date}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-muted)', fontFamily: 'monospace' }}>
                        {inc.id}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/students/${inc.studentId}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          fontWeight: 600,
                          color: 'var(--hhs-primary)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {inc.studentName}
                      </button>
                      <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                        Class 10-A
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 'var(--hhs-radius-pill)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          backgroundColor: isCommendation
                            ? 'var(--hhs-primary-light)'
                            : isNotice
                            ? 'var(--hhs-accent-light)'
                            : 'var(--hhs-danger-light)',
                          color: isCommendation
                            ? 'var(--hhs-primary-text)'
                            : isNotice
                            ? 'var(--hhs-accent-text)'
                            : 'var(--hhs-danger-text)',
                        }}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                        {inc.title}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.4 }}>
                        {inc.description}
                      </p>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-primary)' }}>
                        {inc.actionTaken || 'Documented on record.'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{inc.loggedByName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-muted)' }}>Faculty Proctor</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Observation Modal */}
      <NewObservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        students={students}
        onIncidentCreated={fetchIncidents}
      />
    </div>
  );
};
