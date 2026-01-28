#!/usr/bin/env bun
/**
 * 驗證 M 開頭案件的分析結果
 * 檢查分析數量、分數分布等
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { like, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../packages/db/src/schema";
import { conversations, meddicAnalyses } from "../packages/db/src/schema";

// 載入環境變數
const envFiles = [
  resolve(process.cwd(), ".env.migration"),
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

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ 錯誤: 缺少 DATABASE_URL 環境變數");
  process.exit(1);
}

const sql_conn = neon(DATABASE_URL);
const db = drizzle(sql_conn, { schema });

async function main() {
  console.log("📊 驗證 M 開頭案件的分析結果");
  console.log("=".repeat(80));

  // 1. 查詢 M 開頭案件總數
  const mConversations = await db
    .select({
      id: conversations.id,
      caseNumber: conversations.caseNumber,
      hasTranscript: sql<boolean>`${conversations.transcript} IS NOT NULL`,
    })
    .from(conversations)
    .where(like(conversations.caseNumber, "M%"));

  console.log(`\n📋 M 開頭案件統計:`);
  console.log(`   總數: ${mConversations.length} 筆`);
  console.log(
    `   有 transcript: ${mConversations.filter((c) => c.hasTranscript).length} 筆`
  );

  // 2. 查詢已分析的 M 開頭案件
  const analyzedResults = await db
    .select({
      conversationId: meddicAnalyses.conversationId,
      overallScore: meddicAnalyses.overallScore,
      status: meddicAnalyses.status,
      createdAt: meddicAnalyses.createdAt,
    })
    .from(meddicAnalyses)
    .where(
      sql`${meddicAnalyses.conversationId} IN (
        SELECT id FROM ${conversations} WHERE ${conversations.caseNumber} LIKE 'M%'
      )`
    )
    .orderBy(meddicAnalyses.createdAt);

  console.log(`\n✅ 已分析案件:`);
  console.log(`   總數: ${analyzedResults.length} 筆`);

  if (analyzedResults.length > 0) {
    // 3. 分數分布
    const scoreRanges = {
      "90-100": 0,
      "80-89": 0,
      "70-79": 0,
      "60-69": 0,
      "50-59": 0,
      "< 50": 0,
    };

    for (const result of analyzedResults) {
      const score = result.overallScore || 0;
      if (score >= 90) scoreRanges["90-100"]++;
      else if (score >= 80) scoreRanges["80-89"]++;
      else if (score >= 70) scoreRanges["70-79"]++;
      else if (score >= 60) scoreRanges["60-69"]++;
      else if (score >= 50) scoreRanges["50-59"]++;
      else scoreRanges["< 50"]++;
    }

    console.log(`\n📈 分數分布:`);
    for (const [range, count] of Object.entries(scoreRanges)) {
      const percentage = ((count / analyzedResults.length) * 100).toFixed(1);
      console.log(`   ${range} 分: ${count} 筆 (${percentage}%)`);
    }

    // 4. 狀態分布
    const statusCounts = new Map<string, number>();
    for (const result of analyzedResults) {
      const status = result.status || "Unknown";
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    }

    console.log(`\n🏷️  狀態分布:`);
    for (const [status, count] of statusCounts.entries()) {
      console.log(`   ${status}: ${count} 筆`);
    }

    // 5. 最近 10 筆分析
    console.log(`\n🕐 最近 10 筆分析:`);
    const recent = analyzedResults.slice(-10);
    for (const result of recent) {
      // 找到對應的 conversation
      const conv = mConversations.find((c) => c.id === result.conversationId);
      const timestamp = result.createdAt
        ? new Date(result.createdAt).toLocaleString("zh-TW")
        : "N/A";
      console.log(
        `   ${conv?.caseNumber || "N/A"} | Score: ${result.overallScore || 0} | ${result.status || "N/A"} | ${timestamp}`
      );
    }
  }

  // 6. 待分析案件
  const analyzedIds = new Set(analyzedResults.map((r) => r.conversationId));
  const pending = mConversations.filter(
    (c) => c.hasTranscript && !analyzedIds.has(c.id)
  );

  console.log(`\n⏳ 待分析案件: ${pending.length} 筆`);

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ 錯誤:", e);
    process.exit(1);
  });
