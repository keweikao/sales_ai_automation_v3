/**
 * MCP Tools Index
 * 匯出所有可用的 MCP Tools
 */

// ============================================================
// Schedule Follow-up Tool
// ============================================================

export type {
  ScheduleFollowUpInput,
  ScheduleFollowUpOutput,
} from "./schedule-follow-up.js";
export {
  createScheduleFollowUpTool,
  scheduleFollowUpInputSchema,
  scheduleFollowUpTool,
} from "./schedule-follow-up.js";

// ============================================================
// Get Rep Performance Tool
// ============================================================

export type {
  GetRepPerformanceInput,
  GetRepPerformanceOutput,
  PerformancePeriod,
  PerformanceTrend,
} from "./get-rep-performance.js";
export {
  getRepPerformance,
  getRepPerformanceTool,
} from "./get-rep-performance.js";

// ============================================================
// Send Alert Tool
// ============================================================

export type { SendAlertInput, SendAlertOutput } from "./send-alert.js";
export { sendAlert, sendAlertTool } from "./send-alert.js";

// ============================================================
// Get Competitor Info Tool
// ============================================================

export type {
  GetCompetitorInfoInput,
  GetCompetitorInfoOutput,
} from "./get-competitor-info.js";
export {
  getCompetitorInfo,
  getCompetitorInfoTool,
  listAllCompetitors,
} from "./get-competitor-info.js";

// ============================================================
// Query Similar Cases Tool
// ============================================================

export type {
  QuerySimilarCasesInput,
  QuerySimilarCasesOutput,
  SimilarCase,
} from "./query-similar-cases.js";
export {
  createQuerySimilarCasesTool,
  QuerySimilarCasesTool,
  querySimilarCasesToolDefinition,
} from "./query-similar-cases.js";

// ============================================================
// Get Talk Tracks Tool
// ============================================================

export type {
  GetTalkTracksInput,
  GetTalkTracksOutput,
  TalkTrackItem,
} from "./get-talk-tracks.js";
export {
  createGetTalkTracksTool,
  GetTalkTracksTool,
  getTalkTracksToolDefinition,
} from "./get-talk-tracks.js";
