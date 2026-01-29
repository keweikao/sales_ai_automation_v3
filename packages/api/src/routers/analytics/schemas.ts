/**
 * Analytics Router Schemas
 * Zod schemas for analytics API input validation
 */

import { z } from "zod";

/**
 * Dashboard 查詢 schema
 * 支援日期範圍篩選
 */
export const dashboardSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type DashboardInput = z.infer<typeof dashboardSchema>;

/**
 * 商機分析 schema
 * 查詢特定商機的分析資料
 */
export const opportunityAnalyticsSchema = z.object({
  opportunityId: z.string(),
});

export type OpportunityAnalyticsInput = z.infer<
  typeof opportunityAnalyticsSchema
>;

/**
 * MEDDIC 趨勢 schema
 * 支援日期範圍和特定維度篩選
 */
export const meddicTrendsSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  dimension: z
    .enum([
      "metrics",
      "economicBuyer",
      "decisionCriteria",
      "decisionProcess",
      "identifyPain",
      "champion",
    ])
    .optional(),
});

export type MeddicTrendsInput = z.infer<typeof meddicTrendsSchema>;

/**
 * 業務個人表現報告 schema
 * - 經理可指定查看某業務
 * - 業務只能看自己
 */
export const repPerformanceSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  userId: z.string().optional(),
});

export type RepPerformanceInput = z.infer<typeof repPerformanceSchema>;

/**
 * 團隊表現報告 schema
 * - 部門篩選 (admin/manager 可用)
 */
export const teamPerformanceSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  department: z.enum(["all", "beauty", "ichef"]).optional(),
});

export type TeamPerformanceInput = z.infer<typeof teamPerformanceSchema>;

/**
 * MTD 上傳列表 schema
 * 查詢特定年月的上傳紀錄
 */
export const mtdUploadsSchema = z.object({
  year: z.number().optional(),
  month: z.number().optional(),
});

export type MtdUploadsInput = z.infer<typeof mtdUploadsSchema>;
