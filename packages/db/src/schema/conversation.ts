import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { meddicAnalyses } from "./meddic";
import { opportunities } from "./opportunity";

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  opportunityId: text("opportunity_id")
    .notNull()
    .references(() => opportunities.id),

  // Case tracking
  caseNumber: text("case_number").unique(), // Auto-generated case number, e.g. "202601-IC046"

  // Basic info
  title: text("title"),
  type: text("type").notNull(), // discovery_call, demo, follow_up, negotiation, closing, support
  status: text("status").notNull().default("pending"), // pending, transcribing, analyzing, completed, failed

  // Content
  audioUrl: text("audio_url"),
  transcript: jsonb("transcript").$type<{
    segments: Array<{
      speaker: string;
      text: string;
      start: number;
      end: number;
    }>;
    fullText: string;
    language: string;
  }>(),
  summary: text("summary"),

  // Analysis results
  meddicAnalysis: jsonb("meddic_analysis").$type<{
    overallScore: number;
    status: string;
    dimensions: Record<string, unknown>;
  }>(),
  extractedData: jsonb("extracted_data"),
  sentiment: text("sentiment"), // positive, neutral, negative

  // V2 fields (preserved for Firestore migration)
  progressScore: integer("progress_score"),
  coachingNotes: text("coaching_notes"),
  urgencyLevel: text("urgency_level"), // high, medium, low
  storeName: text("store_name"),

  // Slack integration
  slackChannelId: text("slack_channel_id"),
  slackThreadTs: text("slack_thread_ts"),

  // Time
  duration: integer("duration"), // seconds
  conversationDate: timestamp("conversation_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  analyzedAt: timestamp("analyzed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Participants
  participants:
    jsonb("participants").$type<
      Array<{
        name: string;
        role: string;
        company?: string;
      }>
    >(),
  createdBy: text("created_by"),
});

// Relations
export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    opportunity: one(opportunities, {
      fields: [conversations.opportunityId],
      references: [opportunities.id],
    }),
    meddicAnalyses: many(meddicAnalyses),
  })
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
