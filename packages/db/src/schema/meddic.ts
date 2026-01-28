import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { conversations } from "./conversation";
import { opportunities } from "./opportunity";

export const meddicAnalyses = pgTable("meddic_analyses", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  opportunityId: text("opportunity_id")
    .notNull()
    .references(() => opportunities.id),

  // Product line (多產品線支援)
  productLine: text("product_line").default("ichef").notNull(),

  // MEDDIC dimension scores (1-5)
  metricsScore: integer("metrics_score"),
  economicBuyerScore: integer("economic_buyer_score"),
  decisionCriteriaScore: integer("decision_criteria_score"),
  decisionProcessScore: integer("decision_process_score"),
  identifyPainScore: integer("identify_pain_score"),
  championScore: integer("champion_score"),

  // Overall score
  overallScore: integer("overall_score"), // 1-100 (weighted)
  status: text("status"), // Strong, Medium, Weak, At Risk

  // Detailed analysis
  dimensions:
    jsonb("dimensions").$type<
      Record<
        string,
        {
          evidence: string[];
          gaps: string[];
          recommendations: string[];
        }
      >
    >(),
  keyFindings: jsonb("key_findings").$type<string[]>(),
  nextSteps:
    jsonb("next_steps").$type<
      Array<{
        action: string;
        priority: string;
        owner?: string;
      }>
    >(),
  risks:
    jsonb("risks").$type<
      Array<{
        risk: string;
        severity: string;
        mitigation?: string;
      }>
    >(),

  // 【新增】競品分析結果
  competitorAnalysis: jsonb("competitor_analysis").$type<{
    detectedCompetitors: Array<{
      name: string;
      customerQuote: string;
      attitude: "positive" | "negative" | "neutral";
      threatLevel: "high" | "medium" | "low";
      ourAdvantages: string[];
      suggestedTalkTracks: string[];
    }>;
    overallThreatLevel: "high" | "medium" | "low" | "none";
    handlingScore?: number; // 業務應對分數 (1-5)
  }>(),

  // V2 Agent outputs (preserved for future analysis)
  agentOutputs: jsonb("agent_outputs").$type<{
    agent1?: Record<string, unknown>; // Context Agent
    agent2?: Record<string, unknown>; // Buyer Agent
    agent3?: Record<string, unknown>; // Seller Agent
    agent4?: Record<string, unknown>; // Summary Agent
    agent5?: Record<string, unknown>; // CRM Extractor
    agent6?: Record<string, unknown>; // Coach Agent
  }>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const meddicAnalysesRelations = relations(meddicAnalyses, ({ one }) => ({
  conversation: one(conversations, {
    fields: [meddicAnalyses.conversationId],
    references: [conversations.id],
  }),
  opportunity: one(opportunities, {
    fields: [meddicAnalyses.opportunityId],
    references: [opportunities.id],
  }),
}));

export type MeddicAnalysis = typeof meddicAnalyses.$inferSelect;
export type NewMeddicAnalysis = typeof meddicAnalyses.$inferInsert;
