/**
 * Conversation API Router
 * Handles audio upload, transcription, and MEDDIC analysis
 */

import {
  db,
  generateCaseNumberFromDate,
  type ProductLine,
} from "@Sales_ai_automation_v3/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
  user,
  userProfiles,
  // smsLogs, // TODO: 等 sms_logs 表建立後再啟用
} from "@Sales_ai_automation_v3/db/schema";
import {
  createAllServices,
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
// Helper: Resolve Slack User ID to System User ID
// ============================================================

/**
 * Slack User ID 到 Email 的靜態映射表
 * 用於在 user_profiles.slack_user_id 尚未設置時，透過 email 查找用戶
 */
const SLACK_ID_TO_EMAIL: Record<string, string> = {
  U0BU3PESX: "stephen.kao@ichef.com.tw",
  UCPDC51A4: "solo.chung@ichef.com.tw",
  UEVG3HUF4: "kevin.chen@ichef.com.tw",
  U07K188QJFQ: "belle.chen@ichef.com.tw",
  U8TC4Q7HB: "eileen.lee@ichef.com.tw",
  U06U7HUEZFT: "ariel.liu@ichef.com.tw",
  U028Q69EKF1: "kim.liang@ichef.com.tw",
  U01FS5DQT0T: "bonnie.liu@ichef.com.tw",
  U015SA8USQ1: "anna.yang@ichef.com.tw",
  U0MATRQ2U: "eddie.chan@ichef.com.tw",
  U041VGKJGA1: "joy.wu@ichef.com.tw",
  US97EGHJ5: "mai.chang@ichef.com.tw",
};

/**
 * 根據 Slack User ID 查找對應的系統 User ID
 *
 * 查詢優先順序：
 * 1. 先從 user_profiles.slack_user_id 查詢（已設置映射）
 * 2. 若找不到，從靜態映射表取得 email，再從 user 表查詢
 *
 * @param slackUserId - Slack User ID (e.g., "U0BU3PESX")
 * @returns 系統 User ID 或 null（如果找不到映射）
 */
async function resolveSlackUserToSystemUser(
  slackUserId: string
): Promise<string | null> {
  // 方法 1: 從 user_profiles.slack_user_id 查詢
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.slackUserId, slackUserId),
    columns: { userId: true },
  });

  if (profile?.userId) {
    return profile.userId;
  }

  // 方法 2: 從靜態映射表取得 email，再從 user 表查詢
  const email = SLACK_ID_TO_EMAIL[slackUserId];
  if (email) {
    const foundUser = await db.query.user.findFirst({
      where: eq(user.email, email),
      columns: { id: true },
    });

    if (foundUser?.id) {
      // 自動更新 user_profiles 的 slack_user_id（如果存在 profile）
      await db
        .update(userProfiles)
        .set({ slackUserId, updatedAt: new Date() })
        .where(eq(userProfiles.userId, foundUser.id));

      return foundUser.id;
    }
  }

  return null;
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
    // 產品線（可選，預設為 'ichef'）
    productLine: z.enum(["ichef", "beauty"]).optional(),
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

// Product line prefix mapping
const PRODUCT_LINE_PREFIXES: Record<ProductLine, string> = {
  ichef: "IC",
  beauty: "BT",
};

async function getNextCaseNumber(
  productLine: ProductLine = "ichef"
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const yearMonth = `${year}${month}`;
  const prefixCode = PRODUCT_LINE_PREFIXES[productLine] || "IC";
  const prefix = `${yearMonth}-${prefixCode}`;

  // Get the highest sequence number for this month and product line
  const result = await db
    .select({ caseNumber: conversations.caseNumber })
    .from(conversations)
    .where(sql`${conversations.caseNumber} LIKE ${`${prefix}%`}`)
    .orderBy(desc(conversations.caseNumber))
    .limit(1);

  let nextSequence = 1;
  const firstResult = result[0];
  if (result.length > 0 && firstResult?.caseNumber) {
    // Match both IC and BT prefixes
    const match = firstResult.caseNumber.match(/-(IC|BT)(\d+)$/);
    if (match?.[2]) {
      nextSequence = Number.parseInt(match[2], 10) + 1;
    }
  }

  return generateCaseNumberFromDate(nextSequence, productLine);
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
        productLine,
      } = input;
      const userId = context.session?.user.id;

      // 解析 productLine (預設 'ichef')
      const resolvedProductLine = productLine || "ichef";

      if (!userId) {
        console.error(`[${requestId}] ❌ UNAUTHORIZED: No userId in session`);
        throw new ORPCError("UNAUTHORIZED");
      }

      console.log(`[${requestId}] ✓ Auth passed, userId: ${userId}`);

      // Step 1: Verify opportunity exists and user has access
      console.log(`[${requestId}] 🔍 Verifying opportunity: ${opportunityId}`);
      const opportunity = await db.query.opportunities.findFirst({
        where: eq(opportunities.id, opportunityId),
      });

      if (!opportunity) {
        console.error(
          `[${requestId}] ❌ Opportunity not found: ${opportunityId}`
        );
        throw new ORPCError("NOT_FOUND", { message: "商機不存在" });
      }

      // 檢查權限：Service Account、擁有者、管理者/主管、或 Slack 建立的商機
      const isServiceAccount = context.isServiceAccount === true;
      const userEmail = context.session?.user.email;
      const userRole = getUserRole(userEmail);
      const isOwner = opportunity.userId === userId;
      const hasAdminAccess = userRole === "admin" || userRole === "manager";
      const isSlackGenerated =
        !opportunity.userId || opportunity.userId === "service-account";

      if (
        !(isServiceAccount || isOwner || hasAdminAccess || isSlackGenerated)
      ) {
        console.error(
          `[${requestId}] ❌ Permission denied for opportunity: ${opportunityId}`
        );
        throw new ORPCError("FORBIDDEN", { message: "無權存取此商機" });
      }

      console.log(
        `[${requestId}] ✓ Opportunity verified: ${opportunity.companyName}`
      );

      // Step 1.5: 嘗試將 Slack User ID 解析為系統 User ID
      let resolvedCreatedBy = userId; // 預設使用 session 中的 userId (service account)

      if (slackUser?.id) {
        console.log(
          `[${requestId}] 🔍 Resolving Slack user: ${slackUser.id} (${slackUser.username})`
        );
        const mappedUserId = await resolveSlackUserToSystemUser(slackUser.id);

        if (mappedUserId) {
          resolvedCreatedBy = mappedUserId;
          console.log(
            `[${requestId}] ✓ Slack user mapped to system user: ${mappedUserId}`
          );

          // 如果商機是 service-account 建立的，也更新商機的 userId
          if (isSlackGenerated && opportunity.userId !== mappedUserId) {
            console.log(
              `[${requestId}] 📝 Updating opportunity owner from "${opportunity.userId}" to "${mappedUserId}"`
            );
            await db
              .update(opportunities)
              .set({ userId: mappedUserId, updatedAt: new Date() })
              .where(eq(opportunities.id, opportunityId));
          }
        } else {
          console.log(
            `[${requestId}] ⚠️ No mapping found for Slack user: ${slackUser.id}, using service account`
          );
        }
      }

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

      // Step 3: Upload to R2
      // 注意：音檔壓縮已移至 Queue Worker 處理，使用 AWS Lambda S3 模式
      // 這樣可以避免 Lambda Function URL 6MB 回應限制的問題
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
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: `R2 上傳失敗: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      // Step 4: Generate case number
      let caseNumber: string;
      const conversationId = randomUUID();
      try {
        caseNumber = await getNextCaseNumber(
          resolvedProductLine as ProductLine
        );
        console.log(
          `[${requestId}] 🎫 Generated conversationId: ${conversationId}, caseNumber: ${caseNumber} (${resolvedProductLine})`
        );
      } catch (error) {
        console.error(
          `[${requestId}] ❌ Failed to generate case number:`,
          error
        );
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: `案件編號生成失敗: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      // Step 5: 建立資料庫記錄 (status: "pending")
      // 不再同步轉錄,而是推送到 Queue
      console.log(
        `[${requestId}] 💾 Creating conversation record with status: pending...`
      );
      let insertedConversation;
      try {
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
            // transcript 由 Queue Worker 轉錄後回填，不傳讓資料庫使用預設值 NULL
            duration: metadata?.duration || 0,
            conversationDate: metadata?.conversationDate
              ? new Date(metadata.conversationDate)
              : new Date(),
            createdBy: resolvedCreatedBy, // 使用解析後的用戶 ID
            // Slack 業務資訊
            slackUserId: slackUser?.id,
            slackUsername: slackUser?.username,
            // 產品線
            productLine: resolvedProductLine,
          })
          .returning();

        console.log(
          `[${requestId}] ✓ DB insert completed in ${Date.now() - dbStartTime}ms`
        );

        insertedConversation = conversationResults[0];
        if (!insertedConversation) {
          throw new Error("No conversation returned from DB insert");
        }
      } catch (error) {
        console.error(`[${requestId}] ❌ DB insert failed:`, error);
        console.error(
          `[${requestId}] Error stack:`,
          error instanceof Error ? error.stack : "no stack"
        );
        console.error(`[${requestId}] Error cause:`, (error as any)?.cause);
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: `資料庫寫入失敗: ${error instanceof Error ? error.message : String(error)}`,
        });
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
          productLine: resolvedProductLine,
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
    } | null;

    if (!transcript?.segments) {
      console.error("[analyzeConversation] transcript 資料不完整:", {
        conversationId,
        hasTranscript: !!conversation.transcript,
      });
      throw new ORPCError("BAD_REQUEST", { message: "轉錄資料不完整" });
    }

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
    const userEmail = context.session?.user.email;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 檢查用戶角色
    const userRole = getUserRole(userEmail);
    const hasAdminAccess = userRole === "admin" || userRole === "manager";

    // 初始化快取服務
    const { createKVCacheService } = await import(
      "@Sales_ai_automation_v3/services"
    );
    const cacheService = createKVCacheService(context.honoContext.env.CACHE_KV);
    const cacheKey = `user:${userId}:conversations:list`;

    // 1. 嘗試從快取讀取 (只有全列表查詢且非管理者才用快取)
    if (!(opportunityId || hasAdminAccess)) {
      try {
        const cached =
          await cacheService.get<
            Array<{
              id: string;
              opportunityId: string;
              opportunityCompanyName: string;
              customerNumber: string | null;
              caseNumber: string;
              title: string | null;
              type: string;
              status: string;
              audioUrl: string | null;
              duration: number | null;
              conversationDate: Date;
              createdAt: Date;
              hasAnalysis: boolean;
              meddicScore: number | null;
            }>
          >(cacheKey);

        if (cached && cached.length > 0) {
          console.log("[Cache Hit] Returning cached conversations");
          return {
            items: cached.slice(offset, offset + limit),
            total: cached.length,
            limit,
            offset,
          };
        }
      } catch (error) {
        console.warn(
          "[Cache] Failed to read from cache, falling back to DB:",
          error
        );
      }
    }

    // 2. 快取未命中或有錯誤,從資料庫查詢
    console.log("[Cache Miss] Querying database");

    // 根據角色設定查詢條件
    const conditions = [];

    // 一般業務只能看自己的和 Slack 建立的（userId 為 null 或 "service-account"），管理者和主管可以看全部
    if (!hasAdminAccess) {
      // 使用 OR 條件：自己的 OR Slack 建立的
      conditions.push(
        sql`(${opportunities.userId} = ${userId} OR ${opportunities.userId} IS NULL OR ${opportunities.userId} = 'service-account')`
      );
    }

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
        meddicScore: meddicAnalyses.overallScore,
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(conversations.conversationDate))
      .limit(100); // 查詢最多 100 筆

    // 3. 寫入快取 (如果是全列表查詢且有資料且非管理者)
    if (!opportunityId && results.length > 0 && !hasAdminAccess) {
      try {
        const cacheData = results.map((r) => ({
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
          meddicScore: r.meddicScore,
        }));

        await cacheService.set(cacheKey, cacheData, 3600); // 1 小時
        console.log("[Cache] Wrote conversations list to cache");
      } catch (error) {
        console.warn("[Cache] Failed to write to cache:", error);
        // 寫入失敗不影響主流程
      }
    }

    // 4. 應用分頁
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      items: paginatedResults.map((r) => ({
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
        meddicScore: r.meddicScore,
      })),
      total: results.length,
      limit,
      offset,
    };
  });

// ============================================================
// 權限控制 - 三級權限：管理者、主管、一般業務
// ============================================================
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const MANAGER_EMAILS = (process.env.MANAGER_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

// 檢查用戶角色
function getUserRole(
  userEmail: string | null | undefined
): "admin" | "manager" | "sales" {
  if (!userEmail) {
    return "sales";
  }
  if (ADMIN_EMAILS.includes(userEmail)) {
    return "admin";
  }
  if (MANAGER_EMAILS.includes(userEmail)) {
    return "manager";
  }
  return "sales";
}

export const getConversation = protectedProcedure
  .input(getConversationSchema)
  .handler(async ({ input, context }) => {
    const { conversationId } = input;
    const userId = context.session?.user.id;
    const userEmail = context.session?.user.email;

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

    // 檢查 opportunity 是否存在（可能被刪除）
    if (!conversation.opportunity) {
      console.error("[getConversation] opportunity 不存在:", {
        conversationId,
        opportunityId: conversation.opportunityId,
      });
      throw new ORPCError("NOT_FOUND", { message: "關聯的商機資料不存在" });
    }

    // 檢查權限
    const isOwner = conversation.opportunity.userId === userId;
    const userRole = getUserRole(userEmail);
    const hasAdminAccess = userRole === "admin" || userRole === "manager";
    // 從 Slack 建立的對話（userId 為 null 或 "service-account"）視為團隊共享，所有人都可以查看
    const isSlackGenerated =
      !conversation.opportunity.userId ||
      conversation.opportunity.userId === "service-account";

    // DEBUG: 記錄權限檢查詳情
    console.log("[getConversation] 權限檢查:", {
      conversationId,
      userId,
      userEmail,
      opportunityUserId: conversation.opportunity.userId,
      isOwner,
      userRole,
      hasAdminAccess,
      isSlackGenerated,
      ADMIN_EMAILS,
      MANAGER_EMAILS,
    });

    // 一般業務只能看自己的，管理者和主管可以看全部，Slack 建立的所有人都可以看
    if (!(isOwner || hasAdminAccess || isSlackGenerated)) {
      console.error("[getConversation] 權限拒絕:", {
        userId,
        userEmail,
        userRole,
        conversationId,
      });
      throw new ORPCError("FORBIDDEN");
    }

    return {
      id: conversation.id,
      opportunityId: conversation.opportunityId,
      opportunityCompanyName: conversation.opportunity?.companyName || null,
      customerNumber: conversation.opportunity?.customerNumber || null,
      customerPhone: conversation.opportunity?.contactPhone || null,
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
      smsSent: conversation.smsSent,
      smsSentAt: conversation.smsSentAt || null,
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

    // 檢查權限：擁有者、管理者/主管、或 Slack 建立的對話
    const isOwner = conversation.opportunity.userId === userId;
    const userRole = getUserRole(context.session?.user.email);
    const hasAdminAccess = userRole === "admin" || userRole === "manager";
    const isSlackGenerated =
      !conversation.opportunity.userId ||
      conversation.opportunity.userId === "service-account";

    if (!(isOwner || hasAdminAccess || isSlackGenerated)) {
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
// Retry Failed Conversation Endpoint
// ============================================================

const retryConversationSchema = z
  .object({
    conversationId: z.string().optional(),
    caseNumber: z.string().optional(),
  })
  .refine(
    (data) => data.conversationId || data.caseNumber,
    "必須提供 conversationId 或 caseNumber 其中之一"
  );

export const retryConversation = protectedProcedure
  .input(retryConversationSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;
    const userEmail = context.session?.user.email;
    const isServiceAccount = context.isServiceAccount === true;

    // Service Account 可以直接重試（用於自動化腳本）
    if (!isServiceAccount) {
      if (!userId) {
        throw new ORPCError("UNAUTHORIZED");
      }

      // 檢查權限（只有管理者可以重試）
      const userRole = getUserRole(userEmail);
      if (userRole !== "admin" && userRole !== "manager") {
        throw new ORPCError("FORBIDDEN", {
          message: "只有管理者可以重試失敗的對話",
        });
      }
    }

    // 查詢對話
    let conversation;
    if (input.conversationId) {
      conversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, input.conversationId),
        with: { opportunity: true },
      });
    } else if (input.caseNumber) {
      conversation = await db.query.conversations.findFirst({
        where: eq(conversations.caseNumber, input.caseNumber),
        with: { opportunity: true },
      });
    }

    if (!conversation) {
      throw new ORPCError("NOT_FOUND", { message: "找不到對話記錄" });
    }

    // 只能重試 failed 或 pending 狀態的對話
    if (!["failed", "pending"].includes(conversation.status)) {
      throw new ORPCError("BAD_REQUEST", {
        message: `無法重試狀態為 ${conversation.status} 的對話`,
      });
    }

    // 確保有音檔 URL
    if (!conversation.audioUrl) {
      throw new ORPCError("BAD_REQUEST", { message: "對話缺少音檔 URL" });
    }

    // 獲取環境變數
    const honoEnv = context.honoContext?.env || {};
    const envRecord = honoEnv as Record<string, unknown>;

    // 重置狀態
    await db
      .update(conversations)
      .set({
        status: "pending",
        errorMessage: null,
        errorDetails: null,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversation.id));

    // 推送到 Queue
    try {
      if (!envRecord.TRANSCRIPTION_QUEUE) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Queue binding not configured",
        });
      }

      const queueBinding = envRecord.TRANSCRIPTION_QUEUE as {
        send: (message: unknown) => Promise<void>;
      };

      await queueBinding.send({
        conversationId: conversation.id,
        opportunityId: conversation.opportunityId,
        audioUrl: conversation.audioUrl,
        caseNumber: conversation.caseNumber,
        productLine: conversation.productLine || "ichef",
        metadata: {
          fileName: conversation.title || "retry-audio",
          fileSize: 0,
          format: "mp3",
        },
        slackUser: conversation.slackUserId
          ? {
              id: conversation.slackUserId,
              username: conversation.slackUsername || "unknown",
            }
          : undefined,
      });

      console.log(
        `[Retry] ✓ Conversation ${conversation.caseNumber} pushed to queue`
      );

      return {
        success: true,
        conversationId: conversation.id,
        caseNumber: conversation.caseNumber,
        message: "對話已重新排入處理佇列",
      };
    } catch (queueError) {
      console.error("[Retry] ❌ Failed to push to queue:", queueError);

      // 恢復錯誤狀態
      await db
        .update(conversations)
        .set({
          status: "failed",
          errorMessage: "重試失敗：無法推送到佇列",
        })
        .where(eq(conversations.id, conversation.id));

      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `重試失敗: ${queueError instanceof Error ? queueError.message : String(queueError)}`,
      });
    }
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
  retry: retryConversation,
};
