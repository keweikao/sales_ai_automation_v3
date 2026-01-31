/**
 * Google Drive MCP Tools
 * 用於上傳報告、建立資料夾、管理檔案分享
 *
 * 注意: 需要 Google OAuth 2.0 憑證
 * 環境變數:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REFRESH_TOKEN
 */

import { z } from "zod";
import type { MCPTool } from "../types.js";

// ============================================================
// Google Drive API Client Setup
// ============================================================

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime: string;
}

/**
 * 初始化 Google Drive API 客戶端
 * 使用環境變數中的 OAuth 憑證
 */
async function initDriveClient() {
  // 檢查環境變數
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!(clientId && clientSecret && refreshToken)) {
    throw new Error(
      "Missing Google OAuth credentials. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables."
    );
  }

  // 取得 Access Token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const { access_token } = (await tokenResponse.json()) as {
    access_token: string;
  };

  return {
    accessToken: access_token,
    baseUrl: "https://www.googleapis.com/drive/v3",
    uploadUrl: "https://www.googleapis.com/upload/drive/v3",
  };
}

// ============================================================
// Upload Report Tool
// ============================================================

const UploadReportInputSchema = z.object({
  reportContent: z.string().min(1, "Report content is required"),
  fileName: z.string().min(1, "File name is required"),
  folderId: z.string().optional(),
  mimeType: z.string().optional().default("text/markdown"),
  description: z.string().optional(),
});

const UploadReportOutputSchema = z.object({
  fileId: z.string(),
  fileName: z.string(),
  webViewLink: z.string(),
  createdTime: z.string(),
  folderId: z.string().optional(),
  timestamp: z.date(),
});

type UploadReportInput = z.infer<typeof UploadReportInputSchema>;
type UploadReportOutput = z.infer<typeof UploadReportOutputSchema>;

export const gdriveUploadReportTool: MCPTool<
  UploadReportInput,
  UploadReportOutput
> = {
  name: "gdrive_upload_report",
  description:
    "上傳報告到 Google Drive。支援 Markdown、CSV、JSON 等格式。可指定上傳到特定資料夾。",
  inputSchema: UploadReportInputSchema,
  handler: async (input: UploadReportInput): Promise<UploadReportOutput> => {
    try {
      const drive = await initDriveClient();

      // 準備檔案 metadata
      const metadata = {
        name: input.fileName,
        mimeType: input.mimeType,
        parents: input.folderId ? [input.folderId] : undefined,
        description: input.description,
      };

      // 使用 multipart upload
      const boundary = "foo_bar_baz";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${input.mimeType}\r\n\r\n` +
        input.reportContent +
        closeDelimiter;

      const response = await fetch(
        `${drive.uploadUrl}/files?uploadType=multipart`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${drive.accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to upload file: ${error}`);
      }

      const file = (await response.json()) as DriveFile;

      return {
        fileId: file.id,
        fileName: file.name,
        webViewLink:
          file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        createdTime: file.createdTime,
        folderId: input.folderId,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Google Drive upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Create Folder Tool
// ============================================================

const CreateFolderInputSchema = z.object({
  folderName: z.string().min(1, "Folder name is required"),
  parentFolderId: z.string().optional(),
  description: z.string().optional(),
});

const CreateFolderOutputSchema = z.object({
  folderId: z.string(),
  folderName: z.string(),
  webViewLink: z.string(),
  createdTime: z.string(),
  timestamp: z.date(),
});

type CreateFolderInput = z.infer<typeof CreateFolderInputSchema>;
type CreateFolderOutput = z.infer<typeof CreateFolderOutputSchema>;

export const gdriveCreateFolderTool: MCPTool<
  CreateFolderInput,
  CreateFolderOutput
> = {
  name: "gdrive_create_folder",
  description:
    "在 Google Drive 建立資料夾。可指定父資料夾建立子資料夾。用於組織報告和文件。",
  inputSchema: CreateFolderInputSchema,
  handler: async (input: CreateFolderInput): Promise<CreateFolderOutput> => {
    try {
      const drive = await initDriveClient();

      const metadata = {
        name: input.folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: input.parentFolderId ? [input.parentFolderId] : undefined,
        description: input.description,
      };

      const response = await fetch(`${drive.baseUrl}/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${drive.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create folder: ${error}`);
      }

      const folder = (await response.json()) as DriveFile;

      return {
        folderId: folder.id,
        folderName: folder.name,
        webViewLink:
          folder.webViewLink ||
          `https://drive.google.com/drive/folders/${folder.id}`,
        createdTime: folder.createdTime,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Google Drive folder creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Share File Tool
// ============================================================

const ShareFileInputSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  role: z.enum(["reader", "writer", "commenter"]).default("reader"),
  type: z.enum(["user", "group", "domain", "anyone"]).default("anyone"),
  emailAddress: z.string().email().optional(),
  domain: z.string().optional(),
});

const ShareFileOutputSchema = z.object({
  permissionId: z.string(),
  fileId: z.string(),
  role: z.string(),
  type: z.string(),
  sharedWith: z.string().optional(),
  timestamp: z.date(),
});

type ShareFileInput = z.infer<typeof ShareFileInputSchema>;
type ShareFileOutput = z.infer<typeof ShareFileOutputSchema>;

export const gdriveShareFileTool: MCPTool<ShareFileInput, ShareFileOutput> = {
  name: "gdrive_share_file",
  description:
    "設定 Google Drive 檔案的分享權限。支援分享給特定使用者、群組、網域或公開分享。",
  inputSchema: ShareFileInputSchema,
  handler: async (input: ShareFileInput): Promise<ShareFileOutput> => {
    try {
      const drive = await initDriveClient();

      // 驗證輸入
      if (input.type === "user" && !input.emailAddress) {
        throw new Error("Email address is required when sharing with a user");
      }

      if (input.type === "domain" && !input.domain) {
        throw new Error("Domain is required when sharing with a domain");
      }

      const permission: {
        type: string;
        role: string;
        emailAddress?: string;
        domain?: string;
      } = {
        type: input.type,
        role: input.role,
      };

      if (input.emailAddress) {
        permission.emailAddress = input.emailAddress;
      }

      if (input.domain) {
        permission.domain = input.domain;
      }

      const response = await fetch(
        `${drive.baseUrl}/files/${input.fileId}/permissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${drive.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(permission),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to share file: ${error}`);
      }

      const result = (await response.json()) as { id: string };

      return {
        permissionId: result.id,
        fileId: input.fileId,
        role: input.role,
        type: input.type,
        sharedWith: input.emailAddress || input.domain || "anyone",
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Google Drive share failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Search Files Tool
// ============================================================

const SearchFilesInputSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  folderId: z.string().optional(),
  maxResults: z.number().min(1).max(100).optional().default(10),
  orderBy: z
    .enum(["createdTime", "modifiedTime", "name", "viewedByMeTime"])
    .optional()
    .default("modifiedTime"),
});

const SearchFilesOutputSchema = z.object({
  files: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      mimeType: z.string(),
      webViewLink: z.string().optional(),
      createdTime: z.string(),
      modifiedTime: z.string(),
    })
  ),
  count: z.number(),
  timestamp: z.date(),
});

type SearchFilesInput = z.infer<typeof SearchFilesInputSchema>;
type SearchFilesOutput = z.infer<typeof SearchFilesOutputSchema>;

export const gdriveSearchFilesTool: MCPTool<
  SearchFilesInput,
  SearchFilesOutput
> = {
  name: "gdrive_search_files",
  description:
    "搜尋 Google Drive 中的檔案。支援按名稱、資料夾、時間等條件搜尋。用於查找歷史報告。",
  inputSchema: SearchFilesInputSchema,
  handler: async (input: SearchFilesInput): Promise<SearchFilesOutput> => {
    try {
      const drive = await initDriveClient();

      // 建立搜尋查詢
      let q = `name contains '${input.query}' and trashed = false`;

      if (input.folderId) {
        q += ` and '${input.folderId}' in parents`;
      }

      const params = new URLSearchParams({
        q,
        pageSize: input.maxResults.toString(),
        orderBy: `${input.orderBy} desc`,
        fields:
          "files(id, name, mimeType, webViewLink, createdTime, modifiedTime)",
      });

      const response = await fetch(`${drive.baseUrl}/files?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${drive.accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to search files: ${error}`);
      }

      const result = (await response.json()) as { files: DriveFile[] };

      return {
        files: result.files.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          webViewLink: file.webViewLink,
          createdTime: file.createdTime,
          modifiedTime: file.createdTime, // modifiedTime 會從 API 返回
        })),
        count: result.files.length,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Google Drive search failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
