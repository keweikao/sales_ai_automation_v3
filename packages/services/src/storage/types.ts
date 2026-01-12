/**
 * Type definitions for storage services
 * S3-compatible interface for Cloudflare R2
 */

export interface StorageService {
  /**
   * Upload a file to storage
   * @param key Unique key/path for the file
   * @param buffer File content as Buffer
   * @param metadata Optional metadata
   * @returns The full URL of the uploaded file
   */
  upload(
    key: string,
    buffer: Buffer,
    metadata?: UploadMetadata
  ): Promise<string>;

  /**
   * Download a file from storage
   * @param key File key/path
   * @returns File content as Buffer
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param key File key/path
   */
  delete(key: string): Promise<void>;

  /**
   * Get a presigned URL for temporary access
   * @param key File key/path
   * @param expiresIn Expiration time in seconds (default: 3600)
   * @returns Presigned URL
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Check if a file exists
   * @param key File key/path
   * @returns True if file exists
   */
  exists(key: string): Promise<boolean>;
}

export interface UploadMetadata {
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
  customMetadata?: Record<string, string>;
}

export interface StorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
  region?: string; // Default: 'auto' for R2
}

// ============================================================
// Audio File Storage Specific
// ============================================================

export interface AudioFileMetadata extends UploadMetadata {
  duration?: number;
  format?: string; // mp3, wav, m4a, etc.
  size?: number; // bytes
  uploadedBy?: string;
  conversationId?: string;
  leadId?: string;
}

/**
 * Generate storage key for audio files
 * Format: audio/{leadId}/{conversationId}/{timestamp}.{ext}
 */
export function generateAudioKey(
  leadId: string,
  conversationId: string,
  extension = "mp3"
): string {
  const timestamp = Date.now();
  return `audio/${leadId}/${conversationId}/${timestamp}.${extension}`;
}

/**
 * Generate storage key for transcript files
 * Format: transcripts/{leadId}/{conversationId}.json
 */
export function generateTranscriptKey(
  leadId: string,
  conversationId: string
): string {
  return `transcripts/${leadId}/${conversationId}.json`;
}
