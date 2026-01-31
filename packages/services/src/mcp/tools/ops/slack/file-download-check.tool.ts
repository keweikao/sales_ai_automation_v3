/**
 * Slack File Download Check Tool
 * 檢查 Slack 檔案下載功能狀態
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const SlackFileDownloadCheckInput = z.object({
  apiToken: z.string().optional(),
  testFileId: z.string().optional(),
  timeoutMs: z.number().default(10_000),
});

const SlackFileDownloadCheckOutput = z.object({
  status: z.enum(["healthy", "degraded", "critical"]),
  downloadSpeedMbps: z.number().optional(),
  error: z.string().optional(),
  timestamp: z.date(),
});

type Input = z.infer<typeof SlackFileDownloadCheckInput>;
type Output = z.infer<typeof SlackFileDownloadCheckOutput>;

export const slackFileDownloadCheckTool: MCPTool<Input, Output> = {
  name: "slack_file_download_check",
  description:
    "檢查 Slack 檔案下載功能狀態。測試從 Slack 下載檔案的速度和可靠性。",
  inputSchema: SlackFileDownloadCheckInput,
  handler: async (input: Input): Promise<Output> => {
    try {
      const token = input.apiToken || process.env.SLACK_BOT_TOKEN;
      if (!token) {
        throw new Error("SLACK_BOT_TOKEN is required");
      }

      // 如果沒有提供測試檔案 ID，則檢查檔案列表 API
      if (!input.testFileId) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);

        const response = await fetch("https://slack.com/api/files.list", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ count: 1 }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = (await response.json()) as {
          ok: boolean;
          error?: string;
          files?: Array<{ id: string }>;
        };

        if (!data.ok) {
          return {
            status: "critical",
            error: data.error || "Failed to list files",
            timestamp: new Date(),
          };
        }

        // 如果沒有檔案，視為健康（API 可用）
        if (!data.files || data.files.length === 0) {
          return {
            status: "healthy",
            timestamp: new Date(),
          };
        }

        // 有檔案但沒有指定測試，僅檢查 API 可用性
        return {
          status: "healthy",
          timestamp: new Date(),
        };
      }

      // 如果提供了測試檔案 ID，嘗試下載
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);

      const infoResponse = await fetch("https://slack.com/api/files.info", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: input.testFileId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const infoData = (await infoResponse.json()) as {
        ok: boolean;
        error?: string;
        file?: { url_private_download?: string; size?: number };
      };

      if (!(infoData.ok && infoData.file?.url_private_download)) {
        return {
          status: "critical",
          error: infoData.error || "File not found or no download URL",
          timestamp: new Date(),
        };
      }

      // 嘗試下載檔案
      const downloadStartTime = Date.now();
      const downloadResponse = await fetch(infoData.file.url_private_download, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!downloadResponse.ok) {
        return {
          status: "critical",
          error: `Download failed: ${downloadResponse.statusText}`,
          timestamp: new Date(),
        };
      }

      const arrayBuffer = await downloadResponse.arrayBuffer();
      const downloadTimeMs = Date.now() - downloadStartTime;

      // 計算下載速度
      const fileSizeBytes = arrayBuffer.byteLength;
      const downloadSpeedMbps = (fileSizeBytes * 8) / (downloadTimeMs * 1000);

      // 判斷健康狀態（基於下載速度）
      if (downloadSpeedMbps < 1) {
        return {
          status: "degraded",
          downloadSpeedMbps: Number(downloadSpeedMbps.toFixed(2)),
          error: "Download speed is slow",
          timestamp: new Date(),
        };
      }

      return {
        status: "healthy",
        downloadSpeedMbps: Number(downloadSpeedMbps.toFixed(2)),
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: "critical",
        error: error instanceof Error ? error.message : "Download check failed",
        timestamp: new Date(),
      };
    }
  },
};
