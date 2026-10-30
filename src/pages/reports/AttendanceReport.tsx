import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { downloadAttendanceRegisterXlsx, type AttendanceRegisterExportRow } from '../../utils/exportUtils';
import type { ClassSection, StudentRecord, AttendanceSession } from '../../domain/types';
import {
  Download,
  Printer,
  Search,
  Check,
  X,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

type DatePreset = 'today' | 'last3' | 'last7' | 'custom';

export const AttendanceReport: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const isPrincipal = currentUser?.role === 'principal';
  const isClassTeacher = currentUser?.role === 'class_teacher';

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classSearch, setClassSearch] = useState<string>('');

  // Date selection
  const [datePreset, setDatePreset] = useState<DatePreset>('last7');
  const todayStr = new Date().toISOString().split('T')[0];

  const getPastDateStr = (daysAgo: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const [customStartDate, setCustomStartDate] = useState<string>(getPastDateStr(6));
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Student and session data
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [thresholdFilter, setThresholdFilter] = useState<'all' | 'below75' | 'above75'>('all');

  // Load authorized classes
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const clsList = await provider.getClasses();
        if (!isMounted) return;
        setClasses(clsList);

        // Set default selection based on role
        if (isClassTeacher && currentUser.assignedClassId) {
          setSelectedClassIds([currentUser.assignedClassId]);
        } else if (isPrincipal) {
          // Default to all classes for Principal
          setSelectedClassIds(clsList.map(c => c.id));
        } else {
          setSelectedClassIds(clsList.slice(0, 2).map(c => c.id));
        }
      } catch (err: unknown) {
        console.error('Error fetching classes for attendance report:', err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [provider, isPrincipal, isClassTeacher, currentUser]);

  // Compute selected date list in ascending order
  const dateList: string[] = useMemo(() => {
    let start = todayStr;
    let end = todayStr;

    if (datePreset === 'today') {
      start = todayStr;
      end = todayStr;
    } else if (datePreset === 'last3') {
      start = getPastDateStr(2);
      end = todayStr;
    } else if (datePreset === 'last7') {
      start = getPastDateStr(6);
      end = todayStr;
    } else if (datePreset === 'custom') {
      start = customStartDate <= customEndDate ? customStartDate : customEndDate;
      end = customStartDate <= customEndDate ? customEndDate : customStartDate;
    }

    const dates: string[] = [];
    const current = new Date(start);
    const last = new Date(end);

    // Limit to max 60 days to prevent browser lockup
    let count = 0;
    while (current <= last && count < 60) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      count++;
    }

    return dates;
  }, [datePreset, customStartDate, customEndDate, todayStr]);

  // Load students and sessions for selected classes
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (selectedClassIds.length === 0) {
        setStudents([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        // Fetch students for all selected classes concurrently
        const studentPromises = selectedClassIds.map(cId => provider.getClassStudents(cId));
        const [studentArrays, sessions] = await Promise.all([
          Promise.all(studentPromises),
          dateList.length
            ? provider.getAttendanceSessionsInRange(dateList[0], dateList[dateList.length - 1], selectedClassIds)
            : Promise.resolve([]),
        ]);

        if (!isMounted) return;
        setStudents(studentArrays.flat());
        setAttendanceSessions(sessions);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load attendance report.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [provider, selectedClassIds, dateList]);

  // Multi-class selector handlers
  const authorizedClasses = useMemo(() => {
    if (isClassTeacher && currentUser.assignedClassId) {
      return classes.filter(c => c.id === currentUser.assignedClassId);
    }
    return classes;
  }, [classes, isClassTeacher, currentUser]);

  const filteredClassOptions = useMemo(() => {
    if (!classSearch.trim()) return authorizedClasses;
    return authorizedClasses.filter(c =>
      c.label.toLowerCase().includes(classSearch.toLowerCase().trim())
    );
  }, [authorizedClasses, classSearch]);

  const handleSelectAllClasses = () => {
    setSelectedClassIds(authorizedClasses.map(c => c.id));
  };

  const handleClearClasses = () => {
    if (isClassTeacher && currentUser.assignedClassId) {
      setSelectedClassIds([currentUser.assignedClassId]);
    } else {
      setSelectedClassIds([]);
    }
  };

  const handleToggleClass = (classId: string) => {
    if (isClassTeacher) return; // Locked to assigned section
    setSelectedClassIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  // Student calculation: build daily status and aggregate attendance
  interface StudentAttendanceSummary {
    student: StudentRecord;
    classLabel: string;
    presentCount: number;
    absentCount: number;
    recordedDays: number;
    ratePct: number | null;
    isBelow75: boolean;
    attendanceByDate: Record<string, string>;
  }

  const computedSummaries: StudentAttendanceSummary[] = useMemo(() => {
    return students.map(s => {
      const cls = classes.find(c => c.id === s.classId);
      const classLabel = cls?.label || s.classLabel || s.classId;
      const attendanceByDate: Record<string, string> = {};

      let presentCount = 0;
      let absentCount = 0;

      dateList.forEach(dateStr => {
        const d = new Date(dateStr);
        const dayOfWeek = d.getDay();

        if (dayOfWeek === 0) {
          // Sunday / school off
          attendanceByDate[dateStr] = 'OFF';
          return;
        }

        // Check if there is a session recorded in DB for this class & date
        const session = attendanceSessions.find(
          sess => sess.classId === s.classId && sess.date === dateStr
        );

        if (session && session.status !== 'draft') {
          const rec = session.records.find(r => r.studentId === s.id);
          if (rec) {
            if (rec.state === 'present') {
              attendanceByDate[dateStr] = 'P';
              presentCount++;
            } else if (rec.state === 'late') {
              attendanceByDate[dateStr] = 'L';
              presentCount++;
            } else if (rec.state === 'absent') {
              attendanceByDate[dateStr] = 'A';
              absentCount++;
            } else if (rec.state === 'excused') {
              attendanceByDate[dateStr] = 'LEAVE';
            }
            return;
          }
        }
        attendanceByDate[dateStr] = 'UNMARKED';
      });

      const recordedDays = presentCount + absentCount;
      const roundedRate = recordedDays > 0 ? Math.round((presentCount / recordedDays) * 1000) / 10 : null;
      return {
        student: s,
        classLabel,
        presentCount,
        absentCount,
        recordedDays,
        ratePct: roundedRate,
        isBelow75: roundedRate !== null && roundedRate < 75,
        attendanceByDate,
      };
    }).sort((a, b) => {
      const classComp = a.classLabel.localeCompare(b.classLabel);
      if (classComp !== 0) return classComp;
      const nameComp = (a.student.firstName || '').localeCompare(b.student.firstName || '', undefined, { sensitivity: 'base' })
        || (a.student.lastName || '').localeCompare(b.student.lastName || '', undefined, { sensitivity: 'base' });
      if (nameComp !== 0) return nameComp;
      return a.student.rollNumber - b.student.rollNumber;
    });
  }, [students, classes, dateList, attendanceSessions]);

  // Client-side filtering
  const filteredSummaries = useMemo(() => {
    return computedSummaries.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.student.firstName.toLowerCase().includes(q) ||
        item.student.lastName.toLowerCase().includes(q) ||
        item.student.admissionNumber.toLowerCase().includes(q) ||
        item.student.rollNumber.toString().includes(q);

      let matchesThreshold = true;
      if (thresholdFilter === 'below75') matchesThreshold = item.isBelow75;
      if (thresholdFilter === 'above75') matchesThreshold = item.ratePct !== null && !item.isBelow75;

      return matchesSearch && matchesThreshold;
    });
  }, [computedSummaries, searchQuery, thresholdFilter]);

  // Aggregate KPI stats
  const stats = useMemo(() => {
    const covered = computedSummaries.filter(item => item.ratePct !== null);
    const total = covered.length;
    let sumRate = 0;
    let deficitCount = 0;

    covered.forEach(item => {
      sumRate += item.ratePct ?? 0;
      if (item.isBelow75) deficitCount++;
    });

    const averageRate = total > 0 ? (sumRate / total).toFixed(1) : '—';
    return {
      total,
      averageRate,
      deficitCount,
      compliantCount: total - deficitCount,
    };
  }, [computedSummaries]);

  // Excel (.xlsx) Export
  const handleExportExcel = () => {
    if (filteredSummaries.length === 0 || dateList.length === 0) return;

    const exportRows: AttendanceRegisterExportRow[] = filteredSummaries.map(item => ({
      admissionNumber: item.student.admissionNumber,
      rollNumber: item.student.rollNumber,
      studentName: item.student.fullName,
      classLabel: item.classLabel,
      attendanceByDate: item.attendanceByDate,
    }));

    const scopeTitle =
      selectedClassIds.length === classes.length
        ? 'All Classes (School-Wide)'
        : selectedClassIds.map(id => classes.find(c => c.id === id)?.label || id).join(', ');

    downloadAttendanceRegisterXlsx('HanuJai_Attendance_Register', {
      scopeTitle,
      dateHeaders: dateList,
      students: exportRows,
    });
  };

  const selectedClassesSummary = useMemo(() => {
    if (selectedClassIds.length === 0) return 'No classes selected';
    if (selectedClassIds.length === classes.length) return `All ${classes.length} Classes (School-Wide)`;
    if (selectedClassIds.length <= 4) {
      return selectedClassIds.map(id => classes.find(c => c.id === id)?.label || id).join(', ');
    }
    return `${selectedClassIds.length} Classes Selected (${selectedClassIds.slice(0, 3).map(id => classes.find(c => c.id === id)?.label || id).join(', ')}...)`;
  }, [selectedClassIds, classes]);

  return (
    <div className="hhs-page-container">
      {/* Top Header - Hidden in Print */}
      <div className="no-print">
        <PageHeader
          title="Attendance Ledger"
          subtitle="Instructional attendance registers, multi-section compliance ledger, and student history."
          roleScope={isPrincipal ? 'School-Wide Ledger' : 'Class Register'}
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: 'Reports', to: '/reports' },
            { label: 'Attendance Ledger' },
          ]}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleExportExcel}
                disabled={filteredSummaries.length === 0 || dateList.length === 0}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title={filteredSummaries.length === 0 ? 'Select at least one class with students to export.' : 'Download genuine Excel register (.xlsx) for selected classes and dates'}
              >
                <Download size={15} />
                <span>Export Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => window.print()}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Print this attendance report"
              >
                <Printer size={15} />
                <span>Print Report</span>
              </button>
            </div>
          }
        />
        {(selectedClassIds.length === 0 || filteredSummaries.length === 0) && (
          <p role="status" style={{ color: 'var(--hhs-text-secondary)', margin: '8px 0 0' }}>
            {selectedClassIds.length === 0 ? 'Select one or more authorized classes to view or export attendance.' : 'No students match the current filters, so there is nothing to export.'}
          </p>
        )}
      </div>

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
          <div className="hhs-metric-label">Reporting Period</div>
          <div className="hhs-metric-value" style={{ fontSize: '1.25rem' }}>
            {dateList.length} Days
          </div>
          <div className="hhs-metric-sub">{dateList[0]} to {dateList[dateList.length - 1]}</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Enrolled in Selected Scope</div>
          <div className="hhs-metric-value">{stats.total} Students</div>
          <div className="hhs-metric-sub">{selectedClassIds.length} sections selected</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Turnout Aggregate</div>
          <div className="hhs-metric-value" style={{ color: 'var(--hhs-primary)' }}>
            {stats.averageRate}%
          </div>
          <div className="hhs-metric-sub">Mean turnout for selected dates</div>
        </div>

        <div className="hhs-metric-card">
          <div className="hhs-metric-label">Below 75% Threshold</div>
          <div
            className="hhs-metric-value"
            style={{ color: stats.deficitCount > 0 ? 'var(--hhs-danger-text)' : 'var(--hhs-primary)' }}
          >
            {stats.deficitCount} Students
          </div>
          <div className="hhs-metric-sub">
            {stats.compliantCount} students meet 75% requirement
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters - Hidden in Print */}
      <div
        className="hhs-panel no-print"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: 'var(--hhs-surface)',
        }}
      >
        {/* Class Selection Row */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                Select Class &amp; Section Scope:
              </span>
              <span className="hhs-badge hhs-badge-primary">
                {selectedClassesSummary}
              </span>
            </div>

            {isPrincipal && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Filter classes..."
                  value={classSearch}
                  onChange={e => setClassSearch(e.target.value)}
                  className="hhs-input"
                  style={{ width: '130px', height: '28px', fontSize: '0.75rem', padding: '2px 8px' }}
                />
                <button
                  type="button"
                  onClick={handleSelectAllClasses}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  style={{ fontSize: '0.74rem' }}
                >
                  <Check size={13} />
                  <span>Select All Classes</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearClasses}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  style={{ fontSize: '0.74rem' }}
                >
                  <X size={13} />
                  <span>Clear Selection</span>
                </button>
              </div>
            )}
          </div>

          {/* Class Multi-select Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '110px', overflowY: 'auto' }}>
            {filteredClassOptions.map(cls => {
              const isSelected = selectedClassIds.includes(cls.id);
              return (
                <button
                  type="button"
                  key={cls.id}
                  onClick={() => handleToggleClass(cls.id)}
                  disabled={isClassTeacher}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: isSelected ? '1px solid var(--hhs-primary)' : '1px solid var(--hhs-border)',
                    backgroundColor: isSelected ? 'var(--hhs-primary-light)' : 'var(--hhs-canvas)',
                    color: isSelected ? 'var(--hhs-primary-text)' : 'var(--hhs-text-primary)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: isClassTeacher ? 'default' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {isSelected && <Check size={12} />}
                  <span>{cls.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Selection & Search Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', borderTop: '1px solid var(--hhs-border)', paddingTop: '14px' }}>
          {/* Date Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--hhs-text-secondary)', marginRight: '4px' }}>
              Date Range:
            </span>
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              className={datePreset === 'today' ? 'hhs-btn hhs-btn-primary hhs-btn-sm' : 'hhs-btn hhs-btn-secondary hhs-btn-sm'}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('last3')}
              className={datePreset === 'last3' ? 'hhs-btn hhs-btn-primary hhs-btn-sm' : 'hhs-btn hhs-btn-secondary hhs-btn-sm'}
            >
              Last 3 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('last7')}
              className={datePreset === 'last7' ? 'hhs-btn hhs-btn-primary hhs-btn-sm' : 'hhs-btn hhs-btn-secondary hhs-btn-sm'}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('custom')}
              className={datePreset === 'custom' ? 'hhs-btn hhs-btn-primary hhs-btn-sm' : 'hhs-btn hhs-btn-secondary hhs-btn-sm'}
            >
              Custom Range
            </button>
          </div>

          {/* Custom Date Range Inputs */}
          {datePreset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="hhs-input tnum"
                style={{ width: '140px', height: '32px', fontSize: '0.8rem' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="hhs-input tnum"
                style={{ width: '140px', height: '32px', fontSize: '0.8rem' }}
              />
            </div>
          )}

          {/* Search bar */}
          <div style={{ position: 'relative', flex: '1 1 200px', marginLeft: 'auto' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--hhs-text-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search student or admission #..."
              className="hhs-input"
              style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
            />
          </div>

          {/* Threshold filter */}
          <select
            value={thresholdFilter}
            onChange={e => setThresholdFilter(e.target.value as 'all' | 'below75' | 'above75')}
            className="hhs-select"
            style={{ width: '180px', height: '34px', fontSize: '0.82rem' }}
          >
            <option value="all">All Turnout Levels ({computedSummaries.length})</option>
            <option value="below75">Below 75% ({stats.deficitCount})</option>
            <option value="above75">75% or above ({stats.compliantCount})</option>
          </select>
        </div>
      </div>

      {/* Main Ledger Table */}
      {isLoading ? (
        <LoadingState message="Loading attendance records for selected scope..." />
      ) : (
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
                Attendance Register — {selectedClassesSummary}
              </h4>
              <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                Period: {dateList[0]} to {dateList[dateList.length - 1]} ({dateList.length} calendar days evaluated)
              </div>
            </div>
            <span className="hhs-badge hhs-badge-primary">
              Showing {filteredSummaries.length} of {computedSummaries.length} Students
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="hhs-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '45px' }} className="numeric">Roll</th>
                  <th style={{ width: '110px' }}>Admission #</th>
                  <th>Student Name</th>
                  <th style={{ width: '110px' }}>Class</th>
                  <th className="numeric" style={{ width: '110px' }}>School Days</th>
                  <th className="numeric" style={{ width: '90px' }}>Present</th>
                  <th className="numeric" style={{ width: '90px' }}>Absent</th>
                  <th className="numeric" style={{ width: '100px' }}>Turnout %</th>
                  <th style={{ width: '140px' }}>Threshold Status</th>
                  <th style={{ textAlign: 'right', width: '90px' }} className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.map(item => {
                  return (
                    <tr
                      key={item.student.id}
                      style={{
                        backgroundColor: item.isBelow75 ? 'var(--hhs-danger-light)' : undefined,
                      }}
                    >
                      <td className="numeric" style={{ fontWeight: 600 }}>
                        {item.student.rollNumber}
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/students/${item.student.id}/attendance`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            color: 'var(--hhs-primary)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                          title="Open attendance history"
                        >
                          {item.student.admissionNumber}
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/students/${item.student.id}/attendance`)}
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
                          title="Open attendance history"
                        >
                          {item.student.firstName} {item.student.lastName}
                        </button>
                      </td>
                      <td>
                        <span className="hhs-badge hhs-badge-neutral">
                          {item.classLabel}
                        </span>
                      </td>
                      <td className="numeric">{item.recordedDays}</td>
                      <td className="numeric" style={{ fontWeight: 600, color: 'var(--hhs-primary)' }}>
                        {item.presentCount}
                      </td>
                      <td className="numeric" style={{ fontWeight: 600, color: item.absentCount > 3 ? 'var(--hhs-danger-text)' : 'inherit' }}>
                        {item.absentCount}
                      </td>
                      <td className="numeric">
                        <span
                          style={{
                            fontWeight: 700,
                            color: item.isBelow75 ? 'var(--hhs-danger-text)' : 'var(--hhs-primary)',
                          }}
                        >
                          {item.ratePct === null ? '—' : `${item.ratePct}%`}
                        </span>
                      </td>
                      <td>
                        {item.isBelow75 ? (
                          <span
                            className="hhs-badge hhs-badge-danger"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <AlertTriangle size={12} />
                            <span>Below 75%</span>
                          </span>
                        ) : (
                          <span
                            className="hhs-badge hhs-badge-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <ShieldCheck size={12} />
                            <span>75% or above</span>
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} className="no-print">
                        <button
                          onClick={() => navigate(`/students/${item.student.id}/attendance`)}
                          className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                          style={{ fontSize: '0.74rem', padding: '3px 8px', height: '26px' }}
                          title="View day-by-day attendance history"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
