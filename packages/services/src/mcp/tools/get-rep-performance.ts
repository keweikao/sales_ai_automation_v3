import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
  repSkills,
} from "@Sales_ai_automation_v3/db/schema";
import { and, avg, count, desc, eq, gte, sql } from "drizzle-orm";

/**
 * get-rep-performance Tool
 * 取得業務人員的績效資料，用於 AI 教練分析與建議
 */

// ============================================================
// Types
// ============================================================

export type PerformancePeriod = "last_7_days" | "last_30_days" | "last_quarter";
export type PerformanceTrend = "improving" | "stable" | "declining";

export interface GetRepPerformanceInput {
  repId: string;
  period: PerformancePeriod;
}

export interface GetRepPerformanceOutput {
  demos: number;
  avgMeddicScore: number;
  conversionRate: number;
  trend: PerformanceTrend;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 根據期間取得起始日期
 */
function getStartDate(period: PerformancePeriod): Date {
  const now = new Date();
  switch (period) {
    case "last_7_days":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "last_30_days":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "last_quarter":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }
}

/**
 * 計算趨勢
 * 比較前半期與後半期的平均分數
 */
function calculateTrend(
  scores: { score: number; date: Date }[]
): PerformanceTrend {
  if (scores.length < 4) {
    return "stable";
  }

  const midPoint = Math.floor(scores.length / 2);
  const recentScores = scores.slice(0, midPoint);
  const olderScores = scores.slice(midPoint);

  const recentAvg =
    recentScores.reduce((sum, s) => sum + s.score, 0) / recentScores.length;
  const olderAvg =
    olderScores.reduce((sum, s) => sum + s.score, 0) / olderScores.length;

  const improvement = recentAvg - olderAvg;

  if (improvement >= 5) {
    return "improving";
  }
  if (improvement <= -5) {
    return "declining";
  }
  return "stable";
}

// ============================================================
// Main Function
// ============================================================

/**
 * 取得業務績效
 */
export async function getRepPerformance(
  input: GetRepPerformanceInput
): Promise<GetRepPerformanceOutput> {
  const { repId, period } = input;
  const startDate = getStartDate(period);

  // 1. 取得 Demo/對話數量
  const demoCountResult = await db
    .select({ count: count() })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, repId),
        gte(conversations.createdAt, startDate)
      )
    );
  const demos = demoCountResult[0]?.count ?? 0;

  // 2. 取得平均 MEDDIC 分數
  const avgScoreResult = await db
    .select({
      avgScore: avg(meddicAnalyses.overallScore),
    })
    .from(meddicAnalyses)
    .innerJoin(
      conversations,
      eq(meddicAnalyses.conversationId, conversations.id)
    )
    .where(
      and(
        eq(conversations.userId, repId),
        gte(meddicAnalyses.createdAt, startDate)
      )
    );
  const avgMeddicScore = Math.round(Number(avgScoreResult[0]?.avgScore ?? 0));

  // 3. 計算轉換率 (Won / Total opportunities)
  const opportunityStats = await db
    .select({
      total: count(),
      won: sql<number>`SUM(CASE WHEN ${opportunities.status} = 'won' THEN 1 ELSE 0 END)`,
    })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.userId, repId),
        gte(opportunities.createdAt, startDate)
      )
    );
  const total = opportunityStats[0]?.total ?? 0;
  const won = Number(opportunityStats[0]?.won ?? 0);
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

  // 4. 取得 MEDDIC 分數趨勢
  const recentScores = await db
    .select({
      score: meddicAnalyses.overallScore,
      date: meddicAnalyses.createdAt,
    })
    .from(meddicAnalyses)
    .innerJoin(
      conversations,
      eq(meddicAnalyses.conversationId, conversations.id)
    )
    .where(
      and(
        eq(conversations.userId, repId),
        gte(meddicAnalyses.createdAt, startDate)
      )
    )
    .orderBy(desc(meddicAnalyses.createdAt));

  const scoreTrendData = recentScores
    .filter((s) => s.score !== null)
    .map((s) => ({
      score: s.score as number,
      date: s.date,
    }));

  const trend = calculateTrend(scoreTrendData);

  // 5. 取得技能強弱項
  const skills = await db
    .select()
    .from(repSkills)
    .where(eq(repSkills.userId, repId))
    .orderBy(desc(repSkills.updatedAt));

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  for (const skill of skills) {
    const score = skill.score ?? 0;
    if (score >= 70) {
      strengths.push(skill.skillArea);
    } else if (score < 50) {
      weaknesses.push(skill.skillArea);
      if (skill.recommendation) {
        recommendations.push(skill.recommendation);
      }
    }
  }

  // 6. 根據績效數據生成額外建議
  if (
    avgMeddicScore < 50 &&
    !recommendations.some((r) => r.includes("MEDDIC"))
  ) {
    recommendations.push(
      "建議加強 MEDDIC 方法論的應用，特別是在需求探索和決策者識別方面"
    );
  }

  if (conversionRate < 20 && !recommendations.some((r) => r.includes("轉換"))) {
    recommendations.push(
      "轉換率偏低，建議檢視銷售流程中的瓶頸，可能需要加強收尾技巧"
    );
  }

  if (demos < 5 && period === "last_30_days") {
    recommendations.push("Demo 數量偏低，建議增加主動開發活動以提升銷售管道");
  }

  return {
    demos,
    avgMeddicScore,
    conversionRate,
    trend,
    strengths,
    weaknesses,
    recommendations,
  };
}

/**
 * MCP Tool Definition
 */
export const getRepPerformanceTool = {
  name: "get-rep-performance",
  description:
    "取得業務人員的績效資料，包含 Demo 數量、平均 MEDDIC 分數、轉換率、趨勢分析及強弱項",
  inputSchema: {
    type: "object" as const,
    properties: {
      repId: {
        type: "string",
        description: "業務人員的 User ID",
      },
      period: {
        type: "string",
        enum: ["last_7_days", "last_30_days", "last_quarter"],
        description: "查詢的時間區間",
      },
    },
    required: ["repId", "period"],
  },
  execute: getRepPerformance,
};
