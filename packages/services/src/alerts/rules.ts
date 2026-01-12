import type { AlertResult, AlertRule, EvaluationContext } from "./types";

/**
 * 檢查是否有明確的購買訊號
 */
function hasExplicitBuyingSignal(
  analysis: EvaluationContext["meddicAnalysis"]
): boolean {
  const keyFindings = analysis.keyFindings || [];
  const buyingKeywords = [
    "預算",
    "budget",
    "採購",
    "購買",
    "簽約",
    "合約",
    "時程",
    "時間表",
    "timeline",
    "導入",
    "實施",
  ];

  return keyFindings.some((finding) =>
    buyingKeywords.some((keyword) =>
      finding.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

/**
 * Close Now 規則
 * 觸發條件：MEDDIC >= 80 且有 Champion 且有明確購買訊號
 */
const closeNowRule: AlertRule = {
  type: "close_now",
  name: "Close Now 機會",
  description: "高分商機，建議立即跟進成交",
  evaluate: (ctx: EvaluationContext): AlertResult | null => {
    const { meddicAnalysis, opportunityName } = ctx;

    const hasHighScore = meddicAnalysis.overallScore >= 80;
    const hasChampion = (meddicAnalysis.championScore ?? 0) >= 4;
    const hasBuyingSignal = hasExplicitBuyingSignal(meddicAnalysis);

    if (hasHighScore && hasChampion && hasBuyingSignal) {
      return {
        type: "close_now",
        severity: "high",
        title: "Close Now 機會！",
        message: `${opportunityName} MEDDIC 分數達 ${meddicAnalysis.overallScore}，有明確購買訊號，建議立即安排成交會議！`,
        context: {
          meddicScore: meddicAnalysis.overallScore,
          dimensionScores: {
            metrics: meddicAnalysis.metricsScore ?? 0,
            economicBuyer: meddicAnalysis.economicBuyerScore ?? 0,
            decisionCriteria: meddicAnalysis.decisionCriteriaScore ?? 0,
            decisionProcess: meddicAnalysis.decisionProcessScore ?? 0,
            identifyPain: meddicAnalysis.identifyPainScore ?? 0,
            champion: meddicAnalysis.championScore ?? 0,
          },
          triggerReason: "高分 + Champion + 明確購買訊號",
          suggestedAction: "立即安排簽約/成交會議",
        },
      };
    }

    return null;
  },
};

/**
 * Missing DM 規則
 * 觸發條件：Economic Buyer 分數 <= 2 且已有 2 次以上對話
 */
const missingDmRule: AlertRule = {
  type: "missing_dm",
  name: "缺少決策者",
  description: "多次對話但尚未接觸經濟決策者",
  evaluate: (ctx: EvaluationContext): AlertResult | null => {
    const { meddicAnalysis, opportunityName, conversationCount } = ctx;

    const lowEconomicBuyer = (meddicAnalysis.economicBuyerScore ?? 0) <= 2;
    const hasMultipleConversations = conversationCount >= 2;

    if (lowEconomicBuyer && hasMultipleConversations) {
      return {
        type: "missing_dm",
        severity: "medium",
        title: "缺少經濟決策者",
        message: `${opportunityName} 已進行 ${conversationCount} 次對話，但尚未有效接觸經濟決策者（分數: ${meddicAnalysis.economicBuyerScore}/5）`,
        context: {
          meddicScore: meddicAnalysis.overallScore,
          dimensionScores: {
            metrics: meddicAnalysis.metricsScore ?? 0,
            economicBuyer: meddicAnalysis.economicBuyerScore ?? 0,
            decisionCriteria: meddicAnalysis.decisionCriteriaScore ?? 0,
            decisionProcess: meddicAnalysis.decisionProcessScore ?? 0,
            identifyPain: meddicAnalysis.identifyPainScore ?? 0,
            champion: meddicAnalysis.championScore ?? 0,
          },
          triggerReason: `多次對話(${conversationCount})但 Economic Buyer 分數過低(${meddicAnalysis.economicBuyerScore}/5)`,
          suggestedAction: "詢問決策流程，要求內部支持者引薦決策者",
          relatedData: {
            conversationCount,
          },
        },
      };
    }

    return null;
  },
};

/**
 * Manager Escalation 規則
 * 觸發條件：連續 3 次 MEDDIC 分數 < 40
 */
const managerAlertRule: AlertRule = {
  type: "manager_escalation",
  name: "主管關注",
  description: "連續低分，需要主管介入",
  evaluate: (ctx: EvaluationContext): AlertResult | null => {
    const { recentScores, opportunityName, meddicAnalysis } = ctx;

    // 檢查最近 3 次分數是否都低於 40
    const last3Scores = recentScores.slice(0, 3);
    const allLowScores =
      last3Scores.length >= 3 && last3Scores.every((s) => s < 40);

    if (allLowScores) {
      return {
        type: "manager_escalation",
        severity: "high",
        title: "需要主管關注",
        message: `${opportunityName} 連續 3 次 MEDDIC 分數低於 40（最近分數: ${last3Scores.join(", ")}），建議主管介入檢討`,
        context: {
          meddicScore: meddicAnalysis.overallScore,
          dimensionScores: {
            metrics: meddicAnalysis.metricsScore ?? 0,
            economicBuyer: meddicAnalysis.economicBuyerScore ?? 0,
            decisionCriteria: meddicAnalysis.decisionCriteriaScore ?? 0,
            decisionProcess: meddicAnalysis.decisionProcessScore ?? 0,
            identifyPain: meddicAnalysis.identifyPainScore ?? 0,
            champion: meddicAnalysis.championScore ?? 0,
          },
          triggerReason: `連續 3 次低分: ${last3Scores.join(", ")}`,
          suggestedAction: "主管與業務一對一檢討，調整銷售策略或考慮放棄",
          relatedData: {
            recentScores: last3Scores,
          },
        },
      };
    }

    return null;
  },
};

// 導出所有規則
export const ALERT_RULES: AlertRule[] = [
  closeNowRule,
  missingDmRule,
  managerAlertRule,
];

export { closeNowRule, managerAlertRule, missingDmRule };
