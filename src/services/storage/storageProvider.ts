/**
 * HanuJai High School ERP — Storage Provider Abstraction Interface
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Decouples the application UI and domain logic from specific cloud storage providers
 * (e.g. Vercel Private Blob, Firebase Storage, AWS S3).
 *
 * Future migrations (e.g. to AWS S3 when the school's document volume exceeds Vercel limits)
 * only require implementing this interface without altering student records, metadata,
 * or UI components.
 */

export interface StorageUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface StorageUploadOptions {
  studentId: string;
  documentType: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  actorId: string;
  actorRole: string;
  idToken?: string;
  onProgress?: (progress: StorageUploadProgress) => void;
}

export interface StorageUploadResult {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
}

export interface StorageProvider {
  readonly name: string;

  /**
   * Uploads a student document binary to private cloud storage.
   */
  uploadFile(file: File | Blob, options: StorageUploadOptions): Promise<StorageUploadResult>;

  /**
   * Generates or resolves the authenticated URL for streaming or downloading a private document.
   */
  getFileDownloadUrl(pathname: string, idToken?: string, isDownload?: boolean): Promise<string>;

  /**
   * Deletes a student document binary from private cloud storage.
   */
  deleteFile(pathname: string, idToken?: string): Promise<void>;
}
