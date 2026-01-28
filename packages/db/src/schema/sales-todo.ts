/**
 * Sales Todo Schema
 * 業務待辦事項資料表定義
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
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
  | "cancelled"
  | "won"
  | "lost";

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

/** 成交記錄 */
export interface WonRecord {
  amount?: number;
  currency?: string;
  product?: string;
  paymentDate?: string; // 預計付款日期
  note?: string;
  wonAt: string;
  wonVia: "slack" | "web";
}

/** 失敗記錄 */
export interface LostRecord {
  reason: string;
  competitor?: string;
  note?: string;
  lostAt: string;
  lostVia: "slack" | "web";
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
    onDelete: "cascade", // 刪除機會時，連帶刪除所有關聯的 Todo
  }),
  conversationId: text("conversation_id").references(() => conversations.id, {
    onDelete: "set null", // 刪除對話時，Todo 保留但 conversationId 設為 null
  }),

  // customerNumber - 用於連接 opportunity（不依賴 opportunityId）
  customerNumber: text("customer_number"),

  // Todo 內容
  title: text("title").notNull(), // Follow 事項標題
  description: text("description"), // 詳細描述（選填）

  // 日期相關
  dueDate: timestamp("due_date").notNull(), // 預計 follow 日期
  originalDueDate: timestamp("original_due_date").notNull(), // 原始預計日期
  remindDays: integer("remind_days"), // 用戶選擇的提醒天數 (1/3/5/7/14)

  // 狀態: pending, completed, postponed, cancelled
  status: text("status").$type<SalesTodoStatus>().notNull().default("pending"),

  // 完成記錄 (jsonb): { result: string, completedAt: string, completedVia: "slack" | "web" }
  completionRecord: jsonb("completion_record").$type<CompletionRecord>(),

  // 改期歷史 (jsonb array): [{ fromDate, toDate, reason, postponedAt }]
  postponeHistory: jsonb("postpone_history")
    .$type<PostponeRecord[]>()
    .default([]),

  // 成交記錄 (jsonb): { amount, currency, product, note, wonAt, wonVia }
  wonRecord: jsonb("won_record").$type<WonRecord>(),

  // 失敗記錄 (jsonb): { reason, competitor, note, lostAt, lostVia }
  lostRecord: jsonb("lost_record").$type<LostRecord>(),

  // Todo Chain - 追蹤關聯的待辦事項
  nextTodoId: text("next_todo_id"),
  prevTodoId: text("prev_todo_id"),

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
  // Todo Chain relations
  nextTodo: one(salesTodos, {
    fields: [salesTodos.nextTodoId],
    references: [salesTodos.id],
    relationName: "todoChainNext",
  }),
  prevTodo: one(salesTodos, {
    fields: [salesTodos.prevTodoId],
    references: [salesTodos.id],
    relationName: "todoChainPrev",
  }),
}));

// ============================================================
// Type Exports
// ============================================================

export type SalesTodo = typeof salesTodos.$inferSelect;
export type NewSalesTodo = typeof salesTodos.$inferInsert;
