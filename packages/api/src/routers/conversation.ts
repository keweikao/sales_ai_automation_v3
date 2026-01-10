/**
 * Conversation API Router
 * Handles audio upload, transcription, and MEDDIC analysis
 */

import { db } from "@Sales_ai_automation_v3/db/client";
import {
  conversations,
  leads,
  meddicAnalyses,
} from "@Sales_ai_automation_v3/db/schema";
import {
  createAllServices,
  generateAudioKey,
  type TranscriptSegment as ServiceTranscriptSegment,
} from "@Sales_ai_automation_v3/services";
import { ORPCError } from "@orpc/server";
import { oz } from "@orpc/zod";
import { and, desc, eq } from "drizzle-orm";
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

const uploadConversationSchema = oz.input(
  z.object({
    leadId: z.string(),
    audioBase64: z.string(), // Base64 encoded audio file
    fileName: z.string().optional(),
    metadata: z
      .object({
        duration: z.number().optional(),
        format: z.string().optional(),
        recordedAt: z.string().optional(),
      })
      .optional(),
  })
);

const analyzeConversationSchema = oz.input(
  z.object({
    conversationId: z.string(),
  })
);

const listConversationsSchema = oz.input(
  z.object({
    leadId: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
  })
);

const getConversationSchema = oz.input(
  z.object({
    conversationId: z.string(),
  })
);

// ============================================================
// Upload & Transcribe Endpoint
// ============================================================

/**
 * POST /conversations/upload
 * Upload audio file, store to R2, transcribe with Groq Whisper
 */
export const uploadConversation = protectedProcedure
  .input(uploadConversationSchema)
  .handler(async ({ input, context }) => {
    const { leadId, audioBase64, fileName, metadata } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    // Step 1: Verify lead exists and belongs to user
    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.userId, userId)),
    });

    if (!lead) {
      throw new ORPCError("NOT_FOUND", "Lead not found");
    }

    // Step 2: Decode audio buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Step 3: Upload to R2
    const { r2, whisper } = getServices();
    const audioKey = generateAudioKey(leadId, Date.now().toString());

    let audioUrl: string;
    try {
      audioUrl = await r2.uploadAudio(audioKey, audioBuffer, {
        duration: metadata?.duration,
        format: metadata?.format || "mp3",
        conversationId: "", // Will be set after DB insert
        leadId,
      });
    } catch (error) {
      console.error("R2 upload failed:", error);
      throw new ORPCError(
        "INTERNAL_SERVER_ERROR",
        `Failed to upload audio: ${(error as Error).message}`
      );
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
        language: "zh", // Chinese default
        chunkIfNeeded: true,
      });
    } catch (error) {
      console.error("Transcription failed:", error);
      // Clean up uploaded file if transcription fails
      await r2.delete(audioKey).catch(console.error);
      throw new ORPCError(
        "INTERNAL_SERVER_ERROR",
        `Transcription failed: ${(error as Error).message}`
      );
    }

    // Step 5: Store in database
    const [conversation] = await db
      .insert(conversations)
      .values({
        leadId,
        audioUrl,
        transcript: {
          fullText: transcriptResult.fullText,
          language: transcriptResult.language || "zh",
          segments: transcriptResult.segments || [],
        },
        recordedAt: metadata?.recordedAt
          ? new Date(metadata.recordedAt)
          : new Date(),
        duration: transcriptResult.duration || metadata?.duration,
        status: "transcribed",
      })
      .returning();

    return {
      conversationId: conversation.id,
      audioUrl,
      transcript: {
        fullText: transcriptResult.fullText,
        segmentCount: transcriptResult.segments?.length || 0,
        language: transcriptResult.language || "zh",
      },
      status: conversation.status,
      createdAt: conversation.createdAt,
    };
  });

// ============================================================
// Analyze Endpoint
// ============================================================

/**
 * POST /conversations/:id/analyze
 * Run MEDDIC analysis on transcribed conversation
 */
export const analyzeConversation = protectedProcedure
  .input(analyzeConversationSchema)
  .handler(async ({ input, context }) => {
    const { conversationId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    // Step 1: Get conversation and verify ownership
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        lead: true,
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND", "Conversation not found");
    }

    if (conversation.lead.userId !== userId) {
      throw new ORPCError("FORBIDDEN", "Access denied");
    }

    if (conversation.status !== "transcribed") {
      throw new ORPCError(
        "BAD_REQUEST",
        `Conversation must be transcribed first. Current status: ${conversation.status}`
      );
    }

    // Step 2: Prepare transcript for analysis
    const transcript = conversation.transcript as {
      segments: Array<{ start: number; end: number; text: string }>;
      fullText: string;
      language: string;
    };

    const transcriptSegments: ServiceTranscriptSegment[] =
      transcript.segments.map((s) => ({
        speaker: "unknown", // V2 uses speaker diarization
        text: s.text,
        start: s.start,
        end: s.end,
      }));

    // Step 3: Run MEDDIC analysis
    const { orchestrator } = getServices();

    let analysisResult;
    try {
      analysisResult = await orchestrator.analyze(transcriptSegments, {
        conversationId: conversation.id,
        leadId: conversation.leadId,
        recordedAt: conversation.recordedAt || new Date(),
      });
    } catch (error) {
      console.error("MEDDIC analysis failed:", error);
      throw new ORPCError(
        "INTERNAL_SERVER_ERROR",
        `Analysis failed: ${(error as Error).message}`
      );
    }

    // Step 4: Store analysis results
    const [analysis] = await db
      .insert(meddicAnalyses)
      .values({
        conversationId: conversation.id,
        leadId: conversation.leadId,
        scores: {
          metrics: analysisResult.scores.metrics,
          economicBuyer: analysisResult.scores.economicBuyer,
          decisionCriteria: analysisResult.scores.decisionCriteria,
          decisionProcess: analysisResult.scores.decisionProcess,
          identifyPain: analysisResult.scores.identifyPain,
          champion: analysisResult.scores.champion,
        },
        overallScore: analysisResult.overallScore,
        qualificationStatus: analysisResult.qualificationStatus,
        dimensions: analysisResult.dimensions,
        summary: analysisResult.summary,
        contextData: analysisResult.contextData || {},
        buyerData: analysisResult.buyerData || {},
        sellerData: analysisResult.sellerData || {},
        crmRecommendations: analysisResult.crmRecommendations || {},
        coachingInsights: analysisResult.coachingInsights || {},
        hasCompetitor: analysisResult.hasCompetitor,
        competitorKeywords: analysisResult.competitorKeywords || [],
      })
      .returning();

    // Step 5: Update conversation status
    await db
      .update(conversations)
      .set({ status: "analyzed" })
      .where(eq(conversations.id, conversationId));

    return {
      analysisId: analysis.id,
      overallScore: analysis.overallScore,
      qualificationStatus: analysis.qualificationStatus,
      scores: analysis.scores,
      hasCompetitor: analysis.hasCompetitor,
      summary: analysis.summary,
      createdAt: analysis.createdAt,
    };
  });

// ============================================================
// List & Detail Endpoints
// ============================================================

/**
 * GET /conversations
 * List all conversations (optionally filtered by leadId)
 */
export const listConversations = protectedProcedure
  .input(listConversationsSchema)
  .handler(async ({ input, context }) => {
    const { leadId, limit, offset } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    // Build query conditions
    const conditions = [eq(leads.userId, userId)];
    if (leadId) {
      conditions.push(eq(conversations.leadId, leadId));
    }

    const results = await db
      .select({
        id: conversations.id,
        leadId: conversations.leadId,
        leadName: leads.name,
        audioUrl: conversations.audioUrl,
        status: conversations.status,
        duration: conversations.duration,
        recordedAt: conversations.recordedAt,
        createdAt: conversations.createdAt,
        hasAnalysis: meddicAnalyses.id,
      })
      .from(conversations)
      .innerJoin(leads, eq(conversations.leadId, leads.id))
      .leftJoin(
        meddicAnalyses,
        eq(meddicAnalyses.conversationId, conversations.id)
      )
      .where(and(...conditions))
      .orderBy(desc(conversations.recordedAt))
      .limit(limit)
      .offset(offset);

    return {
      conversations: results.map((r) => ({
        id: r.id,
        leadId: r.leadId,
        leadName: r.leadName,
        audioUrl: r.audioUrl,
        status: r.status,
        duration: r.duration,
        recordedAt: r.recordedAt,
        createdAt: r.createdAt,
        hasAnalysis: !!r.hasAnalysis,
      })),
      total: results.length,
      limit,
      offset,
    };
  });

/**
 * GET /conversations/:id
 * Get conversation details with transcript and analysis
 */
export const getConversation = protectedProcedure
  .input(getConversationSchema)
  .handler(async ({ input, context }) => {
    const { conversationId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        lead: true,
        meddicAnalyses: {
          orderBy: desc(meddicAnalyses.createdAt),
          limit: 1,
        },
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND", "Conversation not found");
    }

    if (conversation.lead.userId !== userId) {
      throw new ORPCError("FORBIDDEN", "Access denied");
    }

    return {
      id: conversation.id,
      leadId: conversation.leadId,
      leadName: conversation.lead.name,
      audioUrl: conversation.audioUrl,
      transcript: conversation.transcript,
      status: conversation.status,
      duration: conversation.duration,
      recordedAt: conversation.recordedAt,
      createdAt: conversation.createdAt,
      analysis: conversation.meddicAnalyses[0] || null,
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
};
