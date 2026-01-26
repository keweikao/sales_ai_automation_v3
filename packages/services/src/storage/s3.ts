/**
 * AWS S3 Storage Service
 *
 * 用於從 S3 下載和刪除壓縮後的音檔
 * 主要配合 Lambda Compressor 的 S3 輸出模式使用
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
}

export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucket;
  }

  /**
   * 從 S3 下載檔案
   * @param key - S3 object key
   * @returns 檔案內容 Buffer
   */
  async download(key: string): Promise<Buffer> {
    console.log(`[S3Service] Downloading from S3: ${this.bucket}/${key}`);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`S3 object not found: ${key}`);
    }

    // 將 ReadableStream 轉換為 Buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    console.log(
      `[S3Service] Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`
    );

    return buffer;
  }

  /**
   * 刪除 S3 檔案
   * @param key - S3 object key
   */
  async delete(key: string): Promise<void> {
    console.log(`[S3Service] Deleting from S3: ${this.bucket}/${key}`);

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
    console.log(`[S3Service] Deleted: ${key}`);
  }

  /**
   * 取得 bucket 名稱
   */
  getBucket(): string {
    return this.bucket;
  }
}

/**
 * 建立 S3 Storage Service 實例
 */
export function createS3Service(config: S3Config): S3StorageService {
  return new S3StorageService(config);
}
