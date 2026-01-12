import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Lead Sources - 潛客來源定義
 * 追蹤不同的獲客管道（如 Squarespace, Manual, Import 等）
 */
export const leadSources = pgTable("lead_sources", {
  id: text("id").primaryKey(),

  // 來源基本資訊
  name: text("name").notNull(), // e.g., "Squarespace 表單", "手動輸入"
  type: text("type").notNull(), // squarespace, manual, import, api, referral
  description: text("description"),

  // 來源設定
  isActive: text("is_active").notNull().default("true"),
  webhookUrl: text("webhook_url"), // 用於 webhook 類型
  webhookSecret: text("webhook_secret"), // webhook 簽名密鑰

  // 欄位映射設定（用於自動解析表單）
  fieldMapping: jsonb("field_mapping").$type<{
    companyName?: string; // 表單中對應公司名稱的欄位
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
  }>(),

  // 統計
  totalLeads: integer("total_leads").default(0),
  lastLeadAt: timestamp("last_lead_at"),

  // 擁有者
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),

  // 時間戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * UTM Campaigns - UTM 活動追蹤
 * 追蹤各行銷活動的效果
 */
export const utmCampaigns = pgTable("utm_campaigns", {
  id: text("id").primaryKey(),

  // UTM 參數組合
  utmSource: text("utm_source").notNull(), // google, facebook, linkedin
  utmMedium: text("utm_medium"), // cpc, email, social
  utmCampaign: text("utm_campaign"), // spring_sale_2026
  utmTerm: text("utm_term"), // 付費搜尋關鍵字
  utmContent: text("utm_content"), // 區分不同廣告/連結

  // 活動資訊
  name: text("name"), // 活動名稱（人類可讀）
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  // 統計
  totalLeads: integer("total_leads").default(0),
  totalConversions: integer("total_conversions").default(0),
  conversionRate: text("conversion_rate"), // 存為百分比字串，如 "12.5"

  // 成本追蹤（選填）
  budget: integer("budget"), // 預算（分）
  spent: integer("spent"), // 已花費（分）
  costPerLead: integer("cost_per_lead"), // 每潛客成本（分）

  // 擁有者
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),

  // 時間戳
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Form Submissions - 表單提交紀錄
 * 保存所有表單提交的原始資料，用於除錯和重新處理
 */
export const formSubmissions = pgTable("form_submissions", {
  id: text("id").primaryKey(),

  // 來源
  sourceId: text("source_id").references(() => leadSources.id),
  sourceType: text("source_type").notNull(), // squarespace, typeform, etc.

  // 原始資料
  rawPayload: jsonb("raw_payload").notNull(), // 完整的原始 webhook payload
  parsedData: jsonb("parsed_data"), // 解析後的資料

  // 處理狀態
  status: text("status").notNull().default("pending"), // pending, processed, failed, duplicate
  errorMessage: text("error_message"),

  // 關聯
  opportunityId: text("opportunity_id"), // 建立的商機 ID

  // 追蹤資訊
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  // 時間戳
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const leadSourcesRelations = relations(leadSources, ({ one }) => ({
  user: one(user, {
    fields: [leadSources.userId],
    references: [user.id],
  }),
}));

export const utmCampaignsRelations = relations(utmCampaigns, ({ one }) => ({
  user: one(user, {
    fields: [utmCampaigns.userId],
    references: [user.id],
  }),
}));

export const formSubmissionsRelations = relations(
  formSubmissions,
  ({ one }) => ({
    source: one(leadSources, {
      fields: [formSubmissions.sourceId],
      references: [leadSources.id],
    }),
  })
);

// Types
export type LeadSource = typeof leadSources.$inferSelect;
export type NewLeadSource = typeof leadSources.$inferInsert;

export type UTMCampaign = typeof utmCampaigns.$inferSelect;
export type NewUTMCampaign = typeof utmCampaigns.$inferInsert;

export type FormSubmission = typeof formSubmissions.$inferSelect;
export type NewFormSubmission = typeof formSubmissions.$inferInsert;
