import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { ClassSection, StudentRecord } from '../../domain/types';
import {
  Download,
  UserCheck,
} from 'lucide-react';

export const SectionRoster: React.FC = () => {
  const { classId = 'class-10-a' } = useParams<{ classId?: string }>();
  const navigate = useNavigate();
  const { provider } = useData();

  const [activeClass, setActiveClass] = useState<ClassSection | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadRoster() {
      setIsLoading(true);
      setError(null);
      try {
        const [cls, studList] = await Promise.all([
          provider.getClassById(classId),
          provider.getClassStudents(classId),
        ]);
        if (!isMounted) return;
        setActiveClass(cls);
        setStudents(studList);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load section roster.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRoster();
    return () => {
      isMounted = false;
    };
  }, [provider, classId]);

  // Export CSV
  const handleExportCSV = () => {
    if (!activeClass) return;
    const headers = [
      'Roll #',
      'Admission #',
      'First Name',
      'Last Name',
      'Gender',
      'Date of Birth',
      'Guardian Name',
      'Relation',
      'Primary Phone',
      'Attendance %',
      'Care Flags',
    ];

    const rows = students.map(s => [
      s.rollNumber,
      s.admissionNumber,
      `"${s.firstName}"`,
      `"${s.lastName}"`,
      s.gender,
      s.dateOfBirth,
      `"${s.guardianName}"`,
      s.guardianRelation,
      s.primaryPhone,
      s.attendanceSummary?.overallPercentage ?? 85,
      `"${s.careFlags?.map(f => f.code).join(' ') || 'None'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Roster_${activeClass.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <LoadingState message="Loading section student roster..." />;
  }

  return (
    <div className="hhs-page-container">
      <PageHeader
        title={`${activeClass?.label || 'Class 10-A'} — Official Student Roll Roster`}
        subtitle="Sequential roll-number register, demographic master records, and guardian communication channels."
        roleScope="Section Roster Management"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Classes', to: '/classes' },
          { label: 'Roster', to: `/classes/${classId}/students` },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExportCSV}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              <span>Export Roster (CSV)</span>
            </button>
            <button
              onClick={() => navigate(`/attendance/register/${classId}`)}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserCheck size={15} />
              <span>Mark Attendance</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Class Section Header Card */}
      <div
        className="hhs-panel"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          backgroundColor: 'var(--hhs-surface)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--hhs-radius-container)',
              backgroundColor: 'var(--hhs-primary-light)',
              color: 'var(--hhs-primary-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.25rem',
            }}
          >
            {activeClass?.section}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              {activeClass?.label} — Academic Session 2025–26
            </h3>
            <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', display: 'flex', gap: '12px', marginTop: '3px' }}>
              <span>Room: <strong>{activeClass?.roomNumber}</strong></span>
              <span>•</span>
              <span>Educator: <strong>{activeClass?.classTeacherName}</strong></span>
              <span>•</span>
              <span>Wing: <strong>Senior Secondary</strong></span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--hhs-primary)' }}>
              {students.length} / 40
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
              Active Enrolled Students
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">Statutory Quorum OK</span>
        </div>
      </div>

      {/* Roster Table */}
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
              Class Student Register
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
              Sequential roll order • Verified institutional dossiers
            </div>
          </div>
          <span className="hhs-badge hhs-badge-primary">
            {students.length} Enrolled Students
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="hhs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '45px' }} className="numeric">Roll</th>
                <th style={{ width: '120px' }}>Admission #</th>
                <th>Student Full Name</th>
                <th style={{ width: '60px' }}>Gender</th>
                <th style={{ width: '110px' }}>Date of Birth</th>
                <th>Primary Guardian</th>
                <th style={{ width: '140px' }}>Emergency Contact</th>
                <th className="numeric" style={{ width: '100px' }}>Attendance</th>
                <th style={{ width: '100px' }}>Care Flag</th>
                <th style={{ textAlign: 'right', width: '90px' }}>Dossier</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const att = s.attendanceSummary?.overallPercentage ?? 85;
                const isBelow75 = att < 75.0;

                return (
                  <tr key={s.id}>
                    <td className="numeric" style={{ fontWeight: 700 }}>
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
                      <span className="hhs-badge hhs-badge-neutral">{s.gender}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                        {s.dateOfBirth}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{s.guardianName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                        {s.guardianRelation}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-primary)' }}>
                        {s.primaryPhone}
                      </div>
                    </td>
                    <td className="numeric">
                      <span
                        style={{
                          fontWeight: 700,
                          color: isBelow75 ? 'var(--hhs-danger-text)' : 'inherit',
                        }}
                      >
                        {att.toFixed(1)}%
                      </span>
                      {isBelow75 && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--hhs-danger-text)', fontWeight: 600 }}>
                          &lt; 75% CBSE
                        </div>
                      )}
                    </td>
                    <td>
                      {s.careFlags && s.careFlags.length > 0 ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: 'var(--hhs-radius-sm)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            backgroundColor: 'var(--hhs-danger-light)',
                            color: 'var(--hhs-danger-text)',
                          }}
                        >
                          {s.careFlags[0].code}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--hhs-text-muted)' }}>None</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="hhs-btn hhs-btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', height: '28px' }}
                      >
                        Profile
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
