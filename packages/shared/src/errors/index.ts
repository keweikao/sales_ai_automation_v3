/**
 * 應用程式錯誤類別
 * 提供統一的錯誤處理機制
 */

export type ErrorCode =
  | "AUDIO_TOO_LARGE"
  | "INVALID_AUDIO_FORMAT"
  | "FILE_DOWNLOAD_FAILED"
  | "TRANSCRIPTION_FAILED"
  | "TRANSCRIPTION_TIMEOUT"
  | "GROQ_API_ERROR"
  | "GEMINI_API_ERROR"
  | "DATABASE_ERROR"
  | "RECORD_NOT_FOUND"
  | "OPPORTUNITY_NOT_FOUND"
  | "UNAUTHORIZED"
  | "UNKNOWN_ERROR";

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  originalError?: unknown;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly originalError?: unknown;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 500,
    originalError?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      originalError:
        this.originalError instanceof Error
          ? {
              name: this.originalError.name,
              message: this.originalError.message,
            }
          : this.originalError,
      context: this.context,
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function formatErrorForUser(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "發生未預期的錯誤,請稍後再試";
}

export function formatErrorForLog(error: unknown): string {
  if (isAppError(error)) {
    const details = error.toJSON();
    return JSON.stringify(details, null, 2);
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ""}`;
  }
  return `Unknown error: ${JSON.stringify(error)}`;
}

export const errors = {
  AUDIO_TOO_LARGE: (fileSize: number, maxSize: number) =>
    new AppError(
      "AUDIO_TOO_LARGE",
      "音檔大小 " +
        (fileSize / 1024 / 1024).toFixed(2) +
        "MB 超過限制 " +
        maxSize +
        "MB",
      400,
      undefined,
      { fileSize, maxSize }
    ),

  INVALID_AUDIO_FORMAT: (format: string) =>
    new AppError(
      "INVALID_AUDIO_FORMAT",
      `不支援的音檔格式: ${format}。支援格式: mp3, wav, m4a, ogg`,
      400,
      undefined,
      { format }
    ),

  FILE_DOWNLOAD_FAILED: (url: string, originalError?: unknown) =>
    new AppError(
      "FILE_DOWNLOAD_FAILED",
      "音檔下載失敗,請稍後再試",
      500,
      originalError,
      { url }
    ),

  TRANSCRIPTION_FAILED: (originalError?: unknown) =>
    new AppError(
      "TRANSCRIPTION_FAILED",
      "音檔轉錄失敗,請檢查音檔品質或稍後再試",
      500,
      originalError
    ),

  TRANSCRIPTION_TIMEOUT: (duration: number) =>
    new AppError(
      "TRANSCRIPTION_TIMEOUT",
      `轉錄處理超時(${duration}秒),音檔可能過大或過於複雜`,
      504,
      undefined,
      { duration }
    ),

  GROQ_API_ERROR: (originalError?: unknown) =>
    new AppError(
      "GROQ_API_ERROR",
      "Groq API 呼叫失敗,請稍後再試",
      502,
      originalError
    ),

  GEMINI_API_ERROR: (originalError?: unknown) =>
    new AppError(
      "GEMINI_API_ERROR",
      "Gemini API 呼叫失敗,請稍後再試",
      502,
      originalError
    ),

  DATABASE_ERROR: (operation: string, originalError?: unknown) =>
    new AppError(
      "DATABASE_ERROR",
      `資料庫操作失敗: ${operation}`,
      500,
      originalError,
      { operation }
    ),

  RECORD_NOT_FOUND: (recordType: string, id: string) =>
    new AppError(
      "RECORD_NOT_FOUND",
      `找不到指定的${recordType}: ${id}`,
      404,
      undefined,
      { recordType, id }
    ),

  OPPORTUNITY_NOT_FOUND: (opportunityId: string) =>
    new AppError(
      "OPPORTUNITY_NOT_FOUND",
      `找不到指定的商機: ${opportunityId}`,
      404,
      undefined,
      { opportunityId }
    ),

  UNAUTHORIZED: (reason?: string) =>
    new AppError("UNAUTHORIZED", reason || "未授權的操作", 401, undefined, {
      reason,
    }),

  UNKNOWN_ERROR: (originalError?: unknown) =>
    new AppError("UNKNOWN_ERROR", "發生未知錯誤", 500, originalError),
} as const;
