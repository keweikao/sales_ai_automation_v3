/**
 * Team Performance - Data Transformers
 * 團隊表現報告的資料轉換邏輯
 */

import { roundScore } from "../utils";
import type {
  AtRiskOpportunity,
  MemberConvCount,
  MemberDimensionStats,
  MemberPrevStats,
  MemberStats,
  MemberUser,
  TeamDimensionStats,
} from "./queries";

// ============================================================
// Types
// ============================================================

export interface MemberRanking {
  userId: string;
  name: string;
  opportunityCount: number;
  conversationCount: number;
  averageScore: number;
  trend: "up" | "down" | "stable";
  needsAttention: boolean;
}

export interface DimensionAnalysisItem {
  teamAvg: number;
  topPerformer: string;
  bottomPerformer: string;
}

export interface TeamDimensionAnalysis {
  metrics: DimensionAnalysisItem;
  economicBuyer: DimensionAnalysisItem;
  decisionCriteria: DimensionAnalysisItem;
  decisionProcess: DimensionAnalysisItem;
  identifyPain: DimensionAnalysisItem;
  champion: DimensionAnalysisItem;
}

export interface AttentionNeededItem {
  opportunityId: string;
  companyName: string;
  assignedTo: string;
  score: number;
  risk: string;
  suggestedAction: string;
}

export interface WeeklyScore {
  week: string;
  avgScore: number;
}

export interface CoachingPriorityItem {
  userId: string;
  name: string;
  reason: string;
  suggestedFocus: string[];
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 計算成員趨勢（使用 5 分的閾值）
 */
function calculateMemberTrend(
  currentScore: number,
  prevScore: number
): "up" | "down" | "stable" {
  if (currentScore > prevScore + 5) {
    return "up";
  }
  if (currentScore < prevScore - 5) {
    return "down";
  }
  return "stable";
}

/**
 * 判斷成員是否需要關注
 */
function checkNeedsAttention(
  currentScore: number,
  trend: "up" | "down" | "stable"
): boolean {
  return currentScore < 50 || (trend === "down" && currentScore < 60);
}

// ============================================================
// Transformer Functions
// ============================================================

/**
 * 建立成員排名列表
 */
export function buildMemberRankings(
  memberStats: MemberStats[],
  memberPrevStats: MemberPrevStats[],
  memberUsers: MemberUser[],
  memberConvCounts: MemberConvCount[]
): MemberRanking[] {
  const memberPrevScoreMap = new Map(
    memberPrevStats.map((m) => [m.userId, Number(m.avgScore) || 0])
  );
  const userNameMap = new Map(memberUsers.map((u) => [u.id, u.name]));
  const convCountMap = new Map(
    memberConvCounts.map((m) => [m.userId, m.convCount])
  );

  return memberStats
    .map((m) => {
      const currentScore = Number(m.avgScore) || 0;
      const prevScore = memberPrevScoreMap.get(m.userId) || 0;
      const trend = calculateMemberTrend(currentScore, prevScore);
      const needsAttention = checkNeedsAttention(currentScore, trend);

      return {
        userId: m.userId,
        name: userNameMap.get(m.userId) || "未知",
        opportunityCount: Number(m.opportunityCount) || 0,
        conversationCount: convCountMap.get(m.userId) || 0,
        averageScore: roundScore(currentScore),
        trend,
        needsAttention,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);
}

/**
 * 找出指定維度的 top/bottom performer
 */
function findTopBottomPerformers(
  memberDimensionStats: MemberDimensionStats[],
  userNameMap: Map<string, string | null>,
  dimensionKey: keyof Omit<MemberDimensionStats, "userId">
): { topPerformer: string; bottomPerformer: string } {
  const sorted = [...memberDimensionStats].sort(
    (a, b) => (Number(b[dimensionKey]) || 0) - (Number(a[dimensionKey]) || 0)
  );

  const topMember = sorted[0];
  const bottomMember = sorted.at(-1);

  return {
    topPerformer: topMember
      ? (userNameMap.get(topMember.userId) ?? "未知")
      : "無",
    bottomPerformer: bottomMember
      ? (userNameMap.get(bottomMember.userId) ?? "未知")
      : "無",
  };
}

/**
 * 建立團隊維度分析
 */
export function buildTeamDimensionAnalysis(
  teamDimensionStats: TeamDimensionStats | undefined,
  memberDimensionStats: MemberDimensionStats[],
  memberUsers: MemberUser[]
): TeamDimensionAnalysis {
  const userNameMap = new Map(memberUsers.map((u) => [u.id, u.name]));

  const buildDimensionItem = (
    avgValue: string | null | undefined,
    key: keyof Omit<MemberDimensionStats, "userId">
  ): DimensionAnalysisItem => {
    return {
      teamAvg: Math.round((Number(avgValue) || 0) * 10) / 10,
      ...findTopBottomPerformers(memberDimensionStats, userNameMap, key),
    };
  };

  return {
    metrics: buildDimensionItem(teamDimensionStats?.avgMetrics, "avgMetrics"),
    economicBuyer: buildDimensionItem(
      teamDimensionStats?.avgEconomicBuyer,
      "avgEconomicBuyer"
    ),
    decisionCriteria: buildDimensionItem(
      teamDimensionStats?.avgDecisionCriteria,
      "avgDecisionCriteria"
    ),
    decisionProcess: buildDimensionItem(
      teamDimensionStats?.avgDecisionProcess,
      "avgDecisionProcess"
    ),
    identifyPain: buildDimensionItem(
      teamDimensionStats?.avgIdentifyPain,
      "avgIdentifyPain"
    ),
    champion: buildDimensionItem(
      teamDimensionStats?.avgChampion,
      "avgChampion"
    ),
  };
}

/**
 * 建立需要關注的商機列表
 */
export function buildAttentionNeeded(
  atRiskOpportunities: AtRiskOpportunity[],
  memberUsers: MemberUser[]
): AttentionNeededItem[] {
  const userNameMap = new Map(memberUsers.map((u) => [u.id, u.name]));

  return atRiskOpportunities.map((opp) => ({
    opportunityId: opp.opportunityId,
    companyName: opp.companyName || "未知店家",
    assignedTo: userNameMap.get(opp.userId) || "未知",
    score: opp.overallScore || 0,
    risk:
      (opp.risks as Array<{ risk: string }> | null)?.[0]?.risk || "分數偏低",
    suggestedAction:
      (opp.nextSteps as Array<{ action: string }> | null)?.[0]?.action ||
      "需要經理協助跟進",
  }));
}

/**
 * 計算過去 8 週的平均分數趨勢
 */
export async function calculateWeeklyTrends(
  memberIds: string[],
  fetchWeeklyStatsFn: (
    memberIds: string[],
    weekStart: Date,
    weekEnd: Date
  ) => Promise<Array<{ avgScore: string | null }>>
): Promise<WeeklyScore[]> {
  const weeklyScores: WeeklyScore[] = [];

  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);

    const weekStats = await fetchWeeklyStatsFn(memberIds, weekStart, weekEnd);

    weeklyScores.push({
      week:
        weekStart.toISOString().split("T")[0] ??
        weekStart.toISOString().slice(0, 10),
      avgScore: roundScore(Number(weekStats[0]?.avgScore) || 0),
    });
  }

  return weeklyScores;
}

/**
 * 建立教練優先級列表
 */
export function buildCoachingPriority(
  memberRankings: MemberRanking[],
  memberDimensionStats: MemberDimensionStats[]
): CoachingPriorityItem[] {
  return memberRankings
    .filter((m) => m.needsAttention)
    .map((m) => {
      // 找出該成員最弱的維度
      const memberDim = memberDimensionStats.find((d) => d.userId === m.userId);

      const dimensions = [
        { name: "量化指標", score: Number(memberDim?.avgMetrics) || 0 },
        { name: "經濟買家", score: Number(memberDim?.avgEconomicBuyer) || 0 },
        {
          name: "決策標準",
          score: Number(memberDim?.avgDecisionCriteria) || 0,
        },
        { name: "決策流程", score: Number(memberDim?.avgDecisionProcess) || 0 },
        { name: "痛點識別", score: Number(memberDim?.avgIdentifyPain) || 0 },
        { name: "內部支持者", score: Number(memberDim?.avgChampion) || 0 },
      ].sort((a, b) => a.score - b.score);

      const weakestDimensions = dimensions.slice(0, 2).map((d) => d.name);

      let reason = "";
      if (m.averageScore < 50) {
        reason = `平均分數 ${m.averageScore} 分，低於團隊標準`;
      } else if (m.trend === "down") {
        reason = "分數持續下滑，需要關注";
      }

      return {
        userId: m.userId,
        name: m.name,
        reason,
        suggestedFocus: weakestDimensions,
      };
    })
    .slice(0, 5);
}

/**
 * 建立空的團隊表現結果（當沒有成員時）
 */
export function buildEmptyTeamPerformanceResult() {
  return {
    teamSummary: {
      teamSize: 0,
      totalOpportunities: 0,
      totalConversations: 0,
      teamAverageScore: 0,
      scoreChange: 0,
    },
    memberRankings: [],
    teamDimensionAnalysis: null,
    attentionNeeded: [],
    teamTrends: {
      weeklyScores: [],
      dimensionTrends: {},
    },
    coachingPriority: [],
  };
}
