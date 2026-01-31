/**
 * Storage Cleanup Repair Tool
 * 清理 R2 儲存空間中的舊檔案
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const StorageCleanupRepairInput = z.object({
  dryRun: z.boolean().default(true),
  olderThanDays: z.number().min(7).default(90),
  maxFilesToDelete: z.number().min(1).max(1000).default(100),
  filePrefix: z.string().optional(),
});

const StorageCleanupRepairOutput = z.object({
  repaired: z.boolean(),
  actions: z.array(z.string()),
  deletedCount: z.number(),
  freedSpaceGB: z.number(),
  dryRun: z.boolean(),
  timestamp: z.date(),
});

type Input = z.infer<typeof StorageCleanupRepairInput>;
type Output = z.infer<typeof StorageCleanupRepairOutput>;

export const storageCleanupRepairTool: MCPTool<Input, Output> = {
  name: "storage_cleanup_repair",
  description:
    "清理 R2 儲存空間中的舊檔案。可指定檔案前綴和保留期限。預設清理 90 天前的檔案。",
  inputSchema: StorageCleanupRepairInput,
  handler: async (input: Input): Promise<Output> => {
    const actions: string[] = [];
    let deletedCount = 0;
    let freedSpaceGB = 0;

    try {
      if (input.dryRun) {
        actions.push("🔍 Dry Run 模式 - 僅模擬修復動作");
        actions.push(`1. 搜尋超過 ${input.olderThanDays} 天的檔案`);

        if (input.filePrefix) {
          actions.push(`2. 檔案前綴過濾: ${input.filePrefix}`);
        }

        actions.push(`3. 最多刪除 ${input.maxFilesToDelete} 個檔案`);
        actions.push("4. 計算釋放的儲存空間");

        return {
          repaired: false,
          actions,
          deletedCount: 0,
          freedSpaceGB: 0,
          dryRun: true,
          timestamp: new Date(),
        };
      }

      // 實際修復邏輯
      actions.push("🔧 開始清理舊檔案...");

      // 計算截止日期
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.olderThanDays);

      actions.push(
        `📅 截止日期: ${cutoffDate.toISOString().split("T")[0]} (${input.olderThanDays} 天前)`
      );

      // TODO: 實作 R2 檔案列表功能
      // 目前 R2StorageService 沒有 listFiles 方法
      // 需要使用 AWS SDK 的 ListObjectsV2Command

      const { S3Client, ListObjectsV2Command, DeleteObjectCommand } =
        await import("@aws-sdk/client-s3");

      const s3Client = new S3Client({
        region: "auto",
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
        },
      });

      const bucket = process.env.CLOUDFLARE_R2_BUCKET || "";

      // 列出檔案
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: input.filePrefix,
        MaxKeys: input.maxFilesToDelete,
      });

      const listResponse = await s3Client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        actions.push("✅ 沒有找到需要清理的檔案");
        return {
          repaired: true,
          actions,
          deletedCount: 0,
          freedSpaceGB: 0,
          dryRun: false,
          timestamp: new Date(),
        };
      }

      // 過濾出舊檔案
      const oldFiles = listResponse.Contents.filter((file) => {
        if (!file.LastModified) {
          return false;
        }
        return file.LastModified < cutoffDate;
      });

      actions.push(`📊 找到 ${oldFiles.length} 個舊檔案`);

      if (oldFiles.length === 0) {
        actions.push("✅ 沒有需要刪除的檔案");
        return {
          repaired: true,
          actions,
          deletedCount: 0,
          freedSpaceGB: 0,
          dryRun: false,
          timestamp: new Date(),
        };
      }

      // 刪除檔案
      for (const file of oldFiles) {
        if (!file.Key) {
          continue;
        }

        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucket,
            Key: file.Key,
          });

          await s3Client.send(deleteCommand);

          const sizeKB = ((file.Size || 0) / 1024).toFixed(2);
          actions.push(`✅ 已刪除: ${file.Key} (${sizeKB} KB)`);

          deletedCount++;
          freedSpaceGB += (file.Size || 0) / (1024 * 1024 * 1024);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          actions.push(`❌ 刪除失敗 ${file.Key}: ${errorMsg}`);
        }
      }

      actions.push(
        `🎯 完成！已刪除 ${deletedCount} 個檔案，釋放 ${freedSpaceGB.toFixed(4)} GB`
      );

      return {
        repaired: deletedCount > 0,
        actions,
        deletedCount,
        freedSpaceGB: Number(freedSpaceGB.toFixed(4)),
        dryRun: false,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      actions.push(`❌ 清理過程發生錯誤: ${errorMsg}`);

      return {
        repaired: false,
        actions,
        deletedCount,
        freedSpaceGB,
        dryRun: input.dryRun,
        timestamp: new Date(),
      };
    }
  },
};
