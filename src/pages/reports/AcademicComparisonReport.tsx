import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { downloadCsv } from '../../utils/exportUtils';
import type { ClassSection, AssessmentCycle, Subject, MarksRegister, AcademicYear } from '../../domain/types';
import { normalizeMark, classMarkBenchmarks } from '../../domain/academicAnalytics';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Search,
  X,
  CheckSquare,
  Square,
  AlertCircle,
  BarChart3,
} from 'lucide-react';

const CLASS_PALETTE_COLORS = [
  '#1F6BFF', // Electric Blue
  '#E4572E', // Burnt Vermilion (replaces Hot Pink)
  '#6425D0', // Deep Violet
  '#FF7A00', // Tangerine Orange
  '#7ED957', // Apple Green
  '#FFE600', // Canary Yellow
  '#B7F000', // Lime Green
  '#FF4D4F', // Coral Red
];

interface ClassMetricSummary {
  classId: string;
  classLabel: string;
  classTeacherName: string;
  color: string;
  totalStudents: number;
  evaluatedCount: number;
  overallMeanPct: number | null;
  passPct: number | null;
  highestPct: number | null;
}

interface SubjectComparisonEntry {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  classStats: Record<string, {
    meanScore: number | null;
    meanPct: number | null;
    passPct: number | null;
    highestScore: number | null;
    evaluatedCount: number;
  }>;
  deltaPct: number | null; // Diff between first two selected classes if >= 2
}

export const AcademicComparisonReport: React.FC = () => {
  const { provider } = useData();

  // Reference Data State
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [allClasses, setAllClasses] = useState<ClassSection[]>([]);
  const [assessmentCycles, setAssessmentCycles] = useState<AssessmentCycle[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [selectedYearId, setSelectedYearId] = useState<string>('year-2025-2026');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(['class-10-a', 'class-10-b']);
  const [classSearchQuery, setClassSearchQuery] = useState<string>('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('assess-ut1-2025');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');

  // Loaded Marks Registers for Comparison
  const [marksRegisters, setMarksRegisters] = useState<MarksRegister[]>([]);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // 1. Initial Load of Master Entities
  useEffect(() => {
    let isMounted = true;
    async function loadMasterData() {
      setIsLoading(true);
      setError(null);
      try {
        const [years, clsList, cycles, subs] = await Promise.all([
          provider.getAcademicYears(),
          provider.getClasses(),
          provider.getAssessmentCycles(),
          provider.getSubjects(),
        ]);
        if (!isMounted) return;

        setAcademicYears(years);
        setAllClasses(clsList);
        setAssessmentCycles(cycles);
        setSubjects(subs);

        // Active year
        const currentYear = years.find(y => y.isCurrent) || years[0];
        if (currentYear) {
          setSelectedYearId(currentYear.id);
          const yearCycles = cycles.filter(c => c.academicYearId === currentYear.id);
          if (yearCycles.length > 0) {
            setSelectedAssessmentId(yearCycles[0].id);
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load master configuration.';
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadMasterData();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  // 2. When Academic Year changes, update available assessment cycles and classes
  const availableCycles = useMemo(() => {
    return assessmentCycles.filter(c => c.academicYearId === selectedYearId);
  }, [assessmentCycles, selectedYearId]);

  useEffect(() => {
    if (availableCycles.length > 0 && !availableCycles.some(c => c.id === selectedAssessmentId)) {
      setSelectedAssessmentId(availableCycles[0].id);
    }
  }, [availableCycles, selectedAssessmentId]);

  // Filter available classes for selected year
  const availableClasses = useMemo(() => {
    return allClasses.filter(c => c.academicYearId === selectedYearId || !c.academicYearId);
  }, [allClasses, selectedYearId]);

  // Search filtered class list
  const filteredClasses = useMemo(() => {
    const q = classSearchQuery.trim().toLowerCase();
    if (!q) return availableClasses;
    return availableClasses.filter(c => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [availableClasses, classSearchQuery]);

  // 3. Load Marks Registers when selectedClassIds, selectedAssessmentId changes
  useEffect(() => {
    let isMounted = true;
    async function fetchComparisonRegisters() {
      if (selectedClassIds.length === 0 || !selectedAssessmentId) {
        setMarksRegisters([]);
        return;
      }

      setIsComparing(true);
      try {
        const promises: Promise<MarksRegister | null>[] = [];
        for (const classId of selectedClassIds) {
          for (const sub of subjects) {
            promises.push(provider.getMarksRegister(selectedAssessmentId, classId, sub.id));
          }
        }
        const results = await Promise.all(promises);
        if (!isMounted) return;
        const valid = results.filter((r): r is MarksRegister => r !== null && r.entries.length > 0);
        setMarksRegisters(valid);
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error('Error loading comparison marks registers:', err);
      } finally {
        if (isMounted) setIsComparing(false);
      }
    }
    fetchComparisonRegisters();
    return () => {
      isMounted = false;
    };
  }, [provider, selectedClassIds, selectedAssessmentId, subjects]);

  // Subject Options available for selected classes and assessment
  const availableSubjects = useMemo(() => {
    const subIdsInRegisters = new Set(marksRegisters.map(r => r.subjectId));
    return subjects.filter(s => subIdsInRegisters.has(s.id));
  }, [marksRegisters, subjects]);

  // Handle Multi-select Class Helpers
  const handleToggleClass = (classId: string) => {
    setSelectedClassIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredClasses.map(c => c.id);
    setSelectedClassIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const handleClearClasses = () => {
    setSelectedClassIds([]);
  };

  const handleResetFilters = () => {
    const defaultYear = academicYears.find(y => y.isCurrent)?.id || 'year-2025-2026';
    setSelectedYearId(defaultYear);
    setSelectedClassIds(['class-10-a', 'class-10-b']);
    const defaultCycle = assessmentCycles.find(c => c.academicYearId === defaultYear)?.id || 'assess-ut1-2025';
    setSelectedAssessmentId(defaultCycle);
    setSelectedSubjectId('all');
    setClassSearchQuery('');
  };

  // 4. Calculate Dynamic Comparison Metrics
  const { classSummaries, subjectComparisons, chartData } = useMemo(() => {
    // A. Class Summaries
    const summaries: ClassMetricSummary[] = selectedClassIds.map((cId, idx) => {
      const cls = allClasses.find(c => c.id === cId);
      const color = CLASS_PALETTE_COLORS[idx % CLASS_PALETTE_COLORS.length];
      const classRegs = marksRegisters.filter(r => r.classId === cId && (selectedSubjectId === 'all' || r.subjectId === selectedSubjectId));

      const totalPercentages: number[] = [];
      let passCount = 0;
      let highest: number | null = null;
      let evaluatedCount = 0;

      classRegs.forEach(reg => {
        reg.entries.forEach(entry => {
          if (!entry.isAbsent && entry.marksObtained !== null && entry.marksObtained !== undefined) {
            const pct = normalizeMark(entry.marksObtained, reg.maxMarks);
            if (pct !== null) {
              totalPercentages.push(pct);
              evaluatedCount++;
              if (pct >= 33.0) passCount++;
              if (highest === null || pct > highest) highest = pct;
            }
          }
        });
      });

      const overallMeanPct = totalPercentages.length > 0
        ? Math.round((totalPercentages.reduce((a, b) => a + b, 0) / totalPercentages.length) * 10) / 10
        : null;

      const passPct = totalPercentages.length > 0
        ? Math.round((passCount / totalPercentages.length) * 1000) / 10
        : null;

      return {
        classId: cId,
        classLabel: cls?.label || cId,
        classTeacherName: cls?.classTeacherName || 'Class Teacher',
        color,
        totalStudents: cls?.studentCount || 50,
        evaluatedCount,
        overallMeanPct,
        passPct,
        highestPct: highest !== null ? Math.round(highest * 10) / 10 : null,
      };
    });

    // B. Subject Comparisons Table
    const activeSubjects = availableSubjects.filter(s => selectedSubjectId === 'all' || s.id === selectedSubjectId);

    const compRows: SubjectComparisonEntry[] = activeSubjects.map(sub => {
      const classStats: SubjectComparisonEntry['classStats'] = {};
      let maxMarks = 25;

      selectedClassIds.forEach(cId => {
        const reg = marksRegisters.find(r => r.classId === cId && r.subjectId === sub.id);
        if (reg) {
          maxMarks = reg.maxMarks;
          const scores = reg.entries
            .filter(e => !e.isAbsent && e.marksObtained !== null && e.marksObtained !== undefined)
            .map(e => ({ score: e.marksObtained, maxMarks: reg.maxMarks, isAbsent: false }));

          const bm = classMarkBenchmarks(scores);
          const passEntries = scores.filter(s => s.score !== null && (s.score / reg.maxMarks) * 100 >= 33.0).length;
          const passPct = scores.length > 0 ? Math.round((passEntries / scores.length) * 1000) / 10 : null;

          const rawScores = scores.map(s => s.score!).filter(s => s !== null);
          const rawMean = rawScores.length > 0
            ? Math.round((rawScores.reduce((a, b) => a + b, 0) / rawScores.length) * 10) / 10
            : null;

          classStats[cId] = {
            meanScore: rawMean,
            meanPct: bm.mean !== null ? Math.round(bm.mean * 10) / 10 : null,
            passPct,
            highestScore: bm.highest !== null ? Math.round((bm.highest / 100) * reg.maxMarks * 10) / 10 : null,
            evaluatedCount: bm.count,
          };
        } else {
          classStats[cId] = {
            meanScore: null,
            meanPct: null,
            passPct: null,
            highestScore: null,
            evaluatedCount: 0,
          };
        }
      });

      // Calculate delta between first two selected classes
      let deltaPct: number | null = null;
      if (selectedClassIds.length >= 2) {
        const first = classStats[selectedClassIds[0]]?.meanPct;
        const second = classStats[selectedClassIds[1]]?.meanPct;
        if (first !== null && first !== undefined && second !== null && second !== undefined) {
          deltaPct = Math.round((first - second) * 10) / 10;
        }
      }

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        maxMarks,
        classStats,
        deltaPct,
      };
    });

    // C. Comparative Chart Data for Recharts
    const chart = compRows.map(row => {
      const point: Record<string, string | number | null> = {
        subject: row.subjectName,
      };
      selectedClassIds.forEach(cId => {
        const cls = allClasses.find(c => c.id === cId);
        const label = cls?.label || cId;
        point[label] = row.classStats[cId]?.meanPct ?? null;
      });
      return point;
    });

    return {
      classSummaries: summaries,
      subjectComparisons: compRows,
      chartData: chart,
    };
  }, [selectedClassIds, selectedSubjectId, marksRegisters, allClasses, availableSubjects]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (selectedClassIds.length === 0 || subjectComparisons.length === 0) return;

    const cycleTitle = assessmentCycles.find(c => c.id === selectedAssessmentId)?.title || selectedAssessmentId;
    const yearLabel = academicYears.find(y => y.id === selectedYearId)?.label || selectedYearId;

    const headers = [
      'Subject',
      'Code',
      'Max Marks',
      ...selectedClassIds.flatMap(cId => {
        const label = allClasses.find(c => c.id === cId)?.label || cId;
        return [`${label} Mean (Marks)`, `${label} Mean (%)`, `${label} Pass %`];
      }),
      ...(selectedClassIds.length >= 2 ? ['Variance Delta (%)'] : []),
    ];

    const rows = subjectComparisons.map(row => [
      row.subjectName,
      row.subjectCode,
      row.maxMarks,
      ...selectedClassIds.flatMap(cId => {
        const stat = row.classStats[cId];
        return [
          stat?.meanScore !== null ? stat.meanScore : '—',
          stat?.meanPct !== null ? `${stat.meanPct}%` : '—',
          stat?.passPct !== null ? `${stat.passPct}%` : '—',
        ];
      }),
      ...(selectedClassIds.length >= 2 ? [row.deltaPct !== null ? `${row.deltaPct > 0 ? '+' : ''}${row.deltaPct}%` : '—'] : []),
    ]);

    const filename = `Academic_Comparison_${selectedClassIds.join('_')}_${cycleTitle.replace(/\s+/g, '_')}_${yearLabel}`;
    downloadCsv(filename, headers, rows);
  };

  const selectedAssessmentCycle = assessmentCycles.find(c => c.id === selectedAssessmentId);
  const selectedYear = academicYears.find(y => y.id === selectedYearId);

  if (isLoading) {
    return <LoadingState message="Loading academic performance comparison engine..." />;
  }

  if (error) {
    return <ErrorBanner title="Academic Comparison Unavailable" message={error} />;
  }

  return (
    <div className="hhs-page-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="no-print">
        <PageHeader
          title="Academic Performance Comparison"
          subtitle={`Comparative scholastic performance analysis across classes, sections, examination cycles, and academic subjects.`}
          breadcrumbs={[
            { label: 'Campus' },
            { label: 'Reports' },
            { label: 'Academic Performance Comparison' },
          ]}
          actions={
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleExportCSV}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                disabled={selectedClassIds.length === 0 || subjectComparisons.length === 0}
              >
                <Download size={15} />
                <span>Export Comparison CSV</span>
              </button>
              <button
                onClick={() => window.print()}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} />
                <span>Print Report</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Dynamic Filter Toolbar */}
      <div className="hhs-card no-print" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="hhs-headline-sm" style={{ margin: 0 }}>Comparison Scope & Filters</h3>
          <button
            onClick={handleResetFilters}
            className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={13} />
            <span>Reset Selections</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '14px', alignItems: 'end' }}>
          {/* Academic Session */}
          <div>
            <label className="hhs-label" htmlFor="filter-session" style={{ marginBottom: '4px' }}>
              Academic Session
            </label>
            <select
              id="filter-session"
              value={selectedYearId}
              onChange={e => setSelectedYearId(e.target.value)}
              className="hhs-select"
              style={{ width: '100%' }}
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>
                  Session {y.label} {y.isCurrent ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment Cycle */}
          <div>
            <label className="hhs-label" htmlFor="filter-assessment" style={{ marginBottom: '4px' }}>
              Assessment Cycle
            </label>
            <select
              id="filter-assessment"
              value={selectedAssessmentId}
              onChange={e => setSelectedAssessmentId(e.target.value)}
              className="hhs-select"
              style={{ width: '100%' }}
            >
              {availableCycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} (Max: {c.maxMarks} marks)
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="hhs-label" htmlFor="filter-subject" style={{ marginBottom: '4px' }}>
              Subject Focus
            </label>
            <select
              id="filter-subject"
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="hhs-select"
              style={{ width: '100%' }}
            >
              <option value="all">All Common Subjects ({availableSubjects.length})</option>
              {availableSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Classes & Sections Searchable Multi-Select */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <span className="hhs-label" style={{ margin: 0 }}>
              Classes & Sections to Compare ({selectedClassIds.length} selected)
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ padding: '3px 8px', fontSize: '0.74rem' }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearClasses}
                className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                style={{ padding: '3px 8px', fontSize: '0.74rem' }}
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--hhs-text-secondary)' }} />
            <input
              type="text"
              placeholder="Search classes (e.g. 10-A, Class 9, Section B)..."
              value={classSearchQuery}
              onChange={e => setClassSearchQuery(e.target.value)}
              className="hhs-input"
              style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
            />
          </div>

          {/* Available classes checkboxes */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              maxHeight: '120px',
              overflowY: 'auto',
              padding: '6px',
              backgroundColor: 'var(--hhs-canvas)',
              borderRadius: 'var(--hhs-radius-base)',
              border: '1px solid var(--hhs-border)',
            }}
          >
            {filteredClasses.map(cls => {
              const isSelected = selectedClassIds.includes(cls.id);
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => handleToggleClass(cls.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    border: isSelected ? '1px solid var(--hhs-primary)' : '1px solid var(--hhs-border)',
                    backgroundColor: isSelected ? 'var(--hhs-primary-light)' : 'var(--hhs-surface)',
                    color: isSelected ? 'var(--hhs-primary)' : 'var(--hhs-text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSelected ? <CheckSquare size={13} color="var(--hhs-primary)" /> : <Square size={13} color="var(--hhs-text-secondary)" />}
                  <span>{cls.label}</span>
                </button>
              );
            })}
          </div>

          {/* Removable Chips */}
          {selectedClassIds.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--hhs-text-secondary)', fontWeight: 600 }}>Active Scope:</span>
              {selectedClassIds.map((cId, idx) => {
                const cls = allClasses.find(c => c.id === cId);
                const color = CLASS_PALETTE_COLORS[idx % CLASS_PALETTE_COLORS.length];
                return (
                  <span
                    key={cId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--hhs-surface)',
                      border: `1px solid ${color}`,
                      color: 'var(--hhs-text-primary)',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                    <span>{cls?.label || cId}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleClass(cId)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'var(--hhs-text-secondary)' }}
                      title={`Remove ${cls?.label}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Validation Message if insufficient classes */}
      {selectedClassIds.length === 0 ? (
        <div className="hhs-card" style={{ padding: '36px', textAlign: 'center' }}>
          <AlertCircle size={32} color="var(--pop-tangerine-orange)" style={{ margin: '0 auto 12px' }} />
          <h4 className="hhs-headline-sm" style={{ marginBottom: '6px' }}>No Sections Selected for Comparison</h4>
          <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', maxWidth: '480px', margin: '0 auto 16px' }}>
            Select at least one or more classes and sections from the filter toolbar above to evaluate scholastic performance.
          </p>
          <button
            onClick={() => setSelectedClassIds(['class-10-a', 'class-10-b'])}
            className="hhs-btn hhs-btn-primary hhs-btn-sm"
          >
            Compare Class 10-A and 10-B
          </button>
        </div>
      ) : isComparing ? (
        <LoadingState message="Recalculating comparative assessment distributions..." />
      ) : (
        <>
          {/* Class Performance Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
              gap: '14px',
            }}
          >
            {classSummaries.map((summary) => (
              <div
                key={summary.classId}
                className="hhs-card"
                style={{
                  padding: '16px',
                  borderTop: `4px solid ${summary.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--hhs-text-primary)' }}>
                    {summary.classLabel}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)' }}>
                    Tutor: {summary.classTeacherName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <div
                    className="tnum"
                    style={{
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      color: summary.overallMeanPct !== null && summary.overallMeanPct < 50 ? 'var(--pop-coral-red)' : summary.color,
                    }}
                  >
                    {summary.overallMeanPct !== null ? `${summary.overallMeanPct}%` : '—'}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>Cohort Mean</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.75rem', marginTop: '4px', borderTop: '1px solid var(--hhs-border)', paddingTop: '6px' }}>
                  <div>
                    <span style={{ color: 'var(--hhs-text-secondary)' }}>Pass Rate:</span>{' '}
                    <strong className="tnum" style={{ color: summary.passPct !== null && summary.passPct >= 90 ? 'var(--pop-apple-green)' : 'inherit' }}>
                      {summary.passPct !== null ? `${summary.passPct}%` : '—'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--hhs-text-secondary)' }}>Top Score:</span>{' '}
                    <strong className="tnum">
                      {summary.highestPct !== null ? `${summary.highestPct}%` : '—'}
                    </strong>
                  </div>
                </div>

                <div style={{ fontSize: '0.7rem', color: 'var(--hhs-text-secondary)' }}>
                  Evaluated {summary.evaluatedCount} student results ({summary.totalStudents} enrolled)
                </div>
              </div>
            ))}

            {/* Assessment Meta Card */}
            <div
              className="hhs-card"
              style={{
                padding: '16px',
                backgroundColor: 'var(--hhs-canvas)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span className="hhs-label">Evaluation Assessment</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--hhs-text-primary)', marginTop: '4px' }}>
                  {selectedAssessmentCycle?.title || 'Selected Assessment'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                  Academic Session {selectedYear?.label || '2025–2026'}
                </div>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--hhs-text-secondary)', borderTop: '1px solid var(--hhs-border)', paddingTop: '6px', marginTop: '8px' }}>
                Scales normalized to 0–100% for parity across varying maximum marks.
              </div>
            </div>
          </div>

          {/* Comparative Bar Chart */}
          {chartData.length > 0 && selectedClassIds.length > 0 && (
            <div className="hhs-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 className="hhs-headline-sm" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={18} color="var(--hhs-primary)" />
                    <span>Subject-Wise Score Distribution (%)</span>
                  </h4>
                  <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', margin: '2px 0 0' }}>
                    Comparing normalized mean score percentages across {chartData.length} curricular subjects.
                  </p>
                </div>
              </div>

              <div style={{ height: '320px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={(val: any) => [val !== null ? `${val}%` : 'N/A', '']}
                      contentStyle={{ backgroundColor: 'var(--hhs-surface)', borderRadius: '8px', border: '1px solid var(--hhs-border)', fontSize: '0.8rem' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }} />
                    {selectedClassIds.map((cId, idx) => {
                      const cls = allClasses.find(c => c.id === cId);
                      const label = cls?.label || cId;
                      const color = CLASS_PALETTE_COLORS[idx % CLASS_PALETTE_COLORS.length];
                      return <Bar key={cId} dataKey={label} fill={color} radius={[4, 4, 0, 0]} />;
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Detailed Tabular Comparison */}
          <div className="hhs-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--hhs-border)',
                backgroundColor: 'var(--hhs-surface-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--hhs-text-primary)' }}>
                  Detailed Scholastic Markbook Breakdown
                </h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--hhs-text-secondary)' }}>
                  {selectedAssessmentCycle?.title} • {selectedClassIds.length} sections selected
                </div>
              </div>
              <span className="hhs-badge hhs-badge-primary">
                Session {selectedYear?.label || '2025–2026'}
              </span>
            </div>

            {subjectComparisons.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center' }}>
                <p className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                  No common finalized assessment records found for the selected combination.
                </p>
              </div>
            ) : (
              <div className="hhs-table-responsive" style={{ border: 'none', borderRadius: 0, margin: 0 }}>
                <table className="hhs-table" style={{ width: '100%', fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', minWidth: '160px' }}>Subject Name</th>
                      <th style={{ width: '80px', textAlign: 'left' }}>Code</th>
                      <th className="numeric" style={{ width: '80px' }}>Max</th>
                      {selectedClassIds.map(cId => {
                        const cls = allClasses.find(c => c.id === cId);
                        const label = cls?.label || cId;
                        return (
                          <React.Fragment key={cId}>
                            <th className="numeric" style={{ minWidth: '110px' }}>{label} Mean</th>
                            <th className="numeric" style={{ minWidth: '95px' }}>{label} Pass %</th>
                          </React.Fragment>
                        );
                      })}
                      {selectedClassIds.length >= 2 && (
                        <th className="numeric" style={{ minWidth: '100px' }}>Variance Delta</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {subjectComparisons.map((row) => {
                      const isPositive = (row.deltaPct ?? 0) > 0;
                      return (
                        <tr key={row.subjectId}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--hhs-text-primary)' }}>
                              {row.subjectName}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                              {row.subjectCode}
                            </span>
                          </td>
                          <td className="numeric tnum">{row.maxMarks}</td>
                          {selectedClassIds.map(cId => {
                            const stat = row.classStats[cId];
                            return (
                              <React.Fragment key={cId}>
                                <td className="numeric tnum" style={{ fontWeight: 700 }}>
                                  {stat?.meanScore !== null
                                    ? `${stat.meanScore} (${stat.meanPct}%)`
                                    : '—'}
                                </td>
                                <td className="numeric tnum" style={{ fontWeight: 600 }}>
                                  {stat?.passPct !== null ? `${stat.passPct}%` : '—'}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          {selectedClassIds.length >= 2 && (
                            <td className="numeric">
                              {row.deltaPct !== null ? (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    fontWeight: 700,
                                    color: isPositive ? 'var(--hhs-primary)' : 'var(--pop-coral-red)',
                                  }}
                                >
                                  {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                  <span>
                                    {isPositive ? `+${row.deltaPct.toFixed(1)}%` : `${row.deltaPct.toFixed(1)}%`}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--hhs-text-secondary)' }}>—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
