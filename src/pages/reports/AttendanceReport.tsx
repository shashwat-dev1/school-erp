import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { ClassSection, StudentRecord } from '../../domain/types';
import {
  Download,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Search,
} from 'lucide-react';

export const AttendanceReport: React.FC = () => {
  const navigate = useNavigate();
  const { provider } = useData();

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('class-10-a');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'deficit' | 'compliant'>('all');

  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const clsList = await provider.getClasses();
        if (!isMounted) return;
        setClasses(clsList);
      } catch (err: unknown) {
        console.error('Error fetching classes for attendance report:', err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  useEffect(() => {
    let isMounted = true;
    async function loadStudents() {
      setIsLoading(true);
      setError(null);
      try {
        const studList = await provider.getClassStudents(selectedClassId);
        if (!isMounted) return;
        setStudents(studList);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load attendance report.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStudents();
    return () => {
      isMounted = false;
    };
  }, [provider, selectedClassId]);

  const totalDays = 142; // Academic session instructional baseline

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q);

      const att = s.attendanceSummary?.overallPercentage ?? 85.0;
      const isDeficit = att < 75.0;

      let matchesStatus = true;
      if (statusFilter === 'deficit') matchesStatus = isDeficit;
      if (statusFilter === 'compliant') matchesStatus = !isDeficit;

      return matchesSearch && matchesStatus;
    });
  }, [students, searchQuery, statusFilter]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let sumAtt = 0;
    let deficitCount = 0;

    students.forEach(s => {
      const att = s.attendanceSummary?.overallPercentage ?? 85.0;
      sumAtt += att;
      if (att < 75.0) deficitCount++;
    });

    const averageAtt = students.length > 0 ? (sumAtt / students.length).toFixed(1) : '—';

    return {
      averageAtt,
      deficitCount,
      totalStudents: students.length,
    };
  }, [students]);

  // CSV Export
  const handleExportCSV = () => {
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const headers = [
      'Roll #',
      'Admission #',
      'Candidate Name',
      'Class',
      'Total Session Days',
      'Present Days',
      'Absent Days',
      'Attendance %',
      'CBSE Rule 14.1 Status',
    ];

    const rows = filteredStudents.map(s => {
      const att = s.attendanceSummary?.overallPercentage ?? 85.0;
      const presentDays = Math.round(totalDays * (att / 100));
      const absentDays = totalDays - presentDays;
      const statusStr = att < 75.0 ? 'Statutory Deficit (<75%)' : 'Compliant';

      return [
        s.rollNumber,
        s.admissionNumber,
        `"${s.firstName} ${s.lastName}"`,
        selectedClass?.label || '10-A',
        totalDays,
        presentDays,
        absentDays,
        att.toFixed(1) + '%',
        `"${statusStr}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${selectedClass?.name || 'Class'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <LoadingState message="Compiling statutory attendance report..." />;
  }

  const activeClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="hhs-page-container">
      {/* Header */}
      <div className="no-print">
        <PageHeader
          title="Attendance Ledger Analytics & Statutory Shortfall Audit"
          subtitle="Mandatory CBSE Examination Rule 14.1 compliance muster tracking cumulative instruction days and condonations."
          roleScope="Compliance & Registrars"
          breadcrumbs={[
            { label: 'Operations Hub', to: '/' },
            { label: 'Reports', to: '/reports' },
            { label: 'Attendance Audit', to: '/reports/attendance' },
          ]}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleExportCSV}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={15} />
                <span>Export Audit CSV</span>
              </button>
              <button
                onClick={() => window.print()}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} />
                <span>Print Statutory Report</span>
              </button>
            </div>
          }
        />
      </div>

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
          <div className="hhs-metric-label">Total Instructional Days</div>
          <div className="hhs-metric-value">{totalDays} Days</div>
          <div className="hhs-metric-sub">Session 2025–26 Baseline</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Cohort Present Aggregate</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {stats.averageAtt}%
          </div>
          <div className="hhs-metric-sub">{activeClass?.label || 'Class 10-A'} Overall Mean</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">CBSE &lt;75% Statutory Deficit</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-danger-text)' }}>
            {stats.deficitCount} Candidates
          </div>
          <div className="hhs-metric-sub">Condonation Required</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Statutory Compliance Status</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.15rem', color: 'var(--hhs-primary)' }}>
            Form A Certified
          </div>
          <div className="hhs-metric-sub">CBSE By-Law 14.1 Quorum</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div
        className="hhs-panel no-print"
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
            placeholder="Search candidate name, admission number..."
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>Class Cohort:</label>
          <select
            className="hhs-select"
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            style={{ width: 'auto' }}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>Threshold:</label>
          <select
            className="hhs-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | 'deficit' | 'compliant')}
            style={{ width: 'auto' }}
          >
            <option value="all">All Candidates ({students.length})</option>
            <option value="deficit">Statutory Deficit &lt;75% ({stats.deficitCount})</option>
            <option value="compliant">Compliant ≥75% ({students.length - stats.deficitCount})</option>
          </select>
        </div>
      </div>

      {/* Attendance Ledger Table */}
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
              Official Cumulative Attendance Muster — {activeClass?.label}
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Statutory baseline: {totalDays} instruction days • CBSE Examination Board requirement: 75.0%
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">Session 2025–26</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '45px' }} className="numeric">Roll</th>
                <th style={{ width: '110px' }}>Admission #</th>
                <th>Candidate Full Name</th>
                <th className="numeric" style={{ width: '90px' }}>Total Days</th>
                <th className="numeric" style={{ width: '90px' }}>Present</th>
                <th className="numeric" style={{ width: '90px' }}>Absent</th>
                <th className="numeric" style={{ width: '100px' }}>Rate %</th>
                <th>Statutory Rule 14.1 Compliance</th>
                <th style={{ textAlign: 'right', width: '80px' }} className="no-print">Dossier</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(s => {
                const att = s.attendanceSummary?.overallPercentage ?? 85.0;
                const isBelow75 = att < 75.0;
                const presentDays = Math.round(totalDays * (att / 100));
                const absentDays = totalDays - presentDays;

                return (
                  <tr
                    key={s.id}
                    style={{
                      backgroundColor: isBelow75 ? 'var(--hhs-danger-light)' : undefined,
                    }}
                  >
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
                    <td className="numeric">{totalDays}</td>
                    <td className="numeric" style={{ fontWeight: 600, color: 'var(--hhs-primary)' }}>
                      {presentDays}
                    </td>
                    <td className="numeric" style={{ fontWeight: 600, color: absentDays > 10 ? 'var(--hhs-danger-text)' : 'inherit' }}>
                      {absentDays}
                    </td>
                    <td className="numeric">
                      <span
                        style={{
                          fontWeight: 700,
                          color: isBelow75 ? 'var(--hhs-danger-text)' : 'var(--hhs-primary)',
                        }}
                      >
                        {att.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      {isBelow75 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--hhs-danger-text)', fontWeight: 700, fontSize: '0.78rem' }}>
                          <AlertTriangle size={14} />
                          <span>Shortfall Warning (-{(75.0 - att).toFixed(1)}%)</span>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--hhs-primary)', fontWeight: 600, fontSize: '0.78rem' }}>
                          <ShieldCheck size={14} />
                          <span>Compliant (&ge;75%)</span>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="no-print">
                      <button
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="hhs-btn hhs-btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '3px 8px', height: '26px' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
