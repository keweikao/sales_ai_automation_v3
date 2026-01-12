/**
 * MCP (Model Context Protocol) Server Types
 * 定義 MCP Tools 的核心類型介面
 */

import type { z } from "zod";

// ============================================================
// Execution Context
// ============================================================

/**
 * 執行上下文，提供 Tool 執行時所需的環境資訊
 */
export interface ExecutionContext {
  /** 使用者 ID */
  userId?: string;
  /** 對話 ID */
  conversationId?: string;
  /** 商機 ID */
  opportunityId?: string;
  /** 執行時間戳 */
  timestamp: Date;
  /** 額外的元資料 */
  metadata?: Record<string, unknown>;
}

// ============================================================
// Tool Definitions
// ============================================================

/**
 * MCP Tool 介面定義
 * @template TInput - 輸入類型
 * @template TOutput - 輸出類型
 */
export interface MCPTool<TInput = unknown, TOutput = unknown> {
  /** Tool 名稱（唯一識別符） */
  name: string;
  /** Tool 描述（用於 LLM 理解用途） */
  description: string;
  /** 輸入 Schema（使用 Zod 定義） */
  inputSchema: z.ZodType<TInput>;
  /** Tool 處理函式 */
  handler: (input: TInput, context: ExecutionContext) => Promise<TOutput>;
}

/**
 * Tool 定義（用於 LLM 工具清單）
 */
export interface ToolDefinition {
  /** Tool 名稱 */
  name: string;
  /** Tool 描述 */
  description: string;
  /** 輸入 Schema（JSON Schema 格式） */
  inputSchema: Record<string, unknown>;
}

// ============================================================
// Tool Execution
// ============================================================

/**
 * Tool 呼叫請求
 */
export interface ToolCall {
  /** Tool 名稱 */
  name: string;
  /** Tool 輸入參數 */
  input: unknown;
  /** 呼叫 ID（用於追蹤） */
  callId?: string;
}

/**
 * Tool 執行結果
 */
export interface ToolResult {
  /** 呼叫 ID */
  callId?: string;
  /** Tool 名稱 */
  name: string;
  /** 是否成功 */
  success: boolean;
  /** 執行結果（成功時） */
  output?: unknown;
  /** 錯誤訊息（失敗時） */
  error?: string;
  /** 執行時間（毫秒） */
  executionTimeMs?: number;
}

// ============================================================
// Tool Categories
// ============================================================

/**
 * Tool 類別
 */
export type ToolCategory =
  | "scheduling" // 排程相關
  | "crm" // CRM 整合
  | "notification" // 通知相關
  | "analysis" // 分析相關
  | "data"; // 資料操作

/**
 * 分類的 Tool 定義
 */
export interface CategorizedTool<TInput = unknown, TOutput = unknown>
  extends MCPTool<TInput, TOutput> {
  /** Tool 類別 */
  category: ToolCategory;
  /** 優先順序（數字越小越優先） */
  priority?: number;
}

// ============================================================
// Error Types
// ============================================================

/**
 * Tool 執行錯誤
 */
export class ToolExecutionError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly originalError: Error,
    message?: string
  ) {
    super(
      message ?? `Tool "${toolName}" execution failed: ${originalError.message}`
    );
    this.name = "ToolExecutionError";
  }
}

/**
 * Tool 驗證錯誤
 */
export class ToolValidationError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly validationErrors: string[],
    message?: string
  ) {
    super(
      message ??
        `Tool "${toolName}" input validation failed: ${validationErrors.join(", ")}`
    );
    this.name = "ToolValidationError";
  }
}

/**
 * Tool 未找到錯誤
 */
export class ToolNotFoundError extends Error {
  constructor(
    public readonly toolName: string,
    message?: string
  ) {
    super(message ?? `Tool "${toolName}" not found`);
    this.name = "ToolNotFoundError";
  }
}
