/**
 * Analytics Router - Main Entry Point
 * 整合所有分析相關的 API procedures
 *
 * 模組結構:
 * - dashboard.ts: getOpportunityStats, getDashboard
 * - opportunity-analytics.ts: getOpportunityAnalytics, getMeddicTrends
 * - rep-performance/: getRepPerformance (業務個人報告)
 * - team-performance/: getTeamPerformance (團隊報告)
 * - mtd-uploads.ts: getMtdUploads
 */

// ============================================================
// Type Exports
// ============================================================

export type { CachedDashboard, OpportunityStatsResult } from "./dashboard";
export type { MtdUploadItem, MtdUploadsResult } from "./mtd-uploads";
export type { CachedRepPerformance } from "./rep-performance";
export type { CachedTeamReport } from "./team-performance";

// ============================================================
// Schema Exports
// ============================================================

export {
  dashboardSchema,
  meddicTrendsSchema,
  mtdUploadsSchema,
  opportunityAnalyticsSchema,
  repPerformanceSchema,
  teamPerformanceSchema,
} from "./schemas";

// ============================================================
// Utility Exports
// ============================================================

export { CACHE_TTL, CacheKeys, getKVCacheService } from "./cache";
export {
  buildDateConditions,
  buildUserCondition,
  calculateTrend,
  getPeriodRanges,
  roundScore,
} from "./utils";

// ============================================================
// Procedure Imports
// ============================================================

import { getDashboard, getOpportunityStats } from "./dashboard";
import { getMtdUploads } from "./mtd-uploads";
import {
  getMeddicTrends,
  getOpportunityAnalytics,
} from "./opportunity-analytics";
import { getRepPerformance } from "./rep-performance";
import { getTeamPerformance } from "./team-performance";

// ============================================================
// Procedure Exports
// ============================================================

export {
  getDashboard,
  getMeddicTrends,
  getMtdUploads,
  getOpportunityAnalytics,
  getOpportunityStats,
  getRepPerformance,
  getTeamPerformance,
};

// ============================================================
// Router Export
// ============================================================

/**
 * Analytics Router
 * 包含所有分析相關的 API endpoints
 */
export const analyticsRouter = {
  /** Dashboard 總覽 - 根據用戶角色顯示不同範圍的統計 */
  dashboard: getDashboard,

  /** 商機統計 - 全域統計資料 (用於 /report dashboard) */
  opportunityStats: getOpportunityStats,

  /** 商機分析 - 特定商機的 MEDDIC 分析歷史 */
  opportunityAnalytics: getOpportunityAnalytics,

  /** MEDDIC 趨勢 - 維度分數趨勢分析 */
  meddicTrends: getMeddicTrends,

  /** 業務個人報告 - 個人表現分析 */
  repPerformance: getRepPerformance,

  /** 團隊報告 - 經理專用的團隊表現分析 */
  teamPerformance: getTeamPerformance,

  /** MTD 上傳列表 - 當月上傳紀錄 */
  mtdUploads: getMtdUploads,
};
