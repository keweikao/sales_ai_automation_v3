/**
 * Analytics API Router
 * MEDDIC analysis statistics and dashboard data
 */

import { db } from "@Sales_ai_automation_v3/db/client";
import {
  conversations,
  leads,
  meddicAnalyses,
} from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { oz } from "@orpc/zod";
import { and, avg, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const dashboardSchema = oz.input(
  z.object({
    dateFrom: z.string().optional(), // ISO date string
    dateTo: z.string().optional(),
  })
);

const leadAnalyticsSchema = oz.input(
  z.object({
    leadId: z.string(),
  })
);

const meddicTrendsSchema = oz.input(
  z.object({
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
  })
);

// ============================================================
// Dashboard Overview
// ============================================================

/**
 * GET /analytics/dashboard
 * Get overview statistics for dashboard
 */
export const getDashboard = protectedProcedure
  .input(dashboardSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
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

    // Total leads
    const [totalLeadsResult] = await db
      .select({ count: count() })
      .from(leads)
      .where(eq(leads.userId, userId));

    // Total conversations
    const [totalConversationsResult] = await db
      .select({ count: count() })
      .from(conversations)
      .innerJoin(leads, eq(conversations.leadId, leads.id))
      .where(eq(leads.userId, userId));

    // Total analyses
    const analysisConditions = [eq(leads.userId, userId), ...dateConditions];
    const [totalAnalysesResult] = await db
      .select({ count: count() })
      .from(meddicAnalyses)
      .innerJoin(leads, eq(meddicAnalyses.leadId, leads.id))
      .where(and(...analysisConditions));

    // Average overall score
    const [avgScoreResult] = await db
      .select({
        avgScore: avg(meddicAnalyses.overallScore),
      })
      .from(meddicAnalyses)
      .innerJoin(leads, eq(meddicAnalyses.leadId, leads.id))
      .where(and(...analysisConditions));

    // Qualification status distribution
    const qualificationDistribution = await db
      .select({
        status: meddicAnalyses.qualificationStatus,
        count: count(),
      })
      .from(meddicAnalyses)
      .innerJoin(leads, eq(meddicAnalyses.leadId, leads.id))
      .where(and(...analysisConditions))
      .groupBy(meddicAnalyses.qualificationStatus);

    // Competitor detection stats
    const [competitorStats] = await db
      .select({
        total: count(),
        withCompetitor: sql<number>`SUM(CASE WHEN ${meddicAnalyses.hasCompetitor} THEN 1 ELSE 0 END)`,
      })
      .from(meddicAnalyses)
      .innerJoin(leads, eq(meddicAnalyses.leadId, leads.id))
      .where(and(...analysisConditions));

    // Recent analyses
    const recentAnalyses = await db
      .select({
        id: meddicAnalyses.id,
        leadId: leads.id,
        leadName: leads.name,
        overallScore: meddicAnalyses.overallScore,
        qualificationStatus: meddicAnalyses.qualificationStatus,
        hasCompetitor: meddicAnalyses.hasCompetitor,
        createdAt: meddicAnalyses.createdAt,
      })
      .from(meddicAnalyses)
      .innerJoin(leads, eq(meddicAnalyses.leadId, leads.id))
      .where(and(...analysisConditions))
      .orderBy(desc(meddicAnalyses.createdAt))
      .limit(10);

    return {
      summary: {
        totalLeads: totalLeadsResult.count,
        totalConversations: totalConversationsResult.count,
        totalAnalyses: totalAnalysesResult.count,
        averageScore: avgScoreResult.avgScore
          ? Number(avgScoreResult.avgScore)
          : 0,
        competitorDetectionRate:
          competitorStats.total > 0
            ? (Number(competitorStats.withCompetitor) / competitorStats.total) *
              100
            : 0,
      },
      qualificationDistribution: qualificationDistribution.map((d) => ({
        status: d.status,
        count: d.count,
      })),
      recentAnalyses: recentAnalyses.map((a) => ({
        id: a.id,
        leadId: a.leadId,
        leadName: a.leadName,
        overallScore: a.overallScore,
        qualificationStatus: a.qualificationStatus,
        hasCompetitor: a.hasCompetitor,
        createdAt: a.createdAt,
      })),
    };
  });

// ============================================================
// Lead Analytics
// ============================================================

/**
 * GET /analytics/lead/:id
 * Get detailed analytics for a specific lead
 */
export const getLeadAnalytics = protectedProcedure
  .input(leadAnalyticsSchema)
  .handler(async ({ input, context }) => {
    const { leadId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    // Verify lead ownership
    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.userId, userId)),
    });

    if (!lead) {
      throw new ORPCError("NOT_FOUND", "Lead not found");
    }

    // Get all analyses for this lead
    const analyses = await db.query.meddicAnalyses.findMany({
      where: eq(meddicAnalyses.leadId, leadId),
      orderBy: desc(meddicAnalyses.createdAt),
    });

    if (analyses.length === 0) {
      return {
        leadId,
        totalAnalyses: 0,
        latestAnalysis: null,
        scoreHistory: [],
        dimensionAverages: null,
        competitorMentions: [],
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

    analyses.forEach((a) => {
      const scores = a.scores as {
        metrics: number;
        economicBuyer: number;
        decisionCriteria: number;
        decisionProcess: number;
        identifyPain: number;
        champion: number;
      };
      dimensionSums.metrics += scores.metrics;
      dimensionSums.economicBuyer += scores.economicBuyer;
      dimensionSums.decisionCriteria += scores.decisionCriteria;
      dimensionSums.decisionProcess += scores.decisionProcess;
      dimensionSums.identifyPain += scores.identifyPain;
      dimensionSums.champion += scores.champion;
    });

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
      qualificationStatus: a.qualificationStatus,
      createdAt: a.createdAt,
    }));

    // Competitor mentions
    const competitorMentions = analyses
      .filter((a) => a.hasCompetitor)
      .map((a) => ({
        analysisId: a.id,
        keywords: a.competitorKeywords || [],
        createdAt: a.createdAt,
      }));

    return {
      leadId,
      totalAnalyses: analyses.length,
      latestAnalysis: analyses[0],
      scoreHistory,
      dimensionAverages,
      competitorMentions,
    };
  });

// ============================================================
// MEDDIC Trends
// ============================================================

/**
 * GET /analytics/meddic-trends
 * Get MEDDIC dimension trends over time
 */
export const getMeddicTrends = protectedProcedure
  .input(meddicTrendsSchema)
  .handler(async ({ input, context }) => {
    const { dateFrom, dateTo, dimension } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    // Build date filters
    const dateConditions = [eq(leads.userId, userId)];
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
        scores: meddicAnalyses.scores,
        overallScore: meddicAnalyses.overallScore,
        createdAt: meddicAnalyses.createdAt,
      })
      .from(meddicAnalyses)
      .innerJoin(leads, eq(meddicAnalyses.leadId, leads.id))
      .where(and(...dateConditions))
      .orderBy(meddicAnalyses.createdAt);

    // If specific dimension requested, calculate trend
    if (dimension) {
      const trendData = analyses.map((a) => {
        const scores = a.scores as Record<string, number>;
        return {
          date: a.createdAt,
          score: scores[dimension] || 0,
        };
      });

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
      const trendData = analyses.map((a) => {
        const scores = a.scores as Record<string, number>;
        return {
          date: a.createdAt,
          score: scores[dim] || 0,
        };
      });

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
  leadAnalytics: getLeadAnalytics,
  meddicTrends: getMeddicTrends,
};
