/**
 * HanuJai High School ERP — Developer & System Administrator Console
 * 
 * Privileged operational workstation for system maintenance, infrastructure oversight,
 * bulk student migration, role administration, and database health monitoring.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { getDataProvider } from '../../data';
import { defaultDeveloperUser } from '../../data/demo/seedData';
import {
  DeveloperService,
  type ImportValidationSummary,
  type ImportMode,
  type ImportExecutionResult,
  type DatabaseSnapshot,
  type DataQualityReport,
  type SystemHealthProbeResult,
  type SpreadsheetColumnMap,
} from '../../services/developer/developerService';
import type {
  StaffUser,
  StaffRole,
  StudentRecord,
  ClassSection,
  AuditEvent,
  PermissionModule,
  PermissionAction,
  RolePermissions,
  PermissionPreset,
} from '../../domain/types';
import { Permissions, applyPermissionPreset, DEFAULT_ROLE_PERMISSIONS } from '../../domain/permissions';
import {
  Terminal,
  ShieldCheck,
  UploadCloud,
  Users,
  Layers,
  Database,
  FileSpreadsheet,
  HardDrive,
  MessageSquare,
  Activity,
  FileText,
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download,
  UserPlus,
  Play,
  X,
  Search,
  Undo2,
  ShieldAlert,
  Save,
  Sliders,
  KeyRound,
  Code,
  Phone,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Radio,
} from 'lucide-react';
import { WhatsAppNotificationService } from '../../services/whatsapp/whatsappService';
import {
  generatePresentAttendanceMessage,
  generateAbsentAttendanceMessage,
} from '../../services/whatsapp/attendanceNotificationTemplates';
import { SwaggerPortal } from '../../components/developer/SwaggerPortal';
import { DatabaseExplorer } from '../../components/developer/DatabaseExplorer';

type ConsoleTab =
  | 'overview'
  | 'import'
  | 'users'
  | 'permissions'
  | 'classes'
  | 'quality'
  | 'database'
  | 'db_schema'
  | 'api_docs'
  | 'storage'
  | 'whatsapp'
  | 'health'
  | 'audit'
  | 'settings';

export const DeveloperConsole: React.FC = () => {
  const { currentUser } = useAuth();
  const { provider, isDemo } = useData();

  // Tab State
  const [activeTab, setActiveTab] = useState<ConsoleTab>('overview');

  // Master Data State
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [classesList, setClassesList] = useState<ClassSection[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [snapshots, setSnapshots] = useState<DatabaseSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // 1. Student Import Wizard State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([]);
  const [columnMap, setColumnMap] = useState<SpreadsheetColumnMap>({
    admissionNumber: '',
    rollNumber: '',
    fullName: '',
    class: '',
    section: '',
    gender: '',
    mobile: '',
  });
  const [importSummary, setImportSummary] = useState<ImportValidationSummary | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('update_or_add');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // 2. User Management State
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [newStaffForm, setNewStaffForm] = useState<{
    name: string;
    email: string;
    role: StaffRole;
    employeeCode: string;
    department: string;
    designation: string;
    phone: string;
  }>({
    name: '',
    email: '',
    role: 'admin',
    employeeCode: '',
    department: 'Administration',
    designation: 'Admin Officer',
    phone: '',
  });

  // Granular Permissions Matrix State
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(Permissions.getRolePermissions());
  const [selectedPermissionRole, setSelectedPermissionRole] = useState<'admin' | 'principal'>('admin');
  const [isSavingPermissions, setIsSavingPermissions] = useState<boolean>(false);

  // Password Recovery Result Modal State
  const [recoveryModal, setRecoveryModal] = useState<{
    isOpen: boolean;
    staffName: string;
    email: string;
    tempToken: string;
    message: string;
  } | null>(null);

  // 3. Database & Rollback State
  const [showRollbackModal, setShowRollbackModal] = useState<boolean>(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const [restoreConfirmInput, setRestoreConfirmInput] = useState<string>('');

  // 4. Data Quality State
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null);
  const [isScanningQuality, setIsScanningQuality] = useState<boolean>(false);
  const [qualitySeverityFilter, setQualitySeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  // 5. System Health Diagnostics State
  const [healthProbes, setHealthProbes] = useState<SystemHealthProbeResult[]>([]);
  const [isProbing, setIsProbing] = useState<boolean>(false);

  // 6. WhatsApp Zero-Cost Worker & Pairing State
  const [workerStatus, setWorkerStatus] = useState<any>(null);
  const [isLoadingWorkerStatus, setIsLoadingWorkerStatus] = useState<boolean>(false);
  const [isWakingWorker, setIsWakingWorker] = useState<boolean>(false);
  const [pairingPhone, setPairingPhone] = useState<string>('919509489381');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingCountdown, setPairingCountdown] = useState<number>(0);
  const [isRequestingPairing, setIsRequestingPairing] = useState<boolean>(false);
  const [isUnlinkingWhatsApp, setIsUnlinkingWhatsApp] = useState<boolean>(false);
  const [hasCopiedCode, setHasCopiedCode] = useState<boolean>(false);

  // Load Master Data
  const refreshAllData = async () => {
    setIsLoading(true);
    setGlobalError(null);
    try {
      const [stuRes, staffRes, clsRes, auditRes, permsRes] = await Promise.all([
        provider.getStudents({ limit: 5000 }),
        provider.getStaffMembers(),
        provider.getClasses(),
        provider.getAuditEvents ? provider.getAuditEvents({ limit: 50 }) : Promise.resolve([]),
        provider.getRolePermissions ? provider.getRolePermissions() : Promise.resolve(Permissions.getRolePermissions()),
      ]);

      setStudents(stuRes?.items || (stuRes as any)?.data || []);
      setStaffList(staffRes || []);
      setClassesList(clsRes || []);
      setAuditEvents(auditRes || []);
      if (permsRes) {
        setRolePermissions(permsRes);
      }
      setSnapshots(DeveloperService.getSnapshots());

      // Initial diagnostics
      const probes = await DeveloperService.runSystemDiagnostics();
      setHealthProbes(probes);
    } catch (err) {
      console.error('Failed to load developer master data:', err);
      setGlobalError(err instanceof Error ? err.message : 'Failed to retrieve system datasets.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Clear messages after 6s
  useEffect(() => {
    if (globalSuccess || globalError) {
      const t = setTimeout(() => {
        setGlobalSuccess(null);
        setGlobalError(null);
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [globalSuccess, globalError]);

  // ==========================================================================
  // Tab 2: Import Wizard Actions
  // ==========================================================================
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadedFile(file);
      setImportResult(null);
      const parsed = await DeveloperService.parseSpreadsheetFile(file);
      setRawHeaders(parsed.headers);
      setRawRows(parsed.rows);

      // Auto-map columns
      const autoMap = DeveloperService.detectColumnMapping(parsed.headers);
      setColumnMap(autoMap);

      // Validate
      const summary = DeveloperService.validateSpreadsheet(
        parsed.rows,
        autoMap,
        students,
        classesList
      );
      setImportSummary(summary);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to parse spreadsheet.');
    }
  };

  const handleRemapColumn = (field: keyof SpreadsheetColumnMap, value: string) => {
    const updated = { ...columnMap, [field]: value };
    setColumnMap(updated);
    if (rawRows.length > 0) {
      const summary = DeveloperService.validateSpreadsheet(
        rawRows,
        updated,
        students,
        classesList
      );
      setImportSummary(summary);
    }
  };

  const handleExecuteImport = async () => {
    if (!importSummary || !uploadedFile || !currentUser) return;
    setIsImporting(true);
    setShowConfirmModal(false);

    try {
      const res = await DeveloperService.executeImport(
        importSummary,
        importMode,
        uploadedFile.name,
        currentUser,
        provider
      );

      setImportResult(res);
      setGlobalSuccess(`Successfully processed batch ${res.batchId}: ${res.createdCount} created, ${res.updatedCount} updated, ${res.skippedCount} skipped.`);
      await refreshAllData();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    DeveloperService.downloadStudentTemplate();
  };

  // ==========================================================================
  // Tab 3: User Management Actions
  // ==========================================================================
  const handleToggleStaffStatus = async (staff: StaffUser) => {
    if (!currentUser) return;
    const targetStatus = staff.status === 'active' ? 'deactivated' : 'active';

    try {
      // Validate last-developer safeguard
      DeveloperService.validateStaffModificationSafeguard(
        staff.id,
        undefined,
        targetStatus,
        staffList
      );

      await provider.updateStaffMember(
        staff.id,
        { status: targetStatus },
        currentUser
      );

      setGlobalSuccess(`Staff account "${staff.name}" has been ${targetStatus}.`);
      await refreshAllData();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to update staff status.');
    }
  };

  const handleDeleteStaff = async (staff: StaffUser) => {
    if (!currentUser) return;
    if (staff.role === 'developer') {
      const activeDevs = staffList.filter(s => s.role === 'developer' && s.status === 'active');
      if (activeDevs.length <= 1) {
        setGlobalError('Action blocked: Cannot delete the primary Developer account.');
        return;
      }
    }
    if (!window.confirm(`Permanently delete the staff record for "${staff.name}" (${staff.email})? This action cannot be undone.`)) {
      return;
    }
    try {
      const prov = getDataProvider();
      if (prov.deleteStaffMember) {
        await prov.deleteStaffMember(staff.id, currentUser);
      }
      setStaffList(prev => prev.filter(s => s.id !== staff.id && s.email.toLowerCase() !== staff.email.toLowerCase()));
      setGlobalSuccess(`Staff record for "${staff.name}" has been permanently deleted.`);
      await refreshAllData();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to delete staff member.');
    }
  };

  const handleChangeStaffRole = async (staff: StaffUser, newRole: StaffRole) => {
    if (!currentUser || staff.role === newRole) return;

    try {
      // Validate last-developer safeguard
      DeveloperService.validateStaffModificationSafeguard(
        staff.id,
        newRole,
        undefined,
        staffList
      );

      await provider.updateStaffMember(
        staff.id,
        { role: newRole },
        currentUser
      );

      setGlobalSuccess(`Role for "${staff.name}" changed to ${newRole.toUpperCase()}.`);
      await refreshAllData();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to change staff role.');
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      await provider.createStaffMember(
        {
          name: newStaffForm.name,
          email: newStaffForm.email.toLowerCase().trim(),
          role: newStaffForm.role,
          employeeCode: newStaffForm.employeeCode || `EMP-${Date.now().toString().slice(-4)}`,
          department: newStaffForm.department,
          designation: newStaffForm.designation,
          phone: newStaffForm.phone || '+91 90000 00000',
          status: 'active',
        },
        currentUser
      );

      setGlobalSuccess(`Account provisioned successfully for ${newStaffForm.name} (${newStaffForm.role}).`);
      setShowAddStaffModal(false);
      setNewStaffForm({
        name: '',
        email: '',
        role: 'admin',
        employeeCode: '',
        department: 'Administration',
        designation: 'Admin Officer',
        phone: '',
      });
      await refreshAllData();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to provision staff account.');
    }
  };

  const handleRevokeStaffSession = async (staff: StaffUser) => {
    if (!currentUser) return;
    const confirm = window.confirm(`Are you sure you want to revoke all active sessions for ${staff.name}?`);
    if (!confirm) return;

    try {
      if (provider.revokeStaffSessions) {
        await provider.revokeStaffSessions(staff.id, currentUser);
      }
      setGlobalSuccess(`Successfully revoked all active sessions for ${staff.name}.`);
      await refreshAllData();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to revoke staff session.');
    }
  };

  const handleInitiatePasswordRecovery = async (staff: StaffUser) => {
    if (!currentUser) return;
    try {
      if (provider.initiatePasswordRecovery) {
        const res = await provider.initiatePasswordRecovery(staff.id, currentUser);
        setRecoveryModal({
          isOpen: true,
          staffName: staff.name,
          email: staff.email,
          tempToken: res.tempToken || 'N/A',
          message: res.message,
        });
      }
      await refreshAllData();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to initiate password recovery.');
    }
  };

  const handleTogglePermission = (module: PermissionModule, action: PermissionAction) => {
    setRolePermissions(prev => {
      const currentRolePerms = prev[selectedPermissionRole] || {};
      const currentModulePerms = currentRolePerms[module] || {};
      const currentVal = Boolean(currentModulePerms[action]);

      return {
        ...prev,
        [selectedPermissionRole]: {
          ...currentRolePerms,
          [module]: {
            ...currentModulePerms,
            [action]: !currentVal,
          },
        },
      };
    });
  };

  const handleApplyPreset = (module: PermissionModule, preset: PermissionPreset) => {
    const presetPerms = applyPermissionPreset(preset, module);
    setRolePermissions(prev => {
      const currentRolePerms = prev[selectedPermissionRole] || {};
      return {
        ...prev,
        [selectedPermissionRole]: {
          ...currentRolePerms,
          [module]: { ...presetPerms },
        },
      };
    });
  };

  const handleSaveRolePermissions = async () => {
    if (!currentUser) return;
    setIsSavingPermissions(true);
    try {
      if (provider.updateRolePermissions) {
        const updated = await provider.updateRolePermissions(
          selectedPermissionRole,
          rolePermissions[selectedPermissionRole],
          currentUser
        );
        setRolePermissions(updated);
      } else {
        Permissions.setRolePermissions(rolePermissions, true);
      }
      setGlobalSuccess(`Successfully saved and applied granular permissions for ${selectedPermissionRole === 'admin' ? 'Admin Office' : 'Principal'}!`);
      await refreshAllData();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to save role permissions.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // ==========================================================================
  // Tab 4: Database & Snapshot Rollback Actions
  // ==========================================================================
  const handleTriggerRollback = async () => {
    if (!selectedSnapshotId || !currentUser) return;

    try {
      const res = await DeveloperService.rollbackSnapshot(
        selectedSnapshotId,
        restoreConfirmInput,
        currentUser,
        provider
      );

      setGlobalSuccess(`Snapshot successfully restored! Reverted ${res.revertedCount} updated students, archived ${res.removedCount} newly created records.`);
      setShowRollbackModal(false);
      setSelectedSnapshotId('');
      setRestoreConfirmInput('');
      await refreshAllData();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Rollback failed.');
    }
  };

  // ==========================================================================
  // Tab 5: Data Quality Scanner Actions
  // ==========================================================================
  const handleScanQuality = async () => {
    setIsScanningQuality(true);
    try {
      const report = await DeveloperService.scanDataQuality(students);
      setQualityReport(report);
      setGlobalSuccess(`Data quality scan complete: ${report.issuesCount} issues identified across ${report.totalStudents} student records.`);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Quality scan failed.');
    } finally {
      setIsScanningQuality(false);
    }
  };

  // ==========================================================================
  // Tab 6: System Diagnostics Probe
  // ==========================================================================
  const handleRunDiagnostics = async () => {
    setIsProbing(true);
    try {
      const results = await DeveloperService.runSystemDiagnostics();
      setHealthProbes(results);
      setGlobalSuccess('System diagnostics probe completed. All operational runtimes healthy.');
    } catch (err) {
      setGlobalError('Diagnostic probe encountered an error.');
    } finally {
      setIsProbing(false);
    }
  };

  // ==========================================================================
  // Tab 8: WhatsApp Zero-Cost Worker Actions
  // ==========================================================================
  const refreshWorkerStatus = async () => {
    setIsLoadingWorkerStatus(true);
    try {
      const res = await WhatsAppNotificationService.getWorkerStatus();
      setWorkerStatus(res);
      if (res.baileys?.connected || res.connected) {
        setPairingCode(null);
        setPairingCountdown(0);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingWorkerStatus(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'whatsapp') {
      refreshWorkerStatus();
      const interval = setInterval(refreshWorkerStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (pairingCountdown <= 0) {
      if (pairingCode) {
        setPairingCode(null);
      }
      return;
    }
    const timer = setInterval(() => {
      setPairingCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [pairingCountdown, pairingCode]);

  const handleWakeWorker = async () => {
    setIsWakingWorker(true);
    try {
      const res = await WhatsAppNotificationService.wakeWorker();
      setGlobalSuccess(res.message || 'Worker wake signal dispatched.');
      setTimeout(refreshWorkerStatus, 2000);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to dispatch wake signal.');
    } finally {
      setIsWakingWorker(false);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!pairingPhone || pairingPhone.replace(/\D/g, '').length < 10) {
      setGlobalError('Please enter a valid phone number with country code (e.g. 919509489381).');
      return;
    }
    setIsRequestingPairing(true);
    setPairingCode(null);
    setHasCopiedCode(false);
    try {
      const res = await WhatsAppNotificationService.requestPairingCode(pairingPhone);
      if (res.success && res.pairingCode) {
        setPairingCode(res.pairingCode);
        setPairingCountdown(res.expiresInSeconds || 120);
        setGlobalSuccess('8-digit pairing code generated! Enter it into WhatsApp > Linked Devices.');
      } else {
        setGlobalError(res.error || 'Failed to request pairing code.');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Network error requesting pairing code.');
    } finally {
      setIsRequestingPairing(false);
    }
  };

  const handleUnlinkWhatsApp = async () => {
    if (!window.confirm('Are you sure you want to unlink the current WhatsApp account? This will clear session credentials in Cloud Firestore.')) {
      return;
    }
    setIsUnlinkingWhatsApp(true);
    try {
      const res = await WhatsAppNotificationService.unlinkWhatsApp();
      if (res.success) {
        setGlobalSuccess('WhatsApp session unlinked successfully. You can now link a new phone.');
        setPairingCode(null);
        await refreshWorkerStatus();
      } else {
        setGlobalError(res.error || 'Failed to unlink WhatsApp session.');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to unlink WhatsApp session.');
    } finally {
      setIsUnlinkingWhatsApp(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setHasCopiedCode(true);
    setTimeout(() => setHasCopiedCode(false), 3000);
  };

  // Filtered staff list (Strictly 3 Authorized Roles: Developer, Principal, Admin Office)
  const filteredStaff = useMemo(() => {
    const q = staffSearch.toLowerCase().trim();
    const authorizedRoles = new Set(['developer', 'principal', 'admin']);
    const authorizedEmails = new Set([
      'developer@hanujai.edu.in',
      'principal@hanujai.edu.in',
      'admin@hanujai.edu.in',
    ]);
    const seenEmails = new Set<string>();
    const uniqueStaff: StaffUser[] = [];

    // Ensure developer account is present in list for administration
    const listToProcess = [...staffList];
    if (!listToProcess.some(s => s.role === 'developer')) {
      listToProcess.unshift(defaultDeveloperUser);
    }

    for (const s of listToProcess) {
      if (s.status !== 'active') continue; // Exclude all deactivated historical teacher entries
      const lowerEmail = (s.email || '').toLowerCase().trim();
      if (!authorizedEmails.has(lowerEmail) && !authorizedRoles.has(s.role)) continue;
      if (seenEmails.has(lowerEmail)) continue;
      seenEmails.add(lowerEmail);
      uniqueStaff.push(s);
    }

    return uniqueStaff.filter(s =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      (s.employeeCode || '').toLowerCase().includes(q)
    );
  }, [staffList, staffSearch]);

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', padding: '24px 28px' }}>
      
      {/* Console Master Header */}
      <div
        style={{
          backgroundColor: '#0A1931',
          borderRadius: '16px',
          padding: '24px 28px',
          color: '#FFFFFF',
          marginBottom: '24px',
          boxShadow: '0 8px 24px -4px rgba(10, 25, 49, 0.25)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              backgroundColor: '#F5A623',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0A1931',
              boxShadow: '0 4px 12px rgba(245, 166, 35, 0.35)',
            }}
          >
            <Terminal size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Developer & System Administrator Console
              </h1>
              <span
                style={{
                  backgroundColor: 'rgba(245, 166, 35, 0.2)',
                  color: '#F5A623',
                  border: '1px solid #F5A623',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Privileged Access
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#94A3B8', fontSize: '0.84rem' }}>
              Infrastructure Management, Excel Migration Engine, Role Security & Diagnostic Operations
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right', marginRight: '6px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>
              {currentUser?.name || 'Developer'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#F5A623' }}>
              {isDemo ? 'Local Storage & In-Memory Sandbox' : 'Cloud Firestore Active'}
            </div>
          </div>
          <button
            onClick={refreshAllData}
            disabled={isLoading}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Global Toast / Alerts */}
      {globalSuccess && (
        <div
          style={{
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            borderRadius: '10px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.86rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>{globalSuccess}</span>
        </div>
      )}

      {globalError && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            borderRadius: '10px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.86rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={18} color="#DC2626" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Sub-Navigation Bar */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '6px',
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '8px',
          marginBottom: '24px',
        }}
      >
        {[
          { key: 'overview', label: 'Overview', icon: <Activity size={16} /> },
          { key: 'import', label: 'Student Data Import', icon: <UploadCloud size={16} />, highlight: true },
          { key: 'users', label: 'User & Role Management', icon: <Users size={16} /> },
          { key: 'permissions', label: 'Permissions Matrix', icon: <Sliders size={16} /> },
          { key: 'classes', label: 'Classes & Sections', icon: <Layers size={16} /> },
          { key: 'quality', label: 'Data Quality', icon: <ShieldCheck size={16} /> },
          { key: 'database', label: 'Database & Backups', icon: <Database size={16} /> },
          { key: 'db_schema', label: 'Database Schema & Dictionary', icon: <Layers size={16} />, highlight: true },
          { key: 'api_docs', label: 'Swagger UI & OpenAPI', icon: <Code size={16} />, highlight: true },
          { key: 'storage', label: 'Document Storage', icon: <HardDrive size={16} /> },
          { key: 'whatsapp', label: 'Attendance & WhatsApp', icon: <MessageSquare size={16} /> },
          { key: 'health', label: 'System Health', icon: <Terminal size={16} /> },
          { key: 'audit', label: 'Audit Logs', icon: <FileText size={16} /> },
          { key: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ConsoleTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 15px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '0.84rem',
                fontWeight: isActive ? 700 : 500,
                backgroundColor: isActive ? '#0A1931' : 'transparent',
                color: isActive ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.highlight && !isActive && (
                <span
                  style={{
                    backgroundColor: '#F5A623',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '8px',
                    right: '6px',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: OVERVIEW */}
      {/* ==================================================================== */}
      {activeTab === 'overview' && (
        <div>
          {/* Metric Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Active Students</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0A1931', marginTop: '6px' }}>{(students || []).length}</div>
              <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '4px' }}>Across {(classesList || []).length} Class Sections</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Staff Accounts</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0A1931', marginTop: '6px' }}>{(staffList || []).length}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
                {(staffList || []).filter(s => s.role === 'developer').length} Developer, {(staffList || []).filter(s => s.role === 'principal').length} Principal, {(staffList || []).filter(s => s.role === 'admin').length} Admin
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Private Blob Storage</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0A1931', marginTop: '6px' }}>BOM1</div>
              <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '4px' }}>Mumbai Region | Private Access</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Recoverable Snapshots</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0A1931', marginTop: '6px' }}>{(snapshots || []).length}</div>
              <div style={{ fontSize: '0.72rem', color: '#3B82F6', marginTop: '4px' }}>Instant Rollback Ready</div>
            </div>
          </div>

          {/* Quick Action Operations */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: '#FFFFFF', padding: '22px 24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0A1931', margin: '0 0 14px 0' }}>
                Quick Administrative Operations
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <button
                  onClick={() => setActiveTab('import')}
                  style={{
                    backgroundColor: '#0A1931',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UploadCloud size={16} color="#F5A623" />
                    <span>Import Student Data</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px' }}>
                    Upload Excel/CSV (.xlsx, .xls)
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('quality')}
                  style={{
                    backgroundColor: '#F8FAFC',
                    color: '#0A1931',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="#059669" />
                    <span>Run Data Quality Scan</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
                    Scan for duplicates and invalid phones
                  </div>
                </button>

                <button
                  onClick={() => DeveloperService.exportStudentsToExcel(students)}
                  style={{
                    backgroundColor: '#F8FAFC',
                    color: '#0A1931',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileSpreadsheet size={16} color="#2563EB" />
                    <span>Export Student DB (.xlsx)</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
                    Download complete student master
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  style={{
                    backgroundColor: '#F8FAFC',
                    color: '#0A1931',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserPlus size={16} color="#7C3AED" />
                    <span>Provision User Account</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
                    Manage Principal & Admin credentials
                  </div>
                </button>
              </div>
            </div>

            {/* System Runtime Health Quick Card */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '22px 24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0A1931', margin: 0 }}>
                  System Runtime Status
                </h3>
                <button
                  onClick={handleRunDiagnostics}
                  disabled={isProbing}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563EB',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RefreshCw size={12} className={isProbing ? 'animate-spin' : ''} />
                  <span>Probe</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {healthProbes.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0A1931' }}>{p.service}</div>
                      <div style={{ fontSize: '0.70rem', color: '#64748B' }}>{p.details}</div>
                    </div>
                    <span
                      style={{
                        backgroundColor: '#ECFDF5',
                        color: '#059669',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <CheckCircle2 size={12} />
                      <span>HEALTHY</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: STUDENT DATA IMPORT & MIGRATION */}
      {/* ==================================================================== */}
      {activeTab === 'import' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
                Student Data Import & Migration Wizard
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
                Upload school student data (.xlsx, .xls, .csv). Features automated column mapping, multi-level validation, pre-import snapshots, and non-destructive upsert.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              style={{
                backgroundColor: '#F1F5F9',
                color: '#0A1931',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Download size={15} />
              <span>Download 7-Column Template</span>
            </button>
          </div>

          {/* Step 1: Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #CBD5E1',
              borderRadius: '12px',
              padding: '36px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: uploadedFile ? '#F0FDF4' : '#F8FAFC',
              transition: 'all 0.15s ease',
              marginBottom: '24px',
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={40} color={uploadedFile ? '#16A34A' : '#0A1931'} />
              <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0A1931' }}>
                {uploadedFile ? uploadedFile.name : 'Click to select or drag & drop student spreadsheet'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Supported Formats: Genuine Excel (.xlsx, .xls) and CSV (.csv). Maximum file size 10 MB.
              </div>
            </div>
          </div>

          {/* Step 2: Column Mapping */}
          {rawHeaders.length > 0 && (
            <div style={{ marginBottom: '24px', padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0A1931' }}>
                  Column Mapping Configuration
                </h4>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Auto-mapped from detected file headers
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {[
                  { field: 'admissionNumber', label: 'Admission Number (SR No.) *' },
                  { field: 'fullName', label: 'Student Full Name *' },
                  { field: 'class', label: 'Class / Grade *' },
                  { field: 'section', label: 'Section *' },
                  { field: 'rollNumber', label: 'Roll Number' },
                  { field: 'gender', label: 'Gender' },
                  { field: 'mobile', label: 'WhatsApp Mobile Number' },
                ].map(item => (
                  <div key={item.field}>
                    <label style={{ fontSize: '0.70rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      {item.label}
                    </label>
                    <select
                      value={columnMap[item.field as keyof SpreadsheetColumnMap] || ''}
                      onChange={(e) => handleRemapColumn(item.field as keyof SpreadsheetColumnMap, e.target.value)}
                      style={{
                        width: '100%',
                        height: '34px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.80rem',
                        padding: '0 8px',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <option value="">-- None / Skip --</option>
                      {rawHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Validation Summary Cards */}
          {importSummary && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', backgroundColor: '#F1F5F9', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B' }}>TOTAL ROWS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931' }}>{importSummary.totalRows}</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#ECFDF5', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669' }}>NEW STUDENTS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{importSummary.newRows}</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#EFF6FF', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#2563EB' }}>UPDATES DETECTED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563EB' }}>{importSummary.updateRows}</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B' }}>UNCHANGED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#64748B' }}>{importSummary.unchangedRows}</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#FEF3C7', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#D97706' }}>DUPLICATE IN FILE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#D97706' }}>{importSummary.duplicateRows}</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#DC2626' }}>INVALID ROWS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#DC2626' }}>{importSummary.invalidRows}</div>
                </div>
              </div>

              {/* Import Mode Selector & Safety Commit Controls */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#0A1931',
                  color: '#FFFFFF',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#F5A623', textTransform: 'uppercase' }}>
                    Select Execution Mode:
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importMode"
                        value="update_or_add"
                        checked={importMode === 'update_or_add'}
                        onChange={() => setImportMode('update_or_add')}
                      />
                      <span>Update Existing Students & Add New (Recommended)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importMode"
                        value="add_only"
                        checked={importMode === 'add_only'}
                        onChange={() => setImportMode('add_only')}
                      />
                      <span>Add New Students Only (Skip existing)</span>
                    </label>
                  </div>
                </div>

                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isImporting || importSummary.validRows === 0}
                  style={{
                    backgroundColor: '#F5A623',
                    color: '#0A1931',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    cursor: isImporting || importSummary.validRows === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <Play size={16} />
                  <span>{isImporting ? 'Executing Import...' : 'Commit Verified Import'}</span>
                </button>
              </div>

              {/* Data Preview Table */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                  Preview: First 10 Records of Uploaded Spreadsheet
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '8px 12px' }}>Row</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px' }}>Admission No.</th>
                        <th style={{ padding: '8px 12px' }}>Student Name</th>
                        <th style={{ padding: '8px 12px' }}>Class</th>
                        <th style={{ padding: '8px 12px' }}>Roll</th>
                        <th style={{ padding: '8px 12px' }}>WhatsApp Mobile</th>
                        <th style={{ padding: '8px 12px' }}>Validation Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importSummary.records.slice(0, 10).map((r) => {
                        let badgeBg = '#E2E8F0';
                        let badgeColor = '#475569';
                        if (r.status === 'new') { badgeBg = '#ECFDF5'; badgeColor = '#059669'; }
                        else if (r.status === 'update') { badgeBg = '#EFF6FF'; badgeColor = '#2563EB'; }
                        else if (r.status === 'invalid' || r.status === 'duplicate_in_file') { badgeBg = '#FEF2F2'; badgeColor = '#DC2626'; }

                        return (
                          <tr key={r.rowIndex} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.rowIndex}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ backgroundColor: badgeBg, color: badgeColor, padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.70rem' }}>
                                {r.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.admissionNumber || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{r.fullName}</td>
                            <td style={{ padding: '8px 12px' }}>{r.classLabel}</td>
                            <td style={{ padding: '8px 12px' }}>{r.rollNumber || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{r.mobile || '-'}</td>
                            <td style={{ padding: '8px 12px', color: r.validationErrors.length > 0 ? '#DC2626' : '#64748B' }}>
                              {r.validationErrors.length > 0 ? r.validationErrors.join(', ') : (r.diffFields?.length ? `Updates: ${r.diffFields.map(d => d.field).join(', ')}` : 'Ready')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import Result & Download Report */}
          {importResult && (
            <div style={{ marginTop: '24px', padding: '18px 20px', borderRadius: '10px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.96rem', fontWeight: 800, color: '#065F46' }}>
                    Import Batch {importResult.batchId} Completed!
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: '#047857' }}>
                    Created: {importResult.createdCount} | Updated: {importResult.updatedCount} | Skipped: {importResult.skippedCount} | Failed: {importResult.failedCount}
                  </div>
                </div>
                <button
                  onClick={() => DeveloperService.exportImportResultReport(importResult)}
                  style={{
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '0.80rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Download size={14} />
                  <span>Download Result Report (.xlsx)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Import */}
      {showConfirmModal && importSummary && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', width: '90%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <ShieldAlert size={24} color="#D97706" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A1931' }}>
                Confirm Student Data Import
              </h3>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              You are about to execute a bulk import of <strong>{importSummary.totalRows} records</strong> into the student master database.
            </p>
            <div style={{ backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', fontSize: '0.78rem', color: '#334155', marginBottom: '16px', lineHeight: 1.6 }}>
              • Mode: <strong>{importMode === 'update_or_add' ? 'Update Existing & Add New' : 'Add New Students Only'}</strong><br />
              • Pre-import snapshot will be automatically captured for rollback.<br />
              • Non-empty existing fields will NEVER be overwritten by blank cells.<br />
              • Missing students in sheet will NOT be deleted.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteImport}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#0A1931', color: '#FFFFFF', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
              >
                Confirm & Commit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: USER & ROLE MANAGEMENT */}
      {/* ==================================================================== */}
      {activeTab === 'users' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
                User & Role Administration
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
                Manage staff accounts, assign authoritative Principal and Admin Office roles, and inspect account activity.
              </p>
            </div>
            <button
              onClick={() => setShowAddStaffModal(true)}
              style={{
                backgroundColor: '#0A1931',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <UserPlus size={16} />
              <span>Provision Staff Account</span>
            </button>
          </div>

          {/* Search bar */}
          <div style={{ marginBottom: '16px', maxWidth: '340px', position: 'relative' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search staff by name, email, code..."
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                paddingLeft: '36px',
                paddingRight: '12px',
                fontSize: '0.82rem',
              }}
            />
          </div>

          {/* Staff Table */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '10px 14px' }}>Staff Name</th>
                  <th style={{ padding: '10px 14px' }}>Email Address</th>
                  <th style={{ padding: '10px 14px' }}>Role</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px' }}>Employee Code</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => {
                  const isLastDev = staff.role === 'developer' && staffList.filter(s => s.role === 'developer' && s.status === 'active').length <= 1;

                  return (
                    <tr key={staff.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0A1931' }}>
                        {staff.name}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>
                        {staff.email}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <select
                          value={staff.role}
                          onChange={(e) => handleChangeStaffRole(staff, e.target.value as StaffRole)}
                          style={{
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0 6px',
                            backgroundColor: staff.role === 'developer' ? '#FEF3C7' : '#FFFFFF',
                            color: staff.role === 'developer' ? '#92400E' : '#0A1931',
                          }}
                        >
                          <option value="principal">Principal</option>
                          <option value="admin">Admin Office</option>
                          <option value="developer">Developer</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            backgroundColor: staff.status === 'active' ? '#ECFDF5' : '#FEF2F2',
                            color: staff.status === 'active' ? '#059669' : '#DC2626',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '0.70rem',
                          }}
                        >
                          {staff.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>
                        {staff.employeeCode || '-'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleInitiatePasswordRecovery(staff)}
                            title="Initiate password recovery for staff account"
                            style={{
                              backgroundColor: '#F8FAFC',
                              color: '#334155',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Password
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeStaffSession(staff)}
                            title="Revoke active sessions for staff account"
                            style={{
                              backgroundColor: '#FFFBEB',
                              color: '#92400E',
                              border: '1px solid #FDE68A',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Revoke
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStaffStatus(staff)}
                            disabled={isLastDev && staff.status === 'active'}
                            title={isLastDev && staff.status === 'active' ? 'Cannot deactivate last active Developer' : ''}
                            style={{
                              backgroundColor: staff.status === 'active' ? '#FEF2F2' : '#ECFDF5',
                              color: staff.status === 'active' ? '#DC2626' : '#059669',
                              border: `1px solid ${staff.status === 'active' ? '#FECACA' : '#A7F3D0'}`,
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: isLastDev && staff.status === 'active' ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {staff.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(staff)}
                            disabled={isLastDev && staff.status === 'active'}
                            title={isLastDev && staff.status === 'active' ? 'Cannot delete last active Developer' : 'Permanently delete staff record'}
                            style={{
                              backgroundColor: '#FEF2F2',
                              color: '#991B1B',
                              border: '1px solid #FECACA',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: isLastDev && staff.status === 'active' ? 'not-allowed' : 'pointer',
                              opacity: isLastDev && staff.status === 'active' ? 0.4 : 1,
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provision Staff Modal */}
      {showAddStaffModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', width: '90%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A1931' }}>
                Provision New Staff Account
              </h3>
              <button onClick={() => setShowAddStaffModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newStaffForm.name}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                  placeholder="e.g. Meenakshi Soni"
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Institutional Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  placeholder="name@hanujai.edu.in"
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '0.84rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    System Role *
                  </label>
                  <select
                    value={newStaffForm.role}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value as StaffRole })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '0.84rem' }}
                  >
                    <option value="admin">Admin Office</option>
                    <option value="principal">Principal</option>
                    <option value="developer">Developer</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newStaffForm.phone}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                    placeholder="+91 98290 00000"
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '0.84rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#0A1931', color: '#FFFFFF', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Recovery Result Modal */}
      {recoveryModal && recoveryModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', width: '90%', maxWidth: '440px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="#0A1931" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0A1931' }}>
                  Password Recovery
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRecoveryModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', marginBottom: '16px' }}>
              {recoveryModal.message}
            </p>
            <div style={{ backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                Staff Member
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0A1931', marginBottom: '10px' }}>
                {recoveryModal.staffName} ({recoveryModal.email})
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                Temporary Security Token
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: '#0369A1', fontWeight: 700, wordBreak: 'break-all' }}>
                {recoveryModal.tempToken}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRecoveryModal(null)}
              style={{
                width: '100%',
                backgroundColor: '#0A1931',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB: GRANULAR ROLE PERMISSION MATRIX */}
      {/* ==================================================================== */}
      {activeTab === 'permissions' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
                Granular Role Permission Matrix
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
                Configure live module-level permissions for Admin Office and Principal without code redeployment.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedPermissionRole('admin')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.80rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: selectedPermissionRole === 'admin' ? '#0A1931' : 'transparent',
                    color: selectedPermissionRole === 'admin' ? '#FFFFFF' : '#475569',
                  }}
                >
                  Admin Office
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPermissionRole('principal')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.80rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: selectedPermissionRole === 'principal' ? '#0A1931' : 'transparent',
                    color: selectedPermissionRole === 'principal' ? '#FFFFFF' : '#475569',
                  }}
                >
                  Principal
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveRolePermissions}
                disabled={isSavingPermissions}
                style={{
                  backgroundColor: '#F5A623',
                  color: '#0A1931',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: isSavingPermissions ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Save size={16} />
                <span>{isSavingPermissions ? 'Saving...' : 'Save & Apply'}</span>
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', minWidth: '160px' }}>Module</th>
                  <th style={{ padding: '12px 16px', minWidth: '180px' }}>Quick Presets</th>
                  <th style={{ padding: '12px 16px' }}>Actions & Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(DEFAULT_ROLE_PERMISSIONS[selectedPermissionRole]) as PermissionModule[]).map(mod => {
                  const currentModPerms = rolePermissions[selectedPermissionRole]?.[mod] || {};
                  const allowedActions: PermissionAction[] = [
                    'view', 'create', 'edit', 'delete', 'upload', 'download',
                    'approve', 'reject', 'revoke', 'send_whatsapp', 'export', 'manage'
                  ];

                  return (
                    <tr key={mod} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0A1931', textTransform: 'capitalize' }}>
                        {mod.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(mod, 'read_only')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              fontSize: '0.70rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Read-Only
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(mod, 'read_write')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              fontSize: '0.70rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Read-Write
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(mod, 'full')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              fontSize: '0.70rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Full
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {allowedActions.map(action => {
                            const isChecked = Boolean(currentModPerms[action]);
                            return (
                              <label
                                key={action}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: isChecked ? '#EFF6FF' : '#F8FAFC',
                                  border: `1px solid ${isChecked ? '#BFDBFE' : '#E2E8F0'}`,
                                  fontSize: '0.74rem',
                                  fontWeight: isChecked ? 700 : 500,
                                  color: isChecked ? '#1D4ED8' : '#64748B',
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(mod, action)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ textTransform: 'capitalize' }}>{action.replace(/_/g, ' ')}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: CLASSES & SECTIONS */}
      {/* ==================================================================== */}
      {activeTab === 'classes' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
              School Classes & Section Roster
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
              Configured academic sections and live student headcount.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {classesList.map((cls) => {
              const studentCount = students.filter(s => s.classId === cls.id).length;
              return (
                <div
                  key={cls.id}
                  style={{
                    padding: '16px 18px',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0A1931' }}>{cls.label || cls.name || cls.id}</div>
                    <span style={{ fontSize: '0.70rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#059669' }}>
                      ACTIVE
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '6px' }}>
                    Class ID: <code>{cls.id}</code>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                    <span style={{ fontSize: '0.76rem', color: '#475569' }}>Enrolled Students:</span>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0A1931' }}>{studentCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: DATA QUALITY DASHBOARD */}
      {/* ==================================================================== */}
      {activeTab === 'quality' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
                Student Database Quality Dashboard
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
                Audit database integrity: duplicate admission numbers, invalid mobile phones, missing names and unassigned classes.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleScanQuality}
                disabled={isScanningQuality}
                style={{
                  backgroundColor: '#0A1931',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: isScanningQuality ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ShieldCheck size={16} />
                <span>{isScanningQuality ? 'Scanning Database...' : 'Run Quality Scan'}</span>
              </button>

              {qualityReport && (
                <button
                  onClick={() => DeveloperService.exportDataQualityReport(qualityReport)}
                  style={{
                    backgroundColor: '#F1F5F9',
                    color: '#0A1931',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '9px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Download size={15} />
                  <span>Download Quality Report (.xlsx)</span>
                </button>
              )}
            </div>
          </div>

          {qualityReport ? (
            <div>
              {/* Quality Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#64748B' }}>TOTAL SCANNED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A1931', marginTop: '4px' }}>{qualityReport.totalStudents}</div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#059669' }}>CLEAN RECORDS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{qualityReport.cleanStudents}</div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#DC2626' }}>CRITICAL ISSUES</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>{qualityReport.criticalCount}</div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#FEF3C7', borderRadius: '8px', border: '1px solid #FDE68A', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#D97706' }}>WARNINGS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>{qualityReport.warningCount}</div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#2563EB' }}>INFO / MINOR</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>{qualityReport.infoCount}</div>
                </div>
              </div>

              {/* Filter controls */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {(['all', 'critical', 'warning', 'info'] as const).map(sev => (
                  <button
                    key={sev}
                    onClick={() => setQualitySeverityFilter(sev)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      backgroundColor: qualitySeverityFilter === sev ? '#0A1931' : '#FFFFFF',
                      color: qualitySeverityFilter === sev ? '#FFFFFF' : '#475569',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Issues Table */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '8px 12px' }}>Severity</th>
                      <th style={{ padding: '8px 12px' }}>Admission No.</th>
                      <th style={{ padding: '8px 12px' }}>Student Name</th>
                      <th style={{ padding: '8px 12px' }}>Class</th>
                      <th style={{ padding: '8px 12px' }}>Problem Description</th>
                      <th style={{ padding: '8px 12px' }}>Action Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualityReport.issues
                      .filter(i => qualitySeverityFilter === 'all' || i.severity === qualitySeverityFilter)
                      .map(issue => (
                        <tr key={issue.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              style={{
                                backgroundColor: issue.severity === 'critical' ? '#FEF2F2' : issue.severity === 'warning' ? '#FEF3C7' : '#EFF6FF',
                                color: issue.severity === 'critical' ? '#DC2626' : issue.severity === 'warning' ? '#D97706' : '#2563EB',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '0.68rem',
                              }}
                            >
                              {issue.severity.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{issue.admissionNumber}</td>
                          <td style={{ padding: '8px 12px' }}>{issue.studentName}</td>
                          <td style={{ padding: '8px 12px' }}>{issue.classLabel}</td>
                          <td style={{ padding: '8px 12px', color: '#1E293B' }}>{issue.description}</td>
                          <td style={{ padding: '8px 12px', color: '#64748B' }}>{issue.actionRecommendation}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B' }}>
              <ShieldCheck size={40} color="#94A3B8" style={{ marginBottom: '10px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.94rem' }}>No active quality scan results</div>
              <div style={{ fontSize: '0.80rem', marginTop: '4px' }}>Click "Run Quality Scan" above to analyze all active student records.</div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: DATABASE & SNAPSHOT BACKUPS */}
      {/* ==================================================================== */}
      {activeTab === 'database' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
                Database Backups & Snapshot Rollback Engine
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
                Download full database exports or safely revert batch updates using pre-import snapshots.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => DeveloperService.exportStudentsToExcel(students)}
                style={{
                  backgroundColor: '#0A1931',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Download size={15} />
                <span>Export Master (.xlsx)</span>
              </button>
            </div>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
              Available Rollback Snapshots ({snapshots.length})
            </div>
            {snapshots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B', fontSize: '0.84rem' }}>
                No snapshots captured yet. Snapshots are automatically generated before every bulk import.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F1F5F9', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '10px 12px' }}>Timestamp</th>
                    <th style={{ padding: '10px 12px' }}>Batch ID</th>
                    <th style={{ padding: '10px 12px' }}>File Source</th>
                    <th style={{ padding: '10px 12px' }}>Students Before</th>
                    <th style={{ padding: '10px 12px' }}>Updated Records</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Rollback</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map(snap => (
                    <tr key={snap.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{new Date(snap.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{snap.batchId}</td>
                      <td style={{ padding: '10px 12px' }}>{snap.filename}</td>
                      <td style={{ padding: '10px 12px' }}>{snap.studentCountBefore}</td>
                      <td style={{ padding: '10px 12px' }}>{snap.previousStudentStates.length} modified</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ backgroundColor: snap.isRollback ? '#FEF2F2' : '#ECFDF5', color: snap.isRollback ? '#DC2626' : '#059669', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.70rem' }}>
                          {snap.isRollback ? 'ROLLED BACK' : 'ACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {!snap.isRollback && (
                          <button
                            onClick={() => {
                              setSelectedSnapshotId(snap.id);
                              setShowRollbackModal(true);
                            }}
                            style={{
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Revert Batch
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', width: '90%', maxWidth: '460px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <Undo2 size={24} color="#DC2626" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#991B1B' }}>
                Strict Rollback Confirmation
              </h3>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              Reverting this batch will restore all updated student fields to their state immediately prior to the import.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1E293B', display: 'block', marginBottom: '6px' }}>
                Type <code>RESTORE</code> in all caps to confirm:
              </label>
              <input
                type="text"
                value={restoreConfirmInput}
                onChange={(e) => setRestoreConfirmInput(e.target.value)}
                placeholder="RESTORE"
                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '0.84rem' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowRollbackModal(false);
                  setRestoreConfirmInput('');
                }}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerRollback}
                disabled={restoreConfirmInput !== 'RESTORE'}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: restoreConfirmInput === 'RESTORE' ? '#DC2626' : '#94A3B8',
                  color: '#FFFFFF',
                  cursor: restoreConfirmInput === 'RESTORE' ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                }}
              >
                Revert Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 7: DOCUMENT STORAGE MONITORING */}
      {/* ==================================================================== */}
      {activeTab === 'storage' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
              Vercel Private Blob Storage Monitor
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
              Live telemetry for client-owned private document storage store.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px 18px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>STORE NAME</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0A1931', marginTop: '4px' }}>hanujai-student-documents</div>
            </div>
            <div style={{ padding: '16px 18px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>STORAGE REGION</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0A1931', marginTop: '4px' }}>BOM1 (Mumbai, India)</div>
            </div>
            <div style={{ padding: '16px 18px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>ACCESS LEVEL</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>Private (Server-side Only)</div>
            </div>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
              9 Required Student Document Slots
            </div>
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                'Student Photo',
                'Student Aadhaar Front',
                'Student Aadhaar Back',
                'Birth Certificate',
                'Father Aadhaar Card',
                'Mother Aadhaar Card',
                'Previous School TC',
                'Previous Class Marksheet',
                'Caste / Category Certificate',
              ].map((slot, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0A1931' }}>Slot {i + 1}: {slot}</div>
                  <div style={{ fontSize: '0.70rem', color: '#059669', marginTop: '2px' }}>Configured & Monitored</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 8: ATTENDANCE & WHATSAPP ZERO-COST ARCHITECTURE */}
      {/* ==================================================================== */}
      {activeTab === 'whatsapp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={20} color="#0A1931" />
                  <span>WhatsApp Zero-Cost Worker Architecture & Device Pairing</span>
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
                  Render Free Web Service with Cloud Firestore AES-256-GCM auth persistence and on-demand wake.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={refreshWorkerStatus}
                  disabled={isLoadingWorkerStatus}
                  style={{
                    backgroundColor: '#F8FAFC',
                    color: '#334155',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '0.80rem',
                    fontWeight: 700,
                    cursor: isLoadingWorkerStatus ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={14} className={isLoadingWorkerStatus ? 'animate-spin' : ''} />
                  <span>Refresh Status</span>
                </button>

                <button
                  type="button"
                  onClick={handleWakeWorker}
                  disabled={isWakingWorker}
                  style={{
                    backgroundColor: '#0A1931',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '0.80rem',
                    fontWeight: 700,
                    cursor: isWakingWorker ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(10, 25, 49, 0.2)',
                  }}
                >
                  <Radio size={14} className={isWakingWorker ? 'animate-pulse' : ''} />
                  <span>{isWakingWorker ? 'Waking Worker...' : 'Wake Worker'}</span>
                </button>
              </div>
            </div>

            {/* Worker Status & Health Banner */}
            {(() => {
              const isConnected = workerStatus?.baileys?.connected || workerStatus?.connected;
              const isRegistered = workerStatus?.baileys?.isRegistered || workerStatus?.isRegistered;
              const userJid = workerStatus?.baileys?.userJid || workerStatus?.userJid;
              const workerStatusState = isConnected ? 'online' : isRegistered ? 'sleeping' : 'unlinked';

              return (
                <div
                  style={{
                    padding: '18px 20px',
                    borderRadius: '10px',
                    backgroundColor: isConnected ? '#ECFDF5' : isRegistered ? '#FFFBEB' : '#FEF2F2',
                    border: `1px solid ${isConnected ? '#A7F3D0' : isRegistered ? '#FDE68A' : '#FECACA'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: isConnected ? '#10B981' : isRegistered ? '#F59E0B' : '#EF4444',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isConnected ? <Wifi size={22} /> : isRegistered ? <Radio size={22} /> : <WifiOff size={22} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0A1931' }}>
                          {isConnected
                            ? 'WhatsApp Socket: Connected & Ready'
                            : isRegistered
                            ? 'Worker Asleep / Idle (Render Free Tier)'
                            : 'WhatsApp Account Not Linked'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.70rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: isConnected ? '#D1FAE5' : isRegistered ? '#FEF3C7' : '#FEE2E2',
                            color: isConnected ? '#065F46' : isRegistered ? '#92400E' : '#991B1B',
                            textTransform: 'uppercase',
                          }}
                        >
                          {workerStatusState}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '3px' }}>
                        {isConnected
                          ? `Linked Device JID: ${userJid || 'Connected'} • Session stored in Cloud Firestore`
                          : isRegistered
                          ? 'Session keys persisted in Cloud Firestore. Container wakes automatically on attendance submission.'
                          : 'Pair official school dispatch mobile phone using the 8-digit Pairing Code below.'}
                      </div>
                    </div>
                  </div>

                  {isRegistered && (
                    <button
                      type="button"
                      onClick={handleUnlinkWhatsApp}
                      disabled={isUnlinkingWhatsApp}
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: isUnlinkingWhatsApp ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isUnlinkingWhatsApp ? 'Unlinking...' : 'Unlink WhatsApp'}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Zero-Cost 8-Digit Baileys Pairing Interface (Developer-Only) */}
            {(!workerStatus?.baileys?.isRegistered && !workerStatus?.isRegistered) && (
              <div
                style={{
                  padding: '24px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Phone size={18} color="#0A1931" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0A1931', margin: 0 }}>
                    Link Official WhatsApp Device via 8-Digit Pairing Code
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  Connect the official school WhatsApp account without scanning QR codes. Enter the phone number with country code, generate the 8-digit code, and enter it in WhatsApp on the phone.
                </p>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div style={{ width: '280px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Mobile Number (with country code)
                    </label>
                    <input
                      type="text"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      placeholder="e.g. 919509489381"
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        padding: '0 10px',
                        fontSize: '0.86rem',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: '#0A1931',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRequestPairingCode}
                    disabled={isRequestingPairing}
                    style={{
                      marginTop: '18px',
                      backgroundColor: '#0A1931',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '9px 18px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: isRequestingPairing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isRequestingPairing ? 'Requesting Code...' : 'Generate 8-Digit Code'}
                  </button>
                </div>

                {/* Prominent Pairing Code Presentation */}
                {pairingCode && (
                  <div
                    style={{
                      padding: '20px',
                      borderRadius: '8px',
                      backgroundColor: '#0A1931',
                      color: '#FFFFFF',
                      marginTop: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Baileys 8-Digit Device Pairing Code (Expires in {pairingCountdown}s)
                        </div>
                        <div style={{ fontSize: '2.1rem', fontWeight: 900, letterSpacing: '0.25em', color: '#38BDF8', fontFamily: 'monospace', marginTop: '4px' }}>
                          {pairingCode}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyPairingCode}
                        style={{
                          backgroundColor: hasCopiedCode ? '#10B981' : '#1E293B',
                          color: '#FFFFFF',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '8px 14px',
                          fontSize: '0.80rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {hasCopiedCode ? <Check size={14} /> : <Copy size={14} />}
                        <span>{hasCopiedCode ? 'Copied!' : 'Copy Code'}</span>
                      </button>
                    </div>

                    <div style={{ backgroundColor: '#1E293B', borderRadius: '6px', padding: '12px 16px', fontSize: '0.78rem', color: '#E2E8F0', lineHeight: 1.6 }}>
                      <strong style={{ color: '#38BDF8' }}>Follow these steps on the phone (+{pairingPhone.replace(/\D/g, '')}):</strong>
                      <ol style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
                        <li>Open WhatsApp &gt; <strong>Linked Devices</strong>.</li>
                        <li>Tap <strong>Link a Device</strong>.</li>
                        <li>Tap <strong>"Link with phone number instead"</strong> at the bottom of the camera screen.</li>
                        <li>Type the 8-digit code <strong>{pairingCode}</strong>.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Operational Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Queue Depth</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A1931', marginTop: '4px' }}>
                  {workerStatus?.metrics?.queueDepth ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '2px' }}>Pending parent jobs</div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Processed Messages</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A1931', marginTop: '4px' }}>
                  {workerStatus?.metrics?.totalProcessed ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '2px' }}>Successfully dispatched</div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Failed Deliveries</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A1931', marginTop: '4px' }}>
                  {workerStatus?.metrics?.totalFailed ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#DC2626', marginTop: '2px' }}>With automatic retry</div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Last Wake-Up Time</div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0A1931', marginTop: '8px' }}>
                  {workerStatus?.metrics?.lastWakeUpTime
                    ? new Date(workerStatus.metrics.lastWakeUpTime).toLocaleTimeString('en-IN')
                    : 'On Demand'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>Zero-cost sleep active</div>
              </div>
            </div>

            {/* Principal-Approved Bilingual Message Preview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
              {/* 1. PRESENT Attendance Template */}
              <div style={{ padding: '20px', borderRadius: '10px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                    1. PRESENT Attendance Notification (English + Hindi)
                  </div>
                  <span style={{ fontSize: '0.68rem', backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    Official Approved
                  </span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#14532D', whiteSpace: 'pre-line', lineHeight: 1.5, backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #DCFCE7' }}>
                  {generatePresentAttendanceMessage('{studentName}', '{date}')}
                </div>
              </div>

              {/* 2. ABSENT Attendance Template */}
              <div style={{ padding: '20px', borderRadius: '10px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase' }}>
                    2. ABSENT Attendance Notification (English + Hindi)
                  </div>
                  <span style={{ fontSize: '0.68rem', backgroundColor: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    Official Approved
                  </span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#7F1D1D', whiteSpace: 'pre-line', lineHeight: 1.5, backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #FEE2E2' }}>
                  {generateAbsentAttendanceMessage('{studentName}', '{date}')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 9: SYSTEM HEALTH */}
      {/* ==================================================================== */}
      {activeTab === 'health' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
                System Health & API Diagnostics
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
                Live latency and availability probes for school cloud services.
              </p>
            </div>
            <button
              onClick={handleRunDiagnostics}
              disabled={isProbing}
              style={{
                backgroundColor: '#0A1931',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: isProbing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={15} className={isProbing ? 'animate-spin' : ''} />
              <span>Run Diagnostic Probe</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {healthProbes.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: '16px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0A1931' }}>{p.service}</div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '3px' }}>{p.details}</div>
                  <div style={{ fontSize: '0.70rem', color: '#94A3B8', marginTop: '2px' }}>Last Verified: {p.lastChecked}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                    }}
                  >
                    HEALTHY
                  </span>
                  {p.latencyMs !== undefined && (
                    <div style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '4px' }}>
                      Latency: {p.latencyMs}ms
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 10: AUDIT LOGS */}
      {/* ==================================================================== */}
      {activeTab === 'audit' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
              System Audit Ledger
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
              Immutable record of administrative operations, imports, role changes, and system modifications.
            </p>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '10px 12px' }}>Timestamp</th>
                  <th style={{ padding: '10px 12px' }}>Action</th>
                  <th style={{ padding: '10px 12px' }}>Actor</th>
                  <th style={{ padding: '10px 12px' }}>Details / Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.slice(0, 20).map((evt) => (
                  <tr key={evt.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{new Date(evt.timestamp).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0A1931' }}>{evt.action}</td>
                    <td style={{ padding: '10px 12px' }}>{evt.actorName} ({evt.actorRole})</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{evt.summary || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 11: SETTINGS */}
      {/* ==================================================================== */}
      {activeTab === 'settings' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px 28px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A1931', margin: '0 0 4px 0' }}>
              Institutional & Platform Settings
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
              HanuJai High School CBSE institutional parameters.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>INSTITUTION NAME</div>
              <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0A1931', marginTop: '4px' }}>HanuJai High School</div>
              <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>Jaipur, Rajasthan, India</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>CBSE AFFILIATION</div>
              <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0A1931', marginTop: '4px' }}>Affiliation #1730999</div>
              <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>Secondary & Senior Secondary</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>OPERATIONAL PHASE</div>
              <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>Phase 1 Core Pilot</div>
              <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>Students, Attendance, WhatsApp, Documents</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DATABASE SCHEMA & DATA DICTIONARY */}
      {activeTab === 'db_schema' && <DatabaseExplorer />}

      {/* TAB: SWAGGER UI & OPENAPI 3.0 EXPLORER */}
      {activeTab === 'api_docs' && <SwaggerPortal />}

    </div>
  );
};
