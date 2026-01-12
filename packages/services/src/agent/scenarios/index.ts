/**
 * Agent Scenarios Index
 * 匯出所有 AI 教練場景
 */

// ============================================================
// Close Now Alert Scenario
// ============================================================

export type { CloseNowContext, CloseNowResult } from "./close-now-alert.js";
export {
  evaluateCloseNow,
  scanHighPotentialOpportunities,
} from "./close-now-alert.js";

// ============================================================
// Manager Report Scenario
// ============================================================

export type {
  ActionRecommendation,
  AlertSummary,
  GenerateReportInput,
  ManagerReport,
  RepPerformanceSummary,
  TeamStats,
  TrendDirection,
} from "./manager-report.js";
export {
  formatReportAsText,
  generateManagerReport,
} from "./manager-report.js";

// ============================================================
// Post-Demo Coach Scenario
// ============================================================

export {
  createPostDemoCoachHandler,
  postDemoCoachHandler,
} from "./post-demo-coach.js";
