import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Check, X, ShieldCheck } from 'lucide-react';

interface PermissionRow {
  domain: string;
  capability: string;
  description: string;
  principal: boolean | string;
  classTeacher: boolean | string;
  subjectTeacher: boolean | string;
}

const PERMISSION_MATRIX: PermissionRow[] = [
  {
    domain: 'Student Master Ledger',
    capability: 'View Student Directory & Dossier',
    description: 'Access student identity, admission number, roll number, and academic overview.',
    principal: 'School-Wide (Read-Only)',
    classTeacher: 'Assigned Section',
    subjectTeacher: 'Assigned Classes',
  },
  {
    domain: 'Student Master Ledger',
    capability: 'Enroll / Edit Master Student Records',
    description: 'Add new students or modify demographic data. Strictly locked in pilot.',
    principal: false,
    classTeacher: false,
    subjectTeacher: false,
  },
  {
    domain: 'Attendance Operations',
    capability: 'Mark Daily Attendance Register',
    description: 'Record morning roll call attendance for students.',
    principal: false,
    classTeacher: 'Assigned Section Only',
    subjectTeacher: false,
  },
  {
    domain: 'Attendance Operations',
    capability: 'View Individual Attendance Registers',
    description: 'Inspect daily attendance status and absence history for individual students.',
    principal: 'School-Wide (Read-Only)',
    classTeacher: 'Assigned Section Only',
    subjectTeacher: false,
  },
  {
    domain: 'Attendance Operations',
    capability: 'Class Attendance Aggregate',
    description: 'View aggregate class turnout totals (e.g. 46 of 50 present) without absent names.',
    principal: 'School-Wide Overview',
    classTeacher: 'Assigned Section',
    subjectTeacher: 'Assigned Classes (Aggregate Only)',
  },
  {
    domain: 'Attendance Operations',
    capability: 'Attendance Correction Requests',
    description: 'Submit or approve official adjustments to daily attendance records.',
    principal: false,
    classTeacher: 'Assigned Section Only',
    subjectTeacher: false,
  },
  {
    domain: 'Academic Assessments',
    capability: 'Enter Subject Marks',
    description: 'Input marks for specific assessments and assigned subject/section registers.',
    principal: false,
    classTeacher: 'Assigned Subject Only',
    subjectTeacher: 'Assigned Subject Only',
  },
  {
    domain: 'Academic Assessments',
    capability: 'View Cross-Subject Results Matrix',
    description: 'View consolidated results across all subjects for a class section.',
    principal: 'School-Wide (Read-Only)',
    classTeacher: 'Assigned Section Only',
    subjectTeacher: false,
  },
  {
    domain: 'Academic Assessments',
    capability: 'Configure Assessment Cycles',
    description: 'Create or update exam terms, maximum marks, and weightages.',
    principal: false,
    classTeacher: false,
    subjectTeacher: false,
  },
  {
    domain: 'Student Notes',
    capability: 'Add Student Notes & Observations',
    description: 'Record behavioral, academic, and pastoral observations for students.',
    principal: false,
    classTeacher: 'Assigned Section',
    subjectTeacher: 'Assigned Classes',
  },
  {
    domain: 'Student Notes',
    capability: 'View Student Notes',
    description: 'Inspect recorded teacher notes and student observations.',
    principal: 'School-Wide (Read-Only)',
    classTeacher: 'Assigned Section',
    subjectTeacher: 'Own & Shared Notes',
  },
  {
    domain: 'Reports & Exports',
    capability: 'Download Student Report Cards & PTM Slips',
    description: 'Generate authorized printable progress reports and summary slips.',
    principal: 'School-Wide PDF/Print',
    classTeacher: 'Assigned Section',
    subjectTeacher: 'Own Subject',
  },
  {
    domain: 'System Governance',
    capability: 'Staff Account & Role Allocations',
    description: 'Modify staff accounts, class teacher allocations, or subject assignments.',
    principal: false,
    classTeacher: false,
    subjectTeacher: false,
  },
];

export const RolePermissionMatrix: React.FC = () => {
  const renderBadge = (val: boolean | string) => {
    if (val === true) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--hhs-primary)',
            fontWeight: 700,
            fontSize: '0.8rem',
          }}
        >
          <Check size={16} />
          <span>Full Access</span>
        </span>
      );
    }
    if (val === false) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--hhs-text-muted)',
            fontSize: '0.8rem',
          }}
        >
          <X size={15} />
          <span>Prohibited</span>
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 'var(--hhs-radius-pill)',
          backgroundColor: 'var(--hhs-primary-light)',
          color: 'var(--hhs-primary-text)',
          fontWeight: 600,
          fontSize: '0.75rem',
        }}
      >
        {val}
      </span>
    );
  };

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Role & Assignment Authorization Matrix"
        subtitle="School policy mapping functional capabilities to the three profiles under HanuJai ERP rules."
        roleScope="System Governance"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Staff Directory', to: '/staff' },
          { label: 'Role & Assignment Matrix', to: '/admin/roles' },
        ]}
      />

      {/* Security Architecture Principle */}
      <div
        style={{
          padding: '14px 18px',
          backgroundColor: 'var(--hhs-surface-muted)',
          borderLeft: '4px solid var(--hhs-primary)',
          borderRadius: 'var(--hhs-radius-base)',
          marginBottom: '20px',
          fontSize: '0.82rem',
          lineHeight: 1.5,
          color: 'var(--hhs-text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <ShieldCheck size={24} style={{ color: 'var(--hhs-primary)', flexShrink: 0 }} />
        <div>
          <strong style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Principle of Least Privilege:</strong>{' '}
          In HanuJai High School ERP, role boundaries are enforced both at the client routing level and in <code>firestore.rules</code> and <code>demoRepository.ts</code>. Principal access is strictly read-only school-wide. Teachers hold class and subject assignments independently.
        </div>
      </div>

      {/* Permissions Matrix Table */}
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
              Operational Clearance Directory
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Active rules governing Session 2025–26
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">3 Role Profiles</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Domain / Capability</th>
                <th style={{ minWidth: '220px' }}>Description &amp; Operational Rule</th>
                <th style={{ width: '170px' }}>Principal (Read-Only)</th>
                <th style={{ width: '170px' }}>Class Teacher</th>
                <th style={{ width: '170px' }}>Subject Teacher</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--hhs-text-primary)', fontSize: '0.84rem' }}>
                      {row.capability}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-muted)', textTransform: 'uppercase' }}>
                      {row.domain}
                    </div>
                  </td>
                  <td>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.4 }}>
                      {row.description}
                    </p>
                  </td>
                  <td>{renderBadge(row.principal)}</td>
                  <td>{renderBadge(row.classTeacher)}</td>
                  <td>{renderBadge(row.subjectTeacher)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
