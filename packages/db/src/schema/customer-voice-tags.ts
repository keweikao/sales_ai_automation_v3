/**
 * Customer Voice Tags Schema
 * 客戶聲音標籤 - 用於追蹤客戶提到的功能需求、痛點、異議、競品
 */

import { relations } from "drizzle-orm";
import {
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversation";
import { opportunities } from "./opportunity";

/**
 * 功能需求標籤
 */
export interface FeatureMention {
  tag: string;
  category: string;
  quotes: string[];
  count: number;
  source: "rule" | "ai";
}

/**
 * 痛點標籤
 */
export interface PainTag {
  tag: string;
  severity: "critical" | "high" | "medium" | "low";
  quotes: string[];
  isQuantified: boolean;
  source: "rule" | "ai";
}

/**
 * 異議標籤
 */
export interface ObjectionTag {
  tag: string;
  quotes: string[];
  source: "rule" | "ai";
}

/**
 * 競品提及
 */
export interface CompetitorMention {
  name: string;
  sentiment: "positive" | "negative" | "neutral";
  quotes: string[];
  source: "rule" | "ai";
}

/**
 * 決策因素
 */
export interface DecisionFactor {
  tag: string;
  importance: "high" | "medium" | "low";
  quotes: string[];
  source: "rule" | "ai";
}

/**
 * 客戶聲音標籤表
 */
export const customerVoiceTags = pgTable(
  "customer_voice_tags",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id").references(() => opportunities.id),
    productLine: text("product_line").notNull().default("ichef"),

    // 功能需求標籤
    featuresMentioned: jsonb("features_mentioned")
      .$type<FeatureMention[]>()
      .default([]),

    // 痛點標籤
    painTags: jsonb("pain_tags").$type<PainTag[]>().default([]),

    // 異議標籤
    objectionTags: jsonb("objection_tags").$type<ObjectionTag[]>().default([]),

    // 競品提及
    competitorMentions: jsonb("competitor_mentions")
      .$type<CompetitorMention[]>()
      .default([]),

    // 決策因素
    decisionFactors: jsonb("decision_factors")
      .$type<DecisionFactor[]>()
      .default([]),

    // 處理統計
    totalSentences: integer("total_sentences").default(0),
    ruleMatchedCount: integer("rule_matched_count").default(0),
    aiProcessedCount: integer("ai_processed_count").default(0),
    skippedCount: integer("skipped_count").default(0),

    // 元資料
    conversationDate: date("conversation_date").notNull(),
    salesRepId: text("sales_rep_id"),
    processingTimeMs: integer("processing_time_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_voice_tags_conversation").on(table.conversationId),
  ]
);

/**
 * 客戶聲音標籤關聯
 */
export const customerVoiceTagsRelations = relations(
  customerVoiceTags,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [customerVoiceTags.conversationId],
      references: [conversations.id],
    }),
    opportunity: one(opportunities, {
      fields: [customerVoiceTags.opportunityId],
      references: [opportunities.id],
    }),
  })
);

/**
 * 每日聲音摘要表
 */
export const dailyVoiceSummary = pgTable(
  "daily_voice_summary",
  {
    id: text("id").primaryKey(),
    summaryDate: date("summary_date").notNull(),
    productLine: text("product_line").notNull().default("ichef"),

    // 聚合統計
    topFeatures: jsonb("top_features")
      .$type<
        Array<{
          tag: string;
          count: number;
          uniqueConversations: number;
          sampleQuotes: string[];
        }>
      >()
      .default([]),

    topPainPoints: jsonb("top_pain_points")
      .$type<
        Array<{
          tag: string;
          count: number;
          avgSeverity: string;
          sampleQuotes: string[];
        }>
      >()
      .default([]),

    topObjections: jsonb("top_objections")
      .$type<
        Array<{
          tag: string;
          count: number;
          sampleQuotes: string[];
        }>
      >()
      .default([]),

    competitorStats: jsonb("competitor_stats")
      .$type<
        Array<{
          name: string;
          count: number;
          sentimentBreakdown: {
            positive: number;
            negative: number;
            neutral: number;
          };
        }>
      >()
      .default([]),

    // 處理統計
    totalConversations: integer("total_conversations").default(0),
    totalSentencesProcessed: integer("total_sentences_processed").default(0),
    aiCallsMade: integer("ai_calls_made").default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_daily_summary_date_product").on(
      table.summaryDate,
      table.productLine
    ),
  ]
);

// Type exports
export type CustomerVoiceTag = typeof customerVoiceTags.$inferSelect;
export type NewCustomerVoiceTag = typeof customerVoiceTags.$inferInsert;
export type DailyVoiceSummary = typeof dailyVoiceSummary.$inferSelect;
export type NewDailyVoiceSummary = typeof dailyVoiceSummary.$inferInsert;
