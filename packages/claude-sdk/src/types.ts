/**
 * Claude Agent SDK 型別定義
 */

import { z } from "zod";

// ============================================================
// MCP Server 配置
// ============================================================

export interface McpServerConfig {
  /** 執行指令 (e.g., "npx") */
  command: string;
  /** 指令參數 */
  args: string[];
  /** 環境變數 */
  env?: Record<string, string>;
}

// ============================================================
// Agent 執行選項
// ============================================================

export interface ClaudeAgentOptions {
  /** 任務 prompt */
  prompt: string;
  /** 允許使用的工具列表 */
  tools?: string[];
  /** MCP Server 配置 */
  mcpServers?: Record<string, McpServerConfig>;
  /** 權限模式 */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  /** 最大執行回合數 */
  maxTurns?: number;
  /** 工作目錄 */
  workingDirectory?: string;
}

// ============================================================
// Agent 執行結果
// ============================================================

export interface AgentResult {
  /** 執行是否成功 */
  success: boolean;
  /** 輸出內容 */
  content: string;
  /** 使用的工具列表 */
  toolsUsed: string[];
  /** Token 使用量 */
  tokensUsed: number;
  /** 執行時間 (ms) */
  executionTimeMs?: number;
  /** 錯誤訊息 (如果失敗) */
  error?: string;
}

// ============================================================
// PR 審查相關
// ============================================================

export const PRIssueSeveritySchema = z.enum(["error", "warning", "info"]);
export type PRIssueSeverity = z.infer<typeof PRIssueSeveritySchema>;

export const PRIssueSchema = z.object({
  severity: PRIssueSeveritySchema,
  file: z.string(),
  line: z.number().optional(),
  message: z.string(),
  suggestion: z.string().optional(),
});
export type PRIssue = z.infer<typeof PRIssueSchema>;

export const TestCoverageSchema = z.enum([
  "adequate",
  "needs_improvement",
  "missing",
]);
export type TestCoverage = z.infer<typeof TestCoverageSchema>;

export const PRReviewResultSchema = z.object({
  summary: z.string(),
  issues: z.array(PRIssueSchema),
  suggestions: z.array(z.string()),
  securityConcerns: z.array(z.string()),
  testCoverage: TestCoverageSchema,
  overallScore: z.number().min(0).max(100),
  approved: z.boolean(),
});
export type PRReviewResult = z.infer<typeof PRReviewResultSchema>;

export type PRReviewFocusArea =
  | "security"
  | "types"
  | "tests"
  | "meddic"
  | "performance";

export interface PRReviewOptions {
  focusAreas?: PRReviewFocusArea[];
  repository?: string;
  baseBranch?: string;
}

// ============================================================
// 診斷相關
// ============================================================

export const DiagnoseStatusSchema = z.enum(["healthy", "degraded", "critical"]);
export type DiagnoseStatus = z.infer<typeof DiagnoseStatusSchema>;

export const ActionRiskSchema = z.enum(["low", "medium", "high"]);
export type ActionRisk = z.infer<typeof ActionRiskSchema>;

export const DiagnoseActionSchema = z.object({
  description: z.string(),
  command: z.string().optional(),
  risk: ActionRiskSchema,
  automated: z.boolean(),
});
export type DiagnoseAction = z.infer<typeof DiagnoseActionSchema>;

export const DiagnoseResultSchema = z.object({
  status: DiagnoseStatusSchema,
  rootCause: z.string(),
  affectedComponents: z.array(z.string()),
  immediateActions: z.array(DiagnoseActionSchema),
  longTermFixes: z.array(DiagnoseActionSchema),
  relatedConversations: z.array(z.string()).optional(),
  metrics: z
    .object({
      failureRate: z.number(),
      avgProcessingTime: z.number(),
      queueDepth: z.number(),
    })
    .optional(),
});
export type DiagnoseResult = z.infer<typeof DiagnoseResultSchema>;

// ============================================================
// Worker 日誌分析
// ============================================================

export const ErrorPatternSchema = z.object({
  pattern: z.string(),
  count: z.number(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  sampleMessages: z.array(z.string()),
});
export type ErrorPattern = z.infer<typeof ErrorPatternSchema>;

export const PerformanceTrendSchema = z.enum([
  "improving",
  "stable",
  "degrading",
]);
export type PerformanceTrend = z.infer<typeof PerformanceTrendSchema>;

export const PerformanceInsightSchema = z.object({
  metric: z.string(),
  value: z.number(),
  trend: PerformanceTrendSchema,
  recommendation: z.string().optional(),
});
export type PerformanceInsight = z.infer<typeof PerformanceInsightSchema>;

export const WorkerLogAnalysisSchema = z.object({
  workerName: z.string(),
  timeRange: z.string(),
  errorPatterns: z.array(ErrorPatternSchema),
  performanceInsights: z.array(PerformanceInsightSchema),
  recommendations: z.array(z.string()),
});
export type WorkerLogAnalysis = z.infer<typeof WorkerLogAnalysisSchema>;
