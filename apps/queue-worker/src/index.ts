/**
 * Transcription Queue Consumer Worker
 *
 * 處理音檔轉錄和 MEDDIC 分析的異步任務
 * - 從 Queue 接收訊息
 * - 下載音檔從 R2
 * - 執行 Whisper 轉錄 (無時間限制)
 * - 執行 MEDDIC 分析
 * - 更新資料庫
 * - 發送 Slack 通知
 */

import * as schema from "@Sales_ai_automation_v3/db/schema";
import {
  conversations,
  meddicAnalyses,
  opportunities,
  salesTodos,
  userProfiles,
} from "@Sales_ai_automation_v3/db/schema";
import {
  type AttentionNeededData,
  type CloseCaseData,
  createGeminiClient,
  createGroqWhisperService,
  createLambdaCompressor,
  createOrchestrator,
  createR2Service,
  createSlackNotificationService,
  KV_KEYS,
  type SystemHealthData,
  type TodoStatsData,
  type WeeklyRepPerformance,
} from "@Sales_ai_automation_v3/services";
import { randomUUID } from "node:crypto";
import type {
  MessageBatch,
  ScheduledController,
} from "@cloudflare/workers-types";
import { neon, neonConfig } from "@neondatabase/serverless";
import { WebClient } from "@slack/web-api";

// 配置 Neon 使用 Cloudflare Workers 的 fetch
neonConfig.fetchFunction = fetch;

import {
  type AppError,
  errors,
  formatErrorForLog,
  isAppError,
} from "@sales_ai_automation_v3/shared/errors";
import type { TranscriptionMessage } from "@sales_ai_automation_v3/shared/types";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

// ============================================================
// Types
// ============================================================

export interface Env {
  // Database
  DATABASE_URL: string;

  // AI Services (分產品線)
  GROQ_API_KEY: string; // 預設 (向後兼容)
  GROQ_API_KEY_ICHEF?: string;
  GROQ_API_KEY_BEAUTY?: string;
  GEMINI_API_KEY: string; // 預設 (向後兼容)
  GEMINI_API_KEY_ICHEF?: string;
  GEMINI_API_KEY_BEAUTY?: string;

  // R2 Storage
  CLOUDFLARE_R2_ACCESS_KEY: string;
  CLOUDFLARE_R2_SECRET_KEY: string;
  CLOUDFLARE_R2_ENDPOINT: string;
  CLOUDFLARE_R2_BUCKET: string;

  // Slack (多 Bot 支援)
  SLACK_BOT_TOKEN: string; // iCHEF Bot (預設)
  SLACK_BOT_TOKEN_BEAUTY?: string; // Beauty Bot

  // Server API
  SERVER_URL: string;
  SERVICE_API_TOKEN?: string;

  // Web App
  WEB_APP_URL: string;

  // Lambda Compressor (備援壓縮)
  LAMBDA_COMPRESSOR_URL?: string;

  // AWS S3 (壓縮音檔暫存)
  AWS_S3_ACCESS_KEY?: string;
  AWS_S3_SECRET_KEY?: string;
  AWS_S3_REGION?: string;
  AWS_S3_BUCKET?: string;

  // Environment
  ENVIRONMENT: string;

  // KV Cache
  CACHE_KV: KVNamespace;
}

// Extended TranscriptionMessage with Slack user info
export interface QueueTranscriptionMessage extends TranscriptionMessage {
  caseNumber: string;
  productLine?: "ichef" | "beauty";
  slackUser?: {
    id: string;
    username: string;
  };
}

// ============================================================
// Queue Consumer Handler
// ============================================================

export default {
  async queue(
    batch: MessageBatch<QueueTranscriptionMessage>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log(
      `[Queue] Processing batch of ${batch.messages.length} messages`
    );

    // 初始化資料庫連接 (HTTP 模式,Cloudflare Workers 相容)
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });

    // Helper: 根據 productLine 取得對應的 Slack Bot Token
    const getSlackToken = (productLine: string): string => {
      if (productLine === "beauty" && env.SLACK_BOT_TOKEN_BEAUTY) {
        return env.SLACK_BOT_TOKEN_BEAUTY;
      }
      return env.SLACK_BOT_TOKEN; // 預設使用 iCHEF Bot
    };

    // Helper: 根據 productLine 取得對應的 GROQ API Key
    const getGroqApiKey = (productLine: string): string => {
      if (productLine === "beauty" && env.GROQ_API_KEY_BEAUTY) {
        return env.GROQ_API_KEY_BEAUTY;
      }
      if (productLine === "ichef" && env.GROQ_API_KEY_ICHEF) {
        return env.GROQ_API_KEY_ICHEF;
      }
      return env.GROQ_API_KEY; // 預設 (向後兼容)
    };

    // Helper: 根據 productLine 取得對應的 Gemini API Key
    const getGeminiApiKey = (productLine: string): string => {
      if (productLine === "beauty" && env.GEMINI_API_KEY_BEAUTY) {
        return env.GEMINI_API_KEY_BEAUTY;
      }
      if (productLine === "ichef" && env.GEMINI_API_KEY_ICHEF) {
        return env.GEMINI_API_KEY_ICHEF;
      }
      return env.GEMINI_API_KEY; // 預設 (向後兼容)
    };

    for (const message of batch.messages) {
      const startTime = Date.now();
      const {
        conversationId,
        audioUrl,
        opportunityId,
        caseNumber,
        metadata,
        slackUser,
        productLine,
      } = message.body;

      // 解析 productLine (預設 'ichef')
      // 優先順序: message payload -> DB conversation record -> 預設 'ichef'
      const resolvedProductLine = productLine || "ichef";

      // 解析 opportunityId (如果沒有從 message body 取得,則從 DB 取得)
      let resolvedOpportunityId: string | undefined = opportunityId;
      if (!resolvedOpportunityId) {
        console.log(
          "[Queue] ⚠️ opportunityId not in message, fetching from conversation..."
        );
        const conversation = await db.query.conversations.findFirst({
          where: (convs, { eq }) => eq(convs.id, conversationId),
          columns: { opportunityId: true },
        });
        resolvedOpportunityId = conversation?.opportunityId;
        if (resolvedOpportunityId) {
          console.log(
            `[Queue] ✓ Resolved opportunityId from conversation: ${resolvedOpportunityId}`
          );
        } else {
          console.log(
            `[Queue] ⚠️ No opportunityId found for conversation ${conversationId}`
          );
        }
      }

      // 根據 productLine 初始化對應的 Slack 通知服務
      const slackService = createSlackNotificationService({
        token: getSlackToken(resolvedProductLine),
      });
      console.log(
        `[Queue] 📱 Using ${resolvedProductLine === "beauty" ? "Beauty" : "iCHEF"} Slack Bot for notifications`
      );

      // threadTs 需要在 try block 之前宣告,以便在 catch block 中使用
      let threadTs: string | undefined;

      try {
        console.log(`[Queue] 🎬 Processing conversation ${conversationId}`);
        console.log(
          `[Queue]    File: ${metadata.fileName} (${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB)`
        );
        console.log(`[Queue]    Product Line: ${resolvedProductLine}`);

        // ========================================
        // Step 0: 發送處理開始通知
        // ========================================
        if (slackUser?.id) {
          try {
            threadTs = await slackService.notifyProcessingStarted({
              userId: slackUser.id,
              fileName: metadata.fileName,
              fileSize: metadata.fileSize,
              conversationId,
              caseNumber,
            });
            console.log(
              `[Queue] ✓ Sent processing started notification to ${slackUser.id} (thread_ts: ${threadTs})`
            );
          } catch (notifyError) {
            console.error(
              "[Queue] ⚠️  Failed to send start notification (non-critical):"
            );
            console.error(formatErrorForLog(notifyError));
          }
        }

        // ========================================
        // Step 1: 下載音檔從 R2
        // ========================================
        console.log("[Queue] 📥 Downloading audio from R2...");
        const r2Service = createR2Service({
          accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY,
          secretAccessKey: env.CLOUDFLARE_R2_SECRET_KEY,
          endpoint: env.CLOUDFLARE_R2_ENDPOINT,
          bucket: env.CLOUDFLARE_R2_BUCKET,
        });

        // Extract key from URL
        const audioKey = new URL(audioUrl).pathname.substring(1);
        let audioBuffer = await r2Service.downloadAudio(audioKey);
        console.log(`[Queue] ✓ Downloaded ${audioBuffer.length} bytes`);

        // ========================================
        // Step 1.5: 檢查檔案大小，必要時壓縮 (備援機制)
        // ========================================
        const GROQ_SIZE_LIMIT_MB = 20; // 降低閾值，提前觸發壓縮以確保成功
        const fileSizeMB = audioBuffer.length / 1024 / 1024;

        // 判斷是否使用 S3 輸出模式
        const useS3Mode = !!(
          env.AWS_S3_ACCESS_KEY &&
          env.AWS_S3_SECRET_KEY &&
          env.AWS_S3_REGION &&
          env.AWS_S3_BUCKET
        );

        if (fileSizeMB > GROQ_SIZE_LIMIT_MB && env.LAMBDA_COMPRESSOR_URL) {
          console.log(
            `[Queue] ⚠️  File size ${fileSizeMB.toFixed(2)}MB exceeds Groq limit (${GROQ_SIZE_LIMIT_MB}MB)`
          );
          console.log(
            `[Queue] 🗜️  Starting fallback compression via Lambda... (outputMode: ${useS3Mode ? "s3" : "base64"})`
          );

          try {
            const compressor = createLambdaCompressor(
              env.LAMBDA_COMPRESSOR_URL,
              {
                timeout: 360_000, // 6 分鐘超時 (Lambda 需要下載、壓縮、上傳大檔案)
              }
            );

            // 生成預簽名 URL 讓 Lambda 能夠下載 R2 中的音檔
            const presignedUrl = await r2Service.getSignedUrl(audioKey, 600); // 10 分鐘有效
            console.log(
              `[Queue] 📤 Sending presigned URL to Lambda (key: ${audioKey})`
            );

            const compressionResult = await compressor.compressFromUrl(
              presignedUrl,
              {
                outputMode: useS3Mode ? "s3" : "base64",
                fileName: metadata.fileName,
              }
            );

            if (compressionResult.success) {
              console.log(
                `[Queue] ✓ Compression successful: ${compressionResult.originalSize} -> ${compressionResult.compressedSize} bytes`
              );
              console.log(
                `[Queue]   Reduction: ${compressionResult.compressionRatio}%, outputMode: ${compressionResult.outputMode}`
              );

              let compressedBuffer: Buffer;

              if (
                compressionResult.outputMode === "s3" &&
                compressionResult.s3Key
              ) {
                // S3 模式：從 S3 下載壓縮後音檔
                console.log(
                  `[Queue] 📥 Downloading compressed audio from S3: ${compressionResult.s3Key}`
                );

                const { createS3Service } = await import(
                  "@Sales_ai_automation_v3/services"
                );

                const s3Service = createS3Service({
                  accessKeyId: env.AWS_S3_ACCESS_KEY!,
                  secretAccessKey: env.AWS_S3_SECRET_KEY!,
                  region: env.AWS_S3_REGION!,
                  bucket: env.AWS_S3_BUCKET!,
                });

                compressedBuffer = await s3Service.download(
                  compressionResult.s3Key
                );

                // 下載完成後刪除 S3 檔案（可選，S3 Lifecycle 也會自動刪除）
                try {
                  await s3Service.delete(compressionResult.s3Key);
                  console.log(
                    `[Queue] 🗑️  Deleted S3 file: ${compressionResult.s3Key}`
                  );
                } catch (deleteError) {
                  console.warn(
                    `[Queue] ⚠️  Failed to delete S3 file (non-critical): ${compressionResult.s3Key}`
                  );
                }
              } else if (compressionResult.compressedAudioBase64) {
                // Base64 模式：將 base64 轉回 Buffer（向後兼容）
                compressedBuffer = Buffer.from(
                  compressionResult.compressedAudioBase64,
                  "base64"
                );
              } else {
                throw new Error(
                  "Compression succeeded but no output data available"
                );
              }

              // 檢查壓縮後是否符合 Groq 限制
              const compressedSizeMB = compressedBuffer.length / 1024 / 1024;
              if (compressedSizeMB <= GROQ_SIZE_LIMIT_MB) {
                audioBuffer = compressedBuffer;
                console.log(
                  `[Queue] ✓ Using compressed audio: ${compressedSizeMB.toFixed(2)}MB`
                );
              } else {
                console.warn(
                  `[Queue] ⚠️  Compressed size ${compressedSizeMB.toFixed(2)}MB still exceeds limit, proceeding anyway...`
                );
                audioBuffer = compressedBuffer;
              }
            } else {
              console.error(
                `[Queue] ❌ Compression failed: ${compressionResult.error}`
              );
              throw new Error(
                `音檔過大 (${fileSizeMB.toFixed(1)}MB) 且壓縮失敗: ${compressionResult.error}`
              );
            }
          } catch (compressionError) {
            console.error("[Queue] ❌ Compression error:", compressionError);
            throw new Error(
              `音檔過大 (${fileSizeMB.toFixed(1)}MB)，超過 Groq ${GROQ_SIZE_LIMIT_MB}MB 限制，壓縮也失敗`
            );
          }
        } else if (fileSizeMB > GROQ_SIZE_LIMIT_MB) {
          // 沒有配置 Lambda URL，但檔案過大
          console.error(
            `[Queue] ❌ File size ${fileSizeMB.toFixed(2)}MB exceeds limit and LAMBDA_COMPRESSOR_URL not configured`
          );
          throw new Error(
            `音檔過大 (${fileSizeMB.toFixed(1)}MB)，超過 Groq ${GROQ_SIZE_LIMIT_MB}MB 限制，且未配置壓縮服務`
          );
        }

        // ========================================
        // Step 2: Whisper 轉錄
        // ========================================
        const groqApiKey = getGroqApiKey(resolvedProductLine);
        console.log(
          `[Queue] 🎙️  Starting Whisper transcription (${resolvedProductLine})...`
        );
        const whisperService = createGroqWhisperService(groqApiKey);
        const transcriptResult = await whisperService.transcribe(audioBuffer, {
          language: "zh",
          chunkIfNeeded: true,
        });
        console.log(
          `[Queue] ✓ Transcription completed: ${transcriptResult.fullText.length} chars`
        );

        // ========================================
        // Step 3: 更新資料庫 (transcribed 狀態)
        // ========================================
        console.log("[Queue] 💾 Updating database (transcribed)...");
        console.log("[Queue] DEBUG: conversationId =", conversationId);
        console.log("[Queue] DEBUG: DATABASE_URL exists?", !!env.DATABASE_URL);

        try {
          // 嘗試使用原生 SQL 代替 Drizzle
          const transcriptData = {
            fullText: transcriptResult.fullText,
            language: transcriptResult.language || "unknown",
            segments:
              transcriptResult.segments?.map((seg) => ({
                speaker: seg.speaker || "Unknown",
                text: seg.text,
                start: seg.start,
                end: seg.end,
              })) || [],
          };

          const duration = Math.round(
            transcriptResult.segments?.reduce(
              (max, seg) => Math.max(max, seg.end),
              0
            ) || 0
          );

          console.log("[Queue] DEBUG: Using raw SQL query...");
          console.log(
            "[Queue] DEBUG: duration =",
            duration,
            "type =",
            typeof duration
          );
          const result = await sql`
            UPDATE conversations
            SET
              status = 'transcribed',
              transcript = ${JSON.stringify(transcriptData)}::jsonb,
              duration = ${duration},
              updated_at = NOW()
            WHERE id = ${conversationId}
            RETURNING *
          `;

          console.log("[Queue] DEBUG: Update result rows =", result.length);
          console.log("[Queue] ✓ Database updated (transcribed)");
        } catch (dbError) {
          console.error("[Queue] ❌ Database update error:", dbError);
          console.error("[Queue] Error name:", (dbError as Error).name);
          console.error("[Queue] Error message:", (dbError as Error).message);
          console.error("[Queue] Error stack:", (dbError as Error).stack);
          throw dbError;
        }

        // ========================================
        // Step 4: MEDDIC 分析
        // ========================================
        const geminiApiKey = getGeminiApiKey(resolvedProductLine);
        console.log(
          `[Queue] 🧠 Starting MEDDIC analysis (${resolvedProductLine})...`
        );
        const geminiClient = createGeminiClient(geminiApiKey);
        const orchestrator = createOrchestrator(geminiClient);

        const analysisResult = await orchestrator.analyze(
          transcriptResult.segments?.map((seg) => ({
            speaker: seg.speaker || "Unknown",
            text: seg.text,
            start: seg.start,
            end: seg.end,
          })) || [],
          {
            leadId: resolvedOpportunityId || "",
            conversationId,
            salesRep: slackUser?.username || "Unknown",
            conversationDate: new Date(),
            productLine: resolvedProductLine,
          }
        );
        console.log(
          `[Queue] ✓ Analysis completed: ${analysisResult.overallScore}/100`
        );

        // ========================================
        // Step 5: 保存分析結果到 meddicAnalyses 表
        // ========================================
        if (resolvedOpportunityId) {
          console.log(
            "[Queue] 💾 Saving analysis results to meddicAnalyses table..."
          );
          await db.insert(meddicAnalyses).values({
            id: randomUUID(),
            conversationId,
            opportunityId: resolvedOpportunityId,
            metricsScore: analysisResult.meddicScores?.metrics || 0,
            economicBuyerScore: analysisResult.meddicScores?.economicBuyer || 0,
            decisionCriteriaScore:
              analysisResult.meddicScores?.decisionCriteria || 0,
            decisionProcessScore:
              analysisResult.meddicScores?.decisionProcess || 0,
            identifyPainScore: analysisResult.meddicScores?.identifyPain || 0,
            championScore: analysisResult.meddicScores?.champion || 0,
            overallScore: analysisResult.overallScore,
            status: analysisResult.qualificationStatus,
            dimensions: analysisResult.dimensions as unknown as Record<
              string,
              { evidence: string[]; gaps: string[]; recommendations: string[] }
            >,
            keyFindings: analysisResult.keyFindings || [],
            nextSteps: (analysisResult.nextSteps || []).map((step: any) => ({
              action: step.action || step,
              priority: "Medium",
              owner: step.owner || "unknown",
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
          });
          console.log(
            "[Queue] ✓ MEDDIC analysis saved to meddicAnalyses table"
          );

          // ========================================
          // Step 5.1: 更新 opportunity 的分數欄位
          // ========================================
          console.log("[Queue] 💾 Updating opportunity scores...");
          await db
            .update(opportunities)
            .set({
              opportunityScore: analysisResult.overallScore,
              meddicScore: {
                overall: analysisResult.overallScore ?? 0,
                dimensions: {
                  metrics: analysisResult.meddicScores?.metrics || 0,
                  economicBuyer:
                    analysisResult.meddicScores?.economicBuyer || 0,
                  decisionCriteria:
                    analysisResult.meddicScores?.decisionCriteria || 0,
                  decisionProcess:
                    analysisResult.meddicScores?.decisionProcess || 0,
                  identifyPain: analysisResult.meddicScores?.identifyPain || 0,
                  champion: analysisResult.meddicScores?.champion || 0,
                },
              },
              updatedAt: new Date(),
            })
            .where(eq(opportunities.id, resolvedOpportunityId));
          console.log(
            `[Queue] ✓ Opportunity scores updated: ${analysisResult.overallScore}/100`
          );
        } else {
          console.log(
            "[Queue] ⚠️ Skipping meddicAnalyses insert: no opportunityId available"
          );
        }

        // ========================================
        // Step 6: 更新 conversation 狀態為 completed
        // ========================================
        console.log("[Queue] 💾 Updating conversation status to completed...");

        // 提取 Agent 4 的 summary markdown
        const agent4Summary = analysisResult.agentOutputs?.agent4?.markdown as
          | string
          | undefined;
        console.log(
          `[Queue] Agent 4 Summary: ${agent4Summary ? `${agent4Summary.length} characters` : "not found"}`
        );

        await db
          .update(conversations)
          .set({
            status: "completed",
            summary: agent4Summary || null,
            meddicAnalysis: {
              overallScore: analysisResult.overallScore,
              status: analysisResult.qualificationStatus,
              dimensions: analysisResult.dimensions as unknown as Record<
                string,
                unknown
              >,
            },
            analyzedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));
        console.log("[Queue] ✓ Conversation status updated to completed");

        // ========================================
        // Step 5.5: 生成公開分享 Token
        // ========================================
        let shareToken: string | undefined;
        try {
          console.log("[Queue] 🔗 Generating share token...");
          const tokenResponse = await fetch(
            `${env.SERVER_URL}/rpc/share.create`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.SERVICE_API_TOKEN || ""}`,
              },
              body: JSON.stringify({ conversationId }),
            }
          );

          if (tokenResponse.ok) {
            const tokenData = (await tokenResponse.json()) as {
              token: string;
              expiresAt: string;
            };
            shareToken = tokenData.token;
            console.log(`[Queue] ✓ Share token generated: ${shareToken}`);
          } else {
            const errorText = await tokenResponse.text();
            console.error(
              `[Queue] ⚠️  Failed to generate share token: ${tokenResponse.status} ${errorText}`
            );
          }
        } catch (error) {
          console.error("[Queue] ⚠️  Error generating share token:", error);
        }

        // ========================================
        // Step 6: 發送 Slack 完成通知
        // ========================================
        if (slackUser?.id) {
          try {
            const processingTimeMs = Date.now() - startTime;

            // 提取 agentOutputs
            const agentOutputs = analysisResult.agentOutputs as unknown as {
              agent1?: Record<string, unknown>;
              agent2?: Record<string, unknown>;
              agent3?: Record<string, unknown>;
              agent4?: Record<string, unknown>;
              agent5?: Record<string, unknown>;
              agent6?: Record<string, unknown>;
            };

            // 轉換 dimensions 格式以符合 MEDDICAnalysisResult
            const convertedDimensions: Record<
              string,
              {
                name: string;
                score: number;
                evidence?: string[];
                gaps?: string[];
                recommendations?: string[];
              }
            > = {};

            // 安全處理 dimensions (可能為 undefined 如果某些 agents 失敗)
            if (analysisResult.dimensions) {
              for (const [key, value] of Object.entries(
                analysisResult.dimensions
              )) {
                convertedDimensions[key] = {
                  name: key,
                  ...(value as unknown as {
                    score: number;
                    evidence?: string[];
                    gaps?: string[];
                    recommendations?: string[];
                  }),
                };
              }
            }

            // 提取高優先級警報
            const alerts: string[] = [];

            // 從 Agent 6 (Coach) 提取警報
            if (
              agentOutputs.agent6?.alert_triggered &&
              agentOutputs.agent6.alert_message
            ) {
              alerts.push(agentOutputs.agent6.alert_message as string);
            }

            // 從 Agent 2 (Buyer) 提取錯失機會 (只取第一個)
            const missedOpportunities =
              agentOutputs.agent2?.missed_opportunities;
            if (
              Array.isArray(missedOpportunities) &&
              missedOpportunities.length > 0
            ) {
              const firstOpportunity = missedOpportunities[0];
              alerts.push(
                `錯失推進機會 - ${String(firstOpportunity).substring(0, 100)}`
              );
            }

            // 從 dimensions 提取高優先級 gaps (前 2 個)
            const highPriorityGaps = Object.values(convertedDimensions)
              .filter((dim) => dim.gaps && dim.gaps.length > 0)
              .flatMap((dim) => dim.gaps || [])
              .slice(0, 2);

            alerts.push(...highPriorityGaps);

            // 提取 Agent 4 的 summary 和 sms_text
            const summary = agentOutputs.agent4?.markdown as string | undefined;
            const smsText = agentOutputs.agent4?.sms_text as string | undefined;

            // 從 Agent 4 的 markdown 提取客戶痛點
            const painPoints: string[] = [];
            if (summary) {
              // 提取 "您目前遇到的挑戰" 部分的痛點
              const painPointsMatch = summary.match(
                /##\s*🔍\s*您目前遇到的挑戰\s*\n\n((?:- \*\*.*?\*\*:.*?\n)+)/
              );
              if (painPointsMatch?.[1]) {
                const painPointsText = painPointsMatch[1];
                const matches = Array.from(
                  painPointsText.matchAll(/- \*\*(.*?)\*\*:/g)
                );
                for (const match of matches) {
                  if (match[1]) {
                    painPoints.push(match[1]);
                  }
                }
              }
            }

            // 從 opportunity 取得客戶電話
            let contactPhone: string | undefined;
            try {
              const oppResult = await db.query.opportunities.findFirst({
                where: (opportunities, { eq }) =>
                  eq(opportunities.id, message.body.opportunityId),
                columns: {
                  contactPhone: true,
                },
              });
              contactPhone = oppResult?.contactPhone ?? undefined;
            } catch (_error) {
              console.log(
                "[Queue] ⚠️  Could not fetch contact phone (non-critical)"
              );
            }

            // ====================================
            // 提取簡要版報告欄位 (新增)
            // ====================================

            // 1. PDCM 快速診斷 (從 Agent 2 提取)
            const agent2Data = agentOutputs.agent2 as
              | Record<string, unknown>
              | undefined;
            const pdcmScores = agent2Data?.pdcm_scores as
              | Record<string, unknown>
              | undefined;

            const pdcmQuickDiagnosis = pdcmScores
              ? {
                  pain: Number(
                    (pdcmScores.pain as Record<string, unknown>)?.score ?? 0
                  ),
                  decision: Number(
                    (pdcmScores.decision as Record<string, unknown>)?.score ?? 0
                  ),
                  champion: Number(
                    (pdcmScores.champion as Record<string, unknown>)?.score ?? 0
                  ),
                  metrics: Number(
                    (pdcmScores.metrics as Record<string, unknown>)?.score ?? 0
                  ),
                  totalScore: Number(pdcmScores.total_score ?? 0),
                  dealProbability:
                    (pdcmScores.deal_probability as
                      | "high"
                      | "medium"
                      | "low") ?? "low",
                }
              : undefined;

            // 2. 關鍵痛點 (從 Agent 2 提取，優先使用 key_pain_points)
            const agent2PainPoints = (
              agent2Data?.pcm_state as Record<string, unknown>
            )?.pain as Record<string, unknown> | undefined;
            const keyPainPoints: string[] = [];
            if (agent2PainPoints?.primary_pain) {
              keyPainPoints.push(String(agent2PainPoints.primary_pain));
            }
            // 補充從 Agent 4 markdown 提取的痛點
            keyPainPoints.push(
              ...painPoints.filter((p) => !keyPainPoints.includes(p))
            );

            // 3. 建議策略與理由 (從 Agent 3 提取)
            const agent3Data = agentOutputs.agent3 as
              | Record<string, unknown>
              | undefined;
            const recommendedStrategy = agent3Data?.recommended_strategy as
              | "CloseNow"
              | "SmallStep"
              | "MaintainRelationship"
              | undefined;
            const strategyReason = agent3Data?.strategy_reason as
              | string
              | undefined;

            // 4. 下一步行動 (從 Agent 3 提取)
            const agent3NextAction = agent3Data?.next_action as
              | Record<string, unknown>
              | undefined;
            const nextAction = agent3NextAction
              ? {
                  action: String(agent3NextAction.action ?? ""),
                  suggestedScript: String(
                    agent3NextAction.suggested_script ?? ""
                  ),
                  deadline: String(agent3NextAction.deadline ?? "24小時內"),
                }
              : undefined;

            // 5. 戰術建議 (從 Agent 6 提取，只取第一個)
            const agent6Data = agentOutputs.agent6 as
              | Record<string, unknown>
              | undefined;
            const tacticalSuggestions = agent6Data?.tactical_suggestions as
              | Record<string, unknown>[]
              | undefined;
            const topTacticalSuggestion = tacticalSuggestions?.[0]
              ? {
                  trigger: String(tacticalSuggestions[0].trigger ?? ""),
                  suggestion: String(tacticalSuggestions[0].suggestion ?? ""),
                  talkTrack: String(tacticalSuggestions[0].talk_track ?? ""),
                }
              : undefined;

            // 6. PDCM+SPIN 綜合警示 (從 Agent 6 提取)
            const agent6Alerts = agent6Data?.pdcm_spin_alerts as
              | Record<string, Record<string, unknown>>
              | undefined;
            const pdcmSpinAlerts = agent6Alerts
              ? {
                  noMetrics: {
                    triggered: Boolean(
                      agent6Alerts.no_metrics?.triggered ?? false
                    ),
                    message: String(agent6Alerts.no_metrics?.message ?? ""),
                  },
                  shallowDiscovery: {
                    triggered: Boolean(
                      agent6Alerts.shallow_discovery?.triggered ?? false
                    ),
                    message: String(
                      agent6Alerts.shallow_discovery?.message ?? ""
                    ),
                  },
                  noUrgency: {
                    triggered: Boolean(
                      agent6Alerts.no_urgency?.triggered ?? false
                    ),
                    message: String(agent6Alerts.no_urgency?.message ?? ""),
                  },
                }
              : undefined;

            await slackService.notifyProcessingCompleted({
              userId: slackUser.id,
              conversationId,
              caseNumber,
              analysisResult: {
                overallScore: analysisResult.overallScore ?? 0,
                qualificationStatus:
                  analysisResult.qualificationStatus ?? "unknown",
                dimensions: convertedDimensions,
                keyFindings: analysisResult.keyFindings ?? [],
                // 轉換 nextSteps 格式: {action, owner?, deadline?} -> {action, priority, owner}
                nextSteps: (analysisResult.nextSteps ?? []).map((step) => ({
                  action: step.action,
                  priority: "Medium", // 預設優先級
                  owner: step.owner || "Unassigned",
                })),
                // 保留完整 risks 格式: {risk, severity, mitigation?}[]
                risks: analysisResult.risks ?? [],
                // 高優先級警報
                alerts: alerts.filter(
                  (alert) => alert && alert.trim().length > 0
                ), // 過濾空字串
                // 客戶痛點 (從 Agent 4 markdown 提取)
                painPoints,
                // Agent 4 生成的內容
                summary, // 會議摘要 (markdown 格式)
                smsText, // SMS 簡訊內容
                contactPhone, // 客戶電話

                // ========= 新增：簡要版報告欄位 =========
                pdcmQuickDiagnosis,
                keyPainPoints:
                  keyPainPoints.length > 0 ? keyPainPoints : undefined,
                recommendedStrategy,
                strategyReason,
                nextAction,
                topTacticalSuggestion,
                pdcmSpinAlerts,

                // 競品分析
                competitorAnalysis: analysisResult.competitorAnalysis as
                  | {
                      detectedCompetitors: Array<{
                        name: string;
                        customerQuote: string;
                        attitude: "positive" | "negative" | "neutral";
                        threatLevel: "high" | "medium" | "low";
                        ourAdvantages: string[];
                        suggestedTalkTracks: string[];
                      }>;
                      overallThreatLevel: "high" | "medium" | "low" | "none";
                      handlingScore?: number;
                    }
                  | undefined,
              },
              processingTimeMs,
              threadTs, // 傳遞 thread_ts 以在同一個 thread 內回覆
              shareToken, // 傳遞 shareToken (用於 SMS 按鈕)
            });
            console.log(
              `[Queue] ✓ Sent completion notification to ${slackUser.id}`
            );
          } catch (notifyError) {
            console.error(
              "[Queue] ⚠️  Failed to send completion notification (non-critical):"
            );
            console.error(formatErrorForLog(notifyError));
          }
        }

        // ========================================
        // Step 7: 更新用戶快取 (基於 Single Source of Truth 策略)
        // ========================================
        try {
          console.log("[Queue] 📦 Updating cache...");

          // 查詢 opportunity 和 conversation 資料
          const [opportunityData, conversationData] = await Promise.all([
            resolvedOpportunityId
              ? db.query.opportunities.findFirst({
                  where: (opportunities, { eq }) =>
                    eq(opportunities.id, resolvedOpportunityId),
                  columns: {
                    userId: true,
                    companyName: true,
                  },
                })
              : Promise.resolve(undefined),
            db.query.conversations.findFirst({
              where: (conversations, { eq }) =>
                eq(conversations.id, conversationId),
              columns: {
                createdAt: true,
                audioUrl: true,
                duration: true,
              },
            }),
          ]);

          if (opportunityData?.userId) {
            const { createKVCacheService } = await import(
              "@Sales_ai_automation_v3/services"
            );
            const { updateConversationCache } = await import(
              "@Sales_ai_automation_v3/services"
            );

            const cacheService = createKVCacheService(env.CACHE_KV);

            // 從 analysisResult 提取資料
            const agentOutputs = analysisResult.agentOutputs as unknown as {
              agent4?: { markdown?: string };
            };
            const summaryText = agentOutputs.agent4?.markdown as
              | string
              | undefined;

            // 準備 Layer 1 快取資料 (詳細資料)
            const conversationDetail = {
              id: conversationId,
              caseNumber,
              title: summaryText?.substring(0, 100) || null,
              status: "completed" as const,
              opportunityCompanyName: opportunityData.companyName,
              meddicScore: analysisResult.overallScore ?? 0,
              createdAt:
                conversationData?.createdAt?.toISOString() ||
                new Date().toISOString(),
              transcript: {
                fullText: transcriptResult.fullText || "",
                segments: (transcriptResult.segments || []).map((seg) => ({
                  speaker: seg.speaker || "Unknown",
                  text: seg.text,
                  startTime: seg.start,
                })),
              },
              meddicAnalysis: {
                overallScore: analysisResult.overallScore ?? 0,
                dimensions: (analysisResult.meddicScores ||
                  {}) as unknown as Record<string, unknown>,
                keyFindings: analysisResult.keyFindings ?? [],
                nextSteps: (analysisResult.nextSteps ?? []).map((step) => ({
                  action: step.action,
                  priority: "Medium",
                })),
              },
              audioUrl: conversationData?.audioUrl ?? undefined,
              duration: conversationData?.duration ?? undefined,
            };

            // 執行快取更新 (Layer 1 寫入 + Layer 2 & 3 失效)
            await updateConversationCache(
              cacheService,
              opportunityData.userId,
              conversationId,
              conversationDetail
            );

            // 失效全域統計快取 (因為新增了一筆完成的分析)
            await cacheService.delete("stats:opportunity:global");
            // 失效用戶 dashboard 快取
            await cacheService.delete(
              `user:${opportunityData.userId}:dashboard`
            );
            console.log(
              "[Queue] ✓ Invalidated global stats and user dashboard cache"
            );

            console.log(
              `[Queue] ✅ Cache updated for user ${opportunityData.userId}`
            );
          } else {
            console.warn("[Queue] ⚠️ No userId found, skipping cache update");
          }
        } catch (error) {
          console.error("[Queue] ❌ Failed to update cache:", error);
          // 快取更新失敗不應中斷主流程
          // 下次 API 請求時會從資料庫重建快取
        }

        // ========================================
        // Step 8: Ack 消息
        // ========================================
        message.ack();

        const duration = Date.now() - startTime;
        console.log(
          `[Queue] ✅ Completed ${conversationId} in ${(duration / 1000).toFixed(1)}s`
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(
          `[Queue] ❌ Failed ${conversationId} after ${(duration / 1000).toFixed(1)}s:`
        );
        console.error(formatErrorForLog(error));

        // 轉換為 AppError 以獲得統一的錯誤處理
        let appError: AppError;
        if (isAppError(error)) {
          appError = error;
        } else if (error instanceof Error) {
          appError = errors.TRANSCRIPTION_FAILED(error);
        } else {
          appError = errors.UNKNOWN_ERROR(error);
        }

        // 提取錯誤訊息和詳情
        const errorMessage = appError.message;
        const errorDetails = {
          code: appError.code,
          stack: appError.stack,
          timestamp: new Date().toISOString(),
          context: appError.context,
        };

        // 更新資料庫為失敗狀態
        try {
          await db
            .update(conversations)
            .set({
              status: "failed",
              errorMessage,
              errorDetails,
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));
        } catch (dbError) {
          console.error("[Queue] ❌ Failed to update DB with error status:");
          console.error(formatErrorForLog(dbError));
        }

        // 發送 Slack 錯誤通知
        if (slackUser?.id) {
          try {
            await slackService.notifyProcessingFailed({
              userId: slackUser.id,
              fileName: metadata.fileName,
              errorMessage,
              conversationId,
              caseNumber,
              threadTs, // 傳遞 thread_ts 以在同一個 thread 內回覆
            });
            console.log(
              `[Queue] ✓ Sent failure notification to ${slackUser.id}`
            );
          } catch (notifyError) {
            console.error(
              "[Queue] ⚠️  Failed to send failure notification (non-critical):"
            );
            console.error(formatErrorForLog(notifyError));
          }
        }

        // Retry (Queue 會自動重試最多 3 次)
        message.retry();
      }
    }
  },

  // ============================================================
  // Scheduled Handler (Cron Triggers)
  // ============================================================
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const trigger = controller.cron;
    console.log(`[Scheduled] Cron triggered: ${trigger}`);

    if (trigger === "0 1 * * 1") {
      // 每週一 09:00 (UTC+8) - 週報
      console.log("[Scheduled] Running weekly report...");
      await handleWeeklyReport(env);
    } else if (trigger === "0 0 * * *") {
      // 每日 - 健康報告
      console.log("[Scheduled] Running daily health report...");
      await handleDailyHealthReport(env);
    } else if (trigger === "0 1 * * *") {
      // 每日 09:00 (UTC+8) - Todo 提醒 + Pending Follow-up 提醒
      console.log("[Scheduled] Running daily todo reminder...");
      await handleDailyTodoReminder(env);
      console.log("[Scheduled] Running pending follow-up reminder...");
      await handlePendingFollowUpReminder(env);
    } else if (trigger === "0 17 * * *") {
      // 每日 01:00 (UTC+8) - Voice Tagging 批次處理
      console.log("[Scheduled] Running daily voice tagging...");
      const { handleDailyVoiceTagging } = await import(
        "./handlers/voice-tagging"
      );
      await handleDailyVoiceTagging(env);
    }
  },
};

// ============================================================
// Scheduled Task Handlers
// ============================================================

async function handleDailyHealthReport(env: Env): Promise<void> {
  try {
    const slackClient = new WebClient(env.SLACK_BOT_TOKEN);

    // 嘗試從 KV Cache 讀取
    const cached = await env.CACHE_KV.get<SystemHealthData>(
      KV_KEYS.SYSTEM_HEALTH,
      "json"
    );

    let healthData: SystemHealthData;

    if (cached) {
      console.log("[Scheduled] Using cached SystemHealthData");
      healthData = cached;
    } else {
      // Fallback: 直接 SQL 查詢
      console.warn("[Scheduled] KV cache miss, falling back to SQL");
      const sql = neon(env.DATABASE_URL);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const stats = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
          COUNT(*) FILTER (WHERE status IN ('pending', 'transcribing', 'analyzing')) as in_progress_count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status = 'completed') as avg_processing_time
        FROM conversations
        WHERE created_at >= ${yesterday.toISOString()}
          AND status != 'archived'
      `;

      const failedCases = await sql`
        SELECT
          c.case_number,
          c.error_details->>'code' as error_code,
          c.error_message,
          o.company_name
        FROM conversations c
        LEFT JOIN opportunities o ON c.opportunity_id = o.id
        WHERE c.created_at >= ${yesterday.toISOString()}
          AND c.status = 'failed'
        ORDER BY c.created_at DESC
        LIMIT 10
      `;

      const stuckCases = await sql`
        SELECT
          c.case_number,
          c.status,
          o.company_name,
          EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 3600 as hours_stuck
        FROM conversations c
        LEFT JOIN opportunities o ON c.opportunity_id = o.id
        WHERE c.created_at < ${oneHourAgo.toISOString()}
          AND c.status IN ('pending', 'transcribing', 'analyzing')
        ORDER BY c.created_at ASC
        LIMIT 10
      `;

      const result = stats[0] || {};

      // 按錯誤代碼分組
      const errorsByCode: SystemHealthData["processing"]["errorsByCode"] = {};
      for (const c of failedCases as any[]) {
        const code = c.error_code || "UNKNOWN_ERROR";
        if (!errorsByCode[code]) {
          errorsByCode[code] = { count: 0, stage: "database", cases: [] };
        }
        errorsByCode[code].count++;
        if (errorsByCode[code].cases.length < 5) {
          errorsByCode[code].cases.push({
            caseNumber: c.case_number || "N/A",
            companyName: c.company_name || "未知",
            errorMessage: c.error_message,
          });
        }
      }

      healthData = {
        generatedAt: new Date().toISOString(),
        processing: {
          last24h: {
            completed: Number(result.completed_count) || 0,
            failed: Number(result.failed_count) || 0,
            inProgress: Number(result.in_progress_count) || 0,
            avgProcessingTime: Math.round(
              Number(result.avg_processing_time) || 0
            ),
          },
          errorsByCode,
          stuckCases: (stuckCases as any[]).map((c) => ({
            caseNumber: c.case_number || "N/A",
            companyName: c.company_name || "未知",
            status: c.status,
            hoursStuck: Number(c.hours_stuck) || 0,
          })),
        },
        weeklyComparison: {
          thisWeek: { uploads: 0, avgMeddic: 0 },
          lastWeek: { uploads: 0, avgMeddic: 0 },
          change: { uploadsPercent: 0, meddicDiff: 0 },
        },
      };
    }

    // 錯誤代碼對應的階段 emoji
    const errorStageEmoji: Record<string, string> = {
      AUDIO_TOO_LARGE: "📁",
      INVALID_AUDIO_FORMAT: "📁",
      FILE_DOWNLOAD_FAILED: "📥",
      TRANSCRIPTION_FAILED: "🎙️",
      TRANSCRIPTION_TIMEOUT: "🎙️",
      GROQ_API_ERROR: "🎙️",
      GEMINI_API_ERROR: "🧠",
      DATABASE_ERROR: "💾",
      RECORD_NOT_FOUND: "💾",
      UNKNOWN_ERROR: "❓",
    };

    const { processing } = healthData;
    const { last24h, errorsByCode, stuckCases } = processing;

    const completedCount = last24h.completed;
    const failedCount = last24h.failed;
    const inProgressCount = last24h.inProgress;
    const finishedCount = completedCount + failedCount;
    const successRate =
      finishedCount > 0
        ? Math.round((completedCount / finishedCount) * 100)
        : 100;

    // 健康狀態 emoji
    const healthEmoji =
      successRate >= 95 ? "🟢" : successRate >= 80 ? "🟡" : "🔴";

    // 組裝訊息
    const lines: string[] = [
      `${healthEmoji} *每日系統健康報告*`,
      `📅 ${new Date().toLocaleDateString("zh-TW")}`,
      "",
      "*📊 處理結果 (過去 24 小時)*",
      `• ✅ 成功: ${completedCount} 筆`,
      `• ❌ 失敗: ${failedCount} 筆`,
      `• ⏳ 進行中: ${inProgressCount} 筆`,
      `• 成功率: ${successRate}% (${completedCount}/${finishedCount})`,
    ];

    if (last24h.avgProcessingTime) {
      lines.push(`• 平均處理時間: ${last24h.avgProcessingTime}s`);
    }

    // 失敗分析
    if (Object.keys(errorsByCode).length > 0) {
      lines.push("", "*❌ 失敗分析*");
      for (const [code, data] of Object.entries(errorsByCode)) {
        const emoji = errorStageEmoji[code] || "❓";
        lines.push(`• ${emoji} ${code}: ${data.count} 筆`);
        for (const c of data.cases.slice(0, 3)) {
          lines.push(`  - ${c.caseNumber} (${c.companyName})`);
        }
        if (data.cases.length > 3) {
          lines.push(`  - ...還有 ${data.cases.length - 3} 筆`);
        }
      }
    }

    // 卡住的案件
    if (stuckCases.length > 0) {
      lines.push("", "*⚠️ 需關注 (卡住 >1hr)*");
      for (const c of stuckCases) {
        const hours = c.hoursStuck.toFixed(1);
        lines.push(
          `• ${c.caseNumber} (${c.companyName}) - ${c.status} ${hours}hr`
        );
      }
    }

    const message = lines.join("\n");

    await slackClient.chat.postMessage({
      channel: "C0A7C2HUXRR",
      text: message,
    });

    console.log("[Scheduled] Daily health report sent");
  } catch (error) {
    console.error("[Scheduled] Failed to send daily health report:", error);
  }
}

async function handleWeeklyReport(env: Env): Promise<void> {
  try {
    const slackClient = new WebClient(env.SLACK_BOT_TOKEN);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const weekNumber = Math.ceil(now.getDate() / 7);

    // 本週開始日期（週日）
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // 本週結束日期（週六）
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // 格式化日期
    const weekStartStr = `${String(weekStart.getMonth() + 1).padStart(2, "0")}/${String(weekStart.getDate()).padStart(2, "0")}`;
    const weekEndStr = `${String(weekEnd.getMonth() + 1).padStart(2, "0")}/${String(weekEnd.getDate()).padStart(2, "0")}`;

    // ========================================
    // 從 KV Cache 讀取資料
    // ========================================
    const [
      cachedSystemHealth,
      cachedCloseCases,
      cachedAttention,
      cachedTodoStats,
    ] = await Promise.all([
      env.CACHE_KV.get<SystemHealthData>(KV_KEYS.SYSTEM_HEALTH, "json"),
      env.CACHE_KV.get<CloseCaseData>(KV_KEYS.CLOSE_CASES, "json"),
      env.CACHE_KV.get<AttentionNeededData>(KV_KEYS.ATTENTION_NEEDED, "json"),
      env.CACHE_KV.get<TodoStatsData>(KV_KEYS.TODO_STATS, "json"),
    ]);

    // 判斷是否有 cache
    const hasCache = cachedSystemHealth && cachedCloseCases && cachedAttention;

    // 如果沒有 cache，fallback 到 SQL
    const sql = hasCache ? null : neon(env.DATABASE_URL);

    // ========================================
    // 資料整備
    // ========================================
    let thisWeekUploads = 0;
    let lastWeekUploads = 0;
    let thisWeekMeddic = 0;
    let lastWeekMeddic = 0;
    let uploadChange = 0;
    let meddicChange = 0;
    let thisWeekWon = 0;
    let thisWeekLost = 0;
    let thisWeekWinRate = 0;
    let mtdWon = 0;
    let mtdLost = 0;
    let mtdWinRate = 0;
    let mtdUploads = 0;
    let repPerformance: any[] = [];
    let inactiveReps: any[] = [];
    let wonCases: any[] = [];
    let lostCases: any[] = [];
    let staleHighScoreOpps: any[] = [];
    let oppsWithoutTodos: any[] = [];
    let overdueTodos: any[] = [];

    if (hasCache) {
      console.log("[Scheduled] Using cached data for weekly report");

      // 從 SystemHealthData 取得週比較
      const weeklyComp = cachedSystemHealth.weeklyComparison;
      thisWeekUploads = weeklyComp.thisWeek.uploads;
      lastWeekUploads = weeklyComp.lastWeek.uploads;
      thisWeekMeddic = weeklyComp.thisWeek.avgMeddic;
      lastWeekMeddic = weeklyComp.lastWeek.avgMeddic;
      uploadChange = weeklyComp.change.uploadsPercent;
      meddicChange = weeklyComp.change.meddicDiff;

      // 從 CloseCaseData 取得 Close Case 資料
      thisWeekWon = cachedCloseCases.thisWeek.wonCount;
      thisWeekLost = cachedCloseCases.thisWeek.lostCount;
      thisWeekWinRate = cachedCloseCases.thisWeek.winRate;
      mtdWon = cachedCloseCases.mtd.wonCount;
      mtdLost = cachedCloseCases.mtd.lostCount;
      mtdWinRate = cachedCloseCases.mtd.winRate;
      wonCases = cachedCloseCases.thisWeek.won.map((c) => ({
        company_name: c.companyName,
        user_name: c.userName,
        status: "won",
      }));
      lostCases = cachedCloseCases.thisWeek.lost.map((c) => ({
        company_name: c.companyName,
        user_name: c.userName,
        rejection_reason: c.rejectionReason,
        selected_competitor: c.selectedCompetitor,
        status: "lost",
      }));

      // 從 AttentionNeededData 取得需關注資料
      inactiveReps = cachedAttention.inactiveReps.map((r) => ({
        user_name: r.userName,
      }));
      staleHighScoreOpps = cachedAttention.staleHighScore.map((o) => ({
        company_name: o.companyName,
        overall_score: o.meddicScore,
        user_name: o.userName,
        days_since_contact: o.daysSinceContact,
      }));
      oppsWithoutTodos = cachedAttention.noTodos.map((o) => ({
        company_name: o.companyName,
        user_name: o.userName,
        days_since_created: o.daysSinceCreated,
      }));

      // 從 TodoStatsData 取得逾期待辦
      if (cachedTodoStats) {
        overdueTodos = Object.entries(cachedTodoStats.overdue.byUser).map(
          ([_userId, data]) => ({
            user_name: data.userName,
            overdue_count: data.count,
          })
        );
      }

      // 團隊表現需要額外取得，嘗試從 team performance 取得
      const cachedTeamPerf = await env.CACHE_KV.get<{
        weeklyPerformance: WeeklyRepPerformance[];
      }>(KV_KEYS.TEAM_PERFORMANCE("default"), "json");
      if (cachedTeamPerf?.weeklyPerformance) {
        repPerformance = cachedTeamPerf.weeklyPerformance.map((r) => ({
          user_name: r.userName,
          week_uploads: r.weekUploads,
          avg_meddic: r.avgMeddic,
          week_won: r.weekWon,
        }));
      }
    } else {
      // Fallback: 直接 SQL 查詢
      console.warn(
        "[Scheduled] KV cache miss, falling back to SQL for weekly report"
      );

      // MTD 開始日期（本月1號）
      const mtdStart = new Date(year, month - 1, 1);

      // 上週開始日期
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      // 7 天前（用於高分未跟進判斷）
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // 1. 本週 vs 上週概覽統計
      const overviewStats = await sql!`
      SELECT
        COUNT(*) FILTER (WHERE c.created_at >= ${weekStart.toISOString()} AND c.status = 'completed') as this_week_uploads,
        COUNT(*) FILTER (WHERE c.created_at >= ${lastWeekStart.toISOString()} AND c.created_at < ${weekStart.toISOString()} AND c.status = 'completed') as last_week_uploads,
        AVG(m.overall_score) FILTER (WHERE c.created_at >= ${weekStart.toISOString()}) as this_week_avg_meddic,
        AVG(m.overall_score) FILTER (WHERE c.created_at >= ${lastWeekStart.toISOString()} AND c.created_at < ${weekStart.toISOString()}) as last_week_avg_meddic
      FROM conversations c
      LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
      WHERE c.created_at >= ${lastWeekStart.toISOString()}
        AND c.status NOT IN ('archived', 'failed')
    `;

      // ========================================
      // 2. Close Case 統計 (本週 + MTD)
      // ========================================
      const closeCaseStats = await sql!`
        SELECT
          COUNT(*) FILTER (WHERE o.won_at >= ${weekStart.toISOString()}) as this_week_won,
          COUNT(*) FILTER (WHERE o.lost_at >= ${weekStart.toISOString()}) as this_week_lost,
          COUNT(*) FILTER (WHERE o.won_at >= ${mtdStart.toISOString()}) as mtd_won,
          COUNT(*) FILTER (WHERE o.lost_at >= ${mtdStart.toISOString()}) as mtd_lost
        FROM opportunities o
        WHERE (o.won_at >= ${mtdStart.toISOString()} OR o.lost_at >= ${mtdStart.toISOString()})
      `;

      // ========================================
      // 3. 本週 Close Case 詳情
      // ========================================
      const closedCasesThisWeek = await sql!`
        SELECT
          o.customer_number,
          o.company_name,
          o.status,
          o.rejection_reason,
          o.selected_competitor,
          u.name as user_name
        FROM opportunities o
        JOIN "user" u ON o.user_id = u.id
        WHERE (o.won_at >= ${weekStart.toISOString()} OR o.lost_at >= ${weekStart.toISOString()})
        ORDER BY COALESCE(o.won_at, o.lost_at) DESC
        LIMIT 10
      `;

      // ========================================
      // 4. 各業務本週表現（上傳數 + 平均 MEDDIC + Won）
      // ========================================
      const repPerfResult = await sql!`
        SELECT
          u.id as user_id,
          u.name as user_name,
          COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= ${weekStart.toISOString()} AND c.status = 'completed') as week_uploads,
          ROUND(AVG(m.overall_score) FILTER (WHERE c.created_at >= ${weekStart.toISOString()})) as avg_meddic,
          COUNT(DISTINCT o2.id) FILTER (WHERE o2.won_at >= ${weekStart.toISOString()}) as week_won
        FROM "user" u
        LEFT JOIN conversations c ON c.created_by = u.id AND c.status NOT IN ('archived', 'failed')
        LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
        LEFT JOIN opportunities o2 ON o2.user_id = u.id
        WHERE EXISTS (
          SELECT 1 FROM conversations c2 WHERE c2.created_by = u.id
        )
        GROUP BY u.id, u.name
        ORDER BY week_uploads DESC, avg_meddic DESC NULLS LAST
      `;

      // ========================================
      // 5. 本週未上傳的業務
      // ========================================
      const inactiveRepsResult = await sql!`
        SELECT u.name as user_name
        FROM "user" u
        WHERE EXISTS (
          SELECT 1 FROM conversations c WHERE c.created_by = u.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM conversations c2
          WHERE c2.created_by = u.id
            AND c2.created_at >= ${weekStart.toISOString()}
            AND c2.status NOT IN ('archived', 'failed')
        )
      `;

      // ========================================
      // 6. 高分但超過 7 天未跟進的機會
      // ========================================
      const staleOppsResult = await sql!`
        SELECT
          o.customer_number,
          o.company_name,
          m.overall_score,
          u.name as user_name,
          EXTRACT(DAY FROM NOW() - o.last_contacted_at) as days_since_contact
        FROM opportunities o
        JOIN "user" u ON o.user_id = u.id
        JOIN meddic_analyses m ON m.opportunity_id = o.id
        WHERE o.status NOT IN ('won', 'lost')
          AND m.overall_score >= 70
          AND (o.last_contacted_at IS NULL OR o.last_contacted_at < ${sevenDaysAgo.toISOString()})
        ORDER BY m.overall_score DESC
        LIMIT 5
      `;

      // ========================================
      // 7. 逾期待辦統計（按業務）
      // ========================================
      const overdueTodosResult = await sql!`
        SELECT
          u.name as user_name,
          COUNT(*) as overdue_count
        FROM sales_todos st
        JOIN "user" u ON st.user_id = u.id
        WHERE st.status = 'pending'
          AND st.due_date < ${now.toISOString()}
        GROUP BY u.id, u.name
        ORDER BY overdue_count DESC
      `;

      // ========================================
      // 8. 未成交/未拒絕且無待辦的機會（可能被遺忘）
      // ========================================
      const oppsWithoutTodosResult = await sql!`
        SELECT
          o.customer_number,
          o.company_name,
          u.name as user_name,
          EXTRACT(DAY FROM NOW() - o.created_at) as days_since_created
        FROM opportunities o
        JOIN "user" u ON o.user_id = u.id
        WHERE o.status NOT IN ('won', 'lost')
          AND NOT EXISTS (
            SELECT 1 FROM sales_todos st
            WHERE st.opportunity_id = o.id
              AND st.status = 'pending'
          )
          AND o.created_at < ${sevenDaysAgo.toISOString()}
        ORDER BY o.created_at ASC
        LIMIT 10
      `;

      // ========================================
      // 9. MTD 累計統計
      // ========================================
      const mtdStatsResult = await sql!`
        SELECT
          COUNT(*) FILTER (WHERE c.status = 'completed') as mtd_uploads
        FROM conversations c
        WHERE c.created_at >= ${mtdStart.toISOString()}
          AND c.status NOT IN ('archived', 'failed')
      `;

      // ========================================
      // 組裝 fallback 結果
      // ========================================
      const overview = overviewStats[0] || {};
      const closeCase = closeCaseStats[0] || {};
      const mtd = mtdStatsResult[0] || {};

      thisWeekUploads = Number(overview.this_week_uploads) || 0;
      lastWeekUploads = Number(overview.last_week_uploads) || 0;
      thisWeekMeddic = Number(overview.this_week_avg_meddic) || 0;
      lastWeekMeddic = Number(overview.last_week_avg_meddic) || 0;

      thisWeekWon = Number(closeCase.this_week_won) || 0;
      thisWeekLost = Number(closeCase.this_week_lost) || 0;
      thisWeekWinRate =
        thisWeekWon + thisWeekLost > 0
          ? Math.round((thisWeekWon / (thisWeekWon + thisWeekLost)) * 100)
          : 0;

      mtdWon = Number(closeCase.mtd_won) || 0;
      mtdLost = Number(closeCase.mtd_lost) || 0;
      mtdWinRate =
        mtdWon + mtdLost > 0
          ? Math.round((mtdWon / (mtdWon + mtdLost)) * 100)
          : 0;

      mtdUploads = Number(mtd.mtd_uploads) || 0;
      repPerformance = repPerfResult as any[];
      inactiveReps = inactiveRepsResult as any[];
      staleHighScoreOpps = staleOppsResult as any[];
      oppsWithoutTodos = oppsWithoutTodosResult as any[];
      overdueTodos = overdueTodosResult as any[];

      // 整理 Close Case 資料
      wonCases = (closedCasesThisWeek as any[]).filter(
        (c) => c.status === "won"
      );
      lostCases = (closedCasesThisWeek as any[]).filter(
        (c) => c.status === "lost"
      );

      uploadChange =
        lastWeekUploads > 0
          ? Math.round(
              ((thisWeekUploads - lastWeekUploads) / lastWeekUploads) * 100
            )
          : 0;
      meddicChange = Math.round(thisWeekMeddic - lastWeekMeddic);
    }

    // WoW 變化字串
    const uploadChangeStr =
      uploadChange >= 0 ? `↑${uploadChange}%` : `↓${Math.abs(uploadChange)}%`;
    const meddicChangeStr =
      meddicChange >= 0 ? `↑${meddicChange}` : `↓${Math.abs(meddicChange)}`;

    const lines: string[] = [
      `📊 *業務週報 (${year}/${String(month).padStart(2, "0")} W${weekNumber})*`,
      `📆 ${weekStartStr} (日) - ${weekEndStr} (六)`,
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "📈 *本週概覽*",
      "━━━━━━━━━━━━━━━━━━━━",
      `• 音檔上傳: ${thisWeekUploads} 筆 (${uploadChangeStr} vs 上週)`,
      `• 平均 MEDDIC: ${Math.round(thisWeekMeddic)} 分 (${meddicChangeStr} vs 上週)`,
      `• Close Case: Won ${thisWeekWon} / Lost ${thisWeekLost} (Win Rate ${thisWeekWinRate}%)`,
    ];

    // 團隊表現
    lines.push(
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "👥 *團隊表現*",
      "━━━━━━━━━━━━━━━━━━━━"
    );
    const rankEmojis = ["🥇", "🥈", "🥉"];
    const activeReps = (repPerformance as any[]).filter(
      (r) => Number(r.week_uploads) > 0
    );
    for (let i = 0; i < activeReps.length && i < 10; i++) {
      const rep = activeReps[i];
      const rank = i < 3 ? rankEmojis[i] : `${i + 1}.`;
      const meddic = rep.avg_meddic ? `${rep.avg_meddic}分` : "-";
      const won = Number(rep.week_won) > 0 ? ` | Won ${rep.week_won}` : "";
      lines.push(
        `${rank} ${rep.user_name}: ${rep.week_uploads}筆 | ${meddic}${won}`
      );
    }

    // 本週未上傳
    if ((inactiveReps as any[]).length > 0) {
      const names = (inactiveReps as any[]).map((r) => r.user_name).join("、");
      lines.push("", `⚠️ 本週未上傳: ${names}`);
    }

    // 本週 Close Case 詳情
    if (wonCases.length > 0 || lostCases.length > 0) {
      lines.push(
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "🏆 *本週 Close Case*",
        "━━━━━━━━━━━━━━━━━━━━"
      );

      if (wonCases.length > 0) {
        lines.push(`✅ Won (${thisWeekWon}筆):`);
        for (const c of wonCases.slice(0, 3)) {
          lines.push(`  • ${c.company_name} - ${c.user_name}`);
        }
        if (wonCases.length > 3) {
          lines.push(`  • ...還有 ${wonCases.length - 3} 筆`);
        }
      }

      if (lostCases.length > 0) {
        lines.push(`❌ Lost (${thisWeekLost}筆):`);
        for (const c of lostCases.slice(0, 3)) {
          const reason = c.selected_competitor
            ? `選擇競品 (${c.selected_competitor})`
            : c.rejection_reason || "未註明原因";
          lines.push(`  • ${c.company_name} - ${reason}`);
        }
        if (lostCases.length > 3) {
          lines.push(`  • ...還有 ${lostCases.length - 3} 筆`);
        }
      }
    }

    // 需關注區塊
    const hasStaleOpps = (staleHighScoreOpps as any[]).length > 0;
    const hasOverdueTodos = (overdueTodos as any[]).length > 0;
    const hasOppsWithoutTodos = (oppsWithoutTodos as any[]).length > 0;

    if (hasStaleOpps || hasOverdueTodos || hasOppsWithoutTodos) {
      lines.push(
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "⚠️ *需關注*",
        "━━━━━━━━━━━━━━━━━━━━"
      );

      if (hasStaleOpps) {
        lines.push(
          `🔥 高分但 >7天未跟進 (${(staleHighScoreOpps as any[]).length}筆):`
        );
        for (const opp of (staleHighScoreOpps as any[]).slice(0, 3)) {
          const days = opp.days_since_contact
            ? Math.round(Number(opp.days_since_contact))
            : "N/A";
          lines.push(
            `  • ${opp.company_name} (${opp.overall_score}分) - ${opp.user_name} [${days}天]`
          );
        }
      }

      if (hasOppsWithoutTodos) {
        lines.push(
          `🕳️ 無待辦的進行中機會 (${(oppsWithoutTodos as any[]).length}筆):`
        );
        for (const opp of (oppsWithoutTodos as any[]).slice(0, 3)) {
          const days = Math.round(Number(opp.days_since_created));
          lines.push(
            `  • ${opp.company_name} - ${opp.user_name} [建立 ${days} 天]`
          );
        }
        if ((oppsWithoutTodos as any[]).length > 3) {
          lines.push(
            `  • ...還有 ${(oppsWithoutTodos as any[]).length - 3} 筆`
          );
        }
      }

      if (hasOverdueTodos) {
        const totalOverdue = (overdueTodos as any[]).reduce(
          (sum, t) => sum + Number(t.overdue_count),
          0
        );
        const todoSummary = (overdueTodos as any[])
          .slice(0, 3)
          .map((t) => `${t.user_name}: ${t.overdue_count}筆`)
          .join("、");
        lines.push(`📋 逾期待辦 (${totalOverdue}筆): ${todoSummary}`);
      }
    }

    // MTD 累計
    lines.push(
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "📊 *MTD 累計*",
      "━━━━━━━━━━━━━━━━━━━━",
      `• 上傳: ${mtdUploads} 筆`,
      `• Won: ${mtdWon} 筆 | Lost: ${mtdLost} 筆 | Win Rate ${mtdWinRate}%`,
      "",
      `🔗 <${env.WEB_APP_URL}/reports|查看詳細報表>`
    );

    const message = lines.join("\n");

    await slackClient.chat.postMessage({
      channel: "C0A4F762FE0", // #sales-ai-reports
      text: message,
    });

    console.log("[Scheduled] Weekly report sent");
  } catch (error) {
    console.error("[Scheduled] Failed to send weekly report:", error);
  }
}

// ============================================================
// Daily Todo Reminder Handler
// ============================================================

interface TodoWithOpportunity {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  dueDate: Date;
  opportunityId: string | null;
  companyName: string | null;
  customerNumber: string | null;
}

/**
 * 每日待辦提醒 Handler
 * 1. 查詢今日 + 逾期的 pending 待辦，發送 Slack DM 給各用戶
 * 2. 查詢需要提前提醒的待辦（根據 remindDays 設定），發送個別提醒
 */
async function handleDailyTodoReminder(env: Env): Promise<void> {
  try {
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });
    const slackClient = new WebClient(env.SLACK_BOT_TOKEN);

    // 取得今天結束時間 (UTC+8)
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    console.log(
      `[DailyTodoReminder] Querying pending todos due before: ${todayEnd.toISOString()}`
    );

    // ========================================
    // Part 1: 查詢需要個別提前提醒的待辦
    // 條件: status=pending, reminderSent=false, remindDays>0, dueDate - remindDays <= today
    // ========================================
    console.log("[DailyTodoReminder] Checking for advance reminder todos...");

    const advanceReminderTodos = await sql`
      SELECT
        st.id,
        st.user_id as "userId",
        st.title,
        st.description,
        st.due_date as "dueDate",
        st.remind_days as "remindDays",
        st.opportunity_id as "opportunityId",
        o.company_name as "companyName",
        o.customer_number as "customerNumber",
        up.slack_user_id as "slackUserId"
      FROM sales_todos st
      LEFT JOIN opportunities o ON st.opportunity_id = o.id
      LEFT JOIN user_profiles up ON st.user_id = up.user_id
      WHERE st.status = 'pending'
        AND st.reminder_sent = false
        AND st.remind_days IS NOT NULL
        AND st.remind_days > 0
        AND st.due_date > ${todayEnd.toISOString()}
        AND st.due_date - INTERVAL '1 day' * st.remind_days <= ${todayEnd.toISOString()}
    `;

    console.log(
      `[DailyTodoReminder] Found ${advanceReminderTodos.length} advance reminder todos`
    );

    // 發送個別提前提醒
    for (const todo of advanceReminderTodos) {
      if (!todo.slackUserId) {
        console.log(
          `[DailyTodoReminder] User ${todo.userId} has no Slack ID, skipping advance reminder`
        );
        continue;
      }

      try {
        const daysUntilDue = Math.ceil(
          (new Date(todo.dueDate).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const displayPrefix =
          [todo.customerNumber, todo.companyName].filter(Boolean).join(" ") ||
          "無客戶";

        await slackClient.chat.postMessage({
          channel: todo.slackUserId,
          text: `⏰ 提前提醒 - ${todo.title}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `⏰ *提前提醒*\n\n*[${displayPrefix}] ${todo.title}*\n📅 將於 ${daysUntilDue} 天後到期 (${new Date(todo.dueDate).toISOString().split("T")[0]})`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "✅ 完成", emoji: true },
                  action_id: "complete_todo",
                  value: JSON.stringify({
                    todoId: todo.id,
                    todoTitle: todo.title,
                    opportunityId: todo.opportunityId,
                    customerNumber: todo.customerNumber,
                    companyName: todo.companyName,
                  }),
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "📅 改期", emoji: true },
                  action_id: "postpone_todo",
                  value: JSON.stringify({
                    todoId: todo.id,
                    todoTitle: todo.title,
                  }),
                },
              ],
            },
          ],
        });

        // 更新 reminderSent 狀態
        await db
          .update(salesTodos)
          .set({
            reminderSent: true,
            reminderSentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(salesTodos.id, todo.id));

        console.log(
          `[DailyTodoReminder] Sent advance reminder for todo ${todo.id} to ${todo.slackUserId}`
        );
      } catch (sendError) {
        console.error(
          `[DailyTodoReminder] Failed to send advance reminder for ${todo.id}:`,
          sendError
        );
      }
    }

    // ========================================
    // Part 2: 查詢今日 + 逾期的 pending 待辦（原有邏輯）
    // ========================================
    const pendingTodos = await db
      .select({
        id: salesTodos.id,
        userId: salesTodos.userId,
        title: salesTodos.title,
        description: salesTodos.description,
        dueDate: salesTodos.dueDate,
        opportunityId: salesTodos.opportunityId,
        companyName: opportunities.companyName,
        customerNumber: opportunities.customerNumber,
      })
      .from(salesTodos)
      .leftJoin(opportunities, eq(salesTodos.opportunityId, opportunities.id))
      .where(
        and(eq(salesTodos.status, "pending"), lte(salesTodos.dueDate, todayEnd))
      );

    console.log(
      `[DailyTodoReminder] Found ${pendingTodos.length} pending todos for today/overdue`
    );

    if (pendingTodos.length === 0) {
      console.log("[DailyTodoReminder] No pending todos to remind");
      return;
    }

    // 2. 查詢 userProfiles 取得 slackUserId 映射
    const userIds = [...new Set(pendingTodos.map((t) => t.userId))];
    const profiles = await db
      .select({
        userId: userProfiles.userId,
        slackUserId: userProfiles.slackUserId,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, userIds));

    const userSlackMap = new Map<string, string>();
    for (const profile of profiles) {
      if (profile.slackUserId) {
        userSlackMap.set(profile.userId, profile.slackUserId);
      }
    }

    console.log(
      `[DailyTodoReminder] Found ${userSlackMap.size} users with Slack IDs`
    );

    // 3. 按用戶分組
    const todosByUser = new Map<string, TodoWithOpportunity[]>();
    for (const todo of pendingTodos) {
      const slackUserId = userSlackMap.get(todo.userId);
      if (!slackUserId) {
        console.log(
          `[DailyTodoReminder] User ${todo.userId} has no Slack ID, skipping`
        );
        continue;
      }

      if (!todosByUser.has(slackUserId)) {
        todosByUser.set(slackUserId, []);
      }
      todosByUser.get(slackUserId)!.push(todo as TodoWithOpportunity);
    }

    // 4. 對每個用戶發送 Slack DM
    const todoIdsToUpdate: string[] = [];

    for (const [slackUserId, todos] of todosByUser) {
      try {
        // 分類待辦：逾期 vs 今日
        const overdueTodos: TodoWithOpportunity[] = [];
        const todayTodos: TodoWithOpportunity[] = [];

        for (const todo of todos) {
          if (todo.dueDate < todayStart) {
            overdueTodos.push(todo);
          } else {
            todayTodos.push(todo);
          }
        }

        // 建立 Slack blocks
        const blocks = buildDailyReminderBlocks(
          overdueTodos,
          todayTodos,
          env.WEB_APP_URL
        );

        const totalCount = overdueTodos.length + todayTodos.length;
        const fallbackText = `📋 今日待辦提醒 - 您有 ${totalCount} 項待處理事項`;

        // 發送 Slack DM
        const result = await slackClient.chat.postMessage({
          channel: slackUserId,
          blocks,
          text: fallbackText,
        });

        console.log(
          `[DailyTodoReminder] Sent reminder to ${slackUserId}: ${totalCount} todos`
        );

        // 收集需要更新的 todo IDs
        todoIdsToUpdate.push(...todos.map((t) => t.id));

        // 更新 slackMessageTs (用於後續互動)
        if (result.ts) {
          for (const todo of todos) {
            await db
              .update(salesTodos)
              .set({
                slackMessageTs: result.ts,
                updatedAt: new Date(),
              })
              .where(eq(salesTodos.id, todo.id));
          }
        }
      } catch (sendError) {
        console.error(
          `[DailyTodoReminder] Failed to send reminder to ${slackUserId}:`,
          sendError
        );
      }
    }

    // 5. 批次更新 reminderSent 和 reminderSentAt
    if (todoIdsToUpdate.length > 0) {
      await db
        .update(salesTodos)
        .set({
          reminderSent: true,
          reminderSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(salesTodos.id, todoIdsToUpdate));

      console.log(
        `[DailyTodoReminder] Updated ${todoIdsToUpdate.length} todos with reminder status`
      );
    }

    console.log("[DailyTodoReminder] Daily todo reminder completed");
  } catch (error) {
    console.error(
      "[DailyTodoReminder] Failed to send daily todo reminder:",
      error
    );
  }
}

/**
 * 建構每日待辦提醒 Slack Blocks
 */
function buildDailyReminderBlocks(
  overdueTodos: TodoWithOpportunity[],
  todayTodos: TodoWithOpportunity[],
  webAppUrl: string
): any[] {
  const blocks: any[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "📋 今日待辦提醒",
      emoji: true,
    },
  });

  // 統計摘要
  const totalCount = overdueTodos.length + todayTodos.length;
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `📅 ${new Date().toLocaleDateString("zh-TW")} | 共 ${totalCount} 項待處理`,
      },
    ],
  });

  // 逾期待辦 (高優先級)
  if (overdueTodos.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🚨 *逾期待辦 (${overdueTodos.length} 項)*`,
      },
    });

    for (const todo of overdueTodos.slice(0, 5)) {
      // 最多顯示 5 項
      const daysOverdue = Math.ceil(
        (Date.now() - todo.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const dueDateStr = todo.dueDate.toISOString().split("T")[0];
      const displayPrefixParts: string[] = [];
      if (todo.customerNumber) {
        displayPrefixParts.push(todo.customerNumber);
      }
      if (todo.companyName) {
        displayPrefixParts.push(todo.companyName);
      }
      const displayPrefix =
        displayPrefixParts.length > 0 ? displayPrefixParts.join(" ") : "無客戶";

      // Section block（只有文字）
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔴 *[${displayPrefix}] ${todo.title}*\n   📅 預計 ${dueDateStr} → 已逾期 ${daysOverdue} 天`,
        },
      });

      // Actions block（四個獨立按鈕）
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "✅ 完成", emoji: true },
            action_id: "complete_todo",
            value: JSON.stringify({
              todoId: todo.id,
              todoTitle: todo.title,
              opportunityId: todo.opportunityId,
              customerNumber: todo.customerNumber,
              companyName: todo.companyName,
            }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "📅 改期", emoji: true },
            action_id: "postpone_todo",
            value: JSON.stringify({ todoId: todo.id, todoTitle: todo.title }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "🎉 成交", emoji: true },
            action_id: "win_todo",
            style: "primary",
            value: JSON.stringify({
              todoId: todo.id,
              todoTitle: todo.title,
              opportunityId: todo.opportunityId,
              customerNumber: todo.customerNumber,
              companyName: todo.companyName,
            }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "👋 拒絕", emoji: true },
            action_id: "lose_todo",
            value: JSON.stringify({
              todoId: todo.id,
              todoTitle: todo.title,
              opportunityId: todo.opportunityId,
              customerNumber: todo.customerNumber,
              companyName: todo.companyName,
            }),
          },
        ],
      });
    }

    if (overdueTodos.length > 5) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_還有 ${overdueTodos.length - 5} 項逾期待辦..._`,
          },
        ],
      });
    }
  }

  // 今日待辦
  if (todayTodos.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📌 *今日待辦 (${todayTodos.length} 項)*`,
      },
    });

    for (const todo of todayTodos.slice(0, 5)) {
      // 最多顯示 5 項
      const dueDateStr = todo.dueDate.toISOString().split("T")[0];
      const displayPrefixParts: string[] = [];
      if (todo.customerNumber) {
        displayPrefixParts.push(todo.customerNumber);
      }
      if (todo.companyName) {
        displayPrefixParts.push(todo.companyName);
      }
      const displayPrefix =
        displayPrefixParts.length > 0 ? displayPrefixParts.join(" ") : "無客戶";

      // Section block（只有文字）
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `⚪ *[${displayPrefix}] ${todo.title}*\n   📅 預計 ${dueDateStr} → 今日到期`,
        },
      });

      // Actions block（四個獨立按鈕）
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "✅ 完成", emoji: true },
            action_id: "complete_todo",
            value: JSON.stringify({
              todoId: todo.id,
              todoTitle: todo.title,
              opportunityId: todo.opportunityId,
              customerNumber: todo.customerNumber,
              companyName: todo.companyName,
            }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "📅 改期", emoji: true },
            action_id: "postpone_todo",
            value: JSON.stringify({ todoId: todo.id, todoTitle: todo.title }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "🎉 成交", emoji: true },
            action_id: "win_todo",
            style: "primary",
            value: JSON.stringify({
              todoId: todo.id,
              todoTitle: todo.title,
              opportunityId: todo.opportunityId,
              customerNumber: todo.customerNumber,
              companyName: todo.companyName,
            }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "👋 拒絕", emoji: true },
            action_id: "lose_todo",
            value: JSON.stringify({
              todoId: todo.id,
              todoTitle: todo.title,
              opportunityId: todo.opportunityId,
              customerNumber: todo.customerNumber,
              companyName: todo.companyName,
            }),
          },
        ],
      });
    }

    if (todayTodos.length > 5) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_還有 ${todayTodos.length - 5} 項今日待辦..._`,
          },
        ],
      });
    }
  }

  // 操作按鈕
  blocks.push({ type: "divider" });
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "📊 查看所有待辦",
          emoji: true,
        },
        url: `${webAppUrl}/todos`,
        style: "primary",
      },
    ],
  });

  return blocks;
}

// ============================================================
// Pending Follow-up Reminder
// ============================================================

/**
 * 提醒業務設定 Follow-up
 * 查詢 24-72 小時內完成但未設定 follow-up 的對話
 */
async function handlePendingFollowUpReminder(env: Env): Promise<void> {
  try {
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });
    const slackClient = new WebClient(env.SLACK_BOT_TOKEN);

    // 時間範圍：24-72 小時前完成的對話
    const now = new Date();
    const hoursAgo24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const hoursAgo72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    console.log(
      `[PendingFollowUp] Querying conversations between ${hoursAgo72.toISOString()} and ${hoursAgo24.toISOString()}`
    );

    // 查詢未設定 follow-up 的已完成對話
    const pendingConversations = await db
      .select({
        id: conversations.id,
        caseNumber: conversations.caseNumber,
        title: conversations.title,
        slackUserId: conversations.slackUserId,
        slackUsername: conversations.slackUsername,
        createdAt: conversations.createdAt,
        opportunityId: conversations.opportunityId,
        companyName: opportunities.companyName,
      })
      .from(conversations)
      .leftJoin(
        opportunities,
        eq(conversations.opportunityId, opportunities.id)
      )
      .where(
        and(
          eq(conversations.status, "completed"),
          eq(conversations.followUpStatus, "pending"),
          gte(conversations.createdAt, hoursAgo72),
          lte(conversations.createdAt, hoursAgo24)
        )
      );

    console.log(
      `[PendingFollowUp] Found ${pendingConversations.length} conversations without follow-up`
    );

    if (pendingConversations.length === 0) {
      console.log("[PendingFollowUp] No pending follow-ups to remind");
      return;
    }

    // 按 slackUserId 分組
    const byUser = new Map<string, typeof pendingConversations>();
    for (const conv of pendingConversations) {
      if (!conv.slackUserId) {
        console.log(
          `[PendingFollowUp] Conversation ${conv.caseNumber} has no slackUserId, skipping`
        );
        continue;
      }

      if (!byUser.has(conv.slackUserId)) {
        byUser.set(conv.slackUserId, []);
      }
      byUser.get(conv.slackUserId)!.push(conv);
    }

    console.log(`[PendingFollowUp] Sending reminders to ${byUser.size} users`);

    // 發送提醒給每個用戶
    for (const [slackUserId, convs] of byUser) {
      try {
        const blocks = buildPendingFollowUpBlocks(convs);

        await slackClient.chat.postMessage({
          channel: slackUserId,
          blocks,
          text: `⚠️ 您有 ${convs.length} 件案件尚未設定後續追蹤`,
        });

        console.log(
          `[PendingFollowUp] Sent reminder to ${slackUserId}: ${convs.length} conversations`
        );
      } catch (sendError) {
        console.error(
          `[PendingFollowUp] Failed to send reminder to ${slackUserId}:`,
          sendError
        );
      }
    }

    console.log("[PendingFollowUp] Pending follow-up reminder completed");
  } catch (error) {
    console.error(
      "[PendingFollowUp] Failed to send pending follow-up reminder:",
      error
    );
  }
}

/**
 * 建構 Pending Follow-up 提醒 Slack Blocks
 */
function buildPendingFollowUpBlocks(
  convs: Array<{
    id: string;
    caseNumber: string | null;
    title: string | null;
    createdAt: Date | null;
    companyName: string | null;
  }>
): any[] {
  const blocks: any[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "⚠️ 案件尚未設定後續追蹤",
      emoji: true,
    },
  });

  // 說明
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `您有 *${convs.length}* 件已完成分析的案件尚未設定 Follow-up 或標記為拒絕：`,
    },
  });

  blocks.push({ type: "divider" });

  // 列出每個案件
  for (const conv of convs.slice(0, 10)) {
    // 最多顯示 10 項
    const hoursAgo = conv.createdAt
      ? Math.round((Date.now() - conv.createdAt.getTime()) / (1000 * 60 * 60))
      : 0;

    const displayName = conv.companyName || conv.title || "未命名案件";
    const caseInfo = conv.caseNumber ? `\`${conv.caseNumber}\`` : "";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `• ${caseInfo} *${displayName}*\n   _已過 ${hoursAgo} 小時_`,
      },
    });
  }

  if (convs.length > 10) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_還有 ${convs.length - 10} 件案件..._`,
        },
      ],
    });
  }

  blocks.push({ type: "divider" });

  // 提示
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "💡 請上傳音檔時設定 Follow-up 待辦，或標記客戶已拒絕，以利追蹤案件進度。",
      },
    ],
  });

  return blocks;
}
