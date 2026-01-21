// scripts/migration/mappers/v2-mapper.ts
/**
 * V2 Cases → V3 Opportunities/Conversations Mapper
 */

import type {
  NewConversation,
  NewOpportunity,
} from "../../../packages/db/src/schema";
import type { V2Case } from "../types-v2";

/**
 * 正規化 customerId - 將 Unicode 破折號轉換為 ASCII 破折號
 * U+2010 (‐) → U+002D (-)
 * U+2011 (‑) → U+002D (-)
 * U+2012 (‒) → U+002D (-)
 * U+2013 (–) → U+002D (-)
 * U+2014 (—) → U+002D (-)
 */
export function normalizeCustomerId(customerId: string): string {
  if (!customerId) {
    return customerId;
  }
  // 替換所有 Unicode 破折號變體為 ASCII 破折號
  return customerId.replace(/[\u2010-\u2014\u2212\uFE58\uFE63\uFF0D]/g, "-");
}

/**
 * V2 Case Status → V3 Conversation Status 映射
 */
function mapCaseStatus(
  v2Status: string
): NonNullable<NewConversation["status"]> {
  const mapping: Record<string, NonNullable<NewConversation["status"]>> = {
    pending: "pending",
    processing: "transcribing",
    transcribing: "transcribing",
    transcribed: "analyzing",
    analyzing: "analyzing",
    analyzed: "completed",
    completed: "completed",
    failed: "failed",
  };
  return mapping[v2Status] || "pending";
}

/**
 * 從 customerId 提取公司資訊，建立 Opportunity
 * 一個 customerId 對應一個 Opportunity，可能有多個 Conversations
 */
export function mapCaseToOpportunity(
  v2Case: V2Case,
  userId: string
): NewOpportunity {
  // 正規化 customerId（處理 Unicode 破折號）
  const normalizedCustomerId = normalizeCustomerId(v2Case.customerId);

  // 使用正規化後的 customerId 作為 opportunity id（確保同一客戶只有一個 opportunity）
  const opportunityId = normalizedCustomerId;

  // 從 caseId 提取日期作為 customerNumber
  // e.g., "202511-IC004" → "202511-122188"
  const customerNumber = normalizedCustomerId;

  return {
    id: opportunityId,
    userId,
    customerNumber,
    companyName: v2Case.customerName || `客戶 ${v2Case.customerId}`,
    contactName: null,
    contactEmail: null,
    contactPhone: v2Case.customerPhone || null,

    source: v2Case.sourceType === "slack" ? "api" : "manual",
    status: "new",

    // 時間戳
    createdAt: v2Case.createdAt?.toDate() || new Date(),
    updatedAt: v2Case.updatedAt?.toDate() || new Date(),
  };
}

/**
 * 將 V2 Case 映射為 V3 Conversation
 */
export function mapCaseToConversation(
  v2Case: V2Case,
  opportunityId: string,
  audioUrl?: string
): NewConversation {
  // 建立 transcript 物件
  const transcript = v2Case.transcription?.segments
    ? {
        segments: v2Case.transcription.segments,
        fullText: v2Case.transcription.fullText || "",
        language: v2Case.transcription.language || "zh-TW",
      }
    : null;

  // 處理 duration - 確保是整數
  const duration = v2Case.audio?.duration
    ? Math.round(v2Case.audio.duration)
    : null;

  return {
    id: v2Case.caseId,
    opportunityId,
    caseNumber: v2Case.caseId,
    title: `${v2Case.customerName} - ${v2Case.salesRepName}`,
    type: "discovery_call",
    status: mapCaseStatus(v2Case.status),

    // 音檔和轉錄
    audioUrl: audioUrl || null,
    transcript,
    summary: null,
    duration,

    // V2 特有欄位
    progressScore: null,
    coachingNotes: v2Case.notes || null,
    urgencyLevel: null,
    storeName: v2Case.customerName || null,

    // 時間
    conversationDate: v2Case.createdAt?.toDate() || null,
    createdAt: v2Case.createdAt?.toDate() || new Date(),
    updatedAt: v2Case.updatedAt?.toDate() || new Date(),
  };
}

/**
 * 從多個 cases 中提取唯一的 opportunities
 */
export function extractUniqueOpportunities(
  cases: V2Case[],
  userId: string
): Map<string, NewOpportunity> {
  const opportunities = new Map<string, NewOpportunity>();

  for (const v2Case of cases) {
    const customerId = v2Case.customerId;
    if (!customerId) {
      continue;
    }

    // 正規化 customerId
    const normalizedCustomerId = normalizeCustomerId(customerId);
    if (!normalizedCustomerId) {
      continue;
    }

    // 如果這個正規化後的 customerId 還沒有 opportunity，就建立一個
    if (!opportunities.has(normalizedCustomerId)) {
      opportunities.set(
        normalizedCustomerId,
        mapCaseToOpportunity(v2Case, userId)
      );
    }
  }

  return opportunities;
}
