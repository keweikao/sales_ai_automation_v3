/**
 * Team Dashboard Generation Tool
 * 生成團隊績效儀表板
 */

import { z } from "zod";
import type { MCPTool } from "../../../mcp/types.js";

const TeamDashboardInputSchema = z.object({
  period: z.enum(["week", "month", "quarter"]).default("month"),
  teamId: z.string().optional(),
  generateReport: z.boolean().default(true),
  reportFormat: z.enum(["markdown", "json"]).default("markdown"),
});

const TeamDashboardOutputSchema = z.object({
  metrics: z.object({
    totalConversations: z.number(),
    avgMeddicScore: z.number(),
    dealsClosed: z.number(),
    avgDealValue: z.number(),
    completionRate: z.number(),
    topPerformers: z.array(
      z.object({
        name: z.string(),
        convCount: z.number(),
        avgScore: z.number(),
      })
    ),
  }),
  reportPath: z.string().optional(),
  reportContent: z.string().optional(),
  timestamp: z.date(),
});

type Input = z.infer<typeof TeamDashboardInputSchema>;
type Output = z.infer<typeof TeamDashboardOutputSchema>;

export const teamDashboardTool: MCPTool<Input, Output> = {
  name: "generate_team_dashboard",
  description:
    "生成團隊績效儀表板。包含總對話數、MEDDIC 評分、成交率、Top Performers 等關鍵指標。",
  inputSchema: TeamDashboardInputSchema,
  handler: async (input: Input): Promise<Output> => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL || "");

      // 計算時間範圍
      const periodDays =
        input.period === "week" ? 7 : input.period === "month" ? 30 : 90;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - periodDays);

      // 查詢團隊績效數據
      const teamStats = await sql`
				SELECT
					COUNT(DISTINCT c.id) as total_conversations,
					AVG(m.overall_score) as avg_meddic_score,
					COUNT(DISTINCT CASE WHEN o.stage = 'closed_won' THEN o.id END) as deals_closed,
					AVG(CASE WHEN o.stage = 'closed_won' THEN o.value END) as avg_deal_value
				FROM conversations c
				LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
				LEFT JOIN opportunities o ON c.opportunity_id = o.id
				WHERE c.created_at >= ${sinceDate.toISOString()}
					${input.teamId ? sql`AND c.team_id = ${input.teamId}` : sql``}
			`;

      // 查詢 Top Performers
      const topPerformers = await sql`
				SELECT
					u.name,
					COUNT(c.id) as conv_count,
					AVG(m.overall_score) as avg_score
				FROM conversations c
				JOIN users u ON c.user_id = u.id
				LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
				WHERE c.created_at >= ${sinceDate.toISOString()}
					${input.teamId ? sql`AND c.team_id = ${input.teamId}` : sql``}
				GROUP BY u.id, u.name
				ORDER BY avg_score DESC
				LIMIT 5
			`;

      // 計算完成率（已分析 / 已轉錄）
      const completionStats = await sql`
				SELECT
					COUNT(DISTINCT c.id) as total_transcribed,
					COUNT(DISTINCT m.conversation_id) as total_analyzed
				FROM conversations c
				LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
				WHERE c.status = 'completed'
					AND c.transcript IS NOT NULL
					AND c.created_at >= ${sinceDate.toISOString()}
					${input.teamId ? sql`AND c.team_id = ${input.teamId}` : sql``}
			`;

      const totalConversations = Number(teamStats[0]?.total_conversations || 0);
      const avgMeddicScore = Number(teamStats[0]?.avg_meddic_score || 0);
      const dealsClosed = Number(teamStats[0]?.deals_closed || 0);
      const avgDealValue = Number(teamStats[0]?.avg_deal_value || 0);

      const totalTranscribed = Number(
        completionStats[0]?.total_transcribed || 0
      );
      const totalAnalyzed = Number(completionStats[0]?.total_analyzed || 0);
      const completionRate =
        totalTranscribed > 0 ? (totalAnalyzed / totalTranscribed) * 100 : 0;

      const metrics = {
        totalConversations,
        avgMeddicScore: Number(avgMeddicScore.toFixed(1)),
        dealsClosed,
        avgDealValue: Number(avgDealValue.toFixed(0)),
        completionRate: Number(completionRate.toFixed(1)),
        topPerformers: topPerformers.map((p) => ({
          name: p.name as string,
          convCount: Number(p.conv_count),
          avgScore: Number((p.avg_score as number).toFixed(1)),
        })),
      };

      let reportPath: string | undefined;
      let reportContent: string | undefined;

      // 生成報告
      if (input.generateReport) {
        const { generateTeamReport } = await import(
          "../../../mcp/templates/report-templates.js"
        );

        const teamPerf = {
          period: input.period,
          totalConversations: metrics.totalConversations,
          avgMeddicScore: metrics.avgMeddicScore,
          dealsClosed: metrics.dealsClosed,
          avgDealValue: metrics.avgDealValue,
          activeReps: metrics.topPerformers.length,
        };
        const repsPerf = metrics.topPerformers.map((p) => ({
          repId: "",
          repName: p.name,
          conversationCount: p.convCount,
          avgScore: p.avgScore,
          avgMetricsScore: 0,
          avgEconomicBuyerScore: 0,
          avgDecisionCriteriaScore: 0,
          avgDecisionProcessScore: 0,
          avgIdentifyPainScore: 0,
          avgChampionScore: 0,
          opportunitiesCount: 0,
          dealsWon: 0,
        }));
        reportContent = generateTeamReport(teamPerf, repsPerf);

        if (input.reportFormat === "markdown") {
          const timestamp = new Date().toISOString().split("T")[0];
          reportPath = `reports/team-dashboard-${input.period}-${timestamp}.md`;

          // 寫入檔案
          const { filesystemWriteTool } = await import(
            "../../../mcp/external/filesystem.js"
          );
          await filesystemWriteTool.handler(
            {
              path: reportPath,
              content: reportContent,
              encoding: "utf-8",
              createDirectories: true,
            },
            { timestamp: new Date() }
          );
        }
      }

      return {
        metrics,
        reportPath,
        reportContent:
          input.reportFormat === "json"
            ? JSON.stringify(metrics, null, 2)
            : reportContent,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Team dashboard generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
