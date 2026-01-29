/**
 * Rep Performance Module
 * 業務個人表現報告 - 模組化 Procedure
 */

import { db } from "@Sales_ai_automation_v3/db";
import { userProfiles } from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

import { protectedProcedure } from "../../../index";
import { CacheKeys, getKVCacheService } from "../cache";
import { repPerformanceSchema } from "../schemas";
import { getPeriodRanges } from "../utils";
import {
  fetchBasicStats,
  fetchDimensionStats,
  fetchPeriodStats,
  fetchProgressData,
  fetchRecentAnalyses,
  fetchTeamProfiles,
  fetchTeamScores,
  fetchUserOpportunityIds,
  fetchUserProfile,
} from "./queries";
import {
  buildCoachingInsights,
  buildDimensionAnalysis,
  buildProgressTracking,
  buildRepPerformanceResult,
  buildTeamComparison,
  calculateTeamPercentile,
  extractCoachingInsights,
  identifyStrengthsAndWeaknesses,
  toDimensionScores,
} from "./transformers";

// ============================================================
// Types
// ============================================================

/**
 * 快取資料結構（與 report-worker 產生的格式一致）
 */
export interface CachedRepPerformance {
  userId: string;
  generatedAt: string;
  summary: {
    totalOpportunities: number;
    totalConversations: number;
    totalAnalyses: number;
    averagePdcmScore: number;
    averageProgressScore: number;
    uploadCountThisMonth: number;
    uploadCountThisWeek: number;
  };
  pdcmAnalysis: {
    pain: { score: number; trend: "up" | "down" | "stable"; weight: number };
    decision: {
      score: number;
      trend: "up" | "down" | "stable";
      weight: number;
    };
    champion: {
      score: number;
      trend: "up" | "down" | "stable";
      weight: number;
    };
    metrics: { score: number; trend: "up" | "down" | "stable"; weight: number };
  };
  spinAnalysis: {
    situation: { score: number; weight: number };
    problem: { score: number; weight: number };
    implication: { score: number; weight: number };
    needPayoff: { score: number; weight: number };
    averageCompletionRate: number;
  };
  strengths: string[];
  weaknesses: string[];
  teamComparison: { overallPercentile: number };
  coachingInsights: {
    recentFeedback: string[];
    recurringPatterns: string[];
    improvementPlan: string[];
  };
  progressTracking: {
    last30Days: {
      avgPdcmScore: number;
      avgProgressScore: number;
      change: number;
    };
    last90Days: {
      avgPdcmScore: number;
      avgProgressScore: number;
      change: number;
    };
  };
}

// ============================================================
// Permission Helpers
// ============================================================

/**
 * 驗證並取得要查詢的用戶 ID
 */
async function resolveTargetUserId(
  currentUserId: string,
  targetUserId?: string
): Promise<string> {
  // 如果沒有指定目標用戶或目標就是自己，直接返回
  if (!targetUserId || targetUserId === currentUserId) {
    return currentUserId;
  }

  // 查詢目標用戶需要權限檢查
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, currentUserId),
  });

  // 只有 manager 和 admin 可以查看他人報告
  if (
    currentUserProfile?.role !== "manager" &&
    currentUserProfile?.role !== "admin"
  ) {
    throw new ORPCError("FORBIDDEN", {
      message: "只有經理可以查看團隊成員報告",
    });
  }

  // 檢查目標用戶是否存在
  const targetUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, targetUserId),
  });

  if (!targetUserProfile && currentUserProfile?.role !== "admin") {
    throw new ORPCError("NOT_FOUND", { message: "找不到該用戶" });
  }

  // 檢查部門權限
  // 如果當前用戶的 department 是 'all'，可以查看所有用戶
  // 否則只能查看同 department 的用戶
  if (
    currentUserProfile?.role !== "admin" &&
    currentUserProfile?.department !== "all" &&
    targetUserProfile?.department !== currentUserProfile?.department
  ) {
    throw new ORPCError("FORBIDDEN", {
      message: "該用戶不在您的團隊標籤內",
    });
  }

  return targetUserId;
}

// ============================================================
// Main Procedure
// ============================================================

/**
 * 業務個人表現報告
 * - 基本統計（商機數、對話數、分析數、平均分數）
 * - MEDDIC 六維度分析
 * - 強項/弱項識別
 * - 團隊對比（百分位）
 * - 個人化教練建議
 * - 進步追蹤
 */
export const getRepPerformance = protectedProcedure
  .input(repPerformanceSchema)
  .handler(async ({ input, context }) => {
    const currentUserId = context.session?.user.id;

    if (!currentUserId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const { dateFrom, dateTo, userId: targetUserId } = input;

    // 權限驗證並取得要查詢的用戶 ID
    const queryUserId = await resolveTargetUserId(currentUserId, targetUserId);

    // ========== 嘗試從 KV Cache 讀取 ==========
    // 只有在沒有指定日期範圍時才使用快取
    const shouldUseCache = !(dateFrom || dateTo);

    if (shouldUseCache) {
      const cacheService = getKVCacheService(context);
      if (cacheService) {
        const cacheKey = CacheKeys.repReport(queryUserId);
        const cached = await cacheService.get<CachedRepPerformance>(cacheKey);

        if (cached) {
          console.log(`[RepPerformance] Cache hit for user ${queryUserId}`);
          return cached;
        }
        console.log(`[RepPerformance] Cache miss for user ${queryUserId}`);
      }
    }

    // ========== Fallback: 即時計算 ==========
    const periods = getPeriodRanges(dateFrom, dateTo);

    // 並行執行獨立查詢以提升效能
    const [
      basicStats,
      currentPeriodStats,
      previousPeriodStats,
      currentDimensionStats,
      previousDimensionStats,
      progressData,
    ] = await Promise.all([
      fetchBasicStats(queryUserId),
      fetchPeriodStats(queryUserId, periods.current),
      fetchPeriodStats(queryUserId, periods.previous),
      fetchDimensionStats(queryUserId, periods.current),
      fetchDimensionStats(queryUserId, periods.previous),
      fetchProgressData(queryUserId),
    ]);

    // 轉換維度分數
    const dimensionScores = toDimensionScores(currentDimensionStats);
    const previousDimensionScores = toDimensionScores(previousDimensionStats);

    // 建立維度分析
    const dimensionAnalysis = buildDimensionAnalysis(
      dimensionScores,
      previousDimensionScores
    );

    // 識別強項和弱項
    const { strengths, weaknesses } =
      identifyStrengthsAndWeaknesses(dimensionScores);

    // ========== 團隊對比 ==========
    let overallPercentile = 50; // 預設

    const userProfile = await fetchUserProfile(queryUserId);
    if (userProfile?.department) {
      const teamProfiles = await fetchTeamProfiles(userProfile.department);
      const memberIds = teamProfiles.map((p) => p.userId);

      if (memberIds.length > 1) {
        const teamScores = await fetchTeamScores(memberIds, periods.current);
        overallPercentile = calculateTeamPercentile(teamScores, queryUserId);
      }
    }

    const teamComparison = buildTeamComparison(overallPercentile);

    // ========== 教練建議 ==========
    const opportunityIds = await fetchUserOpportunityIds(queryUserId);
    const recentAnalyses = await fetchRecentAnalyses(
      opportunityIds,
      periods.current,
      5
    );

    const { recentFeedback, allImprovements } =
      extractCoachingInsights(recentAnalyses);
    const coachingInsights = buildCoachingInsights(
      recentFeedback,
      allImprovements,
      weaknesses
    );

    // ========== 進步追蹤 ==========
    const progressTracking = buildProgressTracking(
      progressData,
      currentPeriodStats.count
    );

    // ========== 組合最終結果 ==========
    return buildRepPerformanceResult({
      basicStats,
      periodStats: currentPeriodStats,
      previousAvgScore: previousPeriodStats.avgScore,
      dimensionAnalysis,
      strengths,
      weaknesses,
      teamComparison,
      coachingInsights,
      progressTracking,
    });
  });

// Re-export types for external use
export type { RepPerformanceResult } from "./transformers";
