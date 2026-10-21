import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Check, X, ShieldCheck } from 'lucide-react';

interface PermissionRow {
  domain: string;
  capability: string;
  description: string;
  principal: boolean | string;
  officeAdmin: boolean | string;
  classTeacher: boolean | string;
  subjectTeacher: boolean | string;
}

const PERMISSION_MATRIX: PermissionRow[] = [
  {
    domain: 'Student Master Ledger',
    capability: 'View Student Demographic Profiles',
    description: 'Access names, DOB, roll numbers, guardian contacts, and residential addresses.',
    principal: true,
    officeAdmin: true,
    classTeacher: 'Assigned Class',
    subjectTeacher: 'Assigned Classes',
  },
  {
    domain: 'Student Master Ledger',
    capability: 'New Student Admission & Enrollment',
    description: 'Register new candidates, assign admission numbers, and allocate classrooms.',
    principal: true,
    officeAdmin: true,
    classTeacher: false,
    subjectTeacher: false,
  },
  {
    domain: 'Student Master Ledger',
    capability: 'Edit Master Profile Records',
    description: 'Revise demographic data with mandatory audit trail justification.',
    principal: true,
    officeAdmin: true,
    classTeacher: false,
    subjectTeacher: false,
  },
  {
    domain: 'Attendance Operations',
    capability: 'Mark Daily Attendance Register',
    description: 'Toggle Present/Absent/Late during the active morning window (07:45–09:15).',
    principal: true,
    officeAdmin: false,
    classTeacher: 'Assigned Section',
    subjectTeacher: false,
  },
  {
    domain: 'Attendance Operations',
    capability: 'Request Late Attendance Correction',
    description: 'Submit formal post-window adjustment request with mandatory justification.',
    principal: true,
    officeAdmin: false,
    classTeacher: 'Assigned Section',
    subjectTeacher: false,
  },
  {
    domain: 'Attendance Operations',
    capability: 'Authorize Dual-Custody Corrections',
    description: 'Approve or reject teacher correction requests to finalize official register.',
    principal: true,
    officeAdmin: false,
    classTeacher: false,
    subjectTeacher: false,
  },
  {
    domain: 'Academic Assessments',
    capability: 'Configure Assessment Cycles & Weights',
    description: 'Define max marks, terms, pass marks, and term weightages.',
    principal: true,
    officeAdmin: true,
    classTeacher: false,
    subjectTeacher: false,
  },
  {
    domain: 'Academic Assessments',
    capability: 'Enter Subject Marks',
    description: 'Spreadsheet score entry with real-time score caps and absent validations.',
    principal: true,
    officeAdmin: false,
    classTeacher: 'Assigned Subject',
    subjectTeacher: 'Assigned Subject',
  },
  {
    domain: 'Academic Assessments',
    capability: 'Consolidated Cross-Subject Gradebook',
    description: 'Multi-subject comparative matrix and student deficiency inspections.',
    principal: true,
    officeAdmin: false,
    classTeacher: 'Assigned Section',
    subjectTeacher: false,
  },
  {
    domain: 'Pastoral Care',
    capability: 'Log Observations & Incidents',
    description: 'Document commendations, proctorial notices, and conduct reports.',
    principal: true,
    officeAdmin: false,
    classTeacher: true,
    subjectTeacher: true,
  },
  {
    domain: 'Pastoral Care',
    capability: 'Access Confidential Proctorial Records',
    description: 'Inspect privileged counseling files and critical disciplinary hearings.',
    principal: true,
    officeAdmin: false,
    classTeacher: 'Assigned Students',
    subjectTeacher: false,
  },
  {
    domain: 'Institutional Governance',
    capability: 'CBSE Compliance & Form A Filing',
    description: 'Official statutory filings, condonation certificates, and bulk exports.',
    principal: true,
    officeAdmin: true,
    classTeacher: false,
    subjectTeacher: false,
  },
  {
    domain: 'Institutional Governance',
    capability: 'Faculty Provisioning & Role Assignments',
    description: 'Manage staff accounts, class educator assignments, and subject mappings.',
    principal: true,
    officeAdmin: true,
    classTeacher: false,
    subjectTeacher: false,
  },
  {
    domain: 'System Security',
    capability: 'Immutable Audit Trail Inspection',
    description: 'Inspect cryptographic logs of logins, mutations, and dual-custody diffs.',
    principal: true,
    officeAdmin: false,
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
          backgroundColor: 'var(--hhs-accent-light)',
          color: 'var(--hhs-accent-text)',
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
        title="Role & Assignment Authorization Matrix (RBAC)"
        subtitle="Definitive institutional policy mapping functional capabilities to staff clearances under Firebase Security Rules."
        roleScope="System Governance"
        breadcrumbs={[
          { label: 'Operations Hub', to: '/' },
          { label: 'Staff', to: '/staff' },
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
          In HanuJai High School ERP, role boundaries are enforced both at the client routing level and in <code>firestore.rules</code>. Hiding navigation items is not sufficient; all database mutations check cryptographic token claims and assignment documents.
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
          <span className="hhs-badge hhs-badge-primary">4 Staff Roles</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Domain / Capability</th>
                <th style={{ minWidth: '220px' }}>Description &amp; Operational Rule</th>
                <th style={{ width: '140px' }}>Principal</th>
                <th style={{ width: '140px' }}>Office Registrar</th>
                <th style={{ width: '140px' }}>Class Tutor</th>
                <th style={{ width: '140px' }}>Subject Faculty</th>
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
                  <td>{renderBadge(row.officeAdmin)}</td>
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
