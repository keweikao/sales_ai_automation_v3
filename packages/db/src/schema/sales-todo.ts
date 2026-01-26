/**
 * Sales Todo Schema
 * 業務待辦事項資料表定義
 */

import { relations } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { conversations } from "./conversation";
import { opportunities } from "./opportunity";

// ============================================================
// Types
// ============================================================

/** 待辦事項狀態 */
export type SalesTodoStatus =
  | "pending"
  | "completed"
  | "postponed"
  | "cancelled";

/** 改期記錄 */
export interface PostponeRecord {
  fromDate: string;
  toDate: string;
  reason?: string;
  postponedAt: string;
}

/** 完成記錄 */
export interface CompletionRecord {
  result: string;
  completedAt: string;
  completedVia: "slack" | "web";
}

// ============================================================
// Table Definition
// ============================================================

export const salesTodos = pgTable("sales_todos", {
  id: text("id").primaryKey(),

  // 關聯
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),
  conversationId: text("conversation_id").references(() => conversations.id, {
    onDelete: "set null",
  }),

  // Todo 內容
  title: text("title").notNull(), // Follow 事項標題
  description: text("description"), // 詳細描述（選填）

  // 日期相關
  dueDate: timestamp("due_date").notNull(), // 預計 follow 日期
  originalDueDate: timestamp("original_due_date").notNull(), // 原始預計日期

  // 狀態: pending, completed, postponed, cancelled
  status: text("status").$type<SalesTodoStatus>().notNull().default("pending"),

  // 完成記錄 (jsonb): { result: string, completedAt: string, completedVia: "slack" | "web" }
  completionRecord: jsonb("completion_record").$type<CompletionRecord>(),

  // 改期歷史 (jsonb array): [{ fromDate, toDate, reason, postponedAt }]
  postponeHistory: jsonb("postpone_history")
    .$type<PostponeRecord[]>()
    .default([]),

  // 取消原因
  cancellationReason: text("cancellation_reason"),

  // 提醒相關
  reminderSent: boolean("reminder_sent").default(false),
  reminderSentAt: timestamp("reminder_sent_at"),
  slackMessageTs: text("slack_message_ts"),

  // 來源: slack, web
  source: text("source").notNull().default("slack"),

  // 時間戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// Relations
// ============================================================

export const salesTodosRelations = relations(salesTodos, ({ one }) => ({
  user: one(user, {
    fields: [salesTodos.userId],
    references: [user.id],
  }),
  opportunity: one(opportunities, {
    fields: [salesTodos.opportunityId],
    references: [opportunities.id],
  }),
  conversation: one(conversations, {
    fields: [salesTodos.conversationId],
    references: [conversations.id],
  }),
}));

// ============================================================
// Type Exports
// ============================================================

export type SalesTodo = typeof salesTodos.$inferSelect;
export type NewSalesTodo = typeof salesTodos.$inferInsert;
