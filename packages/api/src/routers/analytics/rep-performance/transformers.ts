/**
 * Rep Performance - Data Transformers
 * 業務個人表現報告的資料轉換邏輯
 */

import { MEDDIC_DIMENSION_NAMES } from "@sales_ai_automation_v3/shared";

import { calculateTrend, getTodayDateString, roundScore } from "../utils";
import type { Agent6Output, DimensionStats, TeamScoreResult } from "./queries";

// ============================================================
// Types
// ============================================================

export interface DimensionScores {
  metrics: number;
  economicBuyer: number;
  decisionCriteria: number;
  decisionProcess: number;
  identifyPain: number;
  champion: number;
}

export interface DimensionAnalysisItem {
  score: number;
  trend: "up" | "down" | "stable";
  gap: string;
}

export interface DimensionAnalysis {
  metrics: DimensionAnalysisItem;
  economicBuyer: DimensionAnalysisItem;
  decisionCriteria: DimensionAnalysisItem;
  decisionProcess: DimensionAnalysisItem;
  identifyPain: DimensionAnalysisItem;
  champion: DimensionAnalysisItem;
}

export interface CoachingInsights {
  recentFeedback: string[];
  recurringPatterns: string[];
  improvementPlan: string[];
}

export interface ProgressTracking {
  last30Days: {
    avgScore: number;
    change: number;
  };
  last90Days: {
    avgScore: number;
    change: number;
  };
  milestones: Array<{ date: string; achievement: string }>;
}

export interface TeamComparison {
  overallPercentile: number;
  dimensionPercentiles: DimensionScores;
}

export interface RepPerformanceResult {
  summary: {
    totalOpportunities: number;
    totalConversations: number;
    totalAnalyses: number;
    averageScore: number;
    scoreChange: number;
  };
  dimensionAnalysis: DimensionAnalysis;
  strengths: string[];
  weaknesses: string[];
  teamComparison: TeamComparison;
  coachingInsights: CoachingInsights;
  progressTracking: ProgressTracking;
}

// ============================================================
// Dimension Score Transformers
// ============================================================

/**
 * 將 DimensionStats 轉換為 DimensionScores
 */
export function toDimensionScores(stats: DimensionStats): DimensionScores {
  return {
    metrics: stats.avgMetrics,
    economicBuyer: stats.avgEconomicBuyer,
    decisionCriteria: stats.avgDecisionCriteria,
    decisionProcess: stats.avgDecisionProcess,
    identifyPain: stats.avgIdentifyPain,
    champion: stats.avgChampion,
  };
}

/**
 * 產生維度分析（含趨勢和差距建議）
 */
export function buildDimensionAnalysis(
  current: DimensionScores,
  previous: DimensionScores
): DimensionAnalysis {
  const gapThreshold = 3;

  return {
    metrics: {
      score: current.metrics,
      trend: calculateTrend(current.metrics, previous.metrics),
      gap: current.metrics < gapThreshold ? "需要收集更多量化指標" : "",
    },
    economicBuyer: {
      score: current.economicBuyer,
      trend: calculateTrend(current.economicBuyer, previous.economicBuyer),
      gap: current.economicBuyer < gapThreshold ? "需要接觸經濟買家" : "",
    },
    decisionCriteria: {
      score: current.decisionCriteria,
      trend: calculateTrend(
        current.decisionCriteria,
        previous.decisionCriteria
      ),
      gap: current.decisionCriteria < gapThreshold ? "需要了解決策標準" : "",
    },
    decisionProcess: {
      score: current.decisionProcess,
      trend: calculateTrend(current.decisionProcess, previous.decisionProcess),
      gap: current.decisionProcess < gapThreshold ? "需要了解決策流程" : "",
    },
    identifyPain: {
      score: current.identifyPain,
      trend: calculateTrend(current.identifyPain, previous.identifyPain),
      gap: current.identifyPain < gapThreshold ? "需要深挖客戶痛點" : "",
    },
    champion: {
      score: current.champion,
      trend: calculateTrend(current.champion, previous.champion),
      gap: current.champion < gapThreshold ? "需要培養內部支持者" : "",
    },
  };
}

// ============================================================
// Strengths & Weaknesses
// ============================================================

/**
 * 識別強項和弱項
 */
export function identifyStrengthsAndWeaknesses(scores: DimensionScores): {
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const [key, value] of Object.entries(scores)) {
    const name =
      MEDDIC_DIMENSION_NAMES[key as keyof typeof MEDDIC_DIMENSION_NAMES];
    if (!name) {
      continue;
    }
    if (value >= 4) {
      strengths.push(name);
    } else if (value <= 2) {
      weaknesses.push(name);
    }
  }

  return { strengths, weaknesses };
}

// ============================================================
// Team Comparison
// ============================================================

/**
 * 計算團隊百分位排名
 */
export function calculateTeamPercentile(
  teamScores: TeamScoreResult[],
  targetUserId: string
): number {
  if (teamScores.length <= 1) {
    return 50; // 預設百分位
  }

  const scores = teamScores
    .map((s) => Number(s.avgScore) || 0)
    .sort((a, b) => a - b);

  const userScore = teamScores.find((s) => s.userId === targetUserId);
  const userAvgScore = Number(userScore?.avgScore) || 0;

  const rank = scores.filter((s) => s < userAvgScore).length;
  return Math.round((rank / scores.length) * 100);
}

/**
 * 建立團隊對比結果
 */
export function buildTeamComparison(overallPercentile: number): TeamComparison {
  return {
    overallPercentile,
    dimensionPercentiles: {
      metrics: 50,
      economicBuyer: 50,
      decisionCriteria: 50,
      decisionProcess: 50,
      identifyPain: 50,
      champion: 50,
    },
  };
}

// ============================================================
// Coaching Insights
// ============================================================

/**
 * 從分析記錄中提取教練建議
 */
export function extractCoachingInsights(
  analyses: Array<{ agentOutputs?: Record<string, unknown> | null }>
): {
  recentFeedback: string[];
  allImprovements: string[];
} {
  const recentFeedback: string[] = [];
  const allImprovements: string[] = [];

  for (const analysis of analyses) {
    const agent6Output = analysis.agentOutputs?.agent6 as
      | Agent6Output
      | undefined;

    if (agent6Output?.coachingNotes) {
      recentFeedback.push(agent6Output.coachingNotes);
    }

    if (agent6Output?.improvements) {
      for (const imp of agent6Output.improvements) {
        allImprovements.push(imp.area);
      }
    }
  }

  return { recentFeedback, allImprovements };
}

/**
 * 找出重複出現的問題模式
 */
export function findRecurringPatterns(
  improvements: string[],
  minOccurrence = 2
): string[] {
  const counts = improvements.reduce(
    (acc, area) => {
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return Object.entries(counts)
    .filter(([, count]) => count >= minOccurrence)
    .map(([area]) => area);
}

/**
 * 根據弱項生成改善計畫
 */
export function generateImprovementPlan(weaknesses: string[]): string[] {
  const plans: Record<string, string> = {
    "量化指標 (Metrics)": "在 Demo 中主動詢問客戶目前的人力成本、營業額等數據",
    "經濟買家 (Economic Buyer)":
      "確認老闆是否在場，若不在場要約定下次與老闆溝通",
    "決策標準 (Decision Criteria)": "詢問客戶選擇 POS 系統最重視的三個條件",
    "決策流程 (Decision Process)": "了解誰會參與決策、預計多久做決定",
    "痛點識別 (Identify Pain)": "深入詢問目前營運上最困擾的問題",
    "內部支持者 (Champion)": "找出對 iCHEF 最有興趣的店內人員，建立關係",
  };

  return weaknesses.map(
    (weakness) => plans[weakness] || `加強 ${weakness} 相關能力`
  );
}

/**
 * 建立完整的教練建議
 */
export function buildCoachingInsights(
  recentFeedback: string[],
  allImprovements: string[],
  weaknesses: string[]
): CoachingInsights {
  return {
    recentFeedback: recentFeedback.slice(0, 5),
    recurringPatterns: findRecurringPatterns(allImprovements),
    improvementPlan: generateImprovementPlan(weaknesses),
  };
}

// ============================================================
// Progress Tracking
// ============================================================

/**
 * 建立進步追蹤結果
 */
export function buildProgressTracking(
  data: {
    last30Avg: number;
    prev30Avg: number;
    last90Avg: number;
    prev90Avg: number;
  },
  currentPeriodCount: number
): ProgressTracking {
  const milestones: Array<{ date: string; achievement: string }> = [];
  const today = getTodayDateString();

  // 檢查是否達成特定里程碑
  if (data.last30Avg >= 80 && data.prev30Avg < 80) {
    milestones.push({
      date: today,
      achievement: "平均分數突破 80 分！",
    });
  }

  if (currentPeriodCount >= 10) {
    milestones.push({
      date: today,
      achievement: `本期完成 ${currentPeriodCount} 筆分析`,
    });
  }

  return {
    last30Days: {
      avgScore: roundScore(data.last30Avg),
      change: roundScore(data.last30Avg - data.prev30Avg),
    },
    last90Days: {
      avgScore: roundScore(data.last90Avg),
      change: roundScore(data.last90Avg - data.prev90Avg),
    },
    milestones,
  };
}

// ============================================================
// Final Result Builder
// ============================================================

/**
 * 建立最終的報告結果
 */
export function buildRepPerformanceResult(params: {
  basicStats: { totalOpportunities: number; totalConversations: number };
  periodStats: { count: number; avgScore: number };
  previousAvgScore: number;
  dimensionAnalysis: DimensionAnalysis;
  strengths: string[];
  weaknesses: string[];
  teamComparison: TeamComparison;
  coachingInsights: CoachingInsights;
  progressTracking: ProgressTracking;
}): RepPerformanceResult {
  const scoreChange =
    params.previousAvgScore > 0
      ? params.periodStats.avgScore - params.previousAvgScore
      : 0;

  return {
    summary: {
      totalOpportunities: params.basicStats.totalOpportunities,
      totalConversations: params.basicStats.totalConversations,
      totalAnalyses: params.periodStats.count,
      averageScore: roundScore(params.periodStats.avgScore),
      scoreChange: roundScore(scoreChange),
    },
    dimensionAnalysis: params.dimensionAnalysis,
    strengths: params.strengths,
    weaknesses: params.weaknesses,
    teamComparison: params.teamComparison,
    coachingInsights: params.coachingInsights,
    progressTracking: params.progressTracking,
  };
}
