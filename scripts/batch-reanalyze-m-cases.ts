#!/usr/bin/env bun
/**
 * 批次重新分析 M 開頭案件的 PDCM SPIN 分析
 *
 * M 開頭案件來自 Firestore V3 遷移，遷移時保留了 transcript 但跳過了 MEDDIC 分析。
 * 本腳本使用 V3 的 PDCM SPIN 分析系統重新分析所有 M 開頭的案件。
 *
 * 環境變數:
 * - DRY_RUN: boolean = false           // 乾跑模式（測試，不寫入資料庫）
 * - BATCH_SIZE: number = 15            // 批次大小
 * - BATCH_DELAY_MS: number = 800       // 批次間延遲（ms）
 * - SKIP_ANALYZED: boolean = true      // 跳過已分析的案件
 * - SAMPLE_SIZE?: number               // 可選，僅處理前 N 筆（測試用）
 * - START_FROM_INDEX?: number          // 可選，從第 N 筆開始（斷點續傳）
 * - VERBOSE: boolean = false           // 詳細日誌
 * - GEMINI_API_KEY: string             // Gemini API 金鑰（必須）
 *
 * 使用方式:
 * - 乾跑測試: DRY_RUN=true SAMPLE_SIZE=10 bun run scripts/batch-reanalyze-m-cases.ts
 * - 正式執行: bun run scripts/batch-reanalyze-m-cases.ts
 * - 分批執行: SAMPLE_SIZE=50 bun run scripts/batch-reanalyze-m-cases.ts
 */

// 載入環境變數（同步）
// 優先順序：
// 1. .env.migration（遷移專用設定）
// 2. apps/server/.env（共用設定如 DATABASE_URL, GEMINI_API_KEY）
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFiles = [
  resolve(process.cwd(), ".env.migration"),
  resolve(process.cwd(), "apps/server/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    const text = readFileSync(envFile, "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // 移除引號
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // 只設定尚未定義的變數
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

import { eq, isNotNull, like, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { randomUUID } from "node:crypto";
import * as schema from "../packages/db/src/schema";
import {
  conversations,
  meddicAnalyses,
  opportunities,
} from "../packages/db/src/schema";
// 直接導入以避免 index.ts 的副作用
import { createGeminiClient } from "../packages/services/src/llm/gemini.js";
import { createOrchestrator } from "../packages/services/src/llm/orchestrator.js";

// 直接使用環境變數建立資料庫連接（避免 Cloudflare Workers 依賴）
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ 錯誤: 缺少 DATABASE_URL 環境變數");
  process.exit(1);
}

const sql_conn = neon(DATABASE_URL);
const db = drizzle(sql_conn, { schema });

// ============================================================
// 環境變數配置
// ============================================================

const config = {
  DRY_RUN: process.env.DRY_RUN === "true",
  BATCH_SIZE: Number.parseInt(process.env.BATCH_SIZE || "15", 10),
  BATCH_DELAY_MS: Number.parseInt(process.env.BATCH_DELAY_MS || "800", 10),
  SKIP_ANALYZED: process.env.SKIP_ANALYZED !== "false", // 預設 true
  SAMPLE_SIZE: process.env.SAMPLE_SIZE
    ? Number.parseInt(process.env.SAMPLE_SIZE, 10)
    : undefined,
  START_FROM_INDEX: process.env.START_FROM_INDEX
    ? Number.parseInt(process.env.START_FROM_INDEX, 10)
    : 0,
  VERBOSE: process.env.VERBOSE === "true",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};

// ============================================================
// 型別定義
// ============================================================

interface BatchStats {
  total: number;
  withTranscript: number;
  toProcess: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{
    conversationId: string;
    caseNumber: string;
    error: string;
  }>;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

interface ConversationRecord {
  id: string;
  caseNumber: string | null;
  transcript: unknown;
  opportunityId: string;
  createdAt: Date | null;
  slackUsername: string | null;
  conversationDate: Date | null;
}

// ============================================================
// 初始化和驗證
// ============================================================

async function initializeAndValidate() {
  console.log("🔧 初始化環境...");
  console.log("=".repeat(80));

  // 驗證環境變數
  if (!config.GEMINI_API_KEY) {
    console.error("❌ 錯誤: 缺少 GEMINI_API_KEY 環境變數");
    console.error("   請設定: export GEMINI_API_KEY=your_api_key");
    process.exit(1);
  }

  // 顯示執行配置
  console.log("📋 執行配置:");
  console.log(`   模式: ${config.DRY_RUN ? "🧪 DRY RUN (測試模式)" : "🚀 正式執行"}`);
  console.log(`   批次大小: ${config.BATCH_SIZE}`);
  console.log(`   批次延遲: ${config.BATCH_DELAY_MS}ms`);
  console.log(`   跳過已分析: ${config.SKIP_ANALYZED ? "是" : "否"}`);
  if (config.SAMPLE_SIZE) {
    console.log(`   樣本大小: ${config.SAMPLE_SIZE} 筆`);
  }
  if (config.START_FROM_INDEX > 0) {
    console.log(`   起始索引: 第 ${config.START_FROM_INDEX} 筆`);
  }
  console.log(`   詳細日誌: ${config.VERBOSE ? "是" : "否"}`);
  console.log();

  // 建立 Gemini client 和 orchestrator
  const geminiClient = createGeminiClient(config.GEMINI_API_KEY);
  const orchestrator = createOrchestrator(geminiClient);

  return { geminiClient, orchestrator };
}

// ============================================================
// 查詢 M 開頭案件
// ============================================================

async function fetchMCases(): Promise<{
  allCount: number;
  withTranscript: number;
  cases: ConversationRecord[];
}> {
  console.log("🔍 查詢 M 開頭案件...");

  // 查詢所有 M 開頭案件的總數
  const allCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(like(conversations.caseNumber, "M%"));

  const allCount = Number(allCountResult[0]?.count ?? 0);

  // 查詢有 transcript 的 M 開頭案件
  const cases = (await db
    .select({
      id: conversations.id,
      caseNumber: conversations.caseNumber,
      transcript: conversations.transcript,
      opportunityId: conversations.opportunityId,
      createdAt: conversations.createdAt,
      slackUsername: conversations.slackUsername,
      conversationDate: conversations.conversationDate,
    })
    .from(conversations)
    .where(
      sql`${conversations.caseNumber} LIKE 'M%' AND ${conversations.transcript} IS NOT NULL`
    )
    .orderBy(conversations.createdAt)) as ConversationRecord[];

  const withTranscript = cases.length;

  console.log(`   所有 M 開頭案件: ${allCount} 筆`);
  console.log(`   有 transcript 的: ${withTranscript} 筆`);
  console.log(`   無 transcript 的: ${allCount - withTranscript} 筆 (將跳過)`);

  return { allCount, withTranscript, cases };
}

// ============================================================
// 過濾已分析案件
// ============================================================

async function filterUnanalyzedCases(
  cases: ConversationRecord[]
): Promise<ConversationRecord[]> {
  if (!config.SKIP_ANALYZED) {
    console.log("⏭️  不跳過已分析案件（SKIP_ANALYZED=false）");
    return cases;
  }

  console.log("\n🔍 檢查已分析案件...");

  // 查詢所有已有 meddic_analyses 記錄的 conversation IDs
  const conversationIds = cases.map((c) => c.id);

  if (conversationIds.length === 0) {
    console.log("   沒有案件需要檢查");
    return cases;
  }

  const analyzedResults = await db
    .select({ conversationId: meddicAnalyses.conversationId })
    .from(meddicAnalyses)
    .where(sql`${meddicAnalyses.conversationId} IN ${conversationIds}`);

  const analyzedIds = new Set(analyzedResults.map((r) => r.conversationId));

  const unanalyzedCases = cases.filter((c) => !analyzedIds.has(c.id));

  console.log(`   已分析: ${analyzedIds.size} 筆`);
  console.log(`   待分析: ${unanalyzedCases.length} 筆`);

  return unanalyzedCases;
}

// ============================================================
// 單個案件分析
// ============================================================

async function analyzeConversation(
  conversation: ConversationRecord,
  orchestrator: ReturnType<typeof createOrchestrator>
): Promise<{ success: boolean; score?: number; error?: string }> {
  try {
    // 1. 驗證 transcript
    const transcript = conversation.transcript as {
      segments?: Array<{
        speaker?: string;
        text: string;
        start: number;
        end: number;
      }>;
      fullText?: string;
    } | null;

    if (!transcript?.segments?.length) {
      return {
        success: false,
        error: "Transcript segments not found or empty",
      };
    }

    if (config.VERBOSE) {
      console.log(
        `      Transcript: ${transcript.segments.length} segments`
      );
    }

    // 2. 提取 transcript segments
    const transcriptSegments = transcript.segments.map((s) => ({
      speaker: s.speaker || "unknown",
      text: s.text,
      start: s.start,
      end: s.end,
    }));

    // 3. 執行分析
    const analysisResult = await orchestrator.analyze(transcriptSegments, {
      leadId: conversation.opportunityId,
      conversationId: conversation.id,
      salesRep: conversation.slackUsername || "unknown",
      conversationDate: conversation.conversationDate || new Date(),
    });

    if (config.VERBOSE) {
      console.log(`      分析完成: Score ${analysisResult.overallScore}`);
    }

    // 4. DRY RUN 模式：不寫入資料庫
    if (config.DRY_RUN) {
      if (config.VERBOSE) {
        console.log("      [DRY RUN] 跳過資料庫寫入");
      }
      return { success: true, score: analysisResult.overallScore };
    }

    // 5. 更新或插入 meddic_analyses
    const existingAnalysis = await db.query.meddicAnalyses.findFirst({
      where: eq(meddicAnalyses.conversationId, conversation.id),
    });

    if (existingAnalysis) {
      // 更新現有記錄
      await db
        .update(meddicAnalyses)
        .set({
          metricsScore: analysisResult.meddicScores?.metrics,
          economicBuyerScore: analysisResult.meddicScores?.economicBuyer,
          decisionCriteriaScore: analysisResult.meddicScores?.decisionCriteria,
          decisionProcessScore: analysisResult.meddicScores?.decisionProcess,
          identifyPainScore: analysisResult.meddicScores?.identifyPain,
          championScore: analysisResult.meddicScores?.champion,
          overallScore: analysisResult.overallScore,
          status: analysisResult.qualificationStatus,
          dimensions: analysisResult.dimensions as Record<string, unknown>,
          keyFindings: analysisResult.keyFindings,
          nextSteps: analysisResult.nextSteps as Array<Record<string, unknown>>,
          risks: analysisResult.risks as Array<Record<string, unknown>>,
          agentOutputs: analysisResult.agentOutputs as {
            agent1?: Record<string, unknown>;
            agent2?: Record<string, unknown>;
            agent3?: Record<string, unknown>;
            agent4?: Record<string, unknown>;
            agent5?: Record<string, unknown>;
            agent6?: Record<string, unknown>;
          },
        })
        .where(eq(meddicAnalyses.id, existingAnalysis.id));

      if (config.VERBOSE) {
        console.log("      更新現有分析記錄");
      }
    } else {
      // 插入新記錄
      await db.insert(meddicAnalyses).values({
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
        dimensions: analysisResult.dimensions as Record<string, unknown>,
        keyFindings: analysisResult.keyFindings,
        nextSteps: analysisResult.nextSteps as Array<Record<string, unknown>>,
        risks: analysisResult.risks as Array<Record<string, unknown>>,
        agentOutputs: analysisResult.agentOutputs as {
          agent1?: Record<string, unknown>;
          agent2?: Record<string, unknown>;
          agent3?: Record<string, unknown>;
          agent4?: Record<string, unknown>;
          agent5?: Record<string, unknown>;
          agent6?: Record<string, unknown>;
        },
      });

      if (config.VERBOSE) {
        console.log("      創建新的分析記錄");
      }
    }

    // 6. 更新 opportunities 表分數
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
            decisionProcess: analysisResult.meddicScores?.decisionProcess || 0,
            identifyPain: analysisResult.meddicScores?.identifyPain || 0,
            champion: analysisResult.meddicScores?.champion || 0,
          },
        },
      })
      .where(eq(opportunities.id, conversation.opportunityId));

    if (config.VERBOSE) {
      console.log("      更新 opportunities 分數");
    }

    return { success: true, score: analysisResult.overallScore };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

// ============================================================
// 批次處理引擎
// ============================================================

async function processBatches(
  cases: ConversationRecord[],
  orchestrator: ReturnType<typeof createOrchestrator>
): Promise<BatchStats> {
  const stats: BatchStats = {
    total: cases.length,
    withTranscript: cases.length,
    toProcess: cases.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    startTime: new Date(),
  };

  console.log("\n🚀 開始批次處理...");
  console.log(`   待處理案件: ${stats.toProcess} 筆`);
  console.log("=".repeat(80));

  for (let i = 0; i < cases.length; i += config.BATCH_SIZE) {
    const batch = cases.slice(i, i + config.BATCH_SIZE);
    const batchNum = Math.floor(i / config.BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(cases.length / config.BATCH_SIZE);

    console.log(
      `\n📦 批次 ${batchNum}/${totalBatches} (案件 ${i + 1}-${Math.min(i + batch.length, cases.length)})`
    );

    // 序列處理批次內的案件
    for (let j = 0; j < batch.length; j++) {
      const conversation = batch[j];
      const currentIndex = i + j + 1;

      console.log(
        `   [${currentIndex}/${cases.length}] ${conversation.caseNumber}`
      );

      const startTime = Date.now();
      const result = await analyzeConversation(conversation, orchestrator);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      stats.processed++;

      if (result.success) {
        stats.succeeded++;
        console.log(
          `      ✅ 成功 (Score: ${result.score}, 耗時: ${duration}s)`
        );
      } else {
        stats.failed++;
        stats.errors.push({
          conversationId: conversation.id,
          caseNumber: conversation.caseNumber || "unknown",
          error: result.error || "Unknown error",
        });
        console.log(`      ❌ 失敗: ${result.error}`);
      }

      // 每 10 筆輸出進度摘要
      if (currentIndex % 10 === 0) {
        const successRate = ((stats.succeeded / stats.processed) * 100).toFixed(
          1
        );
        console.log(
          `\n   📊 進度: ${((currentIndex / cases.length) * 100).toFixed(1)}% | ` +
            `成功: ${stats.succeeded} | 失敗: ${stats.failed} | 成功率: ${successRate}%\n`
        );
      }
    }

    // 批次間延遲（最後一批不需要）
    if (i + config.BATCH_SIZE < cases.length) {
      console.log(`   ⏳ 等待 ${config.BATCH_DELAY_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, config.BATCH_DELAY_MS));
    }
  }

  stats.endTime = new Date();
  stats.duration =
    (stats.endTime.getTime() - stats.startTime.getTime()) / 1000;

  return stats;
}

// ============================================================
// 生成統計報告
// ============================================================

function generateReport(stats: BatchStats) {
  console.log("\n");
  console.log("=".repeat(80));
  console.log("📊 批次重新分析報告");
  console.log("=".repeat(80));

  console.log(`\n執行模式: ${config.DRY_RUN ? "🧪 DRY RUN (測試模式)" : "🚀 正式執行"}`);
  console.log(
    `總耗時: ${stats.duration?.toFixed(1)}s (${(stats.duration! / 60).toFixed(1)} 分鐘)`
  );

  console.log("\n📈 統計數據:");
  console.log(`   待處理: ${stats.toProcess} 筆`);
  console.log(`   已處理: ${stats.processed} 筆`);
  console.log(`   成功: ${stats.succeeded} 筆`);
  console.log(`   失敗: ${stats.failed} 筆`);
  console.log(
    `   成功率: ${((stats.succeeded / stats.processed) * 100).toFixed(1)}%`
  );

  if (stats.errors.length > 0) {
    console.log("\n❌ 失敗詳情:");
    for (const error of stats.errors) {
      console.log(`   - ${error.caseNumber}: ${error.error}`);
    }
  }

  if (config.DRY_RUN) {
    console.log("\n⚠️  注意: 這是 DRY RUN 模式，沒有實際寫入資料庫");
    console.log("   移除 DRY_RUN=true 環境變數以執行正式遷移");
  }

  console.log("\n" + "=".repeat(80));
}

// ============================================================
// 主函數
// ============================================================

async function main() {
  console.log("🎯 批次重新分析 M 開頭案件的 PDCM SPIN 分析");
  console.log("=".repeat(80));

  try {
    // Phase 1: 初始化
    const { orchestrator } = await initializeAndValidate();

    // Phase 2: 查詢 M 開頭案件
    const { allCount, withTranscript, cases } = await fetchMCases();

    if (cases.length === 0) {
      console.log("\n✅ 沒有需要處理的案件");
      process.exit(0);
    }

    // Phase 3: 過濾已分析案件
    let casesToProcess = await filterUnanalyzedCases(cases);

    // Phase 4: 套用 SAMPLE_SIZE 和 START_FROM_INDEX
    if (config.START_FROM_INDEX > 0) {
      casesToProcess = casesToProcess.slice(config.START_FROM_INDEX);
      console.log(
        `\n⏭️  從第 ${config.START_FROM_INDEX} 筆開始，剩餘 ${casesToProcess.length} 筆`
      );
    }

    if (config.SAMPLE_SIZE !== undefined) {
      casesToProcess = casesToProcess.slice(0, config.SAMPLE_SIZE);
      console.log(`\n📏 限制樣本大小為 ${config.SAMPLE_SIZE} 筆`);
    }

    if (casesToProcess.length === 0) {
      console.log("\n✅ 沒有需要處理的案件（全部已分析或被過濾）");
      process.exit(0);
    }

    // Phase 5: 批次處理
    const stats = await processBatches(casesToProcess, orchestrator);

    // Phase 6: 生成報告
    generateReport(stats);

    // 結束
    const exitCode = stats.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error("\n❌ 執行錯誤:", error);
    process.exit(1);
  }
}

// 執行主函數
main();
