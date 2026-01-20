/**
 * Opportunity Forecast Tool
 * 商機預測與風險分析
 */

import { z } from "zod";
import type { MCPTool } from "../../../mcp/types.js";

const OpportunityForecastInputSchema = z.object({
  opportunityIds: z.array(z.string()).optional(),
  minMeddicScore: z.number().min(0).max(100).default(50),
  includeRiskFactors: z.boolean().default(true),
});

const OpportunityForecastOutputSchema = z.object({
  forecasts: z.array(
    z.object({
      opportunityId: z.string(),
      accountName: z.string().optional(),
      currentStage: z.string(),
      meddicScore: z.number(),
      winProbability: z.number(),
      estimatedValue: z.number(),
      riskFactors: z.array(z.string()).optional(),
      recommendations: z.array(z.string()),
    })
  ),
  summary: z.object({
    totalOpportunities: z.number(),
    avgWinProbability: z.number(),
    totalEstimatedValue: z.number(),
    highRiskCount: z.number(),
  }),
  timestamp: z.date(),
});

type Input = z.infer<typeof OpportunityForecastInputSchema>;
type Output = z.infer<typeof OpportunityForecastOutputSchema>;

export const opportunityForecastTool: MCPTool<Input, Output> = {
  name: "forecast_opportunities",
  description:
    "商機預測與風險分析。基於 MEDDIC 評分預測成交機率，識別風險因素並提供建議。",
  inputSchema: OpportunityForecastInputSchema,
  handler: async (input: Input): Promise<Output> => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL || "");

      // 查詢商機數據
      let opportunities;

      if (input.opportunityIds && input.opportunityIds.length > 0) {
        // 查詢指定商機
        opportunities = await sql`
					SELECT
						o.id,
						o.account_name,
						o.stage,
						o.value,
						m.overall_score,
						m.metrics_score,
						m.economic_buyer_score,
						m.decision_criteria_score,
						m.decision_process_score,
						m.identify_pain_score,
						m.champion_score,
						m.qualification_status
					FROM opportunities o
					LEFT JOIN conversations c ON o.id = c.opportunity_id
					LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
					WHERE o.id = ANY(${input.opportunityIds})
						AND m.overall_score >= ${input.minMeddicScore}
					ORDER BY m.overall_score DESC
				`;
      } else {
        // 查詢所有活躍商機
        opportunities = await sql`
					SELECT
						o.id,
						o.account_name,
						o.stage,
						o.value,
						m.overall_score,
						m.metrics_score,
						m.economic_buyer_score,
						m.decision_criteria_score,
						m.decision_process_score,
						m.identify_pain_score,
						m.champion_score,
						m.qualification_status
					FROM opportunities o
					LEFT JOIN conversations c ON o.id = c.opportunity_id
					LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
					WHERE o.stage NOT IN ('closed_won', 'closed_lost')
						AND m.overall_score >= ${input.minMeddicScore}
					ORDER BY m.overall_score DESC
					LIMIT 50
				`;
      }

      const forecasts = opportunities.map((opp) => {
        const meddicScore = Number(opp.overall_score || 0);

        // 計算成交機率（基於 MEDDIC 評分和商機階段）
        let stageMultiplier = 1.0;
        switch (opp.stage) {
          case "prospecting":
            stageMultiplier = 0.1;
            break;
          case "qualification":
            stageMultiplier = 0.3;
            break;
          case "proposal":
            stageMultiplier = 0.5;
            break;
          case "negotiation":
            stageMultiplier = 0.7;
            break;
          default:
            stageMultiplier = 0.5;
        }

        const winProbability = Math.min(
          (meddicScore / 100) * stageMultiplier * 100,
          95
        );

        // 識別風險因素
        const riskFactors: string[] = [];
        const recommendations: string[] = [];

        if (input.includeRiskFactors) {
          if ((opp.metrics_score as number) < 3) {
            riskFactors.push("定量指標不明確");
            recommendations.push("與客戶確認具體的業務目標和 ROI 指標");
          }

          if ((opp.economic_buyer_score as number) < 3) {
            riskFactors.push("未接觸到經濟決策者");
            recommendations.push("安排與 C-level 或預算持有者的會議");
          }

          if ((opp.decision_criteria_score as number) < 3) {
            riskFactors.push("決策標準不清楚");
            recommendations.push("了解客戶的評估標準和優先級");
          }

          if ((opp.decision_process_score as number) < 3) {
            riskFactors.push("決策流程未明確");
            recommendations.push("確認決策時間表和相關參與者");
          }

          if ((opp.identify_pain_score as number) < 3) {
            riskFactors.push("痛點挖掘不足");
            recommendations.push("深入探討客戶當前面臨的挑戰和影響");
          }

          if ((opp.champion_score as number) < 3) {
            riskFactors.push("缺少內部冠軍");
            recommendations.push("培養內部支持者，建立信任關係");
          }
        }

        return {
          opportunityId: opp.id as string,
          accountName: (opp.account_name as string) || undefined,
          currentStage: opp.stage as string,
          meddicScore,
          winProbability: Number(winProbability.toFixed(1)),
          estimatedValue: Number(opp.value || 0),
          riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
          recommendations,
        };
      });

      // 計算摘要統計
      const totalOpportunities = forecasts.length;
      const avgWinProbability =
        totalOpportunities > 0
          ? forecasts.reduce((sum, f) => sum + f.winProbability, 0) /
            totalOpportunities
          : 0;
      const totalEstimatedValue = forecasts.reduce(
        (sum, f) => sum + f.estimatedValue * (f.winProbability / 100),
        0
      );
      const highRiskCount = forecasts.filter(
        (f) => f.riskFactors && f.riskFactors.length >= 3
      ).length;

      return {
        forecasts,
        summary: {
          totalOpportunities,
          avgWinProbability: Number(avgWinProbability.toFixed(1)),
          totalEstimatedValue: Number(totalEstimatedValue.toFixed(0)),
          highRiskCount,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Opportunity forecast failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
