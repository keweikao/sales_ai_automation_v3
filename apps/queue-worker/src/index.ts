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
} from "@Sales_ai_automation_v3/db/schema";
import {
  createGeminiClient,
  createGroqWhisperService,
  createOrchestrator,
  createR2Service,
  createSlackNotificationService,
} from "@Sales_ai_automation_v3/services";
import { randomUUID } from "node:crypto";
import type { MessageBatch } from "@cloudflare/workers-types";
import { neon, neonConfig } from "@neondatabase/serverless";

// 配置 Neon 使用 Cloudflare Workers 的 fetch
neonConfig.fetchFunction = fetch;
import {
  type AppError,
  errors,
  formatErrorForLog,
  isAppError,
} from "@sales_ai_automation_v3/shared/errors";
import type { TranscriptionMessage } from "@sales_ai_automation_v3/shared/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

// ============================================================
// Types
// ============================================================

export interface Env {
  // Database
  DATABASE_URL: string;

  // AI Services
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;

  // R2 Storage
  CLOUDFLARE_R2_ACCESS_KEY: string;
  CLOUDFLARE_R2_SECRET_KEY: string;
  CLOUDFLARE_R2_ENDPOINT: string;
  CLOUDFLARE_R2_BUCKET: string;

  // Slack
  SLACK_BOT_TOKEN: string;

  // Environment
  ENVIRONMENT: string;
}

// Extended TranscriptionMessage with Slack user info
export interface QueueTranscriptionMessage extends TranscriptionMessage {
  caseNumber: string;
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

    // 初始化 Slack 通知服務
    const slackService = createSlackNotificationService({
      token: env.SLACK_BOT_TOKEN,
    });

    for (const message of batch.messages) {
      const startTime = Date.now();
      const {
        conversationId,
        audioUrl,
        opportunityId,
        caseNumber,
        metadata,
        slackUser,
      } = message.body;

      // threadTs 需要在 try block 之前宣告,以便在 catch block 中使用
      let threadTs: string | undefined;

      try {
        console.log(`[Queue] 🎬 Processing conversation ${conversationId}`);
        console.log(
          `[Queue]    File: ${metadata.fileName} (${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB)`
        );

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
        const audioBuffer = await r2Service.downloadAudio(audioKey);
        console.log(`[Queue] ✓ Downloaded ${audioBuffer.length} bytes`);

        // ========================================
        // Step 2: Whisper 轉錄
        // ========================================
        console.log("[Queue] 🎙️  Starting Whisper transcription...");
        const whisperService = createGroqWhisperService(env.GROQ_API_KEY);
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
          console.log("[Queue] DEBUG: duration =", duration, "type =", typeof duration);
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
        console.log("[Queue] 🧠 Starting MEDDIC analysis...");
        const geminiClient = createGeminiClient(env.GEMINI_API_KEY);
        const orchestrator = createOrchestrator(geminiClient);

        const analysisResult = await orchestrator.analyze(
          transcriptResult.segments?.map((seg) => ({
            speaker: seg.speaker || "Unknown",
            text: seg.text,
            start: seg.start,
            end: seg.end,
          })) || [],
          {
            leadId: opportunityId,
            conversationId,
            salesRep: slackUser?.username || "Unknown",
            conversationDate: new Date(),
          }
        );
        console.log(
          `[Queue] ✓ Analysis completed: ${analysisResult.overallScore}/100`
        );

        // ========================================
        // Step 5: 保存分析結果到 meddicAnalyses 表
        // ========================================
        console.log(
          "[Queue] 💾 Saving analysis results to meddicAnalyses table..."
        );
        await db.insert(meddicAnalyses).values({
          id: randomUUID(),
          conversationId,
          opportunityId,
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
        console.log("[Queue] ✓ MEDDIC analysis saved to meddicAnalyses table");

        // ========================================
        // Step 6: 更新 conversation 狀態為 completed
        // ========================================
        console.log("[Queue] 💾 Updating conversation status to completed...");
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
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));
        console.log("[Queue] ✓ Conversation status updated to completed");

        // ========================================
        // Step 6: 發送 Slack 完成通知
        // ========================================
        if (slackUser?.id) {
          try {
            const processingTimeMs = Date.now() - startTime;

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

            await slackService.notifyProcessingCompleted({
              userId: slackUser.id,
              conversationId,
              caseNumber,
              analysisResult: {
                overallScore: analysisResult.overallScore ?? 0,
                qualificationStatus: analysisResult.qualificationStatus ?? "unknown",
                dimensions: convertedDimensions,
                keyFindings: analysisResult.keyFindings ?? [],
                // 轉換 nextSteps 格式: {action, owner?, deadline?} -> {action, priority, owner}
                nextSteps: (analysisResult.nextSteps ?? []).map((step) => ({
                  action: step.action,
                  priority: "Medium", // 預設優先級
                  owner: step.owner || "Unassigned",
                })),
                // 轉換 risks 格式: {risk, severity, mitigation?}[] -> string[]
                risks: (analysisResult.risks ?? []).map((r) => r.risk),
              },
              processingTimeMs,
              threadTs, // 傳遞 thread_ts 以在同一個 thread 內回覆
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
        // Step 7: Ack 消息
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
};
