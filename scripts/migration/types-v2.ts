// scripts/migration/types-v2.ts
/**
 * V2 Firestore 資料結構（基於 cases 集合）
 */

import type { Timestamp } from "firebase-admin/firestore";

/**
 * V2 Case 資料結構
 */
export interface V2Case {
  // 基本資訊
  caseId: string; // e.g., "202511-IC004"
  customerId: string; // e.g., "202511-122188"
  customerName: string; // e.g., "冰"
  customerPhone?: string;

  // 業務代表資訊
  salesRepName: string;
  salesRepEmail: string;
  salesRepSlackId?: string;
  unit: string; // e.g., "IC"

  // 狀態
  status: string; // "completed", "pending", "processing", etc.
  sourceType: string; // "slack", "manual", etc.
  retryCount?: number;
  notes?: string;

  // 通知資訊
  notification?: {
    slackChannelId?: string;
    slackThreadTs?: string;
    messageTs?: string;
    slackFileId?: string;
  };

  // 音檔資訊
  audio?: {
    url?: string;
    duration?: number;
    mimeType?: string;
    fileSize?: number;
  };

  // 轉錄結果
  transcription?: {
    segments?: Array<{
      speaker: string;
      text: string;
      start: number;
      end: number;
    }>;
    fullText?: string;
    language?: string;
  };

  // 分析結果（可能是扁平化或嵌套的）
  analysis?: {
    meddic?: {
      overallScore?: number;
      dimensions?: Record<string, number>;
    };
    summary?: string;
    coachingNotes?: string;
    qualification?: string;
  };

  // 元資料
  metadata?: Record<string, unknown>;

  // 時間戳
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * 從扁平化的 Firestore 資料轉換為結構化的 V2Case
 */
export function parseV2Case(docId: string, data: Record<string, unknown>): V2Case {
  // 處理可能的扁平化欄位（如 analysis.transcription.step）
  const transcription = data.transcription as V2Case["transcription"] | undefined;
  const audio = data.audio as V2Case["audio"] | undefined;
  const notification = data.notification as V2Case["notification"] | undefined;

  return {
    caseId: (data.caseId as string) || docId,
    customerId: (data.customerId as string) || "",
    customerName: (data.customerName as string) || "",
    customerPhone: data.customerPhone as string | undefined,

    salesRepName: (data.salesRepName as string) || "",
    salesRepEmail: (data.salesRepEmail as string) || "",
    salesRepSlackId: data.salesRepSlackId as string | undefined,
    unit: (data.unit as string) || "",

    status: (data.status as string) || "pending",
    sourceType: (data.sourceType as string) || "unknown",
    retryCount: data.retryCount as number | undefined,
    notes: data.notes as string | undefined,

    notification,
    audio,
    transcription,
    metadata: data.metadata as Record<string, unknown> | undefined,

    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}
