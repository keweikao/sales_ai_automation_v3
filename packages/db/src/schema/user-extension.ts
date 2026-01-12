import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

// 擴展 User 的業務欄位
export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),

  // Sales Rep 相關資訊
  role: text("role").notNull().default("sales_rep"), // sales_rep, manager, admin
  department: text("department"), // sales, marketing, support
  territory: text("territory"), // 負責區域

  // 通知偏好
  slackUserId: text("slack_user_id"), // Slack user ID for notifications
  emailNotifications: boolean("email_notifications").default(true),
  slackNotifications: boolean("slack_notifications").default(true),

  // 個人化設定
  timezone: text("timezone").default("Asia/Taipei"),
  language: text("language").default("zh-TW"),
  preferences: text("preferences"), // JSON string for additional preferences

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
