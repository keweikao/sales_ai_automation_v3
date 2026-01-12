/**
 * Follow-up Schema
 * 跟進排程資料表定義
 */

import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { opportunities } from "./opportunity";

// ============================================================
// Types
// ============================================================

/** 跟進頻道類型 */
export type FollowUpChannel = "slack_dm" | "slack_channel" | "email";

/** 跟進狀態 */
export type FollowUpStatus = "pending" | "sent" | "cancelled" | "failed";

/** 跟進時機 */
export type FollowUpTiming =
  | "2_hours"
  | "tomorrow_9am"
  | "3_days"
  | "1_week"
  | "custom";

// ============================================================
// Table Definition
// ============================================================

export const followUps = pgTable("follow_ups", {
  id: text("id").primaryKey(),

  // 關聯
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),

  // 排程資訊
  scheduledAt: timestamp("scheduled_at").notNull(),
  timing: text("timing").$type<FollowUpTiming>().notNull().default("custom"),

  // 頻道
  channel: text("channel").$type<FollowUpChannel>().notNull(),
  channelTarget: text("channel_target"), // e.g., Slack channel ID or email address

  // 狀態
  status: text("status").$type<FollowUpStatus>().notNull().default("pending"),

  // 訊息內容
  message: text("message").notNull(),
  talkTrack: text("talk_track"), // 建議的對話方式

  // 執行結果
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),

  // 時間戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// Relations
// ============================================================

export const followUpsRelations = relations(followUps, ({ one }) => ({
  user: one(user, {
    fields: [followUps.userId],
    references: [user.id],
  }),
  opportunity: one(opportunities, {
    fields: [followUps.opportunityId],
    references: [opportunities.id],
  }),
}));

// ============================================================
// Type Exports
// ============================================================

export type FollowUp = typeof followUps.$inferSelect;
export type NewFollowUp = typeof followUps.$inferInsert;
