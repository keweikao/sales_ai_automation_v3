#!/usr/bin/env bun
/**
 * 檢查 PDCM 分析狀態
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

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("=== 對話 PDCM/MEDDIC 分析狀態 ===\n");

  // 檢查總體狀態
  const overview = await sql`
    SELECT
      COUNT(DISTINCT c.id) as total_conversations,
      COUNT(DISTINCT ma.id) as total_meddic_records,
      COUNT(DISTINCT CASE WHEN ma.overall_score IS NOT NULL THEN ma.id END) as has_meddic_score,
      COUNT(DISTINCT CASE WHEN ma.agent_outputs->'agent2'->'pdcm_scores' IS NOT NULL THEN ma.id END) as has_pdcm
    FROM conversations c
    LEFT JOIN meddic_analyses ma ON c.id = ma.conversation_id
    WHERE c.status = 'completed' AND c.transcript IS NOT NULL
  `;

  const stats = overview[0];
  console.log("已完成對話總數:", stats.total_conversations);
  console.log("MEDDIC 記錄總數:", stats.total_meddic_records);
  console.log("有 MEDDIC 分數:", stats.has_meddic_score);
  console.log("有 PDCM 分析:", stats.has_pdcm);
  console.log("");
  console.log(
    "缺少 MEDDIC 分數:",
    Number(stats.total_meddic_records) - Number(stats.has_meddic_score)
  );
  console.log(
    "缺少 PDCM 分析:",
    Number(stats.total_meddic_records) - Number(stats.has_pdcm)
  );

  // 顯示幾筆範例
  console.log("\n=== 缺少 PDCM 的案件範例 ===\n");
  const missing = await sql`
    SELECT
      c.case_number,
      c.id as conversation_id,
      ma.overall_score,
      ma.agent_outputs->'agent2'->'pdcm_scores' IS NOT NULL as has_pdcm
    FROM conversations c
    LEFT JOIN meddic_analyses ma ON c.id = ma.conversation_id
    WHERE c.status = 'completed'
      AND c.transcript IS NOT NULL
      AND (ma.agent_outputs->'agent2'->'pdcm_scores' IS NULL)
    LIMIT 10
  `;

  if (missing.length === 0) {
    console.log("✅ 所有案件都有 PDCM 分析!");
  } else {
    for (const row of missing) {
      console.log(
        `  ${row.case_number || row.conversation_id}: MEDDIC=${row.overall_score ?? "無"}, PDCM=${row.has_pdcm ? "有" : "無"}`
      );
    }
  }
}

main().catch(console.error);
