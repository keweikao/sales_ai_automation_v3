import { db } from "@Sales_ai_automation_v3/db";
import {
  alerts,
  conversations,
  meddicAnalyses,
  opportunities,
  teamMembers,
  user,
} from "@Sales_ai_automation_v3/db/schema";
import { and, avg, count, eq, gte, inArray, sql } from "drizzle-orm";

/**
 * Manager Report 場景
 *
 * 產生團隊週報，包含：
 * 1. 團隊整體績效統計
 * 2. 個別業務表現
 * 3. 趨勢分析
 * 4. 建議行動
 * 5. 需關注的警示
 */

// ============================================================
// Types
// ============================================================

export type TrendDirection = "improving" | "stable" | "declining";

export interface RepPerformanceSummary {
  repId: string;
  repName: string;
  repEmail: string;
  demos: number;
  opportunities: number;
  avgMeddicScore: number;
  conversionRate: number;
  trend: TrendDirection;
  pendingAlerts: number;
}

export interface TeamStats {
  totalDemos: number;
  totalOpportunities: number;
  avgMeddicScore: number;
  overallConversionRate: number;
  trend: TrendDirection;
  wonDeals: number;
  lostDeals: number;
}

export interface AlertSummary {
  closeNow: number;
  missingDm: number;
  managerEscalation: number;
  total: number;
}

export interface ActionRecommendation {
  priority: "high" | "medium" | "low";
  category: string;
  description: string;
  targetReps?: string[];
}

export interface ManagerReport {
  reportId: string;
  managerId: string;
  managerName: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  teamStats: TeamStats;
  repPerformances: RepPerformanceSummary[];
  alertSummary: AlertSummary;
  recommendations: ActionRecommendation[];
  highlights: string[];
  concerns: string[];
}

export interface GenerateReportInput {
  managerId: string;
  periodDays?: number; // 預設 7 天
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 產生報告 ID
 */
function generateReportId(): string {
  return `report_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 計算趨勢
 */
function calculateTrend(
  currentScore: number,
  previousScore: number
): TrendDirection {
  const diff = currentScore - previousScore;
  if (diff >= 5) return "improving";
  if (diff <= -5) return "declining";
  return "stable";
}

/**
 * 取得主管的團隊成員
 */
async function getTeamMembers(
  managerId: string
): Promise<{ id: string; name: string; email: string }[]> {
  const members = await db.query.teamMembers.findMany({
    where: eq(teamMembers.managerId, managerId),
    with: {
      member: true,
    },
  });

  return members
    .filter((m) => m.member)
    .map((m) => ({
      id: m.member.id,
      name: m.member.name,
      email: m.member.email,
    }));
}

/**
 * 取得單一業務的績效
 */
async function getRepPerformance(
  repId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  demos: number;
  opportunities: number;
  avgMeddicScore: number;
  conversionRate: number;
  wonDeals: number;
  lostDeals: number;
}> {
  // Demo/對話數量
  const demoResult = await db
    .select({ count: count() })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, repId),
        gte(conversations.createdAt, startDate)
      )
    );
  const demos = demoResult[0]?.count ?? 0;

  // 商機統計
  const oppStats = await db
    .select({
      total: count(),
      won: sql<number>`SUM(CASE WHEN ${opportunities.status} = 'won' THEN 1 ELSE 0 END)`,
      lost: sql<number>`SUM(CASE WHEN ${opportunities.status} = 'lost' THEN 1 ELSE 0 END)`,
    })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.userId, repId),
        gte(opportunities.createdAt, startDate)
      )
    );

  const total = oppStats[0]?.total ?? 0;
  const won = Number(oppStats[0]?.won ?? 0);
  const lost = Number(oppStats[0]?.lost ?? 0);
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

  // 平均 MEDDIC 分數
  const scoreResult = await db
    .select({ avgScore: avg(meddicAnalyses.overallScore) })
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

  const avgMeddicScore = Math.round(Number(scoreResult[0]?.avgScore ?? 0));

  return {
    demos,
    opportunities: total,
    avgMeddicScore,
    conversionRate,
    wonDeals: won,
    lostDeals: lost,
  };
}

/**
 * 取得業務趨勢
 */
async function getRepTrend(
  repId: string,
  startDate: Date
): Promise<TrendDirection> {
  const midDate = new Date((startDate.getTime() + Date.now()) / 2);

  // 前半期平均
  const firstHalf = await db
    .select({ avgScore: avg(meddicAnalyses.overallScore) })
    .from(meddicAnalyses)
    .innerJoin(
      conversations,
      eq(meddicAnalyses.conversationId, conversations.id)
    )
    .where(
      and(
        eq(conversations.userId, repId),
        gte(meddicAnalyses.createdAt, startDate),
        sql`${meddicAnalyses.createdAt} < ${midDate}`
      )
    );

  // 後半期平均
  const secondHalf = await db
    .select({ avgScore: avg(meddicAnalyses.overallScore) })
    .from(meddicAnalyses)
    .innerJoin(
      conversations,
      eq(meddicAnalyses.conversationId, conversations.id)
    )
    .where(
      and(
        eq(conversations.userId, repId),
        gte(meddicAnalyses.createdAt, midDate)
      )
    );

  const firstScore = Number(firstHalf[0]?.avgScore ?? 0);
  const secondScore = Number(secondHalf[0]?.avgScore ?? 0);

  return calculateTrend(secondScore, firstScore);
}

/**
 * 取得警示統計
 */
async function getAlertSummary(
  repIds: string[],
  startDate: Date
): Promise<AlertSummary> {
  if (repIds.length === 0) {
    return { closeNow: 0, missingDm: 0, managerEscalation: 0, total: 0 };
  }

  const alertStats = await db
    .select({
      type: alerts.type,
      count: count(),
    })
    .from(alerts)
    .where(
      and(
        inArray(alerts.userId, repIds),
        eq(alerts.status, "pending"),
        gte(alerts.createdAt, startDate)
      )
    )
    .groupBy(alerts.type);

  const summary: AlertSummary = {
    closeNow: 0,
    missingDm: 0,
    managerEscalation: 0,
    total: 0,
  };

  for (const stat of alertStats) {
    const countValue = stat.count;
    switch (stat.type) {
      case "close_now":
        summary.closeNow = countValue;
        break;
      case "missing_dm":
        summary.missingDm = countValue;
        break;
      case "manager_escalation":
        summary.managerEscalation = countValue;
        break;
    }
    summary.total += countValue;
  }

  return summary;
}

/**
 * 產生建議行動
 */
function generateRecommendations(
  teamStats: TeamStats,
  repPerformances: RepPerformanceSummary[],
  alertSummary: AlertSummary
): ActionRecommendation[] {
  const recommendations: ActionRecommendation[] = [];

  // Close Now 警示處理
  if (alertSummary.closeNow > 0) {
    recommendations.push({
      priority: "high",
      category: "成交機會",
      description: `有 ${alertSummary.closeNow} 個 Close Now 機會待跟進，建議立即安排成交會議`,
    });
  }

  // Manager Escalation 處理
  if (alertSummary.managerEscalation > 0) {
    recommendations.push({
      priority: "high",
      category: "主管介入",
      description: `有 ${alertSummary.managerEscalation} 個案例需要主管介入，建議安排一對一輔導`,
    });
  }

  // 低績效業務輔導
  const lowPerformers = repPerformances.filter(
    (r) => r.avgMeddicScore < 50 || r.trend === "declining"
  );
  if (lowPerformers.length > 0) {
    recommendations.push({
      priority: "medium",
      category: "人員培訓",
      description: `${lowPerformers.length} 位業務需要加強輔導`,
      targetReps: lowPerformers.map((r) => r.repName),
    });
  }

  // Missing DM 追蹤
  if (alertSummary.missingDm > 0) {
    recommendations.push({
      priority: "medium",
      category: "流程改善",
      description: `${alertSummary.missingDm} 個案例缺少決策者接觸，建議檢視銷售流程`,
    });
  }

  // 團隊趨勢建議
  if (teamStats.trend === "declining") {
    recommendations.push({
      priority: "high",
      category: "團隊策略",
      description: "團隊整體趨勢下滑，建議召開檢討會議並調整策略",
    });
  }

  // 轉換率建議
  if (teamStats.overallConversionRate < 20) {
    recommendations.push({
      priority: "medium",
      category: "轉換優化",
      description: "團隊轉換率偏低，建議加強收尾技巧培訓",
    });
  }

  return recommendations;
}

/**
 * 產生亮點與關注事項
 */
function generateHighlightsAndConcerns(
  teamStats: TeamStats,
  repPerformances: RepPerformanceSummary[]
): { highlights: string[]; concerns: string[] } {
  const highlights: string[] = [];
  const concerns: string[] = [];

  // 亮點
  if (teamStats.trend === "improving") {
    highlights.push("團隊整體績效呈上升趨勢");
  }

  if (teamStats.wonDeals > 0) {
    highlights.push(`本週成功成交 ${teamStats.wonDeals} 筆`);
  }

  const topPerformers = repPerformances
    .filter((r) => r.avgMeddicScore >= 70 && r.trend === "improving")
    .map((r) => r.repName);
  if (topPerformers.length > 0) {
    highlights.push(`表現優異：${topPerformers.join("、")}`);
  }

  // 關注事項
  if (teamStats.trend === "declining") {
    concerns.push("團隊整體績效下滑，需要關注");
  }

  if (teamStats.lostDeals > teamStats.wonDeals) {
    concerns.push("流失案例數超過成交數，需檢視原因");
  }

  const strugglingReps = repPerformances
    .filter((r) => r.avgMeddicScore < 40 || r.pendingAlerts > 2)
    .map((r) => r.repName);
  if (strugglingReps.length > 0) {
    concerns.push(`需額外關注：${strugglingReps.join("、")}`);
  }

  return { highlights, concerns };
}

// ============================================================
// Main Function
// ============================================================

/**
 * 產生主管週報
 */
export async function generateManagerReport(
  input: GenerateReportInput
): Promise<ManagerReport> {
  const { managerId, periodDays = 7 } = input;

  const endDate = new Date();
  const startDate = new Date(
    endDate.getTime() - periodDays * 24 * 60 * 60 * 1000
  );

  // 取得主管資訊
  const manager = await db.query.user.findFirst({
    where: eq(user.id, managerId),
  });

  if (!manager) {
    throw new Error(`Manager not found: ${managerId}`);
  }

  // 取得團隊成員
  const members = await getTeamMembers(managerId);
  const memberIds = members.map((m) => m.id);

  // 取得各業務績效
  const repPerformances: RepPerformanceSummary[] = [];
  let totalDemos = 0;
  let totalOpportunities = 0;
  let totalWon = 0;
  let totalLost = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const member of members) {
    const perf = await getRepPerformance(member.id, startDate, endDate);
    const trend = await getRepTrend(member.id, startDate);

    // 取得該業務的待處理警示數
    const alertCount = await db
      .select({ count: count() })
      .from(alerts)
      .where(and(eq(alerts.userId, member.id), eq(alerts.status, "pending")));

    repPerformances.push({
      repId: member.id,
      repName: member.name,
      repEmail: member.email,
      demos: perf.demos,
      opportunities: perf.opportunities,
      avgMeddicScore: perf.avgMeddicScore,
      conversionRate: perf.conversionRate,
      trend,
      pendingAlerts: alertCount[0]?.count ?? 0,
    });

    totalDemos += perf.demos;
    totalOpportunities += perf.opportunities;
    totalWon += perf.wonDeals;
    totalLost += perf.lostDeals;
    if (perf.avgMeddicScore > 0) {
      scoreSum += perf.avgMeddicScore;
      scoreCount++;
    }
  }

  // 計算團隊統計
  const teamAvgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
  const overallConversionRate =
    totalOpportunities > 0
      ? Math.round((totalWon / totalOpportunities) * 100)
      : 0;

  // 計算團隊趨勢
  const improvingCount = repPerformances.filter(
    (r) => r.trend === "improving"
  ).length;
  const decliningCount = repPerformances.filter(
    (r) => r.trend === "declining"
  ).length;

  let teamTrend: TrendDirection = "stable";
  if (improvingCount > decliningCount + 1) {
    teamTrend = "improving";
  } else if (decliningCount > improvingCount + 1) {
    teamTrend = "declining";
  }

  const teamStats: TeamStats = {
    totalDemos,
    totalOpportunities,
    avgMeddicScore: teamAvgScore,
    overallConversionRate,
    trend: teamTrend,
    wonDeals: totalWon,
    lostDeals: totalLost,
  };

  // 取得警示統計
  const alertSummary = await getAlertSummary(memberIds, startDate);

  // 產生建議
  const recommendations = generateRecommendations(
    teamStats,
    repPerformances,
    alertSummary
  );

  // 產生亮點與關注事項
  const { highlights, concerns } = generateHighlightsAndConcerns(
    teamStats,
    repPerformances
  );

  return {
    reportId: generateReportId(),
    managerId,
    managerName: manager.name,
    generatedAt: new Date(),
    period: {
      start: startDate,
      end: endDate,
    },
    teamStats,
    repPerformances,
    alertSummary,
    recommendations,
    highlights,
    concerns,
  };
}

/**
 * 將報告格式化為文字（用於 Email 或 Slack）
 */
export function formatReportAsText(report: ManagerReport): string {
  const lines: string[] = [];

  lines.push(`📊 團隊週報 - ${report.managerName}`);
  lines.push(
    `報告期間：${report.period.start.toLocaleDateString("zh-TW")} ~ ${report.period.end.toLocaleDateString("zh-TW")}`
  );
  lines.push("");

  // 團隊統計
  lines.push("【團隊整體表現】");
  lines.push(`• Demo 數量：${report.teamStats.totalDemos}`);
  lines.push(`• 商機數量：${report.teamStats.totalOpportunities}`);
  lines.push(`• 平均 MEDDIC 分數：${report.teamStats.avgMeddicScore}`);
  lines.push(`• 轉換率：${report.teamStats.overallConversionRate}%`);
  lines.push(
    `• 成交數 / 流失數：${report.teamStats.wonDeals} / ${report.teamStats.lostDeals}`
  );
  lines.push(`• 趨勢：${getTrendEmoji(report.teamStats.trend)}`);
  lines.push("");

  // 警示統計
  lines.push("【待處理警示】");
  lines.push(`• Close Now：${report.alertSummary.closeNow}`);
  lines.push(`• 缺少決策者：${report.alertSummary.missingDm}`);
  lines.push(`• 需主管關注：${report.alertSummary.managerEscalation}`);
  lines.push("");

  // 亮點
  if (report.highlights.length > 0) {
    lines.push("【亮點】");
    for (const h of report.highlights) {
      lines.push(`✅ ${h}`);
    }
    lines.push("");
  }

  // 關注事項
  if (report.concerns.length > 0) {
    lines.push("【需關注】");
    for (const c of report.concerns) {
      lines.push(`⚠️ ${c}`);
    }
    lines.push("");
  }

  // 建議行動
  if (report.recommendations.length > 0) {
    lines.push("【建議行動】");
    for (const r of report.recommendations) {
      const priorityEmoji =
        r.priority === "high" ? "🔴" : r.priority === "medium" ? "🟡" : "🟢";
      lines.push(`${priorityEmoji} [${r.category}] ${r.description}`);
    }
    lines.push("");
  }

  // 個人表現
  lines.push("【個人表現摘要】");
  for (const rep of report.repPerformances) {
    const trendEmoji = getTrendEmoji(rep.trend);
    lines.push(
      `• ${rep.repName}：MEDDIC ${rep.avgMeddicScore} | Demo ${rep.demos} | 轉換率 ${rep.conversionRate}% ${trendEmoji}`
    );
  }

  return lines.join("\n");
}

function getTrendEmoji(trend: TrendDirection): string {
  switch (trend) {
    case "improving":
      return "📈";
    case "declining":
      return "📉";
    case "stable":
      return "➡️";
  }
}
