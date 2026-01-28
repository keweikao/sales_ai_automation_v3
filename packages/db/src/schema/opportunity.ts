import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { conversations } from "./conversation";

export const opportunities = pgTable("opportunities", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Product line (多產品線支援)
  productLine: text("product_line").default("ichef").notNull(),

  // Salesforce integration
  customerNumber: text("customer_number").notNull().unique(), // Opportunity UUID from Salesforce, e.g. "201700-000001"

  // Basic info
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),

  // Opportunity source and status
  source: text("source").notNull().default("manual"), // manual, import, api, referral
  status: text("status").notNull().default("new"), // new, contacted, qualified, proposal, negotiation, won, lost

  // UTM tracking (Phase 5 Lead Source)
  utmSource: text("utm_source"), // e.g., google, facebook, linkedin
  utmMedium: text("utm_medium"), // e.g., cpc, email, social
  utmCampaign: text("utm_campaign"), // e.g., spring_sale_2026
  utmTerm: text("utm_term"), // paid search keywords
  utmContent: text("utm_content"), // differentiates ads/links

  // Source attribution
  sourceId: text("source_id"), // Reference to lead_sources.id
  landingPage: text("landing_page"), // URL where the lead first landed
  referrer: text("referrer"), // HTTP referrer
  firstTouchAt: timestamp("first_touch_at"), // When the lead first touched the site
  rawFormData: jsonb("raw_form_data"), // Original form submission data

  // Scoring
  opportunityScore: integer("opportunity_score"), // 0-100
  meddicScore: jsonb("meddic_score").$type<{
    overall: number;
    dimensions: {
      metrics: number;
      economicBuyer: number;
      decisionCriteria: number;
      decisionProcess: number;
      identifyPain: number;
      champion: number;
    };
  }>(),

  // Additional info
  industry: text("industry"),
  companySize: text("company_size"),
  notes: text("notes"),

  // Close Case 相關
  rejectionReason: text("rejection_reason"), // 拒絕/失敗原因
  selectedCompetitor: text("selected_competitor"), // 客戶選擇的競品

  // Product-Specific Business Context
  storeType: text("store_type"),
  serviceType: text("service_type"),
  staffCount: text("staff_count"),
  currentSystem: text("current_system"),
  decisionMakerPresent: text("decision_maker_present"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastContactedAt: timestamp("last_contacted_at"),
});

// Relations
export const opportunitiesRelations = relations(
  opportunities,
  ({ one, many }) => ({
    user: one(user, {
      fields: [opportunities.userId],
      references: [user.id],
    }),
    conversations: many(conversations),
  })
);

export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
