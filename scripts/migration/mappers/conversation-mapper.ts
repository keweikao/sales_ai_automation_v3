// scripts/migration/mappers/conversation-mapper.ts

import type { NewConversation } from "../../../packages/db/src/schema";
import type { Timestamp } from "firebase-admin/firestore";
import type { FirestoreConversation } from "../types";

/**
 * V2 Conversation Status → V3 Status 映射
 */
export function mapConversationStatus(
  v2Status?: string
): NonNullable<NewConversation["status"]> {
  const mapping: Record<string, NonNullable<NewConversation["status"]>> = {
    pending: "pending",
    processing: "transcribing",
    transcribed: "analyzing",
    analyzed: "completed",
    completed: "completed",
    failed: "failed",
  };
  return mapping[v2Status || "pending"] || "pending";
}

/**
 * V2 Conversation Type → V3 Type 映射
 */
export function mapConversationType(
  v2Type?: string
): NonNullable<NewConversation["type"]> {
  const mapping: Record<string, NonNullable<NewConversation["type"]>> = {
    discovery: "discovery_call",
    discovery_call: "discovery_call",
    demo: "demo",
    follow_up: "follow_up",
    followup: "follow_up",
    negotiation: "negotiation",
    closing: "closing",
    support: "support",
  };
  return mapping[v2Type || "discovery_call"] || "discovery_call";
}

/**
 * 生成案件編號
 * 格式: YYYYMM-IC{序號}
 */
export function generateCaseNumber(
  createdAt?: Timestamp,
  sequence?: number
): string {
  const date = createdAt?.toDate() || new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const seq = sequence || Math.floor(Math.random() * 999);
  return `${yearMonth}-IC${String(seq).padStart(3, "0")}`;
}

/**
 * 將 Firestore Conversation 映射為 V3 Conversation
 */
export function mapConversation(
  docId: string,
  conv: FirestoreConversation,
  r2AudioUrl?: string,
  caseNumber?: string
): NewConversation {
  // 建立 transcript 物件
  const transcript = conv.transcript
    ? {
        segments: conv.transcript.segments || [],
        fullText: conv.transcript.full_text || "",
        language: conv.transcript.language || "zh-TW",
      }
    : null;

  // 建立 meddicAnalysis 物件（如果有分析資料）
  const meddicAnalysis = conv.analysis?.meddic_score
    ? {
        overallScore: conv.analysis.meddic_score,
        status: conv.analysis.qualification_status || "Unknown",
        dimensions: conv.analysis.buyer_signals || {},
      }
    : null;

  return {
    id: docId,
    opportunityId: conv.lead_id || "",
    caseNumber: caseNumber || generateCaseNumber(conv.created_at),
    title: conv.analysis?.store_name || `對話 ${docId.slice(0, 8)}`,
    type: mapConversationType(conv.type),
    status: mapConversationStatus(conv.status),

    // 音檔和轉錄
    audioUrl: r2AudioUrl || null,
    transcript,
    summary: conv.analysis?.executive_summary || null,
    duration: conv.transcript?.duration || null,

    // MEDDIC 分析
    meddicAnalysis,

    // V2 特有欄位
    progressScore: conv.analysis?.progress_score || null,
    coachingNotes: conv.analysis?.coaching_notes || null,
    urgencyLevel: conv.analysis?.urgency_level || null,
    storeName: conv.analysis?.store_name || null,

    // 時間
    conversationDate: conv.occurred_at?.toDate() || null,
    createdAt: conv.created_at?.toDate() || new Date(),
    updatedAt: conv.updated_at?.toDate() || new Date(),
  };
}
