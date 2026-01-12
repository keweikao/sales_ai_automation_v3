/**
 * Sales Coach Agent API Router
 * Handles AI-powered sales coaching, recommendations, and analysis
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  opportunities,
  talkTracks,
} from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const analyzeConversationSchema = z.object({
  conversationId: z.string(),
  scenario: z
    .enum(["post_demo", "close_now", "general"])
    .optional()
    .default("general"),
});

const getRecommendationsSchema = z.object({
  conversationId: z.string(),
  limit: z.number().min(1).max(20).default(5),
});

const getTalkTracksSchema = z.object({
  situation: z.string().optional(),
  category: z
    .enum([
      "objection_handling",
      "discovery",
      "closing",
      "follow_up",
      "value_prop",
    ])
    .optional(),
  limit: z.number().min(1).max(20).default(10),
});

const scheduleFollowUpSchema = z.object({
  opportunityId: z.string(),
  timing: z.enum(["2_hours", "tomorrow_9am", "3_days", "1_week"]),
  channel: z.enum(["slack_dm", "slack_channel"]),
  message: z.string().min(1),
  talkTrackId: z.string().optional(),
});

const coachRequestSchema = z.object({
  conversationId: z.string(),
  question: z.string().min(1).max(500),
});

// ============================================================
// Analyze Conversation with Sales Coach Agent
// ============================================================

export const analyzeConversation = protectedProcedure
  .input(analyzeConversationSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;
    const { conversationId, scenario } = input;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 驗證對話存在且屬於使用者
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        opportunity: true,
        meddicAnalysis: true,
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND", { message: "對話不存在" });
    }

    if (conversation.opportunity?.userId !== userId) {
      throw new ORPCError("FORBIDDEN", { message: "無權存取此對話" });
    }

    // TODO: 整合 SalesCoachAgent 進行分析
    // const agent = createSalesCoachAgent();
    // const result = await agent.analyze({ conversationId, scenario });

    return {
      conversationId,
      scenario,
      analysis: {
        summary: "對話分析功能開發中",
        recommendations: [],
        talkTracks: [],
        alerts: [],
        followUps: [],
      },
      meddicScore: conversation.meddicAnalysis?.overallScore ?? null,
      createdAt: new Date().toISOString(),
    };
  });

// ============================================================
// Get Recommendations for Conversation
// ============================================================

export const getRecommendations = protectedProcedure
  .input(getRecommendationsSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;
    const { conversationId, limit } = input;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 驗證對話存在且屬於使用者
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        opportunity: true,
        meddicAnalysis: true,
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND", { message: "對話不存在" });
    }

    if (conversation.opportunity?.userId !== userId) {
      throw new ORPCError("FORBIDDEN", { message: "無權存取此對話" });
    }

    // TODO: 從 Agent 取得建議
    // const recommendations = await agent.getRecommendations(conversationId, limit);

    return {
      conversationId,
      recommendations: [],
      generatedAt: new Date().toISOString(),
    };
  });

// ============================================================
// Get Talk Tracks
// ============================================================

export const getTalkTracksHandler = protectedProcedure
  .input(getTalkTracksSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;
    const { situation, category, limit } = input;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 建立查詢條件
    const conditions = [eq(talkTracks.isActive, true)];

    if (category) {
      conditions.push(eq(talkTracks.category, category));
    }

    // 查詢話術
    const tracks = await db
      .select()
      .from(talkTracks)
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(desc(talkTracks.successRate))
      .limit(limit);

    // TODO: 如果有 situation，使用向量搜尋找最相關的話術
    // const similarTracks = await querySimilarCases({ situation });

    return {
      talkTracks: tracks.map((track) => ({
        id: track.id,
        situation: track.situation,
        content: track.content,
        category: track.category,
        successRate: track.successRate,
      })),
      total: tracks.length,
    };
  });

// ============================================================
// Schedule Follow Up
// ============================================================

export const scheduleFollowUp = protectedProcedure
  .input(scheduleFollowUpSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;
    const { opportunityId, timing, channel, message, talkTrackId } = input;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 驗證商機存在且屬於使用者
    const opportunity = await db.query.opportunities.findFirst({
      where: eq(opportunities.id, opportunityId),
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND", { message: "商機不存在" });
    }

    if (opportunity.userId !== userId) {
      throw new ORPCError("FORBIDDEN", { message: "無權存取此商機" });
    }

    // 計算排程時間
    const scheduledAt = calculateScheduledTime(timing);

    // TODO: 使用 schedule-follow-up tool 建立跟進
    // const followUp = await scheduleFollowUpTool.execute({
    //   userId, opportunityId, timing, channel, message, talkTrackId
    // });

    return {
      success: true,
      followUpId: `followup_${Date.now()}`,
      scheduledAt: scheduledAt.toISOString(),
      channel,
      message,
    };
  });

// ============================================================
// Ask Coach (Interactive Q&A)
// ============================================================

export const askCoach = protectedProcedure
  .input(coachRequestSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;
    const { conversationId, question } = input;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 驗證對話存在且屬於使用者
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        opportunity: true,
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND", { message: "對話不存在" });
    }

    if (conversation.opportunity?.userId !== userId) {
      throw new ORPCError("FORBIDDEN", { message: "無權存取此對話" });
    }

    // TODO: 使用 SalesCoachAgent 回答問題
    // const response = await agent.askQuestion(conversationId, question);

    return {
      conversationId,
      question,
      answer: "Sales Coach 問答功能開發中，敬請期待！",
      relatedTalkTracks: [],
      suggestedActions: [],
      answeredAt: new Date().toISOString(),
    };
  });

// ============================================================
// Helper Functions
// ============================================================

function calculateScheduledTime(
  timing: "2_hours" | "tomorrow_9am" | "3_days" | "1_week"
): Date {
  const now = new Date();

  switch (timing) {
    case "2_hours":
      return new Date(now.getTime() + 2 * 60 * 60 * 1000);
    case "tomorrow_9am": {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }
    case "3_days":
      return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    case "1_week":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

// ============================================================
// Router Export
// ============================================================

export const agentRouter = {
  analyze: analyzeConversation,
  recommendations: getRecommendations,
  talkTracks: getTalkTracksHandler,
  scheduleFollowUp,
  ask: askCoach,
};
