import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorBanner } from '../../components/feedback/ErrorBanner';
import { NewObservationModal } from './NewObservationModal';
import type { IncidentRecord, StudentRecord } from '../../domain/types';
import {
  Plus,
  Download,
  Search,
  Eye,
} from 'lucide-react';

export const BehaviourDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { provider } = useData();

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const isSubjectTeacher = currentUser?.role === 'subject_teacher';
  const isClassTeacher = currentUser?.role === 'class_teacher';

  const assignedClassIds = useMemo(() => {
    if (isClassTeacher && currentUser?.assignedClassId) {
      return [currentUser.assignedClassId];
    }
    if (isSubjectTeacher) {
      return currentUser?.assignedClasses || ['class-10-a', 'class-10-b', 'class-09-a'];
    }
    return [];
  }, [isClassTeacher, isSubjectTeacher, currentUser]);

  const fetchNotesAndStudents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch available students based on role scope
      let scopedStudents: StudentRecord[] = [];
      if (isClassTeacher && currentUser?.assignedClassId) {
        scopedStudents = await provider.getClassStudents(currentUser.assignedClassId);
      } else if (isSubjectTeacher && assignedClassIds.length > 0) {
        const studentLists = await Promise.all(
          assignedClassIds.map(cId => provider.getClassStudents(cId))
        );
        scopedStudents = studentLists.flat();
      } else {
        scopedStudents = (await provider.getStudents()).items;
      }

      // Deduplicate students
      const studentMap = new Map<string, StudentRecord>();
      scopedStudents.forEach(s => studentMap.set(s.id, s));
      const uniqueStudents = Array.from(studentMap.values());
      setStudents(uniqueStudents);

      // 2. Fetch notes / observations
      const allIncidents = await provider.getIncidents();

      // Filter notes according to role permissions:
      // - Subject teacher: only notes they authored OR notes for students in their assigned classes
      // - Class teacher: only notes for students in their assigned class
      // - Principal/Office: school-wide notes
      let permittedNotes = allIncidents;
      if (isSubjectTeacher) {
        const studentIdSet = new Set(uniqueStudents.map(s => s.id));
        permittedNotes = allIncidents.filter(
          i =>
            (currentUser?.id && i.loggedByStaffId === currentUser.id) ||
            (currentUser?.name && (i.loggedByStaffName || '').toLowerCase().includes(currentUser.name.toLowerCase())) ||
            studentIdSet.has(i.studentId)
        );
      } else if (isClassTeacher && currentUser?.assignedClassId) {
        const studentIdSet = new Set(uniqueStudents.map(s => s.id));
        permittedNotes = allIncidents.filter(i => studentIdSet.has(i.studentId));
      }

      setIncidents(permittedNotes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load student notes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotesAndStudents();
  }, [provider, currentUser, assignedClassIds, isClassTeacher, isSubjectTeacher]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inc.studentName.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q);

      const matchesCat = categoryFilter === 'all' || inc.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [incidents, searchQuery, categoryFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = incidents.length;
    const commendations = incidents.filter(i => i.severity === 'commendation').length;
    const notices = incidents.filter(i => i.severity === 'notice' || i.severity === 'disciplinary').length;

    return { total, commendations, notices };
  }, [incidents]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Date Logged',
      'Student Name',
      'Class',
      'Note Type',
      'Feedback Type',
      'Summary / Title',
      'Note Details',
      'Action Taken',
      'Logged By',
    ];

    const rows = filteredIncidents.map(i => [
      i.date,
      `"${i.studentName}"`,
      i.classId,
      i.category,
      i.severity,
      `"${i.title.replace(/"/g, '""')}"`,
      `"${i.description.replace(/"/g, '""')}"`,
      `"${(i.actionTaken || '').replace(/"/g, '""')}"`,
      `"${i.loggedByStaffName || i.loggedByName || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Student_Notes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'commendation':
      case 'academic_excellence':
        return 'Commendation';
      case 'academic_integrity':
        return 'Academic';
      case 'conduct_discipline':
        return 'Conduct';
      case 'punctuality':
      case 'punctuality_attendance':
        return 'Punctuality';
      case 'sports_arts':
        return 'Co-Curricular';
      default:
        return 'General';
    }
  };

  return (
    <div className="hhs-page-container">
      <PageHeader
        title="Student Notes"
        subtitle={
          isSubjectTeacher
            ? 'Notes and observations for students in your assigned classes.'
            : isClassTeacher
            ? 'Pastoral notes and observations for students in your class.'
            : 'School-wide student notes and observations.'
        }
        roleScope={isSubjectTeacher ? 'Teaching Notes' : isClassTeacher ? 'Class Notes' : 'Student Notes'}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Student Notes' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsModalOpen(true)}
              className="hhs-btn hhs-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              <span>Add Note</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="hhs-btn hhs-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* 3 Calm Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="hhs-metric-card primary">
          <div className="hhs-metric-label">Total Notes</div>
          <div className="hhs-metric-value">{stats.total}</div>
          <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
            Session 2025–2026
          </div>
        </div>

        <div className="hhs-metric-card success">
          <div className="hhs-metric-label">Positive Progress</div>
          <div className="hhs-metric-value">{stats.commendations}</div>
          <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
            Academic merit & positive contributions
          </div>
        </div>

        <div className="hhs-metric-card accent">
          <div className="hhs-metric-label">Observations & Follow-Up</div>
          <div className="hhs-metric-value">{stats.notices}</div>
          <div className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)', marginTop: '4px' }}>
            Support notes & tutor follow-up
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="hhs-card"
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--hhs-text-muted)' }}
          />
          <input
            type="text"
            className="hhs-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by student name or note title..."
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="hhs-label" style={{ margin: 0 }}>
            Note Type:
          </label>
          <select
            className="hhs-select"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '160px' }}
          >
            <option value="all">All Note Types</option>
            <option value="commendation">Commendations</option>
            <option value="academic_integrity">Academic Progress</option>
            <option value="conduct_discipline">Conduct</option>
            <option value="punctuality">Attendance & Punctuality</option>
          </select>
        </div>
      </div>

      {/* Notes Table */}
      {isLoading ? (
        <LoadingState message="Loading student notes..." />
      ) : (
        <div className="hhs-card">
          <div className="hhs-table-container">
            <table className="hhs-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Date</th>
                  <th style={{ minWidth: '150px' }}>Student</th>
                  <th style={{ width: '130px' }}>Type</th>
                  <th style={{ minWidth: '180px' }}>Subject / Note</th>
                  <th style={{ minWidth: '180px' }}>Action Taken</th>
                  <th style={{ width: '130px' }}>Logged By</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--hhs-text-secondary)' }}>
                      No student notes found matching this view.
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map(i => {
                    const isPositive = i.severity === 'commendation';
                    return (
                      <tr key={i.id}>
                        <td style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)', whiteSpace: 'nowrap' }}>
                          {i.date}
                        </td>
                        <td>
                          <button
                            onClick={() => navigate(`/students/${i.studentId}`)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              font: 'inherit',
                              fontWeight: 600,
                              color: 'var(--hhs-text-primary)',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {i.studentName}
                          </button>
                        </td>
                        <td>
                          <span className={`hhs-badge ${isPositive ? 'hhs-badge-success' : 'hhs-badge-accent'}`}>
                            {getCategoryLabel(i.category)}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{i.title}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--hhs-text-secondary)', marginTop: '2px' }}>
                            {i.description}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--hhs-text-secondary)' }}>
                          {i.actionTaken || 'None specified'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--hhs-text-secondary)', whiteSpace: 'nowrap' }}>
                          {i.loggedByStaffName || i.loggedByName || 'Staff Member'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => navigate(`/students/${i.studentId}`)}
                            className="hhs-btn hhs-btn-secondary hhs-btn-sm"
                            style={{ padding: '0 8px', fontSize: '0.74rem' }}
                            title="Open Student Profile"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <NewObservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        students={students}
        onIncidentCreated={fetchNotesAndStudents}
      />
    </div>
  );
};
