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

export const StudentReportCard: React.FC = () => {
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
    async function loadReport() {
      if (!studentId) {
        setError('Student ID parameter is required.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setIsDenied(false);
      try {
        const stud = await provider.getStudentById(studentId);

        if (!isMounted) return;
        if (!stud) {
          setError('Student record not found in active academic session.');
          return;
        }

        if (!Permissions.canViewStudentReportCard(currentUser, stud)) {
          setIsDenied(true);
          setError(`Desk Authorization Boundary: Your role (${currentUser?.role}) is not authorized to access cumulative 5-subject report cards for students outside your assigned section.`);
          return;
        }

        setStudent(stud);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to generate student report card.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadReport();
    return () => {
      isMounted = false;
    };
  }, [provider, studentId, currentUser]);

  if (isLoading) {
    return <LoadingState message="Generating formal institutional report card..." />;
  }

  if (isDenied) {
    return (
      <AccessDenied
        title="Report Authorization Boundary"
        message={error || "You are not authorized to view the cumulative report card for this student."}
      />
    );
  }

  if (!student) {
    return <ErrorBanner message={error || "Student record not found."} />;
  }

  const attendance = student.attendanceSummary?.overallPercentage ?? 85.0;
  const isAarav = student.id === 'stu-10a-01';

  // Synthetic report marks for 5 CBSE subjects
  const reportRows = [
    { name: 'Mathematics', code: '041', ut1: isAarav ? 22 : 24, ut2: isAarav ? 15 : 23, hy: isAarav ? 68 : 74, max: 130, total: isAarav ? 105 : 121, grade: isAarav ? 'B1' : 'A1' },
    { name: 'Science', code: '086', ut1: 21, ut2: 22, hy: 70, max: 130, total: 113, grade: 'A2' },
    { name: 'English Language & Lit.', code: '184', ut1: 23, ut2: 24, hy: 72, max: 130, total: 119, grade: 'A1' },
    { name: 'Hindi Course-A', code: '002', ut1: 20, ut2: 21, hy: 65, max: 130, total: 106, grade: 'B1' },
    { name: 'Social Science', code: '087', ut1: 22, ut2: 23, hy: 71, max: 130, total: 116, grade: 'A2' },
  ];

  const grandTotal = reportRows.reduce((a, b) => a + b.total, 0);
  const grandMax = reportRows.reduce((a, b) => a + b.max, 0);
  const grandPct = ((grandTotal / grandMax) * 100).toFixed(1);

  return (
    <div className="hhs-page-container">
      {/* Non-Printable Header & Controls */}
      <div className="no-print" style={{ marginBottom: '16px' }}>
        <PageHeader
          title="CBSE Formal Student Report Card"
          subtitle="Continuous and Comprehensive Evaluation (CCE) cumulative dossier with printable layout."
          roleScope="Institutional Certification"
          breadcrumbs={[
            { label: 'Operations Hub', to: '/' },
            { label: 'Reports', to: '/reports' },
            { label: `${student.firstName} ${student.lastName}`, to: `/students/${student.id}` },
            { label: 'Report Card', to: `/reports/report-card/${student.id}` },
          ]}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/reports/ptm-slip/${student.id}`)}
                className="hhs-btn hhs-btn-secondary"
              >
                <span>Switch to PTM Slip</span>
              </button>
              <button
                onClick={() => window.print()}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} />
                <span>Print Official Report Card</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Official Printable Report Card Document */}
      <div
        className="hhs-printable-card"
        style={{
          backgroundColor: '#ffffff',
          border: '2px solid var(--hhs-border)',
          borderRadius: 'var(--hhs-radius-container)',
          padding: '36px 40px',
          maxWidth: '860px',
          margin: '0 auto',
          color: '#202b2a',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        {/* Institutional Letterhead */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid var(--hhs-primary)',
            paddingBottom: '20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src={logoSvg} alt="School Crest" style={{ height: '64px', width: 'auto' }} />
            <div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--hhs-primary)', letterSpacing: '-0.02em' }}>
                HANUJAI HIGH SCHOOL
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#5d6b68', fontWeight: 500 }}>
                Affiliated to Central Board of Secondary Education (CBSE) • Affiliation #1730249
              </div>
              <div style={{ fontSize: '0.75rem', color: '#83918e' }}>
                Civil Lines, Jaipur, Rajasthan 302006 • Email: registrar@hanujai.edu.in
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 'var(--hhs-radius-sm)',
                backgroundColor: 'var(--hhs-surface-muted)',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--hhs-primary)',
                border: '1px solid var(--hhs-border)',
              }}
            >
              SESSION 2025–26
            </span>
            <div style={{ fontSize: '0.72rem', color: '#5d6b68', marginTop: '4px' }}>
              ANNUAL PROGRESS DOSSIER
            </div>
          </div>
        </div>

        {/* Student Bio Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr',
            gap: '12px',
            backgroundColor: 'var(--hhs-surface-muted)',
            padding: '14px 18px',
            borderRadius: 'var(--hhs-radius-base)',
            border: '1px solid var(--hhs-border)',
            marginBottom: '20px',
            fontSize: '0.84rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', color: '#5d6b68', textTransform: 'uppercase' }}>Candidate Name</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#202b2a' }}>
              {student.firstName} {student.lastName}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#5d6b68' }}>
              Guardian: {student.guardianName} ({student.guardianRelation})
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', color: '#5d6b68', textTransform: 'uppercase' }}>Admission / Roll</div>
            <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{student.admissionNumber}</div>
            <div style={{ fontSize: '0.75rem', color: '#5d6b68' }}>
              Roll Number: <strong>{student.rollNumber}</strong> • Gender: <strong>{student.gender}</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', color: '#5d6b68', textTransform: 'uppercase' }}>Class &amp; Section</div>
            <div style={{ fontWeight: 700, color: 'var(--hhs-primary)' }}>Class 10-A</div>
            <div style={{ fontSize: '0.75rem', color: '#5d6b68' }}>
              Educator: Mrs. Ananya Sharma
            </div>
          </div>
        </div>

        {/* Scholastic Evaluation Table */}
        <div style={{ marginBottom: '20px' }}>
          <h4
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--hhs-primary)',
              marginBottom: '8px',
            }}
          >
            Part 1: Scholastic Academic Evaluation
          </h4>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.84rem',
              border: '1px solid var(--hhs-border)',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--hhs-surface-muted)', borderBottom: '1px solid var(--hhs-border)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Subject</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '70px' }}>UT-1 (25)</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '70px' }}>UT-2 (25)</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '75px' }}>Half-Yr (80)</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '80px' }}>Total (130)</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '65px' }}>% Score</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '65px' }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--hhs-border)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#83918e' }}>Code: {r.code}</div>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{r.ut1}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{r.ut2}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{r.hy}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                    {r.total}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                    {((r.total / r.max) * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '2px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        backgroundColor: r.grade === 'A1' || r.grade === 'A2' ? 'var(--hhs-primary-light)' : 'var(--hhs-surface-muted)',
                        color: r.grade === 'A1' || r.grade === 'A2' ? 'var(--hhs-primary-text)' : 'inherit',
                      }}
                    >
                      {r.grade}
                    </span>
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: 'var(--hhs-surface-muted)', fontWeight: 700 }}>
                <td style={{ padding: '10px 12px' }}>CUMULATIVE AGGREGATE</td>
                <td colSpan={3} style={{ textAlign: 'right', padding: '10px 12px', color: '#5d6b68' }}>
                  Grand Max: {grandMax}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                  {grandTotal}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--hhs-primary)', fontSize: '0.95rem' }}>
                  {grandPct}%
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{ fontWeight: 800, color: 'var(--hhs-primary)' }}>
                    {Number(grandPct) >= 80 ? 'A1' : 'B1'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Attendance & Co-Curricular Split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          {/* Attendance Audit Box */}
          <div style={{ border: '1px solid var(--hhs-border)', padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)' }}>
            <h5 style={{ margin: '0 0 6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--hhs-primary)' }}>
              Part 2: Attendance Verification
            </h5>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span>Instruction Days Logged:</span>
              <strong>142 Days</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span>Candidate Attendance:</span>
              <strong style={{ color: attendance < 75 ? 'var(--hhs-danger-text)' : 'var(--hhs-primary)' }}>
                {attendance.toFixed(1)}% ({Math.round(142 * (attendance / 100))} Days)
              </strong>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#5d6b68', marginTop: '6px', lineHeight: 1.35 }}>
              {attendance < 75 ? (
                <span style={{ color: 'var(--hhs-danger-text)', fontWeight: 600 }}>
                  Statutory Deficit: Falls below mandatory CBSE 75% attendance threshold. Requires condonation petition.
                </span>
              ) : (
                'Statutory Quorum: Meets mandatory CBSE Rule 14.1 examination attendance threshold.'
              )}
            </div>
          </div>

          {/* Co-Scholastic Assessment */}
          <div style={{ border: '1px solid var(--hhs-border)', padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)' }}>
            <h5 style={{ margin: '0 0 6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--hhs-primary)' }}>
              Part 3: Co-Scholastic &amp; Life Skills
            </h5>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span>Work Education / Social Service:</span>
              <strong style={{ color: 'var(--hhs-primary)' }}>A (Exemplary)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span>Art &amp; Cultural Activity:</span>
              <strong style={{ color: 'var(--hhs-primary)' }}>A (Active)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span>Health &amp; Physical Fitness:</span>
              <strong style={{ color: 'var(--hhs-primary)' }}>B (Satisfactory)</strong>
            </div>
          </div>
        </div>

        {/* Teacher & Principal Remarks */}
        <div style={{ border: '1px solid var(--hhs-border)', padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', marginBottom: '30px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--hhs-primary)', textTransform: 'uppercase' }}>
            Class Educator General Observations &amp; Guidance:
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#202b2a', lineHeight: 1.45 }}>
            {isAarav
              ? 'Aarav displays sound foundational analytical faculties in linguistic subjects. A marked decline in Mathematics between UT-1 and UT-2 requires structured remedial intervention during zero-period clinics. Regularity of attendance must be reinforced to maintain CBSE board examination clearance.'
              : 'Consistent academic dedication and exemplary classroom discipline. Demonstrates keen grasp of scientific concepts and active participation in co-curricular debates.'}
          </p>
        </div>

        {/* Formal Institutional Signatures */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '20px',
            textAlign: 'center',
            paddingTop: '20px',
          }}
        >
          <div>
            <div style={{ height: '36px', borderBottom: '1px solid #202b2a', margin: '0 20px 8px' }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>Mrs. Ananya Sharma</div>
            <div style={{ fontSize: '0.7rem', color: '#5d6b68' }}>Class Teacher 10-A</div>
          </div>

          <div>
            <div style={{ height: '36px', borderBottom: '1px solid #202b2a', margin: '0 20px 8px' }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>Examination Controller</div>
            <div style={{ fontSize: '0.7rem', color: '#5d6b68' }}>CBSE Examination Cell</div>
          </div>

          <div>
            <div style={{ height: '36px', borderBottom: '1px solid #202b2a', margin: '0 20px 8px' }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>Dr. Arvind Rathore</div>
            <div style={{ fontSize: '0.7rem', color: '#5d6b68' }}>Principal / Head of Institution</div>
          </div>
        </div>
      </div>
    </div>
  );
};
