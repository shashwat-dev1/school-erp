import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { RiskEvidenceDrawer } from '../../features/risk/RiskEvidenceDrawer';
import type { RiskWatchlistItem } from '../../data/provider';
import type { StudentRecord } from '../../domain/types';
import {
  AlertTriangle,
  Download,
  ShieldCheck,
  Search,
} from 'lucide-react';

export const RiskWatchlist: React.FC = () => {
  const navigate = useNavigate();
  const { provider } = useData();

  const [watchlist, setWatchlist] = useState<RiskWatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected student for Evidence Drawer
  const [activeStudent, setActiveStudent] = useState<StudentRecord | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadWatchlist() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await provider.getRiskWatchlist();
        if (!isMounted) return;
        setWatchlist(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load risk watchlist.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadWatchlist();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  const filteredItems = useMemo(() => {
    return watchlist.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.student.firstName.toLowerCase().includes(q) ||
        item.student.lastName.toLowerCase().includes(q) ||
        item.student.admissionNumber.toLowerCase().includes(q) ||
        item.primaryTrigger.toLowerCase().includes(q);

      const matchesTrigger =
        triggerFilter === 'all' ||
        (triggerFilter === 'attendance' && (item.primaryTrigger.includes('ATT') || item.attendanceRate < 75)) ||
        (triggerFilter === 'academic' && (item.primaryTrigger.includes('ACAD') || item.academicDropPercent > 15)) ||
        (triggerFilter === 'conduct' && item.primaryTrigger.includes('DISC'));

      const matchesStatus = statusFilter === 'all' || item.followUpStatus === statusFilter;

      return matchesSearch && matchesTrigger && matchesStatus;
    });
  }, [watchlist, searchQuery, triggerFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = watchlist.length;
    const below75 = watchlist.filter(w => w.attendanceRate < 75).length;
    const academicDrops = watchlist.filter(w => w.academicDropPercent > 15).length;
    const pendingReview = watchlist.filter(w => w.followUpStatus === 'pending' || w.followUpStatus === 'in_progress').length;

    return { total, below75, academicDrops, pendingReview };
  }, [watchlist]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Admission #',
      'Roll #',
      'Student Name',
      'Class',
      'Primary Trigger',
      'Attendance %',
      'Consecutive Absences',
      'Academic Drop %',
      'Assigned Mentor',
      'Follow-Up Status',
    ];

    const rows = filteredItems.map(w => [
      w.student.admissionNumber,
      w.student.rollNumber,
      `"${w.student.firstName} ${w.student.lastName}"`,
      w.student.classId,
      `"${w.primaryTrigger}"`,
      w.attendanceRate.toFixed(1) + '%',
      w.consecutiveAbsences,
      w.academicDropPercent > 0 ? `-${w.academicDropPercent}%` : 'None',
      `"${w.mentorAssigned || 'Tutor'}"`,
      w.followUpStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.join('\n')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HanuJai_Risk_Watchlist_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <LoadingState message="Loading student care watchlist..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Student Follow-Up & Performance Risk Watchlist"
        subtitle="Transparent, rule-based indicators exposing statutory attendance deficits, term score drops, and tutor follow-ups."
        roleScope="Pastoral & Academic Governance"
        breadcrumbs={[
          { label: 'Operations Hub', to: '/' },
          { label: 'Risk Watchlist', to: '/risk-watchlist' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExportCSV}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              <span>Export Watchlist CSV</span>
            </button>
            <button
              onClick={() => navigate('/reports/attendance')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ShieldCheck size={15} />
              <span>CBSE Compliance Audit</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Total Flagged Cohort</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-text-primary)' }}>
            {stats.total} Candidates
          </div>
          <div className="hhs-metric-sub">Across Class 10-A &amp; 10-B</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">CBSE &lt;75% Attendance Deficit</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-danger-text)' }}>
            {stats.below75} Students
          </div>
          <div className="hhs-metric-sub">Statutory Condonation Required</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">&gt;15% Academic Trajectory Drop</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-accent-text)' }}>
            {stats.academicDrops} Students
          </div>
          <div className="hhs-metric-sub">UT-1 to UT-2 delta</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Pending Tutor Conferences</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {stats.pendingReview} Pending
          </div>
          <div className="hhs-metric-sub">Action plans required</div>
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
            placeholder="Search candidate name, admission #, trigger rule..."
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>Category:</label>
          <select
            className="hhs-select"
            value={triggerFilter}
            onChange={e => setTriggerFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Triggers</option>
            <option value="attendance">Statutory Attendance (#ATT)</option>
            <option value="academic">Academic Drop (#ACAD)</option>
            <option value="conduct">Conduct &amp; Punctuality (#DISC)</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>Intervention:</label>
          <select
            className="hhs-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="counseled">Counseled / PTM Held</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Watchlist Table */}
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
              Deterministic Empirical Risk Register
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Governed by rule-based triggers • No probabilistic prediction
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">
            Showing {filteredItems.length} of {watchlist.length} Candidates
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '45px' }} className="numeric">Roll</th>
                <th style={{ width: '110px' }}>Admission #</th>
                <th>Student Candidate</th>
                <th>Class</th>
                <th>Trigger Verification</th>
                <th className="numeric" style={{ width: '110px' }}>Attendance Rate</th>
                <th className="numeric" style={{ width: '90px' }}>Trajectory</th>
                <th>Assigned Mentor</th>
                <th>Intervention Status</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Evidence Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const s = item.student;
                const isBelow75 = item.attendanceRate < 75.0;
                const hasDrop = item.academicDropPercent > 0;

                return (
                  <tr key={s.id}>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {s.rollNumber}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                        {s.admissionNumber}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/students/${s.id}`)}
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
                        {s.firstName} {s.lastName}
                      </button>
                    </td>
                    <td>
                      <span className="hhs-badge hhs-badge-neutral">
                        {s.classId.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--hhs-text-primary)' }}>
                        {item.primaryTrigger}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                        {item.consecutiveAbsences > 0 ? `${item.consecutiveAbsences} unexcused days` : 'Term check'}
                      </div>
                    </td>
                    <td className="numeric">
                      <span
                        style={{
                          fontWeight: 700,
                          color: isBelow75 ? 'var(--hhs-danger-text)' : 'inherit',
                        }}
                      >
                        {item.attendanceRate.toFixed(1)}%
                      </span>
                      {isBelow75 && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--hhs-danger-text)' }}>
                          Below 75%
                        </div>
                      )}
                    </td>
                    <td className="numeric">
                      {hasDrop ? (
                        <span style={{ fontWeight: 700, color: 'var(--hhs-danger-text)' }}>
                          -{item.academicDropPercent}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--hhs-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {item.mentorAssigned || 'Mrs. Ananya Sharma'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                        Class Tutor
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        status={
                          item.followUpStatus === 'resolved'
                            ? 'active'
                            : item.followUpStatus === 'counseled'
                            ? 'active'
                            : item.followUpStatus === 'in_progress'
                            ? 'pending'
                            : 'inactive'
                        }
                        label={
                          item.followUpStatus === 'pending'
                            ? 'Pending Notice'
                            : item.followUpStatus === 'in_progress'
                            ? 'In Remedial'
                            : item.followUpStatus === 'counseled'
                            ? 'PTM Held'
                            : 'Resolved'
                        }
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setActiveStudent(s)}
                        className="hhs-btn hhs-btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', height: '28px' }}
                      >
                        <AlertTriangle size={13} style={{ color: 'var(--hhs-danger-text)' }} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transparent Evidence Dossier Drawer */}
      <RiskEvidenceDrawer
        isOpen={Boolean(activeStudent)}
        onClose={() => setActiveStudent(null)}
        student={activeStudent}
      />
    </div>
  );
};
