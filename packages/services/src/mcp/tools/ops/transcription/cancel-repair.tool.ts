/**
 * Transcription Cancel Repair Tool
 * 取消過期的轉錄任務
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const TranscriptionCancelRepairInput = z.object({
  dryRun: z.boolean().default(true),
  conversationIds: z.array(z.string()).optional(),
  expiredThresholdHours: z.number().default(24),
  maxTasksToCancel: z.number().min(1).max(100).default(20),
});

const TranscriptionCancelRepairOutput = z.object({
  repaired: z.boolean(),
  actions: z.array(z.string()),
  cancelledCount: z.number(),
  dryRun: z.boolean(),
  timestamp: z.date(),
});

type Input = z.infer<typeof TranscriptionCancelRepairInput>;
type Output = z.infer<typeof TranscriptionCancelRepairOutput>;

export const transcriptionCancelRepairTool: MCPTool<Input, Output> = {
  name: "transcription_cancel_repair",
  description:
    "取消過期的轉錄任務，將狀態設為 'failed' 並記錄原因。可指定特定對話 ID 或自動處理所有過期任務。",
  inputSchema: TranscriptionCancelRepairInput,
  handler: async (input: Input): Promise<Output> => {
    const actions: string[] = [];
    let cancelledCount = 0;

    try {
      if (input.dryRun) {
        actions.push("🔍 Dry Run 模式 - 僅模擬修復動作");

        if (input.conversationIds && input.conversationIds.length > 0) {
          actions.push(`1. 取消 ${input.conversationIds.length} 個指定的對話`);
          for (const id of input.conversationIds.slice(0, 5)) {
            actions.push(`   - ${id}`);
          }
        } else {
          actions.push(
            `1. 查詢超過 ${input.expiredThresholdHours} 小時的過期任務`
          );
          actions.push(`2. 取消最多 ${input.maxTasksToCancel} 個任務`);
        }

        actions.push("3. 將狀態設為 'failed'");
        actions.push("4. 設定 error_message 為 'Task expired'");

        return {
          repaired: false,
          actions,
          cancelledCount: 0,
          dryRun: true,
          timestamp: new Date(),
        };
      }

      // 實際修復邏輯
      actions.push("🔧 開始取消過期的轉錄任務...");

      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL || "");

      let tasksToCancel: Array<{ id: string; case_number: string | null }> = [];

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
            tasksToCancel.push({
              id: row.id as string,
              case_number: row.case_number as string | null,
            });
          } else {
            actions.push(`⚠️ 找不到對話 ${conversationId}`);
          }
        }
      } else {
        // 自動查詢過期的任務
        const expiredThresholdTime = new Date();
        expiredThresholdTime.setHours(
          expiredThresholdTime.getHours() - input.expiredThresholdHours
        );

        actions.push(
          `📡 查詢超過 ${input.expiredThresholdHours} 小時的過期任務...`
        );

        const expiredTasks = await sql`
					SELECT id, case_number
					FROM conversations
					WHERE status IN ('pending', 'processing')
						AND created_at < ${expiredThresholdTime.toISOString()}
					ORDER BY created_at ASC
					LIMIT ${input.maxTasksToCancel}
				`;

        tasksToCancel = expiredTasks.map((task) => ({
          id: task.id as string,
          case_number: task.case_number as string | null,
        }));
      }

      if (tasksToCancel.length === 0) {
        actions.push("✅ 沒有需要取消的過期任務");
        return {
          repaired: true,
          actions,
          cancelledCount: 0,
          dryRun: false,
          timestamp: new Date(),
        };
      }

      actions.push(`📊 找到 ${tasksToCancel.length} 個需要取消的任務`);

      // 取消任務（設為 failed 狀態）
      for (const task of tasksToCancel) {
        try {
          const expiredMessage = `Task expired after ${input.expiredThresholdHours} hours without completion`;

          await sql`
						UPDATE conversations
						SET
							status = 'failed',
							error_message = ${expiredMessage},
							updated_at = ${new Date().toISOString()}
						WHERE id = ${task.id}
					`;

          actions.push(
            `✅ 已取消: ${task.case_number || task.id.substring(0, 8)}`
          );
          cancelledCount++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          actions.push(`❌ 取消失敗 ${task.id}: ${errorMsg}`);
        }
      }

      if (cancelledCount > 0) {
        actions.push(`🎯 完成！已取消 ${cancelledCount} 個過期任務`);
        actions.push(
          "💡 建議：檢查為何這些任務未能及時完成（Queue Worker, API 問題等）"
        );

        return {
          repaired: true,
          actions,
          cancelledCount,
          dryRun: false,
          timestamp: new Date(),
        };
      }

      return {
        repaired: false,
        actions,
        cancelledCount: 0,
        dryRun: false,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      actions.push(`❌ 修復過程發生錯誤: ${errorMsg}`);

      return {
        repaired: false,
        actions,
        cancelledCount,
        dryRun: input.dryRun,
        timestamp: new Date(),
      };
    }
  },
};
