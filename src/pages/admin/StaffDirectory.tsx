import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { StaffUser } from '../../domain/types';
import {
  Search,
  UserCheck,
  BookOpen,
} from 'lucide-react';

export const StaffDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { provider } = useData();

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const fetchStaff = async () => {
    try {
      const data = await provider.getStaffMembers();
      setStaffList(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load staff directory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchStaff();
  }, [provider]);

  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.displayName || s.fullName || '').toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q);

      const matchesRole = roleFilter === 'all' || s.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [staffList, searchQuery, roleFilter]);

  if (isLoading) {
    return <LoadingState message="Loading institutional staff directory..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Institutional Staff & Faculty Directory"
        subtitle="Manage faculty accounts, role clearances, and academic assignments for HanuJai High School."
        roleScope="Administrative Governance"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Staff Directory', to: '/staff' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate('/admin/class-teachers')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserCheck size={15} />
              <span>Tutor Allocations</span>
            </button>
            <button
              onClick={() => navigate('/admin/subject-teachers')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <BookOpen size={15} />
              <span>Subject Matrix</span>
            </button>
          </div>
        }
      />

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
          <div className="hhs-metric-label">Total Provisioned Staff</div>
          <div className="hhs-metric-value">{staffList.length} Accounts</div>
          <div className="hhs-metric-sub">Session 2025–26</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Teaching Faculty</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {staffList.filter(s => s.role === 'class_teacher' || s.role === 'subject_teacher').length} Members
          </div>
          <div className="hhs-metric-sub">Class &amp; Subject Teachers</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Administrative Staff</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-accent-text)' }}>
            {staffList.filter(s => s.role === 'principal').length} Members
          </div>
          <div className="hhs-metric-sub">School Leadership</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Security &amp; RBAC Mode</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.15rem', color: 'var(--hhs-primary)' }}>
            Least-Privilege
          </div>
          <div className="hhs-metric-sub">Firebase Security Rules</div>
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
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--hhs-text-muted)' }}
          />
          <input
            type="text"
            className="hhs-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search staff by name, email, employee ID..."
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>Role Clearance:</label>
          <select
            className="hhs-select"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Roles</option>
            <option value="principal">Principal</option>
            <option value="class_teacher">Class Teacher</option>
            <option value="subject_teacher">Subject Teacher</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
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
              Faculty Identity &amp; Credential Ledger
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Authenticated staff members authorized for school operations
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">
            Showing {filteredStaff.length} of {staffList.length} Accounts
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Staff ID</th>
                <th>Full Name</th>
                <th>Institutional Email</th>
                <th>RBAC Role</th>
                <th>Assigned Class</th>
                <th>Teaching Subjects</th>
                <th>Status</th>
                <th style={{ textAlign: 'right', width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(staff => {
                const isSuper = staff.role === 'principal';

                return (
                  <tr key={staff.id}>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                        {staff.id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                        {staff.displayName}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)' }}>
                        {staff.email}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`hhs-badge ${
                          staff.role === 'principal'
                            ? 'hhs-badge-primary'
                            : 'hhs-badge-neutral'
                        }`}
                      >
                        {staff.role === 'principal'
                          ? 'Principal'
                          : staff.role === 'class_teacher'
                          ? 'Class Tutor'
                          : 'Subject Faculty'}
                      </span>
                    </td>
                    <td>
                      {staff.assignedClassId ? (
                        <span className="hhs-badge hhs-badge-primary">
                          {staff.assignedClassId.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--hhs-text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      {staff.assignedSubjectIds && staff.assignedSubjectIds.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {staff.assignedSubjectIds.map(subId => (
                            <span key={subId} className="hhs-badge hhs-badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {subId.replace('subj-', '').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--hhs-text-muted)', fontSize: '0.8rem' }}>
                          {isSuper ? 'All Subjects (Admin)' : '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status="active" label="Active" />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--hhs-text-muted)' }}>Read-Only</span>
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
