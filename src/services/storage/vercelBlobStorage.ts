/**
 * HanuJai High School ERP — Vercel Private Blob Storage Provider
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Implements client-side direct-to-blob upload with server-verified client tokens.
 * All blobs are strictly stored with private access (no public bucket URLs).
 * Access is routed exclusively through authenticated serverless endpoints.
 */

import { upload } from '@vercel/blob/client';
import type {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from './storageProvider';

export class VercelBlobStorageProvider implements StorageProvider {
  public readonly name = 'vercel-private-blob';

  /**
   * Uploads file binary directly to Vercel Private Blob using client upload token.
   * Bypasses the 4.5MB Vercel Serverless Function body limit to support up to 10MB documents.
   */
  public async uploadFile(
    file: File | Blob,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const rawName = options.originalFileName || (file instanceof File ? file.name : `${options.documentType}.pdf`);
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const pathname = `students/${options.studentId}/documents/${options.documentType}/${timestamp}_${safeName}`;

    const headers: Record<string, string> = {};
    if (options.idToken) {
      headers['Authorization'] = `Bearer ${options.idToken}`;
    }

    try {
      const blobResult = await upload(pathname, file, {
        access: 'private',
        handleUploadUrl: '/api/documents/upload',
        clientPayload: JSON.stringify({
          studentId: options.studentId,
          documentType: options.documentType,
          originalFileName: rawName,
          actorId: options.actorId,
          actorRole: options.actorRole,
        }),
        headers,
        contentType: options.contentType || (file instanceof File ? file.type : 'application/octet-stream'),
        onUploadProgress: (progress) => {
          options.onProgress?.({
            loaded: progress.loaded,
            total: progress.total,
            percentage: progress.percentage,
          });
        },
      });

      return {
        url: blobResult.url,
        pathname: blobResult.pathname || pathname,
        contentType: blobResult.contentType || options.contentType,
        size: options.fileSize || (file instanceof File ? file.size : 0),
      };
    } catch (uploadErr: unknown) {
      const message = uploadErr instanceof Error ? uploadErr.message : 'Unknown upload error';
      console.error('[VercelBlobStorageProvider] Upload failed:', uploadErr);

      if (message.includes('503') || message.includes('BLOB_READ_WRITE_TOKEN')) {
        throw new Error(
          'Vercel Private Blob store is not connected. Missing BLOB_READ_WRITE_TOKEN in Vercel project settings. ' +
            'Please refer to VERCEL_BLOB_SETUP_GUIDE.md.'
        );
      }
      throw new Error(`Document upload to private cloud storage failed: ${message}`);
    }
  }

  /**
   * Resolves the authenticated private delivery endpoint URL.
   */
  public async getFileDownloadUrl(
    pathname: string,
    idToken?: string,
    isDownload: boolean = false
  ): Promise<string> {
    const params = new URLSearchParams();
    params.set('pathname', pathname);
    if (idToken) {
      params.set('token', idToken);
    }
    if (isDownload) {
      params.set('download', '1');
    }
    return `/api/documents/file?${params.toString()}`;
  }

  /**
   * Requests deletion of the private document blob via authenticated serverless endpoint.
   */
  public async deleteFile(pathname: string, idToken?: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await fetch('/api/documents/delete', {
      method: 'POST',
      headers,
      body: JSON.stringify({ pathname }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete document from storage (HTTP ${res.status})`);
    }
  }
}

export const vercelBlobStorage = new VercelBlobStorageProvider();
