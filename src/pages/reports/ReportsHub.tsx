import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  FileText,
  CalendarCheck,
  Award,
  AlertTriangle,
  ArrowRight,
  Layers,
} from 'lucide-react';

interface ReportCatalogItem {
  id: string;
  title: string;
  category: string;
  description: string;
  route: string;
  badge: string;
  icon: React.ReactNode;
}

const REPORT_CATALOG: ReportCatalogItem[] = [
  {
    id: 'rep-report-card',
    title: 'Formal CBSE Student Academic Report Card',
    category: 'Student Dossier & Evaluation',
    description: 'A4 print-ready continuous comprehensive evaluation (CCE) marks transcript, attendance verification, and principal certification.',
    route: '/reports/report-card/stu-10a-01',
    badge: 'A4 Print Layout',
    icon: <Award size={22} style={{ color: 'var(--hhs-primary)' }} />,
  },
  {
    id: 'rep-ptm-slip',
    title: 'Parent-Teacher Meeting (PTM) Progress Slip',
    category: 'Parent Consultation',
    description: 'Compact guardian conference slip summarizing academic progression, attendance rate, care triggers, and remedial commitments.',
    route: '/reports/ptm-slip/stu-10a-01',
    badge: 'Guardian Slip',
    icon: <FileText size={22} style={{ color: 'var(--hhs-primary)' }} />,
  },
  {
    id: 'rep-attendance',
    title: 'Attendance Ledger Analytics & Shortfall Audit',
    category: 'Statutory Board Compliance',
    description: 'CBSE Examination Rule 14.1 cumulative muster tracking instruction days, present rates, and candidate condonation notices.',
    route: '/reports/attendance',
    badge: 'CBSE Rule 14.1',
    icon: <CalendarCheck size={22} style={{ color: 'var(--hhs-primary)' }} />,
  },
  {
    id: 'rep-comparison',
    title: 'Cross-Cohort Academic Performance Comparison',
    category: 'Academic Moderation',
    description: 'Comparative score distributions and subject-by-subject variance matrix comparing Class 10-A versus Class 10-B.',
    route: '/reports/academic-comparison',
    badge: '10-A vs 10-B',
    icon: <Layers size={22} style={{ color: 'var(--hhs-primary)' }} />,
  },
  {
    id: 'rep-watchlist',
    title: 'Student Performance Risk & Follow-Up Watchlist',
    category: 'Pastoral Care & Guidance',
    description: 'Transparent rule-based register tracking attendance drop deficits, academic trajectory drops, and scheduled tutor conferences.',
    route: '/risk-watchlist',
    badge: 'Intervention Matrix',
    icon: <AlertTriangle size={22} style={{ color: 'var(--hhs-danger-text)' }} />,
  },
];

export const ReportsHub: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Statutory & Operational Reports Directory"
        subtitle="Institutional reporting repository across student records, attendance muster, academic moderation, and board compliance."
        roleScope="Institutional Governance"
        breadcrumbs={[
          { label: 'Operations Hub', to: '/' },
          { label: 'Reports Hub', to: '/reports' },
        ]}
      />

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
          <div className="hhs-metric-label">Published Statutory Reports</div>
          <div className="hhs-metric-value">{REPORT_CATALOG.length} Formats</div>
          <div className="hhs-metric-sub">Session 2025–26 (Term II)</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Print Engine Status</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            CSS Media Print
          </div>
          <div className="hhs-metric-sub">Zero sidebar / zero clutter</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Data Export Formats</div>
          <div className="hhs-metric-value">
            CSV &amp; PDF Print
          </div>
          <div className="hhs-metric-sub">Client-side generation</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Board Affiliation</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.15rem' }}>
            CBSE #1730249
          </div>
          <div className="hhs-metric-sub">Senior Secondary Wing</div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {REPORT_CATALOG.map(item => (
          <div
            key={item.id}
            className="hhs-panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
              padding: '20px',
              backgroundColor: 'var(--hhs-surface)',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--hhs-radius-base)',
                      backgroundColor: 'var(--hhs-surface-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {item.category}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                      {item.title}
                    </h3>
                  </div>
                </div>
              </div>

              <span className="hhs-badge hhs-badge-primary" style={{ marginBottom: '10px' }}>
                {item.badge}
              </span>

              <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.45 }}>
                {item.description}
              </p>
            </div>

            <div style={{ borderTop: '1px solid var(--hhs-border)', paddingTop: '12px' }}>
              <button
                onClick={() => navigate(item.route)}
                className="hhs-btn hhs-btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <span>Launch Report</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
