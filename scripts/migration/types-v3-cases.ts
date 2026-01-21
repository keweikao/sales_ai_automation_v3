// scripts/migration/types-v3-cases.ts

import type { Timestamp } from "firebase-admin/firestore";

/**
 * Firestore V3 Cases 結構
 * 基於實際 schema 探索結果 (50 筆樣本分析)
 */
export interface FirestoreV3Case {
  // 基本資訊
  caseId: string; // Document ID, 格式: YYYYMM-IC###
  status: string; // pending, transcribing, transcribed, completed, failed
  sourceType?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // 客戶資訊 (98% 覆蓋率)
  customerName: string; // 例: "冰"
  customerId: string; // 例: "202511-122188" (等同於 caseId)
  customerPhone?: string; // 98% 有此欄位但常為空字串
  // 注意: customerEmail 不存在於 Firestore

  // 業務資訊 (98% 覆蓋率)
  salesRepName: string; // 例: "Stephen 高克瑋"
  salesRepEmail?: string; // 例: "stephen.kao@ichef.com.tw"
  salesRepSlackId: string; // 例: "U0BU3PESX"

  // 上傳者資訊 (74-76% 覆蓋率)
  uploadedBy?: string;
  uploadedByName?: string;
  uploadedBySlackName?: string;

  // 產品線 (98% 覆蓋率)
  unit: string; // "IC" 或 "OC"

  // 音檔資訊 (94% 覆蓋率)
  audio?: {
    fileName?: string;
    slackFileId?: string;
    fileSize?: number;
    duration?: number; // 秒數
    gcsPath?: string; // 例: "gs://sales-ai-audio-bucket/slack/..."
    uploadedAt?: Timestamp;
  };

  // 通知設定 (高覆蓋率)
  notification?: {
    slackChannelId?: string; // 例: "D090A46LDM0"
    slackThreadTs?: string; // 例: "1763197433.161629"
    slackFileId?: string;
    messageTs?: string;
  };

  // Metadata
  metadata?: {
    ingestSource?: string; // 例: "slack"
    version?: string;
  };

  // Demo 資訊 (6% 覆蓋率 - 選填)
  demoMeta?: {
    storeType?: string;
    serviceType?: string;
    decisionMakerOnsite?: boolean;
    currentPos?: string; // 現有系統
    staffCount?: string;
    location?: string;
    industry?: string;
  };

  // 轉錄結果 (高覆蓋率)
  transcription?: {
    text?: string; // 完整文字
    segments?: Array<{
      start: number;
      end: number;
      speaker: string;
      text: string;
    }>;
    speakers?: string[];
    language?: string;
    duration?: number;
  };

  // 分析結果 (72% 覆蓋率)
  analysis?: {
    status?: string;
    completedAt?: Timestamp;
    // V3 僅有 4 個 Agent (agent1-4)
    agents?: {
      agent1?: {
        // Context Agent
        status: string;
        startedAt?: Timestamp;
        completedAt?: Timestamp;
        data?: {
          context?: string;
          keyPoints?: string[];
          [key: string]: unknown;
        };
      };
      agent2?: {
        // Buyer Agent
        status: string;
        startedAt?: Timestamp;
        completedAt?: Timestamp;
        data?: {
          score?: number;
          signals?: unknown;
          [key: string]: unknown;
        };
      };
      agent3?: {
        // Seller Agent
        status: string;
        startedAt?: Timestamp;
        completedAt?: Timestamp;
        data?: {
          score?: number;
          performance?: unknown;
          [key: string]: unknown;
        };
      };
      agent4?: {
        // Summary Agent
        status: string;
        startedAt?: Timestamp;
        completedAt?: Timestamp;
        data?: {
          summary?: string;
          executiveSummary?: string;
          keyFindings?: string[];
          nextSteps?: string[];
          [key: string]: unknown;
        };
      };
    };
    // 可能的額外欄位
    customerSummary?: {
      markdown?: string;
      subject?: string;
      html?: string;
    };
  };
}

/**
 * V3 Cases 遷移統計
 */
export interface V3MigrationStats {
  opportunities: {
    total: number;
    created: number;
    skipped: number; // 已存在的 customerId
    errors: Array<{ customerId: string; error: string }>;
  };
  conversations: {
    total: number;
    success: number;
    failed: number;
    errors: Array<{ caseId: string; error: string }>;
  };
  meddicAnalyses: {
    total: number;
    success: number;
    skipped: number; // 無分析資料
    failed: number;
    errors: Array<{ caseId: string; error: string }>;
  };
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

/**
 * 用戶映射快取項目
 */
export interface UserMappingEntry {
  slackUserId: string;
  userId: string;
  displayName?: string;
}
