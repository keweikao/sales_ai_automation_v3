/**
 * Storage Reupload Repair Tool
 * 修復遺失的音檔（重新上傳或清理無效記錄）
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const StorageReuploadRepairInput = z.object({
  dryRun: z.boolean().default(true),
  conversationIds: z.array(z.string()).optional(),
  cleanupInvalidRecords: z.boolean().default(false),
  maxRecordsToProcess: z.number().min(1).max(100).default(10),
});

const StorageReuploadRepairOutput = z.object({
  repaired: z.boolean(),
  actions: z.array(z.string()),
  cleanedUpCount: z.number(),
  dryRun: z.boolean(),
  timestamp: z.date(),
});

type Input = z.infer<typeof StorageReuploadRepairInput>;
type Output = z.infer<typeof StorageReuploadRepairOutput>;

export const storageReuploadRepairTool: MCPTool<Input, Output> = {
  name: "storage_reupload_repair",
  description:
    "修復遺失的音檔參照。由於無法重新上傳已遺失的檔案，此工具主要用於清理無效的 audio_url 記錄。",
  inputSchema: StorageReuploadRepairInput,
  handler: async (input: Input): Promise<Output> => {
    const actions: string[] = [];
    let cleanedUpCount = 0;

    try {
      if (input.dryRun) {
        actions.push("🔍 Dry Run 模式 - 僅模擬修復動作");

        if (input.conversationIds && input.conversationIds.length > 0) {
          actions.push(
            `1. 檢查 ${input.conversationIds.length} 個指定對話的音檔`
          );
        } else {
          actions.push("1. 查詢所有音檔遺失的對話記錄");
          actions.push(`2. 最多處理 ${input.maxRecordsToProcess} 筆記錄`);
        }

        if (input.cleanupInvalidRecords) {
          actions.push("3. 清除無效的 audio_url 欄位");
        } else {
          actions.push("3. 僅標記問題，不修改資料");
        }

        return {
          repaired: false,
          actions,
          cleanedUpCount: 0,
          dryRun: true,
          timestamp: new Date(),
        };
      }

      // 實際修復邏輯
      actions.push("🔧 開始檢查遺失的音檔...");

      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL || "");

      const { R2StorageService } = await import("../../../../storage/r2.js");

      const r2Service = new R2StorageService({
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
        bucket: process.env.CLOUDFLARE_R2_BUCKET || "",
        region: "auto",
      });

      let conversationsToCheck: Array<{ id: string; audio_url: string }> = [];

      // 如果指定了特定 ID
      if (input.conversationIds && input.conversationIds.length > 0) {
        actions.push(`📡 查詢 ${input.conversationIds.length} 個指定的對話...`);

        for (const conversationId of input.conversationIds) {
          const result = await sql`
						SELECT id, audio_url
						FROM conversations
						WHERE id = ${conversationId}
							AND audio_url IS NOT NULL
							AND audio_url != ''
						LIMIT 1
					`;

          if (result.length > 0) {
            const row = result[0]!;
            conversationsToCheck.push({
              id: row.id as string,
              audio_url: row.audio_url as string,
            });
          }
        }
      } else {
        // 查詢所有有 audio_url 的對話
        actions.push("📡 查詢所有有音檔記錄的對話...");

        const result = await sql`
					SELECT id, audio_url
					FROM conversations
					WHERE audio_url IS NOT NULL
						AND audio_url != ''
					LIMIT ${input.maxRecordsToProcess}
				`;

        conversationsToCheck = result.map((row) => ({
          id: row.id as string,
          audio_url: row.audio_url as string,
        }));
      }

      actions.push(`📊 檢查 ${conversationsToCheck.length} 筆記錄`);

      const missingFiles: Array<{ id: string; audioKey: string }> = [];

      // 檢查每個音檔是否存在
      for (const conv of conversationsToCheck) {
        // 從 URL 提取 key
        let audioKey: string;
        try {
          const url = new URL(conv.audio_url);
          audioKey = url.pathname.substring(1); // 移除開頭的 /
        } catch {
          // 無法解析 URL，視為無效記錄
          missingFiles.push({ id: conv.id, audioKey: conv.audio_url });
          continue;
        }

        const exists = await r2Service.exists(audioKey);

        if (!exists) {
          missingFiles.push({ id: conv.id, audioKey });
          actions.push(`⚠️ 音檔遺失: ${conv.id.substring(0, 8)} (${audioKey})`);
        }
      }

      actions.push(`📊 找到 ${missingFiles.length} 個遺失的音檔`);

      if (missingFiles.length === 0) {
        actions.push("✅ 所有音檔都正常");
        return {
          repaired: true,
          actions,
          cleanedUpCount: 0,
          dryRun: false,
          timestamp: new Date(),
        };
      }

      // 清理無效記錄
      if (input.cleanupInvalidRecords) {
        actions.push("🔧 清除無效的 audio_url 記錄...");

        for (const file of missingFiles) {
          try {
            await sql`
							UPDATE conversations
							SET
								audio_url = NULL,
								updated_at = ${new Date().toISOString()}
							WHERE id = ${file.id}
						`;

            actions.push(`✅ 已清除: ${file.id.substring(0, 8)}`);
            cleanedUpCount++;
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : "Unknown error";
            actions.push(`❌ 清除失敗 ${file.id}: ${errorMsg}`);
          }
        }

        actions.push(`🎯 完成！已清除 ${cleanedUpCount} 筆無效記錄`);
      } else {
        actions.push("ℹ️ cleanupInvalidRecords 未啟用，僅識別問題不修改資料");
        actions.push(
          "💡 建議：使用 cleanupInvalidRecords: true 來清除無效記錄"
        );
      }

      return {
        repaired: cleanedUpCount > 0,
        actions,
        cleanedUpCount,
        dryRun: false,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      actions.push(`❌ 修復過程發生錯誤: ${errorMsg}`);

      return {
        repaired: false,
        actions,
        cleanedUpCount,
        dryRun: input.dryRun,
        timestamp: new Date(),
      };
    }
  },
};
