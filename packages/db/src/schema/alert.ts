import { relations } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { conversations } from "./conversation";
import { opportunities } from "./opportunity";

// Alert 類型
export type AlertType = "close_now" | "missing_dm" | "manager_escalation";
export type AlertSeverity = "high" | "medium" | "low";
export type AlertStatus = "pending" | "acknowledged" | "resolved" | "dismissed";

export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  opportunityId: text("opportunity_id")
    .notNull()
    .references(() => opportunities.id),
  conversationId: text("conversation_id").references(() => conversations.id),
  userId: text("user_id").references(() => user.id),

  // 警示資訊
  type: text("type").$type<AlertType>().notNull(),
  severity: text("severity").$type<AlertSeverity>().notNull(),
  status: text("status").$type<AlertStatus>().notNull().default("pending"),

  // 警示內容
  title: text("title").notNull(),
  message: text("message").notNull(),
  context: jsonb("context").$type<{
    meddicScore?: number;
    dimensionScores?: Record<string, number>;
    triggerReason: string;
    suggestedAction: string;
    relatedData?: Record<string, unknown>;
  }>(),

  // Slack 通知狀態
  slackNotified: boolean("slack_notified").default(false),
  slackChannelId: text("slack_channel_id"),
  slackMessageTs: text("slack_message_ts"),

  // 處理資訊
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),

  // 時間戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const alertsRelations = relations(alerts, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [alerts.opportunityId],
    references: [opportunities.id],
  }),
  conversation: one(conversations, {
    fields: [alerts.conversationId],
    references: [conversations.id],
  }),
  user: one(user, {
    fields: [alerts.userId],
    references: [user.id],
  }),
}));

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
