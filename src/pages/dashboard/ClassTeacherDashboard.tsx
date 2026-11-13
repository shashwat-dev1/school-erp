/**
 * HanuJai High School ERP — Class Teacher Workspace
 * Clean, focused view for the assigned class (e.g. Class 10-A).
 * Phase 1 Scope: Assigned Section Roll Call & Student Information.
 * WhatsApp automated dispatches occur in the background upon register submission.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type {
  ClassSection,
  StudentRecord,
  AttendanceSession,
} from '../../domain/types';
import {
  CalendarCheck,
  Users,
  Phone,
  CheckCircle,
  AlertCircle,
  Clock,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';

export const ClassTeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const assignedClassId = currentUser?.assignedClassId;
  const assignedClassLabel = currentUser?.assignedClassLabel || (assignedClassId ? `Class ${assignedClassId.toUpperCase().replace('CLASS-', '')}` : 'Assigned Class');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [classSection, setClassSection] = useState<ClassSection | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [todaySession, setTodaySession] = useState<AttendanceSession | null>(null);

  useEffect(() => {
    if (!assignedClassId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadClassTeacherData() {
      setIsLoading(true);
      setError(null);
      try {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const [cls, stuList, session] = await Promise.all([
          provider.getClassById(assignedClassId!),
          provider.getClassStudents(assignedClassId!),
          provider.getAttendanceSession(assignedClassId!, today),
        ]);

        if (!isMounted) return;
        setClassSection(cls);
        setStudents(stuList);
        setTodaySession(session);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Could not load class records.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadClassTeacherData();
    return () => {
      isMounted = false;
    };
  }, [provider, assignedClassId]);

  if (!assignedClassId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PageHeader
          title="My Class"
          subtitle="Class Teacher Workspace"
        />
        <ErrorBanner
          title="No Class Assigned"
          message="Your account is not assigned to a class section yet. Please ask the Principal to assign your class section."
        />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState message={`Loading ${assignedClassLabel} records...`} />;
  }

  if (error || !classSection) {
    return <ErrorBanner title="Could not load class" message={error || 'Class not found.'} />;
  }

  const totalStudents = students.length;
  const isAttendanceSubmitted = todaySession?.status === 'submitted';
  const presentCount = todaySession ? todaySession.presentCount : 0;
  const absentCount = todaySession ? todaySession.absentCount : 0;
  const unmarkedCount = isAttendanceSubmitted ? 0 : Math.max(0, totalStudents - presentCount - absentCount);
  const attendanceRate = totalStudents > 0 && isAttendanceSubmitted ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Filter absent students from today's session
  const absentRecords = todaySession?.records.filter(r => r.state === 'absent') || [];
  const absentStudents = absentRecords.map(r => {
    const stu = students.find(s => s.id === r.studentId);
    return { record: r, student: stu };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <PageHeader
        title={assignedClassLabel}
        subtitle={`Teacher: ${currentUser?.name || 'Class Teacher'} • Room ${classSection.roomNumber}`}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(`/attendance/register/${assignedClassId}`)}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CalendarCheck size={15} />
              <span>{isAttendanceSubmitted ? 'View Attendance' : 'Mark Attendance'}</span>
            </button>
            <button
              onClick={() => navigate('/students')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={15} />
              <span>Students</span>
            </button>
            <button
              onClick={() => navigate('/reports/attendance')}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileSpreadsheet size={15} />
              <span>Export Attendance</span>
            </button>
          </div>
        }
      />

      {/* Prominent Roll Call Alert Banner */}
      {!isAttendanceSubmitted ? (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--hhs-radius-container)',
            backgroundColor: 'var(--pop-canary-yellow-tint)',
            border: '1.5px solid var(--pop-canary-yellow)',
            borderLeft: '5px solid var(--pop-canary-yellow)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: 'var(--hhs-shadow-level-1)',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: '#202033', fontSize: '0.94rem' }}>
              Today&apos;s Attendance is Pending
            </div>
            <div style={{ fontSize: '0.82rem', color: '#45455E', marginTop: '2px' }}>
              Please take morning attendance for {assignedClassLabel}.
            </div>
          </div>
          <button
            onClick={() => navigate(`/attendance/register/${assignedClassId}`)}
            className="hhs-btn hhs-btn-primary"
          >
            Mark Now
          </button>
        </div>
      ) : (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--hhs-radius-container)',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderLeft: '5px solid #10B981',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: '#065F46', fontSize: '0.92rem' }}>
              Today&apos;s Attendance is Submitted
            </div>
            <div style={{ fontSize: '0.80rem', color: '#047857', marginTop: '2px' }}>
              {presentCount} Present, {absentCount} Absent ({attendanceRate}%).
            </div>
          </div>
          <button
            onClick={() => navigate(`/attendance/register/${assignedClassId}`)}
            className="hhs-btn hhs-btn-secondary hhs-btn-sm"
          >
            View Register
          </button>
        </div>
      )}

      {/* 4 Attendance Metrics */}
      <div className="hhs-metrics-grid">
        <MetricCard
          label="Total Students"
          value={totalStudents.toString()}
          subtext={`Room ${classSection.roomNumber}`}
          icon={<Users size={20} />}
          accent="primary"
        />
        <MetricCard
          label="Present Today"
          value={presentCount.toString()}
          subtext={isAttendanceSubmitted ? `${attendanceRate}% turnout` : 'Pending'}
          icon={<CheckCircle size={20} />}
          accent="success"
        />
        <MetricCard
          label="Absent Today"
          value={absentCount.toString()}
          subtext={isAttendanceSubmitted ? `${absentCount} recorded` : 'Pending'}
          icon={<AlertCircle size={20} />}
          accent="danger"
        />
        <MetricCard
          label="Unmarked"
          value={unmarkedCount.toString()}
          subtext={isAttendanceSubmitted ? 'Complete' : 'Pending'}
          icon={<Clock size={20} />}
          accent="warning"
        />
      </div>

      {/* 2 Focused Operational Areas */}
      <div className="hhs-grid-2col">
        
        {/* Supporting Area 1: Absent Students & Parent Contacts */}
        <div className="hhs-card" style={{ padding: 'clamp(14px, 2vw, 20px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 className="hhs-headline-sm">Absent Students Today ({absentStudents.length})</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Guardian contact numbers for parent check.
              </p>
            </div>
            <button
              onClick={() => navigate(`/attendance/register/${assignedClassId}`)}
              className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            >
              <span>Register</span>
            </button>
          </div>

          {absentStudents.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--hhs-text-secondary)', backgroundColor: 'var(--hhs-canvas)', borderRadius: 'var(--hhs-radius-base)' }}>
              {isAttendanceSubmitted
                ? `All ${totalStudents} students in ${assignedClassLabel} are present today.`
                : 'Attendance has not been taken yet today.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {absentStudents.map(({ record, student }) => (
                <div
                  key={record.studentId}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: '1px solid var(--hhs-border)',
                    backgroundColor: 'var(--hhs-canvas)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      Roll #{record.rollNumber} — {record.studentName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={12} />
                      <span>Guardian: {student?.guardianName || 'Parent'} ({student?.primaryPhone || 'No Phone'})</span>
                    </div>
                  </div>

                  {student && (
                    <button
                      onClick={() => navigate(`/students/${student.id}`)}
                      className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                      style={{ flexShrink: 0, padding: '4px 8px', fontSize: '0.76rem' }}
                    >
                      <span>Profile</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supporting Area 2: Quick Links */}
        <div className="hhs-card" style={{ padding: 'clamp(14px, 2vw, 20px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 className="hhs-headline-sm">Quick Links</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Roster, reports, and export tools for {assignedClassLabel}.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              onClick={() => navigate('/students')}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--hhs-radius-base)',
                border: '1px solid var(--hhs-border)',
                backgroundColor: 'var(--hhs-canvas)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Class Students</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                  {totalStudents} students enrolled in {assignedClassLabel}.
                </div>
              </div>
              <ArrowRight size={16} color="var(--hhs-primary)" />
            </div>

            <div
              onClick={() => navigate('/reports/attendance')}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--hhs-radius-base)',
                border: '1px solid var(--hhs-border)',
                backgroundColor: 'var(--hhs-canvas)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Attendance History</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                  Attendance registers and monthly history.
                </div>
              </div>
              <ArrowRight size={16} color="var(--hhs-primary)" />
            </div>

            <div
              onClick={() => navigate('/reports/attendance')}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--hhs-radius-base)',
                border: '1px solid var(--hhs-border)',
                backgroundColor: 'var(--hhs-canvas)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Export Attendance to Excel</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                  Download official CBSE-compliant XLSX attendance sheet.
                </div>
              </div>
              <FileSpreadsheet size={16} color="var(--hhs-accent)" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
