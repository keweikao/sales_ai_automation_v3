/**
 * Claude Agents 模組
 *
 * 使用 Claude Agent SDK 實現的各種自動化代理人
 *
 * @example
 * ```typescript
 * import { reviewPullRequest } from "@sales_ai_automation_v3/services/claude-agents";
 *
 * const result = await reviewPullRequest(123);
 * ```
 */

// Phase 3 - E2E 測試修復
export {
  diagnoseE2ETests,
  fixE2ETest,
  formatDiagnosisAsMarkdown,
  formatFixAsMarkdown,
  runE2ETests,
} from "./dev/e2e-fixer.js";
// 開發自動化代理人
export {
  formatReviewAsMarkdown,
  reviewPullRequest,
  securityScan,
} from "./dev/pr-reviewer.js";
// Phase 2 - 診斷代理人
// Phase 5 - Datadog 可觀測性
export {
  analyzeAPM,
  analyzeKVPerformance,
  analyzeWorkerLogs,
  detectAnomalies,
  diagnoseConversation,
  diagnoseSystemHealth,
  formatAnomaliesAsMarkdown,
  formatAPMAsMarkdown,
  formatDiagnoseAsMarkdown,
  formatKVAnalysisAsMarkdown,
  formatWorkerLogAsMarkdown,
  generateAlertConfig,
} from "./ops/index.js";
// Phase 4 - 銷售教練增強
// Phase 6 - 銷售記憶管理
export {
  analyzeWithCoach,
  askCoach,
  extractMemoriesFromConversation,
  formatCoachingAsMarkdown,
  formatCustomerProfileAsMarkdown,
  formatInsightsAsMarkdown,
  generatePersonalizedInsights,
  getCustomerHistory,
  getTalkTracks,
  saveCustomerMemory,
  scheduleFollowUp,
} from "./sales/index.js";
