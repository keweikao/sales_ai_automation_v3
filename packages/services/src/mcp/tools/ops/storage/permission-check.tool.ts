/**
 * Storage Permission Check Tool
 * 檢查 R2 儲存權限
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const StoragePermissionCheckInput = z.object({
  checkRead: z.boolean().default(true),
  checkWrite: z.boolean().default(true),
  checkDelete: z.boolean().default(true),
  timeoutMs: z.number().default(10_000),
});

const StoragePermissionCheckOutput = z.object({
  status: z.enum(["healthy", "degraded", "critical"]),
  canRead: z.boolean(),
  canWrite: z.boolean(),
  canDelete: z.boolean(),
  error: z.string().optional(),
  timestamp: z.date(),
});

type Input = z.infer<typeof StoragePermissionCheckInput>;
type Output = z.infer<typeof StoragePermissionCheckOutput>;

export const storagePermissionCheckTool: MCPTool<Input, Output> = {
  name: "storage_permission_check",
  description: "檢查 R2 儲存權限。測試讀取、寫入和刪除權限是否正常。",
  inputSchema: StoragePermissionCheckInput,
  handler: async (input: Input): Promise<Output> => {
    let canRead = false;
    let canWrite = false;
    let canDelete = false;

    try {
      const { R2StorageService } = await import("../../../../storage/r2.js");

      const r2Service = new R2StorageService({
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
        bucket: process.env.CLOUDFLARE_R2_BUCKET || "",
        region: "auto",
      });

      const testKey = `ops-test-${Date.now()}.txt`;
      const testContent = Buffer.from("R2 permission test", "utf-8");

      // Test 1: Write permission
      if (input.checkWrite) {
        try {
          await r2Service.upload(testKey, testContent, {
            contentType: "text/plain",
          });
          canWrite = true;
        } catch (_error) {
          canWrite = false;
        }
      }

      // Test 2: Read permission
      if (input.checkRead && canWrite) {
        try {
          const downloaded = await r2Service.download(testKey);
          canRead = downloaded.length > 0;
        } catch (_error) {
          canRead = false;
        }
      }

      // Test 3: Delete permission
      if (input.checkDelete && canWrite) {
        try {
          await r2Service.delete(testKey);
          canDelete = true;
        } catch (_error) {
          canDelete = false;
        }
      }

      // 判斷健康狀態
      let status: "healthy" | "degraded" | "critical" = "healthy";
      let error: string | undefined;

      const requiredPermissions = [];
      if (input.checkRead) {
        requiredPermissions.push("read");
      }
      if (input.checkWrite) {
        requiredPermissions.push("write");
      }
      if (input.checkDelete) {
        requiredPermissions.push("delete");
      }

      const failedPermissions = [];
      if (input.checkRead && !canRead) {
        failedPermissions.push("read");
      }
      if (input.checkWrite && !canWrite) {
        failedPermissions.push("write");
      }
      if (input.checkDelete && !canDelete) {
        failedPermissions.push("delete");
      }

      if (failedPermissions.length > 0) {
        if (failedPermissions.length === requiredPermissions.length) {
          status = "critical";
          error = `All permissions failed: ${failedPermissions.join(", ")}`;
        } else {
          status = "degraded";
          error = `Some permissions failed: ${failedPermissions.join(", ")}`;
        }
      }

      return {
        status,
        canRead,
        canWrite,
        canDelete,
        error,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: "critical",
        canRead: false,
        canWrite: false,
        canDelete: false,
        error:
          error instanceof Error
            ? error.message
            : "Storage permission check failed",
        timestamp: new Date(),
      };
    }
  },
};
