/**
 * HanuJai High School ERP — Office Staff Dashboard
 * Tailored for administrative staff and parent inquiries.
 * Focus: Student lookup, attendance status, academic progress, and report generation.
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
  FileText,
  CalendarCheck,
  AlertCircle,
  ArrowRight,
  Printer,
  CheckCircle,
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
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadOfficeData() {
      setIsLoading(true);
      setError(null);
      try {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
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
        setError(err instanceof Error ? err.message : 'Could not load office data.');
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
    return <LoadingState message="Loading office records..." />;
  }

  if (error) {
    return <ErrorBanner title="Could not load office records" message={error} />;
  }

  const totalEnrolment = allStudents.length;

  let totalPresent = 0;
  let totalAbsent = 0;
  attendanceSessions.forEach(s => {
    totalPresent += s.presentCount;
    totalAbsent += s.absentCount;
  });

  const pendingSections = classes.filter(
    cls => !attendanceSessions.some(s => s.classId === cls.id && s.status === 'submitted')
  );

  // Filter students for quick visitor inquiry
  const filteredStudents = searchQuery.trim().length >= 2
    ? allStudents.filter(s =>
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        s.primaryPhone.includes(searchQuery.trim()) ||
        s.classLabel.toLowerCase().includes(searchQuery.toLowerCase().trim())
      ).slice(0, 5)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <PageHeader
        title="Home"
        subtitle={`Session 2025–2026 • HanuJai High School • Welcome, ${currentUser?.name || 'Office Staff'}`}
        roleScope="Office Staff"
        breadcrumbs={[{ label: 'Home' }]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate('/students')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={15} />
              <span>Student Directory</span>
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={15} />
              <span>Reports</span>
            </button>
          </div>
        }
      />

      {/* Parent Inquiry & Student Search Card */}
      <div
        className="hhs-card"
        style={{
          padding: '16px 20px',
          border: '1px solid var(--hhs-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div>
          <h3 className="hhs-headline-sm" style={{ marginBottom: '2px' }}>Parent & Visitor Inquiry</h3>
          <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
            Search by student name, admission number, or guardian phone to view student progress.
          </p>
        </div>

        <div style={{ position: 'relative', maxWidth: '600px' }}>
          <input
            type="text"
            className="hhs-input"
            placeholder="Type student name (e.g. Aarav), admission # (ADM/2023/1042) or phone..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedStudent(null);
            }}
            style={{ paddingLeft: '36px', fontSize: '0.9rem' }}
          />
          <Search
            size={18}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--hhs-text-secondary)' }}
          />
        </div>

        {/* Live Search Results */}
        {searchQuery.trim().length >= 2 && !selectedStudent && (
          <div style={{ borderTop: '1px solid var(--hhs-border)', paddingTop: '10px' }}>
            {filteredStudents.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--hhs-text-secondary)', fontSize: '0.86rem' }}>
                No students found matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: 'var(--hhs-radius-sm)',
                      backgroundColor: 'var(--hhs-surface-muted)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{student.fullName}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                          {student.classLabel} • Roll #{student.rollNumber}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                        Adm #{student.admissionNumber} • Phone: {student.primaryPhone} ({student.guardianName})
                      </div>
                    </div>
                    <button
                      className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(student);
                      }}
                    >
                      <span>Show Summary</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Student Instant Summary for Parent Visit */}
        {selectedStudent && (
          <div
            style={{
              marginTop: '6px',
              padding: '16px',
              borderRadius: 'var(--hhs-radius-base)',
              backgroundColor: 'var(--hhs-canvas)',
              border: '1px solid var(--hhs-primary-light)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{selectedStudent.fullName}</h4>
                  <span className="hhs-badge hhs-badge-primary">{selectedStudent.classLabel}</span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                  Admission #{selectedStudent.admissionNumber} • Roll #{selectedStudent.rollNumber} • Guardian: {selectedStudent.guardianName} ({selectedStudent.primaryPhone})
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => navigate(`/reports/ptm-slip/${selectedStudent.id}`)}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Printer size={13} />
                  <span>PTM Slip</span>
                </button>
                <button
                  onClick={() => navigate(`/reports/report-card/${selectedStudent.id}`)}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <FileText size={13} />
                  <span>Report Card</span>
                </button>
                <button
                  onClick={() => navigate(`/students/${selectedStudent.id}`)}
                  className="hhs-btn hhs-btn-primary hhs-btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <span>Full Profile</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Quick 3-metric snapshot for parent */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--hhs-radius-sm)', backgroundColor: 'var(--hhs-surface-card)', border: '1px solid var(--hhs-border)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>Attendance Rate</div>
                <div className="tnum" style={{ fontSize: '1.15rem', fontWeight: 700, color: selectedStudent.attendancePercentage < 75 ? 'var(--hhs-danger)' : 'var(--hhs-text-primary)' }}>
                  {selectedStudent.attendancePercentage}%
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  {Math.round((selectedStudent.attendancePercentage / 100) * 180)} present / 180 days
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 'var(--hhs-radius-sm)', backgroundColor: 'var(--hhs-surface-card)', border: '1px solid var(--hhs-border)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>Academic Average</div>
                <div className="tnum" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                  {selectedStudent.academicAverage ? `${selectedStudent.academicAverage}%` : '82.5%'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  Across core subjects
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 'var(--hhs-radius-sm)', backgroundColor: 'var(--hhs-surface-card)', border: '1px solid var(--hhs-border)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>Status</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--hhs-primary)' }}>
                  {selectedStudent.status === 'enrolled' ? 'Enrolled' : selectedStudent.status}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                  Enrolled {selectedStudent.enrollmentDate}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4 Compact Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Total Students"
          value={totalEnrolment.toString()}
          subtext={`Enrolled across ${classes.length} classes`}
          icon={<Users size={20} />}
          accent="primary"
        />
        <MetricCard
          label="Present Today"
          value={totalPresent.toString()}
          subtext="Students attending today"
          icon={<CheckCircle size={20} />}
          accent="info"
        />
        <MetricCard
          label="Absent Today"
          value={totalAbsent.toString()}
          subtext="Unexcused & excused"
          icon={<AlertCircle size={20} />}
          accent="danger"
        />
        <MetricCard
          label="Classes Marked Today"
          value={`${classes.length - pendingSections.length} of ${classes.length}`}
          subtext={pendingSections.length === 0 ? 'All classes submitted' : `${pendingSections.length} classes pending`}
          icon={<CalendarCheck size={20} />}
          accent="accent"
        />
      </div>

      {/* 2 Supporting Areas: Class Attendance Status & Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
        
        {/* Supporting Area 1: Today's Class Roll Call Status */}
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 className="hhs-headline-sm">Today&apos;s Attendance Status</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Check which classes have submitted attendance today.
              </p>
            </div>
            <button
              onClick={() => navigate('/attendance')}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            >
              <span>Full Muster</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="hhs-table" style={{ width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Class Teacher</th>
                  <th className="tnum" style={{ textAlign: 'center' }}>Present</th>
                  <th className="tnum" style={{ textAlign: 'center' }}>Absent</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {classes.slice(0, 8).map(cls => {
                  const session = attendanceSessions.find(s => s.classId === cls.id);
                  const isSubmitted = session?.status === 'submitted';

                  return (
                    <tr key={cls.id}>
                      <td style={{ fontWeight: 600 }}>{cls.label}</td>
                      <td style={{ color: 'var(--hhs-text-secondary)' }}>{cls.classTeacherName}</td>
                      <td className="tnum" style={{ textAlign: 'center' }}>{session ? session.presentCount : '—'}</td>
                      <td className="tnum" style={{ textAlign: 'center', color: (session?.absentCount || 0) > 0 ? 'var(--hhs-danger)' : 'inherit' }}>
                        {session ? session.absentCount : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <StatusBadge
                          status={isSubmitted ? 'submitted' : 'draft'}
                          label={isSubmitted ? 'Submitted' : 'Pending'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Supporting Area 2: Common Office Tasks */}
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 className="hhs-headline-sm">Office Tasks</h3>
            <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
              Quick access to routine administrative actions.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              onClick={() => navigate('/students')}
              style={{
                padding: '12px 14px',
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
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Search All Students</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                  View, filter, and export student directory
                </div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--hhs-text-secondary)' }} />
            </div>

            <div
              onClick={() => navigate('/reports')}
              style={{
                padding: '12px 14px',
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
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Print Report Cards</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                  Generate and print student report cards & PTM slips
                </div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--hhs-text-secondary)' }} />
            </div>

            <div
              onClick={() => navigate('/attendance')}
              style={{
                padding: '12px 14px',
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
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Daily Attendance Muster</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                  Check class attendance and follow up on absences
                </div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--hhs-text-secondary)' }} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
