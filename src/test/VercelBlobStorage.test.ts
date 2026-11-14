/**
 * HanuJai High School ERP — Vercel Private Blob Storage Provider Unit Tests
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VercelBlobStorageProvider, vercelBlobStorage } from '../services/storage/vercelBlobStorage';
import type { StorageUploadOptions } from '../services/storage/storageProvider';

// Mock @vercel/blob/client
vi.mock('@vercel/blob/client', () => ({
  upload: vi.fn().mockImplementation(async (pathname, _file, options) => {
    // Simulate upload progress
    options?.onUploadProgress?.({ loaded: 50, total: 100, percentage: 50 });
    options?.onUploadProgress?.({ loaded: 100, total: 100, percentage: 100 });
    return {
      url: `https://mock-store.private.blob.vercel-storage.com/${pathname}`,
      pathname,
      contentType: options?.contentType || 'application/pdf',
      contentDisposition: 'inline',
    };
  }),
}));

describe('VercelBlobStorageProvider Unit Tests', () => {
  let provider: VercelBlobStorageProvider;

  beforeEach(() => {
    provider = new VercelBlobStorageProvider();
    vi.clearAllMocks();
  });

  it('identifies itself as vercel-private-blob', () => {
    expect(provider.name).toBe('vercel-private-blob');
    expect(vercelBlobStorage.name).toBe('vercel-private-blob');
  });

  it('generates sanitized canonical path and uploads via client token protocol', async () => {
    const mockFile = new File(['dummy content'], 'Student Aadhaar (Front) [2026].pdf', {
      type: 'application/pdf',
    });

    const progressReports: number[] = [];
    const options: StorageUploadOptions = {
      studentId: 'STU-01A-35',
      documentType: 'student_aadhaar_front',
      originalFileName: 'Student Aadhaar (Front) [2026].pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
      actorId: 'staff-admin',
      actorRole: 'admin',
      idToken: 'mock-id-token-xyz',
      onProgress: (p) => progressReports.push(p.percentage),
    };

    const result = await provider.uploadFile(mockFile, options);

    expect(result).toBeDefined();
    expect(result.pathname).toMatch(/^students\/STU-01A-35\/documents\/student_aadhaar_front\/\d+_Student_Aadhaar__Front___2026_\.pdf$/);
    expect(result.contentType).toBe('application/pdf');
    expect(progressReports).toContain(50);
    expect(progressReports).toContain(100);
  });

  it('generates secure authenticated delivery URLs for preview and download', async () => {
    const pathname = 'students/STU-01A-35/documents/student_photo/photo.jpg';
    const idToken = 'verified-firebase-jwt-123';

    // Preview URL
    const previewUrl = await provider.getFileDownloadUrl(pathname, idToken, false);
    expect(previewUrl).toContain('/api/documents/file?');
    expect(previewUrl).toContain(`pathname=${encodeURIComponent(pathname)}`);
    expect(previewUrl).toContain(`token=${encodeURIComponent(idToken)}`);
    expect(previewUrl).not.toContain('download=1');

    // Download URL
    const downloadUrl = await provider.getFileDownloadUrl(pathname, idToken, true);
    expect(downloadUrl).toContain('/api/documents/file?');
    expect(downloadUrl).toContain(`pathname=${encodeURIComponent(pathname)}`);
    expect(downloadUrl).toContain(`token=${encodeURIComponent(idToken)}`);
    expect(downloadUrl).toContain('download=1');
  });

  it('calls authenticated /api/documents/delete endpoint with Authorization token', async () => {
    const pathname = 'students/STU-01A-35/documents/transfer_certificate/tc.pdf';
    const idToken = 'admin-jwt-token';

    let fetchUrl = '';
    let fetchOptions: any = null;

    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      fetchUrl = url.toString();
      fetchOptions = opts;
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    });

    await provider.deleteFile(pathname, idToken);

    expect(fetchUrl).toBe('/api/documents/delete');
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.headers['Authorization']).toBe(`Bearer ${idToken}`);
    expect(JSON.parse(fetchOptions.body)).toEqual({ pathname });
  });

  it('handles error gracefully when deletion endpoint fails', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden: Principal cannot delete documents' }),
      };
    });

    await expect(
      provider.deleteFile('students/STU-01A-35/documents/transfer_certificate/tc.pdf', 'token')
    ).rejects.toThrow('Forbidden: Principal cannot delete documents');
  });
});
