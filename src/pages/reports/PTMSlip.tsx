import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { AccessDenied } from '../error/AccessDenied';
import { Permissions } from '../../domain/permissions';
import type { StudentRecord } from '../../domain/types';
import logoSvg from '../../assets/logo.svg';
import { Printer } from 'lucide-react';

export const PTMSlip: React.FC = () => {
  const { studentId } = useParams<{ studentId?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDenied, setIsDenied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadStudent() {
      if (!studentId) {
        setError('Student ID parameter is required.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setIsDenied(false);
      try {
        const data = await provider.getStudentById(studentId);
        if (!isMounted) return;
        if (!data) {
          setError('Student record not found in active academic session.');
          return;
        }

        if (!Permissions.canViewStudent(currentUser, data)) {
          setIsDenied(true);
          setError(`Desk Authorization Boundary: Your role (${currentUser?.role}) is not authorized to access parent-teacher meeting records for students outside your allocated classes.`);
          return;
        }

        setStudent(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load student for PTM slip.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStudent();
    return () => {
      isMounted = false;
    };
  }, [provider, studentId, currentUser]);

  if (isLoading) {
    return <LoadingState message="Generating Parent-Teacher Meeting progress slip..." />;
  }

  if (isDenied) {
    return (
      <AccessDenied
        title="PTM Dossier Authorization Boundary"
        message={error || "You are not authorized to view this PTM slip."}
      />
    );
  }

  if (!student) {
    return <ErrorBanner message={error || "Student record not found."} />;
  }

  const attendance = student.attendanceSummary?.overallPercentage ?? 85.0;
  const isAarav = student.id === 'stu-10a-01';

  return (
    <div className="hhs-page-container">
      {/* Non-Printable Header */}
      <div className="no-print" style={{ marginBottom: '16px' }}>
        <PageHeader
          title="Parent-Teacher Meeting (PTM) Progress Slip"
          subtitle="Print-optimized alignment summary for guardian conference and remediation commitments."
          roleScope="Guardian & Educator Consultation"
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: 'Reports', to: '/reports' },
            { label: 'PTM Slip', to: `/reports/ptm-slip/${student.id}` },
          ]}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/reports/report-card/${student.id}`)}
                className="hhs-btn hhs-btn-secondary"
              >
                <span>Formal Report Card</span>
              </button>
              <button
                onClick={() => window.print()}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} />
                <span>Print PTM Conference Slip</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Printable Slip Container */}
      <div
        className="hhs-printable-card"
        style={{
          backgroundColor: '#ffffff',
          border: '2px solid var(--hhs-border)',
          borderRadius: 'var(--hhs-radius-container)',
          padding: '30px 36px',
          maxWidth: '780px',
          margin: '0 auto',
          color: '#202b2a',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid var(--hhs-primary)',
            paddingBottom: '14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img src={logoSvg} alt="School Crest" style={{ height: '50px', width: 'auto' }} />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--hhs-primary)' }}>
                HANUJAI HIGH SCHOOL, JAIPUR
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#5d6b68' }}>
                Parent-Teacher Conference Alignment Slip • Academic Session 2025–26
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--hhs-primary)' }}>CONFIDENTIAL</div>
            <div style={{ color: '#5d6b68' }}>Date: 15 February 2025</div>
          </div>
        </div>

        {/* Student Bio */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr',
            gap: '10px',
            backgroundColor: 'var(--hhs-surface-muted)',
            padding: '10px 14px',
            borderRadius: 'var(--hhs-radius-base)',
            marginBottom: '16px',
            fontSize: '0.82rem',
          }}
        >
          <div>
            <span style={{ fontSize: '0.7rem', color: '#5d6b68' }}>STUDENT:</span>
            <div style={{ fontWeight: 700 }}>{student.firstName} {student.lastName} (Roll {student.rollNumber})</div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#5d6b68' }}>CLASS &amp; SECTION:</span>
            <div style={{ fontWeight: 700, color: 'var(--hhs-primary)' }}>Class 10-A (Room 204)</div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#5d6b68' }}>PRIMARY GUARDIAN:</span>
            <div style={{ fontWeight: 600 }}>{student.guardianName} ({student.guardianRelation})</div>
          </div>
        </div>

        {/* Performance & Deficit Flags */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--hhs-primary)', textTransform: 'uppercase' }}>
            Conference Focus Areas &amp; Empirical Flags
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Box 1: Academic Trajectory */}
            <div style={{ border: '1px solid var(--hhs-border)', padding: '10px 12px', borderRadius: 'var(--hhs-radius-base)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isAarav ? 'var(--hhs-danger-text)' : 'var(--hhs-primary)' }}>
                {isAarav ? 'Academic Drop Flag (#ACAD-04)' : 'Academic Progress'}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Mathematics UT-1: <strong>{isAarav ? '22 / 25 (88%)' : '24 / 25'}</strong>
                <br />
                Mathematics UT-2: <strong>{isAarav ? '15 / 25 (60%)' : '23 / 25'}</strong>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#5d6b68', marginTop: '4px' }}>
                {isAarav ? 'Drop exceeds 15% threshold; remedial required.' : 'Steady scholastic consistency.'}
              </div>
            </div>

            {/* Box 2: Statutory Attendance */}
            <div style={{ border: '1px solid var(--hhs-border)', padding: '10px 12px', borderRadius: 'var(--hhs-radius-base)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: attendance < 75 ? 'var(--hhs-danger-text)' : 'var(--hhs-primary)' }}>
                {attendance < 75 ? 'CBSE Shortfall Warning (#ATT-03)' : 'Statutory Attendance'}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Current Aggregate: <strong>{attendance.toFixed(1)}%</strong>
                <br />
                Statutory Minimum: <strong>75.0%</strong>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#5d6b68', marginTop: '4px' }}>
                {attendance < 75 ? 'Shortfall risks board examination eligibility.' : 'Complies with CBSE examination by-laws.'}
              </div>
            </div>
          </div>
        </div>

        {/* Agreed Action Protocol */}
        <div style={{ border: '1px solid var(--hhs-border)', padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', marginBottom: '24px' }}>
          <h5 style={{ margin: '0 0 6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--hhs-primary)', textTransform: 'uppercase' }}>
            Agreed Parent-School Action Plan:
          </h5>
          <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', lineHeight: 1.5, color: '#202b2a' }}>
            <li>Guardian ensures student attends daily 07:45 AM Zero-Period Remedial Mathematics clinics.</li>
            <li>Zero unexcused absences permitted for the remainder of Term II. Certified medical certificates mandatory for any sick leave.</li>
            <li>Bi-weekly progress check-ins between primary guardian and Class Tutor Mrs. Ananya Sharma.</li>
          </ol>
        </div>

        {/* Signatures */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '40px',
            textAlign: 'center',
            paddingTop: '16px',
          }}
        >
          <div>
            <div style={{ height: '32px', borderBottom: '1px solid #202b2a', margin: '0 20px 6px' }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>Signature of Parent / Guardian</div>
            <div style={{ fontSize: '0.7rem', color: '#5d6b68' }}>{student.guardianName}</div>
          </div>

          <div>
            <div style={{ height: '32px', borderBottom: '1px solid #202b2a', margin: '0 20px 6px' }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>Mrs. Ananya Sharma</div>
            <div style={{ fontSize: '0.7rem', color: '#5d6b68' }}>Class Teacher 10-A (HanuJai High School)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
