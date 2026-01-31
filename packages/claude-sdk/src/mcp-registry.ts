/**
 * MCP Server 註冊表
 * 統一管理所有 MCP Server 配置
 */

import type { McpServerConfig } from "./types.js";

/**
 * 可用的 MCP Server 配置
 *
 * 注意：部分 MCP Server 需要環境變數，請確保已設定
 */
export const MCP_SERVERS = {
  // ============================================================
  // Phase 1: 開發自動化
  // ============================================================

  /**
   * GitHub MCP Server
   * 用於 PR 審查、Issue 管理等
   * 需要: GITHUB_TOKEN
   */
  github: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? "",
    },
  },

  // ============================================================
  // Phase 2: 生產診斷
  // ============================================================

  /**
   * PostgreSQL MCP Server
   * 用於資料庫查詢和診斷
   * 需要: DATABASE_URL
   */
  postgres: {
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-postgres",
      process.env.DATABASE_URL ?? "",
    ],
  },

  /**
   * Cloudflare MCP Server
   * 用於 Workers 日誌分析、KV 查詢等
   * 需要: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
   */
  cloudflare: {
    command: "npx",
    args: ["-y", "@cloudflare/mcp-server-cloudflare"],
    env: {
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN ?? "",
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    },
  },

  // ============================================================
  // Phase 3: E2E 測試
  // ============================================================

  /**
   * Playwright MCP Server
   * 用於瀏覽器自動化和 E2E 測試
   */
  playwright: {
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-playwright"],
  },

  // ============================================================
  // Phase 4: Google 整合
  // ============================================================

  /**
   * Google Workspace MCP Server
   * 用於 Calendar, Drive, Sheets 等整合
   * 需要: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
   */
  googleWorkspace: {
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-google"],
    env: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    },
  },

  // ============================================================
  // Phase 5: 可觀測性
  // ============================================================

  /**
   * Datadog MCP Server
   * 用於指標查詢、日誌分析、告警管理
   * 需要: DD_API_KEY, DD_APP_KEY
   */
  datadog: {
    command: "npx",
    args: ["-y", "@shelfio/datadog-mcp"],
    env: {
      DD_API_KEY: process.env.DATADOG_API_KEY ?? "",
      DD_APP_KEY: process.env.DATADOG_APP_KEY ?? "",
    },
  },

  // ============================================================
  // Phase 6: 銷售記憶
  // ============================================================

  /**
   * Memory MCP Server
   * 用於跨會話記憶持久化
   */
  memory: {
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-memory"],
  },

  // ============================================================
  // 通用工具
  // ============================================================

  /**
   * Fetch MCP Server
   * 用於網頁內容擷取（競品研究等）
   */
  fetch: {
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-fetch"],
  },

  /**
   * Filesystem MCP Server
   * 用於本地檔案系統操作
   */
  filesystem: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/"],
  },
} as const satisfies Record<string, McpServerConfig>;

export type McpServerName = keyof typeof MCP_SERVERS;

/**
 * 取得指定的 MCP Server 配置
 *
 * @param names - 要取得的 MCP Server 名稱列表
 * @returns MCP Server 配置物件
 *
 * @example
 * ```typescript
 * const servers = getMcpServers(["postgres", "github"]);
 * ```
 */
export function getMcpServers(
  names: McpServerName[]
): Record<string, McpServerConfig> {
  const result: Record<string, McpServerConfig> = {};
  for (const name of names) {
    result[name] = MCP_SERVERS[name];
  }
  return result;
}

/**
 * 檢查 MCP Server 是否已正確配置（環境變數已設定）
 *
 * @param name - MCP Server 名稱
 * @returns 是否已配置
 */
export function isMcpServerConfigured(name: McpServerName): boolean {
  const server = MCP_SERVERS[name] as McpServerConfig;

  if (!server.env) {
    return true; // 不需要環境變數
  }

  // 檢查所有環境變數是否已設定
  return Object.values(server.env).every((value) => value && value.length > 0);
}

/**
 * 取得所有已配置的 MCP Server
 *
 * @returns 已配置的 MCP Server 名稱列表
 */
export function getConfiguredMcpServers(): McpServerName[] {
  return (Object.keys(MCP_SERVERS) as McpServerName[]).filter(
    isMcpServerConfigured
  );
}

/**
 * 取得 MCP Server 所需的環境變數
 *
 * @param name - MCP Server 名稱
 * @returns 環境變數名稱列表
 */
export function getMcpServerRequiredEnvVars(name: McpServerName): string[] {
  const server = MCP_SERVERS[name] as McpServerConfig;
  if (!server.env) {
    return [];
  }

  return Object.keys(server.env);
}
