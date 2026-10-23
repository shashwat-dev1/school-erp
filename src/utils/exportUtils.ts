/**
 * HanuJai High School ERP — Export Utilities
 * Robust CSV and genuine Excel (.xlsx) file generation without URI truncation.
 */

import * as XLSX from 'xlsx';
import type { StudentRecord } from '../domain/types';

/**
 * Download genuine CSV file using Blob and URL.createObjectURL.
 * Avoids browser data URI truncation caused by '#' or reserved characters.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const escapeCell = (cell: string | number | boolean | null | undefined): string => {
    if (cell === null || cell === undefined) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface AttendanceRegisterExportRow {
  admissionNumber: string;
  rollNumber: number | string;
  studentName: string;
  classLabel: string;
  section?: string;
  enrollmentDate?: string;
  attendanceByDate: Record<string, string>; // date (YYYY-MM-DD) -> 'P' | 'A' | 'LEAVE' | 'HOLIDAY' | 'OFF' | 'UNMARKED' | 'N/A'
}

/**
 * Generate and download a genuine multi-column Excel (.xlsx) register.
 * Matrix format: 1 row per student, columns for each date in range.
 */
export interface AttendanceRegisterExportOptions {
  scopeTitle: string;
  academicSessionLabel?: string;
  dateHeaders: string[]; // ISO dates (YYYY-MM-DD)
  students: AttendanceRegisterExportRow[];
  includeApprovedLeave?: boolean;
  calendarDayTypes?: Record<string, { isSchoolDay: boolean; reason?: string }>;
}

export function createAttendanceRegisterWorkbook(options: AttendanceRegisterExportOptions): XLSX.WorkBook {
  const { scopeTitle, academicSessionLabel = '2025–2026', dateHeaders, students, includeApprovedLeave = false, calendarDayTypes = {} } = options;
  if (dateHeaders.length === 0 || students.length === 0) {
    throw new Error('Select at least one date and one student before exporting attendance.');
  }

  // Stable ordering by class/section and roll number
  const sortedStudents = [...students].sort((a, b) => {
    const classComp = a.classLabel.localeCompare(b.classLabel);
    if (classComp !== 0) return classComp;
    const rollA = typeof a.rollNumber === 'number' ? a.rollNumber : parseInt(String(a.rollNumber), 10) || 0;
    const rollB = typeof b.rollNumber === 'number' ? b.rollNumber : parseInt(String(b.rollNumber), 10) || 0;
    return rollA - rollB;
  });

  // Format date headers (e.g. "19 Oct")
  const formatDateLabel = (isoDate: string): string => {
    try {
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }
      return isoDate;
    } catch {
      return isoDate;
    }
  };

  const wb = XLSX.utils.book_new();

  // Build 2D matrix for worksheet
  const aoa: (string | number)[][] = [];

  // Title & Metadata Header
  aoa.push(['HanuJai High School, Jaipur — Attendance Register']);
  aoa.push([`Scope: ${scopeTitle} | Academic Session: ${academicSessionLabel}`]);
  aoa.push([`Date Range: ${formatDateLabel(dateHeaders[0])} to ${formatDateLabel(dateHeaders[dateHeaders.length - 1])} (${dateHeaders.length} Days)`]);
  aoa.push([`Exported on: ${new Date().toLocaleDateString('en-IN')}`]);
  aoa.push([]); // blank line

  // Column Headers: S. No., Roll No., Student Name, then one column per date, then Summary
  const headerRow: string[] = [
    'S. No.',
    'Roll No.',
    'Student Name',
    ...dateHeaders.map(formatDateLabel),
    'Total Present',
    'Total Absent',
    'Attendance %',
  ];
  aoa.push(headerRow);
  const headerRowIndex = aoa.length - 1;

  // Student Rows
  sortedStudents.forEach((s, index) => {
    let pCount = 0;
    let aCount = 0;

    const dateCells: string[] = dateHeaders.map(date => {
      // If student was not yet admitted on this date, show N/A
      if (s.enrollmentDate && s.enrollmentDate > date) {
        return 'N/A';
      }

      const savedStatus = s.attendanceByDate[date];
      if (savedStatus) {
        if (savedStatus === 'P' || savedStatus === 'present' || savedStatus === 'late') {
          pCount++;
          return 'P';
        }
        if (savedStatus === 'A' || savedStatus === 'absent') {
          aCount++;
          return 'A';
        }
        if (savedStatus === 'LEAVE' || savedStatus === 'L' || savedStatus === 'excused') {
          return includeApprovedLeave ? 'L' : 'LEAVE';
        }
        return savedStatus;
      }

      // Calendar fallback if not marked
      const cal = calendarDayTypes[date];
      if (cal) {
        if (!cal.isSchoolDay) {
          if (cal.reason?.toLowerCase().includes('holiday') || cal.reason?.toLowerCase().includes('break') || cal.reason?.toLowerCase().includes('vacation')) {
            return 'HOLIDAY';
          }
          return 'OFF';
        }
      }

      // Operational school day with no saved register
      return 'UNMARKED';
    });

    const recordedDays = pCount + aCount;
    const pct = recordedDays > 0 ? `${((pCount / recordedDays) * 100).toFixed(1)}%` : '—';

    aoa.push([
      index + 1,
      s.rollNumber,
      s.studentName,
      ...dateCells,
      pCount,
      aCount,
      pct,
    ]);
  });

  // Blank row & Status Legend
  aoa.push([]);
  aoa.push(['Status Legend:']);
  aoa.push(['P', 'Present']);
  aoa.push(['A', 'Absent']);
  if (includeApprovedLeave) {
    aoa.push(['L', 'Approved leave']);
  }
  aoa.push(['OFF', 'Scheduled school day off']);
  aoa.push(['HOLIDAY', 'School holiday']);
  aoa.push(['UNMARKED', 'No attendance record entered']);
  aoa.push(['N/A', 'Student not enrolled yet on this date']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set column widths
  const colWidths: XLSX.ColInfo[] = [
    { wch: 8 },   // S. No.
    { wch: 10 },  // Roll No.
    { wch: 26 },  // Student Name
    ...dateHeaders.map(() => ({ wch: 10 })),     // Date columns (e.g. "19 Oct")
    { wch: 14 },  // Total Present
    { wch: 14 },  // Total Absent
    { wch: 14 },  // Attendance %
  ];
  ws['!cols'] = colWidths;

  // Freeze panes on identifier columns and header row
  ws['!views'] = [
    {
      state: 'frozen',
      xSplit: 3,
      ySplit: headerRowIndex + 1,
      topLeftCell: XLSX.utils.encode_cell({ c: 3, r: headerRowIndex + 1 }),
    },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Register');

  return wb;
}

export function downloadAttendanceRegisterXlsx(filename: string, options: AttendanceRegisterExportOptions): void {
  const wb = createAttendanceRegisterWorkbook(options);
  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
}

/**
 * Generate and download an individual student day-by-day attendance log in genuine .xlsx
 */
export function downloadStudentAttendanceXlsx(
  student: StudentRecord,
  dateLogs: Array<{
    date: string;
    day: string;
    status: string; // Saved attendance state or configured calendar state
    remarks?: string;
  }>
): void {
  const wb = XLSX.utils.book_new();
  const aoa: (string | number)[][] = [];

  aoa.push(['HanuJai High School, Jaipur — Student Attendance History']);
  aoa.push([`Student Name: ${student.fullName}`]);
  aoa.push([`Admission #: ${student.admissionNumber} | Roll #: ${student.rollNumber}`]);
  aoa.push([`Class & Section: ${student.classLabel}`]);
  aoa.push([`Generated on: ${new Date().toLocaleDateString('en-IN')}`]);
  aoa.push([]);

  // Stats
  const presentDays = dateLogs.filter(l => l.status === 'Present' || l.status === 'Late').length;
  const absentDays = dateLogs.filter(l => l.status === 'Absent').length;
  const recordedDays = presentDays + absentDays;
  const pct = recordedDays > 0 ? ((presentDays / recordedDays) * 100).toFixed(1) + '%' : '—';

  aoa.push(['Attendance Summary']);
  aoa.push(['Recorded Sessions', recordedDays]);
  aoa.push(['Days Present', presentDays]);
  aoa.push(['Days Absent', absentDays]);
  aoa.push(['Attendance Turnout', pct]);
  aoa.push([]);

  // Date by date table
  aoa.push(['Date', 'Day of Week', 'Recorded Status', 'Remarks & Notes']);
  dateLogs.forEach(log => {
    const codes: Record<string, string> = {
      Present: 'P', Absent: 'A', Late: 'L', 'Approved leave': 'LEAVE',
      'School Off': 'OFF', Holiday: 'HOLIDAY', Unmarked: 'UNMARKED',
    };
    aoa.push([log.date, log.day, codes[log.status] || log.status, log.remarks || '—']);
  });
  aoa.push([]);
  aoa.push(['Status Legend']);
  aoa.push(['P', 'Present']);
  aoa.push(['A', 'Absent']);
  aoa.push(['L', 'Late arrival']);
  aoa.push(['LEAVE', 'Approved leave']);
  aoa.push(['OFF', 'Scheduled day off']);
  aoa.push(['HOLIDAY', 'School holiday']);
  aoa.push(['UNMARKED', 'No attendance record entered']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 14 }, // Date
    { wch: 14 }, // Day
    { wch: 18 }, // Status
    { wch: 40 }, // Remarks
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Attendance History');
  const safeName = `${student.firstName}_${student.lastName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Attendance_${safeName}_${student.admissionNumber}.xlsx`);
}
