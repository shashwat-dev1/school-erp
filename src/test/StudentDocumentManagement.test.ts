/**
 * HanuJai High School ERP — Student Document Management Test Suite
 * Validates the 9-slot mandatory document structure, file constraints, completeness calculation,
 * role-based permissions, and end-to-end upload/replace/delete repository operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DOCUMENT_SLOT_DEFINITIONS,
  ORDERED_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  calculateDocumentCompleteness,
  validateDocumentFile,
} from '../domain/policy';
import { Permissions } from '../domain/permissions';
import { demoRepository } from '../data/demo/demoRepository';
import type { StaffUser, StudentDocumentType } from '../domain/types';

describe('HanuJai ERP — Student Document Management Module', () => {
  const principalUser: StaffUser = {
    id: 'staff-principal-01',
    name: 'Dr. Anand Sharma',
    role: 'principal',
    status: 'active',
    email: 'principal@hanujai.edu.in',
    employeeCode: 'EMP-001',
    designation: 'Principal',
    department: 'Administration',
    phone: '+91 98290 12001',
    createdAt: '2023-01-01T00:00:00Z',
  };

  const adminUser: StaffUser = {
    id: 'staff-admin-01',
    name: 'Admin Office Staff',
    role: 'admin',
    status: 'active',
    email: 'admin@hanujai.edu.in',
    employeeCode: 'EMP-002',
    designation: 'Admin Officer',
    department: 'Administration',
    phone: '+91 98290 12002',
    createdAt: '2023-01-01T00:00:00Z',
  };

  const teacherUser: StaffUser = {
    id: 'staff-teacher-01',
    name: 'Class Teacher',
    role: 'class_teacher' as any,
    status: 'active',
    email: 'teacher@hanujai.edu.in',
    employeeCode: 'EMP-003',
    designation: 'Class Teacher',
    department: 'Teaching',
    phone: '+91 98290 12003',
    createdAt: '2023-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    if (demoRepository.resetDemoData) {
      await demoRepository.resetDemoData();
    }
  });

  describe('1. 9-Slot Document Specification & Category Structure', () => {
    it('defines exactly 9 mandatory document slots', () => {
      expect(ORDERED_DOCUMENT_TYPES.length).toBe(9);
      expect(Object.keys(DOCUMENT_SLOT_DEFINITIONS).length).toBe(9);
    });

    it('groups slots into Student (5), Father (2), and Mother (2) categories', () => {
      expect(DOCUMENT_CATEGORIES.length).toBe(3);

      const studentCat = DOCUMENT_CATEGORIES.find(c => c.id === 'student');
      expect(studentCat?.types.length).toBe(5);
      expect(studentCat?.types).toEqual([
        'student_aadhaar_front',
        'student_aadhaar_back',
        'birth_certificate',
        'transfer_certificate',
        'student_photo',
      ]);

      const fatherCat = DOCUMENT_CATEGORIES.find(c => c.id === 'father');
      expect(fatherCat?.types.length).toBe(2);
      expect(fatherCat?.types).toEqual(['father_aadhaar_front', 'father_aadhaar_back']);

      const motherCat = DOCUMENT_CATEGORIES.find(c => c.id === 'mother');
      expect(motherCat?.types.length).toBe(2);
      expect(motherCat?.types).toEqual(['mother_aadhaar_front', 'mother_aadhaar_back']);
    });

    it('enforces image-only (max 5MB) for student photo', () => {
      const photoSlot = DOCUMENT_SLOT_DEFINITIONS['student_photo'];
      expect(photoSlot.maxSizeInBytes).toBe(5 * 1024 * 1024);
      expect(photoSlot.acceptedMimeTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
      expect(photoSlot.acceptedMimeTypes.includes('application/pdf')).toBe(false);
    });

    it('allows image and PDF (max 10MB) for official identity and certificate scans', () => {
      const nonPhotoSlots: StudentDocumentType[] = [
        'student_aadhaar_front',
        'student_aadhaar_back',
        'birth_certificate',
        'transfer_certificate',
        'father_aadhaar_front',
        'father_aadhaar_back',
        'mother_aadhaar_front',
        'mother_aadhaar_back',
      ];

      for (const slotType of nonPhotoSlots) {
        const slot = DOCUMENT_SLOT_DEFINITIONS[slotType];
        expect(slot.maxSizeInBytes).toBe(10 * 1024 * 1024);
        expect(slot.acceptedMimeTypes).toContain('application/pdf');
        expect(slot.acceptedMimeTypes).toContain('image/jpeg');
        expect(slot.acceptedMimeTypes).toContain('image/png');
      }
    });
  });

  describe('2. File Validation Logic', () => {
    it('accepts valid PDF within 10MB for Aadhaar scan', () => {
      const result = validateDocumentFile('student_aadhaar_front', {
        size: 2 * 1024 * 1024,
        type: 'application/pdf',
        name: 'aadhaar_front.pdf',
      });
      expect(result.valid).toBe(true);
    });

    it('accepts valid JPEG within 5MB for student photo', () => {
      const result = validateDocumentFile('student_photo', {
        size: 1.5 * 1024 * 1024,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects PDF for student photo slot', () => {
      const result = validateDocumentFile('student_photo', {
        size: 1024 * 500,
        type: 'application/pdf',
        name: 'photo.pdf',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file format');
    });

    it('rejects files exceeding maximum allowed size', () => {
      const result = validateDocumentFile('birth_certificate', {
        size: 11 * 1024 * 1024, // 11MB
        type: 'application/pdf',
        name: 'birth_cert.pdf',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size of 10 MB');
    });
  });

  describe('3. Completeness Calculation', () => {
    it('returns 0% and 9 missing when no documents are uploaded', () => {
      const summary = calculateDocumentCompleteness([]);
      expect(summary.totalRequired).toBe(9);
      expect(summary.uploadedCount).toBe(0);
      expect(summary.missingCount).toBe(9);
      expect(summary.completionPercentage).toBe(0);
    });

    it('returns 56% when 5 of 9 documents are uploaded', () => {
      const uploadedDocs: Array<{ documentType: StudentDocumentType; isPresent?: boolean }> = [
        { documentType: 'student_aadhaar_front' },
        { documentType: 'student_aadhaar_back' },
        { documentType: 'birth_certificate' },
        { documentType: 'transfer_certificate' },
        { documentType: 'student_photo' },
      ];
      const summary = calculateDocumentCompleteness(uploadedDocs);
      expect(summary.totalRequired).toBe(9);
      expect(summary.uploadedCount).toBe(5);
      expect(summary.missingCount).toBe(4);
      expect(summary.completionPercentage).toBe(56);
    });

    it('returns 100% and 0 missing when all 9 documents are uploaded', () => {
      const allDocs = ORDERED_DOCUMENT_TYPES.map(type => ({
        documentType: type,
        isPresent: true,
      }));
      const summary = calculateDocumentCompleteness(allDocs);
      expect(summary.totalRequired).toBe(9);
      expect(summary.uploadedCount).toBe(9);
      expect(summary.missingCount).toBe(0);
      expect(summary.completionPercentage).toBe(100);
    });
  });

  describe('4. Role-Based Permissions Matrix', () => {
    it('grants Principal strictly read-only oversight (view and download only)', () => {
      expect(Permissions.canViewStudentDocuments(principalUser)).toBe(true);
      expect(Permissions.canDownloadStudentDocument(principalUser)).toBe(true);
      expect(Permissions.canUploadStudentDocument(principalUser)).toBe(false);
      expect(Permissions.canDeleteStudentDocument(principalUser)).toBe(false);
    });

    it('grants Admin Office full management rights (upload, replace, delete, download, view)', () => {
      expect(Permissions.canViewStudentDocuments(adminUser)).toBe(true);
      expect(Permissions.canDownloadStudentDocument(adminUser)).toBe(true);
      expect(Permissions.canUploadStudentDocument(adminUser)).toBe(true);
      expect(Permissions.canDeleteStudentDocument(adminUser)).toBe(true);
    });

    it('denies deactivated teacher accounts all document access', () => {
      expect(Permissions.canViewStudentDocuments(teacherUser)).toBe(false);
      expect(Permissions.canDownloadStudentDocument(teacherUser)).toBe(false);
      expect(Permissions.canUploadStudentDocument(teacherUser)).toBe(false);
      expect(Permissions.canDeleteStudentDocument(teacherUser)).toBe(false);
    });
  });

  describe('5. Repository Operations (Upload, Replace, Delete & Audit Ledger)', () => {
    const studentId = 'STU-10A-01';

    it('allows Admin Office to upload a new document scan with version 1', async () => {
      const mockFile = new Blob(['mock-pdf-content'], { type: 'application/pdf' });

      const uploaded = await demoRepository.uploadStudentDocument(
        studentId,
        'student_aadhaar_front',
        mockFile,
        {
          originalFileName: 'Aadhaar_Front_Aarav.pdf',
          contentType: 'application/pdf',
          fileSize: 10240,
        },
        adminUser
      );

      expect(uploaded.id).toBe('student_aadhaar_front');
      expect(uploaded.documentType).toBe('student_aadhaar_front');
      expect(uploaded.version).toBe(1);
      expect(uploaded.uploadedBy).toBe(adminUser.id);
      expect(uploaded.uploadedByName).toBe(adminUser.name);
      expect(uploaded.originalFileName).toBe('Aadhaar_Front_Aarav.pdf');
      expect(uploaded.storagePath).toContain(`students/${studentId}/documents/student_aadhaar_front/`);

      const docs = await demoRepository.getStudentDocuments(studentId);
      expect(docs.length).toBe(1);
      expect(docs[0].documentType).toBe('student_aadhaar_front');

      // Check audit event
      const audit = await demoRepository.getAuditEvents({ resource: 'student_documents' });
      expect(audit.length).toBeGreaterThanOrEqual(1);
      expect(audit[0].action).toBe('document_uploaded');
      expect(audit[0].actorId).toBe(adminUser.id);
    });

    it('increments version to 2 when replacing an existing document', async () => {
      const mockFile1 = new Blob(['mock-pdf-1'], { type: 'application/pdf' });
      await demoRepository.uploadStudentDocument(
        studentId,
        'birth_certificate',
        mockFile1,
        { originalFileName: 'Birth_Cert_v1.pdf', contentType: 'application/pdf', fileSize: 12000 },
        adminUser
      );

      const mockFile2 = new Blob(['mock-pdf-2'], { type: 'application/pdf' });
      const replaced = await demoRepository.uploadStudentDocument(
        studentId,
        'birth_certificate',
        mockFile2,
        { originalFileName: 'Birth_Cert_v2_Attested.pdf', contentType: 'application/pdf', fileSize: 14000 },
        adminUser
      );

      expect(replaced.version).toBe(2);
      expect(replaced.originalFileName).toBe('Birth_Cert_v2_Attested.pdf');

      const docs = await demoRepository.getStudentDocuments(studentId);
      const birthDoc = docs.find(d => d.documentType === 'birth_certificate');
      expect(birthDoc?.version).toBe(2);

      const audit = await demoRepository.getAuditEvents({ resource: 'student_documents' });
      expect(audit[0].action).toBe('document_replaced');
    });

    it('allows Admin Office to delete a document and records an audit log', async () => {
      const mockFile = new Blob(['mock-img'], { type: 'image/jpeg' });
      await demoRepository.uploadStudentDocument(
        studentId,
        'student_photo',
        mockFile,
        { originalFileName: 'passport_photo.jpg', contentType: 'image/jpeg', fileSize: 50000 },
        adminUser
      );

      let docs = await demoRepository.getStudentDocuments(studentId);
      expect(docs.some(d => d.documentType === 'student_photo')).toBe(true);

      await demoRepository.deleteStudentDocument(studentId, 'student_photo', adminUser);

      docs = await demoRepository.getStudentDocuments(studentId);
      expect(docs.some(d => d.documentType === 'student_photo')).toBe(false);

      const audit = await demoRepository.getAuditEvents({ resource: 'student_documents' });
      expect(audit[0].action).toBe('document_deleted');
      expect(audit[0].details?.documentType).toBe('student_photo');
    });
  });
});
