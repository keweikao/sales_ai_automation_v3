/**
 * Rep Performance Report Tool
 * 生成業務個人績效報告
 */

import { z } from "zod";
import type { MCPTool } from "../../../mcp/types.js";

const RepPerformanceInputSchema = z.object({
  repId: z.string().min(1, "Rep ID is required"),
  period: z.enum(["week", "month", "quarter"]).default("month"),
  generateReport: z.boolean().default(true),
  includeMeddicBreakdown: z.boolean().default(true),
});

const RepPerformanceOutputSchema = z.object({
  repName: z.string(),
  performance: z.object({
    conversationCount: z.number(),
    avgOverallScore: z.number(),
    meddicScores: z
      .object({
        metrics: z.number(),
        economicBuyer: z.number(),
        decisionCriteria: z.number(),
        decisionProcess: z.number(),
        identifyPain: z.number(),
        champion: z.number(),
      })
      .optional(),
    dealsClosed: z.number(),
    avgDealValue: z.number(),
    trends: z.array(
      z.object({
        week: z.string(),
        avgScore: z.number(),
        convCount: z.number(),
      })
    ),
  }),
  reportPath: z.string().optional(),
  timestamp: z.date(),
});

type Input = z.infer<typeof RepPerformanceInputSchema>;
type Output = z.infer<typeof RepPerformanceOutputSchema>;

export const repPerformanceTool: MCPTool<Input, Output> = {
  name: "generate_rep_performance",
  description:
    "生成業務個人績效報告。包含對話數、MEDDIC 評分、成交數、趨勢分析等。",
  inputSchema: RepPerformanceInputSchema,
  handler: async (input: Input): Promise<Output> => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL || "");

      // 計算時間範圍
      const periodDays =
        input.period === "week" ? 7 : input.period === "month" ? 30 : 90;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - periodDays);

      // 查詢業務基本資訊
      const repInfo = await sql`
				SELECT name FROM users WHERE id = ${input.repId} LIMIT 1
			`;

      if (repInfo.length === 0) {
        throw new Error(`Rep not found: ${input.repId}`);
      }

      const repName = repInfo[0]!.name as string;

      // 查詢績效數據
      const perfStats = await sql`
				SELECT
					COUNT(c.id) as conversation_count,
					AVG(m.overall_score) as avg_overall_score,
					COUNT(DISTINCT CASE WHEN o.stage = 'closed_won' THEN o.id END) as deals_closed,
					AVG(CASE WHEN o.stage = 'closed_won' THEN o.value END) as avg_deal_value
				FROM conversations c
				LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
				LEFT JOIN opportunities o ON c.opportunity_id = o.id
				WHERE c.user_id = ${input.repId}
					AND c.created_at >= ${sinceDate.toISOString()}
			`;

      const conversationCount = Number(perfStats[0]?.conversation_count || 0);
      const avgOverallScore = Number(perfStats[0]?.avg_overall_score || 0);
      const dealsClosed = Number(perfStats[0]?.deals_closed || 0);
      const avgDealValue = Number(perfStats[0]?.avg_deal_value || 0);

      // MEDDIC 維度分數
      let meddicScores:
        | {
            metrics: number;
            economicBuyer: number;
            decisionCriteria: number;
            decisionProcess: number;
            identifyPain: number;
            champion: number;
          }
        | undefined;

      if (input.includeMeddicBreakdown) {
        const meddicStats = await sql`
					SELECT
						AVG(m.metrics_score) as avg_metrics,
						AVG(m.economic_buyer_score) as avg_economic_buyer,
						AVG(m.decision_criteria_score) as avg_decision_criteria,
						AVG(m.decision_process_score) as avg_decision_process,
						AVG(m.identify_pain_score) as avg_identify_pain,
						AVG(m.champion_score) as avg_champion
					FROM conversations c
					JOIN meddic_analyses m ON c.id = m.conversation_id
					WHERE c.user_id = ${input.repId}
						AND c.created_at >= ${sinceDate.toISOString()}
				`;

        meddicScores = {
          metrics: Number(
            (meddicStats[0]?.avg_metrics as number)?.toFixed(1) || 0
          ),
          economicBuyer: Number(
            (meddicStats[0]?.avg_economic_buyer as number)?.toFixed(1) || 0
          ),
          decisionCriteria: Number(
            (meddicStats[0]?.avg_decision_criteria as number)?.toFixed(1) || 0
          ),
          decisionProcess: Number(
            (meddicStats[0]?.avg_decision_process as number)?.toFixed(1) || 0
          ),
          identifyPain: Number(
            (meddicStats[0]?.avg_identify_pain as number)?.toFixed(1) || 0
          ),
          champion: Number(
            (meddicStats[0]?.avg_champion as number)?.toFixed(1) || 0
          ),
        };
      }

      // 趨勢分析（每週）
      const trendStats = await sql`
				SELECT
					DATE_TRUNC('week', c.created_at) as week,
					AVG(m.overall_score) as avg_score,
					COUNT(c.id) as conv_count
				FROM conversations c
				LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
				WHERE c.user_id = ${input.repId}
					AND c.created_at >= ${sinceDate.toISOString()}
				GROUP BY week
				ORDER BY week ASC
			`;

      const trends = trendStats.map((t) => ({
        week: (t.week as Date)?.toISOString().split("T")[0] ?? "",
        avgScore: Number((t.avg_score as number)?.toFixed(1) || 0),
        convCount: Number(t.conv_count),
      }));

      const performance = {
        conversationCount,
        avgOverallScore: Number(avgOverallScore.toFixed(1)),
        meddicScores,
        dealsClosed,
        avgDealValue: Number(avgDealValue.toFixed(0)),
        trends,
      };

      let reportPath: string | undefined;

      // 生成報告
      if (input.generateReport) {
        const timestamp = new Date().toISOString().split("T")[0];
        reportPath = `reports/rep-performance-${input.repId}-${input.period}-${timestamp}.md`;

        // 生成 Markdown 報告
        const reportContent = `# 業務績效報告 - ${repName}

**統計週期**: ${input.period}
**產生時間**: ${new Date().toLocaleString("zh-TW")}

---

## 整體績效

- **總對話數**: ${conversationCount}
- **平均 MEDDIC 評分**: ${performance.avgOverallScore}/100
- **成交數**: ${dealsClosed}
- **平均交易額**: $${performance.avgDealValue.toLocaleString()}

---

${
  meddicScores
    ? `## MEDDIC 維度分析

| 維度 | 評分 |
|------|------|
| Metrics (定量指標) | ${meddicScores.metrics}/5 |
| Economic Buyer (經濟決策者) | ${meddicScores.economicBuyer}/5 |
| Decision Criteria (決策標準) | ${meddicScores.decisionCriteria}/5 |
| Decision Process (決策流程) | ${meddicScores.decisionProcess}/5 |
| Identify Pain (痛點識別) | ${meddicScores.identifyPain}/5 |
| Champion (內部冠軍) | ${meddicScores.champion}/5 |

---
`
    : ""
}

## 趨勢分析

${trends.map((t) => `- **${t.week}**: ${t.convCount} 通話, 平均評分 ${t.avgScore}/100`).join("\n")}

---

*本報告由 Sales AI Automation V3 自動生成*
`;

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

      return {
        repName,
        performance,
        reportPath,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Rep performance generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
