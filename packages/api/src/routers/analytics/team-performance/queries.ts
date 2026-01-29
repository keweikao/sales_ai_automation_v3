/**
 * Team Performance - Database Queries
 * 團隊表現報告的資料庫查詢函數
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
  user,
  userProfiles,
} from "@Sales_ai_automation_v3/db/schema";
import {
  and,
  avg,
  count,
  eq,
  gte,
  inArray,
  lte,
  ne,
  type SQL,
} from "drizzle-orm";

import type { PeriodRange } from "../utils";

// ============================================================
// Types
// ============================================================

export interface TeamMemberProfile {
  userId: string;
  role: string | null;
  department: string | null;
}

export interface MemberStats {
  userId: string;
  opportunityCount: number;
  avgScore: string | null;
}

export interface MemberPrevStats {
  userId: string;
  avgScore: string | null;
}

export interface MemberUser {
  id: string;
  name: string | null;
}

export interface MemberConvCount {
  userId: string;
  convCount: number;
}

export interface TeamStats {
  avgScore: string | null;
}

export interface TeamDimensionStats {
  avgMetrics: string | null;
  avgEconomicBuyer: string | null;
  avgDecisionCriteria: string | null;
  avgDecisionProcess: string | null;
  avgIdentifyPain: string | null;
  avgChampion: string | null;
}

export interface MemberDimensionStats extends TeamDimensionStats {
  userId: string;
}

export interface AtRiskOpportunity {
  opportunityId: string;
  companyName: string | null;
  userId: string;
  overallScore: number | null;
  status: string | null;
  risks: unknown;
  nextSteps: unknown;
}

export interface WeekStats {
  avgScore: string | null;
}

// ============================================================
// Query Functions
// ============================================================

/**
 * 取得團隊成員列表（根據部門篩選）
 */
export async function fetchTeamMemberProfiles(
  department: string
): Promise<TeamMemberProfile[]> {
  if (department === "all") {
    return db.query.userProfiles.findMany();
  }
  return db.query.userProfiles.findMany({
    where: eq(userProfiles.department, department),
  });
}

/**
 * 取得團隊總商機數
 */
export async function fetchTotalOpportunities(
  memberIds: string[]
): Promise<{ count: number }[]> {
  return db
    .select({ count: count() })
    .from(opportunities)
    .where(inArray(opportunities.userId, memberIds));
}

/**
 * 取得團隊總對話數（排除已封存）
 */
export async function fetchTotalConversations(
  memberIds: string[]
): Promise<{ count: number }[]> {
  return db
    .select({ count: count() })
    .from(conversations)
    .innerJoin(opportunities, eq(conversations.opportunityId, opportunities.id))
    .where(
      and(
        inArray(opportunities.userId, memberIds),
        ne(conversations.status, "archived")
      )
    );
}

/**
 * 取得團隊當期平均分數
 */
export async function fetchTeamCurrentStats(
  memberIds: string[],
  dateConditions: SQL<unknown>[]
): Promise<TeamStats[]> {
  return db
    .select({
      avgScore: avg(meddicAnalyses.overallScore),
    })
    .from(meddicAnalyses)
    .innerJoin(
      opportunities,
      eq(meddicAnalyses.opportunityId, opportunities.id)
    )
    .where(and(inArray(opportunities.userId, memberIds), ...dateConditions));
}

/**
 * 取得團隊上期平均分數
 */
export async function fetchTeamPreviousStats(
  memberIds: string[],
  previousPeriod: PeriodRange
): Promise<TeamStats[]> {
  return db
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
        gte(meddicAnalyses.createdAt, previousPeriod.start),
        lte(meddicAnalyses.createdAt, previousPeriod.end)
      )
    );
}

/**
 * 取得成員統計資料（商機數、平均分數）
 */
export async function fetchMemberStats(
  memberIds: string[],
  dateConditions: SQL<unknown>[]
): Promise<MemberStats[]> {
  return db
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
}

/**
 * 取得成員上期平均分數
 */
export async function fetchMemberPrevStats(
  memberIds: string[],
  previousPeriod: PeriodRange
): Promise<MemberPrevStats[]> {
  return db
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
        gte(meddicAnalyses.createdAt, previousPeriod.start),
        lte(meddicAnalyses.createdAt, previousPeriod.end)
      )
    )
    .groupBy(opportunities.userId);
}

/**
 * 取得成員基本資料（ID、名稱）
 */
export async function fetchMemberUsers(
  memberIds: string[]
): Promise<MemberUser[]> {
  return db
    .select({
      id: user.id,
      name: user.name,
    })
    .from(user)
    .where(inArray(user.id, memberIds));
}

/**
 * 取得成員對話數（排除已封存）
 */
export async function fetchMemberConversationCounts(
  memberIds: string[]
): Promise<MemberConvCount[]> {
  return db
    .select({
      userId: opportunities.userId,
      convCount: count(conversations.id),
    })
    .from(opportunities)
    .leftJoin(
      conversations,
      and(
        eq(conversations.opportunityId, opportunities.id),
        ne(conversations.status, "archived")
      )
    )
    .where(inArray(opportunities.userId, memberIds))
    .groupBy(opportunities.userId);
}

/**
 * 取得團隊維度統計（MEDDIC 各維度平均分數）
 */
export async function fetchTeamDimensionStats(
  memberIds: string[],
  dateConditions: SQL<unknown>[]
): Promise<TeamDimensionStats[]> {
  return db
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
}

/**
 * 取得每個成員的維度分數
 */
export async function fetchMemberDimensionStats(
  memberIds: string[],
  dateConditions: SQL<unknown>[]
): Promise<MemberDimensionStats[]> {
  return db
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
}

/**
 * 取得需要關注的商機（分數低於 50 分）
 */
export async function fetchAtRiskOpportunities(
  memberIds: string[],
  dateConditions: SQL<unknown>[]
): Promise<AtRiskOpportunity[]> {
  return db
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
}

/**
 * 取得指定週期的團隊平均分數
 */
export async function fetchWeeklyStats(
  memberIds: string[],
  weekStart: Date,
  weekEnd: Date
): Promise<WeekStats[]> {
  return db
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
}
