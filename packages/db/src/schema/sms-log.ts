import { relations } from "drizzle-orm";
import { boolean, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { conversations } from "./conversation";
import { opportunities } from "./opportunity";

/**
 * SMS 簡訊發送記錄
 * 追蹤所有透過 EVERY8D 發送的簡訊
 *
 * 此 schema 對應現有資料庫結構
 */
export const smsLogs = pgTable("sms_logs", {
  id: text("id").primaryKey(),

  // 關聯
  userId: text("user_id"), // Slack User ID
  opportunityId: text("opportunity_id").references(() => opportunities.id),
  conversationId: text("conversation_id").references(() => conversations.id),

  // 收件人資訊
  phoneNumber: text("phone_number").notNull(),

  // 簡訊內容
  subject: text("subject"), // 簡訊主旨 (optional)
  message: text("message").notNull(),
  batchId: text("batch_id"), // 批次 ID (用於批量發送)

  // 發送狀態
  statusCode: text("status_code"), // EVERY8D API 狀態碼
  statusMessage: text("status_message"), // EVERY8D API 狀態訊息
  errorDetails: text("error_details"), // 詳細錯誤資訊

  // EVERY8D API 回應
  cost: real("cost"), // 發送成本 (點數)
  creditAfter: real("credit_after"), // 發送後剩餘點數

  // Slack 整合
  slackNotified: boolean("slack_notified").default(false),
  slackChannelId: text("slack_channel_id"),

  // 時間戳
  scheduledAt: timestamp("scheduled_at"), // 預約發送時間
  deliveredAt: timestamp("delivered_at"), // 實際發送時間
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // 額外資料
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

// Relations
export const smsLogsRelations = relations(smsLogs, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [smsLogs.opportunityId],
    references: [opportunities.id],
  }),
  conversation: one(conversations, {
    fields: [smsLogs.conversationId],
    references: [conversations.id],
  }),
}));

export type SmsLog = typeof smsLogs.$inferSelect;
export type NewSmsLog = typeof smsLogs.$inferInsert;
