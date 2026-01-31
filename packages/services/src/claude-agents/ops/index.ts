/**
 * Ops 代理人模組
 *
 * 使用 Claude Agent SDK 實現的運維診斷代理人
 */

// Cloudflare 分析代理人
export {
  analyzeKVPerformance,
  analyzeWorkerLogs,
  formatKVAnalysisAsMarkdown,
  formatWorkerLogAsMarkdown,
  type KVAnalysisOptions,
  type KVPerformanceResult,
  type WorkerLogOptions,
} from "./cloudflare.js";
// Datadog 可觀測性代理人 (Phase 5)
export {
  type AlertConfig,
  type Anomaly,
  type AnomalyDetectionOptions,
  type AnomalyDetectionResult,
  type APMAnalysisOptions,
  type APMMetrics,
  analyzeAPM,
  detectAnomalies,
  formatAnomaliesAsMarkdown,
  formatAPMAsMarkdown,
  generateAlertConfig,
} from "./datadog.js";
// 診斷代理人
export {
  type ConversationDiagnoseOptions,
  diagnoseConversation,
  diagnoseSystemHealth,
  formatDiagnoseAsMarkdown,
  type SystemHealthOptions,
} from "./diagnose.js";
