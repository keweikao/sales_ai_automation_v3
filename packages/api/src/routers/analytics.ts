/**
 * Analytics API Router
 * MEDDIC analysis statistics and dashboard data
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  opportunities,
  meddicAnalyses,
} from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { and, avg, count, desc, eq, gte, lte } from "drizzle-orm";
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

    // Build date filters
    const dateConditions = [];
    if (dateFrom) {
      dateConditions.push(gte(meddicAnalyses.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      dateConditions.push(lte(meddicAnalyses.createdAt, new Date(dateTo)));
    }

    // Total opportunities
    const totalOpportunitiesResults = await db
      .select({ count: count() })
      .from(opportunities)
      .where(eq(opportunities.userId, userId));
    const totalOpportunitiesResult = totalOpportunitiesResults[0] ?? { count: 0 };

    // Total conversations
    const totalConversationsResults = await db
      .select({ count: count() })
      .from(conversations)
      .innerJoin(opportunities, eq(conversations.opportunityId, opportunities.id))
      .where(eq(opportunities.userId, userId));
    const totalConversationsResult = totalConversationsResults[0] ?? { count: 0 };

    // Total analyses
    const analysisConditions = [eq(opportunities.userId, userId), ...dateConditions];
    const totalAnalysesResults = await db
      .select({ count: count() })
      .from(meddicAnalyses)
      .innerJoin(opportunities, eq(meddicAnalyses.opportunityId, opportunities.id))
      .where(and(...analysisConditions));
    const totalAnalysesResult = totalAnalysesResults[0] ?? { count: 0 };

    // Average overall score
    const avgScoreResults = await db
      .select({
        avgScore: avg(meddicAnalyses.overallScore),
      })
      .from(meddicAnalyses)
      .innerJoin(opportunities, eq(meddicAnalyses.opportunityId, opportunities.id))
      .where(and(...analysisConditions));
    const avgScoreResult = avgScoreResults[0];

    // Status distribution
    const statusDistribution = await db
      .select({
        status: meddicAnalyses.status,
        count: count(),
      })
      .from(meddicAnalyses)
      .innerJoin(opportunities, eq(meddicAnalyses.opportunityId, opportunities.id))
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
      .innerJoin(opportunities, eq(meddicAnalyses.opportunityId, opportunities.id))
      .where(and(...analysisConditions))
      .orderBy(desc(meddicAnalyses.createdAt))
      .limit(10);

    return {
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
      where: and(eq(opportunities.id, opportunityId), eq(opportunities.userId, userId)),
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
    const dateConditions = [eq(opportunities.userId, userId)];
    if (dateFrom) {
      dateConditions.push(gte(meddicAnalyses.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      dateConditions.push(lte(meddicAnalyses.createdAt, new Date(dateTo)));
    }

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
      .innerJoin(opportunities, eq(meddicAnalyses.opportunityId, opportunities.id))
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
// Router Export
// ============================================================

export const analyticsRouter = {
  dashboard: getDashboard,
  opportunityAnalytics: getOpportunityAnalytics,
  meddicTrends: getMeddicTrends,
};
