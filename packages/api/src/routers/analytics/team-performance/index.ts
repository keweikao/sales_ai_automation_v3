/**
 * Team Performance - Main Procedure
 * 經理團隊表現報告 API
 *
 * 功能：
 * - 團隊總覽（人數、商機數、對話數、平均分數）
 * - 成員排名
 * - 團隊維度分析（MEDDIC 各維度）
 * - 需要關注的商機
 * - 團隊趨勢（8 週歷史）
 * - 教練優先級
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  meddicAnalyses,
  userProfiles,
} from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { eq, gte, lte, type SQL } from "drizzle-orm";

import { protectedProcedure } from "../../../index";
import { getKVCacheService } from "../cache";
import { teamPerformanceSchema } from "../schemas";
import { getPeriodRanges, roundScore } from "../utils";
import {
  fetchAtRiskOpportunities,
  fetchMemberConversationCounts,
  fetchMemberDimensionStats,
  fetchMemberPrevStats,
  fetchMemberStats,
  fetchMemberUsers,
  fetchTeamCurrentStats,
  fetchTeamDimensionStats,
  fetchTeamMemberProfiles,
  fetchTeamPreviousStats,
  fetchTotalConversations,
  fetchTotalOpportunities,
  fetchWeeklyStats,
} from "./queries";
import {
  buildAttentionNeeded,
  buildCoachingPriority,
  buildEmptyTeamPerformanceResult,
  buildMemberRankings,
  buildTeamDimensionAnalysis,
  calculateWeeklyTrends,
} from "./transformers";

// ============================================================
// Types
// ============================================================

/** KV Cache 中的團隊報告格式 */
export interface CachedTeamReport {
  department: string;
  generatedAt: string;
  summary: {
    teamSize: number;
    totalOpportunities: number;
    totalConversations: number;
    averagePdcmScore: number;
    averageProgressScore: number;
  };
  pdcmAnalysis: {
    pain: { teamAvg: number };
    decision: { teamAvg: number };
    champion: { teamAvg: number };
    metrics: { teamAvg: number };
  };
  spinAnalysis: {
    averageCompletionRate: number;
  };
  memberRankings: Array<{
    userId: string;
    name: string;
    averagePdcmScore: number;
    progressScore: number;
    uploadCountThisMonth: number;
    trend: "up" | "down" | "stable";
  }>;
  uploadRankingsWeekly: Array<{
    userId: string;
    name: string;
    uploadCount: number;
    rank: number;
  }>;
  uploadRankingsMonthly: Array<{
    userId: string;
    name: string;
    uploadCount: number;
    rank: number;
  }>;
  attentionNeeded: Array<{
    opportunityId: string;
    companyName: string;
    assignedTo: string;
    score: number;
    risk: string;
  }>;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從 KV Cache 讀取並轉換為舊格式（維持向後兼容）
 */
function transformCachedDataToLegacyFormat(cached: CachedTeamReport) {
  return {
    teamSummary: {
      teamSize: cached.summary.teamSize,
      totalOpportunities: cached.summary.totalOpportunities,
      totalConversations: cached.summary.totalConversations,
      teamAverageScore: cached.summary.averagePdcmScore,
      scoreChange: 0, // Cache 中沒有這個欄位
    },
    memberRankings: cached.memberRankings.map((m) => ({
      userId: m.userId,
      name: m.name,
      opportunityCount: 0,
      conversationCount: m.uploadCountThisMonth,
      averageScore: m.averagePdcmScore,
      trend: m.trend,
      needsAttention: m.averagePdcmScore < 50,
    })),
    teamDimensionAnalysis: null, // 新版用 pdcmAnalysis
    attentionNeeded: cached.attentionNeeded.map((a) => ({
      opportunityId: a.opportunityId,
      companyName: a.companyName,
      assignedTo: a.assignedTo,
      score: a.score,
      risk: a.risk,
      suggestedAction: "需要經理協助跟進",
    })),
    teamTrends: { weeklyScores: [], dimensionTrends: {} },
    coachingPriority: [],
    // 新增欄位（新版 UI 用）
    cachedData: cached,
  };
}

/**
 * 決定要查詢的部門
 */
function determineQueryDepartment(
  userRole: string | null | undefined,
  userDepartment: string | null | undefined,
  filterDepartment: string | undefined
): string {
  if (userRole === "admin") {
    return filterDepartment || "all";
  }
  if (userDepartment === "all") {
    return filterDepartment || "all";
  }
  // 非 admin 且 department 不是 all 的 manager，只能看自己的 department
  return userDepartment || "all";
}

/**
 * 建立日期過濾條件
 */
function buildDateConditions(
  currentPeriodStart: Date,
  currentPeriodEnd: Date
): SQL<unknown>[] {
  return [
    gte(meddicAnalyses.createdAt, currentPeriodStart),
    lte(meddicAnalyses.createdAt, currentPeriodEnd),
  ];
}

// ============================================================
// Main Procedure
// ============================================================

/**
 * 經理團隊表現報告
 */
export const getTeamPerformance = protectedProcedure
  .input(teamPerformanceSchema)
  .handler(async ({ input, context }) => {
    const currentUserId = context.session?.user.id;

    if (!currentUserId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 驗證當前用戶是經理
    const currentUserProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, currentUserId),
    });

    if (
      currentUserProfile?.role !== "manager" &&
      currentUserProfile?.role !== "admin"
    ) {
      throw new ORPCError("FORBIDDEN", { message: "只有經理可以查看團隊報告" });
    }

    const { dateFrom, dateTo, department: filterDepartment } = input;

    // 決定要查詢的部門
    const queryDepartment = determineQueryDepartment(
      currentUserProfile?.role,
      currentUserProfile?.department,
      filterDepartment
    );

    // ========== 嘗試從 KV Cache 讀取 ==========
    const shouldUseCache = !(dateFrom || dateTo);

    if (shouldUseCache) {
      const cacheService = getKVCacheService(context);
      if (cacheService) {
        const cacheKey = `report:team:${queryDepartment}`;
        const cached = await cacheService.get<CachedTeamReport>(cacheKey);

        if (cached) {
          console.log(
            `[TeamPerformance] Cache hit for department ${queryDepartment}`
          );
          return transformCachedDataToLegacyFormat(cached);
        }
        console.log(
          `[TeamPerformance] Cache miss for department ${queryDepartment}`
        );
      }
    }

    // ========== Fallback: 即時計算 ==========

    // 計算時間區間
    const periods = getPeriodRanges(dateFrom, dateTo);
    const dateConditions = buildDateConditions(
      periods.current.start,
      periods.current.end
    );

    // 取得團隊成員列表
    const teamMemberProfiles = await fetchTeamMemberProfiles(queryDepartment);
    const memberIds = teamMemberProfiles.map((p) => p.userId);

    // 如果沒有成員，返回空結果
    if (memberIds.length === 0) {
      return buildEmptyTeamPerformanceResult();
    }

    // ========== 並行執行查詢 ==========
    const [
      totalOpportunities,
      totalConversations,
      teamCurrentStats,
      teamPreviousStats,
      memberStats,
      memberPrevStats,
      memberUsers,
      memberConvCounts,
      teamDimensionStats,
      memberDimensionStats,
      atRiskOpportunities,
    ] = await Promise.all([
      fetchTotalOpportunities(memberIds),
      fetchTotalConversations(memberIds),
      fetchTeamCurrentStats(memberIds, dateConditions),
      fetchTeamPreviousStats(memberIds, periods.previous),
      fetchMemberStats(memberIds, dateConditions),
      fetchMemberPrevStats(memberIds, periods.previous),
      fetchMemberUsers(memberIds),
      fetchMemberConversationCounts(memberIds),
      fetchTeamDimensionStats(memberIds, dateConditions),
      fetchMemberDimensionStats(memberIds, dateConditions),
      fetchAtRiskOpportunities(memberIds, dateConditions),
    ]);

    // ========== 計算團隊總覽 ==========
    const teamAvgScore = Number(teamCurrentStats[0]?.avgScore) || 0;
    const teamPrevAvgScore = Number(teamPreviousStats[0]?.avgScore) || 0;

    // ========== 建立成員排名 ==========
    const memberRankings = buildMemberRankings(
      memberStats,
      memberPrevStats,
      memberUsers,
      memberConvCounts
    );

    // ========== 建立團隊維度分析 ==========
    const teamDimensionAnalysis = buildTeamDimensionAnalysis(
      teamDimensionStats[0],
      memberDimensionStats,
      memberUsers
    );

    // ========== 建立需要關注的商機 ==========
    const attentionNeeded = buildAttentionNeeded(
      atRiskOpportunities,
      memberUsers
    );

    // ========== 計算團隊趨勢 ==========
    const weeklyScores = await calculateWeeklyTrends(
      memberIds,
      fetchWeeklyStats
    );

    // ========== 建立教練優先級 ==========
    const coachingPriority = buildCoachingPriority(
      memberRankings,
      memberDimensionStats
    );

    // ========== 返回結果 ==========
    return {
      teamSummary: {
        teamSize: memberIds.length,
        totalOpportunities: totalOpportunities[0]?.count || 0,
        totalConversations: totalConversations[0]?.count || 0,
        teamAverageScore: roundScore(teamAvgScore),
        scoreChange: roundScore(teamAvgScore - teamPrevAvgScore),
      },
      memberRankings,
      teamDimensionAnalysis,
      attentionNeeded,
      teamTrends: {
        weeklyScores,
        dimensionTrends: teamDimensionAnalysis,
      },
      coachingPriority,
    };
  });
