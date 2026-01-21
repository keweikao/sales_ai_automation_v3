// scripts/migration/mappers/meddic-mapper.ts

import type { NewMeddicAnalysis } from "../../../packages/db/src/schema";
import type { FirestoreConversation } from "../types";

/**
 * V2 Qualification Status → V3 Status 映射
 */
export function mapMeddicStatus(
  v2Status?: string
): NewMeddicAnalysis["status"] {
  const mapping: Record<string, string> = {
    Qualified: "Strong",
    "Partially Qualified": "Medium",
    "Not Qualified": "Weak",
    "At Risk": "At Risk",
  };
  return (mapping[v2Status || ""] as NewMeddicAnalysis["status"]) || null;
}

/**
 * 從 V2 agent_data.buyer 提取 MEDDIC 維度分數
 */
export function extractMeddicScores(conv: FirestoreConversation): {
  metricsScore: number | null;
  economicBuyerScore: number | null;
  decisionCriteriaScore: number | null;
  decisionProcessScore: number | null;
  identifyPainScore: number | null;
  championScore: number | null;
} {
  const buyerData = conv.analysis?.agent_data?.buyer as
    | Record<string, unknown>
    | undefined;

  if (!buyerData) {
    return {
      metricsScore: null,
      economicBuyerScore: null,
      decisionCriteriaScore: null,
      decisionProcessScore: null,
      identifyPainScore: null,
      championScore: null,
    };
  }

  // V2 的 meddic_scores 結構
  const scores = buyerData.meddic_scores as Record<string, number> | undefined;

  return {
    metricsScore: scores?.metrics ?? null,
    economicBuyerScore: scores?.economic_buyer ?? null,
    decisionCriteriaScore: scores?.decision_criteria ?? null,
    decisionProcessScore: scores?.decision_process ?? null,
    identifyPainScore: scores?.identify_pain ?? null,
    championScore: scores?.champion ?? null,
  };
}

/**
 * 提取 Key Findings
 */
export function extractKeyFindings(conv: FirestoreConversation): string[] {
  const summaryData = conv.analysis?.agent_data?.summary as
    | Record<string, unknown>
    | undefined;

  if (summaryData?.key_findings && Array.isArray(summaryData.key_findings)) {
    return summaryData.key_findings as string[];
  }

  // 嘗試從 buyer_signals 提取
  const buyerSignals = conv.analysis?.buyer_signals as
    | Record<string, unknown>
    | undefined;
  if (buyerSignals?.key_insights && Array.isArray(buyerSignals.key_insights)) {
    return buyerSignals.key_insights as string[];
  }

  return [];
}

/**
 * 提取 Next Steps
 */
export function extractNextSteps(conv: FirestoreConversation): Array<{
  action: string;
  priority: string;
  owner?: string;
}> {
  const coachData = conv.analysis?.agent_data?.coach as
    | Record<string, unknown>
    | undefined;

  if (coachData?.next_steps && Array.isArray(coachData.next_steps)) {
    return (coachData.next_steps as Record<string, unknown>[]).map((step) => ({
      action: String(step.action || step.description || ""),
      priority: String(step.priority || "medium"),
      owner: step.owner ? String(step.owner) : undefined,
    }));
  }

  return [];
}

/**
 * 提取 Risks
 */
export function extractRisks(conv: FirestoreConversation): Array<{
  risk: string;
  severity: string;
  mitigation?: string;
}> {
  const sellerData = conv.analysis?.agent_data?.seller as
    | Record<string, unknown>
    | undefined;

  if (sellerData?.risks && Array.isArray(sellerData.risks)) {
    return (sellerData.risks as Record<string, unknown>[]).map((risk) => ({
      risk: String(risk.description || risk.risk || ""),
      severity: String(risk.severity || "medium"),
      mitigation: risk.mitigation ? String(risk.mitigation) : undefined,
    }));
  }

  return [];
}

/**
 * 建立 dimensions 物件
 */
export function buildDimensions(
  conv: FirestoreConversation
): Record<
  string,
  { evidence: string[]; gaps: string[]; recommendations: string[] }
> | null {
  const buyerSignals = conv.analysis?.buyer_signals as
    | Record<string, unknown>
    | undefined;

  if (!buyerSignals) {
    return null;
  }

  // 嘗試從 buyer_signals 建立 dimensions 結構
  const dimensions: Record<
    string,
    { evidence: string[]; gaps: string[]; recommendations: string[] }
  > = {};

  const dimensionKeys = [
    "metrics",
    "economic_buyer",
    "decision_criteria",
    "decision_process",
    "identify_pain",
    "champion",
  ];

  for (const key of dimensionKeys) {
    const data = buyerSignals[key] as Record<string, unknown> | undefined;
    if (data) {
      dimensions[key] = {
        evidence: Array.isArray(data.evidence)
          ? (data.evidence as string[])
          : [],
        gaps: Array.isArray(data.gaps) ? (data.gaps as string[]) : [],
        recommendations: Array.isArray(data.recommendations)
          ? (data.recommendations as string[])
          : [],
      };
    }
  }

  return Object.keys(dimensions).length > 0 ? dimensions : null;
}

/**
 * 將 Firestore Conversation 中的分析映射為 V3 MEDDIC Analysis
 */
export function mapMeddicAnalysis(
  docId: string,
  conv: FirestoreConversation,
  opportunityId: string
): NewMeddicAnalysis | null {
  const analysis = conv.analysis;

  // 如果沒有分析資料，跳過
  if (!analysis || analysis.meddic_score === undefined) {
    return null;
  }

  const scores = extractMeddicScores(conv);

  return {
    id: `meddic_${docId}_${Date.now()}`,
    conversationId: docId,
    opportunityId,

    // 維度分數
    ...scores,

    // 整體評分
    overallScore: analysis.meddic_score,
    status: mapMeddicStatus(analysis.qualification_status),

    // 詳細分析
    dimensions: buildDimensions(conv),
    keyFindings: extractKeyFindings(conv),
    nextSteps: extractNextSteps(conv),
    risks: extractRisks(conv),

    // V2 Agent 輸出
    agentOutputs: analysis.agent_data
      ? {
          agent1: analysis.agent_data.context,
          agent2: analysis.agent_data.buyer,
          agent3: analysis.agent_data.seller,
          agent4: analysis.agent_data.summary,
          agent5: analysis.agent_data.crm,
          agent6: analysis.agent_data.coach,
        }
      : null,

    createdAt: conv.updated_at?.toDate() || new Date(),
  };
}
