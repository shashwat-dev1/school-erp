import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  Download,
  Shield,
  Key,
  Table,
} from 'lucide-react';

export interface FieldDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
  validation?: string;
  example: string;
}

export interface SecurityMatrix {
  read: string;
  create: string;
  update: string;
  delete: string;
}

export interface CollectionSchema {
  id: string;
  name: string;
  category: 'core' | 'operations' | 'security' | 'integration';
  purpose: string;
  idFormat: string;
  security: SecurityMatrix;
  indexes: string[];
  subcollections?: string[];
  fields: FieldDefinition[];
}

export const firestoreSchemaDictionary: CollectionSchema[] = [
  {
    id: 'schoolSettings',
    name: 'School Settings',
    category: 'core',
    purpose: 'Global institutional metadata, address, affiliation numbers, logo, and active academic year reference.',
    idFormat: 'Single singleton document "config" or auto-ID',
    security: {
      read: 'Authenticated Staff (Developer, Admin, Principal)',
      create: 'Developer only',
      update: 'Developer only',
      delete: 'Denied (false)',
    },
    indexes: ['None (Singleton)'],
    fields: [
      { name: 'name', type: 'string', required: true, description: 'Institutional name', example: 'HanuJai High School' },
      { name: 'code', type: 'string', required: true, description: 'State/CBSE institutional code', example: 'HHS-JPR-01' },
      { name: 'affiliationNumber', type: 'string', required: true, description: 'Rajasthan Education Board affiliation number', example: 'RAJ-SEC-89211' },
      { name: 'city', type: 'string', required: true, description: 'School campus city', example: 'Jaipur' },
      { name: 'state', type: 'string', required: true, description: 'State', example: 'Rajasthan' },
      { name: 'primaryPhone', type: 'string', required: true, description: 'Primary contact line', example: '+91 141 2780000' },
      { name: 'currentAcademicYearId', type: 'string', required: true, description: 'Active academic session ID', example: 'ay-2024-25' },
    ],
  },
  {
    id: 'systemSettings',
    name: 'System Settings',
    category: 'security',
    purpose: 'Platform-level operational feature flags, rate limits, storage policies, and maintenance toggles.',
    idFormat: 'Singleton document "system_config"',
    security: {
      read: 'Authenticated Staff (Developer, Admin, Principal)',
      create: 'Developer only',
      update: 'Developer only',
      delete: 'Denied (false)',
    },
    indexes: ['None (Singleton)'],
    fields: [
      { name: 'maintenanceMode', type: 'boolean', required: true, description: 'Whether system is locked for maintenance', example: 'false' },
      { name: 'allowParentUploads', type: 'boolean', required: true, description: 'Master toggle for parent upload gateway', example: 'true' },
      { name: 'maxDocumentSizeBytes', type: 'number', required: true, description: 'Maximum allowed document size (5MB)', example: '5242880' },
      { name: 'invitationTokenTtlHours', type: 'number', required: true, description: 'Lifetime of parent invitation link in hours', example: '72' },
      { name: 'uploadSessionTtlMinutes', type: 'number', required: true, description: 'Lifetime of scoped HMAC upload session in minutes', example: '60' },
    ],
  },
  {
    id: 'academicYears',
    name: 'Academic Years',
    category: 'core',
    purpose: 'Institutional calendar sessions, start/end dates, and active session flag.',
    idFormat: 'Canonical slug "ay-YYYY-YY" (e.g., ay-2024-25)',
    security: {
      read: 'Authenticated Staff (Developer, Admin, Principal)',
      create: 'Developer only',
      update: 'Developer only',
      delete: 'Denied (false)',
    },
    indexes: ['isCurrent ASC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Unique session identifier', example: 'ay-2024-25' },
      { name: 'label', type: 'string', required: true, description: 'Human-readable session title', example: 'Academic Year 2024-2025' },
      { name: 'startDate', type: 'string', required: true, description: 'ISO date string of session start', example: '2024-04-01' },
      { name: 'endDate', type: 'string', required: true, description: 'ISO date string of session end', example: '2025-03-31' },
      { name: 'isCurrent', type: 'boolean', required: true, description: 'True for active ongoing academic year', example: 'true' },
    ],
  },
  {
    id: 'classes',
    name: 'Classes & Sections',
    category: 'core',
    purpose: 'Class definitions from Nursery through Class 10 with section identifiers, room allocations, and capacity.',
    idFormat: 'Canonical slug "class-{grade}-{section}" (e.g., class-10-a)',
    security: {
      read: 'Authenticated Staff (Developer, Admin, Principal)',
      create: 'Developer only',
      update: 'Developer only',
      delete: 'Denied (false)',
    },
    indexes: ['grade ASC, section ASC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Class identifier slug', example: 'class-10-a' },
      { name: 'label', type: 'string', required: true, description: 'Display name', example: 'Class 10-A' },
      { name: 'grade', type: 'number | string', required: true, description: 'Grade level (Nursery, LKG, UKG, 1-10)', example: '10' },
      { name: 'section', type: 'string', required: true, description: 'Section letter', example: 'A' },
      { name: 'capacity', type: 'number', required: true, description: 'Maximum student capacity', example: '40' },
    ],
  },
  {
    id: 'staff',
    name: 'Staff Accounts',
    category: 'security',
    purpose: 'Staff identity directory, role mappings, account status, and Firebase Auth UID bindings.',
    idFormat: 'Firebase Auth UID or canonical slug "staff-dev", "staff-admin", "staff-principal"',
    security: {
      read: 'Authenticated Staff',
      create: 'Developer or Self UID match',
      update: 'Developer or Self UID match',
      delete: 'Denied (false)',
    },
    indexes: ['email ASC', 'role ASC, status ASC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Staff document ID', example: 'nyWReUDvXvYPlLWH6HGpHYFwkwt2' },
      { name: 'authUid', type: 'string', required: false, description: 'Firebase Auth UID linking', example: 'nyWReUDvXvYPlLWH6HGpHYFwkwt2' },
      { name: 'email', type: 'string', required: true, description: 'Staff institutional email', example: 'developer@hanujai.edu.in' },
      { name: 'name', type: 'string', required: true, description: 'Full staff name', example: 'System Administrator' },
      { name: 'role', type: 'string', required: true, description: 'Institutional RBAC role (developer, admin, principal)', example: 'developer' },
      { name: 'status', type: 'string', required: true, description: 'Account lifecycle state (active, inactive)', example: 'active' },
      { name: 'createdAt', type: 'timestamp | string', required: true, description: 'Creation timestamp', example: '2024-01-01T00:00:00Z' },
    ],
  },
  {
    id: 'students',
    name: 'Students Master Directory',
    category: 'core',
    purpose: 'Central institutional directory of all enrolled students, demographics, guardian contacts, and compliance status.',
    idFormat: 'Composite slug "stu-{grade}{section}-{roll}" (e.g., stu-10a-01)',
    security: {
      read: 'Principal, Admin, Developer',
      create: 'Admin, Developer (Principal read-only)',
      update: 'Admin, Developer (Principal read-only)',
      delete: 'Denied (false)',
    },
    indexes: ['classId ASC, rollNumber ASC', 'fullName ASC', 'admissionNumber ASC'],
    subcollections: ['documents (Student Document Metadata)'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Student identifier', example: 'stu-10a-01' },
      { name: 'admissionNumber', type: 'string', required: true, description: 'Unique school admission ID', example: 'HHS-2024-001' },
      { name: 'rollNumber', type: 'number', required: true, description: 'Roll number in section', example: '1' },
      { name: 'fullName', type: 'string', required: true, description: 'Student full legal name', example: 'Aarav Sharma' },
      { name: 'gender', type: 'string', required: true, description: 'Gender (M/F/O)', example: 'M' },
      { name: 'classId', type: 'string', required: true, description: 'Enrolled class section', example: 'class-10-a' },
      { name: 'guardianName', type: 'string', required: true, description: 'Primary parent/guardian name', example: 'Rajesh Sharma' },
      { name: 'guardianRelation', type: 'string', required: true, description: 'Relationship (Father, Mother, Guardian)', example: 'Father' },
      { name: 'primaryPhone', type: 'string', required: true, description: 'WhatsApp contact number (+91...)', example: '+91 98290 12345' },
      { name: 'residentialAddress', type: 'string', required: false, description: 'Home residential address', example: 'Malviya Nagar, Jaipur, Rajasthan' },
      { name: 'status', type: 'string', required: true, description: 'Enrollment state (active, inactive, transferred)', example: 'active' },
      { name: 'attendancePercentage', type: 'number', required: false, description: 'Calculated cumulative attendance %', example: '92.4' },
    ],
  },
  {
    id: 'students/{studentId}/documents',
    name: 'Student Documents (Subcollection)',
    category: 'operations',
    purpose: 'Stores metadata and storage pointers for each of the 9 required student document slots.',
    idFormat: 'Document type key (e.g., aadhaar_card, birth_certificate)',
    security: {
      read: 'Principal, Admin, Developer',
      create: 'Admin, Developer (Principal read-only)',
      update: 'Admin, Developer (Principal read-only)',
      delete: 'Admin, Developer (Principal read-only)',
    },
    indexes: ['status ASC', 'uploadedAt DESC'],
    fields: [
      { name: 'documentType', type: 'string', required: true, description: '1 of 9 mandatory slots', example: 'aadhaar_card' },
      { name: 'status', type: 'string', required: true, description: 'Verification state (pending, verified, rejected, missing)', example: 'verified' },
      { name: 'blobUrl', type: 'string', required: false, description: 'Private Vercel Blob store locator', example: 'https://blob.vercel-storage.com/docs/stu-10a-01/aadhaar.pdf' },
      { name: 'fileSize', type: 'number', required: false, description: 'File size in bytes', example: '245120' },
      { name: 'mimeType', type: 'string', required: false, description: 'MIME type (application/pdf, image/jpeg)', example: 'application/pdf' },
      { name: 'uploadedBy', type: 'string', required: true, description: 'Staff user ID or pseudonymized parent token ref', example: 'staff-admin' },
      { name: 'uploadedAt', type: 'string', required: true, description: 'ISO upload timestamp', example: '2026-11-15T10:00:00Z' },
    ],
  },
  {
    id: 'attendanceSessions',
    name: 'Attendance Sessions',
    category: 'operations',
    purpose: 'Daily locked attendance registers containing student-by-student presence/absence statuses and audit signatures.',
    idFormat: 'Composite key "att-{classId}-{YYYY-MM-DD}"',
    security: {
      read: 'Principal, Admin, Developer',
      create: 'Admin, Developer (Principal read-only)',
      update: 'Admin, Developer (Principal read-only)',
      delete: 'Denied (false)',
    },
    indexes: ['date DESC, classId ASC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Session composite ID', example: 'att-class-10-a-2026-11-16' },
      { name: 'date', type: 'string', required: true, description: 'Register date (YYYY-MM-DD)', example: '2026-11-16' },
      { name: 'classId', type: 'string', required: true, description: 'Class identifier', example: 'class-10-a' },
      { name: 'status', type: 'string', required: true, description: 'Lifecycle state (submitted, locked)', example: 'locked' },
      { name: 'submittedBy', type: 'string', required: true, description: 'Staff ID who submitted register', example: 'staff-admin' },
      { name: 'submittedAt', type: 'string', required: true, description: 'Submission timestamp', example: '2026-11-16T08:45:00Z' },
      { name: 'presentCount', type: 'number', required: true, description: 'Total present students', example: '32' },
      { name: 'absentCount', type: 'number', required: true, description: 'Total absent students', example: '2' },
      { name: 'records', type: 'array of maps', required: true, description: 'Individual student attendance records', example: '[{ studentId: "stu-10a-01", status: "present" }]' },
    ],
  },
  {
    id: 'attendanceCorrections',
    name: 'Attendance Corrections',
    category: 'operations',
    purpose: 'Audited attendance correction requests submitted by Admin Office and reviewed/approved by Principal.',
    idFormat: 'Unique slug "corr-{timestamp}-{random}"',
    security: {
      read: 'Principal, Admin, Developer',
      create: 'Admin, Developer',
      update: 'Principal, Developer only (Admin cannot approve)',
      delete: 'Denied (false)',
    },
    indexes: ['status ASC, requestedAt DESC', 'sessionId ASC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Correction ID', example: 'corr-20261116-01' },
      { name: 'sessionId', type: 'string', required: true, description: 'Linked attendance session ID', example: 'att-class-10-a-2026-11-16' },
      { name: 'studentId', type: 'string', required: true, description: 'Student affected', example: 'stu-10a-01' },
      { name: 'classId', type: 'string', required: true, description: 'Class ID', example: 'class-10-a' },
      { name: 'date', type: 'string', required: true, description: 'Date of attendance record', example: '2026-11-16' },
      { name: 'currentStatus', type: 'string', required: true, description: 'Current status in register', example: 'absent' },
      { name: 'proposedStatus', type: 'string', required: true, description: 'Requested new status', example: 'present' },
      { name: 'reason', type: 'string', required: true, description: 'Mandatory justification text', example: 'Late bus arrival verified by transport incharge.' },
      { name: 'status', type: 'string', required: true, description: 'State (pending, approved, rejected)', example: 'pending' },
      { name: 'requestedBy', type: 'string', required: true, description: 'Staff ID who requested', example: 'staff-admin' },
      { name: 'requestedAt', type: 'string', required: true, description: 'Request timestamp', example: '2026-11-16T09:30:00Z' },
      { name: 'reviewedBy', type: 'string', required: false, description: 'Principal ID who reviewed', example: 'staff-principal' },
      { name: 'reviewedAt', type: 'string', required: false, description: 'Review timestamp', example: '2026-11-16T10:00:00Z' },
    ],
  },
  {
    id: 'attendanceNotifications',
    name: 'Attendance WhatsApp Notifications',
    category: 'integration',
    purpose: 'Notification job queue for daily attendance WhatsApp dispatches to parents with delivery statuses.',
    idFormat: 'Auto-ID or "job-{date}-{studentId}"',
    security: {
      read: 'Principal, Admin, Developer',
      create: 'Admin, Developer',
      update: 'Admin, Developer',
      delete: 'Denied (false)',
    },
    indexes: ['status ASC, scheduledAt ASC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Notification job ID', example: 'notif-20261116-001' },
      { name: 'studentId', type: 'string', required: true, description: 'Student recipient ID', example: 'stu-10a-01' },
      { name: 'date', type: 'string', required: true, description: 'Attendance date', example: '2026-11-16' },
      { name: 'phone', type: 'string', required: true, description: 'Target WhatsApp number', example: '+919829012345' },
      { name: 'message', type: 'string', required: true, description: 'Bilingual message payload', example: 'Dear Parent, Aarav is marked PRESENT today...' },
      { name: 'status', type: 'string', required: true, description: 'State (pending, sent, failed)', example: 'sent' },
      { name: 'sentAt', type: 'string', required: false, description: 'Delivery timestamp', example: '2026-11-16T08:46:12Z' },
    ],
  },
  {
    id: 'attendanceAggregates',
    name: 'Attendance Aggregates',
    category: 'operations',
    purpose: 'Precomputed monthly and cumulative attendance aggregates for reporting and dashboard widgets.',
    idFormat: 'Composite slug "agg-{studentId}-{YYYY-MM}"',
    security: {
      read: 'Principal, Admin, Developer',
      create: 'Admin, Developer',
      update: 'Admin, Developer',
      delete: 'Denied (false)',
    },
    indexes: ['studentId ASC, month ASC'],
    fields: [
      { name: 'studentId', type: 'string', required: true, description: 'Student identifier', example: 'stu-10a-01' },
      { name: 'totalDays', type: 'number', required: true, description: 'Total school days recorded', example: '120' },
      { name: 'presentDays', type: 'number', required: true, description: 'Total days present', example: '112' },
      { name: 'absentDays', type: 'number', required: true, description: 'Total days absent', example: '8' },
      { name: 'percentage', type: 'number', required: true, description: 'Attendance rate', example: '93.3' },
    ],
  },
  {
    id: 'parentDocumentInvitations',
    name: 'Parent Document Invitations',
    category: 'security',
    purpose: 'Cryptographic token hashes and permissions for parent-facing zero-OTP document upload links.',
    idFormat: 'Unique invitation slug "inv-{hashPrefix}"',
    security: {
      read: 'Principal, Admin, Developer',
      create: 'Admin, Developer',
      update: 'Admin, Developer (Server processes)',
      delete: 'Denied (false)',
    },
    indexes: ['tokenHash ASC', 'studentId ASC', 'status ASC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Invitation identifier', example: 'inv-a9f8b1c2' },
      { name: 'studentId', type: 'string', required: true, description: 'Target student ID', example: 'stu-10a-01' },
      { name: 'tokenHash', type: 'string', required: true, description: 'SHA-256 hash of 256-bit entropy token (NEVER raw token)', example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
      { name: 'requestedSlots', type: 'array of strings', required: true, description: 'Document slots permitted for upload', example: '["aadhaar_card", "birth_certificate"]' },
      { name: 'status', type: 'string', required: true, description: 'Status (active, revoked, completed, expired)', example: 'active' },
      { name: 'expiresAt', type: 'string', required: true, description: 'ISO expiry timestamp (72h default)', example: '2026-11-19T08:00:00Z' },
      { name: 'createdAt', type: 'string', required: true, description: 'Creation timestamp', example: '2026-11-16T08:00:00Z' },
      { name: 'createdBy', type: 'string', required: true, description: 'Staff ID who issued invitation', example: 'staff-admin' },
    ],
  },
  {
    id: 'parentUploadSessions',
    name: 'Parent Upload Sessions',
    category: 'security',
    purpose: 'Active verification sessions and rate-limiting trackers for parent document uploads.',
    idFormat: 'Session ID "sess-{tokenHashPrefix}"',
    security: {
      read: 'Admin, Developer',
      create: 'Server/Admin/Developer',
      update: 'Server/Admin/Developer',
      delete: 'Denied (false)',
    },
    indexes: ['expiresAt ASC', 'invitationId ASC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Session ID', example: 'sess-a9f8b1c2' },
      { name: 'invitationId', type: 'string', required: true, description: 'Linked invitation ID', example: 'inv-a9f8b1c2' },
      { name: 'studentId', type: 'string', required: true, description: 'Student ID', example: 'stu-10a-01' },
      { name: 'allowedSlots', type: 'array of strings', required: true, description: 'Slots authorized for this upload session', example: '["aadhaar_card"]' },
      { name: 'expiresAt', type: 'string', required: true, description: 'Expiration timestamp (max 60m)', example: '2026-11-16T09:00:00Z' },
    ],
  },
  {
    id: 'auditEvents',
    name: 'System Audit Trail',
    category: 'security',
    purpose: 'Append-only immutable audit trail capturing every privileged operational and authentication action.',
    idFormat: 'Auto-ID or "audit-{timestamp}-{random}"',
    security: {
      read: 'Principal, Admin, Developer',
      create: 'Authenticated staff with actorId matching request.auth.uid',
      update: 'Denied (false - strictly immutable)',
      delete: 'Denied (false - strictly immutable)',
    },
    indexes: ['timestamp DESC', 'action ASC', 'actorId ASC', 'targetType ASC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Event identifier', example: 'evt-109283' },
      { name: 'action', type: 'string', required: true, description: 'Audit action code', example: 'ATTENDANCE_SUBMIT' },
      { name: 'actorId', type: 'string', required: true, description: 'UID of user who performed action', example: 'staff-admin' },
      { name: 'actorRole', type: 'string', required: true, description: 'Role at time of action', example: 'admin' },
      { name: 'targetType', type: 'string', required: true, description: 'Target entity type (student, attendance, document)', example: 'attendance' },
      { name: 'targetId', type: 'string', required: true, description: 'Target record ID', example: 'att-class-10-a-2026-11-16' },
      { name: 'timestamp', type: 'string', required: true, description: 'ISO event timestamp', example: '2026-11-16T08:45:00Z' },
      { name: 'metadata', type: 'map', required: false, description: 'Structured action metadata', example: '{ "class": "10-A", "present": 32 }' },
    ],
  },
  {
    id: 'developerSnapshots',
    name: 'Developer Snapshots & Backups',
    category: 'security',
    purpose: 'Complete database rollback checkpoints and pre-migration backup snapshots.',
    idFormat: 'Canonical slug "snap-{timestamp}-{label}"',
    security: {
      read: 'Developer only',
      create: 'Developer only',
      update: 'Developer only',
      delete: 'Developer only',
    },
    indexes: ['createdAt DESC'],
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Snapshot identifier', example: 'snap-20261116-pre-import' },
      { name: 'label', type: 'string', required: true, description: 'Human description of snapshot', example: 'Pre-Excel Student Import Checkpoint' },
      { name: 'createdAt', type: 'string', required: true, description: 'Snapshot creation timestamp', example: '2026-11-16T02:00:00Z' },
      { name: 'totalStudents', type: 'number', required: true, description: 'Student record count at backup', example: '450' },
      { name: 'storageKey', type: 'string', required: true, description: 'Storage archive pointer', example: 'backups/2026-11-16.json.gz' },
    ],
  },
];

export const DatabaseExplorer: React.FC = () => {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('students');
  const [searchField, setSearchField] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const activeCollection = useMemo(() => {
    return firestoreSchemaDictionary.find(c => c.id === selectedCollectionId) || firestoreSchemaDictionary[0];
  }, [selectedCollectionId]);

  const filteredFields = useMemo(() => {
    if (!searchField.trim()) return activeCollection.fields;
    const q = searchField.toLowerCase();
    return activeCollection.fields.filter(
      f => f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.type.toLowerCase().includes(q)
    );
  }, [activeCollection, searchField]);

  const handleExportMarkdown = () => {
    let md = `# HanuJai High School ERP — Firestore Schema & Data Dictionary\n\n`;
    md += `*Generated: ${new Date().toISOString()}*\n\n`;
    md += `Total Collections: ${firestoreSchemaDictionary.length}\n\n---\n\n`;

    firestoreSchemaDictionary.forEach(c => {
      md += `## Collection: \`${c.id}\` (${c.name})\n\n`;
      md += `**Category:** ${c.category.toUpperCase()}  \n`;
      md += `**Purpose:** ${c.purpose}  \n`;
      md += `**Document ID Format:** \`${c.idFormat}\`  \n\n`;

      md += `### Security Access Rules\n`;
      md += `- **Read:** ${c.security.read}\n`;
      md += `- **Create:** ${c.security.create}\n`;
      md += `- **Update:** ${c.security.update}\n`;
      md += `- **Delete:** ${c.security.delete}\n\n`;

      md += `### Indexes\n`;
      c.indexes.forEach(idx => {
        md += `- \`${idx}\`\n`;
      });
      md += `\n`;

      if (c.subcollections && c.subcollections.length > 0) {
        md += `### Subcollections\n`;
        c.subcollections.forEach(sc => {
          md += `- \`${sc}\`\n`;
        });
        md += `\n`;
      }

      md += `### Field Definitions\n\n`;
      md += `| Field Name | Type | Required | Description | Example |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      c.fields.forEach(f => {
        md += `| \`${f.name}\` | \`${f.type}\` | ${f.required ? '**Yes**' : 'No'} | ${f.description} | \`${f.example}\` |\n`;
      });
      md += `\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hanujai-firestore-data-dictionary.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        className="hhs-card"
        style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #0A1931 0%, #1E293B 100%)',
          color: '#FFFFFF',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={24} color="#60A5FA" />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                Firestore Schema Explorer & Data Dictionary
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                }}
              >
                14 Collections
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#CBD5E1', maxWidth: '750px', lineHeight: 1.5 }}>
              Institutional Cloud Firestore architecture specification. Enforces strict schema integrity, field-level types, subcollection structures, and RBAC security rule alignment.
            </p>
          </div>

          <button
            onClick={handleExportMarkdown}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Download size={16} />
            Export Data Dictionary (.md)
          </button>
        </div>
      </div>

      {/* Main Grid: Collections Sidebar + Active Collection Schema */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left: Collections List */}
        <div className="hhs-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
              Collections ({firestoreSchemaDictionary.length})
            </h3>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#F8FAFC',
              }}
            >
              <option value="all">All Categories</option>
              <option value="core">Core School</option>
              <option value="operations">Operations</option>
              <option value="security">Security & Auth</option>
              <option value="integration">Integration</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '600px', overflowY: 'auto' }}>
            {firestoreSchemaDictionary
              .filter(c => selectedCategory === 'all' || c.category === selectedCategory)
              .map(col => {
                const isSelected = col.id === selectedCollectionId;
                return (
                  <button
                    key={col.id}
                    onClick={() => {
                      setSelectedCollectionId(col.id);
                      setSearchField('');
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isSelected ? '#0A1931' : 'transparent',
                      color: isSelected ? '#FFFFFF' : '#334155',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontWeight: isSelected ? 700 : 600, fontSize: '0.86rem' }}>
                        {col.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: isSelected ? '#1E293B' : '#F1F5F9',
                          color: isSelected ? '#93C5FD' : '#64748B',
                        }}
                      >
                        {col.fields.length} fields
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: isSelected ? '#94A3B8' : '#64748B',
                        marginTop: '2px',
                      }}
                    >
                      /{col.id}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Right: Active Collection Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Collection Overview Card */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
                    {activeCollection.name}
                  </h3>
                  <code style={{ fontSize: '0.85rem', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '4px', color: '#0369A1' }}>
                    /{activeCollection.id}
                  </code>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                  {activeCollection.purpose}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.78rem',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                  }}
                >
                  <Key size={14} color="#64748B" />
                  ID: {activeCollection.idFormat}
                </span>
              </div>
            </div>

            {/* Security Rules Matrix */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Shield size={16} color="#0A1931" />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#0A1931' }}>
                  Firestore Security Rules (firestore.rules)
                </h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', display: 'block' }}>READ PERMISSION</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1E293B' }}>{activeCollection.security.read}</span>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', display: 'block' }}>CREATE PERMISSION</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1E293B' }}>{activeCollection.security.create}</span>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', display: 'block' }}>UPDATE PERMISSION</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1E293B' }}>{activeCollection.security.update}</span>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', display: 'block' }}>DELETE PERMISSION</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1E293B' }}>{activeCollection.security.delete}</span>
                </div>
              </div>
            </div>

            {/* Indexes */}
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B' }}>INDEXES:</span>
              {activeCollection.indexes.map(idx => (
                <span
                  key={idx}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid #BFDBFE',
                  }}
                >
                  {idx}
                </span>
              ))}
            </div>
          </div>

          {/* Fields Schema Table */}
          <div className="hhs-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Table size={18} color="#0A1931" />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                  Document Fields ({filteredFields.length})
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '260px' }}>
                <Search size={16} color="#64748B" />
                <input
                  type="text"
                  placeholder="Filter fields..."
                  value={searchField}
                  onChange={e => setSearchField(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead style={{ backgroundColor: '#F8FAFC', textAlign: 'left' }}>
                  <tr>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>Field Name</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>Type</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>Required</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>Description</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>Example Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFields.map(f => (
                    <tr key={f.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontFamily: 'monospace', color: '#0F172A' }}>
                        {f.name}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                            backgroundColor: '#F1F5F9',
                            color: '#0369A1',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {f.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {f.required ? (
                          <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.78rem' }}>Required</span>
                        ) : (
                          <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Optional</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>
                        {f.description}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#475569' }}>
                        {f.example}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
