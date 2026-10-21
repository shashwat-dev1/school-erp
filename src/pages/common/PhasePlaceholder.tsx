import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PhasePlaceholderProps {
  moduleName: string;
  phaseNumber: number;
  description: string;
  deliverables: string[];
}

export const PhasePlaceholder: React.FC<PhasePlaceholderProps> = ({
  moduleName,
  phaseNumber,
  description,
  deliverables,
}) => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title={moduleName}
        subtitle="HanuJai High School, Jaipur • Operational Architecture"
        breadcrumbs={[
          { label: 'Campus' },
          { label: moduleName },
        ]}
      />

      <div className="hhs-card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span className="hhs-badge hhs-badge-accent">
            Phase {phaseNumber} Roadmap Module
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--hhs-text-muted)' }}>
            Scheduled for Implementation
          </span>
        </div>

        <h2 className="hhs-headline-md" style={{ marginBottom: '8px' }}>
          {moduleName} Specification
        </h2>

        <p className="hhs-body-md" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '24px', maxWidth: '700px' }}>
          {description}
        </p>

        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--hhs-canvas)',
            borderRadius: 'var(--hhs-radius-base)',
            border: '1px solid var(--hhs-border)',
            marginBottom: '24px',
            maxWidth: '600px',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: '10px', color: 'var(--hhs-text-primary)' }}>
            Key Specifications in this Module:
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {deliverables.map((item, idx) => (
              <li
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  color: 'var(--hhs-text-secondary)',
                }}
              >
                <ChevronRight size={14} color="var(--hhs-primary)" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => navigate('/')}
          className="hhs-btn hhs-btn-secondary"
        >
          Return to Operations Hub
        </button>
      </div>
    </div>
  );
};
