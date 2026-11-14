/**
 * HanuJai High School ERP — Storage Provider Abstraction Interface
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 *
 * Decouples the application UI and domain logic from specific cloud storage providers
 * (e.g. Vercel Private Blob, AWS S3).
 *
 * Security Requirements:
 * - Tokens are strictly passed via HTTP Authorization: Bearer <idToken> headers.
 * - Sensitive tokens are NEVER embedded in URLs, query strings, or client logs.
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
  idToken: string;
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
   * Returns the clean canonical serverless endpoint path for the document.
   * Note: NEVER appends authentication tokens to URL query parameters.
   */
  getFileDownloadUrl(pathname: string): Promise<string>;

  /**
   * Fetches the private document binary using Bearer token authentication.
   */
  fetchFileBinary(pathname: string, idToken: string): Promise<Blob>;

  /**
   * Deletes a student document binary from private cloud storage.
   */
  deleteFile(pathname: string, idToken: string): Promise<void>;
}
