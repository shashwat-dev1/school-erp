import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  CalendarCheck,
  AlertTriangle,
  ArrowRight,
  Layers,
  FileSpreadsheet,
  UserCheck,
} from 'lucide-react';

export const ReportsHub: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isPrincipal = currentUser?.role === 'principal';

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Reports"
        subtitle="Institutional reporting workspace for attendance registers, academic comparisons, and student follow-up."
        roleScope={isPrincipal ? 'School-Wide Oversight' : 'Section Reports'}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Reports' },
        ]}
      />

      {/* Primary Action Card: Class Academic Summary */}
      <div
        className="hhs-card"
        style={{
          padding: '22px 26px',
          backgroundColor: 'var(--hhs-surface)',
          border: '1px solid var(--hhs-border)',
          borderRadius: 'var(--hhs-radius-container)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="hhs-badge hhs-badge-primary">Grade-Level Summary</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>Session 2025–2026</span>
          </div>
          <h3 className="hhs-headline-md" style={{ margin: 0, color: 'var(--hhs-text-primary)' }}>
            Academic Summary
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.45 }}>
            Generate a combined grade-level academic report across sections with score band distributions, overall subject performance, weak subjects, and top performers.
          </p>
        </div>

        <button
          onClick={() => navigate('/reports/class-summary')}
          className="hhs-btn hhs-btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.88rem' }}
        >
          <FileSpreadsheet size={16} />
          <span>Generate Academic Summary</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* The Three Main Report Tools */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '18px',
          marginBottom: '24px',
        }}
      >
        {/* Tool 1: Attendance Ledger */}
        <div
          className="hhs-card"
          style={{
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: 'var(--hhs-surface)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--hhs-radius-base)',
                  backgroundColor: 'var(--pop-electric-blue-tint)',
                  color: 'var(--pop-electric-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                  Attendance Ledger
                </h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)' }}>
                  Multi-class selection &amp; date filtering
                </span>
              </div>
            </div>

            <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.45 }}>
              Review instructional day attendance registers, check student turnout rates, view individual daily logs, and export multi-column Excel registers.
            </p>
          </div>

          <button
            onClick={() => navigate('/reports/attendance')}
            className="hhs-btn hhs-btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>Open Attendance Ledger</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Tool 2: Academic Performance Comparison with Deep Violet Pop */}
        <div
          className="hhs-card"
          style={{
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: 'var(--hhs-surface)',
            borderTop: '3px solid var(--pop-deep-violet)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--hhs-radius-base)',
                  backgroundColor: 'var(--pop-deep-violet-tint)',
                  color: 'var(--pop-deep-violet)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                  Academic Performance Comparison
                </h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)' }}>
                  {isPrincipal ? 'School-wide section comparisons' : 'Class performance overview'}
                </span>
              </div>
            </div>

            <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.45 }}>
              Compare subject means, pass percentages, and score variance across multiple classes and sections for standardized evaluation cycles.
            </p>
          </div>

          {isPrincipal ? (
            <button
              onClick={() => navigate('/reports/academic-comparison')}
              className="hhs-btn hhs-btn-violet"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <span>Open Comparison</span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/reports/class-summary')}
              className="hhs-btn hhs-btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <span>View Class Summary</span>
              <ArrowRight size={15} />
            </button>
          )}
        </div>

        {/* Tool 3: Student Follow-up with Burnt Vermilion Pop */}
        <div
          className="hhs-card"
          style={{
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: 'var(--hhs-surface)',
            borderTop: '3px solid var(--pop-burnt-vermilion)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--hhs-radius-base)',
                  backgroundColor: 'var(--pop-burnt-vermilion-tint)',
                  color: 'var(--pop-burnt-vermilion)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                  Student Follow-up
                </h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)' }}>
                  Attendance deficits &amp; score trajectory review
                </span>
              </div>
            </div>

            <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.45 }}>
              Review students who may need academic or attendance support based on attendance thresholds, score drops, and record follow-up actions.
            </p>
          </div>

          <button
            onClick={() => navigate('/risk-watchlist')}
            className="hhs-btn hhs-btn-accent"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>Open Follow-up</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Helpful Guidance Notice for Student-Specific Documents */}
      <div
        className="hhs-panel"
        style={{
          padding: '16px 20px',
          backgroundColor: 'var(--hhs-surface-muted)',
          border: '1px solid var(--hhs-border)',
          borderRadius: 'var(--hhs-radius-base)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserCheck size={18} style={{ color: 'var(--hhs-primary)' }} />
          <div style={{ fontSize: '0.84rem', color: 'var(--hhs-text-secondary)' }}>
            <strong>Individual Student Documents:</strong> Student-specific Academic Reports and PTM Progress Slips are generated directly from the student's profile dossier in the Student Directory.
          </div>
        </div>

        <button
          onClick={() => navigate('/students')}
          className="hhs-btn hhs-btn-secondary hhs-btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>Open Students Directory</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
