/**
 * Tool Executor
 * 統一的 MCP Tool 執行介面
 *
 * 整合 MCPServer，提供高階的 Tool 執行功能，
 * 包含錯誤處理、重試機制、執行追蹤等
 */

import type {
  ExecutionContext,
  MCPServer,
  ToolCall,
  ToolResult,
} from "../mcp/index.js";

// ============================================================
// Types
// ============================================================

/** Tool Executor 選項 */
export interface ToolExecutorOptions {
  /** 最大重試次數 */
  maxRetries?: number;
  /** 重試延遲（毫秒） */
  retryDelayMs?: number;
  /** 執行逾時（毫秒） */
  timeoutMs?: number;
  /** 是否啟用日誌 */
  enableLogging?: boolean;
}

/** 執行統計 */
export interface ExecutionStats {
  /** 總執行次數 */
  totalExecutions: number;
  /** 成功次數 */
  successCount: number;
  /** 失敗次數 */
  failureCount: number;
  /** 總執行時間（毫秒） */
  totalExecutionTimeMs: number;
  /** 平均執行時間（毫秒） */
  averageExecutionTimeMs: number;
}

/** 批次執行選項 */
export interface BatchExecutionOptions {
  /** 是否並行執行 */
  parallel?: boolean;
  /** 遇到錯誤是否停止 */
  stopOnError?: boolean;
  /** 最大並行數量 */
  maxConcurrency?: number;
}

// ============================================================
// Tool Executor Class
// ============================================================

/**
 * Tool Executor
 * 提供統一的 Tool 執行介面
 */
export class ToolExecutor {
  private readonly mcpServer: MCPServer;
  private readonly options: Required<ToolExecutorOptions>;
  private stats: ExecutionStats;

  constructor(mcpServer: MCPServer, options: ToolExecutorOptions = {}) {
    this.mcpServer = mcpServer;
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
      timeoutMs: options.timeoutMs ?? 30_000,
      enableLogging: options.enableLogging ?? false,
    };
    this.stats = this.createEmptyStats();
  }

  // ============================================================
  // Execution Methods
  // ============================================================

  /**
   * 執行單一 Tool
   * @param name - Tool 名稱
   * @param input - Tool 輸入
   * @param context - 執行上下文
   * @returns Tool 執行結果
   */
  async execute(
    name: string,
    input: unknown,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const result = await this.executeWithRetry(name, input, context);
      this.updateStats(true, Date.now() - startTime);
      return result;
    } catch (error) {
      this.updateStats(false, Date.now() - startTime);
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
   * @param options - 批次執行選項
   * @returns ToolResult 陣列
   */
  async executeTools(
    calls: ToolCall[],
    context: ExecutionContext,
    options: BatchExecutionOptions = {}
  ): Promise<ToolResult[]> {
    const {
      parallel = true,
      stopOnError = false,
      maxConcurrency = 5,
    } = options;

    if (calls.length === 0) {
      return [];
    }

    if (this.options.enableLogging) {
      console.log(
        `[ToolExecutor] Executing ${calls.length} tools, parallel=${parallel}`
      );
    }

    if (parallel) {
      return this.executeParallel(calls, context, maxConcurrency);
    }

    return this.executeSequential(calls, context, stopOnError);
  }

  /**
   * 執行 Tool 並帶有重試機制
   */
  private async executeWithRetry(
    name: string,
    input: unknown,
    context: ExecutionContext,
    attempt = 1
  ): Promise<ToolResult> {
    try {
      const result = await this.executeWithTimeout(name, input, context);

      if (!result.success && attempt < this.options.maxRetries) {
        if (this.options.enableLogging) {
          console.log(
            `[ToolExecutor] Tool "${name}" failed, retrying (${attempt}/${this.options.maxRetries})`
          );
        }

        await this.delay(this.options.retryDelayMs * attempt);
        return this.executeWithRetry(name, input, context, attempt + 1);
      }

      return result;
    } catch (error) {
      if (attempt < this.options.maxRetries) {
        if (this.options.enableLogging) {
          console.log(
            `[ToolExecutor] Tool "${name}" threw error, retrying (${attempt}/${this.options.maxRetries})`
          );
        }

        await this.delay(this.options.retryDelayMs * attempt);
        return this.executeWithRetry(name, input, context, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * 執行 Tool 並帶有逾時機制
   */
  private async executeWithTimeout(
    name: string,
    input: unknown,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Tool "${name}" execution timed out after ${this.options.timeoutMs}ms`
          )
        );
      }, this.options.timeoutMs);
    });

    const executionPromise = this.mcpServer.safeExecuteTool(
      name,
      input,
      context
    );

    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * 並行執行多個 Tools
   */
  private async executeParallel(
    calls: ToolCall[],
    context: ExecutionContext,
    maxConcurrency: number
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    const chunks = this.chunk(calls, maxConcurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((call) =>
          this.execute(call.name, call.input, context).then((result) => ({
            ...result,
            callId: call.callId,
          }))
        )
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * 序列執行多個 Tools
   */
  private async executeSequential(
    calls: ToolCall[],
    context: ExecutionContext,
    stopOnError: boolean
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of calls) {
      const result = await this.execute(call.name, call.input, context);
      results.push({ ...result, callId: call.callId });

      if (stopOnError && !result.success) {
        if (this.options.enableLogging) {
          console.log(
            `[ToolExecutor] Stopping execution due to error in "${call.name}"`
          );
        }
        break;
      }
    }

    return results;
  }

  // ============================================================
  // Statistics
  // ============================================================

  /**
   * 取得執行統計
   */
  getStats(): ExecutionStats {
    return { ...this.stats };
  }

  /**
   * 重置統計
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  private createEmptyStats(): ExecutionStats {
    return {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      totalExecutionTimeMs: 0,
      averageExecutionTimeMs: 0,
    };
  }

  private updateStats(success: boolean, executionTimeMs: number): void {
    this.stats.totalExecutions++;
    this.stats.totalExecutionTimeMs += executionTimeMs;

    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.failureCount++;
    }

    this.stats.averageExecutionTimeMs =
      this.stats.totalExecutionTimeMs / this.stats.totalExecutions;
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * 延遲執行
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 分割陣列為指定大小的 chunks
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // ============================================================
  // Accessors
  // ============================================================

  /**
   * 取得 MCP Server 實例
   */
  get server(): MCPServer {
    return this.mcpServer;
  }

  /**
   * 取得可用的 Tool 名稱
   */
  get availableTools(): string[] {
    return this.mcpServer.toolNames;
  }

  /**
   * 檢查 Tool 是否可用
   */
  hasTool(name: string): boolean {
    return this.mcpServer.hasTool(name);
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 建立 Tool Executor 實例
 * @param mcpServer - MCP Server 實例
 * @param options - Executor 選項
 * @returns ToolExecutor 實例
 */
export function createToolExecutor(
  mcpServer: MCPServer,
  options: ToolExecutorOptions = {}
): ToolExecutor {
  return new ToolExecutor(mcpServer, options);
}
