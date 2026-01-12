/**
 * Cloudflare R2 Storage Service
 * S3-compatible storage for audio files and transcripts
 *
 * Benefits over Google Cloud Storage (V2):
 * - No egress fees
 * - S3-compatible API
 * - Lower cost
 * - Better Cloudflare Workers integration
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageConfig, StorageService, UploadMetadata } from "./types.js";

export class R2StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl?: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;

    this.client = new S3Client({
      region: config.region || "auto", // R2 uses 'auto'
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    // Optional: Set public URL if bucket is public
    // Format: https://bucket-name.account-id.r2.cloudflarestorage.com
    if (config.endpoint.includes(".r2.cloudflarestorage.com")) {
      this.publicUrl = config.endpoint.replace("//", `//${this.bucket}.`);
    }
  }

  /**
   * Upload a file to R2
   */
  async upload(
    key: string,
    buffer: Buffer,
    metadata?: UploadMetadata
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: metadata?.contentType || "application/octet-stream",
      CacheControl: metadata?.cacheControl,
      ContentDisposition: metadata?.contentDisposition,
      Metadata: metadata?.customMetadata,
    });

    await this.client.send(command);

    // Return public URL or signed URL
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }

    // Generate signed URL (valid for 1 hour by default)
    return this.getSignedUrl(key, 3600);
  }

  /**
   * Download a file from R2
   */
  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }

    // Convert stream to buffer using AWS SDK v3's transformToByteArray
    const body = response.Body;

    // AWS SDK v3 SdkStreamMixin provides transformToByteArray
    if (
      body &&
      typeof body === "object" &&
      "transformToByteArray" in body &&
      typeof body.transformToByteArray === "function"
    ) {
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    }

    throw new Error("Unsupported response body type");
  }

  /**
   * Delete a file from R2
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Get a presigned URL for temporary access
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      // File not found returns 404
      if ((error as Error).name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Upload audio file with proper metadata
   */
  async uploadAudio(
    key: string,
    buffer: Buffer,
    metadata?: {
      duration?: number;
      format?: string;
      conversationId?: string;
      leadId?: string;
    }
  ): Promise<string> {
    const contentType = this.getAudioContentType(metadata?.format);

    return this.upload(key, buffer, {
      contentType,
      cacheControl: "public, max-age=31536000", // 1 year cache
      customMetadata: {
        duration: metadata?.duration?.toString() || "",
        format: metadata?.format || "",
        conversationId: metadata?.conversationId || "",
        leadId: metadata?.leadId || "",
      },
    });
  }

  /**
   * Get audio content type from format
   */
  private getAudioContentType(format?: string): string {
    const types: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      ogg: "audio/ogg",
      webm: "audio/webm",
    };

    return types[format || "mp3"] || "audio/mpeg";
  }

  /**
   * Test connection to R2
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to list objects (HeadBucket alternative)
      const testKey = `test-${Date.now()}.txt`;
      const testBuffer = Buffer.from("test");

      await this.upload(testKey, testBuffer);
      await this.delete(testKey);

      return true;
    } catch (error) {
      console.error("R2 connection test failed:", error);
      return false;
    }
  }
}

/**
 * Factory function for creating R2StorageService
 */
export function createR2Service(
  config?: Partial<StorageConfig>
): R2StorageService {
  const fullConfig: StorageConfig = {
    accessKeyId:
      config?.accessKeyId || process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
    secretAccessKey:
      config?.secretAccessKey || process.env.CLOUDFLARE_R2_SECRET_KEY || "",
    endpoint: config?.endpoint || process.env.CLOUDFLARE_R2_ENDPOINT || "",
    bucket: config?.bucket || process.env.CLOUDFLARE_R2_BUCKET || "",
    region: config?.region || "auto",
  };

  if (
    !(
      fullConfig.accessKeyId &&
      fullConfig.secretAccessKey &&
      fullConfig.endpoint &&
      fullConfig.bucket
    )
  ) {
    throw new Error(
      "Missing R2 configuration. Required env vars: CLOUDFLARE_R2_ACCESS_KEY, CLOUDFLARE_R2_SECRET_KEY, CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_BUCKET"
    );
  }

  return new R2StorageService(fullConfig);
}
