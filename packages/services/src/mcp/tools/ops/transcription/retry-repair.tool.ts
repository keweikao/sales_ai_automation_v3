/**
 * Transcription Retry Repair Tool
 * 重試卡住的轉錄任務
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const TranscriptionRetryRepairInput = z.object({
  dryRun: z.boolean().default(true),
  conversationIds: z.array(z.string()).optional(),
  stuckThresholdMinutes: z.number().default(30),
  maxTasksToRetry: z.number().min(1).max(100).default(10),
});

const TranscriptionRetryRepairOutput = z.object({
  repaired: z.boolean(),
  actions: z.array(z.string()),
  retriedCount: z.number(),
  dryRun: z.boolean(),
  timestamp: z.date(),
});

type Input = z.infer<typeof TranscriptionRetryRepairInput>;
type Output = z.infer<typeof TranscriptionRetryRepairOutput>;

export const transcriptionRetryRepairTool: MCPTool<Input, Output> = {
  name: "transcription_retry_repair",
  description:
    "重試卡住的轉錄任務。可指定特定對話 ID 或自動處理所有卡住的任務。",
  inputSchema: TranscriptionRetryRepairInput,
  handler: async (input: Input): Promise<Output> => {
    const actions: string[] = [];
    let retriedCount = 0;

    try {
      if (input.dryRun) {
        actions.push("🔍 Dry Run 模式 - 僅模擬修復動作");

        if (input.conversationIds && input.conversationIds.length > 0) {
          actions.push(
            `1. 重置 ${input.conversationIds.length} 個指定對話的狀態`
          );
          for (const id of input.conversationIds.slice(0, 5)) {
            actions.push(`   - ${id}`);
          }
        } else {
          actions.push(
            `1. 查詢卡住超過 ${input.stuckThresholdMinutes} 分鐘的任務`
          );
          actions.push(`2. 重置最多 ${input.maxTasksToRetry} 個任務狀態`);
        }

        actions.push("3. 將狀態從 'processing' 改為 'pending'");
        actions.push("4. 觸發 Queue Worker 重新處理");

        return {
          repaired: false,
          actions,
          retriedCount: 0,
          dryRun: true,
          timestamp: new Date(),
        };
      }

      // 實際修復邏輯
      actions.push("🔧 開始重試卡住的轉錄任務...");

      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL || "");

      let tasksToRetry: Array<{ id: string; case_number: string | null }> = [];

      // 如果指定了特定 ID
      if (input.conversationIds && input.conversationIds.length > 0) {
        actions.push(`📡 查詢 ${input.conversationIds.length} 個指定的對話...`);

        for (const conversationId of input.conversationIds) {
          const result = await sql`
						SELECT id, case_number, status
						FROM conversations
						WHERE id = ${conversationId}
						LIMIT 1
					`;

          if (result.length > 0) {
            const row = result[0]!;
            tasksToRetry.push({
              id: row.id as string,
              case_number: row.case_number as string | null,
            });
          } else {
            actions.push(`⚠️ 找不到對話 ${conversationId}`);
          }
        }
      } else {
        // 自動查詢卡住的任務
        const thresholdTime = new Date();
        thresholdTime.setMinutes(
          thresholdTime.getMinutes() - input.stuckThresholdMinutes
        );

        actions.push(
          `📡 查詢卡住超過 ${input.stuckThresholdMinutes} 分鐘的任務...`
        );

        const stuckTasks = await sql`
					SELECT id, case_number
					FROM conversations
					WHERE status = 'processing'
						AND updated_at < ${thresholdTime.toISOString()}
					ORDER BY updated_at ASC
					LIMIT ${input.maxTasksToRetry}
				`;

        tasksToRetry = stuckTasks.map((task) => ({
          id: task.id as string,
          case_number: task.case_number as string | null,
        }));
      }

      if (tasksToRetry.length === 0) {
        actions.push("✅ 沒有需要重試的任務");
        return {
          repaired: true,
          actions,
          retriedCount: 0,
          dryRun: false,
          timestamp: new Date(),
        };
      }

      actions.push(`📊 找到 ${tasksToRetry.length} 個需要重試的任務`);

      // 重置任務狀態
      for (const task of tasksToRetry) {
        try {
          await sql`
						UPDATE conversations
						SET
							status = 'pending',
							error_message = NULL,
							updated_at = ${new Date().toISOString()}
						WHERE id = ${task.id}
					`;

          actions.push(
            `✅ 已重置: ${task.case_number || task.id.substring(0, 8)}`
          );
          retriedCount++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          actions.push(`❌ 重置失敗 ${task.id}: ${errorMsg}`);
        }
      }

      // TODO: 推送任務到 Queue 重新處理
      // 這裡需要整合 Queue Worker 的觸發邏輯
      actions.push("💡 注意：任務已重置為 pending，需要 Queue Worker 重新處理");

      if (retriedCount > 0) {
        actions.push(`🎯 完成！已重試 ${retriedCount} 個任務`);

        return {
          repaired: true,
          actions,
          retriedCount,
          dryRun: false,
          timestamp: new Date(),
        };
      }

      return {
        repaired: false,
        actions,
        retriedCount: 0,
        dryRun: false,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      actions.push(`❌ 修復過程發生錯誤: ${errorMsg}`);

      return {
        repaired: false,
        actions,
        retriedCount,
        dryRun: input.dryRun,
        timestamp: new Date(),
      };
    }
  },
};
