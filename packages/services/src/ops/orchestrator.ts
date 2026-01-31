/**
 * Ops Orchestrator
 * 負責調度所有檢測和修復工具
 *
 * 核心職責：
 * 1. 並行執行所有健康檢查
 * 2. 根據檢查結果觸發對應的修復工具
 * 3. 產生執行摘要報告
 */

import type { MCPServer } from "../mcp/server.js";
import { createMCPServer } from "../mcp/server.js";
// Import all ops tools
import {
  databaseCleanupRepairTool,
  databaseConnectionCheckTool,
  databaseIndexCheckTool,
  databaseOrphanedCheckTool,
  databaseReconnectRepairTool,
  databaseReindexRepairTool,
} from "../mcp/tools/ops/index.js";
import type { ExecutionContext, MCPTool } from "../mcp/types.js";

import type {
  HealthStatus,
  OpsCheckResult,
  OpsExecutionSummary,
  OpsOrchestratorOptions,
  OpsRepairResult,
} from "./types.js";

// ============================================================
// Constants
// ============================================================

/**
 * 檢查工具到修復工具的映射表
 */
const CHECK_TO_REPAIR_MAPPING: Record<string, string> = {
  // Slack 相關
  slack_connection_check: "slack_connection_repair",
  slack_file_download_check: "slack_file_repair",
  slack_event_listener_check: "slack_event_repair",
  slack_message_send_check: "slack_message_retry_repair",
  slack_channel_permission_check: "slack_channel_repair",

  // 轉錄相關
  transcription_api_check: "transcription_api_repair",
  transcription_stuck_tasks_check: "transcription_retry_repair",
  transcription_expired_tasks_check: "transcription_cancel_repair",

  // 儲存相關
  storage_usage_check: "storage_cleanup_repair",
  storage_integrity_check: "storage_reupload_repair",
  storage_permission_check: "storage_permission_repair",

  // 分析相關
  analysis_completeness_check: "analysis_rerun_repair",
  analysis_queue_check: "analysis_queue_repair",
  analysis_llm_check: "analysis_llm_repair",

  // SMS 相關
  sms_connection_check: "sms_connection_repair",
  sms_balance_check: "sms_balance_repair",
  sms_delivery_check: "sms_retry_repair",

  // 資料庫相關
  database_connection_check: "database_reconnect_repair",
  database_orphaned_check: "database_cleanup_repair",
  database_index_check: "database_reindex_repair",
};

/**
 * 所有檢查工具清單
 */
const ALL_CHECK_TOOLS = Object.keys(CHECK_TO_REPAIR_MAPPING);

// ============================================================
// Ops Orchestrator Class
// ============================================================

export class OpsOrchestrator {
  private readonly options: Required<OpsOrchestratorOptions>;
  private readonly mcpServer: MCPServer;

  constructor(options: OpsOrchestratorOptions = {}) {
    this.options = {
      enableParallelChecks: options.enableParallelChecks ?? true,
      enableAutoRepair: options.enableAutoRepair ?? true,
      checkTimeoutMs: options.checkTimeoutMs ?? 30_000,
      repairTimeoutMs: options.repairTimeoutMs ?? 30_000,
    };

    // 初始化 MCP Server 並註冊所有工具
    this.mcpServer = createMCPServer({ enableLogging: true });
    this.registerAllTools();
  }

  /**
   * 註冊所有 Ops Tools
   */
  private registerAllTools(): void {
    // Database tools
    this.mcpServer.registerTools([
      databaseConnectionCheckTool,
      databaseOrphanedCheckTool,
      databaseIndexCheckTool,
      databaseReconnectRepairTool,
      databaseCleanupRepairTool,
      databaseReindexRepairTool,
    ] as MCPTool<unknown, unknown>[]);

    // TODO: 未來新增其他工具時在此註冊
    // - Transcription tools
    // - Slack tools
    // - Storage tools
    // - Analysis tools
    // - SMS tools
  }

  /**
   * 執行所有健康檢查（並行）
   */
  async runAllHealthChecks(): Promise<OpsCheckResult[]> {
    const startTime = Date.now();

    console.log(
      `[Ops] Starting health checks for ${ALL_CHECK_TOOLS.length} tools...`
    );

    const checkPromises = ALL_CHECK_TOOLS.map((toolName) =>
      this.runSingleCheck(toolName)
    );

    const results = await Promise.allSettled(checkPromises);

    const checkResults: OpsCheckResult[] = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      // 如果檢查本身失敗，回傳 critical 狀態
      const toolName = ALL_CHECK_TOOLS[index] ?? "unknown";
      return {
        toolName,
        status: "critical" as HealthStatus,
        timestamp: new Date(),
        details: `Check failed: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`,
      };
    });

    const elapsed = Date.now() - startTime;
    console.log(
      `[Ops] Completed ${checkResults.length} health checks in ${elapsed}ms`
    );

    return checkResults;
  }

  /**
   * 執行單一健康檢查
   */
  private async runSingleCheck(toolName: string): Promise<OpsCheckResult> {
    // 檢查工具是否已註冊
    if (!this.mcpServer.hasTool(toolName)) {
      console.warn(`[Ops] Tool "${toolName}" not registered yet, skipping...`);
      return {
        toolName,
        status: "degraded",
        timestamp: new Date(),
        details: "Tool not yet implemented",
      };
    }

    try {
      // 建立執行上下文
      const context: ExecutionContext = {
        timestamp: new Date(),
        metadata: {
          source: "ops-orchestrator",
          checkType: "scheduled",
        },
      };

      // 執行檢查工具
      const result = await this.mcpServer.executeTool(toolName, {}, context);

      // 檢查工具應該回傳包含 status 和 timestamp 的物件
      if (result && typeof result === "object" && "status" in result) {
        return {
          toolName,
          status: (result as { status: HealthStatus }).status,
          timestamp: new Date(),
          details: (result as { details?: string }).details,
          metrics: (result as { metrics?: Record<string, number> }).metrics,
        };
      }

      // 如果回傳格式不符預期，回傳 critical
      return {
        toolName,
        status: "critical",
        timestamp: new Date(),
        details: "Tool returned unexpected format",
      };
    } catch (error) {
      console.error(`[Ops] Check tool "${toolName}" failed:`, error);
      return {
        toolName,
        status: "critical",
        timestamp: new Date(),
        details: `Check execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 根據檢查結果執行修復
   */
  async repairIfNeeded(
    checkResult: OpsCheckResult
  ): Promise<OpsRepairResult | null> {
    // 如果狀態正常，無需修復
    if (checkResult.status === "healthy") {
      return null;
    }

    // 找出對應的修復工具
    const repairToolName = this.getRepairToolName(checkResult.toolName);

    if (!repairToolName) {
      console.log(`[Ops] No repair tool found for ${checkResult.toolName}`);
      return null;
    }

    if (!this.options.enableAutoRepair) {
      console.log(`[Ops] Auto-repair disabled, skipping ${repairToolName}`);
      return null;
    }

    console.log(`[Ops] Running repair tool: ${repairToolName}`);

    try {
      const startTime = Date.now();
      const result = await this.runRepairTool(repairToolName);
      const executionTimeMs = Date.now() - startTime;

      return {
        ...result,
        executionTimeMs,
      };
    } catch (error) {
      return {
        toolName: repairToolName,
        success: false,
        details: `Repair failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 執行修復工具
   */
  private async runRepairTool(toolName: string): Promise<OpsRepairResult> {
    // 檢查工具是否已註冊
    if (!this.mcpServer.hasTool(toolName)) {
      console.warn(
        `[Ops] Repair tool "${toolName}" not registered yet, skipping...`
      );
      return {
        toolName,
        success: false,
        details: "Repair tool not yet implemented",
      };
    }

    try {
      // 建立執行上下文
      const context: ExecutionContext = {
        timestamp: new Date(),
        metadata: {
          source: "ops-orchestrator",
          repairType: "auto",
        },
      };

      // 執行修復工具
      const result = await this.mcpServer.executeTool(toolName, {}, context);

      // 修復工具應該回傳包含 success 的物件
      if (result && typeof result === "object" && "success" in result) {
        return {
          toolName,
          success: (result as { success: boolean }).success,
          details:
            (result as { details?: string }).details ?? "Repair completed",
        };
      }

      // 如果回傳格式不符預期
      return {
        toolName,
        success: false,
        details: "Repair tool returned unexpected format",
      };
    } catch (error) {
      console.error(`[Ops] Repair tool "${toolName}" failed:`, error);
      return {
        toolName,
        success: false,
        details: `Repair execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 取得對應的修復工具名稱
   */
  private getRepairToolName(checkToolName: string): string | null {
    return CHECK_TO_REPAIR_MAPPING[checkToolName] || null;
  }

  /**
   * 執行完整的健康檢查與修復流程
   */
  async execute(): Promise<OpsExecutionSummary> {
    const startTime = Date.now();

    // 1. 執行所有健康檢查
    const checkResults = await this.runAllHealthChecks();

    // 2. 執行修復
    const repairResults: OpsRepairResult[] = [];

    for (const checkResult of checkResults) {
      if (checkResult.status !== "healthy") {
        const repairResult = await this.repairIfNeeded(checkResult);
        if (repairResult) {
          repairResults.push(repairResult);
        }
      }
    }

    // 3. 統計結果
    const healthyCount = checkResults.filter(
      (r) => r.status === "healthy"
    ).length;
    const degradedCount = checkResults.filter(
      (r) => r.status === "degraded"
    ).length;
    const criticalCount = checkResults.filter(
      (r) => r.status === "critical"
    ).length;
    const repairSuccessCount = repairResults.filter((r) => r.success).length;
    const repairFailureCount = repairResults.filter((r) => !r.success).length;

    const totalTimeMs = Date.now() - startTime;

    return {
      timestamp: new Date(),
      totalTimeMs,
      checkResults,
      repairResults,
      healthyCount,
      degradedCount,
      criticalCount,
      repairSuccessCount,
      repairFailureCount,
    };
  }

  /**
   * 產生執行摘要的 Markdown 報告
   */
  generateReport(summary: OpsExecutionSummary): string {
    let report = "# Ops Execution Report\n\n";

    report += `**Execution Time**: ${new Date(summary.timestamp).toISOString()}\n`;
    report += `**Total Duration**: ${summary.totalTimeMs}ms\n\n`;

    report += "## Health Check Summary\n\n";
    report += `- **Total Checks**: ${summary.checkResults.length}\n`;
    report += `- **Healthy**: ${summary.healthyCount}\n`;
    report += `- **Degraded**: ${summary.degradedCount}\n`;
    report += `- **Critical**: ${summary.criticalCount}\n\n`;

    if (summary.repairResults.length > 0) {
      report += "## Repair Summary\n\n";
      report += `- **Total Repairs**: ${summary.repairResults.length}\n`;
      report += `- **Successful**: ${summary.repairSuccessCount}\n`;
      report += `- **Failed**: ${summary.repairFailureCount}\n\n`;
    }

    // 列出所有問題
    const issues = summary.checkResults.filter((r) => r.status !== "healthy");
    if (issues.length > 0) {
      report += "## Issues Detected\n\n";
      for (const issue of issues) {
        report += `### ${issue.toolName}\n`;
        report += `- **Status**: ${issue.status.toUpperCase()}\n`;
        report += `- **Details**: ${issue.details || "No details"}\n\n`;
      }
    }

    return report;
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 建立 Ops Orchestrator 實例
 */
export function createOpsOrchestrator(
  options?: OpsOrchestratorOptions
): OpsOrchestrator {
  return new OpsOrchestrator(options);
}
