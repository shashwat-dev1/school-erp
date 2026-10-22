import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface SubjectComparisonRow {
  subject: string;
  code: string;
  maxMarks: number;
  class10AAvg: number;
  class10APassPct: number;
  class10BAvg: number;
  class10BPassPct: number;
  delta: number;
}

const COMPARISON_DATA: SubjectComparisonRow[] = [
  {
    subject: 'Mathematics',
    code: '041',
    maxMarks: 25,
    class10AAvg: 19.8,
    class10APassPct: 91.7,
    class10BAvg: 18.2,
    class10BPassPct: 83.3,
    delta: 1.6,
  },
  {
    subject: 'Science',
    code: '086',
    maxMarks: 25,
    class10AAvg: 20.4,
    class10APassPct: 100.0,
    class10BAvg: 19.1,
    class10BPassPct: 91.7,
    delta: 1.3,
  },
  {
    subject: 'English Language & Lit.',
    code: '184',
    maxMarks: 25,
    class10AAvg: 21.6,
    class10APassPct: 100.0,
    class10BAvg: 20.9,
    class10BPassPct: 100.0,
    delta: 0.7,
  },
  {
    subject: 'Hindi Course-A',
    code: '002',
    maxMarks: 25,
    class10AAvg: 19.2,
    class10APassPct: 91.7,
    class10BAvg: 19.5,
    class10BPassPct: 91.7,
    delta: -0.3,
  },
  {
    subject: 'Social Science',
    code: '087',
    maxMarks: 25,
    class10AAvg: 20.8,
    class10APassPct: 100.0,
    class10BAvg: 19.8,
    class10BPassPct: 91.7,
    delta: 1.0,
  },
];

export const AcademicComparisonReport: React.FC = () => {
  const handleExportCSV = () => {
    const headers = [
      'Subject',
      'Code',
      'Max Marks',
      'Class 10-A Mean',
      'Class 10-A Pass %',
      'Class 10-B Mean',
      'Class 10-B Pass %',
      'Score Delta',
    ];

    const rows = COMPARISON_DATA.map(r => [
      `"${r.subject}"`,
      r.code,
      r.maxMarks,
      r.class10AAvg,
      r.class10APassPct + '%',
      r.class10BAvg,
      r.class10BPassPct + '%',
      r.delta,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Academic_Comparison_10A_vs_10B_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="hhs-page-container">
      <div className="no-print">
        <PageHeader
          title="Cross-Cohort Academic Performance Comparison"
          subtitle="Comparative analysis of Class 10-A versus Class 10-B across curricular subjects and examination cycles."
          roleScope="Academic Moderation"
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: 'Reports', to: '/reports' },
            { label: 'Cohort Comparison', to: '/reports/academic-comparison' },
          ]}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleExportCSV}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={15} />
                <span>Export Comparison CSV</span>
              </button>
              <button
                onClick={() => window.print()}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} />
                <span>Print Report</span>
              </button>
            </div>
          }
        />
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
          <div className="hhs-metric-label">Class 10-A Overall Mean</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            81.8%
          </div>
          <div className="hhs-metric-sub">Tutor: Mrs. Ananya Sharma</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Class 10-B Overall Mean</div>
          <div className="hhs-metric-value">
            77.9%
          </div>
          <div className="hhs-metric-sub">Tutor: Mr. Rajesh Mathur</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Section Variance Delta</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            +3.9% (10-A)
          </div>
          <div className="hhs-metric-sub">Highest lead in Mathematics</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Evaluation Cycle</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.15rem' }}>
            Unit Test 1
          </div>
          <div className="hhs-metric-sub">Session 2025–26</div>
        </div>
      </div>

      {/* Comparison Table */}
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
              Subject-Wise Comparative Score Distribution (10-A vs 10-B)
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Evaluating standardized subject syllabus performance
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">CBSE Curriculum 2025–26</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Subject Name</th>
                <th style={{ width: '80px' }}>Code</th>
                <th className="numeric" style={{ width: '80px' }}>Max</th>
                <th className="numeric" style={{ width: '130px' }}>10-A Mean</th>
                <th className="numeric" style={{ width: '110px' }}>10-A Pass %</th>
                <th className="numeric" style={{ width: '130px' }}>10-B Mean</th>
                <th className="numeric" style={{ width: '110px' }}>10-B Pass %</th>
                <th className="numeric" style={{ width: '110px' }}>Delta</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_DATA.map((row, idx) => {
                const isPositive = row.delta > 0;
                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                        {row.subject}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                        {row.code}
                      </span>
                    </td>
                    <td className="numeric">{row.maxMarks}</td>
                    <td className="numeric" style={{ fontWeight: 700, color: 'var(--hhs-primary)' }}>
                      {row.class10AAvg}
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {row.class10APassPct}%
                    </td>
                    <td className="numeric" style={{ fontWeight: 700 }}>
                      {row.class10BAvg}
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {row.class10BPassPct}%
                    </td>
                    <td className="numeric">
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontWeight: 700,
                          color: isPositive ? 'var(--hhs-primary)' : 'var(--hhs-danger-text)',
                        }}
                      >
                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span>
                          {isPositive ? `+${row.delta.toFixed(1)}` : row.delta.toFixed(1)}
                        </span>
                      </div>
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
