import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { RiskEvidenceDrawer } from '../../features/risk/RiskEvidenceDrawer';
import { downloadCsv } from '../../utils/exportUtils';
import type { RiskWatchlistItem } from '../../data/provider';
import type { StudentRecord } from '../../domain/types';
import {
  AlertTriangle,
  Download,
  CalendarCheck,
  Search,
} from 'lucide-react';

export const RiskWatchlist: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const isClassTeacher = currentUser?.role === 'class_teacher';
  const assignedClassId = currentUser?.assignedClassId;
  const assignedClassLabel = currentUser?.assignedClassLabel || (assignedClassId ? `Class ${assignedClassId.toUpperCase()}` : '');

  const [watchlist, setWatchlist] = useState<RiskWatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected student for Evidence Drawer
  const [activeStudent, setActiveStudent] = useState<StudentRecord | null>(null);

  const loadWatchlist = useCallback(async () => {
    if (isClassTeacher && !assignedClassId) {
      setError('Classroom section assignment required to view follow-up list.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const targetClassId = isClassTeacher ? assignedClassId : undefined;
      const data = await provider.getRiskWatchlist(targetClassId);
      setWatchlist(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load follow-up list.');
    } finally {
      setIsLoading(false);
    }
  }, [provider, isClassTeacher, assignedClassId]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

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

  const handleExportCSV = () => {
    const headers = [
      'Admission Number',
      'Roll Number',
      'Student Name',
      'Class',
      'Reason for Follow-up',
      'Attendance Percentage',
      'Consecutive Absences',
      'Score Trajectory Drop',
      'Class Teacher',
      'Status',
    ];

    const rows = filteredItems.map(w => [
      w.student.admissionNumber,
      w.student.rollNumber,
      `${w.student.firstName} ${w.student.lastName}`,
      w.student.classId.toUpperCase(),
      w.primaryTrigger,
      w.attendanceRate.toFixed(1) + '%',
      w.consecutiveAbsences,
      w.academicDropPercent > 0 ? `-${w.academicDropPercent}%` : 'None',
      w.mentorAssigned || 'Class Teacher',
      w.followUpStatus,
    ]);

    downloadCsv(`HanuJai_Student_Follow_Up_${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  if (isLoading) {
    return <LoadingState message="Loading student follow-up list..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title={isClassTeacher ? `${assignedClassLabel} Student Follow-up` : "Student Follow-up"}
        subtitle={isClassTeacher ? `Section ${assignedClassLabel} students needing attendance or academic follow-up.` : "Identifies students needing follow-up due to attendance below 75%, score drops, or teacher notes."}
        roleScope={isClassTeacher ? `${assignedClassLabel} Teacher` : "School-Wide Oversight"}
        breadcrumbs={
          isClassTeacher
            ? [{ label: 'My Section', to: '/' }, { label: 'Student Follow-up' }]
            : [{ label: 'Home', to: '/' }, { label: 'Reports', to: '/reports' }, { label: 'Student Follow-up' }]
        }
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExportCSV}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => navigate('/reports/attendance')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <CalendarCheck size={15} />
              <span>Attendance Ledger</span>
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
          <div className="hhs-metric-label">Total Follow-up Students</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-text-primary)' }}>
            {stats.total}
          </div>
          <div className="hhs-metric-sub">Across active rosters</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Attendance Below 75%</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-danger-text)' }}>
            {stats.below75}
          </div>
          <div className="hhs-metric-sub">Strictly below 75%</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Recent Score Drop (&gt;15%)</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-accent-text)' }}>
            {stats.academicDrops}
          </div>
          <div className="hhs-metric-sub">Across recent assessments</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Pending Follow-up Actions</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {stats.pendingReview}
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
            placeholder="Search student name, admission #..."
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
            <option value="all">All Reasons</option>
            <option value="attendance">Attendance Issues</option>
            <option value="academic">Academic Drop</option>
            <option value="conduct">Conduct &amp; Notes</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>Status:</label>
          <select
            className="hhs-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="counseled">Meeting Held</option>
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
              Follow-up Student List
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Showing real attendance and academic records requiring action
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">
            {filteredItems.length} of {watchlist.length} Students
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '45px' }} className="numeric">Roll</th>
                <th style={{ width: '110px' }}>Admission #</th>
                <th>Student Name</th>
                <th>Class</th>
                <th>Reason for Follow-up</th>
                <th className="numeric" style={{ width: '120px' }}>Attendance Rate</th>
                <th className="numeric" style={{ width: '100px' }}>Trajectory</th>
                <th>Class Teacher</th>
                <th>Status</th>
                <th style={{ textAlign: 'right', width: '110px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--hhs-text-secondary)' }}>
                    No students currently match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
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
                          {item.consecutiveAbsences > 0 ? `${item.consecutiveAbsences} consecutive absences` : 'Assessment delta'}
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
                          <div style={{ fontSize: '0.68rem', color: 'var(--hhs-danger-text)', fontWeight: 600 }}>
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
                              ? 'Meeting Held'
                              : 'Resolved'
                          }
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setActiveStudent(s)}
                          className="hhs-btn hhs-btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 10px', height: '28px' }}
                        >
                          <AlertTriangle size={13} style={{ color: 'var(--hhs-accent-text)' }} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow-up Evidence and Action Drawer */}
      <RiskEvidenceDrawer
        isOpen={Boolean(activeStudent)}
        onClose={() => setActiveStudent(null)}
        student={activeStudent}
        onFollowUpRecorded={loadWatchlist}
      />
    </div>
  );
};
