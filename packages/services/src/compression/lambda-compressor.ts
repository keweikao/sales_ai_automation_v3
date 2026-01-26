/**
 * Lambda Audio Compressor Client
 *
 * 用於呼叫 AWS Lambda 音檔壓縮服務
 */

export type OutputMode = "base64" | "s3";

export interface CompressionResult {
  success: boolean;
  outputMode?: OutputMode;
  // Base64 模式回傳
  compressedAudioBase64?: string;
  // S3 模式回傳
  s3Key?: string;
  s3Bucket?: string;
  // 共用欄位
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  processingTime?: number;
  compressionTime?: number;
  error?: string;
}

export interface CompressionOptions {
  lambdaUrl: string;
  timeout?: number;
}

export interface CompressionRequestOptions {
  /** 輸出模式：base64 或 s3 (預設 base64) */
  outputMode?: OutputMode;
  /** 原始檔名 (用於 S3 key 生成) */
  fileName?: string;
}

export class LambdaAudioCompressor {
  private readonly lambdaUrl: string;
  private readonly timeout: number;

  constructor(options: CompressionOptions) {
    this.lambdaUrl = options.lambdaUrl;
    this.timeout = options.timeout || 30_000; // 預設 30 秒
  }

  /**
   * 壓縮音檔 (從 Base64)
   */
  async compressFromBase64(audioBase64: string): Promise<CompressionResult> {
    console.log("[LambdaCompressor] Starting compression from base64");
    console.log(
      `[LambdaCompressor] Input size: ${(Buffer.from(audioBase64, "base64").length / 1024 / 1024).toFixed(2)} MB`
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.lambdaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioBase64,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lambda returned ${response.status}: ${errorText}`);
      }

      const result = (await response.json()) as
        | CompressionResult
        | { body: string };

      if ("body" in result && result.body) {
        // Lambda Function URL 回傳格式
        const body = JSON.parse(result.body) as CompressionResult;
        console.log(
          `[LambdaCompressor] Compression completed: ${body.compressionRatio}% reduction`
        );
        return body;
      }

      const typedResult = result as CompressionResult;
      console.log(
        `[LambdaCompressor] Compression completed: ${typedResult.compressionRatio}% reduction`
      );
      return typedResult;
    } catch (error) {
      console.error("[LambdaCompressor] Compression failed:", error);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            success: false,
            error: `Compression timeout after ${this.timeout}ms`,
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: "Unknown compression error",
      };
    }
  }

  /**
   * 壓縮音檔 (從 Buffer)
   */
  async compressFromBuffer(audioBuffer: Buffer): Promise<CompressionResult> {
    const audioBase64 = audioBuffer.toString("base64");
    return this.compressFromBase64(audioBase64);
  }

  /**
   * 壓縮音檔 (從 URL)
   * @param audioUrl - 音檔 URL
   * @param options - 壓縮選項 (outputMode, fileName)
   */
  async compressFromUrl(
    audioUrl: string,
    options?: CompressionRequestOptions
  ): Promise<CompressionResult> {
    const outputMode = options?.outputMode || "base64";
    console.log(
      `[LambdaCompressor] Starting compression from URL: ${audioUrl}, outputMode: ${outputMode}`
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.lambdaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioUrl,
          outputMode,
          fileName: options?.fileName,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lambda returned ${response.status}: ${errorText}`);
      }

      const result = (await response.json()) as
        | CompressionResult
        | { body: string };

      if ("body" in result && result.body) {
        const body = JSON.parse(result.body) as CompressionResult;
        console.log(
          `[LambdaCompressor] Compression completed: ${body.compressionRatio}% reduction, outputMode: ${body.outputMode}`
        );
        return body;
      }

      const typedResult = result as CompressionResult;
      console.log(
        `[LambdaCompressor] Compression completed: ${typedResult.compressionRatio}% reduction, outputMode: ${typedResult.outputMode}`
      );
      return typedResult;
    } catch (error) {
      console.error("[LambdaCompressor] Compression failed:", error);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            success: false,
            error: `Compression timeout after ${this.timeout}ms`,
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: "Unknown compression error",
      };
    }
  }

  /**
   * 檢查 Lambda 健康狀態
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 發送小型測試請求
      const testAudio = Buffer.from("test").toString("base64");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 秒超時

      const response = await fetch(this.lambdaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioBase64: testAudio,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 即使壓縮失敗 (因為是無效音檔),只要 Lambda 有回應就算健康
      return response.status === 200 || response.status === 500;
    } catch (error) {
      console.error("[LambdaCompressor] Health check failed:", error);
      return false;
    }
  }
}

/**
 * 建立 Lambda Compressor 實例
 */
export function createLambdaCompressor(
  lambdaUrl: string,
  options?: { timeout?: number }
): LambdaAudioCompressor {
  return new LambdaAudioCompressor({
    lambdaUrl,
    ...options,
  });
}
