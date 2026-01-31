/**
 * @sales_ai_automation_v3/claude-sdk
 *
 * Claude Agent SDK 封裝，提供統一的 API 調用介面
 *
 * @example
 * ```typescript
 * import {
 *   executeAgent,
 *   streamAgent,
 *   getMcpServers,
 * } from "@sales_ai_automation_v3/claude-sdk";
 *
 * // 執行任務
 * const result = await executeAgent({
 *   prompt: "審查 PR #123",
 *   tools: ["Read", "Glob", "Grep"],
 *   mcpServers: getMcpServers(["github"]),
 * });
 * ```
 */

// Client API
export {
  analyzeCode,
  executeAgent,
  executeShell,
  modifyCode,
  simpleQuery,
  streamAgent,
} from "./client.js";

// MCP Registry
export {
  getConfiguredMcpServers,
  getMcpServerRequiredEnvVars,
  getMcpServers,
  isMcpServerConfigured,
  MCP_SERVERS,
  type McpServerName,
} from "./mcp-registry.js";

// Types
export type {
  ActionRisk,
  AgentResult,
  ClaudeAgentOptions,
  DiagnoseAction,
  DiagnoseResult,
  // Diagnose types
  DiagnoseStatus,
  // Worker log types
  ErrorPattern,
  // Core types
  McpServerConfig,
  PerformanceInsight,
  PerformanceTrend,
  // PR Review types
  PRIssue,
  PRIssueSeverity,
  PRReviewFocusArea,
  PRReviewOptions,
  PRReviewResult,
  TestCoverage,
  WorkerLogAnalysis,
} from "./types.js";

// Zod schemas (for runtime validation)
export {
  ActionRiskSchema,
  DiagnoseActionSchema,
  DiagnoseResultSchema,
  DiagnoseStatusSchema,
  ErrorPatternSchema,
  PerformanceInsightSchema,
  PerformanceTrendSchema,
  PRIssueSchema,
  PRIssueSeveritySchema,
  PRReviewResultSchema,
  TestCoverageSchema,
  WorkerLogAnalysisSchema,
} from "./types.js";
