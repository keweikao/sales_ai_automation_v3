/**
 * Dashboard Analytics Module
 * 包含 getOpportunityStats 和 getDashboard procedures
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
  userProfiles,
} from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { and, avg, count, desc, eq, gte, ne } from "drizzle-orm";

import { protectedProcedure } from "../../index";
import { CACHE_TTL, CacheKeys, getKVCacheService } from "./cache";
import { dashboardSchema } from "./schemas";
import { buildDateConditions, buildUserCondition, roundScore } from "./utils";

// ============================================================
// Types
// ============================================================

/** getOpportunityStats 的返回型別 */
export interface OpportunityStatsResult {
  total: number;
  byStatus: Record<string, number>;
  averageMeddicScore: number;
  recentActivity: number;
}

/** getDashboard 的快取資料型別 */
export interface CachedDashboard {
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
  scope: string;
}

// ============================================================
// Opportunity Stats Procedure
// ============================================================

/**
 * 商機統計（用於 /report dashboard）
 * - 總商機數
 * - 按狀態分佈
 * - 平均 MEDDIC 分數
 * - 最近 7 天活動數
 */
export const getOpportunityStats = protectedProcedure.handler(
  async ({ context }) => {
    const cacheKey = CacheKeys.opportunityStats();

    // 1. 嘗試從 KV 快取讀取
    const cacheService = getKVCacheService(context);
    if (cacheService) {
      const cached = await cacheService.get<OpportunityStatsResult>(cacheKey);

      if (cached) {
        console.log("[OpportunityStats] Cache hit");
        return cached;
      }
    }

    console.log("[OpportunityStats] Cache miss, querying DB");

    // 2. 從資料庫查詢

    // 商機總數
    const totalResult = await db.select({ count: count() }).from(opportunities);
    const total = totalResult[0]?.count || 0;

    // 按狀態分佈
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

    // 平均 MEDDIC 分數
    const avgScoreResult = await db
      .select({ avgScore: avg(meddicAnalyses.overallScore) })
      .from(meddicAnalyses);
    const averageMeddicScore = roundScore(
      Number(avgScoreResult[0]?.avgScore) || 0
    );

    // 最近 7 天活動（排除已封存的對話）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentResult = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          gte(conversations.createdAt, sevenDaysAgo),
          ne(conversations.status, "archived")
        )
      );
    const recentActivity = recentResult[0]?.count || 0;

    const result: OpportunityStatsResult = {
      total,
      byStatus,
      averageMeddicScore,
      recentActivity,
    };

    // 3. 寫入 KV 快取
    if (cacheService) {
      await cacheService.set(cacheKey, result, CACHE_TTL.STATS);
      console.log("[OpportunityStats] Wrote to cache");
    }

    return result;
  }
);

// ============================================================
// Dashboard Procedure
// ============================================================

/**
 * 取得 scope 顯示文字
 */
function getScopeDisplay(
  role: string,
  department: string | null | undefined
): string {
  if (role === "admin") {
    return "全部";
  }
  if (role === "manager") {
    if (department === "all") {
      return "全部";
    }
    if (department === "ichef") {
      return "iCHEF 團隊";
    }
    if (department === "beauty") {
      return "Beauty 團隊";
    }
    return department || "團隊";
  }
  return "個人";
}

/**
 * 根據角色決定查詢範圍的目標用戶 ID 和標籤
 */
async function resolveQueryScope(
  userId: string,
  role: string,
  department: string | null | undefined
): Promise<{ targetUserIds: string[]; scopeLabel: string }> {
  // Admin: 全部機會
  if (role === "admin") {
    return { targetUserIds: [], scopeLabel: "all" };
  }

  // Manager: 同部門的機會
  if (role === "manager" && department) {
    const scopeLabel = `dept:${department}`;

    if (department === "all") {
      // department 是 'all' 的 manager 看全部
      return { targetUserIds: [], scopeLabel };
    }

    // 取得同部門的所有用戶
    const teamProfiles = await db.query.userProfiles.findMany({
      where: eq(userProfiles.department, department),
    });
    const targetUserIds = teamProfiles.map((p) => p.userId);
    return { targetUserIds, scopeLabel };
  }

  // Sales Rep: 只看自己
  return { targetUserIds: [userId], scopeLabel: "personal" };
}

/**
 * Dashboard 總覽
 * - 摘要統計（商機數、對話數、分析數、平均分數）
 * - 狀態分佈
 * - 最近分析
 * - 根據用戶角色自動調整查詢範圍
 */
export const getDashboard = protectedProcedure
  .input(dashboardSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const { dateFrom, dateTo } = input;

    // ========== 取得用戶角色和部門 ==========
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    const role = userProfile?.role || "sales_rep";
    const department = userProfile?.department;

    // ========== 根據角色決定查詢範圍 ==========
    const { targetUserIds, scopeLabel } = await resolveQueryScope(
      userId,
      role,
      department
    );

    // ========== KV 快取 ==========
    const shouldCache = !(dateFrom || dateTo);
    const cacheKey = CacheKeys.dashboard(scopeLabel, userId, role);

    if (shouldCache) {
      const cacheService = getKVCacheService(context);
      if (cacheService) {
        const cached = await cacheService.get<CachedDashboard>(cacheKey);

        if (cached) {
          console.log(`[Dashboard] Cache hit for ${scopeLabel}`);
          return cached;
        }
      }
    }

    console.log(`[Dashboard] Cache miss for ${scopeLabel}, querying DB`);

    // Build date filters
    const dateConditions = buildDateConditions(dateFrom, dateTo);
    const userCondition = buildUserCondition(targetUserIds);

    // ========== 查詢資料 ==========

    // Total opportunities
    const totalOpportunitiesResults = await db
      .select({ count: count() })
      .from(opportunities)
      .where(userCondition);
    const totalOpportunitiesResult = totalOpportunitiesResults[0] ?? {
      count: 0,
    };

    // Total conversations (排除已封存的對話)
    const conversationConditions = [ne(conversations.status, "archived")];
    if (userCondition) {
      conversationConditions.push(userCondition);
    }

    const totalConversationsResults = await db
      .select({ count: count() })
      .from(conversations)
      .innerJoin(
        opportunities,
        eq(conversations.opportunityId, opportunities.id)
      )
      .where(and(...conversationConditions));
    const totalConversationsResult = totalConversationsResults[0] ?? {
      count: 0,
    };

    // Total analyses
    const analysisConditions = [...dateConditions];
    if (userCondition) {
      analysisConditions.push(userCondition);
    }

    const totalAnalysesResults = await db
      .select({ count: count() })
      .from(meddicAnalyses)
      .innerJoin(
        opportunities,
        eq(meddicAnalyses.opportunityId, opportunities.id)
      )
      .where(
        analysisConditions.length > 0 ? and(...analysisConditions) : undefined
      );
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
      .where(
        analysisConditions.length > 0 ? and(...analysisConditions) : undefined
      );
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
      .where(
        analysisConditions.length > 0 ? and(...analysisConditions) : undefined
      )
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
      .where(
        analysisConditions.length > 0 ? and(...analysisConditions) : undefined
      )
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
      scope: getScopeDisplay(role, department),
    };

    // 寫入 KV 快取
    if (shouldCache) {
      const cacheService = getKVCacheService(context);
      if (cacheService) {
        await cacheService.set(cacheKey, result, CACHE_TTL.DASHBOARD);
        console.log(`[Dashboard] Wrote cache for ${scopeLabel}`);
      }
    }

    return result;
  });
