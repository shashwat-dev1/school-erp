import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import type { StudentRecord, AuditEvent, IncidentRecord, MarksRegister, AssessmentCycle } from '../../domain/types';
import { Permissions } from '../../domain/permissions';
import { buildChangeExplanation, classMarkBenchmarks, isFinalizedResult, normalizeMark } from '../../domain/academicAnalytics';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  User,
  GraduationCap,
  CalendarCheck,
  AlertTriangle,
  History,
  Printer,
  FileText,
  ArrowLeft,
  Calendar,
  BookOpen,
  MessageSquare,
  BarChart3,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  HelpCircle,
  Download,
} from 'lucide-react';
import { downloadStudentAttendanceXlsx } from '../../utils/exportUtils';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { FilterToolbar } from '../../components/ui/FilterToolbar';

export const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tab Data
  const [marksRegisters, setMarksRegisters] = useState<MarksRegister[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [auditHistory, setAuditHistory] = useState<AuditEvent[]>([]);
  const [assessmentCycles, setAssessmentCycles] = useState<AssessmentCycle[]>([]);
  const [comparisonSubjectId, setComparisonSubjectId] = useState('');
  const [comparisonEarlierId, setComparisonEarlierId] = useState('');
  const [comparisonLaterId, setComparisonLaterId] = useState('');
  const [changeExplanation, setChangeExplanation] = useState<string[]>([]);
  const [isExplainingChange, setIsExplainingChange] = useState(false);
  const [showExplanationDrawer, setShowExplanationDrawer] = useState(false);
  const [chartView, setChartView] = useState<'subject' | 'assessment' | 'progress'>('subject');
  const [chartSubjectId, setChartSubjectId] = useState('');
  const [chartAssessmentId, setChartAssessmentId] = useState('');
  const [chartRangeMonths, setChartRangeMonths] = useState(36);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [expandedProgressCycles, setExpandedProgressCycles] = useState<Record<string, boolean>>({});
  const [classAttendanceAggregate, setClassAttendanceAggregate] = useState<{ present: number; total: number; date: string } | null>(null);
  const [studentAttendanceSummary, setStudentAttendanceSummary] = useState<{ present: number; absent: number; leave: number } | null>(null);
  const [recent30DayStats, setRecent30DayStats] = useState<{
    present: number;
    absent: number;
    leave: number;
    total: number;
    percentage: number | null;
    hasRecords: boolean;
  } | null>(null);
  const [studentAttendanceLogs, setStudentAttendanceLogs] = useState<Array<{
    date: string;
    state: 'present' | 'absent' | 'late' | 'excused';
    remarks?: string;
    staffName?: string;
  }>>([]);
  const [attendanceTableFilter, setAttendanceTableFilter] = useState<'all' | 'absent' | 'excused' | 'late'>('all');

  // Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    primaryPhone: '',
    residentialAddress: '',
    guardianName: '',
    guardianRelation: 'Father' as 'Father' | 'Mother' | 'Guardian',
    revisionReason: '',
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadStudentData() {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const studentDoc = await provider.getStudentById(id);
        if (!isMounted) return;
        if (!studentDoc) {
          setError('Student record not found in active academic session.');
          return;
        }

        if (!Permissions.canViewStudent(currentUser, studentDoc)) {
          setError(`You do not have permission to view records outside your assigned classes or subjects.`);
          return;
        }

        setStudent(studentDoc);
        if (Permissions.canViewIndividualAttendance(currentUser, studentDoc.classId)) {
          const toIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const today = new Date();
          const todayIso = toIso(today);
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
          const thirtyDaysAgoIso = toIso(thirtyDaysAgo);

          // Fetch all submitted attendance sessions in active session (April 2025 to end of session or today)
          const sessionEndIso = todayIso > '2026-03-31' ? todayIso : '2026-03-31';
          const attendanceSessions = await provider.getAttendanceSessionsInRange('2025-04-01', sessionEndIso, [studentDoc.classId]);
          if (!isMounted) return;

          const summary = { present: 0, absent: 0, leave: 0 };
          const r30Summary = { present: 0, absent: 0, leave: 0, total: 0 };
          const logs: Array<{
            date: string;
            state: 'present' | 'absent' | 'late' | 'excused';
            remarks?: string;
            staffName?: string;
          }> = [];

          attendanceSessions.filter(session => session.classId === studentDoc.classId && session.status !== 'draft').forEach(session => {
            // Respect student enrollment date: do not treat dates before admission as absences
            if (studentDoc.enrollmentDate && session.date < studentDoc.enrollmentDate) {
              return;
            }

            const record = session.records.find(
              item => item.studentId === studentDoc.id || item.studentId.toLowerCase() === studentDoc.id.toLowerCase()
            );
            if (!record) return;

            logs.push({
              date: session.date,
              state: record.state,
              remarks: record.remarks,
              staffName: session.takenByStaffName || 'Class Teacher',
            });

            if (record.state === 'present' || record.state === 'late') summary.present++;
            else if (record.state === 'absent') summary.absent++;
            else summary.leave++;

            if (session.date >= thirtyDaysAgoIso && session.date <= todayIso) {
              r30Summary.total++;
              if (record.state === 'present' || record.state === 'late') r30Summary.present++;
              else if (record.state === 'absent') r30Summary.absent++;
              else r30Summary.leave++;
            }
          });

          // Sort logs newest date first
          logs.sort((a, b) => b.date.localeCompare(a.date));
          setStudentAttendanceLogs(logs);
          setStudentAttendanceSummary(summary);
          setRecent30DayStats({
            ...r30Summary,
            percentage: (r30Summary.present + r30Summary.absent) > 0
              ? Math.round((r30Summary.present / (r30Summary.present + r30Summary.absent)) * 1000) / 10
              : null,
            hasRecords: r30Summary.total > 0,
          });
        }
        if (currentUser?.role === 'subject_teacher' && Permissions.canAccessSection(currentUser, studentDoc.classId)) {
          const today = new Date();
          const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const session = await provider.getAttendanceAggregate(studentDoc.classId, todayIso);
          if (!isMounted) return;
          setClassAttendanceAggregate(session
            ? { present: session.presentCount + session.lateCount, total: session.totalStudents, date: session.date }
            : null);
        }
        setEditForm({
          firstName: studentDoc.firstName,
          lastName: studentDoc.lastName,
          primaryPhone: studentDoc.primaryPhone,
          residentialAddress: studentDoc.residentialAddress,
          guardianName: studentDoc.guardianName,
          guardianRelation: studentDoc.guardianRelation,
          revisionReason: '',
        });
        setIsLoading(false);

        // Fetch secondary records concurrently
        const [incRes, auditRes, assessRes] = await Promise.all([
          provider.getIncidents({ studentId: id, classId: studentDoc.classId }),
          currentUser?.role === 'principal' ? provider.getStudentAuditHistory(id) : Promise.resolve([]),
          provider.getAssessmentCycles(),
        ]);

        if (!isMounted) return;
        setIncidents(incRes);
        setAuditHistory(auditRes);
        setAssessmentCycles(assessRes);

        // Fetch marks for authorized subjects
        const subjects = await provider.getSubjects();
        const allowedSubjects = subjects.filter(s =>
          Permissions.canAccessSubjectMarks(currentUser, studentDoc.classId, s.id)
        );

        let marksList: MarksRegister[] = [];
        if (provider.getStudentMarksRegisters) {
          const allStudentMarks = await provider.getStudentMarksRegisters(id);
          const canViewAll = currentUser?.role === 'principal' ||
            (currentUser?.role === 'class_teacher' && currentUser.assignedClassId === studentDoc.classId);
          marksList = allStudentMarks.filter(
            reg =>
              isFinalizedResult(reg.status) &&
              (canViewAll || Permissions.canAccessSubjectMarks(currentUser, reg.classId, reg.subjectId))
          );
        } else {
          const regPromises: Promise<MarksRegister | null>[] = [];
          for (const assess of assessRes) {
            for (const sub of allowedSubjects) {
              regPromises.push(provider.getMarksRegister(assess.id, studentDoc.classId, sub.id));
            }
          }
          const regs = await Promise.all(regPromises);
          marksList = regs.filter(
            (reg): reg is MarksRegister =>
              !!reg &&
              reg.entries.some(
                e => e.studentId === id || e.studentId.toLowerCase() === id.toLowerCase()
              )
              && isFinalizedResult(reg.status)
          );
        }
        if (isMounted) setMarksRegisters(marksList);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Could not load student profile.';
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStudentData();
    return () => {
      isMounted = false;
    };
  }, [id, provider, currentUser]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !currentUser) return;
    if (!editForm.revisionReason.trim()) {
      alert('Please enter a brief note explaining the change.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await provider.updateStudent(
        student.id,
        {
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          primaryPhone: editForm.primaryPhone,
          residentialAddress: editForm.residentialAddress,
          guardianName: editForm.guardianName,
          guardianRelation: editForm.guardianRelation,
        },
        currentUser,
        editForm.revisionReason
      );

      setStudent(updated);
      setIsEditModalOpen(false);

      // Refresh audit history
      const freshAudit = await provider.getStudentAuditHistory(student.id);
      setAuditHistory(freshAudit);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not update student details.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading student details..." />;
  }

  if (error || !student) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button
          onClick={() => navigate('/students')}
          className="hhs-btn hhs-btn-secondary"
          style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={15} />
          <span>Back to Students</span>
        </button>
        <ErrorBanner title="Student Not Found" message={error || 'We could not find this student record.'} />
      </div>
    );
  }

  // Principal is strictly read-only in this pilot; master records cannot be edited from dossier
  const canEdit = false;
  const canViewIndividualAttendance = currentUser ? Permissions.canViewIndividualAttendance(currentUser, student.classId) : false;
  const canViewFullReport = currentUser?.role === 'principal' || 
    (currentUser?.role === 'class_teacher' && currentUser.assignedClassId === student?.classId);
  const canAddNote = Permissions.canLogIncident(currentUser, student.classId);

  const visibleFinalMarks = marksRegisters.filter(reg => isFinalizedResult(reg.status));
  const savedPercentages = visibleFinalMarks.flatMap(reg => {
    const entry = reg.entries.find(item => item.studentId === student.id);
    const percentage = entry && !entry.isAbsent ? normalizeMark(entry.marksObtained, reg.maxMarks) : null;
    return percentage === null ? [] : [percentage];
  });
  const computedAcademicAverage = savedPercentages.length
    ? Math.round(savedPercentages.reduce((sum, value) => sum + value, 0) / savedPercentages.length * 10) / 10
    : null;
  const daysPresent = studentAttendanceSummary?.present ?? 0;
  const daysAbsent = studentAttendanceSummary?.absent ?? 0;
  const totalSchoolDays = daysPresent + daysAbsent + (studentAttendanceSummary?.leave ?? 0);
  const recentAttendanceRate = daysPresent + daysAbsent > 0
    ? Math.round(daysPresent / (daysPresent + daysAbsent) * 1000) / 10
    : null;
  // Group comparison subjects by subject name across all grade levels (e.g. "Mathematics" across grades 8, 9, 10)
  const comparisonSubjects = Array.from(new Map(visibleFinalMarks.map(register => [register.subjectName, register.subjectName])).entries());
  const activeComparisonSubject = comparisonSubjectId || comparisonSubjects[0]?.[0] || 'Mathematics';
  const comparisonRegisters = visibleFinalMarks
    .filter(register => register.subjectName === activeComparisonSubject)
    .sort((left, right) => {
      const leftDate = assessmentCycles.find(cycle => cycle.id === left.assessmentId)?.startDate || '';
      const rightDate = assessmentCycles.find(cycle => cycle.id === right.assessmentId)?.startDate || '';
      return leftDate.localeCompare(rightDate);
    });
  const currentYearRegisters = comparisonRegisters.filter(
    r => assessmentCycles.find(c => c.id === r.assessmentId)?.academicYearId === 'year-2025-2026'
  );
  const defaultEarlier = currentYearRegisters[0] || comparisonRegisters[0];
  const defaultLater = currentYearRegisters[1] || comparisonRegisters[1];
  const earlierRegister = comparisonRegisters.find(register => register.id === comparisonEarlierId) || defaultEarlier;
  const laterRegister = comparisonRegisters.find(register => register.id === comparisonLaterId) || defaultLater;

  const explainMarkChange = async () => {
    if (!earlierRegister || !laterRegister) {
      setChangeExplanation(['There is not enough finalized assessment history to explain a change.']);
      return;
    }
    setIsExplainingChange(true);
    try {
      const earlierCycle = assessmentCycles.find(cycle => cycle.id === earlierRegister.assessmentId);
      const laterCycle = assessmentCycles.find(cycle => cycle.id === laterRegister.assessmentId);
      const earlierEntry = earlierRegister.entries.find(entry => entry.studentId === student.id);
      const laterEntry = laterRegister.entries.find(entry => entry.studentId === student.id);
      const missing: string[] = [];
      let absences: number | undefined;
      if (!earlierCycle || !laterCycle || earlierCycle.endDate >= laterCycle.startDate) {
        missing.push('assessment dates are missing or do not form an ordered interval');
      } else {
        try {
          const studentClasses = [student.classId];
          const prevEnrolls = (student as any).previousEnrollments as { classId: string }[] | undefined;
          if (Array.isArray(prevEnrolls)) {
            prevEnrolls.forEach(p => {
              if (p.classId && !studentClasses.includes(p.classId)) {
                studentClasses.push(p.classId);
              }
            });
          }
          const sessions = await provider.getAttendanceSessionsInRange(earlierCycle.endDate, laterCycle.startDate, studentClasses);
          const relevantSessions = sessions.filter(session => studentClasses.includes(session.classId) && session.status !== 'draft');
          if (relevantSessions.length === 0) {
            absences = undefined;
            missing.push('no submitted attendance sessions are available for the interval');
          } else {
            absences = relevantSessions.reduce((count, session) => {
              const record = session.records.find(item => item.studentId === student.id);
              return count + (record?.state === 'absent' ? 1 : 0);
            }, 0);
          }
        } catch {
          missing.push('attendance records for the interval could not be loaded');
        }
      }
      const notes = earlierCycle && laterCycle
        ? incidents.filter(note => note.date > earlierCycle.endDate && note.date <= laterCycle.startDate)
            .map(note => `${note.date}: ${note.title} — ${note.description}`)
        : [];
      setChangeExplanation(buildChangeExplanation({
        earlier: { title: earlierRegister.assessmentTitle, score: earlierEntry?.isAbsent ? null : earlierEntry?.marksObtained ?? null, maxMarks: earlierRegister.maxMarks },
        later: { title: laterRegister.assessmentTitle, score: laterEntry?.isAbsent ? null : laterEntry?.marksObtained ?? null, maxMarks: laterRegister.maxMarks },
        absences,
        notes,
        missing,
      }));
    } finally {
      setIsExplainingChange(false);
    }
  };

  const chartCutoff = new Date();
  chartCutoff.setMonth(chartCutoff.getMonth() - chartRangeMonths);
  const cutoffIso = chartCutoff.toISOString().slice(0, 10);

  // Active Subject for Mode 1 (Subject Progress)
  const activeSubjectName = chartSubjectId || comparisonSubjects[0]?.[0] || 'Mathematics';

  // Active Assessment for Mode 2 (Subject Comparison)
  const activeAssessmentId = chartAssessmentId || assessmentCycles[0]?.id || 'assess-ut1-2025';
  const activeAssessmentTitle = assessmentCycles.find(c => c.id === activeAssessmentId)?.title || 'Selected Assessment';

  // MODE 1: Subject Progress Records (strictly 1 row per cycle for activeSubjectName across all 3 years)
  const subjectResultRows = visibleFinalMarks
    .filter(reg => reg.subjectName === activeSubjectName)
    .flatMap(register => {
      const cycle = assessmentCycles.find(c => c.id === register.assessmentId);
      const entry = register.entries.find(e => e.studentId === student.id);
      if (!cycle || cycle.endDate < cutoffIso) return [];
      const score = entry && !entry.isAbsent ? entry.marksObtained : null;
      const percentage = normalizeMark(score, register.maxMarks);
      const benchmark = classMarkBenchmarks(register.entries.map(m => ({ score: m.marksObtained, maxMarks: register.maxMarks, isAbsent: m.isAbsent })));
      return [{
        register,
        cycle,
        entry,
        score,
        percentage,
        mean: benchmark.mean,
        highest: benchmark.highest,
        coverage: benchmark.count,
        isAbsent: entry?.isAbsent ?? false,
      }];
    })
    .sort((a, b) => a.cycle.startDate.localeCompare(b.cycle.startDate));

  const subjectChartData = subjectResultRows.map(row => ({
    name: row.cycle.title,
    fullDate: row.cycle.endDate,
    studentScore: row.percentage !== null ? Math.round(row.percentage * 10) / 10 : null,
    classMean: row.mean !== null ? Math.round(row.mean * 10) / 10 : null,
    classHighest: row.highest !== null ? Math.round(row.highest * 10) / 10 : null,
    displayScore: row.score !== null ? `${row.score}/${row.register.maxMarks}` : row.isAbsent ? 'Absent' : 'Missing',
    coverage: row.coverage,
  }));

  // MODE 2: Subject Comparison Records (strictly 1 row per subject for activeAssessmentId)
  const assessmentResultRows = visibleFinalMarks
    .filter(reg => reg.assessmentId === activeAssessmentId)
    .flatMap(register => {
      const cycle = assessmentCycles.find(c => c.id === register.assessmentId);
      const entry = register.entries.find(e => e.studentId === student.id);
      if (!cycle) return [];
      const score = entry && !entry.isAbsent ? entry.marksObtained : null;
      const percentage = normalizeMark(score, register.maxMarks);
      const benchmark = classMarkBenchmarks(register.entries.map(m => ({ score: m.marksObtained, maxMarks: register.maxMarks, isAbsent: m.isAbsent })));
      return [{
        register,
        cycle,
        entry,
        score,
        percentage,
        mean: benchmark.mean,
        highest: benchmark.highest,
        coverage: benchmark.count,
        isAbsent: entry?.isAbsent ?? false,
      }];
    })
    .sort((a, b) => a.register.subjectName.localeCompare(b.register.subjectName));

  const assessmentChartData = assessmentResultRows.map(row => ({
    name: row.register.subjectName,
    fullDate: row.cycle.endDate,
    studentScore: row.percentage !== null ? Math.round(row.percentage * 10) / 10 : null,
    classMean: row.mean !== null ? Math.round(row.mean * 10) / 10 : null,
    classHighest: row.highest !== null ? Math.round(row.highest * 10) / 10 : null,
    displayScore: row.score !== null ? `${row.score}/${row.register.maxMarks}` : row.isAbsent ? 'Absent' : 'Missing',
    coverage: row.coverage,
  }));

  // MODE 3: Overall Progress Across Assessment Cycles (strictly 1 aggregate row per cycle)
  const progressCycleRows = assessmentCycles
    .filter(cycle => cycle.endDate >= cutoffIso)
    .map(cycle => {
      const cycleRegisters = visibleFinalMarks.filter(reg => reg.assessmentId === cycle.id);
      const subjectRows = cycleRegisters.map(reg => {
        const entry = reg.entries.find(e => e.studentId === student.id);
        const score = entry && !entry.isAbsent ? entry.marksObtained : null;
        const percentage = normalizeMark(score, reg.maxMarks);
        const benchmark = classMarkBenchmarks(reg.entries.map(m => ({ score: m.marksObtained, maxMarks: reg.maxMarks, isAbsent: m.isAbsent })));
        return {
          register: reg,
          entry,
          score,
          percentage,
          mean: benchmark.mean,
          highest: benchmark.highest,
          coverage: benchmark.count,
          isAbsent: entry?.isAbsent ?? false,
        };
      });
      const validPercentages = subjectRows.filter((r): r is typeof r & { percentage: number } => r.percentage !== null);
      const overallPct = validPercentages.length > 0
        ? Math.round((validPercentages.reduce((s, r) => s + r.percentage, 0) / validPercentages.length) * 10) / 10
        : null;
      const validMeans = subjectRows.filter((r): r is typeof r & { mean: number } => r.mean !== null);
      const overallClassMean = validMeans.length > 0
        ? Math.round((validMeans.reduce((s, r) => s + r.mean, 0) / validMeans.length) * 10) / 10
        : null;
      const validHighests = subjectRows.filter((r): r is typeof r & { highest: number } => r.highest !== null);
      const overallHighest = validHighests.length > 0
        ? Math.round((validHighests.reduce((s, r) => s + r.highest, 0) / validHighests.length) * 10) / 10
        : null;
      return {
        cycle,
        subjectRows,
        overallPct,
        overallClassMean,
        overallHighest,
        evaluatedSubjectsCount: validPercentages.length,
        totalSubjectsCount: subjectRows.length,
      };
    })
    .filter(c => c.totalSubjectsCount > 0)
    .sort((a, b) => a.cycle.startDate.localeCompare(b.cycle.startDate));

  const progressChartData = progressCycleRows.map(c => ({
    name: c.cycle.title,
    fullDate: c.cycle.endDate,
    studentScore: c.overallPct,
    classMean: c.overallClassMean,
    classHighest: c.overallHighest,
    displayScore: c.overallPct !== null ? `${c.overallPct}% average` : 'No valid marks',
    subjectCount: c.evaluatedSubjectsCount,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`Class ${student.classLabel} • Admission #${student.admissionNumber} • Academic Session 2025–2026`}
        roleScope={student.classLabel}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Students', to: '/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
        actions={
          canViewFullReport ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/reports/ptm-slip/${student.id}`)}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="View and print Parent-Teacher Meeting Progress Slip"
              >
                <Printer size={15} />
                <span>PTM Progress Slip</span>
              </button>
              <button
                onClick={() => navigate(`/reports/report-card/${student.id}`)}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="View and print official Academic Report"
              >
                <FileText size={15} />
                <span>Academic Report</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Top Essential Student Profile Header */}
      <div
        className="hhs-card"
        style={{
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
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
              fontWeight: 700,
              fontSize: '1.25rem',
            }}
          >
            {student.firstName[0]}
            {student.lastName[0]}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="hhs-headline-md" style={{ margin: 0 }}>
                {student.fullName}
              </h2>
              <StatusBadge status={student.status} label={student.status === 'enrolled' ? 'Enrolled' : student.status} />
              {recentAttendanceRate !== null && recentAttendanceRate < 75 && (
                <span className="hhs-badge hhs-badge-danger">
                  Attendance below 75%
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', marginTop: '3px' }}>
              Class: <strong>{student.classLabel}</strong> • Roll #:{' '}
              <strong className="tnum">{student.rollNumber}</strong> • Admission #:{' '}
              <strong className="tnum">{student.admissionNumber}</strong>
            </div>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div style={{ display: 'flex', gap: 'clamp(12px, 3vw, 24px)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              className="tnum"
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                color: !canViewIndividualAttendance
                  ? 'var(--hhs-primary)'
                  : recentAttendanceRate !== null && recentAttendanceRate < 75
                  ? 'var(--hhs-danger)'
                  : 'var(--hhs-primary)',
              }}
            >
              {!canViewIndividualAttendance
                ? classAttendanceAggregate && classAttendanceAggregate.total > 0
                  ? `${Math.round(classAttendanceAggregate.present / classAttendanceAggregate.total * 1000) / 10}%`
                  : '—'
                : studentAttendanceSummary && studentAttendanceSummary.present + studentAttendanceSummary.absent > 0
                  ? `${Math.round(studentAttendanceSummary.present / (studentAttendanceSummary.present + studentAttendanceSummary.absent) * 1000) / 10}%`
                  : '—'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
              {!canViewIndividualAttendance ? 'Class Turnout (today)' : 'Session Attendance (2025–26)'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
              {computedAcademicAverage === null ? '—' : `${computedAcademicAverage}%`}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
              Finalized marks average
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Profile Overview', icon: <User size={15} /> },
          { id: 'academics', label: 'Academic Performance', icon: <GraduationCap size={15} /> },
          ...(canViewIndividualAttendance
            ? [{ id: 'attendance', label: 'Attendance Records', icon: <CalendarCheck size={15} /> }]
            : []),
          {
            id: 'behaviour',
            label: `Teacher notes (${incidents.length})`,
            icon: <AlertTriangle size={15} />,
          },
          ...(canEdit ? [{ id: 'audit', label: `Change History (${auditHistory.length})`, icon: <History size={15} /> }] : []),
        ]}
      />

      {/* TAB 1: OVERVIEW — The 3 Clearly Organized Areas */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* AREA 1: ATTENDANCE SUMMARY */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--hhs-primary)' }} />
                <h3 className="hhs-headline-sm" style={{ margin: 0 }}>
                  {canViewIndividualAttendance ? 'Attendance Summary' : 'Class Attendance (Aggregate)'}
                </h3>
              </div>
              {canViewIndividualAttendance && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => navigate(`/students/${student.id}/attendance`)}
                    className="hhs-btn hhs-btn-primary hhs-btn-sm"
                    title="Open dedicated date-by-date attendance history and Excel export"
                  >
                    <span>View Attendance History</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  >
                    <span>Attendance Breakdown</span>
                  </button>
                </div>
              )}
            </div>

            {canViewIndividualAttendance ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>Recorded school days</div>
                  <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{totalSchoolDays}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Session 2025–2026</div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>Days Present</div>
                  <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-primary)', marginTop: '2px' }}>{daysPresent}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Attended classes</div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>Days Absent</div>
                  <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: daysAbsent > 10 ? 'var(--hhs-danger)' : 'inherit', marginTop: '2px' }}>{daysAbsent}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Excludes approved leave</div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>Turnout Rate</div>
                  <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: recentAttendanceRate !== null && recentAttendanceRate < 75 ? 'var(--hhs-danger)' : 'var(--hhs-primary)', marginTop: '2px' }}>
                    {recentAttendanceRate === null ? '—' : `${recentAttendanceRate}%`}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                    {recentAttendanceRate === null ? 'No recorded sessions' : recentAttendanceRate >= 75 ? '75% or above in this period' : 'Below 75% in this period'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '14px 16px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', color: 'var(--hhs-text-primary)' }}>
                  <strong>{student.classLabel}</strong> — {classAttendanceAggregate
                    ? `${classAttendanceAggregate.present} of ${classAttendanceAggregate.total} students present or late on ${classAttendanceAggregate.date} (${Math.round(classAttendanceAggregate.present / classAttendanceAggregate.total * 1000) / 10}%).`
                    : 'No submitted aggregate attendance is recorded for today.'}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                  Subject teachers have aggregate section visibility only. Individual absence records and registers are managed by the Class Teacher.
                </p>
              </div>
            )}
          </div>

          {/* AREA 2: ACADEMIC RESULTS */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} style={{ color: 'var(--hhs-primary)' }} />
                <h3 className="hhs-headline-sm" style={{ margin: 0 }}>Academic Results</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setActiveTab('academics')}
                  className="hhs-btn hhs-btn-primary hhs-btn-sm"
                  title="Explain a change in marks across assessment cycles"
                >
                  <span>Explain a change in marks</span>
                </button>
                <button
                  onClick={() => setActiveTab('academics')}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                >
                  <span>All Examination Cycles</span>
                </button>
              </div>
            </div>

            {marksRegisters.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="hhs-table" style={{ width: '100%', fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Subject</th>
                      <th style={{ textAlign: 'center' }}>Max Marks</th>
                      <th style={{ textAlign: 'center' }}>Marks Obtained</th>
                      <th style={{ textAlign: 'center' }}>Percentage</th>
                      <th style={{ textAlign: 'center' }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marksRegisters.slice(0, 6).map(reg => {
                      const entry = reg.entries.find(e => e.studentId === student.id);
                      if (!entry) return null;
                      return (
                        <tr key={reg.id}>
                          <td style={{ fontWeight: 600 }}>{reg.assessmentTitle}</td>
                          <td>{reg.subjectName}</td>
                          <td className="tnum" style={{ textAlign: 'center' }}>{reg.maxMarks}</td>
                          <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>
                            {entry.isAbsent ? <span className="hhs-badge hhs-badge-danger">Absent</span> : entry.marksObtained}
                          </td>
                          <td className="tnum" style={{ textAlign: 'center' }}>
                            {entry.percentage !== undefined ? `${entry.percentage}%` : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {entry.grade ? <span className="hhs-badge hhs-badge-primary">{entry.grade}</span> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                No recent examination marks entered for this student yet.
              </div>
            )}
          </div>

          {/* AREA 3: RELEVANT TEACHER NOTES */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} style={{ color: 'var(--hhs-primary)' }} />
                <h3 className="hhs-headline-sm" style={{ margin: 0 }}>Teacher notes</h3>
              </div>
              {canAddNote && (
                <button
                  onClick={() => setActiveTab('behaviour')}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                >
                  <span>Add Note</span>
                </button>
              )}
            </div>

            {incidents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {incidents.slice(0, 4).map(inc => (
                  <div
                    key={inc.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--hhs-radius-base)',
                      backgroundColor: 'var(--hhs-canvas)',
                      border: '1px solid var(--hhs-border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{inc.title}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                        {inc.date} • By {inc.loggedByStaffName}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.4 }}>
                      {inc.description}
                    </p>
                    {inc.actionTaken && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--hhs-primary)', marginTop: '6px' }}>
                        Follow-up: {inc.actionTaken}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                No teacher notes or observations recorded for this student yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACADEMICS — Rebuilt 3-Mode Academic Performance Experience */}
      {activeTab === 'academics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Main Academic Card */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            {/* Top Bar with Mode Switcher & Print Action */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '18px',
                borderBottom: '1px solid var(--hhs-border)',
                paddingBottom: '14px',
              }}
            >
              <div>
                <h3 className="hhs-headline-sm" style={{ margin: 0 }}>Academic Performance</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', margin: '2px 0 0' }}>
                  Session 2025–2026 • Verified examination and unit test results
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <SegmentedControl
                  value={chartView}
                  onChange={(val) => setChartView(val as typeof chartView)}
                  options={[
                    { value: 'subject', label: 'Subject Progress', icon: <BookOpen size={14} /> },
                    { value: 'assessment', label: 'Subject Comparison', icon: <BarChart3 size={14} /> },
                    { value: 'progress', label: 'Overall Progress', icon: <TrendingUp size={14} /> },
                  ]}
                  ariaLabel="Select academic performance viewing mode"
                />

                <button
                  onClick={() => navigate(`/reports/report-card/${student.id}`)}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Print student report card"
                >
                  <Printer size={13} />
                  <span>Report Card</span>
                </button>
              </div>
            </div>

            {/* Context-Sensitive Filter Toolbar */}
            <FilterToolbar
              statusInfo={
                chartView === 'subject'
                  ? `${subjectResultRows.length} assessment cycle${subjectResultRows.length === 1 ? '' : 's'} for ${activeSubjectName}`
                  : chartView === 'assessment'
                  ? `Comparing ${assessmentResultRows.length} subjects in ${activeAssessmentTitle}`
                  : `Overall trajectory across ${progressCycleRows.length} assessment cycles`
              }
            >
              {chartView === 'subject' && (
                <>
                  <div className="hhs-filter-field">
                    <label htmlFor="academic-subject-select">Subject</label>
                    <select
                      id="academic-subject-select"
                      className="hhs-select"
                      value={activeSubjectName}
                      onChange={(e) => {
                        setChartSubjectId(e.target.value);
                        setComparisonSubjectId(e.target.value);
                        setComparisonEarlierId('');
                        setComparisonLaterId('');
                        setChangeExplanation([]);
                      }}
                      style={{ minWidth: '180px' }}
                    >
                      {comparisonSubjects.map(([subId, subName]) => (
                        <option key={subId} value={subId}>
                          {subName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hhs-filter-field">
                    <label>Time Range</label>
                    <SegmentedControl
                      size="sm"
                      value={chartRangeMonths}
                      onChange={(val) => setChartRangeMonths(val)}
                      options={[
                        { value: 3, label: '3M' },
                        { value: 6, label: '6M' },
                        { value: 12, label: '1Y' },
                        { value: 24, label: '2Y' },
                        { value: 36, label: '3Y' },
                      ]}
                      ariaLabel="Filter by time range"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowExplanationDrawer(!showExplanationDrawer)}
                    className={`hhs-btn ${showExplanationDrawer ? 'hhs-btn-primary' : 'hhs-btn-secondary'} hhs-btn-sm`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <HelpCircle size={14} />
                    <span>Explain Change in Marks</span>
                  </button>
                </>
              )}

              {chartView === 'assessment' && (
                <div className="hhs-filter-field">
                  <label htmlFor="academic-assessment-select">Assessment Cycle</label>
                  <select
                    id="academic-assessment-select"
                    className="hhs-select"
                    value={activeAssessmentId}
                    onChange={(e) => setChartAssessmentId(e.target.value)}
                    style={{ minWidth: '220px' }}
                  >
                    {assessmentCycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {cycle.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {chartView === 'progress' && (
                <div className="hhs-filter-field">
                  <label>History Window</label>
                  <SegmentedControl
                    size="sm"
                    value={chartRangeMonths}
                    onChange={(val) => setChartRangeMonths(val)}
                    options={[
                      { value: 6, label: '6 Months' },
                      { value: 12, label: '1 Year' },
                      { value: 24, label: '2 Years' },
                      { value: 36, label: '3 Years' },
                    ]}
                    ariaLabel="Filter history range"
                  />
                </div>
              )}
            </FilterToolbar>

            {/* Explain a change in marks Evidence Panel */}
            <section
              className="hhs-panel"
              aria-label="Explain a change in marks"
              style={{
                marginBottom: '18px',
                backgroundColor: 'var(--hhs-surface)',
                border: '1px solid var(--hhs-border)',
                borderLeft: '4px solid var(--pop-burnt-vermilion)',
                borderRadius: 'var(--hhs-radius-container)',
                padding: '18px 20px',
                boxShadow: 'var(--hhs-shadow-level-1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="hhs-badge hhs-badge-accent" style={{ fontSize: '0.68rem', height: '19px' }}>
                    Diagnostic Reasoning
                  </span>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                    Explain a change in marks
                  </h4>
                </div>
              </div>

              {comparisonRegisters.length >= 2 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                  <div className="hhs-filter-field">
                    <label htmlFor="earlier-cycle-select">Earlier Assessment</label>
                    <select
                      id="earlier-cycle-select"
                      className="hhs-select"
                      value={earlierRegister?.id || ''}
                      onChange={(e) => {
                        setComparisonEarlierId(e.target.value);
                        setChangeExplanation([]);
                      }}
                      style={{ minWidth: '160px' }}
                    >
                      {comparisonRegisters.map((reg) => (
                        <option key={reg.id} value={reg.id}>
                          {reg.assessmentTitle}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hhs-filter-field">
                    <label htmlFor="later-cycle-select">Later Assessment</label>
                    <select
                      id="later-cycle-select"
                      className="hhs-select"
                      value={laterRegister?.id || ''}
                      onChange={(e) => {
                        setComparisonLaterId(e.target.value);
                        setChangeExplanation([]);
                      }}
                      style={{ minWidth: '160px' }}
                    >
                      {comparisonRegisters.map((reg) => (
                        <option key={reg.id} value={reg.id}>
                          {reg.assessmentTitle}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="hhs-btn hhs-btn-accent hhs-btn-sm"
                    disabled={isExplainingChange}
                    onClick={explainMarkChange}
                    style={{ height: 'var(--hhs-control-height)' }}
                  >
                    {isExplainingChange ? 'Reviewing records…' : 'Review evidence'}
                  </button>
                </div>
              ) : (
                <p style={{ margin: 0, color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                  There is not enough finalized history in this subject to compare two assessment cycles.
                </p>
              )}

              {changeExplanation.length > 0 && (
                <div
                  aria-live="polite"
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 'var(--hhs-radius-base)',
                    backgroundColor: 'var(--pop-electric-blue-tint)',
                    border: '1px solid rgba(31, 107, 255, 0.25)',
                    borderLeft: '4px solid var(--pop-electric-blue)',
                  }}
                >
                  <strong style={{ fontSize: '0.86rem', color: 'var(--pop-electric-blue)' }}>
                    Diagnostic Reasoning & Interval Evidence
                  </strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.84rem', color: 'var(--hhs-text-primary)' }}>
                    {changeExplanation.map((line, index) => (
                      <li key={`${index}-${line}`} style={{ marginTop: 5, fontWeight: line.includes('absences') || line.includes('dropped') ? 600 : 400 }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Visual Performance Chart */}
            <section
              className="hhs-panel"
              aria-label="Academic performance charts"
              style={{
                width: '100%',
                backgroundColor: 'var(--hhs-surface)',
                borderRadius: 'var(--hhs-radius-container)',
                border: '1px solid var(--hhs-border)',
                padding: '18px 20px 14px',
                marginBottom: '18px',
                boxShadow: 'var(--hhs-shadow-level-1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Academic progress</h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                    {chartView === 'subject'
                      ? `${activeSubjectName} • Solid line: Student • Dashed: Class Average • Dotted: Class Highest`
                      : chartView === 'assessment'
                      ? `${activeAssessmentTitle} • Gold: Student Score • Olive: Class Mean • Neutral: Highest Benchmark`
                      : 'Overall average normalized across all eligible subjects per cycle'}
                  </div>
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                  Scale: Normalized Percentage (0–100%)
                </div>
              </div>

              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--hhs-text-secondary)' }}>
                {chartView === 'subject' ? subjectResultRows.length : chartView === 'assessment' ? assessmentResultRows.length : progressCycleRows.length} finalized result{((chartView === 'subject' ? subjectResultRows.length : chartView === 'assessment' ? assessmentResultRows.length : progressCycleRows.length) === 1) ? '' : 's'} in this view. Missing and draft marks are excluded; class benchmarks show values without student identities.
              </p>

              {/* Chart Rendering with Exact Pop Palette */}
              {chartView === 'subject' && (
                subjectChartData.length > 0 ? (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={subjectChartData} margin={{ top: 15, right: 25, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F4" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#202033', fontSize: 12, fontWeight: 600 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#56577A', fontSize: 11 }} unit="%" />
                        <Tooltip
                          formatter={(val: any, name: any) => [
                            typeof val === 'number' ? `${val}%` : 'Unrecorded / Absent',
                            name === 'studentScore' ? 'Student Score' : name === 'classMean' ? 'Class Average' : 'Highest Benchmark',
                          ]}
                          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#1F6BFF', borderWidth: '1.5px', borderRadius: '8px', boxShadow: '0 4px 14px rgba(31, 107, 255, 0.2)', fontSize: '12px' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                          formatter={(val) => (val === 'studentScore' ? `${activeSubjectName} Score` : val === 'classMean' ? 'Class Average' : 'Highest Benchmark')}
                        />
                        <Line
                          type="monotone"
                          dataKey="studentScore"
                          name="studentScore"
                          stroke="#1F6BFF"
                          strokeWidth={2.8}
                          connectNulls={false}
                          activeDot={{ r: 7, fill: '#1F6BFF', stroke: '#FFFFFF', strokeWidth: 2 }}
                          dot={{ r: 5, fill: '#1F6BFF', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="classMean"
                          name="classMean"
                          stroke="#FF7A00"
                          strokeWidth={2.2}
                          strokeDasharray="5 4"
                          connectNulls={true}
                          dot={{ r: 4, fill: '#FF7A00' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="classHighest"
                          name="classHighest"
                          stroke="#6425D0"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          connectNulls={true}
                          dot={{ r: 4, fill: '#6425D0' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                    No finalized assessment marks found for {activeSubjectName} in the selected time range.
                  </div>
                )
              )}

              {chartView === 'assessment' && (
                assessmentChartData.length > 0 ? (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={assessmentChartData} margin={{ top: 15, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F4" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#202033', fontSize: 11, fontWeight: 600 }} interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#56577A', fontSize: 11 }} unit="%" />
                        <Tooltip
                          formatter={(val: any, name: any) => [
                            typeof val === 'number' ? `${val}%` : 'Unrecorded',
                            name === 'studentScore' ? 'Student Score' : name === 'classMean' ? 'Class Average' : 'Highest Benchmark',
                          ]}
                          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#1F6BFF', borderWidth: '1.5px', borderRadius: '8px', boxShadow: '0 4px 14px rgba(31, 107, 255, 0.2)', fontSize: '12px' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                          formatter={(val) => (val === 'studentScore' ? 'Student Score' : val === 'classMean' ? 'Class Average' : 'Highest Benchmark')}
                        />
                        <Bar dataKey="studentScore" name="studentScore" fill="#1F6BFF" radius={[4, 4, 0, 0]} maxBarSize={32} />
                        <Bar dataKey="classMean" name="classMean" fill="#FF7A00" radius={[4, 4, 0, 0]} maxBarSize={32} />
                        <Bar dataKey="classHighest" name="classHighest" fill="#6425D0" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                    No subject results available for {activeAssessmentTitle}.
                  </div>
                )
              )}

              {chartView === 'progress' && (
                progressChartData.length > 0 ? (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressChartData} margin={{ top: 15, right: 25, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F4" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#202033', fontSize: 12, fontWeight: 600 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#56577A', fontSize: 11 }} unit="%" />
                        <Tooltip
                          formatter={(val: any, name: any) => [
                            typeof val === 'number' ? `${val}%` : 'No valid marks',
                            name === 'studentScore' ? 'Student Cycle Average' : name === 'classMean' ? 'Class Mean Average' : 'Topper Mean',
                          ]}
                          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#1F6BFF', borderWidth: '1.5px', borderRadius: '8px', boxShadow: '0 4px 14px rgba(31, 107, 255, 0.2)', fontSize: '12px' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                          formatter={(val) => (val === 'studentScore' ? 'Student Overall %' : val === 'classMean' ? 'Class Overall Mean' : 'Class Highest Benchmark')}
                        />
                        <Line
                          type="monotone"
                          dataKey="studentScore"
                          name="studentScore"
                          stroke="#1F6BFF"
                          strokeWidth={2.8}
                          connectNulls={false}
                          activeDot={{ r: 7, fill: '#1F6BFF', stroke: '#FFFFFF', strokeWidth: 2 }}
                          dot={{ r: 5, fill: '#1F6BFF', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="classMean"
                          name="classMean"
                          stroke="#FF7A00"
                          strokeWidth={2.2}
                          strokeDasharray="5 4"
                          connectNulls={true}
                          dot={{ r: 4, fill: '#FF7A00' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="classHighest"
                          name="classHighest"
                          stroke="#6425D0"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          connectNulls={true}
                          dot={{ r: 4, fill: '#6425D0' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                    No overall assessment cycles recorded in the selected history window.
                  </div>
                )
              )}
            </section>

            {/* Compact KPI Summary Metrics Section (Replaces redundant progress bars) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              {chartView === 'subject' && (
                <>
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Latest Result</span>
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-primary)', marginTop: '2px' }}>
                      {subjectResultRows[subjectResultRows.length - 1]?.score !== null
                        ? `${subjectResultRows[subjectResultRows.length - 1]?.score}/${subjectResultRows[subjectResultRows.length - 1]?.register.maxMarks}`
                        : '—'}
                      <span style={{ fontSize: '0.82rem', fontWeight: 500, marginLeft: '6px', color: 'var(--hhs-text-secondary)' }}>
                        {subjectResultRows[subjectResultRows.length - 1]?.percentage !== null
                          ? `(${subjectResultRows[subjectResultRows.length - 1]?.percentage}%)`
                          : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                      {subjectResultRows[subjectResultRows.length - 1]?.cycle.title || 'No data'}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Previous Result</span>
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>
                      {subjectResultRows.length > 1 && subjectResultRows[subjectResultRows.length - 2]?.score !== null
                        ? `${subjectResultRows[subjectResultRows.length - 2]?.score}/${subjectResultRows[subjectResultRows.length - 2]?.register.maxMarks}`
                        : '—'}
                      <span style={{ fontSize: '0.82rem', fontWeight: 500, marginLeft: '6px', color: 'var(--hhs-text-secondary)' }}>
                        {subjectResultRows.length > 1 && subjectResultRows[subjectResultRows.length - 2]?.percentage !== null
                          ? `(${subjectResultRows[subjectResultRows.length - 2]?.percentage}%)`
                          : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                      {subjectResultRows.length > 1 ? subjectResultRows[subjectResultRows.length - 2]?.cycle.title : 'Baseline cycle'}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Score Change</span>
                    {(() => {
                      const latest = subjectResultRows[subjectResultRows.length - 1]?.percentage;
                      const prev = subjectResultRows.length > 1 ? subjectResultRows[subjectResultRows.length - 2]?.percentage : null;
                      const diff = (latest !== null && latest !== undefined && prev !== null && prev !== undefined)
                        ? Math.round((latest - prev) * 10) / 10
                        : null;
                      return (
                        <>
                          <div
                            className="tnum"
                            style={{
                              fontSize: '1.25rem',
                              fontWeight: 700,
                              color: diff === null ? 'var(--hhs-text-secondary)' : diff > 0 ? 'var(--hhs-success)' : diff < 0 ? 'var(--hhs-danger)' : 'var(--hhs-primary)',
                              marginTop: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {diff !== null ? (diff > 0 ? `+${diff}%` : `${diff}%`) : '—'}
                            {diff !== null && diff > 0 && <ArrowUpRight size={16} />}
                            {diff !== null && diff < 0 && <ArrowDownRight size={16} />}
                            {diff === 0 && <Minus size={16} />}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                            {diff !== null ? (diff >= 0 ? 'Improvement' : 'Decline between cycles') : 'No earlier cycle'}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Subject Period Average</span>
                    {(() => {
                      const valid = subjectResultRows.map(r => r.percentage).filter((p): p is number => p !== null);
                      const avg = valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
                      return (
                        <>
                          <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>
                            {avg !== null ? `${avg}%` : '—'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                            Average across {valid.length} recorded cycle{valid.length === 1 ? '' : 's'}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </>
              )}

              {chartView === 'assessment' && (
                <>
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Exam Average</span>
                    {(() => {
                      const valid = assessmentResultRows.map(r => r.percentage).filter((p): p is number => p !== null);
                      const avg = valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
                      return (
                        <>
                          <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-primary)', marginTop: '2px' }}>
                            {avg !== null ? `${avg}%` : '—'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                            Student mean across {valid.length} subjects
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Best Subject</span>
                    {(() => {
                      const valid = [...assessmentResultRows.filter(r => r.percentage !== null)].sort((a, b) => b.percentage! - a.percentage!);
                      const top = valid[0];
                      return (
                        <>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {top ? top.register.subjectName : '—'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                            {top ? `${top.percentage}% (${top.score}/${top.register.maxMarks})` : 'No marks entered'}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Subject for Review</span>
                    {(() => {
                      const valid = [...assessmentResultRows.filter(r => r.percentage !== null)].sort((a, b) => a.percentage! - b.percentage!);
                      const lowest = valid[0];
                      return (
                        <>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px', color: lowest && lowest.percentage! < 50 ? 'var(--hhs-danger)' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lowest ? lowest.register.subjectName : '—'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                            {lowest ? `${lowest.percentage}% (${lowest.score}/${lowest.register.maxMarks})` : 'No marks entered'}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Class Exam Benchmark</span>
                    {(() => {
                      const validMeans = assessmentResultRows.map(r => r.mean).filter((m): m is number => m !== null);
                      const classAvg = validMeans.length ? Math.round((validMeans.reduce((a, b) => a + b, 0) / validMeans.length) * 10) / 10 : null;
                      return (
                        <>
                          <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>
                            {classAvg !== null ? `${classAvg}%` : '—'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                            Class average across subjects
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </>
              )}

              {chartView === 'progress' && (
                <>
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Latest Cycle Average</span>
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--hhs-primary)', marginTop: '2px' }}>
                      {progressCycleRows[progressCycleRows.length - 1]?.overallPct !== null
                        ? `${progressCycleRows[progressCycleRows.length - 1]?.overallPct}%`
                        : '—'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                      {progressCycleRows[progressCycleRows.length - 1]?.cycle.title || 'No data'}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Previous Cycle Average</span>
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>
                      {progressCycleRows.length > 1 && progressCycleRows[progressCycleRows.length - 2]?.overallPct !== null
                        ? `${progressCycleRows[progressCycleRows.length - 2]?.overallPct}%`
                        : '—'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                      {progressCycleRows.length > 1 ? progressCycleRows[progressCycleRows.length - 2]?.cycle.title : 'First cycle'}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Trajectory</span>
                    {(() => {
                      const latest = progressCycleRows[progressCycleRows.length - 1]?.overallPct;
                      const prev = progressCycleRows.length > 1 ? progressCycleRows[progressCycleRows.length - 2]?.overallPct : null;
                      const diff = (latest !== null && latest !== undefined && prev !== null && prev !== undefined)
                        ? Math.round((latest - prev) * 10) / 10
                        : null;
                      return (
                        <>
                          <div
                            className="tnum"
                            style={{
                              fontSize: '1.25rem',
                              fontWeight: 700,
                              color: diff === null ? 'var(--hhs-text-secondary)' : diff > 0 ? 'var(--hhs-success)' : diff < 0 ? 'var(--hhs-danger)' : 'var(--hhs-primary)',
                              marginTop: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {diff !== null ? (diff > 0 ? `+${diff}%` : `${diff}%`) : '—'}
                            {diff !== null && diff > 0 && <ArrowUpRight size={16} />}
                            {diff !== null && diff < 0 && <ArrowDownRight size={16} />}
                            {diff === 0 && <Minus size={16} />}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                            {diff !== null ? (diff >= 0 ? 'Cycle gain' : 'Cycle drop') : 'Baseline'}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                    <span className="hhs-label">Cumulative Academic Mean</span>
                    <div className="tnum" style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>
                      {computedAcademicAverage !== null ? `${computedAcademicAverage}%` : '—'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                      Overall mean across all final results
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Active View Structured Records Table (Follows active view filters) */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>
                  {chartView === 'subject'
                    ? `${activeSubjectName} Results by Assessment Cycle`
                    : chartView === 'assessment'
                    ? `Subject Results in ${activeAssessmentTitle}`
                    : 'Assessment Cycle Summaries'}
                </h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
                  {chartView === 'subject'
                    ? `${subjectResultRows.length} record${subjectResultRows.length === 1 ? '' : 's'}`
                    : chartView === 'assessment'
                    ? `${assessmentResultRows.length} subject${assessmentResultRows.length === 1 ? '' : 's'}`
                    : `${progressCycleRows.length} cycle${progressCycleRows.length === 1 ? '' : 's'}`}
                </div>
              </div>

              {chartView === 'subject' && (
                subjectResultRows.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="hhs-table">
                      <thead>
                        <tr>
                          <th>Assessment Cycle</th>
                          <th>Exam Date</th>
                          <th style={{ textAlign: 'center' }}>Obtained</th>
                          <th style={{ textAlign: 'center' }}>Max</th>
                          <th style={{ textAlign: 'center' }}>Percentage</th>
                          <th style={{ textAlign: 'center' }}>Grade</th>
                          <th style={{ textAlign: 'center' }}>Class Mean</th>
                          <th style={{ textAlign: 'center' }}>Highest Benchmark</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectResultRows.map((row) => (
                          <tr key={row.register.id}>
                            <td style={{ fontWeight: 600 }}>{row.cycle.title}</td>
                            <td style={{ color: 'var(--hhs-text-secondary)' }}>{row.cycle.endDate}</td>
                            <td className="tnum" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--hhs-primary)' }}>
                              {row.isAbsent ? <span className="hhs-badge hhs-badge-danger">Absent</span> : row.score !== null ? row.score : '—'}
                            </td>
                            <td className="tnum" style={{ textAlign: 'center' }}>{row.register.maxMarks}</td>
                            <td className="tnum" style={{ textAlign: 'center', fontWeight: 600 }}>
                              {row.percentage !== null ? `${row.percentage}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {row.entry?.grade ? <span className="hhs-badge hhs-badge-primary">{row.entry.grade}</span> : '—'}
                            </td>
                            <td className="tnum" style={{ textAlign: 'center' }}>
                              {row.mean !== null ? `${row.mean.toFixed(1)}%` : '—'}
                            </td>
                            <td className="tnum" style={{ textAlign: 'center' }}>
                              {row.highest !== null ? `${row.highest.toFixed(1)}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`hhs-badge ${isFinalizedResult(row.register.status) ? 'hhs-badge-primary' : 'hhs-badge-neutral'}`}>
                                {isFinalizedResult(row.register.status) ? 'Final' : 'Submitted'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                    No assessment records found for {activeSubjectName}.
                  </div>
                )
              )}

              {chartView === 'assessment' && (
                assessmentResultRows.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="hhs-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th style={{ textAlign: 'center' }}>Obtained</th>
                          <th style={{ textAlign: 'center' }}>Max</th>
                          <th style={{ textAlign: 'center' }}>Percentage</th>
                          <th style={{ textAlign: 'center' }}>Grade</th>
                          <th style={{ textAlign: 'center' }}>Class Mean</th>
                          <th style={{ textAlign: 'center' }}>Highest Benchmark</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assessmentResultRows.map((row) => (
                          <tr key={row.register.id}>
                            <td style={{ fontWeight: 600 }}>{row.register.subjectName}</td>
                            <td className="tnum" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--hhs-primary)' }}>
                              {row.isAbsent ? <span className="hhs-badge hhs-badge-danger">Absent</span> : row.score !== null ? row.score : '—'}
                            </td>
                            <td className="tnum" style={{ textAlign: 'center' }}>{row.register.maxMarks}</td>
                            <td className="tnum" style={{ textAlign: 'center', fontWeight: 600 }}>
                              {row.percentage !== null ? `${row.percentage}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {row.entry?.grade ? <span className="hhs-badge hhs-badge-primary">{row.entry.grade}</span> : '—'}
                            </td>
                            <td className="tnum" style={{ textAlign: 'center' }}>
                              {row.mean !== null ? `${row.mean.toFixed(1)}%` : '—'}
                            </td>
                            <td className="tnum" style={{ textAlign: 'center' }}>
                              {row.highest !== null ? `${row.highest.toFixed(1)}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`hhs-badge ${isFinalizedResult(row.register.status) ? 'hhs-badge-primary' : 'hhs-badge-neutral'}`}>
                                {isFinalizedResult(row.register.status) ? 'Final' : 'Submitted'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                              {row.entry?.remarks || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                    No records found for {activeAssessmentTitle}.
                  </div>
                )
              )}

              {chartView === 'progress' && (
                progressCycleRows.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="hhs-table">
                      <thead>
                        <tr>
                          <th>Assessment Cycle</th>
                          <th>Exam Date</th>
                          <th style={{ textAlign: 'center' }}>Subjects Evaluated</th>
                          <th style={{ textAlign: 'center' }}>Student Cycle Average</th>
                          <th style={{ textAlign: 'center' }}>Class Mean Average</th>
                          <th style={{ textAlign: 'center' }}>Highest Benchmark</th>
                          <th style={{ textAlign: 'center' }}>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressCycleRows.map((c) => {
                          const isExpanded = !!expandedProgressCycles[c.cycle.id];
                          return (
                            <React.Fragment key={c.cycle.id}>
                              <tr>
                                <td style={{ fontWeight: 600 }}>{c.cycle.title}</td>
                                <td style={{ color: 'var(--hhs-text-secondary)' }}>{c.cycle.endDate}</td>
                                <td className="tnum" style={{ textAlign: 'center' }}>
                                  {c.evaluatedSubjectsCount} of {c.totalSubjectsCount}
                                </td>
                                <td className="tnum" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--hhs-primary)' }}>
                                  {c.overallPct !== null ? `${c.overallPct}%` : '—'}
                                </td>
                                <td className="tnum" style={{ textAlign: 'center' }}>
                                  {c.overallClassMean !== null ? `${c.overallClassMean}%` : '—'}
                                </td>
                                <td className="tnum" style={{ textAlign: 'center' }}>
                                  {c.overallHighest !== null ? `${c.overallHighest}%` : '—'}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedProgressCycles((prev) => ({
                                        ...prev,
                                        [c.cycle.id]: !prev[c.cycle.id],
                                      }))
                                    }
                                    className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                                    style={{ padding: '2px 8px', fontSize: '0.74rem' }}
                                  >
                                    {isExpanded ? 'Hide' : 'Breakdown'}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={7} style={{ backgroundColor: 'var(--hhs-canvas)', padding: '12px 16px' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--hhs-text-secondary)', marginBottom: '8px' }}>
                                      {c.cycle.title} — Subject-wise Scores:
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                                      {c.subjectRows.map((s) => (
                                        <div
                                          key={s.register.id}
                                          style={{
                                            padding: '8px 10px',
                                            backgroundColor: 'var(--hhs-surface)',
                                            borderRadius: 'var(--hhs-radius-base)',
                                            border: '1px solid var(--hhs-border)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: '0.8rem',
                                          }}
                                        >
                                          <span>{s.register.subjectName}</span>
                                          <strong className="tnum" style={{ color: 'var(--hhs-primary)' }}>
                                            {s.isAbsent ? 'Absent' : s.score !== null ? `${s.score}/${s.register.maxMarks} (${s.percentage}%)` : '—'}
                                          </strong>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-secondary)', fontSize: '0.84rem' }}>
                    No assessment cycles recorded yet.
                  </div>
                )
              )}
            </div>

            {/* Collapsible Complete Historical Transcript Section (Collapsed by default) */}
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--hhs-border)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowFullTranscript(!showFullTranscript)}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {showFullTranscript ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>
                  {showFullTranscript ? 'Hide' : 'View'} Complete Historical Transcript ({marksRegisters.length} records)
                </span>
              </button>

              {showFullTranscript && (
                <div style={{ marginTop: '14px', overflowX: 'auto' }}>
                  <table className="hhs-table">
                    <thead>
                      <tr>
                        <th>Assessment Cycle</th>
                        <th>Subject</th>
                        <th style={{ textAlign: 'center' }}>Max Marks</th>
                        <th style={{ textAlign: 'center' }}>Marks Obtained</th>
                        <th style={{ textAlign: 'center' }}>Percentage</th>
                        <th style={{ textAlign: 'center' }}>Grade</th>
                        <th>Class Mean / Benchmark</th>
                        <th>Record Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marksRegisters.map((reg) => {
                        const entry = reg.entries.find((e) => e.studentId === student.id);
                        if (!entry) return null;
                        const benchmark = classMarkBenchmarks(
                          reg.entries.map((mark) => ({
                            score: mark.marksObtained,
                            maxMarks: reg.maxMarks,
                            isAbsent: mark.isAbsent,
                          }))
                        );
                        return (
                          <tr key={reg.id}>
                            <td style={{ fontWeight: 600 }}>{reg.assessmentTitle}</td>
                            <td>{reg.subjectName}</td>
                            <td className="tnum" style={{ textAlign: 'center' }}>{reg.maxMarks}</td>
                            <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>
                              {entry.isAbsent ? <span className="hhs-badge hhs-badge-danger">Absent</span> : entry.marksObtained}
                            </td>
                            <td className="tnum" style={{ textAlign: 'center' }}>
                              {entry.percentage !== undefined ? `${entry.percentage}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {entry.grade ? <span className="hhs-badge hhs-badge-primary">{entry.grade}</span> : '—'}
                            </td>
                            <td className="tnum" style={{ textAlign: 'center' }}>
                              {benchmark.mean === null || benchmark.highest === null
                                ? 'No class results'
                                : `${benchmark.mean.toFixed(1)}% mean · ${benchmark.highest.toFixed(1)}% top`}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`hhs-badge ${isFinalizedResult(reg.status) ? 'hhs-badge-primary' : 'hhs-badge-neutral'}`}>
                                {isFinalizedResult(reg.status) ? 'Final' : 'Submitted'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                              {entry.remarks || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE RECORDS */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 className="hhs-headline-sm" style={{ marginBottom: '4px' }}>Attendance Records & Daily History</h3>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  Session 2025–2026 academic muster records for <strong>{student.fullName}</strong> ({student.classLabel}, Roll #{student.rollNumber}).
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    if (!student || studentAttendanceLogs.length === 0) return;
                    const dateLogs = studentAttendanceLogs.map(l => {
                      const d = new Date(l.date + 'T12:00:00Z');
                      const dayStr = d.toLocaleDateString('en-IN', { weekday: 'long' });
                      const statusMap: Record<string, string> = {
                        present: 'Present',
                        absent: 'Absent',
                        late: 'Late',
                        excused: 'Excused / Leave',
                      };
                      return {
                        date: l.date,
                        day: dayStr,
                        status: statusMap[l.state] || l.state,
                        remarks: l.remarks || 'Regular morning muster',
                      };
                    });
                    downloadStudentAttendanceXlsx(student, dateLogs);
                  }}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  disabled={studentAttendanceLogs.length === 0}
                >
                  <Download size={14} />
                  <span>Download Log (.xlsx)</span>
                </button>
                <button
                  onClick={() => navigate('/attendance/corrections')}
                  className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                >
                  Attendance Corrections
                </button>
              </div>
            </div>

            {/* Evidence-Based 30-Day Status Banner */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--hhs-radius-base)',
                backgroundColor: 'var(--hhs-canvas)',
                border: '1px solid var(--hhs-border)',
                marginBottom: '18px',
                fontSize: '0.86rem',
                color: 'var(--hhs-text-primary)',
              }}
            >
              {recent30DayStats?.hasRecords ? (
                <span>
                  Attendance for the last 30 days: <strong className="tnum" style={{ color: recent30DayStats.percentage !== null && recent30DayStats.percentage < 75 ? 'var(--hhs-danger)' : 'var(--hhs-primary)' }}>{recent30DayStats.percentage}%</strong> ({recent30DayStats.present} present, {recent30DayStats.absent} absent, {recent30DayStats.leave} approved leave across {recent30DayStats.total} submitted sessions; unmarked days excluded).
                </span>
              ) : (
                <span>
                  Attendance for the last 30 days: <em>No submitted attendance sessions recorded in this 30-day window</em> (interval falls during term break or unrecorded period). Full verified session attendance across <strong>{totalSchoolDays}</strong> instructional days is documented below.
                </span>
              )}
            </div>

            {/* Session KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <span className="hhs-label">Total School Days</span>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '2px' }}>{totalSchoolDays}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Verified submitted sessions</div>
              </div>
              <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <span className="hhs-label">Days Present</span>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--pop-apple-green)', marginTop: '2px' }}>{daysPresent}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Present & late entries</div>
              </div>
              <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <span className="hhs-label">Days Absent</span>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, color: daysAbsent > 10 ? 'var(--pop-coral-red)' : 'var(--hhs-text-primary)', marginTop: '2px' }}>{daysAbsent}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Excludes approved leave</div>
              </div>
              <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <span className="hhs-label">Approved Leave</span>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--pop-deep-violet)', marginTop: '2px' }}>{studentAttendanceSummary?.leave ?? 0}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>Official medical/activity leave</div>
              </div>
              <div style={{ padding: '14px', borderRadius: 'var(--hhs-radius-base)', backgroundColor: 'var(--hhs-canvas)', border: '1px solid var(--hhs-border)' }}>
                <span className="hhs-label">Session Turnout Rate</span>
                <div className="tnum" style={{ fontSize: '1.35rem', fontWeight: 800, color: recentAttendanceRate !== null && recentAttendanceRate < 75 ? 'var(--pop-coral-red)' : 'var(--hhs-primary)', marginTop: '2px' }}>
                  {recentAttendanceRate === null ? '—' : `${recentAttendanceRate}%`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                  {recentAttendanceRate !== null && recentAttendanceRate >= 75 ? 'Meets CBSE 75% criterion' : 'Below 75% threshold'}
                </div>
              </div>
            </div>

            {/* Filter Pills for Daily Attendance Register */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setAttendanceTableFilter('all')}
                  className={`hhs-btn hhs-btn-sm ${attendanceTableFilter === 'all' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  All Sessions ({studentAttendanceLogs.length})
                </button>
                <button
                  onClick={() => setAttendanceTableFilter('absent')}
                  className={`hhs-btn hhs-btn-sm ${attendanceTableFilter === 'absent' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  Absences ({studentAttendanceLogs.filter(l => l.state === 'absent').length})
                </button>
                <button
                  onClick={() => setAttendanceTableFilter('late')}
                  className={`hhs-btn hhs-btn-sm ${attendanceTableFilter === 'late' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  Late Arrivals ({studentAttendanceLogs.filter(l => l.state === 'late').length})
                </button>
                <button
                  onClick={() => setAttendanceTableFilter('excused')}
                  className={`hhs-btn hhs-btn-sm ${attendanceTableFilter === 'excused' ? 'hhs-btn-primary' : 'hhs-btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  Approved Leave ({studentAttendanceLogs.filter(l => l.state === 'excused').length})
                </button>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)' }}>
                Showing {studentAttendanceLogs.filter(l => attendanceTableFilter === 'all' || l.state === attendanceTableFilter).length} recorded days
              </span>
            </div>

            {/* Daily Attendance History Table */}
            {studentAttendanceLogs.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', backgroundColor: 'var(--hhs-canvas)', borderRadius: 'var(--hhs-radius-base)' }}>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  No historical attendance sessions recorded yet for this student.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--hhs-border)', borderRadius: 'var(--hhs-radius-base)', maxHeight: '460px', overflowY: 'auto' }}>
                <table className="hhs-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--hhs-canvas)', zIndex: 1, borderBottom: '2px solid var(--hhs-border)' }}>
                    <tr>
                      <th style={{ padding: '10px 14px', textAlign: 'left', width: '140px' }}>Date</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', width: '110px' }}>Day</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', width: '120px' }}>Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', width: '180px' }}>Recorded By</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>Remarks / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentAttendanceLogs
                      .filter(l => attendanceTableFilter === 'all' || l.state === attendanceTableFilter)
                      .map((log) => {
                        const dateObj = new Date(log.date + 'T12:00:00Z');
                        const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
                        const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });


                        const stateLabel =
                          log.state === 'present' ? 'Present' :
                          log.state === 'absent' ? 'Absent' :
                          log.state === 'late' ? 'Late Arrival' :
                          'Approved Leave';

                        const stateColor =
                          log.state === 'present' ? 'var(--pop-apple-green)' :
                          log.state === 'absent' ? 'var(--pop-coral-red)' :
                          log.state === 'late' ? 'var(--pop-tangerine-orange)' :
                          'var(--pop-deep-violet)';

                        return (
                          <tr key={log.date} style={{ borderBottom: '1px solid var(--hhs-border)' }}>
                            <td className="tnum" style={{ padding: '10px 14px', fontWeight: 600 }}>
                              {formattedDate}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--hhs-text-secondary)' }}>
                              {dayName}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#FFFFFF',
                                  backgroundColor: stateColor,
                                }}
                              >
                                {stateLabel}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--hhs-text-secondary)', fontSize: '0.8rem' }}>
                              {log.staffName || 'Class Teacher'}
                            </td>
                            <td style={{ padding: '10px 14px', color: log.remarks ? 'var(--hhs-text-primary)' : 'var(--hhs-text-secondary)' }}>
                              {log.remarks || 'Regular morning muster'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TEACHER NOTES */}
      {activeTab === 'behaviour' && (
        <div className="hhs-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="hhs-headline-sm">Teacher notes</h3>
              <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                Chronological record of teacher notes.
              </p>
            </div>
            {canAddNote && (
              <button
                onClick={() => navigate('/behaviour')}
                className="hhs-btn hhs-btn-primary hhs-btn-sm"
              >
                Add New Note
              </button>
            )}
          </div>

          {incidents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {incidents.map(inc => (
                <div
                  key={inc.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--hhs-radius-base)',
                    border: '1px solid var(--hhs-border)',
                    backgroundColor: 'var(--hhs-canvas)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong>{inc.title}</strong>
                    <span style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)' }}>
                      Date: {inc.date} • Logged by: {inc.loggedByStaffName}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', lineHeight: 1.4 }}>
                    {inc.description}
                  </p>
                  {inc.actionTaken && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--hhs-primary)', marginTop: '4px' }}>
                      Follow-up: {inc.actionTaken}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
              No notes recorded for this student.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUDIT HISTORY (Authorized Roles) */}
      {activeTab === 'audit' && canEdit && (
        <div className="hhs-card" style={{ padding: '20px' }}>
          <h3 className="hhs-headline-sm" style={{ marginBottom: '6px' }}>Profile Change History</h3>
          <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginBottom: '16px' }}>
            Record of updates made to this student record.
          </p>

          {auditHistory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditHistory.map(event => (
                <div
                  key={event.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--hhs-radius-base)',
                    backgroundColor: 'var(--hhs-surface-muted)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hhs-text-secondary)' }}>
                    <span style={{ fontWeight: 600 }}>{event.actorName}</span>
                    <span className="tnum">{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: '2px' }}>{event.summary}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hhs-text-secondary)' }}>
              No recorded changes to this student profile.
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Student Profile"
        >
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="hhs-label">First Name</label>
                <input
                  type="text"
                  className="hhs-input"
                  value={editForm.firstName}
                  onChange={e => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="hhs-label">Last Name</label>
                <input
                  type="text"
                  className="hhs-input"
                  value={editForm.lastName}
                  onChange={e => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="hhs-label">Guardian Name</label>
              <input
                type="text"
                className="hhs-input"
                value={editForm.guardianName}
                onChange={e => setEditForm(prev => ({ ...prev, guardianName: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="hhs-label">Primary Phone</label>
              <input
                type="text"
                className="hhs-input"
                value={editForm.primaryPhone}
                onChange={e => setEditForm(prev => ({ ...prev, primaryPhone: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="hhs-label">Residential Address</label>
              <textarea
                className="hhs-input"
                rows={2}
                value={editForm.residentialAddress}
                onChange={e => setEditForm(prev => ({ ...prev, residentialAddress: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="hhs-label">Reason for Change</label>
              <input
                type="text"
                className="hhs-input"
                placeholder="Brief reason for updating record..."
                value={editForm.revisionReason}
                onChange={e => setEditForm(prev => ({ ...prev, revisionReason: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="hhs-btn hhs-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="hhs-btn hhs-btn-primary"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
