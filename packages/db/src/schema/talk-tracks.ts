import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversation";

/**
 * Talk Tracks Schema
 * 話術知識庫 - 儲存銷售話術和最佳實踐
 */
export const talkTracks = pgTable("talk_tracks", {
  id: text("id").primaryKey(),

  // 情境分類
  situation: text("situation").notNull(), // "價格異議", "需要老闆決定", "轉換顧慮", "已有其他系統", "要再考慮"

  // 客戶特徵
  customerType: text("customer_type"), // "衝動型", "精算型", "保守觀望型"
  storeType: text("store_type"), // "cafe", "restaurant", "beverage"

  // 話術內容
  talkTrack: text("talk_track").notNull(), // 話術內容本體
  context: text("context"), // 使用情境說明
  expectedOutcome: text("expected_outcome"), // 預期效果

  // 來源追蹤
  sourceConversationId: text("source_conversation_id").references(
    () => conversations.id,
    { onDelete: "set null" }
  ),
  sourceType: text("source_type").default("expert"), // 'expert' | 'extracted' | 'user_submitted'

  // 成效追蹤
  successRate: integer("success_rate"), // 0-100 成功率
  usageCount: integer("usage_count").default(0), // 使用次數

  // 版本與狀態控制
  version: integer("version").default(1),
  isActive: boolean("is_active").default(true),

  // 標籤系統
  tags: text("tags").array(), // ['價格', 'ROI', '競品']

  // 時間戳記
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const talkTracksRelations = relations(talkTracks, ({ one }) => ({
  sourceConversation: one(conversations, {
    fields: [talkTracks.sourceConversationId],
    references: [conversations.id],
  }),
}));

// Type exports
export type TalkTrack = typeof talkTracks.$inferSelect;
export type NewTalkTrack = typeof talkTracks.$inferInsert;

// Situation types for type safety
export const TALK_TRACK_SITUATIONS = [
  "價格異議",
  "需要老闆決定",
  "擔心轉換麻煩",
  "已有其他系統",
  "要再考慮",
] as const;

export type TalkTrackSituation = (typeof TALK_TRACK_SITUATIONS)[number];

// Customer types
export const CUSTOMER_TYPES = ["衝動型", "精算型", "保守觀望型"] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

// Store types
export const STORE_TYPES = [
  "cafe",
  "restaurant",
  "beverage",
  "retail",
] as const;

export type StoreType = (typeof STORE_TYPES)[number];

// Source types
export const SOURCE_TYPES = ["expert", "extracted", "user_submitted"] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
