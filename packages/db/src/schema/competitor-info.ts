import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * 競品資訊表
 * 儲存競爭對手的相關資訊，用於銷售情境中的競品分析與反制策略
 *
 * 用途：
 * - 提供業務人員競品知識
 * - AI 教練根據競品情況提供建議
 * - 追蹤客戶從競品轉換的案例
 */

export interface SwitchingCase {
  customerName?: string;
  industry?: string;
  previousSolution: string;
  switchReason: string;
  outcomeMetrics?: string;
  testimonialQuote?: string;
  date?: string;
}

export const competitorInfo = pgTable(
  "competitor_info",
  {
    id: text("id").primaryKey(),

    // 競品基本資訊
    competitorName: text("competitor_name").notNull().unique(),

    // SWOT 分析
    strengths: jsonb("strengths").$type<string[]>(), // 競品的優勢
    weaknesses: jsonb("weaknesses").$type<string[]>(), // 競品的弱點

    // 我方優勢與反制策略
    ourAdvantages: jsonb("our_advantages").$type<string[]>(), // 相對於該競品，我方的優勢
    counterTalkTracks: jsonb("counter_talk_tracks").$type<string[]>(), // 反制話術建議

    // 客戶轉換案例
    switchingCases: jsonb("switching_cases").$type<SwitchingCase[]>(), // 從該競品轉換過來的成功案例

    // 時間戳
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // 索引優化查詢
    index("competitor_info_name_idx").on(table.competitorName),
  ]
);

export type CompetitorInfo = typeof competitorInfo.$inferSelect;
export type NewCompetitorInfo = typeof competitorInfo.$inferInsert;
