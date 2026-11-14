/**
 * HanuJai High School ERP — Vercel Private Blob Storage Provider
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Implements client-side direct-to-blob upload with server-verified client tokens.
 * All blobs are strictly stored with private access in the school's Account B store.
 *
 * Security:
 * - All server requests send Authorization: Bearer <idToken> headers.
 * - Sensitive tokens are NEVER passed in query parameters or exposed to logs.
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
   * Direct streaming to blob.vercel-storage.com bypasses the 4.5MB serverless body limit,
   * supporting up to 10MB per document.
   */
  public async uploadFile(
    file: File | Blob,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const rawName = options.originalFileName || (file instanceof File ? file.name : `${options.documentType}.pdf`);
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const pathname = `students/${options.studentId}/documents/${options.documentType}/${timestamp}_${safeName}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.idToken}`,
    };

    try {
      const blobResult = await upload(pathname, file, {
        access: 'private',
        handleUploadUrl: '/api/documents/upload',
        clientPayload: JSON.stringify({
          studentId: options.studentId,
          documentType: options.documentType,
          originalFileName: rawName,
          contentType: options.contentType,
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
      console.error('[VercelBlobStorageProvider] Upload failed:', message);

      if (message.includes('503') || message.includes('BLOB_READ_WRITE_TOKEN')) {
        throw new Error(
          'Vercel Private Blob store is not connected. Missing BLOB_READ_WRITE_TOKEN in project settings. ' +
            'Please refer to VERCEL_BLOB_SETUP_GUIDE.md.'
        );
      }
      throw new Error(`Document upload to private cloud storage failed: ${message}`);
    }
  }

  /**
   * Returns the canonical serverless endpoint path for document streaming.
   * Tokens are NEVER appended to query strings.
   */
  public async getFileDownloadUrl(pathname: string): Promise<string> {
    return `/api/documents/file?pathname=${encodeURIComponent(pathname)}`;
  }

  /**
   * Fetches the private document binary using Bearer token authentication.
   */
  public async fetchFileBinary(pathname: string, idToken: string): Promise<Blob> {
    const url = await this.getFileDownloadUrl(pathname);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch document from private storage (HTTP ${res.status})`);
    }

    return await res.blob();
  }

  /**
   * Requests deletion of the private document blob via authenticated serverless endpoint.
   */
  public async deleteFile(pathname: string, idToken: string): Promise<void> {
    const res = await fetch('/api/documents/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ pathname }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete document from storage (HTTP ${res.status})`);
    }
  }
}

export const vercelBlobStorage = new VercelBlobStorageProvider();
