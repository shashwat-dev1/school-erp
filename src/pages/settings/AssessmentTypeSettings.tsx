import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { CheckCircle2 } from 'lucide-react';

interface AssessmentScaleItem {
  grade: string;
  minPercent: number;
  maxPercent: number;
  gradePoint: number;
  descriptor: string;
}

const CBSE_GRADING_SCALE: AssessmentScaleItem[] = [
  { grade: 'A1', minPercent: 91, maxPercent: 100, gradePoint: 10.0, descriptor: 'Outstanding' },
  { grade: 'A2', minPercent: 81, maxPercent: 90, gradePoint: 9.0, descriptor: 'Excellent' },
  { grade: 'B1', minPercent: 71, maxPercent: 80, gradePoint: 8.0, descriptor: 'Very Good' },
  { grade: 'B2', minPercent: 61, maxPercent: 70, gradePoint: 7.0, descriptor: 'Good' },
  { grade: 'C1', minPercent: 51, maxPercent: 60, gradePoint: 6.0, descriptor: 'Fair' },
  { grade: 'C2', minPercent: 41, maxPercent: 50, gradePoint: 5.0, descriptor: 'Average' },
  { grade: 'D', minPercent: 33, maxPercent: 40, gradePoint: 4.0, descriptor: 'Minimum Pass' },
  { grade: 'E', minPercent: 0, maxPercent: 32, gradePoint: 0.0, descriptor: 'Remedial / Essential Repeat' },
];

export const AssessmentTypeSettings: React.FC = () => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSave = () => {
    setSuccessMsg('CBSE Continuous Evaluation grading scale and assessment milestones verified and saved.');
  };

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Assessment Types & CBSE Grading Scale Policy"
        subtitle="Standardized 9-point evaluation grading scale, weightage distribution, and remedial thresholds."
        roleScope="Academic Policy"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Settings', to: '/settings/system-config' },
          { label: 'Assessment Types', to: '/settings/assessment-types' },
        ]}
        actions={
          <button
            onClick={handleSave}
            className="hhs-btn hhs-btn-primary"
          >
            Save Policy Settings
          </button>
        }
      />

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
          <div className="hhs-metric-label">CBSE Grading Architecture</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            9-Point Scale
          </div>
          <div className="hhs-metric-sub">A1 through E Grade Points</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Statutory Passing Mark</div>
          <div className="hhs-metric-value">
            33.0%
          </div>
          <div className="hhs-metric-sub">Grade D Minimum Floor</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Remedial Flag Threshold</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-danger-text)' }}>
            &lt; 33.0% (Grade E)
          </div>
          <div className="hhs-metric-sub">Automatic Zero-Period Intervention</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Term Weightage Ratio</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.15rem' }}>
            Term I (40%) : Term II (60%)
          </div>
          <div className="hhs-metric-sub">Final Transcript Cumulative</div>
        </div>
      </div>

      {/* Grading Scale Table */}
      <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: '20px' }}>
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
              Standardized CBSE 9-Point Scale Reference Matrix
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Applied automatically during marks register score computation
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">CBSE Examination Byelaws</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Grade</th>
                <th className="numeric" style={{ width: '130px' }}>Marks Range (%)</th>
                <th className="numeric" style={{ width: '110px' }}>Grade Point</th>
                <th>Institutional Performance Descriptor</th>
                <th>System Operational Consequence</th>
              </tr>
            </thead>
            <tbody>
              {CBSE_GRADING_SCALE.map(item => {
                const isFail = item.grade === 'E';
                return (
                  <tr key={item.grade} style={{ backgroundColor: isFail ? 'var(--hhs-danger-light)' : undefined }}>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 'var(--hhs-radius-pill)',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          backgroundColor: isFail ? 'var(--hhs-danger)' : 'var(--hhs-surface-muted)',
                          color: isFail ? '#ffffff' : 'var(--hhs-primary)',
                        }}
                      >
                        {item.grade}
                      </span>
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {item.minPercent}% – {item.maxPercent}%
                    </td>
                    <td className="numeric" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {item.gradePoint.toFixed(1)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.descriptor}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: isFail ? 'var(--hhs-danger-text)' : 'var(--hhs-text-secondary)' }}>
                        {isFail
                          ? 'Triggers Rule #ACAD-04 remedial clinic referral & guardian notification'
                          : item.grade === 'A1'
                          ? 'Enrolls in academic honours roll & olympiad training'
                          : 'Satisfactory scholastic progression'}
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
