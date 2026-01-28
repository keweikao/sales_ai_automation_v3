// scripts/migration/mappers/v3-cases-mapper.ts

import { randomUUID } from "node:crypto";
import type {
  NewConversation,
  NewMeddicAnalysis,
  NewOpportunity,
} from "../../../packages/db/src/schema";
import type { FirestoreV3Case } from "../types-v3-cases";

/**
 * Unit → Product Line 映射
 */
export function mapProductLine(unit: string): string {
  const mapping: Record<string, string> = {
    IC: "ichef",
    OC: "outchef",
  };
  return mapping[unit] || "ichef";
}

/**
 * Conversation Status 映射
 */
export function mapConversationStatus(
  status: string,
): NonNullable<NewConversation["status"]> {
  const mapping: Record<string, NonNullable<NewConversation["status"]>> = {
    pending: "pending",
    transcribing: "transcribing",
    transcribed: "analyzing",
    completed: "completed",
    failed: "failed",
  };
  return mapping[status] || "pending";
}

/**
 * Decision Maker Boolean → Text
 */
export function mapDecisionMaker(onsite?: boolean): string | null {
  if (onsite === true) return "yes";
  if (onsite === false) return "no";
  return "unknown";
}

/**
 * 轉換 Transcript 為 V3 格式
 */
export function convertTranscript(transcription?: {
  segments?: Array<{
    start: number;
    end: number;
    speaker: string;
    text: string;
  }>;
  text?: string;
}): object | null {
  if (!transcription?.segments) return null;

  return {
    segments: transcription.segments.map((seg) => ({
      speaker: seg.speaker || "Unknown",
      text: seg.text || "",
      start: seg.start || 0,
      end: seg.end || 0,
    })),
    fullText: transcription.text || "",
    language: "zh-TW",
  };
}

/**
 * 需要額外排除的客戶編號（用戶指定）
 */
const EXCLUDED_CUSTOMER_IDS = new Set([
  "102511-111888",
  "123456-789012",
  "201500-000001",
  "201700-000001",
  "202512-122807",
  "202512-000001",
  "202512-111111",
  "202512-111222",
]);

/**
 * 檢查客戶編號是否在排除列表中
 */
export function isExcludedCustomerId(customerId: string): boolean {
  return EXCLUDED_CUSTOMER_IDS.has(customerId);
}

/**
 * 檢查是否為測試資料
 * 根據 customerName 判斷是否包含測試相關關鍵字
 */
export function isTestData(customerName: string): boolean {
  if (!customerName) return false;

  const testKeywords = [
    "測試",
    "测试",
    "test",
    "demo",
    "sample",
    "範例",
    "范例",
    "樣本",
    "样本",
    "testing",
    "デモ",
    "テスト", // 日文測試關鍵字
  ];

  const lowerName = customerName.toLowerCase();
  return testKeywords.some((keyword) =>
    lowerName.includes(keyword.toLowerCase()),
  );
}

/**
 * 映射 Firestore Case → PostgreSQL Opportunity
 */
export function mapCaseToOpportunity(
  caseDoc: FirestoreV3Case,
  userId: string,
): NewOpportunity {
  const createdAt = caseDoc.createdAt?.toDate() || new Date();

  return {
    id: randomUUID(), // 明確生成 UUID
    userId,
    productLine: mapProductLine(caseDoc.unit),
    customerNumber: caseDoc.customerId, // 直接使用 V2 customerId
    companyName: caseDoc.customerName,
    contactName: null, // Firestore 無此欄位
    contactEmail: null, // schema 探索確認無此欄位
    contactPhone: caseDoc.customerPhone || null,
    source: "import",
    status: "contacted", // 預設為已聯絡

    // Demo 資訊 (僅 6% 有此資料)
    storeType: caseDoc.demoMeta?.storeType || null,
    serviceType: caseDoc.demoMeta?.serviceType || null,
    currentSystem: caseDoc.demoMeta?.currentPos || null,
    decisionMakerPresent: mapDecisionMaker(
      caseDoc.demoMeta?.decisionMakerOnsite,
    ),

    // 時間
    createdAt,
    updatedAt: caseDoc.updatedAt?.toDate() || createdAt,
  };
}

/**
 * 映射 Firestore Case → PostgreSQL Conversation
 */
export function mapCaseToConversation(
  caseDoc: FirestoreV3Case,
  opportunityId: string,
): NewConversation {
  const transcript = convertTranscript(caseDoc.transcription);
  const summary =
    caseDoc.analysis?.agents?.agent4?.data?.summary ||
    caseDoc.analysis?.agents?.agent4?.data?.executiveSummary ||
    null;

  const createdAt = caseDoc.createdAt?.toDate() || new Date();

  // 建立 MEDDIC Analysis 簡化版 (保留在 conversation.meddicAnalysis)
  const meddicAnalysis = caseDoc.analysis?.agents
    ? {
        status: caseDoc.analysis.status || "Unknown",
        agent1Context: caseDoc.analysis.agents.agent1?.data?.context || null,
        agent2BuyerScore: caseDoc.analysis.agents.agent2?.data?.score || null,
        agent3SellerScore: caseDoc.analysis.agents.agent3?.data?.score || null,
        agent4Summary: summary,
      }
    : null;

  return {
    id: randomUUID(), // 使用新的 UUID
    opportunityId,
    productLine: mapProductLine(caseDoc.unit),
    caseNumber: `M${caseDoc.caseId}`, // 加上 M 前綴（如 M202511-IC004）
    legacyCaseId: caseDoc.caseId, // 保留 V2 原始 caseId 供追溯
    title: caseDoc.customerName || `對話 ${caseDoc.caseId}`,
    type: "demo", // 預設為 Demo
    status: mapConversationStatus(caseDoc.status),

    // 音檔 (第一階段為 null)
    audioUrl: null,
    transcript,
    summary,
    duration: Math.round(caseDoc.audio?.duration || caseDoc.transcription?.duration || 0) || null,

    // MEDDIC Analysis (簡化版)
    meddicAnalysis,

    // V2 欄位 (V3 無對應,設為 null)
    progressScore: null,
    coachingNotes: null,
    urgencyLevel: null,

    // 其他
    storeName: caseDoc.customerName || null,
    slackChannelId: caseDoc.notification?.slackChannelId || null,
    slackThreadTs: caseDoc.notification?.slackThreadTs || null,
    slackUserId: caseDoc.salesRepSlackId || null,
    slackUsername: caseDoc.salesRepName || null,
    slackUserEmail: caseDoc.salesRepEmail || null, // 保留業務 Email

    // 時間
    conversationDate: createdAt,
    createdAt,
    updatedAt: caseDoc.updatedAt?.toDate() || createdAt,
  };
}

/**
 * 映射 Firestore Case Analysis → PostgreSQL MEDDIC Analysis
 */
export function mapCaseToMeddicAnalysis(
  caseDoc: FirestoreV3Case,
  conversationId: string,
  opportunityId: string,
): NewMeddicAnalysis | null {
  // 無分析資料則跳過
  if (!caseDoc.analysis?.agents) {
    return null;
  }

  const agents = caseDoc.analysis.agents;

  // 計算綜合分數
  // V3 cases 僅有 4 個 Agent,嘗試從 agent2 (Buyer) 和 agent3 (Seller) 計算
  const buyerScore = agents.agent2?.data?.score || 0;
  const sellerScore = agents.agent3?.data?.score || 0;
  const overallScore = Math.round((buyerScore + sellerScore) / 2);

  // 推斷狀態
  let status: "Strong" | "Medium" | "Weak" | "At Risk" = "Weak";
  if (overallScore >= 80) status = "Strong";
  else if (overallScore >= 60) status = "Medium";
  else if (overallScore >= 40) status = "Weak";
  else status = "At Risk";

  // 提取 key findings
  const keyFindings = agents.agent4?.data?.keyFindings || null;

  return {
    conversationId,
    opportunityId,
    productLine: mapProductLine(caseDoc.unit),

    // V3 cases 僅 4 個 Agent,MEDDIC 6 維度設為 null
    metricsScore: null,
    economicBuyerScore: null,
    decisionCriteriaScore: null,
    decisionProcessScore: null,
    identifyPainScore: null,
    championScore: null,

    overallScore,
    status,

    // 保留維度資料 (簡化版)
    dimensions: {
      context: agents.agent1?.data || null,
      buyer: agents.agent2?.data || null,
      seller: agents.agent3?.data || null,
      summary: agents.agent4?.data || null,
    },

    keyFindings,
    nextSteps: agents.agent4?.data?.nextSteps || null,
    risks: null, // V3 無此資料

    // 保留完整 Agent 輸出
    agentOutputs: {
      agent1: agents.agent1?.data || null,
      agent2: agents.agent2?.data || null,
      agent3: agents.agent3?.data || null,
      agent4: agents.agent4?.data || null,
      agent5: null, // V3 無 Coach Agent
      agent6: null, // V3 無 CRM Agent
    },

    createdAt: caseDoc.analysis.completedAt?.toDate() || new Date(),
  };
}
