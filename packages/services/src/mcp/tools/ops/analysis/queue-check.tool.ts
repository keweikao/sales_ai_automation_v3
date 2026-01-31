/**
 * Analysis Queue Check Tool
 * 檢查分析佇列狀態
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const AnalysisQueueCheckInput = z.object({
  queueAgeThresholdMinutes: z.number().default(60),
});

const AnalysisQueueCheckOutput = z.object({
  status: z.enum(["healthy", "degraded", "critical"]),
  queueLength: z.number(),
  oldestMessageAgeMinutes: z.number().optional(),
  estimatedProcessingTimeMinutes: z.number().optional(),
  error: z.string().optional(),
  timestamp: z.date(),
});

type Input = z.infer<typeof AnalysisQueueCheckInput>;
type Output = z.infer<typeof AnalysisQueueCheckOutput>;

export const analysisQueueCheckTool: MCPTool<Input, Output> = {
  name: "analysis_queue_check",
  description: "檢查分析佇列狀態。監控待處理任務數量和最舊訊息的年齡。",
  inputSchema: AnalysisQueueCheckInput,
  handler: async (input: Input): Promise<Output> => {
    try {
      // 注意：實際應該查詢 Queue Worker 或 Cloudflare Queues
      // 這裡通過資料庫狀態模擬 Queue 狀態

      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL || "");

      // 查詢等待分析的對話（已轉錄但未分析）
      const queueResult = await sql`
				SELECT c.id, c.created_at, c.updated_at
				FROM conversations c
				LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
				WHERE c.status = 'completed'
					AND c.transcript IS NOT NULL
					AND m.id IS NULL
				ORDER BY c.created_at ASC
			`;

      const queueLength = queueResult.length;

      let oldestMessageAgeMinutes: number | undefined;
      let estimatedProcessingTimeMinutes: number | undefined;

      if (queueLength > 0) {
        // 計算最舊訊息的年齡
        const oldestMessage = queueResult[0]!;
        const createdAt = new Date(oldestMessage.created_at as string);
        const ageMs = Date.now() - createdAt.getTime();
        oldestMessageAgeMinutes = Math.floor(ageMs / (1000 * 60));

        // 估算處理時間（假設每個分析需要 2 分鐘）
        estimatedProcessingTimeMinutes = queueLength * 2;
      }

      // 判斷健康狀態
      let status: "healthy" | "degraded" | "critical" = "healthy";
      let error: string | undefined;

      if (queueLength > 100) {
        status = "critical";
        error = `Queue backlog is ${queueLength} messages (>100)`;
      } else if (queueLength > 50) {
        status = "degraded";
        error = `Queue backlog is ${queueLength} messages (>50)`;
      }

      if (
        oldestMessageAgeMinutes &&
        oldestMessageAgeMinutes > input.queueAgeThresholdMinutes
      ) {
        status = status === "critical" ? "critical" : "degraded";
        error =
          error ||
          `Oldest message age ${oldestMessageAgeMinutes} minutes exceeds threshold`;
      }

      return {
        status,
        queueLength,
        oldestMessageAgeMinutes,
        estimatedProcessingTimeMinutes,
        error,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: "critical",
        queueLength: 0,
        error: error instanceof Error ? error.message : "Queue check failed",
        timestamp: new Date(),
      };
    }
  },
};
