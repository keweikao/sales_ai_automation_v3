/**
 * Groq Whisper Transcription Service
 * Ported from V2: infrastructure/services/transcription/providers/whisper.py
 *
 * Key Features (from V2):
 * - 228x realtime speed
 * - Auto-chunking for files >24MB or >10 minutes
 * - Chinese language optimization (language: 'zh')
 * - Cost: $0.04/hour (far cheaper than Deepgram)
 */

import Groq from "groq-sdk";
import type {
  AudioChunk,
  ChunkedTranscriptResult,
  TranscriptionOptions,
  TranscriptionService,
  TranscriptResult,
  TranscriptSegment,
} from "./types.js";

export class GroqWhisperService implements TranscriptionService {
  private readonly client: Groq;
  private readonly CHUNK_SIZE_BYTES = 24_000_000; // V2 logic: 24MB threshold
  private readonly MAX_FILE_SIZE = 25_000_000; // Groq's limit
  private readonly model = "whisper-large-v3-turbo";

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GROQ_API_KEY;

    if (!key) {
      throw new Error(
        "GROQ_API_KEY is required. Set it in environment variables or pass to constructor."
      );
    }

    this.client = new Groq({ apiKey: key });
  }

  /**
   * Transcribe audio file
   * Automatically chunks if needed (V2 logic)
   */
  async transcribe(
    audioBuffer: Buffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptResult> {
    const language = options?.language || "zh"; // V2 default: Chinese
    const chunkIfNeeded = options?.chunkIfNeeded ?? true; // V2 default: auto-chunk

    // V2 auto-chunking logic
    if (chunkIfNeeded && this.shouldChunk(audioBuffer)) {
      return this.transcribeChunked(audioBuffer, language);
    }

    // Single file transcription
    return this.transcribeSingle(audioBuffer, language, options);
  }

  /**
   * V2 logic: Check if file should be chunked
   * Threshold: >24MB
   */
  shouldChunk(buffer: Buffer): boolean {
    return buffer.length > this.CHUNK_SIZE_BYTES;
  }

  /**
   * Transcribe a single audio file (no chunking)
   */
  private async transcribeSingle(
    audioBuffer: Buffer,
    language: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptResult> {
    if (audioBuffer.length > this.MAX_FILE_SIZE) {
      throw new Error(
        `Audio file too large (${audioBuffer.length} bytes). ` +
          `Maximum is ${this.MAX_FILE_SIZE} bytes. Use chunkIfNeeded: true to auto-chunk.`
      );
    }

    // Create File object from Buffer
    // Convert Buffer to Uint8Array for proper type compatibility
    const uint8Array = new Uint8Array(audioBuffer);
    const file = new File([uint8Array], "audio.mp3", {
      type: "audio/mpeg",
    });

    // Filter response_format to only supported values
    const supportedFormats = ["json", "text", "verbose_json"] as const;
    type SupportedFormat = (typeof supportedFormats)[number];
    const responseFormat: SupportedFormat =
      options?.responseFormat &&
      supportedFormats.includes(options.responseFormat as SupportedFormat)
        ? (options.responseFormat as SupportedFormat)
        : "verbose_json";

    try {
      const response = await this.client.audio.transcriptions.create({
        file,
        model: this.model,
        language, // V2: Chinese optimization
        response_format: responseFormat,
        temperature: options?.temperature ?? 0.0, // V2 default: deterministic
      });

      // Type assertion for verbose_json response
      const verboseResponse = response as unknown as {
        text: string;
        segments?: Array<{
          start: number;
          end: number;
          text: string;
        }>;
        language?: string;
        duration?: number;
      };

      return {
        fullText: verboseResponse.text,
        segments: verboseResponse.segments?.map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        })),
        duration: verboseResponse.duration,
        language: verboseResponse.language || language,
      };
    } catch (error) {
      throw this.enhanceGroqError(error);
    }
  }

  /**
   * Transcribe large file with chunking
   * V2 implementation: Split → Parallel transcribe → Merge with timestamp adjustment
   */
  private async transcribeChunked(
    audioBuffer: Buffer,
    language: string
  ): Promise<ChunkedTranscriptResult> {
    const startTime = Date.now();

    // Step 1: Split audio into chunks
    const chunks = await this.splitAudio(audioBuffer);

    // Step 2: Transcribe chunks in parallel
    const transcriptPromises = chunks.map((chunk) =>
      this.transcribeSingle(chunk.buffer, language)
    );

    const transcriptResults = await Promise.all(transcriptPromises);

    // Step 3: Merge results and adjust timestamps
    let fullText = "";
    const allSegments: TranscriptSegment[] = [];
    let cumulativeTime = 0;

    for (const result of transcriptResults) {
      // Append text
      fullText += (fullText.length > 0 ? " " : "") + (result?.fullText ?? "");

      // Adjust segment timestamps based on chunk position
      if (result?.segments) {
        for (const segment of result.segments) {
          allSegments.push({
            start: segment.start + cumulativeTime,
            end: segment.end + cumulativeTime,
            text: segment.text,
          });
        }
      }

      cumulativeTime += result?.duration ?? 0;
    }

    const processingTime = Date.now() - startTime;

    return {
      fullText,
      segments: allSegments,
      duration: cumulativeTime,
      language,
      chunks: chunks.map((chunkItem, i) => {
        const transcriptResult = transcriptResults[i];
        return {
          index: chunkItem.index,
          startTime: chunkItem.startTime,
          endTime: chunkItem.endTime,
          text: transcriptResult?.fullText ?? "",
          duration: transcriptResult?.duration ?? 0,
        };
      }),
      totalChunks: chunks.length,
      processingTime,
    };
  }

  /**
   * Split audio buffer into chunks
   * V2 logic: Simple byte-based splitting
   *
   * Note: This is a simplified implementation
   * V2's Python version uses pydub for precise audio splitting at silence points
   * For production, consider using ffmpeg for better splitting
   */
  private async splitAudio(audioBuffer: Buffer): Promise<AudioChunk[]> {
    const chunks: AudioChunk[] = [];
    const chunkSize = this.CHUNK_SIZE_BYTES;
    let offset = 0;
    let index = 0;

    while (offset < audioBuffer.length) {
      const end = Math.min(offset + chunkSize, audioBuffer.length);
      const chunkBuffer = audioBuffer.slice(offset, end);

      // Estimate time based on byte position (rough approximation)
      // V2 uses actual audio duration analysis
      const startTime = (offset / audioBuffer.length) * 100; // Assume ~100 seconds total
      const endTime = (end / audioBuffer.length) * 100;

      chunks.push({
        buffer: chunkBuffer,
        startTime,
        endTime,
        index: index++,
      });

      offset = end;
    }

    return chunks;
  }

  /**
   * Enhanced error handling for Groq API errors
   * Provides clear Chinese error messages similar to Gemini client
   */
  private enhanceGroqError(error: unknown): Error {
    const message = this.formatGroqErrorMessage(error);

    // Create new error with enhanced message
    const enhancedError = new Error(message);

    // Preserve original error properties
    if (error && typeof error === "object") {
      Object.assign(enhancedError, error);
    }

    return enhancedError;
  }

  /**
   * Format Groq API error message with Chinese localization
   */
  private formatGroqErrorMessage(error: unknown): string {
    if (!error) {
      return "Unknown error";
    }

    if (typeof error === "string") {
      return error;
    }

    const err = error as {
      message?: string;
      status?: number;
      statusText?: string;
      code?: string;
      type?: string;
      error?: {
        message?: string;
        type?: string;
        code?: string;
      };
    };

    // Handle Groq SDK specific error structure
    if (err.error) {
      const errorType = err.error.type || err.error.code;
      const errorMessage = err.error.message || "";

      switch (errorType) {
        case "invalid_api_key":
        case "authentication_error":
          return "❌ API Key 無效 - 請檢查 GROQ_API_KEY 環境變數是否正確設定";
        case "insufficient_quota":
        case "quota_exceeded":
          return "⚠️ 配額已用盡 - 請稍後再試或升級您的 Groq API 方案";
        case "rate_limit_exceeded":
          return "⚠️ 請求頻率過高 - 請降低請求速度";
        case "invalid_request_error":
          return `❌ 請求參數錯誤 - ${errorMessage || "請檢查音檔格式和參數"}`;
        case "model_not_found":
          return `❌ 找不到模型 - 請確認模型名稱: ${this.model}`;
        case "file_too_large":
          return `❌ 音檔過大 - 最大限制 ${this.MAX_FILE_SIZE / 1_000_000}MB,請使用 chunkIfNeeded: true`;
        default:
          if (errorMessage) {
            return errorMessage;
          }
      }
    }

    // Handle HTTP status codes
    if (err.status) {
      const statusMessages: Record<number, string> = {
        400: "請求格式錯誤 - 請檢查音檔格式和參數",
        401: "認證失敗 - API Key 無效或缺失",
        403: "存取被拒絕 - 沒有權限使用此服務",
        404: "找不到資源 - 請確認 API 端點正確",
        413: "音檔過大 - 請使用較小的檔案或啟用分塊處理",
        429: "請求過於頻繁 - 已達速率限制",
        500: "Groq 伺服器內部錯誤",
        502: "Groq 伺服器無回應",
        503: "Groq 服務暫時無法使用",
      };

      const statusMsg = statusMessages[err.status] || err.statusText || "";
      const baseMsg = err.message || "";

      return `[${err.status}] ${statusMsg}${baseMsg ? `: ${baseMsg}` : ""}`;
    }

    // Fallback to standard error message
    if (err.message) {
      // Check for common error patterns in message
      const message = err.message.toLowerCase();

      if (message.includes("api key") || message.includes("unauthorized")) {
        return "❌ API Key 無效 - 請檢查 GROQ_API_KEY 環境變數是否正確設定";
      }

      if (message.includes("quota") || message.includes("limit")) {
        return "⚠️ 配額或限流錯誤 - 請稍後再試";
      }

      if (message.includes("file") && message.includes("large")) {
        return `❌ 音檔過大 - 最大限制 ${this.MAX_FILE_SIZE / 1_000_000}MB,請使用 chunkIfNeeded: true`;
      }

      return err.message;
    }

    return String(error);
  }
}

/**
 * Factory function for creating GroqWhisperService
 */
export function createGroqWhisperService(apiKey?: string): GroqWhisperService {
  return new GroqWhisperService(apiKey);
}
