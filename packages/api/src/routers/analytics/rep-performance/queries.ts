/**
 * Rep Performance - Database Queries
 * 業務個人表現報告的資料庫查詢函數
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
  userProfiles,
} from "@Sales_ai_automation_v3/db/schema";
import { and, avg, count, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";

import type { PeriodRange } from "../utils";

// ============================================================
// Types
// ============================================================

export interface BasicStats {
  totalOpportunities: number;
  totalConversations: number;
}

export interface PeriodStats {
  count: number;
  avgScore: number;
}

export interface DimensionStats {
  avgMetrics: number;
  avgEconomicBuyer: number;
  avgDecisionCriteria: number;
  avgDecisionProcess: number;
  avgIdentifyPain: number;
  avgChampion: number;
}

export interface TeamScoreResult {
  userId: string;
  avgScore: string | number | null;
}

export interface Agent6Output {
  coachingNotes?: string;
  improvements?: Array<{ area: string; suggestion: string }>;
}

// ============================================================
// Basic Statistics Queries
// ============================================================

/**
 * 查詢用戶的商機總數
 */
export async function fetchTotalOpportunities(userId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(opportunities)
    .where(eq(opportunities.userId, userId));

  return result[0]?.count ?? 0;
}

/**
 * 查詢用戶的對話總數（排除已封存）
 */
export async function fetchTotalConversations(userId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(conversations)
    .innerJoin(opportunities, eq(conversations.opportunityId, opportunities.id))
    .where(
      and(
        eq(opportunities.userId, userId),
        ne(conversations.status, "archived")
      )
    );

  return result[0]?.count ?? 0;
}

/**
 * 查詢基本統計（商機數和對話數）
 */
export async function fetchBasicStats(userId: string): Promise<BasicStats> {
  const [totalOpportunities, totalConversations] = await Promise.all([
    fetchTotalOpportunities(userId),
    fetchTotalConversations(userId),
  ]);

  return {
    totalOpportunities,
    totalConversations,
  };
}

// ============================================================
// Period Statistics Queries
// ============================================================

/**
 * 查詢特定期間的分析統計
 */
export async function fetchPeriodStats(
  userId: string,
  period: PeriodRange
): Promise<PeriodStats> {
  const result = await db
    .select({
      count: count(),
      avgScore: avg(meddicAnalyses.overallScore),
    })
    .from(meddicAnalyses)
    .innerJoin(
      opportunities,
      eq(meddicAnalyses.opportunityId, opportunities.id)
    )
    .where(
      and(
        eq(opportunities.userId, userId),
        gte(meddicAnalyses.createdAt, period.start),
        lte(meddicAnalyses.createdAt, period.end)
      )
    );

  return {
    count: result[0]?.count ?? 0,
    avgScore: Number(result[0]?.avgScore) || 0,
  };
}

// ============================================================
// Dimension Statistics Queries
// ============================================================

/**
 * 查詢 MEDDIC 六維度平均分數
 */
export async function fetchDimensionStats(
  userId: string,
  period: PeriodRange
): Promise<DimensionStats> {
  const result = await db
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
        eq(opportunities.userId, userId),
        gte(meddicAnalyses.createdAt, period.start),
        lte(meddicAnalyses.createdAt, period.end)
      )
    );

  return {
    avgMetrics: Number(result[0]?.avgMetrics) || 0,
    avgEconomicBuyer: Number(result[0]?.avgEconomicBuyer) || 0,
    avgDecisionCriteria: Number(result[0]?.avgDecisionCriteria) || 0,
    avgDecisionProcess: Number(result[0]?.avgDecisionProcess) || 0,
    avgIdentifyPain: Number(result[0]?.avgIdentifyPain) || 0,
    avgChampion: Number(result[0]?.avgChampion) || 0,
  };
}

// ============================================================
// Team Comparison Queries
// ============================================================

/**
 * 查詢用戶的 profile（包含 department）
 */
export async function fetchUserProfile(userId: string) {
  return db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });
}

/**
 * 查詢團隊成員（依 department 篩選）
 */
export async function fetchTeamProfiles(department: string) {
  if (department === "all") {
    return db.query.userProfiles.findMany();
  }
  return db.query.userProfiles.findMany({
    where: eq(userProfiles.department, department),
  });
}

/**
 * 查詢團隊成員的平均分數
 */
export async function fetchTeamScores(
  memberIds: string[],
  period: PeriodRange
): Promise<TeamScoreResult[]> {
  if (memberIds.length === 0) {
    return [];
  }

  return db
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
      and(
        inArray(opportunities.userId, memberIds),
        gte(meddicAnalyses.createdAt, period.start),
        lte(meddicAnalyses.createdAt, period.end)
      )
    )
    .groupBy(opportunities.userId);
}

// ============================================================
// Coaching Insights Queries
// ============================================================

/**
 * 查詢用戶的 opportunity IDs
 */
export async function fetchUserOpportunityIds(
  userId: string
): Promise<string[]> {
  const userOpportunities = await db.query.opportunities.findMany({
    where: eq(opportunities.userId, userId),
    columns: { id: true },
  });

  return userOpportunities.map((o) => o.id);
}

/**
 * 查詢最近的分析記錄（含 Agent 6 輸出）
 */
export async function fetchRecentAnalyses(
  opportunityIds: string[],
  period: PeriodRange,
  limit = 5
) {
  if (opportunityIds.length === 0) {
    return [];
  }

  return db.query.meddicAnalyses.findMany({
    where: and(
      inArray(meddicAnalyses.opportunityId, opportunityIds),
      gte(meddicAnalyses.createdAt, period.start),
      lte(meddicAnalyses.createdAt, period.end)
    ),
    orderBy: desc(meddicAnalyses.createdAt),
    limit,
  });
}

// ============================================================
// Progress Tracking Queries
// ============================================================

/**
 * 查詢最近 N 天的平均分數
 */
export async function fetchRecentDaysAvgScore(
  userId: string,
  daysAgo: number,
  daysLength: number
): Promise<number> {
  const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const endDate = new Date(
    Date.now() - (daysAgo - daysLength) * 24 * 60 * 60 * 1000
  );

  const result = await db
    .select({ avgScore: avg(meddicAnalyses.overallScore) })
    .from(meddicAnalyses)
    .innerJoin(
      opportunities,
      eq(meddicAnalyses.opportunityId, opportunities.id)
    )
    .where(
      and(
        eq(opportunities.userId, userId),
        gte(meddicAnalyses.createdAt, startDate),
        lte(meddicAnalyses.createdAt, endDate)
      )
    );

  return Number(result[0]?.avgScore) || 0;
}

/**
 * 查詢進步追蹤數據（30 天和 90 天）
 */
export async function fetchProgressData(userId: string): Promise<{
  last30Avg: number;
  prev30Avg: number;
  last90Avg: number;
  prev90Avg: number;
}> {
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
        eq(opportunities.userId, userId),
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
        eq(opportunities.userId, userId),
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
        eq(opportunities.userId, userId),
        gte(meddicAnalyses.createdAt, last90DaysStart)
      )
    );

  // 前 90 天（90-180 天前）
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
        eq(opportunities.userId, userId),
        gte(meddicAnalyses.createdAt, prev90DaysStart),
        lte(meddicAnalyses.createdAt, last90DaysStart)
      )
    );

  return {
    last30Avg: Number(last30DaysStats[0]?.avgScore) || 0,
    prev30Avg: Number(prev30DaysStats[0]?.avgScore) || 0,
    last90Avg: Number(last90DaysStats[0]?.avgScore) || 0,
    prev90Avg: Number(prev90DaysStats[0]?.avgScore) || 0,
  };
}
