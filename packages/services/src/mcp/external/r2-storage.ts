/**
 * Cloudflare R2 Storage MCP Tools
 * S3 相容的物件儲存服務，用於音檔、轉錄稿案和報表儲存
 */

import { z } from "zod";
import { R2StorageService } from "../../storage/r2.js";
import type { MCPTool } from "../types.js";

// ============================================================
// Upload File Tool
// ============================================================

const R2UploadInputSchema = z.object({
  key: z.string().min(1, "Key is required"),
  content: z.string(), // Base64 encoded or plain text
  contentType: z.string().default("application/octet-stream"),
  encoding: z.enum(["base64", "utf-8"]).default("utf-8"),
  metadata: z
    .object({
      conversationId: z.string().optional(),
      leadId: z.string().optional(),
      customData: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

const R2UploadOutputSchema = z.object({
  success: z.boolean(),
  url: z.string(),
  key: z.string(),
  sizeBytes: z.number(),
});

type R2UploadInput = z.infer<typeof R2UploadInputSchema>;
type R2UploadOutput = z.infer<typeof R2UploadOutputSchema>;

export const r2UploadFileTool: MCPTool<R2UploadInput, R2UploadOutput> = {
  name: "r2_upload_file",
  description:
    "上傳檔案到 Cloudflare R2 儲存空間。支援 Base64 或 UTF-8 編碼。無出站流量費用。",
  inputSchema: R2UploadInputSchema,
  handler: async (input, _context) => {
    try {
      // 建立 R2 服務實例
      // 注意：在 Cloudflare Workers 環境中，credentials 會從 env 取得
      const r2Service = new R2StorageService({
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
        bucket: process.env.CLOUDFLARE_R2_BUCKET || "",
        region: "auto",
      });

      // 解碼內容
      let buffer: Buffer;
      if (input.encoding === "base64") {
        buffer = Buffer.from(input.content, "base64");
      } else {
        buffer = Buffer.from(input.content, "utf-8");
      }

      // 準備 metadata
      const metadata = input.metadata
        ? {
            contentType: input.contentType,
            customMetadata: {
              conversationId: input.metadata.conversationId || "",
              leadId: input.metadata.leadId || "",
              ...(input.metadata.customData || {}),
            },
          }
        : {
            contentType: input.contentType,
          };

      // 上傳檔案
      const url = await r2Service.upload(input.key, buffer, metadata);

      return {
        success: true,
        url,
        key: input.key,
        sizeBytes: buffer.length,
      };
    } catch (error) {
      throw new Error(
        `R2 upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Download File Tool
// ============================================================

const R2DownloadInputSchema = z.object({
  key: z.string().min(1, "Key is required"),
  encoding: z.enum(["base64", "utf-8"]).default("utf-8"),
  maxRetries: z.number().min(1).max(5).default(3),
});

const R2DownloadOutputSchema = z.object({
  content: z.string(),
  sizeBytes: z.number(),
  key: z.string(),
  encoding: z.string(),
});

type R2DownloadInput = z.infer<typeof R2DownloadInputSchema>;
type R2DownloadOutput = z.infer<typeof R2DownloadOutputSchema>;

export const r2DownloadFileTool: MCPTool<R2DownloadInput, R2DownloadOutput> = {
  name: "r2_download_file",
  description:
    "從 Cloudflare R2 下載檔案。支援自動重試機制，適合大型檔案下載。",
  inputSchema: R2DownloadInputSchema,
  handler: async (input) => {
    try {
      const r2Service = new R2StorageService({
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
        bucket: process.env.CLOUDFLARE_R2_BUCKET || "",
        region: "auto",
      });

      // 下載檔案（帶重試）
      const buffer = await r2Service.download(input.key);

      // 轉換編碼
      const content =
        input.encoding === "base64"
          ? buffer.toString("base64")
          : buffer.toString("utf-8");

      return {
        content,
        sizeBytes: buffer.length,
        key: input.key,
        encoding: input.encoding,
      };
    } catch (error) {
      throw new Error(
        `R2 download failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Generate Signed URL Tool
// ============================================================

const R2SignedUrlInputSchema = z.object({
  key: z.string().min(1, "Key is required"),
  expiresIn: z.number().min(60).max(604_800).default(3600), // 1 min to 7 days
});

const R2SignedUrlOutputSchema = z.object({
  url: z.string(),
  expiresIn: z.number(),
  expiresAt: z.string(),
});

type R2SignedUrlInput = z.infer<typeof R2SignedUrlInputSchema>;
type R2SignedUrlOutput = z.infer<typeof R2SignedUrlOutputSchema>;

export const r2GenerateSignedUrlTool: MCPTool<
  R2SignedUrlInput,
  R2SignedUrlOutput
> = {
  name: "r2_generate_signed_url",
  description:
    "生成 R2 檔案的臨時存取 URL（預簽名 URL）。適用於安全的檔案分享，預設 1 小時有效期。",
  inputSchema: R2SignedUrlInputSchema,
  handler: async (input) => {
    try {
      const r2Service = new R2StorageService({
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
        bucket: process.env.CLOUDFLARE_R2_BUCKET || "",
        region: "auto",
      });

      const url = await r2Service.getSignedUrl(input.key, input.expiresIn);
      const expiresAt = new Date(
        Date.now() + input.expiresIn * 1000
      ).toISOString();

      return {
        url,
        expiresIn: input.expiresIn,
        expiresAt,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate signed URL: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Check File Exists Tool
// ============================================================

const R2ExistsInputSchema = z.object({
  key: z.string().min(1, "Key is required"),
});

const R2ExistsOutputSchema = z.object({
  exists: z.boolean(),
  key: z.string(),
});

type R2ExistsInput = z.infer<typeof R2ExistsInputSchema>;
type R2ExistsOutput = z.infer<typeof R2ExistsOutputSchema>;

export const r2CheckFileExistsTool: MCPTool<R2ExistsInput, R2ExistsOutput> = {
  name: "r2_check_file_exists",
  description: "檢查檔案是否存在於 R2 儲存空間中。",
  inputSchema: R2ExistsInputSchema,
  handler: async (input) => {
    try {
      const r2Service = new R2StorageService({
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
        bucket: process.env.CLOUDFLARE_R2_BUCKET || "",
        region: "auto",
      });

      const exists = await r2Service.exists(input.key);

      return {
        exists,
        key: input.key,
      };
    } catch (error) {
      throw new Error(
        `Failed to check file existence: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Delete File Tool
// ============================================================

const R2DeleteInputSchema = z.object({
  key: z.string().min(1, "Key is required"),
});

const R2DeleteOutputSchema = z.object({
  success: z.boolean(),
  key: z.string(),
});

type R2DeleteInput = z.infer<typeof R2DeleteInputSchema>;
type R2DeleteOutput = z.infer<typeof R2DeleteOutputSchema>;

export const r2DeleteFileTool: MCPTool<R2DeleteInput, R2DeleteOutput> = {
  name: "r2_delete_file",
  description: "從 R2 儲存空間刪除檔案。操作不可逆，請謹慎使用。",
  inputSchema: R2DeleteInputSchema,
  handler: async (input) => {
    try {
      const r2Service = new R2StorageService({
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
        bucket: process.env.CLOUDFLARE_R2_BUCKET || "",
        region: "auto",
      });

      await r2Service.delete(input.key);

      return {
        success: true,
        key: input.key,
      };
    } catch (error) {
      throw new Error(
        `R2 delete failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
