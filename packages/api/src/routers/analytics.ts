/**
 * Analytics API Router
 * MEDDIC analysis statistics and dashboard data
 * 包含業務個人報告、經理團隊報告
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
  user,
  userProfiles,
} from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { MEDDIC_DIMENSION_NAMES } from "@sales_ai_automation_v3/shared";
import { and, avg, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const dashboardSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const opportunityAnalyticsSchema = z.object({
  opportunityId: z.string(),
});

const meddicTrendsSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  dimension: z
    .enum([
      "metrics",
      "economicBuyer",
      "decisionCriteria",
      "decisionProcess",
      "identifyPain",
      "champion",
    ])
    .optional(),
});

// Schema for rep performance report
const repPerformanceSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  userId: z.string().optional(), // 經理可指定查看某業務，業務只能看自己
});

// Schema for team performance report
const teamPerformanceSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// ============================================================
// Utility Functions
// ============================================================

/**
 * 分數四捨五入工具函數
 * @param score - 原始分數
 * @param decimals - 小數位數（預設 1）
 * @returns 四捨五入後的分數
 */
function roundScore(score: number | null | undefined, decimals = 1): number {
  if (score == null) {
    return 0;
  }
  const multiplier = 10 ** decimals;
  return Math.round(Number(score) * multiplier) / multiplier;
}

/**
 * 建立日期過濾條件
 * @param dateFrom - 起始日期（可選）
 * @param dateTo - 結束日期（可選）
 * @returns Drizzle ORM 過濾條件陣列
 */
function buildDateConditions(dateFrom?: string, dateTo?: string) {
  const conditions = [];
  if (dateFrom) {
    conditions.push(gte(meddicAnalyses.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(meddicAnalyses.createdAt, new Date(dateTo)));
  }
  return conditions;
}

// ============================================================
// KV Cache Helper
// ============================================================

async function getKVCacheService(context: any) {
  const honoEnv = context.honoContext?.env;
  if (!honoEnv?.CACHE_KV) {
    return null;
  }
  const { createKVCacheService } = await import(
    "@Sales_ai_automation_v3/services"
  );
  return createKVCacheService(honoEnv.CACHE_KV);
}

// ============================================================
// Opportunity Stats (for /report dashboard)
// ============================================================

export const getOpportunityStats = protectedProcedure.handler(
  async ({ context }) => {
    const cacheKey = "stats:opportunity:global";
    const TTL_SECONDS = 300; // 5 minutes

    // 1. Try to get from KV cache
    const cacheService = await getKVCacheService(context);
    if (cacheService) {
      const cached = await cacheService.get<{
        total: number;
        byStatus: Record<string, number>;
        averageMeddicScore: number;
        recentActivity: number;
      }>(cacheKey);

      if (cached) {
        console.log("[OpportunityStats] Cache hit");
        return cached;
      }
    }

    console.log("[OpportunityStats] Cache miss, querying DB");

    // 2. Query from DB
    // Total opportunities
    const totalResult = await db.select({ count: count() }).from(opportunities);
    const total = totalResult[0]?.count || 0;

    // By status
    const statusResults = await db
      .select({
        status: opportunities.status,
        count: count(),
      })
      .from(opportunities)
      .groupBy(opportunities.status);

    const byStatus: Record<string, number> = {};
    for (const row of statusResults) {
      if (row.status) {
        byStatus[row.status] = row.count;
      }
    }

    // Average MEDDIC score
    const avgScoreResult = await db
      .select({ avgScore: avg(meddicAnalyses.overallScore) })
      .from(meddicAnalyses);
    const averageMeddicScore = roundScore(
      Number(avgScoreResult[0]?.avgScore) || 0
    );

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentResult = await db
      .select({ count: count() })
      .from(conversations)
      .where(gte(conversations.createdAt, sevenDaysAgo));
    const recentActivity = recentResult[0]?.count || 0;

    const result = {
      total,
      byStatus,
      averageMeddicScore,
      recentActivity,
    };

    // 3. Write to KV cache
    if (cacheService) {
      await cacheService.set(cacheKey, result, TTL_SECONDS);
      console.log("[OpportunityStats] Wrote to cache");
    }

    return result;
  }
);

// ============================================================
// Dashboard Overview
// ============================================================

export const getDashboard = protectedProcedure
  .input(dashboardSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const { dateFrom, dateTo } = input;

    // KV 快取 (只快取無日期參數的預設查詢)
    const shouldCache = !(dateFrom || dateTo);
    const cacheKey = `user:${userId}:dashboard`;
    const TTL_SECONDS = 300; // 5 minutes

    if (shouldCache) {
      const cacheService = await getKVCacheService(context);
      if (cacheService) {
        const cached = await cacheService.get<{
          summary: {
            totalOpportunities: number;
            totalConversations: number;
            totalAnalyses: number;
            averageScore: number;
          };
          statusDistribution: Array<{ status: string | null; count: number }>;
          recentAnalyses: Array<{
            id: string;
            opportunityId: string;
            opportunityCompanyName: string;
            customerNumber: string;
            overallScore: number | null;
            status: string | null;
            createdAt: Date;
          }>;
        }>(cacheKey);

        if (cached) {
          console.log(`[Dashboard] Cache hit for user ${userId}`);
          return cached;
        }
      }
    }

    console.log(`[Dashboard] Cache miss for user ${userId}, querying DB`);

    // Build date filters
    const dateConditions = buildDateConditions(dateFrom, dateTo);

    // Total opportunities
    const totalOpportunitiesResults = await db
      .select({ count: count() })
      .from(opportunities)
      .where(eq(opportunities.userId, userId));
    const totalOpportunitiesResult = totalOpportunitiesResults[0] ?? {
      count: 0,
    };

    // Total conversations
    const totalConversationsResults = await db
      .select({ count: count() })
      .from(conversations)
      .innerJoin(
        opportunities,
        eq(conversations.opportunityId, opportunities.id)
      )
      .where(eq(opportunities.userId, userId));
    const totalConversationsResult = totalConversationsResults[0] ?? {
      count: 0,
    };

    // Total analyses
    const analysisConditions = [
      eq(opportunities.userId, userId),
      ...dateConditions,
    ];
    const totalAnalysesResults = await db
      .select({ count: count() })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(...analysisConditions));
    const totalAnalysesResult = totalAnalysesResults[0] ?? { count: 0 };

    // Average overall score
    const avgScoreResults = await db
      .select({
        avgScore: avg(meddicAnalyses.overallScore),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(...analysisConditions));
    const avgScoreResult = avgScoreResults[0];

    // Status distribution
    const statusDistribution = await db
      .select({
        status: meddicAnalyses.status,
        count: count(),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(...analysisConditions))
      .groupBy(meddicAnalyses.status);

    // Recent analyses
    const recentAnalyses = await db
      .select({
        id: meddicAnalyses.id,
        opportunityId: opportunities.id,
        opportunityCompanyName: opportunities.companyName,
        customerNumber: opportunities.customerNumber,
        overallScore: meddicAnalyses.overallScore,
        status: meddicAnalyses.status,
        createdAt: meddicAnalyses.createdAt,
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(...analysisConditions))
      .orderBy(desc(meddicAnalyses.createdAt))
      .limit(10);

    const result = {
      summary: {
        totalOpportunities: totalOpportunitiesResult.count,
        totalConversations: totalConversationsResult.count,
        totalAnalyses: totalAnalysesResult.count,
        averageScore: avgScoreResult?.avgScore
          ? Number(avgScoreResult.avgScore)
          : 0,
      },
      statusDistribution: statusDistribution.map((d) => ({
        status: d.status,
        count: d.count,
      })),
      recentAnalyses: recentAnalyses.map((a) => ({
        id: a.id,
        opportunityId: a.opportunityId,
        opportunityCompanyName: a.opportunityCompanyName,
        customerNumber: a.customerNumber,
        overallScore: a.overallScore,
        status: a.status,
        createdAt: a.createdAt,
      })),
    };

    // 寫入 KV 快取
    if (shouldCache) {
      const cacheService = await getKVCacheService(context);
      if (cacheService) {
        await cacheService.set(cacheKey, result, TTL_SECONDS);
        console.log(`[Dashboard] Wrote cache for user ${userId}`);
      }
    }

    return result;
  });

// ============================================================
// Opportunity Analytics
// ============================================================

export const getOpportunityAnalytics = protectedProcedure
  .input(opportunityAnalyticsSchema)
  .handler(async ({ input, context }) => {
    const { opportunityId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // Verify opportunity ownership
    const opportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.userId, userId)
      ),
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    // Get all analyses for this opportunity
    const analyses = await db.query.meddicAnalyses.findMany({
      where: eq(meddicAnalyses.opportunityId, opportunityId),
      orderBy: desc(meddicAnalyses.createdAt),
    });

    if (analyses.length === 0) {
      return {
        opportunityId,
        customerNumber: opportunity.customerNumber,
        totalAnalyses: 0,
        latestAnalysis: null,
        scoreHistory: [],
        dimensionAverages: null,
      };
    }

    // Calculate dimension averages
    const dimensionSums = {
      metrics: 0,
      economicBuyer: 0,
      decisionCriteria: 0,
      decisionProcess: 0,
      identifyPain: 0,
      champion: 0,
    };

    for (const a of analyses) {
      dimensionSums.metrics += a.metricsScore || 0;
      dimensionSums.economicBuyer += a.economicBuyerScore || 0;
      dimensionSums.decisionCriteria += a.decisionCriteriaScore || 0;
      dimensionSums.decisionProcess += a.decisionProcessScore || 0;
      dimensionSums.identifyPain += a.identifyPainScore || 0;
      dimensionSums.champion += a.championScore || 0;
    }

    const dimensionAverages = {
      metrics: dimensionSums.metrics / analyses.length,
      economicBuyer: dimensionSums.economicBuyer / analyses.length,
      decisionCriteria: dimensionSums.decisionCriteria / analyses.length,
      decisionProcess: dimensionSums.decisionProcess / analyses.length,
      identifyPain: dimensionSums.identifyPain / analyses.length,
      champion: dimensionSums.champion / analyses.length,
    };

    // Score history
    const scoreHistory = analyses.map((a) => ({
      analysisId: a.id,
      overallScore: a.overallScore,
      status: a.status,
      createdAt: a.createdAt,
    }));

    return {
      opportunityId,
      customerNumber: opportunity.customerNumber,
      totalAnalyses: analyses.length,
      latestAnalysis: analyses[0],
      scoreHistory,
      dimensionAverages,
    };
  });

// ============================================================
// MEDDIC Trends
// ============================================================

export const getMeddicTrends = protectedProcedure
  .input(meddicTrendsSchema)
  .handler(async ({ input, context }) => {
    const { dateFrom, dateTo, dimension } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // Build date filters
    const dateConditions = [
      eq(opportunities.userId, userId),
      ...buildDateConditions(dateFrom, dateTo),
    ];

    // Get all analyses in date range
    const analyses = await db
      .select({
        id: meddicAnalyses.id,
        metricsScore: meddicAnalyses.metricsScore,
        economicBuyerScore: meddicAnalyses.economicBuyerScore,
        decisionCriteriaScore: meddicAnalyses.decisionCriteriaScore,
        decisionProcessScore: meddicAnalyses.decisionProcessScore,
        identifyPainScore: meddicAnalyses.identifyPainScore,
        championScore: meddicAnalyses.championScore,
        overallScore: meddicAnalyses.overallScore,
        createdAt: meddicAnalyses.createdAt,
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(...dateConditions))
      .orderBy(meddicAnalyses.createdAt);

    // Map dimension names to score fields
    const dimensionScoreMap: Record<string, keyof (typeof analyses)[0]> = {
      metrics: "metricsScore",
      economicBuyer: "economicBuyerScore",
      decisionCriteria: "decisionCriteriaScore",
      decisionProcess: "decisionProcessScore",
      identifyPain: "identifyPainScore",
      champion: "championScore",
    };

    // If specific dimension requested, calculate trend
    if (dimension) {
      const scoreField = dimensionScoreMap[dimension];
      if (!scoreField) {
        throw new ORPCError("BAD_REQUEST");
      }
      const trendData = analyses.map((a) => ({
        date: a.createdAt,
        score: (a[scoreField] as number | null) || 0,
      }));

      return {
        dimension,
        trend: trendData,
        average:
          trendData.reduce((sum, d) => sum + d.score, 0) / trendData.length ||
          0,
      };
    }

    // Otherwise, return all dimensions
    const allDimensions = [
      "metrics",
      "economicBuyer",
      "decisionCriteria",
      "decisionProcess",
      "identifyPain",
      "champion",
    ] as const;

    const trends = allDimensions.map((dim) => {
      const scoreField = dimensionScoreMap[dim];
      if (!scoreField) {
        return { dimension: dim, trend: [], average: 0 };
      }
      const trendData = analyses.map((a) => ({
        date: a.createdAt,
        score: (a[scoreField] as number | null) || 0,
      }));

      return {
        dimension: dim,
        trend: trendData,
        average:
          trendData.reduce((sum, d) => sum + d.score, 0) / trendData.length ||
          0,
      };
    });

    return {
      trends,
      overallScoreTrend: analyses.map((a) => ({
        date: a.createdAt,
        score: a.overallScore,
      })),
    };
  });

// ============================================================
// Rep Performance Report (業務個人報告)
// ============================================================

/**
 * 業務個人表現報告
 * - 基本統計（商機數、對話數、分析數、平均分數）
 * - MEDDIC 六維度分析（分數、趨勢、缺口）
 * - 強項/弱項識別
 * - 團隊對比（百分位）
 * - 個人化教練建議（聚合自 Agent 6）
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

    // 確定要查詢的目標用戶
    let queryUserId = currentUserId;

    // 如果指定了其他用戶 ID，需要驗證權限（只有經理可以查看團隊成員）
    if (targetUserId && targetUserId !== currentUserId) {
      // 檢查當前用戶是否是經理
      const currentUserProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, currentUserId),
      });

      if (
        currentUserProfile?.role !== "manager" &&
        currentUserProfile?.role !== "admin"
      ) {
        throw new ORPCError("FORBIDDEN", {
          message: "只有經理可以查看團隊成員報告",
        });
      }

      // 檢查目標用戶是否與當前經理同一個 department
      const targetUserProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, targetUserId),
      });

      if (!targetUserProfile && currentUserProfile?.role !== "admin") {
        throw new ORPCError("NOT_FOUND", { message: "找不到該用戶" });
      }

      // 如果當前用戶的 department 是 'all',可以查看所有用戶
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

      queryUserId = targetUserId;
    }

    // 建立日期過濾條件
    const currentPeriodStart = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const currentPeriodEnd = dateTo ? new Date(dateTo) : new Date();

    const dateConditions = [
      gte(meddicAnalyses.createdAt, currentPeriodStart),
      lte(meddicAnalyses.createdAt, currentPeriodEnd),
    ];

    // 計算上一期間（用於比較）
    const periodLength =
      currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    const previousPeriodStart = new Date(
      currentPeriodStart.getTime() - periodLength
    );
    const previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);

    // ========== 基本統計 ==========
    // 商機總數
    const totalOpportunitiesResult = await db
      .select({ count: count() })
      .from(opportunities)
      .where(eq(opportunities.userId, queryUserId));

    // 對話總數
    const totalConversationsResult = await db
      .select({ count: count() })
      .from(conversations)
      .innerJoin(
        opportunities,
        eq(conversations.opportunityId, opportunities.id)
      )
      .where(eq(opportunities.userId, queryUserId));

    // 當期分析總數和平均分數
    const currentPeriodStats = await db
      .select({
        count: count(),
        avgScore: avg(meddicAnalyses.overallScore),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(eq(opportunities.userId, queryUserId), ...dateConditions));

    // 上期平均分數（用於計算變化）
    const previousPeriodStats = await db
      .select({
        avgScore: avg(meddicAnalyses.overallScore),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        and(
          eq(opportunities.userId, queryUserId),
          gte(meddicAnalyses.createdAt, previousPeriodStart),
          lte(meddicAnalyses.createdAt, previousPeriodEnd)
        )
      );

    const currentAvgScore = currentPeriodStats[0]?.avgScore
      ? Number(currentPeriodStats[0].avgScore)
      : 0;
    const previousAvgScore = previousPeriodStats[0]?.avgScore
      ? Number(previousPeriodStats[0].avgScore)
      : 0;
    const scoreChange =
      previousAvgScore > 0 ? currentAvgScore - previousAvgScore : 0;

    // ========== MEDDIC 六維度分析 ==========
    const dimensionStats = await db
      .select({
        avgMetrics: avg(meddicAnalyses.metricsScore),
        avgEconomicBuyer: avg(meddicAnalyses.economicBuyerScore),
        avgDecisionCriteria: avg(meddicAnalyses.decisionCriteriaScore),
        avgDecisionProcess: avg(meddicAnalyses.decisionProcessScore),
        avgIdentifyPain: avg(meddicAnalyses.identifyPainScore),
        avgChampion: avg(meddicAnalyses.championScore),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(eq(opportunities.userId, queryUserId), ...dateConditions));

    // 上期維度分數（用於計算趨勢）
    const previousDimensionStats = await db
      .select({
        avgMetrics: avg(meddicAnalyses.metricsScore),
        avgEconomicBuyer: avg(meddicAnalyses.economicBuyerScore),
        avgDecisionCriteria: avg(meddicAnalyses.decisionCriteriaScore),
        avgDecisionProcess: avg(meddicAnalyses.decisionProcessScore),
        avgIdentifyPain: avg(meddicAnalyses.identifyPainScore),
        avgChampion: avg(meddicAnalyses.championScore),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        and(
          eq(opportunities.userId, queryUserId),
          gte(meddicAnalyses.createdAt, previousPeriodStart),
          lte(meddicAnalyses.createdAt, previousPeriodEnd)
        )
      );

    const calculateTrend = (
      current: number,
      previous: number
    ): "up" | "down" | "stable" => {
      if (previous === 0) {
        return "stable";
      }
      const change = current - previous;
      if (change > 0.3) {
        return "up";
      }
      if (change < -0.3) {
        return "down";
      }
      return "stable";
    };

    const dimensionScores = {
      metrics: Number(dimensionStats[0]?.avgMetrics) || 0,
      economicBuyer: Number(dimensionStats[0]?.avgEconomicBuyer) || 0,
      decisionCriteria: Number(dimensionStats[0]?.avgDecisionCriteria) || 0,
      decisionProcess: Number(dimensionStats[0]?.avgDecisionProcess) || 0,
      identifyPain: Number(dimensionStats[0]?.avgIdentifyPain) || 0,
      champion: Number(dimensionStats[0]?.avgChampion) || 0,
    };

    const previousDimensionScores = {
      metrics: Number(previousDimensionStats[0]?.avgMetrics) || 0,
      economicBuyer: Number(previousDimensionStats[0]?.avgEconomicBuyer) || 0,
      decisionCriteria:
        Number(previousDimensionStats[0]?.avgDecisionCriteria) || 0,
      decisionProcess:
        Number(previousDimensionStats[0]?.avgDecisionProcess) || 0,
      identifyPain: Number(previousDimensionStats[0]?.avgIdentifyPain) || 0,
      champion: Number(previousDimensionStats[0]?.avgChampion) || 0,
    };

    const dimensionAnalysis = {
      metrics: {
        score: dimensionScores.metrics,
        trend: calculateTrend(
          dimensionScores.metrics,
          previousDimensionScores.metrics
        ),
        gap: dimensionScores.metrics < 3 ? "需要收集更多量化指標" : "",
      },
      economicBuyer: {
        score: dimensionScores.economicBuyer,
        trend: calculateTrend(
          dimensionScores.economicBuyer,
          previousDimensionScores.economicBuyer
        ),
        gap: dimensionScores.economicBuyer < 3 ? "需要接觸經濟買家" : "",
      },
      decisionCriteria: {
        score: dimensionScores.decisionCriteria,
        trend: calculateTrend(
          dimensionScores.decisionCriteria,
          previousDimensionScores.decisionCriteria
        ),
        gap: dimensionScores.decisionCriteria < 3 ? "需要了解決策標準" : "",
      },
      decisionProcess: {
        score: dimensionScores.decisionProcess,
        trend: calculateTrend(
          dimensionScores.decisionProcess,
          previousDimensionScores.decisionProcess
        ),
        gap: dimensionScores.decisionProcess < 3 ? "需要了解決策流程" : "",
      },
      identifyPain: {
        score: dimensionScores.identifyPain,
        trend: calculateTrend(
          dimensionScores.identifyPain,
          previousDimensionScores.identifyPain
        ),
        gap: dimensionScores.identifyPain < 3 ? "需要深挖客戶痛點" : "",
      },
      champion: {
        score: dimensionScores.champion,
        trend: calculateTrend(
          dimensionScores.champion,
          previousDimensionScores.champion
        ),
        gap: dimensionScores.champion < 3 ? "需要培養內部支持者" : "",
      },
    };

    // ========== 強項/弱項識別 ==========
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    for (const [key, value] of Object.entries(dimensionScores)) {
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

    // ========== 團隊對比（百分位）==========
    // 取得所有團隊成員的平均分數
    const teamComparison = {
      overallPercentile: 50,
      dimensionPercentiles: {
        metrics: 50,
        economicBuyer: 50,
        decisionCriteria: 50,
        decisionProcess: 50,
        identifyPain: 50,
        champion: 50,
      },
    };

    // 查找該用戶的 department
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, queryUserId),
    });

    if (userProfile?.department) {
      // 如果 department 是 'all',取得所有成員
      // 否則只取得同 department 的成員
      const teamProfiles =
        userProfile.department === "all"
          ? await db.query.userProfiles.findMany()
          : await db.query.userProfiles.findMany({
              where: eq(userProfiles.department, userProfile.department),
            });

      const memberIds = teamProfiles.map((p) => p.userId);

      if (memberIds.length > 1) {
        // 計算每個成員的平均分數
        const teamScores = await db
          .select({
            userId: opportunities.userId,
            avgScore: avg(meddicAnalyses.overallScore),
          })
          .from(meddicAnalyses)
          .innerJoin(
            opportunities,
            eq(meddicAnalyses.opportunityId, opportunities.id)
          )
          .where(
            and(inArray(opportunities.userId, memberIds), ...dateConditions)
          )
          .groupBy(opportunities.userId);

        // 計算百分位
        const scores = teamScores
          .map((s) => Number(s.avgScore) || 0)
          .sort((a, b) => a - b);
        const userScore = teamScores.find((s) => s.userId === queryUserId);
        const userAvgScore = Number(userScore?.avgScore) || 0;

        const rank = scores.filter((s) => s < userAvgScore).length;
        teamComparison.overallPercentile = Math.round(
          (rank / scores.length) * 100
        );
      }
    }

    // ========== 個人化教練建議（聚合自 Agent 6）==========
    const recentAnalyses = await db.query.meddicAnalyses.findMany({
      where: and(
        eq(
          meddicAnalyses.opportunityId,
          sql`(
          SELECT id FROM opportunities WHERE user_id = ${queryUserId}
        )`
        ),
        ...dateConditions
      ),
      orderBy: desc(meddicAnalyses.createdAt),
      limit: 5,
    });

    const recentFeedback: string[] = [];
    const allImprovements: string[] = [];

    for (const analysis of recentAnalyses) {
      const agent6Output = analysis.agentOutputs?.agent6 as
        | {
            coachingNotes?: string;
            improvements?: Array<{ area: string; suggestion: string }>;
          }
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

    // 找出重複出現的問題
    const improvementCounts = allImprovements.reduce(
      (acc, area) => {
        acc[area] = (acc[area] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const recurringPatterns = Object.entries(improvementCounts)
      .filter(([, count]) => count >= 2)
      .map(([area]) => area);

    // 根據弱項生成改善計畫
    const improvementPlan = weaknesses.map((weakness) => {
      const plans: Record<string, string> = {
        "量化指標 (Metrics)":
          "在 Demo 中主動詢問客戶目前的人力成本、營業額等數據",
        "經濟買家 (Economic Buyer)":
          "確認老闆是否在場，若不在場要約定下次與老闆溝通",
        "決策標準 (Decision Criteria)": "詢問客戶選擇 POS 系統最重視的三個條件",
        "決策流程 (Decision Process)": "了解誰會參與決策、預計多久做決定",
        "痛點識別 (Identify Pain)": "深入詢問目前營運上最困擾的問題",
        "內部支持者 (Champion)": "找出對 iCHEF 最有興趣的店內人員，建立關係",
      };
      return plans[weakness] || `加強 ${weakness} 相關能力`;
    });

    // ========== 進步追蹤 ==========
    // 最近 30 天
    const last30DaysStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last30DaysStats = await db
      .select({ avgScore: avg(meddicAnalyses.overallScore) })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        and(
          eq(opportunities.userId, queryUserId),
          gte(meddicAnalyses.createdAt, last30DaysStart)
        )
      );

    // 前 30 天（30-60 天前）
    const prev30DaysStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const prev30DaysStats = await db
      .select({ avgScore: avg(meddicAnalyses.overallScore) })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        and(
          eq(opportunities.userId, queryUserId),
          gte(meddicAnalyses.createdAt, prev30DaysStart),
          lte(meddicAnalyses.createdAt, last30DaysStart)
        )
      );

    // 最近 90 天
    const last90DaysStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const last90DaysStats = await db
      .select({ avgScore: avg(meddicAnalyses.overallScore) })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        and(
          eq(opportunities.userId, queryUserId),
          gte(meddicAnalyses.createdAt, last90DaysStart)
        )
      );

    // 前 90 天
    const prev90DaysStart = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const prev90DaysStats = await db
      .select({ avgScore: avg(meddicAnalyses.overallScore) })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        and(
          eq(opportunities.userId, queryUserId),
          gte(meddicAnalyses.createdAt, prev90DaysStart),
          lte(meddicAnalyses.createdAt, last90DaysStart)
        )
      );

    const last30Avg = Number(last30DaysStats[0]?.avgScore) || 0;
    const prev30Avg = Number(prev30DaysStats[0]?.avgScore) || 0;
    const last90Avg = Number(last90DaysStats[0]?.avgScore) || 0;
    const prev90Avg = Number(prev90DaysStats[0]?.avgScore) || 0;

    // 里程碑
    const milestones: Array<{ date: string; achievement: string }> = [];

    // 檢查是否達成特定里程碑
    const today =
      new Date().toISOString().split("T")[0] ??
      new Date().toISOString().slice(0, 10);
    if (last30Avg >= 80 && prev30Avg < 80) {
      milestones.push({
        date: today,
        achievement: "平均分數突破 80 分！",
      });
    }
    if (
      currentPeriodStats[0]?.count &&
      Number(currentPeriodStats[0].count) >= 10
    ) {
      milestones.push({
        date: today,
        achievement: `本期完成 ${currentPeriodStats[0].count} 筆分析`,
      });
    }

    return {
      // 基本統計
      summary: {
        totalOpportunities: totalOpportunitiesResult[0]?.count || 0,
        totalConversations: totalConversationsResult[0]?.count || 0,
        totalAnalyses: currentPeriodStats[0]?.count || 0,
        averageScore: roundScore(currentAvgScore),
        scoreChange: roundScore(scoreChange),
      },

      // MEDDIC 六維度分析
      dimensionAnalysis,

      // 強項/弱項識別
      strengths,
      weaknesses,

      // 團隊對比（百分位）
      teamComparison,

      // 個人化教練建議
      coachingInsights: {
        recentFeedback: recentFeedback.slice(0, 5),
        recurringPatterns,
        improvementPlan,
      },

      // 進步追蹤
      progressTracking: {
        last30Days: {
          avgScore: roundScore(last30Avg),
          change: roundScore(last30Avg - prev30Avg),
        },
        last90Days: {
          avgScore: roundScore(last90Avg),
          change: roundScore(last90Avg - prev90Avg),
        },
        milestones,
      },
    };
  });

// ============================================================
// Team Performance Report (經理團隊報告)
// ============================================================

/**
 * 經理團隊表現報告
 * - 團隊總覽（人數、商機數、對話數、平均分數）
 * - 成員排名
 * - 團隊維度分析
 * - 需要關注的商機
 * - 團隊趨勢
 * - 教練優先級
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

    const { dateFrom, dateTo } = input;

    // 建立日期過濾條件
    const currentPeriodStart = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const currentPeriodEnd = dateTo ? new Date(dateTo) : new Date();

    const dateConditions = [
      gte(meddicAnalyses.createdAt, currentPeriodStart),
      lte(meddicAnalyses.createdAt, currentPeriodEnd),
    ];

    // 計算上一期間（用於趨勢比較）
    const periodLength =
      currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    const previousPeriodStart = new Date(
      currentPeriodStart.getTime() - periodLength
    );
    const previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);

    // 取得團隊成員列表
    // Admin 或 department='all' 的 Manager 可以查看所有成員
    // 其他 Manager 只能查看同 department 的成員
    let teamMemberProfiles: Awaited<
      ReturnType<typeof db.query.userProfiles.findMany>
    >;
    if (
      currentUserProfile?.role === "admin" ||
      currentUserProfile?.department === "all"
    ) {
      teamMemberProfiles = await db.query.userProfiles.findMany();
    } else if (currentUserProfile?.department) {
      teamMemberProfiles = await db.query.userProfiles.findMany({
        where: eq(userProfiles.department, currentUserProfile.department),
      });
    } else {
      teamMemberProfiles = [];
    }

    const memberIds = teamMemberProfiles.map((p) => p.userId);

    if (memberIds.length === 0) {
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

    // ========== 團隊總覽 ==========
    const totalOpportunities = await db
      .select({ count: count() })
      .from(opportunities)
      .where(inArray(opportunities.userId, memberIds));

    const totalConversations = await db
      .select({ count: count() })
      .from(conversations)
      .innerJoin(
        opportunities,
        eq(conversations.opportunityId, opportunities.id)
      )
      .where(inArray(opportunities.userId, memberIds));

    const teamCurrentStats = await db
      .select({
        avgScore: avg(meddicAnalyses.overallScore),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(inArray(opportunities.userId, memberIds), ...dateConditions));

    const teamPreviousStats = await db
      .select({
        avgScore: avg(meddicAnalyses.overallScore),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        and(
          inArray(opportunities.userId, memberIds),
          gte(meddicAnalyses.createdAt, previousPeriodStart),
          lte(meddicAnalyses.createdAt, previousPeriodEnd)
        )
      );

    const teamAvgScore = Number(teamCurrentStats[0]?.avgScore) || 0;
    const teamPrevAvgScore = Number(teamPreviousStats[0]?.avgScore) || 0;

    // ========== 成員排名 ==========
    const memberStats = await db
      .select({
        userId: opportunities.userId,
        opportunityCount: count(opportunities.id),
        avgScore: avg(meddicAnalyses.overallScore),
      })
      .from(opportunities)
      .leftJoin(
        meddicAnalyses,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(inArray(opportunities.userId, memberIds), ...dateConditions))
      .groupBy(opportunities.userId);

    // 取得成員上期分數（用於計算趨勢）
    const memberPrevStats = await db
      .select({
        userId: opportunities.userId,
        avgScore: avg(meddicAnalyses.overallScore),
      })
      .from(opportunities)
      .leftJoin(
        meddicAnalyses,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        and(
          inArray(opportunities.userId, memberIds),
          gte(meddicAnalyses.createdAt, previousPeriodStart),
          lte(meddicAnalyses.createdAt, previousPeriodEnd)
        )
      )
      .groupBy(opportunities.userId);

    const memberPrevScoreMap = new Map(
      memberPrevStats.map((m) => [m.userId, Number(m.avgScore) || 0])
    );

    // 取得成員名稱
    const memberUsers = await db
      .select({
        id: user.id,
        name: user.name,
      })
      .from(user)
      .where(inArray(user.id, memberIds));

    const userNameMap = new Map(memberUsers.map((u) => [u.id, u.name]));

    // 計算對話數
    const memberConvCounts = await db
      .select({
        userId: opportunities.userId,
        convCount: count(conversations.id),
      })
      .from(opportunities)
      .leftJoin(
        conversations,
        eq(conversations.opportunityId, opportunities.id)
      )
      .where(inArray(opportunities.userId, memberIds))
      .groupBy(opportunities.userId);

    const convCountMap = new Map(
      memberConvCounts.map((m) => [m.userId, m.convCount])
    );

    const memberRankings = memberStats
      .map((m) => {
        const currentScore = Number(m.avgScore) || 0;
        const prevScore = memberPrevScoreMap.get(m.userId) || 0;
        const trend: "up" | "down" | "stable" =
          currentScore > prevScore + 5
            ? "up"
            : currentScore < prevScore - 5
              ? "down"
              : "stable";

        // 連續下滑或分數過低需要關注
        const needsAttention =
          currentScore < 50 || (trend === "down" && currentScore < 60);

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

    // ========== 團隊維度分析 ==========
    const teamDimensionStats = await db
      .select({
        avgMetrics: avg(meddicAnalyses.metricsScore),
        avgEconomicBuyer: avg(meddicAnalyses.economicBuyerScore),
        avgDecisionCriteria: avg(meddicAnalyses.decisionCriteriaScore),
        avgDecisionProcess: avg(meddicAnalyses.decisionProcessScore),
        avgIdentifyPain: avg(meddicAnalyses.identifyPainScore),
        avgChampion: avg(meddicAnalyses.championScore),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(inArray(opportunities.userId, memberIds), ...dateConditions));

    // 每個成員的維度分數（用於找出 top/bottom performer）
    const memberDimensionStats = await db
      .select({
        userId: opportunities.userId,
        avgMetrics: avg(meddicAnalyses.metricsScore),
        avgEconomicBuyer: avg(meddicAnalyses.economicBuyerScore),
        avgDecisionCriteria: avg(meddicAnalyses.decisionCriteriaScore),
        avgDecisionProcess: avg(meddicAnalyses.decisionProcessScore),
        avgIdentifyPain: avg(meddicAnalyses.identifyPainScore),
        avgChampion: avg(meddicAnalyses.championScore),
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(and(inArray(opportunities.userId, memberIds), ...dateConditions))
      .groupBy(opportunities.userId);

    const findTopBottom = (dimension: string) => {
      const key =
        `avg${dimension.charAt(0).toUpperCase() + dimension.slice(1)}` as keyof (typeof memberDimensionStats)[0];
      const sorted = [...memberDimensionStats].sort(
        (a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0)
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
    };

    const teamDimensionAnalysis = {
      metrics: {
        teamAvg:
          Math.round((Number(teamDimensionStats[0]?.avgMetrics) || 0) * 10) /
          10,
        ...findTopBottom("metrics"),
      },
      economicBuyer: {
        teamAvg:
          Math.round(
            (Number(teamDimensionStats[0]?.avgEconomicBuyer) || 0) * 10
          ) / 10,
        ...findTopBottom("economicBuyer"),
      },
      decisionCriteria: {
        teamAvg:
          Math.round(
            (Number(teamDimensionStats[0]?.avgDecisionCriteria) || 0) * 10
          ) / 10,
        ...findTopBottom("decisionCriteria"),
      },
      decisionProcess: {
        teamAvg:
          Math.round(
            (Number(teamDimensionStats[0]?.avgDecisionProcess) || 0) * 10
          ) / 10,
        ...findTopBottom("decisionProcess"),
      },
      identifyPain: {
        teamAvg:
          Math.round(
            (Number(teamDimensionStats[0]?.avgIdentifyPain) || 0) * 10
          ) / 10,
        ...findTopBottom("identifyPain"),
      },
      champion: {
        teamAvg:
          Math.round((Number(teamDimensionStats[0]?.avgChampion) || 0) * 10) /
          10,
        ...findTopBottom("champion"),
      },
    };

    // ========== 需要關注的商機 ==========
    const atRiskOpportunities = await db
      .select({
        opportunityId: opportunities.id,
        companyName: opportunities.companyName,
        userId: opportunities.userId,
        overallScore: meddicAnalyses.overallScore,
        status: meddicAnalyses.status,
        risks: meddicAnalyses.risks,
        nextSteps: meddicAnalyses.nextSteps,
      })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        and(
          inArray(opportunities.userId, memberIds),
          ...dateConditions,
          lte(meddicAnalyses.overallScore, 50)
        )
      )
      .orderBy(meddicAnalyses.overallScore)
      .limit(10);

    const attentionNeeded = atRiskOpportunities.map((opp) => ({
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

    // ========== 團隊趨勢 ==========
    // 取得每週平均分數
    const weeklyScores: Array<{ week: string; avgScore: number }> = [];

    // 計算過去 8 週的數據
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(
        Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000
      );
      const weekEnd = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);

      const weekStats = await db
        .select({ avgScore: avg(meddicAnalyses.overallScore) })
        .from(meddicAnalyses)
        .innerJoin(
          opportunities,
          eq(meddicAnalyses.opportunityId, opportunities.id)
        )
        .where(
          and(
            inArray(opportunities.userId, memberIds),
            gte(meddicAnalyses.createdAt, weekStart),
            lte(meddicAnalyses.createdAt, weekEnd)
          )
        );

      weeklyScores.push({
        week:
          weekStart.toISOString().split("T")[0] ??
          weekStart.toISOString().slice(0, 10),
        avgScore: roundScore(Number(weekStats[0]?.avgScore) || 0),
      });
    }

    // ========== 教練優先級 ==========
    const coachingPriority = memberRankings
      .filter((m) => m.needsAttention)
      .map((m) => {
        // 找出該成員最弱的維度
        const memberDim = memberDimensionStats.find(
          (d) => d.userId === m.userId
        );
        const dimensions = [
          { name: "量化指標", score: Number(memberDim?.avgMetrics) || 0 },
          { name: "經濟買家", score: Number(memberDim?.avgEconomicBuyer) || 0 },
          {
            name: "決策標準",
            score: Number(memberDim?.avgDecisionCriteria) || 0,
          },
          {
            name: "決策流程",
            score: Number(memberDim?.avgDecisionProcess) || 0,
          },
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

    return {
      // 團隊總覽
      teamSummary: {
        teamSize: memberIds.length,
        totalOpportunities: totalOpportunities[0]?.count || 0,
        totalConversations: totalConversations[0]?.count || 0,
        teamAverageScore: roundScore(teamAvgScore),
        scoreChange: roundScore(teamAvgScore - teamPrevAvgScore),
      },

      // 成員排名
      memberRankings,

      // 團隊維度分析
      teamDimensionAnalysis,

      // 需要關注的商機
      attentionNeeded,

      // 團隊趨勢
      teamTrends: {
        weeklyScores,
        dimensionTrends: teamDimensionAnalysis,
      },

      // 教練優先級
      coachingPriority,
    };
  });

// ============================================================
// Router Export
// ============================================================

export const analyticsRouter = {
  dashboard: getDashboard,
  opportunityStats: getOpportunityStats,
  opportunityAnalytics: getOpportunityAnalytics,
  meddicTrends: getMeddicTrends,
  repPerformance: getRepPerformance,
  teamPerformance: getTeamPerformance,
};
