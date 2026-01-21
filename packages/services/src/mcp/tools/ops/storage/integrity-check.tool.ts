/**
 * Storage Integrity Check Tool
 * 檢查儲存完整性（孤立檔案、遺失參照等）
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const StorageIntegrityCheckInput = z.object({
  checkOrphanedFiles: z.boolean().default(true),
  checkMissingReferences: z.boolean().default(true),
});

const StorageIntegrityCheckOutput = z.object({
  status: z.enum(["healthy", "degraded", "critical"]),
  orphanedFilesCount: z.number(),
  missingReferencesCount: z.number(),
  orphanedFiles: z.array(z.string()).optional(),
  missingReferences: z
    .array(
      z.object({
        conversationId: z.string(),
        audioKey: z.string(),
      })
    )
    .optional(),
  error: z.string().optional(),
  timestamp: z.date(),
});

type Input = z.infer<typeof StorageIntegrityCheckInput>;
type Output = z.infer<typeof StorageIntegrityCheckOutput>;

export const storageIntegrityCheckTool: MCPTool<Input, Output> = {
  name: "storage_integrity_check",
  description:
    "檢查儲存完整性。包括：1) 孤立檔案（R2 中存在但 DB 無記錄）2) 遺失參照（DB 記錄但 R2 中不存在）",
  inputSchema: StorageIntegrityCheckInput,
  handler: async (input: Input): Promise<Output> => {
    try {
      let orphanedFilesCount = 0;
      let missingReferencesCount = 0;
      const orphanedFiles: string[] = [];
      const missingReferences: Array<{
        conversationId: string;
        audioKey: string;
      }> = [];

      // Check 1: 孤立檔案（R2 中存在但 DB 無記錄）
      if (input.checkOrphanedFiles) {
        const { S3Client, ListObjectsV2Command } = await import(
          "@aws-sdk/client-s3"
        );

        const s3Client = new S3Client({
          region: "auto",
          endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
          credentials: {
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
          },
        });

        const bucket = process.env.CLOUDFLARE_R2_BUCKET || "";

        // 列出所有音檔
        const listCommand = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: "audio/", // 假設音檔都在 audio/ 目錄
          MaxKeys: 1000,
        });

        const listResponse = await s3Client.send(listCommand);

        if (listResponse.Contents && listResponse.Contents.length > 0) {
          const { neon } = await import("@neondatabase/serverless");
          const sql = neon(process.env.DATABASE_URL || "");

          // 對每個檔案檢查 DB 中是否有對應記錄
          for (const file of listResponse.Contents) {
            if (!file.Key) {
              continue;
            }

            // 從 audio/xxx.mp3 提取檔名，查詢 DB
            const fileName = file.Key.split("/").pop();
            if (!fileName) {
              continue;
            }

            const dbRecords = await sql`
							SELECT id
							FROM conversations
							WHERE audio_url LIKE ${`%${fileName}%`}
							LIMIT 1
						`;

            if (dbRecords.length === 0) {
              orphanedFiles.push(file.Key);
              orphanedFilesCount++;
            }
          }
        }
      }

      // Check 2: 遺失參照（DB 記錄但 R2 中不存在）
      if (input.checkMissingReferences) {
        const { neon } = await import("@neondatabase/serverless");
        const sql = neon(process.env.DATABASE_URL || "");

        // 查詢所有有 audio_url 的對話
        const conversationsWithAudio = await sql`
					SELECT id, audio_url
					FROM conversations
					WHERE audio_url IS NOT NULL
						AND audio_url != ''
					LIMIT 1000
				`;

        const { R2StorageService } = await import("../../../../storage/r2.js");

        const r2Service = new R2StorageService({
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
          endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
          bucket: process.env.CLOUDFLARE_R2_BUCKET || "",
          region: "auto",
        });

        // 對每個 audio_url 檢查 R2 中是否存在
        for (const conv of conversationsWithAudio) {
          const audioUrl = conv.audio_url as string;

          // 從 URL 提取 key（假設格式為 https://xxx/audio/yyy.mp3）
          let audioKey: string;
          try {
            const url = new URL(audioUrl);
            audioKey = url.pathname.substring(1); // 移除開頭的 /
          } catch {
            // 無法解析 URL，跳過
            continue;
          }

          const exists = await r2Service.exists(audioKey);

          if (!exists) {
            missingReferences.push({
              conversationId: conv.id as string,
              audioKey,
            });
            missingReferencesCount++;
          }
        }
      }

      // 判斷健康狀態
      let status: "healthy" | "degraded" | "critical" = "healthy";

      if (orphanedFilesCount > 50 || missingReferencesCount > 50) {
        status = "critical";
      } else if (orphanedFilesCount > 10 || missingReferencesCount > 10) {
        status = "degraded";
      }

      return {
        status,
        orphanedFilesCount,
        missingReferencesCount,
        orphanedFiles: orphanedFiles.slice(0, 10), // 只返回前 10 個
        missingReferences: missingReferences.slice(0, 10), // 只返回前 10 個
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: "critical",
        orphanedFilesCount: 0,
        missingReferencesCount: 0,
        error:
          error instanceof Error
            ? error.message
            : "Storage integrity check failed",
        timestamp: new Date(),
      };
    }
  },
};
