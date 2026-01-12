/**
 * Conversation API Router
 * Handles audio upload, transcription, and MEDDIC analysis
 */

import { db, generateCaseNumberFromDate } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
} from "@Sales_ai_automation_v3/db/schema";
import {
  createAllServices,
  evaluateAndCreateAlerts,
  generateAudioKey,
  type TranscriptSegment as ServiceTranscriptSegment,
} from "@Sales_ai_automation_v3/services";
import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// Initialize services (lazy loaded)
let services: ReturnType<typeof createAllServices> | null = null;
function getServices() {
  if (!services) {
    services = createAllServices();
  }
  return services;
}

// ============================================================
// Schemas
// ============================================================

const uploadConversationSchema = z.object({
  opportunityId: z.string(),
  audioBase64: z.string(),
  title: z.string().optional(),
  type: z
    .enum([
      "discovery_call",
      "demo",
      "follow_up",
      "negotiation",
      "closing",
      "support",
    ])
    .default("discovery_call"),
  metadata: z
    .object({
      duration: z.number().optional(),
      format: z.string().optional(),
      conversationDate: z.string().optional(),
    })
    .optional(),
  // Slack 業務資訊（可選，從 Slack Bot 傳入）
  slackUser: z
    .object({
      id: z.string(),
      username: z.string(),
    })
    .optional(),
});

const analyzeConversationSchema = z.object({
  conversationId: z.string(),
});

const listConversationsSchema = z.object({
  opportunityId: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const getConversationSchema = z.object({
  conversationId: z.string(),
});

const updateSummarySchema = z.object({
  conversationId: z.string(),
  summary: z.string().min(1, "Summary cannot be empty"),
});

// ============================================================
// Helper: Generate next case number
// ============================================================

async function getNextCaseNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const yearMonth = `${year}${month}`;
  const prefix = `${yearMonth}-IC`;

  // Get the highest sequence number for this month
  const result = await db
    .select({ caseNumber: conversations.caseNumber })
    .from(conversations)
    .where(sql`${conversations.caseNumber} LIKE ${prefix + "%"}`)
    .orderBy(desc(conversations.caseNumber))
    .limit(1);

  let nextSequence = 1;
  const firstResult = result[0];
  if (result.length > 0 && firstResult?.caseNumber) {
    const match = firstResult.caseNumber.match(/-IC(\d+)$/);
    if (match?.[1]) {
      nextSequence = Number.parseInt(match[1], 10) + 1;
    }
  }

  return generateCaseNumberFromDate(nextSequence);
}

// ============================================================
// Upload & Transcribe Endpoint
// ============================================================

export const uploadConversation = protectedProcedure
  .input(uploadConversationSchema)
  .handler(async ({ input, context }) => {
    const { opportunityId, audioBase64, title, type, metadata, slackUser } =
      input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // Step 1: Verify opportunity exists and belongs to user
    const opportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.userId, userId)
      ),
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    // Step 2: Decode audio buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Step 3: Upload to R2
    const { r2, whisper } = getServices();
    const audioKey = generateAudioKey(opportunityId, Date.now().toString());

    let audioUrl: string;
    try {
      audioUrl = await r2.uploadAudio(audioKey, audioBuffer, {
        duration: metadata?.duration,
        format: metadata?.format || "mp3",
        conversationId: "",
        leadId: opportunityId,
      });
    } catch (error) {
      console.error("R2 upload failed:", error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // Step 4: Transcribe with Groq Whisper
    let transcriptResult: {
      fullText: string;
      segments?: Array<{ start: number; end: number; text: string }>;
      duration?: number;
      language?: string;
    };

    try {
      transcriptResult = await whisper.transcribe(audioBuffer, {
        language: "zh",
        chunkIfNeeded: true,
      });
    } catch (error) {
      console.error("Transcription failed:", error);
      await r2.delete(audioKey).catch(console.error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // Step 5: Generate case number
    const caseNumber = await getNextCaseNumber();

    // Step 6: Store in database
    const conversationResults = await db
      .insert(conversations)
      .values({
        id: randomUUID(),
        opportunityId,
        caseNumber,
        title: title || `對話 - ${new Date().toLocaleDateString("zh-TW")}`,
        type,
        status: "transcribed",
        audioUrl,
        transcript: {
          fullText: transcriptResult.fullText,
          language: transcriptResult.language || "zh",
          segments: (transcriptResult.segments || []).map((s) => ({
            speaker: "unknown",
            text: s.text,
            start: s.start,
            end: s.end,
          })),
        },
        duration: transcriptResult.duration || metadata?.duration,
        conversationDate: metadata?.conversationDate
          ? new Date(metadata.conversationDate)
          : new Date(),
        createdBy: userId,
        // Slack 業務資訊
        slackUserId: slackUser?.id,
        slackUsername: slackUser?.username,
      })
      .returning();

    const insertedConversation = conversationResults[0];
    if (!insertedConversation) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      conversationId: insertedConversation.id,
      caseNumber: insertedConversation.caseNumber,
      audioUrl,
      transcript: {
        fullText: transcriptResult.fullText,
        segmentCount: transcriptResult.segments?.length || 0,
        language: transcriptResult.language || "zh",
      },
      status: insertedConversation.status,
      createdAt: insertedConversation.createdAt,
    };
  });

// ============================================================
// Analyze Endpoint
// ============================================================

export const analyzeConversation = protectedProcedure
  .input(analyzeConversationSchema)
  .handler(async ({ input, context }) => {
    const { conversationId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // Step 1: Get conversation and verify ownership
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        opportunity: true,
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND");
    }

    if (conversation.opportunity.userId !== userId) {
      throw new ORPCError("FORBIDDEN");
    }

    if (conversation.status !== "transcribed") {
      throw new ORPCError("BAD_REQUEST");
    }

    // Step 2: Prepare transcript for analysis
    const transcript = conversation.transcript as {
      segments: Array<{
        speaker: string;
        text: string;
        start: number;
        end: number;
      }>;
      fullText: string;
      language: string;
    };

    const transcriptSegments: ServiceTranscriptSegment[] =
      transcript.segments.map((s) => ({
        speaker: s.speaker || "unknown",
        text: s.text,
        start: s.start,
        end: s.end,
      }));

    // Step 3: Run MEDDIC analysis
    const { orchestrator } = getServices();

    let analysisResult;
    try {
      analysisResult = await orchestrator.analyze(transcriptSegments, {
        leadId: conversation.opportunityId,
        conversationId: conversation.id,
        salesRep: "unknown",
        conversationDate: new Date(),
      });
    } catch (error) {
      console.error("MEDDIC analysis failed:", error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // Step 4: Store analysis results
    const analysisResults = await db
      .insert(meddicAnalyses)
      .values({
        id: randomUUID(),
        conversationId: conversation.id,
        opportunityId: conversation.opportunityId,
        metricsScore: analysisResult.meddicScores?.metrics,
        economicBuyerScore: analysisResult.meddicScores?.economicBuyer,
        decisionCriteriaScore: analysisResult.meddicScores?.decisionCriteria,
        decisionProcessScore: analysisResult.meddicScores?.decisionProcess,
        identifyPainScore: analysisResult.meddicScores?.identifyPain,
        championScore: analysisResult.meddicScores?.champion,
        overallScore: analysisResult.overallScore,
        status: analysisResult.qualificationStatus,
        dimensions: analysisResult.dimensions as unknown as Record<
          string,
          { evidence: string[]; gaps: string[]; recommendations: string[] }
        >,
        keyFindings: analysisResult.keyFindings || [],
        nextSteps: (analysisResult.nextSteps || []).map((step) => ({
          action: step.action,
          priority: "Medium",
          owner: step.owner,
        })),
        risks: analysisResult.risks || [],
        agentOutputs: analysisResult.agentOutputs as unknown as {
          agent1?: Record<string, unknown>;
          agent2?: Record<string, unknown>;
          agent3?: Record<string, unknown>;
          agent4?: Record<string, unknown>;
          agent5?: Record<string, unknown>;
          agent6?: Record<string, unknown>;
        },
      })
      .returning();

    const analysis = analysisResults[0];
    if (!analysis) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // Step 5: Update conversation status
    await db
      .update(conversations)
      .set({
        status: "completed",
        meddicAnalysis: {
          overallScore: analysisResult.overallScore,
          status: analysisResult.qualificationStatus,
          dimensions: analysisResult.dimensions as unknown as Record<
            string,
            unknown
          >,
        },
        analyzedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    // Step 6: Evaluate and create alerts based on analysis
    try {
      const alerts = await evaluateAndCreateAlerts(
        conversation.opportunityId,
        conversation.id,
        userId
      );

      if (alerts.length > 0) {
        console.log(
          `Created ${alerts.length} alert(s) for conversation ${conversationId}`
        );
      }
    } catch (alertError) {
      // Log but don't fail the request if alert creation fails
      console.error("Alert evaluation failed:", alertError);
    }

    return {
      analysisId: analysis.id,
      overallScore: analysis.overallScore,
      status: analysis.status,
      scores: {
        metrics: analysis.metricsScore,
        economicBuyer: analysis.economicBuyerScore,
        decisionCriteria: analysis.decisionCriteriaScore,
        decisionProcess: analysis.decisionProcessScore,
        identifyPain: analysis.identifyPainScore,
        champion: analysis.championScore,
      },
      createdAt: analysis.createdAt,
    };
  });

// ============================================================
// List & Detail Endpoints
// ============================================================

export const listConversations = protectedProcedure
  .input(listConversationsSchema)
  .handler(async ({ input, context }) => {
    const { opportunityId, limit, offset } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const conditions = [eq(opportunities.userId, userId)];
    if (opportunityId) {
      conditions.push(eq(conversations.opportunityId, opportunityId));
    }

    const results = await db
      .select({
        id: conversations.id,
        opportunityId: conversations.opportunityId,
        opportunityCompanyName: opportunities.companyName,
        customerNumber: opportunities.customerNumber,
        caseNumber: conversations.caseNumber,
        title: conversations.title,
        type: conversations.type,
        status: conversations.status,
        audioUrl: conversations.audioUrl,
        duration: conversations.duration,
        conversationDate: conversations.conversationDate,
        createdAt: conversations.createdAt,
        hasAnalysis: meddicAnalyses.id,
      })
      .from(conversations)
      .innerJoin(
        opportunities,
        eq(conversations.opportunityId, opportunities.id)
      )
      .leftJoin(
        meddicAnalyses,
        eq(meddicAnalyses.conversationId, conversations.id)
      )
      .where(and(...conditions))
      .orderBy(desc(conversations.conversationDate))
      .limit(limit)
      .offset(offset);

    return {
      conversations: results.map((r) => ({
        id: r.id,
        opportunityId: r.opportunityId,
        opportunityCompanyName: r.opportunityCompanyName,
        customerNumber: r.customerNumber,
        caseNumber: r.caseNumber,
        title: r.title,
        type: r.type,
        status: r.status,
        audioUrl: r.audioUrl,
        duration: r.duration,
        conversationDate: r.conversationDate,
        createdAt: r.createdAt,
        hasAnalysis: !!r.hasAnalysis,
      })),
      total: results.length,
      limit,
      offset,
    };
  });

export const getConversation = protectedProcedure
  .input(getConversationSchema)
  .handler(async ({ input, context }) => {
    const { conversationId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        opportunity: true,
        meddicAnalyses: {
          orderBy: desc(meddicAnalyses.createdAt),
          limit: 1,
        },
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND");
    }

    if (conversation.opportunity.userId !== userId) {
      throw new ORPCError("FORBIDDEN");
    }

    return {
      id: conversation.id,
      opportunityId: conversation.opportunityId,
      opportunityCompanyName: conversation.opportunity.companyName,
      customerNumber: conversation.opportunity.customerNumber,
      caseNumber: conversation.caseNumber,
      title: conversation.title,
      type: conversation.type,
      status: conversation.status,
      audioUrl: conversation.audioUrl,
      transcript: conversation.transcript,
      summary: conversation.summary,
      duration: conversation.duration,
      conversationDate: conversation.conversationDate,
      createdAt: conversation.createdAt,
      analyzedAt: conversation.analyzedAt,
      analysis: conversation.meddicAnalyses[0] || null,
    };
  });

// ============================================================
// Update Summary Endpoint
// ============================================================

export const updateSummary = protectedProcedure
  .input(updateSummarySchema)
  .handler(async ({ input, context }) => {
    const { conversationId, summary } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // Verify conversation exists and user has access
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        opportunity: true,
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND");
    }

    if (conversation.opportunity.userId !== userId) {
      throw new ORPCError("FORBIDDEN");
    }

    // Update summary
    await db
      .update(conversations)
      .set({
        summary,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return {
      success: true,
      conversationId,
    };
  });

// ============================================================
// Router Export
// ============================================================

export const conversationRouter = {
  upload: uploadConversation,
  analyze: analyzeConversation,
  list: listConversations,
  get: getConversation,
  updateSummary,
};
