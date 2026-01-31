#!/usr/bin/env bun
/**
 * 補跑缺少 PDCM 分析的案件
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// 載入環境變數
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
import * as schema from "../packages/db/src/schema";
import {
  conversations,
  meddicAnalyses,
  opportunities,
} from "../packages/db/src/schema";
import { createGeminiClient } from "../packages/services/src/llm/gemini.js";
import { createOrchestrator } from "../packages/services/src/llm/orchestrator.js";

const DELAY_MS = 2000;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ 錯誤: 缺少 DATABASE_URL 環境變數");
  process.exit(1);
}

const sql_conn = neon(DATABASE_URL);
const db = drizzle(sql_conn, { schema });

async function main() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("❌ 缺少 GEMINI_API_KEY 環境變數!");
    process.exit(1);
  }

  console.log("[PDCM Backfill] 補跑缺少 PDCM 分析的案件...\n");

  // 找出缺少 PDCM 的案件
  const casesToProcess = await db
    .select({
      conversationId: conversations.id,
      caseNumber: conversations.caseNumber,
      opportunityId: conversations.opportunityId,
      productLine: conversations.productLine,
      slackUsername: conversations.slackUsername,
      conversationDate: conversations.conversationDate,
      transcript: conversations.transcript,
      meddicId: meddicAnalyses.id,
      companyName: opportunities.companyName,
    })
    .from(conversations)
    .innerJoin(
      meddicAnalyses,
      eq(conversations.id, meddicAnalyses.conversationId)
    )
    .leftJoin(opportunities, eq(conversations.opportunityId, opportunities.id))
    .where(
      sql`${conversations.status} = 'completed'
        AND ${conversations.transcript} IS NOT NULL
        AND (${meddicAnalyses.agentOutputs}->'agent2'->'pdcm_scores' IS NULL)`
    );

  console.log(`找到 ${casesToProcess.length} 筆缺少 PDCM 的案件\n`);

  if (casesToProcess.length === 0) {
    console.log("✅ 所有案件都有 PDCM 分析!");
    return;
  }

  const geminiClient = createGeminiClient(geminiApiKey);
  const orchestrator = createOrchestrator(geminiClient);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < casesToProcess.length; i++) {
    const conv = casesToProcess[i];

    console.log(`[${i + 1}/${casesToProcess.length}] ${conv.caseNumber}`);
    console.log(`  公司: ${conv.companyName || "未知"}`);

    try {
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
          conversationId: conv.conversationId,
          salesRep: conv.slackUsername || "unknown",
          conversationDate: conv.conversationDate || new Date(),
          productLine: (conv.productLine as "ichef" | "beauty") || "ichef",
        }
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // 更新 MEDDIC 記錄
      await db
        .update(meddicAnalyses)
        .set({
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
          risks: (analysisResult.risks || []) as Array<
            Record<string, unknown>
          >,
          agentOutputs: analysisResult.agentOutputs as {
            agent1?: Record<string, unknown>;
            agent2?: Record<string, unknown>;
            agent3?: Record<string, unknown>;
            agent4?: Record<string, unknown>;
            agent5?: Record<string, unknown>;
            agent6?: Record<string, unknown>;
          },
        })
        .where(eq(meddicAnalyses.id, conv.meddicId!));

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

      processed++;
      console.log(
        `  ✅ 完成 (${duration}s) - Score: ${analysisResult.overallScore}/100`
      );

      // API 請求間隔
      if (i < casesToProcess.length - 1) {
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
