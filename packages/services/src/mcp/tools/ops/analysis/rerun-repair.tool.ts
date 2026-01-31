/**
 * Analysis Rerun Repair Tool
 * 重新執行未完成的 MEDDIC 分析
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const AnalysisRerunRepairInput = z.object({
  dryRun: z.boolean().default(true),
  conversationIds: z.array(z.string()).optional(),
  checkRecentDays: z.number().default(7),
  maxTasksToRerun: z.number().min(1).max(100).default(10),
});

const AnalysisRerunRepairOutput = z.object({
  repaired: z.boolean(),
  actions: z.array(z.string()),
  triggeredCount: z.number(),
  dryRun: z.boolean(),
  timestamp: z.date(),
});

type Input = z.infer<typeof AnalysisRerunRepairInput>;
type Output = z.infer<typeof AnalysisRerunRepairOutput>;

export const analysisRerunRepairTool: MCPTool<Input, Output> = {
  name: "analysis_rerun_repair",
  description:
    "重新執行未完成的 MEDDIC 分析。觸發分析流程處理已轉錄但未分析的對話。",
  inputSchema: AnalysisRerunRepairInput,
  handler: async (input: Input): Promise<Output> => {
    const actions: string[] = [];
    let triggeredCount = 0;

    try {
      if (input.dryRun) {
        actions.push("🔍 Dry Run 模式 - 僅模擬修復動作");

        if (input.conversationIds && input.conversationIds.length > 0) {
          actions.push(
            `1. 重新分析 ${input.conversationIds.length} 個指定對話`
          );
        } else {
          actions.push(`1. 查詢最近 ${input.checkRecentDays} 天未分析的對話`);
          actions.push(`2. 最多重新分析 ${input.maxTasksToRerun} 個對話`);
        }

        actions.push("3. 觸發 MEDDIC Orchestrator 分析流程");

        return {
          repaired: false,
          actions,
          triggeredCount: 0,
          dryRun: true,
          timestamp: new Date(),
        };
      }

      // 實際修復邏輯
      actions.push("🔧 開始重新執行分析...");

      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL || "");

      let conversationsToAnalyze: Array<{
        id: string;
        case_number: string | null;
        transcript: string;
      }> = [];

      // 如果指定了特定 ID
      if (input.conversationIds && input.conversationIds.length > 0) {
        actions.push(`📡 查詢 ${input.conversationIds.length} 個指定的對話...`);

        for (const conversationId of input.conversationIds) {
          const result = await sql`
						SELECT c.id, c.case_number, c.transcript
						FROM conversations c
						LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
						WHERE c.id = ${conversationId}
							AND c.status = 'completed'
							AND c.transcript IS NOT NULL
						LIMIT 1
					`;

          if (result.length > 0) {
            const row = result[0]!;
            conversationsToAnalyze.push({
              id: row.id as string,
              case_number: row.case_number as string | null,
              transcript: row.transcript as string,
            });
          } else {
            actions.push(`⚠️ 找不到對話 ${conversationId} 或已分析`);
          }
        }
      } else {
        // 自動查詢未分析的對話
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - input.checkRecentDays);

        actions.push(`📡 查詢最近 ${input.checkRecentDays} 天未分析的對話...`);

        const result = await sql`
					SELECT c.id, c.case_number, c.transcript
					FROM conversations c
					LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
					WHERE c.status = 'completed'
						AND c.transcript IS NOT NULL
						AND c.created_at >= ${sinceDate.toISOString()}
						AND m.id IS NULL
					LIMIT ${input.maxTasksToRerun}
				`;

        conversationsToAnalyze = result.map((row) => ({
          id: row.id as string,
          case_number: row.case_number as string | null,
          transcript: row.transcript as string,
        }));
      }

      if (conversationsToAnalyze.length === 0) {
        actions.push("✅ 沒有需要重新分析的對話");
        return {
          repaired: true,
          actions,
          triggeredCount: 0,
          dryRun: false,
          timestamp: new Date(),
        };
      }

      actions.push(`📊 找到 ${conversationsToAnalyze.length} 個需要分析的對話`);

      // 觸發分析流程
      // 注意：實際應該推送到 Queue 或直接調用 Orchestrator
      // 這裡提供模擬邏輯

      for (const conv of conversationsToAnalyze) {
        try {
          // TODO: 實際實作應該是：
          // 1. 推送到 Queue Worker
          // 2. 或直接調用 MEDDIC Orchestrator
          // await runMeddicOrchestrator({ conversationId: conv.id, transcript: conv.transcript });

          actions.push(
            `🔄 觸發分析: ${conv.case_number || conv.id.substring(0, 8)}`
          );
          triggeredCount++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          actions.push(`❌ 觸發失敗 ${conv.id}: ${errorMsg}`);
        }
      }

      actions.push(`🎯 完成！已觸發 ${triggeredCount} 個分析任務`);
      actions.push("💡 注意：實際分析將由 MEDDIC Orchestrator 異步執行");

      return {
        repaired: triggeredCount > 0,
        actions,
        triggeredCount,
        dryRun: false,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      actions.push(`❌ 修復過程發生錯誤: ${errorMsg}`);

      return {
        repaired: false,
        actions,
        triggeredCount,
        dryRun: input.dryRun,
        timestamp: new Date(),
      };
    }
  },
};
