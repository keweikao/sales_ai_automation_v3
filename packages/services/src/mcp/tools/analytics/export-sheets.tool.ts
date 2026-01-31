/**
 * Export to Sheets Tool
 * 將分析數據匯出為 CSV/Google Sheets 格式
 */

import { z } from "zod";
import type { MCPTool } from "../../../mcp/types.js";

const ExportSheetsInputSchema = z.object({
  dataType: z.enum(["team", "rep", "opportunity"]),
  period: z.string().optional().default("month"),
  repId: z.string().optional(),
  format: z.enum(["csv", "json"]).optional().default("csv"),
  outputPath: z.string().optional(),
});

const ExportSheetsOutputSchema = z.object({
  filePath: z.string(),
  rowCount: z.number(),
  format: z.string(),
  dataType: z.string(),
  timestamp: z.date(),
});

type Input = z.infer<typeof ExportSheetsInputSchema>;
type Output = z.infer<typeof ExportSheetsOutputSchema>;

export const exportSheetsTo = {
  name: "export_analytics_to_sheets",
  description:
    "將分析數據匯出為 CSV 或 JSON 格式。支援團隊績效、業務個人績效、商機預測等數據類型。可直接匯入 Google Sheets 或 Excel。",
  inputSchema: ExportSheetsInputSchema,
  handler: async (input: Input): Promise<Output> => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL || "");

      // 計算時間範圍
      const periodDays =
        input.period === "week" ? 7 : input.period === "month" ? 30 : 90;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - periodDays);

      let data: unknown[] = [];
      let headers: string[] = [];

      // 根據數據類型查詢
      switch (input.dataType) {
        case "team": {
          const teamData = await sql`
						SELECT
							u.name as rep_name,
							COUNT(DISTINCT c.id) as conversation_count,
							AVG(m.overall_score) as avg_meddic_score,
							AVG(m.metrics_score) as avg_metrics,
							AVG(m.economic_buyer_score) as avg_economic_buyer,
							AVG(m.decision_criteria_score) as avg_decision_criteria,
							AVG(m.decision_process_score) as avg_decision_process,
							AVG(m.identify_pain_score) as avg_identify_pain,
							AVG(m.champion_score) as avg_champion,
							COUNT(DISTINCT CASE WHEN o.stage = 'closed_won' THEN o.id END) as deals_won,
							AVG(CASE WHEN o.stage = 'closed_won' THEN o.value END) as avg_deal_value
						FROM conversations c
						JOIN users u ON c.user_id = u.id
						LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
						LEFT JOIN opportunities o ON c.opportunity_id = o.id
						WHERE c.created_at >= ${sinceDate.toISOString()}
						GROUP BY u.id, u.name
						ORDER BY avg_meddic_score DESC
					`;

          data = teamData;
          headers = [
            "Rep Name",
            "Conversations",
            "Avg MEDDIC Score",
            "Metrics",
            "Economic Buyer",
            "Decision Criteria",
            "Decision Process",
            "Identify Pain",
            "Champion",
            "Deals Won",
            "Avg Deal Value",
          ];
          break;
        }

        case "rep": {
          if (!input.repId) {
            throw new Error("repId is required for rep data export");
          }

          const repData = await sql`
						SELECT
							c.case_number,
							c.created_at,
							m.overall_score,
							m.metrics_score,
							m.economic_buyer_score,
							m.decision_criteria_score,
							m.decision_process_score,
							m.identify_pain_score,
							m.champion_score,
							m.qualification_status,
							o.stage as opportunity_stage,
							o.value as opportunity_value
						FROM conversations c
						LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
						LEFT JOIN opportunities o ON c.opportunity_id = o.id
						WHERE c.user_id = ${input.repId}
							AND c.created_at >= ${sinceDate.toISOString()}
						ORDER BY c.created_at DESC
					`;

          data = repData;
          headers = [
            "Case Number",
            "Date",
            "Overall Score",
            "Metrics",
            "Economic Buyer",
            "Decision Criteria",
            "Decision Process",
            "Identify Pain",
            "Champion",
            "Qualification Status",
            "Opportunity Stage",
            "Opportunity Value",
          ];
          break;
        }

        case "opportunity": {
          const oppData = await sql`
						SELECT
							o.id as opportunity_id,
							o.account_name,
							o.stage,
							o.value,
							m.overall_score as meddic_score,
							m.metrics_score,
							m.economic_buyer_score,
							m.decision_criteria_score,
							m.decision_process_score,
							m.identify_pain_score,
							m.champion_score,
							m.qualification_status,
							c.created_at as last_conversation_date
						FROM opportunities o
						LEFT JOIN conversations c ON o.id = c.opportunity_id
						LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
						WHERE o.stage NOT IN ('closed_won', 'closed_lost')
							AND c.created_at >= ${sinceDate.toISOString()}
						ORDER BY m.overall_score DESC
						LIMIT 100
					`;

          data = oppData;
          headers = [
            "Opportunity ID",
            "Account Name",
            "Stage",
            "Value",
            "MEDDIC Score",
            "Metrics",
            "Economic Buyer",
            "Decision Criteria",
            "Decision Process",
            "Identify Pain",
            "Champion",
            "Qualification Status",
            "Last Conversation Date",
          ];
          break;
        }
      }

      // 生成檔案內容
      let fileContent: string;
      let filePath: string;

      if (input.format === "csv") {
        // CSV 格式
        const csvRows = [
          headers.join(","),
          ...data.map((row) =>
            Object.values(row as Record<string, unknown>)
              .map((value) => {
                if (value === null || value === undefined) {
                  return "";
                }
                if (typeof value === "string" && value.includes(",")) {
                  return `"${value}"`;
                }
                if (value instanceof Date) {
                  return value.toISOString().split("T")[0];
                }
                return String(value);
              })
              .join(",")
          ),
        ];

        fileContent = csvRows.join("\n");
        filePath =
          input.outputPath ||
          `reports/analytics-${input.dataType}-${input.period}-${new Date().toISOString().split("T")[0]}.csv`;
      } else {
        // JSON 格式
        fileContent = JSON.stringify(
          {
            dataType: input.dataType,
            period: input.period,
            exportedAt: new Date().toISOString(),
            headers,
            data,
          },
          null,
          2
        );
        filePath =
          input.outputPath ||
          `reports/analytics-${input.dataType}-${input.period}-${new Date().toISOString().split("T")[0]}.json`;
      }

      // 寫入檔案
      const { filesystemWriteTool } = await import(
        "../../../mcp/external/filesystem.js"
      );
      await filesystemWriteTool.handler(
        {
          path: filePath,
          content: fileContent,
          encoding: "utf-8",
          createDirectories: true,
        },
        { timestamp: new Date() }
      );

      return {
        filePath,
        rowCount: data.length,
        format: input.format,
        dataType: input.dataType,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Export to sheets failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
} satisfies MCPTool<Input, Output>;
