/**
 * HanuJai High School ERP — Office Registrar & Operations Desk
 * Tailored for administrative staff: Student directory quick-search, admission management,
 * parent visitor inquiries, section rosters, and statutory report dispatch.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { ClassSection, StudentRecord, AttendanceSession } from '../../domain/types';
import {
  Users,
  Search,
  UserPlus,
  FileText,
  CalendarCheck,
  Building,
  Phone,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export const OfficeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);

  // Rapid student search for parent visitors
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    async function loadOfficeData() {
      setIsLoading(true);
      setError(null);
      try {
        const today = '2026-10-21';
        const [clsRes, stuRes, attRes] = await Promise.all([
          provider.getClasses(),
          provider.getStudents({ limit: 1000 }),
          provider.getAttendanceSessions(today),
        ]);

        if (!isMounted) return;
        setClasses(clsRes);
        setAllStudents(stuRes.items);
        setAttendanceSessions(attRes);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load office registrar data.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadOfficeData();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  if (isLoading) {
    return <LoadingState message="Loading administrative ledger, section capacities, and student records..." />;
  }

  if (error) {
    return <ErrorBanner title="Office Workspace Unavailable" message={error} />;
  }

  const totalEnrolment = allStudents.length;
  const totalCapacity = classes.length * 40; // 20 * 40 = 800 nominal
  const capacityUtilization = totalCapacity > 0 ? Math.round((totalEnrolment / totalCapacity) * 100) : 0;

  // Filter students for quick visitor inquiry
  const filteredStudents = searchQuery.trim()
    ? allStudents.filter(s =>
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        s.primaryPhone.includes(searchQuery.trim())
      ).slice(0, 6)
    : [];

  const unsubmittedSections = attendanceSessions.filter(s => s.status !== 'submitted');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <PageHeader
        title="Office Registrar & Operations Desk"
        subtitle={`Academic Session 2025–2026 • Student Records & Admissions Administration • ${currentUser?.name}`}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/students')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <UserPlus size={16} />
              <span>Enroll New Student</span>
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={16} />
              <span>Official Reports</span>
            </button>
          </div>
        }
      />

      {/* Top Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Total Active Enrolment"
          value={totalEnrolment.toString()}
          subtext={`${capacityUtilization}% of Nominal Campus Capacity (${totalCapacity})`}
          icon={<Users size={20} />}
          trend={{ value: 'Full Roster Verified', isPositive: true }}
        />
        <MetricCard
          label="Registered Class Sections"
          value={classes.length.toString()}
          subtext="Grades 1 through 10 (Sections A & B)"
          icon={<Building size={20} />}
        />
        <MetricCard
          label="Roll-Call Exception Check"
          value={`${unsubmittedSections.length} Sections`}
          subtext={unsubmittedSections.length === 0 ? 'All 20 sections submitted' : 'Pending office follow-up'}
          icon={<CalendarCheck size={20} />}
          trend={{ value: unsubmittedSections.length === 0 ? 'Complete' : 'Pending Call', isPositive: unsubmittedSections.length === 0 }}
        />
        <MetricCard
          label="Statutory CBSE Compliance"
          value="Node 1730198"
          subtext="Jaipur Central Administrative Registry"
          icon={<FileText size={20} />}
        />
      </div>

      {/* Rapid Student Inquiry Bar for Visiting Parents */}
      <div className="hhs-card" style={{ padding: '20px', backgroundColor: 'var(--hhs-surface)' }}>
        <div style={{ marginBottom: '12px' }}>
          <h3 className="hhs-headline-sm">Rapid Student Lookup (Parent &amp; Visitor Desk)</h3>
          <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
            Instant search across all 20 sections by Student Name, Admission Number, or Guardian Phone.
          </p>
        </div>

        <div style={{ position: 'relative', maxWidth: '600px' }}>
          <input
            type="text"
            className="hhs-input"
            placeholder="Type student name (e.g. Aarav, Sneha), admission # (ADM/2023/1042) or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', fontSize: '0.9rem' }}
          />
          <Search
            size={18}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--hhs-text-muted)' }}
          />
        </div>

        {searchQuery.trim() && (
          <div style={{ marginTop: '16px' }}>
            {filteredStudents.length === 0 ? (
              <div style={{ padding: '16px', backgroundColor: 'var(--hhs-surface-muted)', borderRadius: 'var(--hhs-radius-base)', fontSize: '0.85rem', color: 'var(--hhs-text-secondary)' }}>
                No student found matching &ldquo;{searchQuery}&rdquo;. Verify spelling or check archive records.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    onClick={() => navigate(`/students/${student.id}`)}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--hhs-radius-base)',
                      border: '1px solid var(--hhs-border)',
                      backgroundColor: 'var(--hhs-canvas)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{student.fullName}</span>
                      <StatusBadge status="active" label={student.classLabel} />
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                      Adm #{student.admissionNumber} • Roll #{student.rollNumber}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={12} />
                      <span>{student.primaryPhone} ({student.guardianName})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--hhs-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Open Dossier</span>
                        <ExternalLink size={12} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two-Column Section: Capacity Roster & Operational Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* Section Load & Capacity */}
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="hhs-headline-sm">Section Rosters &amp; Capacity Load</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Active nominal section distribution across primary and secondary wings.
              </p>
            </div>
            <button
              onClick={() => navigate('/classes')}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Manage Classes</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="hhs-table" style={{ width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Assigned Room</th>
                  <th>Class Tutor</th>
                  <th className="tnum" style={{ textAlign: 'center' }}>Enrolled</th>
                  <th className="tnum" style={{ textAlign: 'center' }}>Max Cap</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.slice(0, 10).map(cls => (
                  <tr key={cls.id}>
                    <td style={{ fontWeight: 600 }}>{cls.label}</td>
                    <td style={{ color: 'var(--hhs-text-secondary)' }}>{cls.roomNumber}</td>
                    <td>{cls.classTeacherName}</td>
                    <td className="tnum" style={{ textAlign: 'center', fontWeight: 600 }}>{cls.studentCount}</td>
                    <td className="tnum" style={{ textAlign: 'center', color: 'var(--hhs-text-muted)' }}>{cls.maxCapacity}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/classes/${cls.id}/students`)}
                        className="hhs-btn hhs-btn-text hhs-btn-sm"
                        style={{ padding: '2px 6px', fontSize: '0.78rem' }}
                      >
                        Roll Roster
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Reports & Registry Shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="hhs-card" style={{ padding: '20px' }}>
            <h3 className="hhs-headline-sm" style={{ marginBottom: '8px' }}>Administrative Reports Launchpad</h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '16px' }}>
              Direct generation for parental inquiries, transfers, and annual audits.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                onClick={() => navigate('/reports/attendance')}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--hhs-radius-base)',
                  border: '1px solid var(--hhs-border)',
                  backgroundColor: 'var(--hhs-canvas)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Cumulative Attendance Audit</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)' }}>Statutory 75% CBSE attendance register export</div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--hhs-text-muted)' }} />
              </div>

              <div
                onClick={() => navigate('/reports')}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--hhs-radius-base)',
                  border: '1px solid var(--hhs-border)',
                  backgroundColor: 'var(--hhs-canvas)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Formal Student Academic Report Cards</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)' }}>Printable CBSE Scholastic Grade Cards</div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--hhs-text-muted)' }} />
              </div>

              <div
                onClick={() => navigate('/staff')}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--hhs-radius-base)',
                  border: '1px solid var(--hhs-border)',
                  backgroundColor: 'var(--hhs-canvas)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Faculty &amp; Staff Directory</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)' }}>Employee codes, departments &amp; designations</div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--hhs-text-muted)' }} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
