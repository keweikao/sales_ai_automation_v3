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
  createLambdaCompressor,
  createR2Service,
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

const uploadConversationSchema = z
  .object({
    opportunityId: z.string(),
    // 支援兩種方式：直接 base64 或 Slack 檔案 URL
    audioBase64: z.string().optional(),
    slackFileUrl: z.string().optional(),
    slackBotToken: z.string().optional(), // 用於下載 Slack 檔案
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
      .passthrough() // 允許額外欄位(如 storeType, serviceType 等)
      .optional(),
    // Slack 業務資訊（可選，從 Slack Bot 傳入）
    slackUser: z
      .object({
        id: z.string(),
        username: z.string(),
      })
      .optional(),
  })
  .refine(
    (data) => data.audioBase64 || data.slackFileUrl,
    "必須提供 audioBase64 或 slackFileUrl 其中之一"
  );

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
    .where(sql`${conversations.caseNumber} LIKE ${`${prefix}%`}`)
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
    const startTime = Date.now();
    const requestId = randomUUID().slice(0, 8); // 短 ID 用於追蹤

    try {
      console.log(`[${requestId}] 📥 uploadConversation request received`);
      console.log(`[${requestId}] Request details:`, {
        opportunityId: input.opportunityId,
        audioSize: input.audioBase64?.length || 0,
        hasSlackFile: !!input.slackFileUrl,
        title: input.title,
        type: input.type,
        hasSlackUser: !!input.slackUser,
        isServiceAccount: context.isServiceAccount,
      });

      const {
        opportunityId,
        audioBase64,
        slackFileUrl,
        slackBotToken,
        title,
        type,
        metadata,
        slackUser,
      } = input;
      const userId = context.session?.user.id;

      if (!userId) {
        console.error(`[${requestId}] ❌ UNAUTHORIZED: No userId in session`);
        throw new ORPCError("UNAUTHORIZED");
      }

      console.log(`[${requestId}] ✓ Auth passed, userId: ${userId}`);

      // Step 1: Verify opportunity exists and belongs to user
      console.log(`[${requestId}] 🔍 Verifying opportunity: ${opportunityId}`);
      const opportunity = await db.query.opportunities.findFirst({
        where: and(
          eq(opportunities.id, opportunityId),
          eq(opportunities.userId, userId)
        ),
      });

      if (!opportunity) {
        console.error(
          `[${requestId}] ❌ Opportunity not found: ${opportunityId}`
        );
        throw new ORPCError("NOT_FOUND");
      }

      console.log(
        `[${requestId}] ✓ Opportunity verified: ${opportunity.companyName}`
      );

      // 初始化環境變數 (從 Hono context.env 取得,不是 process.env)
      const honoEnv = context.honoContext?.env || {};
      const envRecord = honoEnv as Record<string, unknown>;

      // Step 2: Get audio buffer (從 base64 或從 Slack 下載)
      let audioBuffer: Buffer;

      if (slackFileUrl && slackBotToken) {
        // 從 Slack 下載檔案
        console.log(
          `[${requestId}] 📥 Downloading from Slack: ${slackFileUrl.substring(0, 50)}...`
        );
        const downloadStartTime = Date.now();

        try {
          const response = await fetch(slackFileUrl, {
            headers: {
              Authorization: `Bearer ${slackBotToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Slack download failed: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = Buffer.from(arrayBuffer);
          console.log(
            `[${requestId}] ✓ Downloaded from Slack in ${Date.now() - downloadStartTime}ms: ${audioBuffer.length} bytes`
          );
        } catch (error) {
          console.error(`[${requestId}] ❌ Slack download failed:`, error);
          console.error(`[${requestId}] Error details:`, {
            name: error instanceof Error ? error.name : "Unknown",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: `Failed to download from Slack: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      } else if (audioBase64) {
        // 從 base64 解碼
        console.log(`[${requestId}] 🔄 Decoding base64...`);
        audioBuffer = Buffer.from(audioBase64, "base64");
        console.log(
          `[${requestId}] ✓ Base64 decoded: ${audioBuffer.length} bytes`
        );
      } else {
        console.error(`[${requestId}] ❌ No audio source provided`);
        throw new ORPCError("BAD_REQUEST");
      }

      // Step 2.5: Compress audio if enabled and file is large
      if (
        envRecord.ENABLE_AUDIO_COMPRESSION === "true" &&
        envRecord.LAMBDA_COMPRESSOR_URL
      ) {
        const fileSizeMB = audioBuffer.length / 1024 / 1024;
        const threshold = Number(envRecord.COMPRESSION_THRESHOLD_MB) || 10;

        if (fileSizeMB > threshold) {
          console.log(
            `[${requestId}] 🗜️  Audio file is ${fileSizeMB.toFixed(2)} MB, compressing...`
          );

          const compressor = createLambdaCompressor(
            envRecord.LAMBDA_COMPRESSOR_URL as string,
            {
              timeout: 60_000, // 60 秒
            }
          );

          const compressionStartTime = Date.now();
          try {
            const result = await compressor.compressFromBuffer(audioBuffer);

            if (result.success && result.compressedAudioBase64) {
              const compressedBuffer = Buffer.from(
                result.compressedAudioBase64,
                "base64"
              );
              const compressionTime = Date.now() - compressionStartTime;

              console.log(
                `[${requestId}] ✓ Compressed in ${compressionTime}ms: ${(result.originalSize! / 1024 / 1024).toFixed(2)} MB → ${(result.compressedSize! / 1024 / 1024).toFixed(2)} MB (${result.compressionRatio}% reduction)`
              );

              audioBuffer = compressedBuffer;
            } else {
              console.warn(
                `[${requestId}] ⚠️  Compression failed: ${result.error}, using original audio`
              );
              // 繼續使用原始音檔
            }
          } catch (error) {
            console.error(`[${requestId}] ❌ Compression error:`, error);
            console.warn(`[${requestId}] ⚠️  Continuing with original audio`);
            // 繼續使用原始音檔,不中斷流程
          }
        } else {
          console.log(
            `[${requestId}] ℹ️  Audio file is ${fileSizeMB.toFixed(2)} MB (< ${threshold} MB), skipping compression`
          );
        }
      }

      // Step 3: Upload to R2
      const r2 = createR2Service({
        accessKeyId: envRecord.CLOUDFLARE_R2_ACCESS_KEY as string,
        secretAccessKey: envRecord.CLOUDFLARE_R2_SECRET_KEY as string,
        endpoint: envRecord.CLOUDFLARE_R2_ENDPOINT as string,
        bucket: envRecord.CLOUDFLARE_R2_BUCKET as string,
      });
      // 不再需要 whisper service,轉錄將由 Queue Worker 處理
      const audioKey = generateAudioKey(opportunityId, Date.now().toString());

      console.log(`[${requestId}] ☁️ Uploading to R2: ${audioKey}`);
      let audioUrl: string;
      try {
        const r2StartTime = Date.now();
        audioUrl = await r2.uploadAudio(audioKey, audioBuffer, {
          duration: metadata?.duration,
          format: metadata?.format || "mp3",
          conversationId: "",
          leadId: opportunityId,
        });
        console.log(
          `[${requestId}] ✓ R2 upload completed in ${Date.now() - r2StartTime}ms`
        );
      } catch (error) {
        console.error(`[${requestId}] ❌ R2 upload failed:`, error);
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      // Step 4: Generate case number
      const caseNumber = await getNextCaseNumber();
      const conversationId = randomUUID();
      console.log(
        `[${requestId}] 🎫 Generated conversationId: ${conversationId}, caseNumber: ${caseNumber}`
      );

      // Step 5: 建立資料庫記錄 (status: "pending")
      // 不再同步轉錄,而是推送到 Queue
      console.log(
        `[${requestId}] 💾 Creating conversation record with status: pending...`
      );
      const dbStartTime = Date.now();
      const conversationResults = await db
        .insert(conversations)
        .values({
          id: conversationId,
          opportunityId,
          caseNumber,
          title: title || `對話 - ${new Date().toLocaleDateString("zh-TW")}`,
          type,
          status: "pending", // 初始狀態為 pending
          audioUrl,
          transcript: null, // 稍後由 Queue Worker 填充
          duration: metadata?.duration || 0,
          conversationDate: metadata?.conversationDate
            ? new Date(metadata.conversationDate)
            : new Date(),
          createdBy: userId,
          // Slack 業務資訊
          slackUserId: slackUser?.id,
          slackUsername: slackUser?.username,
        })
        .returning();

      console.log(
        `[${requestId}] ✓ DB insert completed in ${Date.now() - dbStartTime}ms`
      );

      const insertedConversation = conversationResults[0];
      if (!insertedConversation) {
        console.error(
          `[${requestId}] ❌ No conversation returned from DB insert`
        );
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      // Step 6: 推送到 Queue
      console.log(`[${requestId}] 📤 Pushing to transcription queue...`);

      try {
        // 確保 TRANSCRIPTION_QUEUE binding 存在
        if (!envRecord.TRANSCRIPTION_QUEUE) {
          console.error(
            `[${requestId}] ❌ TRANSCRIPTION_QUEUE binding not found`
          );
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Queue binding not configured",
          });
        }

        const queueBinding = envRecord.TRANSCRIPTION_QUEUE as any;
        await queueBinding.send({
          conversationId,
          opportunityId,
          audioUrl,
          caseNumber,
          metadata: {
            fileName: title || `audio-${Date.now()}`,
            fileSize: audioBuffer.length,
            format: metadata?.format || "unknown",
          },
          slackUser: slackUser
            ? {
                id: slackUser.id,
                username: slackUser.username,
              }
            : undefined,
        });

        console.log(`[${requestId}] ✓ Message pushed to queue successfully`);
      } catch (queueError) {
        console.error(`[${requestId}] ❌ Failed to push to queue:`, queueError);

        // 更新狀態為 failed
        await db
          .update(conversations)
          .set({
            status: "failed",
            errorMessage: "Failed to queue for processing",
          })
          .where(eq(conversations.id, conversationId));

        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: `Failed to queue conversation: ${queueError instanceof Error ? queueError.message : String(queueError)}`,
        });
      }

      const responseTime = Date.now() - startTime;
      const response = {
        conversationId: insertedConversation.id,
        caseNumber: insertedConversation.caseNumber,
        audioUrl,
        status: "pending", // 返回 pending 狀態
        message: "已接收音檔,正在處理轉錄和分析,完成後會通知您...",
        createdAt: insertedConversation.createdAt,
      };

      console.log(`[${requestId}] ✅ Request completed in ${responseTime}ms`);
      console.log(`[${requestId}] Response:`, {
        conversationId: response.conversationId,
        caseNumber: response.caseNumber,
        status: response.status,
        message: response.message,
      });

      return response;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error(
        `[${requestId}] ❌❌❌ UNHANDLED ERROR after ${errorTime}ms:`,
        error
      );
      console.error(`[${requestId}] Error type: ${error?.constructor?.name}`);
      console.error(`[${requestId}] Error details:`, {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
        stack:
          error instanceof Error
            ? error.stack?.split("\n").slice(0, 5)
            : undefined,
      });
      throw error; // Re-throw to let orPC handle it
    }
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
