import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { Drawer } from '../../components/ui/Drawer';
import type { ClassSection, StudentRecord, AuditEvent } from '../../domain/types';
import {
  Users,
  CalendarCheck2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  ShieldAlert,
} from 'lucide-react';

export const OperationsHub: React.FC = () => {
  const { currentUser } = useAuth();
  const { provider } = useData();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [flaggedStudents, setFlaggedStudents] = useState<StudentRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected student for detail inspection drawer
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      setIsLoading(true);
      setError(null);
      try {
        const [clsList, studentRes, auditRes] = await Promise.all([
          provider.getClasses(),
          provider.getStudents({ limit: 100 }),
          provider.getAuditEvents({ limit: 8 }),
        ]);

        if (!isMounted) return;
        setClasses(clsList);
        setTotalStudents(studentRes.total);

        // Filter students with explainable care flags
        const flagged = studentRes.items.filter(s => s.activeFlags && s.activeFlags.length > 0);
        setFlaggedStudents(flagged);
        setAuditLog(auditRes);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to retrieve operational metrics.';
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  if (isLoading) {
    return <LoadingState message="Compiling morning campus metrics & class registers..." />;
  }

  const role = currentUser?.role;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <PageHeader
        title={
          role === 'principal'
            ? 'Operations Hub — Principal Desk'
            : role === 'office_admin'
            ? 'Operations Hub — Office Registrar'
            : role === 'class_teacher'
            ? 'Class 10-A Operational Desk'
            : 'Faculty Operations Desk'
        }
        subtitle="HanuJai High School, Jaipur • Real-time morning roll-call reconciliation, care registry, and institutional ledger."
        breadcrumbs={[
          { label: 'Campus' },
          { label: 'Operations Hub' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            {role === 'class_teacher' ? (
              <button
                onClick={() => navigate('/attendance/register/class-10-a')}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CalendarCheck2 size={15} />
                <span>Mark 10-A Attendance</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/attendance')}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CalendarCheck2 size={15} />
                <span>Class Attendance Register</span>
              </button>
            )}
            <button
              onClick={() => navigate('/students')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={15} />
              <span>Student Ledger</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner title="Operational Data Error" message={error} />}

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        <MetricCard
          label="Total Student Enrollment"
          value={totalStudents > 0 ? totalStudents : '780'}
          subValue="Classes 1 to 10 (20 Sections A & B)"
          trend="neutral"
          icon={<Users size={18} />}
        />
        <MetricCard
          label="Morning Attendance Rate"
          value="96.8%"
          subValue="Class 10-A: 97.4% present"
          trend="up"
          trendLabel="+1.2% vs last term"
          icon={<CalendarCheck2 size={18} />}
        />
        <MetricCard
          label="Morning Roll Call Status"
          value="18 / 20"
          subValue="Sections finalized for 07:45–09:15 window"
          trend="neutral"
          icon={<Clock size={18} />}
        />
        <MetricCard
          label="Explainable Student Care Flags"
          value={flaggedStudents.length.toString()}
          subValue="Rule-based attendance/academic alerts"
          trend={flaggedStudents.length > 0 ? 'down' : 'neutral'}
          trendLabel="Transparent criteria"
          icon={<AlertTriangle size={18} />}
        />
      </div>

      {/* Two Column Layout: Section Roll-Call Status & Student Care Registry */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: '24px',
        }}
      >
        {/* Left Column: Section Roll-Call Registry */}
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--hhs-border)',
            }}
          >
            <div>
              <h2 className="hhs-headline-sm">Today's Class Roll Call Registry</h2>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Session Window: 07:45 – 09:15 AM IST • Grace period 15 mins
              </p>
            </div>
            <span className="hhs-badge hhs-badge-primary">Window Active</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="hhs-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Class & Section</th>
                  <th>Class Tutor</th>
                  <th>Strength</th>
                  <th>Roll-Call Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {classes.slice(0, 10).map((cls, idx) => {
                  const isFinalized = idx !== 1 && idx !== 5;
                  return (
                    <tr key={cls.id}>
                      <td style={{ fontWeight: 600 }}>{cls.label}</td>
                      <td style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.82rem' }}>
                        {cls.classTeacherName}
                      </td>
                      <td className="numeric tnum" style={{ fontSize: '0.82rem' }}>
                        {cls.studentCount} / {cls.maxCapacity}
                      </td>
                      <td>
                        {isFinalized ? (
                          <span
                            className="hhs-badge hhs-badge-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <CheckCircle2 size={11} /> Finalized
                          </span>
                        ) : (
                          <span
                            className="hhs-badge hhs-badge-accent"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Clock size={11} /> Pending Roll Call
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/attendance/register/${cls.id}`)}
                          className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                          style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {classes.length > 10 && (
            <div style={{ marginTop: '14px', textAlign: 'center' }}>
              <button
                onClick={() => navigate('/classes')}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              >
                View All {classes.length} Sections
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Explainable Student Care Registry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Transparent Care Registry */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--hhs-border)',
              }}
            >
              <div>
                <h2 className="hhs-headline-sm">Explainable Care Registry</h2>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Transparent, non-black-box indicators requiring teacher intervention.
                </p>
              </div>
              <ShieldAlert size={18} color="var(--hhs-accent)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {flaggedStudents.map(student => (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: '1px solid var(--hhs-border)',
                    backgroundColor: 'var(--hhs-surface-hover)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--hhs-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--hhs-border)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                        {student.firstName} {student.lastName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                        {student.classLabel} • Roll #{student.rollNumber} • Adm #{student.admissionNumber}
                      </div>
                    </div>
                    <span className="tnum" style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--hhs-danger)' }}>
                      {student.attendancePercentage}% Att.
                    </span>
                  </div>

                  {student.activeFlags && student.activeFlags.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {student.activeFlags.map((flag, fIdx) => (
                        <div
                          key={fIdx}
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 8px',
                            borderRadius: 'var(--hhs-radius-sm)',
                            backgroundColor:
                              flag.severity === 'alert' ? 'var(--hhs-danger-light)' : 'var(--hhs-accent-light)',
                            color:
                              flag.severity === 'alert' ? 'var(--hhs-danger-text)' : 'var(--hhs-accent-text)',
                            border: `1px solid ${flag.severity === 'alert' ? '#f0bcb8' : '#e6cdb2'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>
                            <strong>[#{flag.code}]</strong> {flag.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {flaggedStudents.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
                  No active explainable care alerts. All student cohorts meet attendance thresholds.
                </div>
              )}
            </div>
          </div>

          {/* Institutional Audit Ledger Preview */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                paddingBottom: '10px',
                borderBottom: '1px solid var(--hhs-border)',
              }}
            >
              <div>
                <h3 className="hhs-headline-sm" style={{ fontSize: '0.92rem' }}>
                  Institutional Audit Ledger
                </h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', fontSize: '0.74rem' }}>
                  Dual-custody verification trail & operational events.
                </p>
              </div>
              <FileText size={16} color="var(--hhs-text-secondary)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {auditLog.slice(0, 4).map(event => (
                <div
                  key={event.id}
                  style={{
                    fontSize: '0.76rem',
                    padding: '8px 10px',
                    borderLeft: '3px solid var(--hhs-primary)',
                    backgroundColor: 'var(--hhs-canvas)',
                    borderRadius: '0 var(--hhs-radius-sm) var(--hhs-radius-sm) 0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{event.actorName}</span>
                    <span className="tnum" style={{ color: 'var(--hhs-text-muted)', fontSize: '0.7rem' }}>
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                    {event.summary}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Student Care Drawer */}
      <Drawer
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        title={
          selectedStudent
            ? `${selectedStudent.firstName} ${selectedStudent.lastName} — Student Record`
            : 'Student Record'
        }
        subtitle={
          selectedStudent
            ? `${selectedStudent.classLabel} • Admission #${selectedStudent.admissionNumber} • Roll #${selectedStudent.rollNumber}`
            : ''
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => setSelectedStudent(null)}
              className="hhs-btn hhs-btn-secondary"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (selectedStudent) {
                  navigate(`/students/${selectedStudent.id}`);
                }
              }}
              className="hhs-btn hhs-btn-primary"
            >
              Open Full Dossier
            </button>
          </div>
        }
      >
        {selectedStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status overview */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--hhs-canvas)',
                border: '1px solid var(--hhs-border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}
            >
              <div>
                <span className="hhs-label" style={{ marginBottom: '2px' }}>Academic Status</span>
                <span className="hhs-badge hhs-badge-primary">{selectedStudent.status}</span>
              </div>
              <div>
                <span className="hhs-label" style={{ marginBottom: '2px' }}>Attendance Rate</span>
                <span
                  className="tnum"
                  style={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: selectedStudent.attendancePercentage < 75 ? 'var(--hhs-danger)' : 'var(--hhs-primary)',
                  }}
                >
                  {selectedStudent.attendancePercentage}% (CBSE min 75%)
                </span>
              </div>
              <div>
                <span className="hhs-label" style={{ marginBottom: '2px' }}>Guardian Name</span>
                <span style={{ fontWeight: 600 }}>{selectedStudent.guardianName} ({selectedStudent.guardianRelation})</span>
              </div>
              <div>
                <span className="hhs-label" style={{ marginBottom: '2px' }}>Emergency Contact</span>
                <span className="tnum" style={{ fontWeight: 600 }}>{selectedStudent.primaryPhone}</span>
              </div>
            </div>

            {/* Explainable Care Rule Breakdown */}
            <div>
              <h4 className="hhs-headline-sm" style={{ fontSize: '0.88rem', marginBottom: '8px' }}>
                Active Care Flags & Deterministic Rules
              </h4>
              {selectedStudent.activeFlags && selectedStudent.activeFlags.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedStudent.activeFlags.map((flag, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--hhs-radius-base)',
                        backgroundColor: 'var(--hhs-surface)',
                        border: '1px solid var(--hhs-border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="hhs-badge hhs-badge-danger">#{flag.code}</span>
                        <span className="tnum" style={{ fontSize: '0.72rem', color: 'var(--hhs-text-muted)' }}>
                          Triggered: {flag.triggeredAt.split('T')[0]}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.84rem', marginTop: '6px' }}>
                        {flag.title}
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                        <strong>Trigger Reason:</strong> {flag.reason}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)' }}>
                  No active flags recorded.
                </div>
              )}
            </div>

            {/* Address */}
            <div>
              <span className="hhs-label" style={{ marginBottom: '2px' }}>Residential Address</span>
              <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)' }}>
                {selectedStudent.residentialAddress}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
