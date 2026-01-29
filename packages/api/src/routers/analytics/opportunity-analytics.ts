/**
 * Opportunity Analytics Module
 * 包含 getOpportunityAnalytics 和 getMeddicTrends procedures
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  meddicAnalyses,
  opportunities,
} from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";

import { protectedProcedure } from "../../index";
import { meddicTrendsSchema, opportunityAnalyticsSchema } from "./schemas";
import { buildDateConditions } from "./utils";

// ============================================================
// Types
// ============================================================

/** MEDDIC 六維度名稱 */
type MeddicDimension =
  | "metrics"
  | "economicBuyer"
  | "decisionCriteria"
  | "decisionProcess"
  | "identifyPain"
  | "champion";

/** 維度分數欄位對應 */
interface AnalysisScores {
  id: string;
  metricsScore: number | null;
  economicBuyerScore: number | null;
  decisionCriteriaScore: number | null;
  decisionProcessScore: number | null;
  identifyPainScore: number | null;
  championScore: number | null;
  overallScore: number | null;
  createdAt: Date;
}

// ============================================================
// Opportunity Analytics Procedure
// ============================================================

/**
 * 商機分析
 * - 特定商機的所有 MEDDIC 分析
 * - 分數歷史
 * - 維度平均值
 */
export const getOpportunityAnalytics = protectedProcedure
  .input(opportunityAnalyticsSchema)
  .handler(async ({ input, context }) => {
    const { opportunityId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 驗證商機所有權
    const opportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.userId, userId)
      ),
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    // 取得該商機的所有分析
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

    // 計算維度平均值
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

    // 分數歷史
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
// MEDDIC Trends Procedure
// ============================================================

/** 維度分數欄位對應表 */
const DIMENSION_SCORE_MAP: Record<MeddicDimension, keyof AnalysisScores> = {
  metrics: "metricsScore",
  economicBuyer: "economicBuyerScore",
  decisionCriteria: "decisionCriteriaScore",
  decisionProcess: "decisionProcessScore",
  identifyPain: "identifyPainScore",
  champion: "championScore",
};

/** 所有維度列表 */
const ALL_DIMENSIONS: MeddicDimension[] = [
  "metrics",
  "economicBuyer",
  "decisionCriteria",
  "decisionProcess",
  "identifyPain",
  "champion",
];

/**
 * 計算單一維度的趨勢資料
 */
function calculateDimensionTrend(
  analyses: AnalysisScores[],
  dimension: MeddicDimension
) {
  const scoreField = DIMENSION_SCORE_MAP[dimension];

  const trendData = analyses.map((a) => ({
    date: a.createdAt,
    score: (a[scoreField] as number | null) || 0,
  }));

  const average =
    trendData.reduce((sum, d) => sum + d.score, 0) / trendData.length || 0;

  return {
    dimension,
    trend: trendData,
    average,
  };
}

/**
 * MEDDIC 趨勢分析
 * - 單一維度或所有維度的趨勢資料
 * - 支援日期範圍篩選
 */
export const getMeddicTrends = protectedProcedure
  .input(meddicTrendsSchema)
  .handler(async ({ input, context }) => {
    const { dateFrom, dateTo, dimension } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 建立過濾條件
    const dateConditions = [
      eq(opportunities.userId, userId),
      ...buildDateConditions(dateFrom, dateTo),
    ];

    // 查詢日期範圍內的所有分析
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

    // 如果指定了特定維度，只返回該維度的趨勢
    if (dimension) {
      if (!DIMENSION_SCORE_MAP[dimension]) {
        throw new ORPCError("BAD_REQUEST");
      }

      return calculateDimensionTrend(analyses, dimension);
    }

    // 否則，返回所有維度的趨勢
    const trends = ALL_DIMENSIONS.map((dim) =>
      calculateDimensionTrend(analyses, dim)
    );

    return {
      trends,
      overallScoreTrend: analyses.map((a) => ({
        date: a.createdAt,
        score: a.overallScore,
      })),
    };
  });
