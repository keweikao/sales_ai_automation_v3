#!/usr/bin/env bun
/**
 * Backfill MEDDIC Analysis for old conversations
 * 補跑舊對話的 MEDDIC/PDCM/SPIN 分析
 *
 * 執行方式: bun run scripts/backfill-meddic-analysis.ts
 */

// 載入環境變數
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFiles = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/server/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    const text = readFileSync(envFile, "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

import { eq, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { randomUUID } from "node:crypto";
import * as schema from "../packages/db/src/schema";
import {
  conversations,
  meddicAnalyses,
  opportunities,
} from "../packages/db/src/schema";
import { createGeminiClient } from "../packages/services/src/llm/gemini.js";
import { createOrchestrator } from "../packages/services/src/llm/orchestrator.js";

// 設定
const DELAY_MS = 2000;
const BATCH_SIZE = 10;

// 建立資料庫連接
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ 錯誤: 缺少 DATABASE_URL 環境變數");
  process.exit(1);
}

const sql_conn = neon(DATABASE_URL);
const db = drizzle(sql_conn, { schema });

interface ConversationRecord {
  id: string;
  caseNumber: string | null;
  opportunityId: string | null;
  productLine: string | null;
  slackUsername: string | null;
  conversationDate: Date | null;
  transcript: unknown;
  companyName: string | null;
  meddicId: string | null;
}

async function main() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("❌ 缺少 GEMINI_API_KEY 環境變數!");
    process.exit(1);
  }

  console.log("[MEDDIC Backfill] 開始補跑舊對話的 MEDDIC 分析...\n");

  // 找出需要補跑的對話
  const conversationsToProcess = (await db
    .select({
      id: conversations.id,
      caseNumber: conversations.caseNumber,
      opportunityId: conversations.opportunityId,
      productLine: conversations.productLine,
      slackUsername: conversations.slackUsername,
      conversationDate: conversations.conversationDate,
      transcript: conversations.transcript,
      companyName: opportunities.companyName,
      meddicId: meddicAnalyses.id,
    })
    .from(conversations)
    .leftJoin(opportunities, eq(conversations.opportunityId, opportunities.id))
    .leftJoin(
      meddicAnalyses,
      eq(conversations.id, meddicAnalyses.conversationId)
    )
    .where(
      sql`${conversations.status} = 'completed'
        AND ${conversations.transcript} IS NOT NULL
        AND (${meddicAnalyses.id} IS NULL OR ${meddicAnalyses.overallScore} IS NULL)`
    )
    .orderBy(conversations.createdAt)) as ConversationRecord[];

  console.log(`找到 ${conversationsToProcess.length} 筆待補跑的對話\n`);

  if (conversationsToProcess.length === 0) {
    console.log("✅ 沒有待補跑的對話");
    return;
  }

  const geminiClient = createGeminiClient(geminiApiKey);
  const orchestrator = createOrchestrator(geminiClient);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < conversationsToProcess.length; i++) {
    const conv = conversationsToProcess[i];

    console.log(
      `\n[${i + 1}/${conversationsToProcess.length}] ${conv.caseNumber || conv.id}`
    );
    console.log(`  公司: ${conv.companyName || "未知"}`);

    try {
      // 檢查 transcript
      const transcript = conv.transcript as {
        segments?: Array<{
          speaker: string;
          text: string;
          start: number;
          end: number;
        }>;
        fullText?: string;
      } | null;

      if (!transcript?.segments?.length) {
        console.log("  ⏭️ 跳過：沒有 transcript segments");
        skipped++;
        continue;
      }

      console.log(`  📝 Segments: ${transcript.segments.length}`);

      // 執行 MEDDIC 分析
      const startTime = Date.now();
      const analysisResult = await orchestrator.analyze(
        transcript.segments.map((s) => ({
          speaker: s.speaker || "unknown",
          text: s.text,
          start: s.start,
          end: s.end,
        })),
        {
          leadId: conv.opportunityId || "",
          conversationId: conv.id,
          salesRep: conv.slackUsername || "unknown",
          conversationDate: conv.conversationDate || new Date(),
          productLine: (conv.productLine as "ichef" | "beauty") || "ichef",
        }
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (conv.meddicId) {
        // 更新現有記錄
        await db
          .update(meddicAnalyses)
          .set({
            metricsScore: analysisResult.meddicScores?.metrics || 0,
            economicBuyerScore:
              analysisResult.meddicScores?.economicBuyer || 0,
            decisionCriteriaScore:
              analysisResult.meddicScores?.decisionCriteria || 0,
            decisionProcessScore:
              analysisResult.meddicScores?.decisionProcess || 0,
            identifyPainScore: analysisResult.meddicScores?.identifyPain || 0,
            championScore: analysisResult.meddicScores?.champion || 0,
            overallScore: analysisResult.overallScore,
            status: analysisResult.qualificationStatus,
            dimensions: analysisResult.dimensions as Record<string, unknown>,
            keyFindings: analysisResult.keyFindings || [],
            nextSteps: (analysisResult.nextSteps || []).map((step: any) => ({
              action: step.action || step,
              priority: "Medium",
              owner: step.owner || "unknown",
            })) as Array<Record<string, unknown>>,
            risks: (analysisResult.risks || []) as Array<Record<string, unknown>>,
            agentOutputs: analysisResult.agentOutputs as {
              agent1?: Record<string, unknown>;
              agent2?: Record<string, unknown>;
              agent3?: Record<string, unknown>;
              agent4?: Record<string, unknown>;
              agent5?: Record<string, unknown>;
              agent6?: Record<string, unknown>;
            },
          })
          .where(eq(meddicAnalyses.id, conv.meddicId));
      } else {
        // 創建新記錄
        await db.insert(meddicAnalyses).values({
          id: randomUUID(),
          conversationId: conv.id,
          opportunityId: conv.opportunityId,
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
          dimensions: analysisResult.dimensions as Record<string, unknown>,
          keyFindings: analysisResult.keyFindings || [],
          nextSteps: (analysisResult.nextSteps || []).map((step: any) => ({
            action: step.action || step,
            priority: "Medium",
            owner: step.owner || "unknown",
          })) as Array<Record<string, unknown>>,
          risks: (analysisResult.risks || []) as Array<Record<string, unknown>>,
          agentOutputs: analysisResult.agentOutputs as {
            agent1?: Record<string, unknown>;
            agent2?: Record<string, unknown>;
            agent3?: Record<string, unknown>;
            agent4?: Record<string, unknown>;
            agent5?: Record<string, unknown>;
            agent6?: Record<string, unknown>;
          },
        });
      }

      // 更新 opportunity 分數
      if (conv.opportunityId) {
        await db
          .update(opportunities)
          .set({
            opportunityScore: analysisResult.overallScore,
            meddicScore: {
              overall: analysisResult.overallScore ?? 0,
              dimensions: {
                metrics: analysisResult.meddicScores?.metrics || 0,
                economicBuyer: analysisResult.meddicScores?.economicBuyer || 0,
                decisionCriteria:
                  analysisResult.meddicScores?.decisionCriteria || 0,
                decisionProcess:
                  analysisResult.meddicScores?.decisionProcess || 0,
                identifyPain: analysisResult.meddicScores?.identifyPain || 0,
                champion: analysisResult.meddicScores?.champion || 0,
              },
            },
          })
          .where(eq(opportunities.id, conv.opportunityId));
      }

      // 更新 conversation 的 analyzed_at
      await db
        .update(conversations)
        .set({
          analyzedAt: new Date(),
        })
        .where(eq(conversations.id, conv.id));

      processed++;
      console.log(
        `  ✅ 完成 (${duration}s) - Score: ${analysisResult.overallScore}/100`
      );

      // 每處理 10 筆輸出進度
      if ((i + 1) % BATCH_SIZE === 0) {
        const progress = (((i + 1) / conversationsToProcess.length) * 100).toFixed(1);
        console.log(`\n📊 進度: ${progress}% (${processed} 成功, ${failed} 失敗, ${skipped} 跳過)\n`);
      }

      // API 請求間隔
      if (i < conversationsToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      failed++;
      console.error(
        `  ❌ 失敗: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("補跑完成!");
  console.log(`  成功: ${processed}`);
  console.log(`  失敗: ${failed}`);
  console.log(`  跳過: ${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ 錯誤:", e);
    process.exit(1);
  });
