/**
 * MCP Server
 * Model Context Protocol Server 實作
 *
 * 提供統一的 Tool 註冊、執行與管理介面
 */

import { zodToJsonSchema } from "zod-to-json-schema";

import type {
  ExecutionContext,
  MCPTool,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "./types.js";
import {
  ToolExecutionError,
  ToolNotFoundError,
  ToolValidationError,
} from "./types.js";

// ============================================================
// MCP Server Class
// ============================================================

/**
 * MCP Server
 * 管理所有 MCP Tools 的註冊與執行
 */
export class MCPServer {
  private readonly tools: Map<string, MCPTool<unknown, unknown>>;
  private readonly enableLogging: boolean;

  constructor(options: { enableLogging?: boolean } = {}) {
    this.tools = new Map();
    this.enableLogging = options.enableLogging ?? false;
  }

  // ============================================================
  // Tool Registration
  // ============================================================

  /**
   * 註冊一個 Tool
   * @param tool - 要註冊的 Tool
   * @throws 如果 Tool 名稱已存在
   */
  registerTool<TInput, TOutput>(tool: MCPTool<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }

    this.tools.set(tool.name, tool as MCPTool<unknown, unknown>);

    if (this.enableLogging) {
      console.log(`[MCPServer] Registered tool: ${tool.name}`);
    }
  }

  /**
   * 批次註冊多個 Tools
   * @param tools - 要註冊的 Tools 陣列
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTools(tools: MCPTool<any, any>[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * 取消註冊一個 Tool
   * @param name - Tool 名稱
   * @returns 是否成功取消
   */
  unregisterTool(name: string): boolean {
    const result = this.tools.delete(name);

    if (result && this.enableLogging) {
      console.log(`[MCPServer] Unregistered tool: ${name}`);
    }

    return result;
  }

  // ============================================================
  // Tool Execution
  // ============================================================

  /**
   * 執行單一 Tool
   * @param name - Tool 名稱
   * @param input - Tool 輸入
   * @param context - 執行上下文
   * @returns Tool 執行結果
   */
  async executeTool(
    name: string,
    input: unknown,
    context: ExecutionContext
  ): Promise<unknown> {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    // 驗證輸入
    const parseResult = tool.inputSchema.safeParse(input);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) => `${(e.path as string[]).join(".")}: ${e.message as string}`
      );
      throw new ToolValidationError(name, errors);
    }

    // 執行 Tool
    try {
      if (this.enableLogging) {
        console.log(`[MCPServer] Executing tool: ${name}`);
      }

      const result = await tool.handler(parseResult.data, context);

      if (this.enableLogging) {
        console.log(`[MCPServer] Tool "${name}" completed successfully`);
      }

      return result;
    } catch (error) {
      throw new ToolExecutionError(
        name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * 安全執行 Tool（不拋出錯誤）
   * @param name - Tool 名稱
   * @param input - Tool 輸入
   * @param context - 執行上下文
   * @returns ToolResult 物件
   */
  async safeExecuteTool(
    name: string,
    input: unknown,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const output = await this.executeTool(name, input, context);
      return {
        name,
        success: true,
        output,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 批次執行多個 Tool 呼叫
   * @param calls - Tool 呼叫陣列
   * @param context - 執行上下文
   * @param options - 執行選項
   * @returns ToolResult 陣列
   */
  async executeToolCalls(
    calls: ToolCall[],
    context: ExecutionContext,
    options: {
      /** 是否並行執行 */
      parallel?: boolean;
      /** 遇到錯誤是否停止 */
      stopOnError?: boolean;
    } = {}
  ): Promise<ToolResult[]> {
    const { parallel = true, stopOnError = false } = options;

    if (parallel) {
      // 並行執行
      const promises = calls.map((call) =>
        this.safeExecuteTool(call.name, call.input, context).then((result) => ({
          ...result,
          callId: call.callId,
        }))
      );

      return Promise.all(promises);
    }

    // 序列執行
    const results: ToolResult[] = [];
    for (const call of calls) {
      const result = await this.safeExecuteTool(call.name, call.input, context);
      results.push({ ...result, callId: call.callId });

      if (stopOnError && !result.success) {
        break;
      }
    }

    return results;
  }

  // ============================================================
  // Tool Discovery
  // ============================================================

  /**
   * 取得所有已註冊的 Tool 定義
   * @returns ToolDefinition 陣列
   */
  listTools(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];

    for (const [name, tool] of this.tools) {
      definitions.push({
        name,
        description: tool.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSchema: zodToJsonSchema(tool.inputSchema as any) as Record<
          string,
          unknown
        >,
      });
    }

    return definitions;
  }

  /**
   * 取得特定 Tool 的定義
   * @param name - Tool 名稱
   * @returns ToolDefinition 或 undefined
   */
  getTool(name: string): ToolDefinition | undefined {
    const tool = this.tools.get(name);
    if (!tool) {
      return undefined;
    }

    return {
      name: tool.name,
      description: tool.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(tool.inputSchema as any) as Record<
        string,
        unknown
      >,
    };
  }

  /**
   * 檢查 Tool 是否存在
   * @param name - Tool 名稱
   * @returns 是否存在
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 取得已註冊的 Tool 數量
   */
  get toolCount(): number {
    return this.tools.size;
  }

  /**
   * 取得所有 Tool 名稱
   */
  get toolNames(): string[] {
    return [...this.tools.keys()];
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * 清除所有已註冊的 Tools
   */
  clear(): void {
    this.tools.clear();

    if (this.enableLogging) {
      console.log("[MCPServer] All tools cleared");
    }
  }

  /**
   * 產生 Tool 使用說明（用於 LLM System Prompt）
   */
  generateToolsPrompt(): string {
    const tools = this.listTools();

    if (tools.length === 0) {
      return "No tools available.";
    }

    const toolDescriptions = tools
      .map((tool) => {
        const schemaStr = JSON.stringify(tool.inputSchema, null, 2);
        return `### ${tool.name}\n${tool.description}\n\nInput Schema:\n\`\`\`json\n${schemaStr}\n\`\`\``;
      })
      .join("\n\n");

    return `## Available Tools\n\n${toolDescriptions}`;
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 建立 MCP Server 實例
 * @param options - 建立選項
 * @returns MCPServer 實例
 */
export function createMCPServer(
  options: { enableLogging?: boolean } = {}
): MCPServer {
  return new MCPServer(options);
}

// ============================================================
// External MCP Server Integration
// ============================================================

import {
  filesystemListTool,
  filesystemReadTool,
  filesystemWriteTool,
} from "./external/filesystem.js";
import {
  geminiGenerateJSONTool,
  geminiGenerateTextTool,
  geminiMeddicAnalysisTool,
} from "./external/gemini-llm.js";
import {
  calendarCreateEventTool,
  calendarDeleteEventTool,
  calendarListEventsTool,
  calendarScheduleFollowUpTool,
  calendarUpdateEventTool,
} from "./external/google-calendar.js";
import {
  gdriveCreateFolderTool,
  gdriveSearchFilesTool,
  gdriveShareFileTool,
  gdriveUploadReportTool,
} from "./external/google-drive.js";
import {
  groqCheckAudioSizeTool,
  groqEstimateCostTool,
  groqTranscribeAudioTool,
} from "./external/groq-whisper.js";
import {
  postgresQueryTool,
  postgresSchemaInspectorTool,
} from "./external/postgres.js";
import {
  r2CheckFileExistsTool,
  r2DeleteFileTool,
  r2DownloadFileTool,
  r2GenerateSignedUrlTool,
  r2UploadFileTool,
} from "./external/r2-storage.js";
import {
  slackPostAlertTool,
  slackPostFormattedAnalysisTool,
} from "./external/slack.js";
import {
  // Analytics MCP Tools (4 tools)
  exportSheetsTo,
  opportunityForecastTool,
  repPerformanceTool,
  teamDashboardTool,
} from "./tools/analytics/index.js";
import {
  // Analysis Ops Tools (6 tools)
  analysisCompletenessCheckTool,
  analysisLlmCheckTool,
  analysisLlmRepairTool,
  analysisQueueCheckTool,
  analysisQueueRepairTool,
  analysisRerunRepairTool,
  slackChannelPermissionCheckTool,
  slackChannelRepairTool,
  // Slack Ops Tools (10 tools)
  slackConnectionCheckTool,
  slackConnectionRepairTool,
  slackEventListenerCheckTool,
  slackEventRepairTool,
  slackFileDownloadCheckTool,
  slackFileRepairTool,
  slackMessageRetryRepairTool,
  slackMessageSendCheckTool,
  storageCleanupRepairTool,
  storageIntegrityCheckTool,
  storagePermissionCheckTool,
  storagePermissionRepairTool,
  storageReuploadRepairTool,
  // Storage Ops Tools (6 tools)
  storageUsageCheckTool,
  // Transcription Ops Tools (6 tools)
  transcriptionApiCheckTool,
  transcriptionApiRepairTool,
  transcriptionCancelRepairTool,
  transcriptionExpiredTasksCheckTool,
  transcriptionRetryRepairTool,
  transcriptionStuckTasksCheckTool,
} from "./tools/ops/index.js";

/**
 * 建立包含所有工具的完整 MCP Server
 * 包含內部工具和外部 MCP Server 工具
 *
 * @param options - 建立選項
 * @returns 已註冊所有工具的 MCPServer 實例
 */
export function createFullMCPServer(
  options: { enableLogging?: boolean } = {}
): MCPServer {
  const server = new MCPServer(options);

  // Phase 1: Core MCP Tools

  // 註冊 PostgreSQL 工具
  server.registerTools([postgresQueryTool, postgresSchemaInspectorTool]);

  // 註冊 Filesystem 工具
  server.registerTools([
    filesystemReadTool,
    filesystemWriteTool,
    filesystemListTool,
  ]);

  // 註冊 Slack 工具
  server.registerTools([slackPostFormattedAnalysisTool, slackPostAlertTool]);

  // Phase 2: External Service Tools

  // 註冊 Groq Whisper 工具
  server.registerTools([
    groqTranscribeAudioTool,
    groqCheckAudioSizeTool,
    groqEstimateCostTool,
  ]);

  // 註冊 R2 Storage 工具
  server.registerTools([
    r2UploadFileTool,
    r2DownloadFileTool,
    r2GenerateSignedUrlTool,
    r2CheckFileExistsTool,
    r2DeleteFileTool,
  ]);

  // 註冊 Gemini LLM 工具
  server.registerTools([
    geminiGenerateTextTool,
    geminiGenerateJSONTool,
    geminiMeddicAnalysisTool,
  ]);

  // Phase 3: Ops Tools (28 tools)

  // 註冊 Slack Ops 工具 (10 tools)
  server.registerTools([
    slackConnectionCheckTool,
    slackConnectionRepairTool,
    slackFileDownloadCheckTool,
    slackFileRepairTool,
    slackEventListenerCheckTool,
    slackEventRepairTool,
    slackMessageSendCheckTool,
    slackMessageRetryRepairTool,
    slackChannelPermissionCheckTool,
    slackChannelRepairTool,
  ]);

  // 註冊 Transcription Ops 工具 (6 tools)
  server.registerTools([
    transcriptionApiCheckTool,
    transcriptionApiRepairTool,
    transcriptionStuckTasksCheckTool,
    transcriptionRetryRepairTool,
    transcriptionExpiredTasksCheckTool,
    transcriptionCancelRepairTool,
  ]);

  // 註冊 Storage Ops 工具 (6 tools)
  server.registerTools([
    storageUsageCheckTool,
    storageCleanupRepairTool,
    storageIntegrityCheckTool,
    storageReuploadRepairTool,
    storagePermissionCheckTool,
    storagePermissionRepairTool,
  ]);

  // 註冊 Analysis Ops 工具 (6 tools)
  server.registerTools([
    analysisCompletenessCheckTool,
    analysisRerunRepairTool,
    analysisQueueCheckTool,
    analysisQueueRepairTool,
    analysisLlmCheckTool,
    analysisLlmRepairTool,
  ]);

  // Phase 4: Analytics MCP Tools (4 tools)
  server.registerTools([
    teamDashboardTool,
    repPerformanceTool,
    opportunityForecastTool,
    exportSheetsTo,
  ]);

  // Phase 4: Google Drive MCP Tools (4 tools)
  server.registerTools([
    gdriveUploadReportTool,
    gdriveCreateFolderTool,
    gdriveShareFileTool,
    gdriveSearchFilesTool,
  ]);

  // Phase 4: Google Calendar MCP Tools (5 tools)
  server.registerTools([
    calendarScheduleFollowUpTool,
    calendarCreateEventTool,
    calendarListEventsTool,
    calendarUpdateEventTool,
    calendarDeleteEventTool,
  ]);

  return server;
}
