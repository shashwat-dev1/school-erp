import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { downloadCsv } from '../../utils/exportUtils';
import type { ClassSection, AssessmentCycle, Subject, StudentRecord, StudentMarkEntry } from '../../domain/types';
import {
  Printer,
  Download,
  Award,
  AlertTriangle,
  Check,
} from 'lucide-react';

interface StudentAggResult {
  student: StudentRecord;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  subjectCount: number;
  hasAbsence: boolean;
}

export const ClassAcademicSummary: React.FC = () => {
  const { provider } = useData();

  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [cycles, setCycles] = useState<AssessmentCycle[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Selection
  const [selectedGrade, setSelectedGrade] = useState<number>(10);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>(['class-10-a', 'class-10-b']);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('assess-ut1-2025');

  // Loaded Data
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [marksMap, setMarksMap] = useState<Record<string, Record<string, StudentMarkEntry>>>({}); // studentId -> subjectId -> entry
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initial Meta
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const [clsList, cycleList, subList] = await Promise.all([
          provider.getClasses(),
          provider.getAssessmentCycles(),
          provider.getSubjects(),
        ]);
        if (!isMounted) return;
        setClasses(clsList);
        setCycles(cycleList);
        setSubjects(subList);

        // Default to Grade 10 sections if available
        const grade10Cls = clsList.filter(c => c.grade === 10);
        if (grade10Cls.length > 0) {
          setSelectedGrade(10);
          setSelectedSectionIds(grade10Cls.map(c => c.id));
        }
      } catch (err: unknown) {
        console.error('Failed to load summary metadata:', err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  // Load students and marks for selected sections & cycle
  useEffect(() => {
    let isMounted = true;
    async function loadSummaryData() {
      if (selectedSectionIds.length === 0) {
        setStudents([]);
        setMarksMap({});
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        // Fetch all students for selected sections
        const studentPromises = selectedSectionIds.map(id => provider.getClassStudents(id));
        const studentResults = await Promise.all(studentPromises);
        const combinedStudents = studentResults.flat();

        // Fetch marks registers for selected sections across subjects
        const marksMatrix: Record<string, Record<string, StudentMarkEntry>> = {};

        const regPromises: Promise<void>[] = [];
        for (const clsId of selectedSectionIds) {
          for (const sub of subjects) {
            regPromises.push(
              provider.getMarksRegister(selectedCycleId, clsId, sub.id).then(reg => {
                if (reg && reg.entries) {
                  reg.entries.forEach(entry => {
                    if (!marksMatrix[entry.studentId]) {
                      marksMatrix[entry.studentId] = {};
                    }
                    marksMatrix[entry.studentId][sub.id] = entry;
                  });
                }
              })
            );
          }
        }

        await Promise.all(regPromises);
        if (!isMounted) return;
        setStudents(combinedStudents);
        setMarksMap(marksMatrix);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load class academic data.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (subjects.length > 0) {
      loadSummaryData();
    }
    return () => {
      isMounted = false;
    };
  }, [provider, selectedSectionIds, selectedCycleId, subjects]);

  // Available grades
  const availableGrades = useMemo(() => {
    const grades = Array.from(new Set(classes.map(c => c.grade || 10))).sort((a, b) => b - a);
    return grades;
  }, [classes]);

  // Sections belonging to the selected grade
  const gradeSections = useMemo(() => {
    return classes.filter(c => c.grade === selectedGrade);
  }, [classes, selectedGrade]);

  const handleGradeChange = (newGrade: number) => {
    setSelectedGrade(newGrade);
    const sectionsForGrade = classes.filter(c => c.grade === newGrade).map(c => c.id);
    setSelectedSectionIds(sectionsForGrade);
    setValidationError(null);
  };

  const handleToggleSection = (sectionId: string) => {
    const targetCls = classes.find(c => c.id === sectionId);
    if (!targetCls) return;

    if (targetCls.grade !== selectedGrade) {
      setValidationError(
        `Cross-grade mixing is not permitted. Only sections of Class ${selectedGrade} can be combined in this summary report.`
      );
      return;
    }

    setValidationError(null);
    setSelectedSectionIds(prev => {
      if (prev.includes(sectionId)) {
        if (prev.length === 1) {
          // Keep at least one
          return prev;
        }
        return prev.filter(id => id !== sectionId);
      }
      return [...prev, sectionId];
    });
  };

  const handleSelectAllSectionsForGrade = () => {
    const allForGrade = gradeSections.map(c => c.id);
    setSelectedSectionIds(allForGrade);
    setValidationError(null);
  };

  const activeCycle = cycles.find(c => c.id === selectedCycleId) || cycles[0];
  const maxMarksPerSubject = activeCycle?.maxMarks || 25;

  // Student aggregates across selected sections
  const studentAggregates: StudentAggResult[] = useMemo(() => {
    return students.map(s => {
      const studentMarks = marksMap[s.id] || {};
      let totalObt = 0;
      let totalMx = 0;
      let subCount = 0;
      let hasAbs = false;

      subjects.forEach(sub => {
        const entry = studentMarks[sub.id];
        if (entry) {
          if (entry.isAbsent) {
            hasAbs = true;
          } else if (entry.marksObtained !== null && entry.marksObtained !== undefined) {
            totalObt += entry.marksObtained;
            totalMx += maxMarksPerSubject;
            subCount++;
          }
        }
      });

      const pct = totalMx > 0 ? (totalObt / totalMx) * 100 : 0;

      return {
        student: s,
        totalObtained: totalObt,
        totalMax: totalMx,
        percentage: Math.round(pct * 10) / 10,
        subjectCount: subCount,
        hasAbsence: hasAbs,
      };
    });
  }, [students, marksMap, subjects, maxMarksPerSubject]);

  // Score distribution bands
  const scoreBands = useMemo(() => {
    const total = studentAggregates.length;
    if (total === 0) return [];

    const bands = [
      { label: '90% and above (Outstanding)', min: 90, max: 101, count: 0, color: 'var(--hhs-primary)' },
      { label: '75% to 89% (Distinction)', min: 75, max: 90, count: 0, color: 'var(--hhs-primary-text)' },
      { label: '60% to 74% (First Division)', min: 60, max: 75, count: 0, color: 'var(--hhs-text-primary)' },
      { label: '33% to 59% (Pass / Satisfactory)', min: 33, max: 60, count: 0, color: 'var(--hhs-accent-text)' },
      { label: 'Below 33% (Needs Academic Support)', min: 0, max: 33, count: 0, color: 'var(--hhs-danger-text)' },
    ];

    studentAggregates.forEach(s => {
      for (const b of bands) {
        if (s.percentage >= b.min && s.percentage < b.max) {
          b.count++;
          break;
        }
      }
    });

    return bands.map(b => ({
      ...b,
      percentOfCohort: total > 0 ? ((b.count / total) * 100).toFixed(1) : '0.0',
    }));
  }, [studentAggregates]);

  // Subject-wise performance summary
  const subjectPerformance = useMemo(() => {
    return subjects.map(sub => {
      let scoreSum = 0;
      let scoredCount = 0;
      let passCount = 0;
      let highest = 0;
      let lowest = maxMarksPerSubject;

      students.forEach(s => {
        const entry = marksMap[s.id]?.[sub.id];
        if (entry && !entry.isAbsent && entry.marksObtained !== null && entry.marksObtained !== undefined) {
          scoreSum += entry.marksObtained;
          scoredCount++;
          if (entry.marksObtained >= maxMarksPerSubject * 0.33) {
            passCount++;
          }
          if (entry.marksObtained > highest) highest = entry.marksObtained;
          if (entry.marksObtained < lowest) lowest = entry.marksObtained;
        }
      });

      const avgMarks = scoredCount > 0 ? (scoreSum / scoredCount).toFixed(1) : '—';
      const avgPct = scoredCount > 0 ? (((scoreSum / scoredCount) / maxMarksPerSubject) * 100).toFixed(1) : '—';
      const passPct = scoredCount > 0 ? ((passCount / scoredCount) * 100).toFixed(1) : '—';

      return {
        subject: sub,
        avgMarks,
        avgPct,
        passPct,
        highest: scoredCount > 0 ? highest : '—',
        lowest: scoredCount > 0 ? lowest : '—',
        numericAvgPct: scoredCount > 0 ? (scoreSum / scoredCount / maxMarksPerSubject) * 100 : 0,
      };
    });
  }, [subjects, students, marksMap, maxMarksPerSubject]);

  // Comparatively weak subjects (sorted by lowest average percentage)
  const weakSubjects = useMemo(() => {
    return [...subjectPerformance]
      .filter(s => s.numericAvgPct > 0)
      .sort((a, b) => a.numericAvgPct - b.numericAvgPct)
      .slice(0, 2);
  }, [subjectPerformance]);

  // Top 10 Performers (Combined Population Ranking)
  const topPerformers = useMemo(() => {
    const valid = studentAggregates.filter(s => s.subjectCount > 0);
    valid.sort((a, b) => b.percentage - a.percentage);

    // Assign ranking with explicit tie handling
    let currentRank = 1;
    return valid.slice(0, 10).map((item, idx, arr) => {
      if (idx > 0 && item.percentage === arr[idx - 1].percentage) {
        return { ...item, rank: `T-${currentRank}` };
      }
      currentRank = idx + 1;
      return { ...item, rank: `${currentRank}` };
    });
  }, [studentAggregates]);

  // 10 Lowest Comparable Overall Performers
  const lowestPerformers = useMemo(() => {
    const valid = studentAggregates.filter(s => s.subjectCount > 0);
    valid.sort((a, b) => a.percentage - b.percentage);

    return valid.slice(0, 10).map((item, idx) => ({
      ...item,
      rank: `#${idx + 1}`,
    }));
  }, [studentAggregates]);

  const handleExportCSV = () => {
    const headers = [
      'Rank',
      'Roll #',
      'Admission #',
      'Student Name',
      'Section',
      'Total Marks Obtained',
      'Max Marks',
      'Overall %',
    ];

    const rows = topPerformers.map(t => [
      t.rank,
      t.student.rollNumber,
      t.student.admissionNumber,
      `${t.student.firstName} ${t.student.lastName}`,
      t.student.classLabel,
      t.totalObtained,
      t.totalMax,
      `${t.percentage}%`,
    ]);

    downloadCsv(`Class_${selectedGrade}_Academic_Summary_${activeCycle?.name || 'Cycle'}`, headers, rows);
  };

  const selectedClassLabels = gradeSections
    .filter(c => selectedSectionIds.includes(c.id))
    .map(c => c.label)
    .join(', ');

  return (
    <div className="hhs-page-container">
      {/* Top Header - Hidden in Print */}
      <div className="no-print">
        <PageHeader
          title={`Class ${selectedGrade} Academic Summary`}
          subtitle={`Combined grade-level performance analysis across selected sections (${selectedClassLabels})`}
          roleScope="Academic Leadership"
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: 'Reports', to: '/reports' },
            { label: `Class ${selectedGrade} Academic Summary` },
          ]}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleExportCSV}
                className="hhs-btn hhs-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={15} />
                <span>Export Top Performers</span>
              </button>
              <button
                onClick={() => window.print()}
                className="hhs-btn hhs-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Print this clean official class report"
              >
                <Printer size={16} />
                <span>Print Report</span>
              </button>
            </div>
          }
        />
      </div>

      {error && <ErrorBanner message={error} />}
      {validationError && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--hhs-danger-light)',
            border: '1px solid var(--hhs-danger)',
            borderRadius: 'var(--hhs-radius-base)',
            color: 'var(--hhs-danger-text)',
            fontSize: '0.85rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>{validationError}</span>
        </div>
      )}

      {/* Scope Selector Controls - Hidden in Print */}
      <div
        className="hhs-panel no-print"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: 'var(--hhs-surface)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
          {/* Grade Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="hhs-label" style={{ margin: 0, fontWeight: 700 }}>
              Class / Grade:
            </label>
            <select
              className="hhs-select"
              value={selectedGrade}
              onChange={e => handleGradeChange(parseInt(e.target.value))}
              style={{ width: '130px' }}
            >
              {availableGrades.map(g => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment Cycle Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="hhs-label" style={{ margin: 0, fontWeight: 700 }}>
              Assessment Cycle:
            </label>
            <select
              className="hhs-select"
              value={selectedCycleId}
              onChange={e => setSelectedCycleId(e.target.value)}
              style={{ width: '220px' }}
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} (Max {c.maxMarks})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Action: Select All Sections for Grade */}
          <button
            onClick={handleSelectAllSectionsForGrade}
            className="hhs-btn hhs-btn-secondary hhs-btn-sm"
            style={{ marginLeft: 'auto' }}
          >
            <Check size={14} />
            <span>Select All Sections for Class {selectedGrade}</span>
          </button>
        </div>

        {/* Section Checkboxes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--hhs-text-secondary)' }}>
            Include Sections:
          </span>
          {gradeSections.map(cls => {
            const isChecked = selectedSectionIds.includes(cls.id);
            return (
              <label
                key={cls.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--hhs-radius-base)',
                  backgroundColor: isChecked ? 'var(--hhs-primary-light)' : 'var(--hhs-surface-muted)',
                  border: isChecked ? '1px solid var(--hhs-primary)' : '1px solid var(--hhs-border)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: isChecked ? 'var(--hhs-primary-text)' : 'var(--hhs-text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleSection(cls.id)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{cls.label} ({cls.studentCount} students)</span>
              </label>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Generating Class Academic Summary..." />
      ) : (
        /* Printable Report Body */
        <div className="hhs-report-printable" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Institutional Report Header */}
          <div
            style={{
              padding: '24px',
              backgroundColor: 'var(--hhs-surface)',
              borderRadius: 'var(--hhs-radius-container)',
              border: '1px solid var(--hhs-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '3px solid var(--hhs-primary)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                HanuJai High School, Jaipur • Academic Assessment Division
              </div>
              <h2 className="hhs-headline-lg" style={{ margin: '4px 0 6px', color: 'var(--hhs-text-primary)' }}>
                Class {selectedGrade} Academic Summary Report
              </h2>
              <div style={{ fontSize: '0.88rem', color: 'var(--hhs-text-secondary)' }}>
                Session 2025–2026 • Combined evaluation for sections: <strong>{selectedClassLabels}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--hhs-primary)' }}>
                {activeCycle?.name}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                Coverage: <strong className="tnum">{students.length}</strong> Students Evaluated
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--hhs-text-muted)', marginTop: '4px' }}>
                Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Section 1: Score Distribution Bands */}
          <div className="hhs-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 14px', color: 'var(--hhs-text-primary)' }}>
              1. Academic Performance Distribution
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', margin: '0 0 16px' }}>
              Breakdown of student aggregate results across standard institutional score bands.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="hhs-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Score Band</th>
                    <th className="numeric" style={{ width: '140px' }}>Number of Students</th>
                    <th className="numeric" style={{ width: '140px' }}>% of Class Cohort</th>
                    <th style={{ width: '220px' }}>Representation</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreBands.map((band, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: band.color }}>
                        {band.label}
                      </td>
                      <td className="numeric" style={{ fontWeight: 700 }}>
                        {band.count}
                      </td>
                      <td className="numeric" style={{ fontWeight: 700 }}>
                        {band.percentOfCohort}%
                      </td>
                      <td>
                        <div
                          style={{
                            width: '100%',
                            height: '10px',
                            backgroundColor: 'var(--hhs-surface-muted)',
                            borderRadius: '5px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${band.percentOfCohort}%`,
                              height: '100%',
                              backgroundColor: band.color,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Overall Subject-Wise Performance */}
          <div className="hhs-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 14px', color: 'var(--hhs-text-primary)' }}>
              2. Subject-Wise Performance &amp; Pass Quorum
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table className="hhs-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th style={{ width: '80px' }}>Code</th>
                    <th className="numeric" style={{ width: '90px' }}>Max Marks</th>
                    <th className="numeric" style={{ width: '110px' }}>Mean Marks</th>
                    <th className="numeric" style={{ width: '110px' }}>Mean %</th>
                    <th className="numeric" style={{ width: '110px' }}>Pass Rate</th>
                    <th className="numeric" style={{ width: '90px' }}>Highest</th>
                    <th className="numeric" style={{ width: '90px' }}>Lowest</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectPerformance.map(s => (
                    <tr key={s.subject.id}>
                      <td style={{ fontWeight: 600 }}>{s.subject.name}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                          {s.subject.code}
                        </span>
                      </td>
                      <td className="numeric">{maxMarksPerSubject}</td>
                      <td className="numeric" style={{ fontWeight: 700, color: 'var(--hhs-primary)' }}>
                        {s.avgMarks}
                      </td>
                      <td className="numeric" style={{ fontWeight: 700 }}>
                        {s.avgPct}%
                      </td>
                      <td className="numeric" style={{ fontWeight: 600 }}>
                        {s.passPct}%
                      </td>
                      <td className="numeric">{s.highest}</td>
                      <td className="numeric">{s.lowest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Comparatively Weak Subjects Notice */}
            {weakSubjects.length > 0 && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--hhs-accent-light)',
                  border: '1px solid var(--hhs-accent)',
                  borderRadius: 'var(--hhs-radius-base)',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <AlertTriangle size={18} style={{ color: 'var(--hhs-accent-text)', flexShrink: 0 }} />
                <div>
                  <strong>Curricular Attention Area:</strong> In this examination cycle,{' '}
                  <strong>{weakSubjects.map(w => w.subject.name).join(' and ')}</strong> recorded comparatively lower averages ({weakSubjects.map(w => `${w.subject.name}: ${w.avgPct}%`).join(', ')}). Targeted remedial sessions are recommended.
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Top 10 Performers Across Selected Sections */}
          <div className="hhs-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--hhs-text-primary)' }}>
                  3. Top 10 Academic Performers (Combined Class {selectedGrade})
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)', margin: '3px 0 0' }}>
                  Ranked across combined sections using aggregate percentage. Tied percentages receive equal rank.
                </p>
              </div>
              <span className="hhs-badge hhs-badge-primary">
                <Award size={13} style={{ marginRight: '4px' }} />
                Merit Standing
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="hhs-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Rank</th>
                    <th style={{ width: '60px' }} className="numeric">Roll</th>
                    <th style={{ width: '120px' }}>Admission #</th>
                    <th>Student Name</th>
                    <th style={{ width: '90px' }}>Section</th>
                    <th className="numeric" style={{ width: '120px' }}>Total Marks</th>
                    <th className="numeric" style={{ width: '110px' }}>Overall %</th>
                  </tr>
                </thead>
                <tbody>
                  {topPerformers.map(item => (
                    <tr key={item.student.id}>
                      <td style={{ fontWeight: 700, color: 'var(--hhs-primary)' }}>
                        {item.rank}
                      </td>
                      <td className="numeric">{item.student.rollNumber}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                          {item.student.admissionNumber}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {item.student.firstName} {item.student.lastName}
                      </td>
                      <td>
                        <span className="hhs-badge hhs-badge-neutral">
                          {item.student.classLabel}
                        </span>
                      </td>
                      <td className="numeric" style={{ fontWeight: 600 }}>
                        {item.totalObtained} / {item.totalMax}
                      </td>
                      <td className="numeric" style={{ fontWeight: 700, color: 'var(--hhs-primary)' }}>
                        {item.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: 10 Lowest Comparable Overall Performers */}
          <div className="hhs-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--hhs-text-primary)' }}>
              4. Students Requiring Academic Support (Lowest 10 Comparable Scores)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)', margin: '0 0 14px' }}>
              Identified for academic follow-up and remedial clinics based on validated test submissions.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="hhs-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>#</th>
                    <th style={{ width: '60px' }} className="numeric">Roll</th>
                    <th style={{ width: '120px' }}>Admission #</th>
                    <th>Student Name</th>
                    <th style={{ width: '90px' }}>Section</th>
                    <th className="numeric" style={{ width: '120px' }}>Total Marks</th>
                    <th className="numeric" style={{ width: '110px' }}>Overall %</th>
                    <th>Recommended Support</th>
                  </tr>
                </thead>
                <tbody>
                  {lowestPerformers.map(item => (
                    <tr key={item.student.id}>
                      <td style={{ color: 'var(--hhs-text-muted)' }}>{item.rank}</td>
                      <td className="numeric">{item.student.rollNumber}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--hhs-text-secondary)' }}>
                          {item.student.admissionNumber}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {item.student.firstName} {item.student.lastName}
                      </td>
                      <td>
                        <span className="hhs-badge hhs-badge-neutral">
                          {item.student.classLabel}
                        </span>
                      </td>
                      <td className="numeric" style={{ fontWeight: 600 }}>
                        {item.totalObtained} / {item.totalMax}
                      </td>
                      <td className="numeric" style={{ fontWeight: 700, color: item.percentage < 33 ? 'var(--hhs-danger-text)' : 'inherit' }}>
                        {item.percentage}%
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)' }}>
                        {item.percentage < 33 ? 'Zero-Period Remedial & Guardian Meeting' : 'Subject Tutor Review'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Assessment Coverage & Data Limitations */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--hhs-surface-muted)',
              border: '1px solid var(--hhs-border)',
              borderRadius: 'var(--hhs-radius-base)',
              fontSize: '0.8rem',
              color: 'var(--hhs-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <strong>Assessment Coverage &amp; Data Governance:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
              <li>
                This report is based on validated marks entries for <strong>{activeCycle?.name}</strong> (Maximum {maxMarksPerSubject} marks per curricular subject).
              </li>
              <li>
                The combined analysis aggregates data for Class {selectedGrade} across sections {selectedClassLabels}. Sections are not segregated into independent mini-reports.
              </li>
              <li>
                Missing marks or unrecorded assessments are explicitly excluded from aggregate mean percentages rather than artificially fabricated as zero performance.
              </li>
              <li>
                Ranks are calculated transparently by aggregate percentage. Equal percentages receive identical rank assignments.
              </li>
            </ul>
          </div>

        </div>
      )}
    </div>
  );
};
