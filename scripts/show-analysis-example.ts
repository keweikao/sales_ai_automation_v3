#!/usr/bin/env bun
/**
 * 顯示一個完整案件的 MEDDIC 和 PDCM 分析範例
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
  // 抓一筆有完整 PDCM 分析的案件
  const result = await sql`
    SELECT
      c.case_number,
      o.company_name,
      ma.overall_score,
      ma.metrics_score,
      ma.economic_buyer_score,
      ma.decision_criteria_score,
      ma.decision_process_score,
      ma.identify_pain_score,
      ma.champion_score,
      ma.dimensions,
      ma.agent_outputs->'agent2'->'pdcm_scores' as pdcm_scores,
      ma.agent_outputs->'agent2'->'not_closed_reason' as not_closed_reason
    FROM meddic_analyses ma
    JOIN conversations c ON ma.conversation_id = c.id
    LEFT JOIN opportunities o ON ma.opportunity_id = o.id
    WHERE ma.agent_outputs->'agent2'->'pdcm_scores' IS NOT NULL
      AND ma.overall_score IS NOT NULL
    ORDER BY ma.created_at DESC
    LIMIT 1
  `;

  if (result.length === 0) {
    console.log("找不到有完整分析的案件");
    return;
  }

  const row = result[0];

  console.log("=".repeat(60));
  console.log(`案件: ${row.case_number}`);
  console.log(`公司: ${row.company_name}`);
  console.log("=".repeat(60));

  console.log("\n【PDCM 分析】(Agent 2 原始輸出)\n");

  const pdcm = row.pdcm_scores as any;
  if (pdcm) {
    console.log(`總分: ${pdcm.total_score}/100`);
    console.log(`成交機率: ${pdcm.deal_probability}`);
    console.log("");

    console.log("┌─────────────┬───────┬─────────────────────────────────┐");
    console.log("│ 維度        │ 分數  │ 說明                            │");
    console.log("├─────────────┼───────┼─────────────────────────────────┤");

    // Pain
    if (pdcm.pain) {
      console.log(`│ P (Pain)    │ ${String(pdcm.pain.score).padStart(3)}   │ ${pdcm.pain.level || ''}, 緊急度: ${pdcm.pain.urgency || ''}`.padEnd(50) + "│");
      console.log(`│             │       │ 主要痛點: ${(pdcm.pain.main_pain || '').substring(0, 25)}`.padEnd(50) + "│");
    }

    // Decision
    if (pdcm.decision) {
      console.log(`│ D (Decision)│ ${String(pdcm.decision.score).padStart(3)}   │ ${pdcm.decision.contact_role || ''}, 有決策權: ${pdcm.decision.has_authority ? '是' : '否'}`.padEnd(50) + "│");
      console.log(`│             │       │ 時程: ${pdcm.decision.timeline || ''}, 風險: ${pdcm.decision.risk || ''}`.padEnd(50) + "│");
    }

    // Champion
    if (pdcm.champion) {
      console.log(`│ C (Champion)│ ${String(pdcm.champion.score).padStart(3)}   │ 態度: ${pdcm.champion.attitude || ''}`.padEnd(50) + "│");
      console.log(`│             │       │ 類型: ${pdcm.champion.customer_type || ''}, 主要考量: ${pdcm.champion.primary_criteria || ''}`.padEnd(50) + "│");
    }

    // Metrics
    if (pdcm.metrics) {
      console.log(`│ M (Metrics) │ ${String(pdcm.metrics.score).padStart(3)}   │ ${pdcm.metrics.level || ''}`.padEnd(50) + "│");
      if (pdcm.metrics.total_monthly_impact) {
        console.log(`│             │       │ 月效益: $${pdcm.metrics.total_monthly_impact?.toLocaleString() || 0}`.padEnd(50) + "│");
      }
    }

    console.log("└─────────────┴───────┴─────────────────────────────────┘");
  }

  // 未成交原因
  const notClosed = row.not_closed_reason as any;
  if (notClosed) {
    console.log("\n未成交原因:");
    console.log(`  類型: ${notClosed.type}`);
    console.log(`  詳情: ${notClosed.detail}`);
    console.log(`  突破建議: ${notClosed.breakthrough_suggestion}`);
  }

  console.log("\n" + "-".repeat(60));
  console.log("\n【MEDDIC 分析】(從 PDCM 映射轉換)\n");

  console.log(`總分: ${row.overall_score}/100`);
  console.log("");

  console.log("┌────────────────────┬───────┐");
  console.log("│ 維度               │ 分數  │");
  console.log("├────────────────────┼───────┤");
  console.log(`│ Metrics            │ ${String(row.metrics_score).padStart(3)}   │`);
  console.log(`│ Economic Buyer     │ ${String(row.economic_buyer_score).padStart(3)}   │`);
  console.log(`│ Decision Criteria  │ ${String(row.decision_criteria_score).padStart(3)}   │`);
  console.log(`│ Decision Process   │ ${String(row.decision_process_score).padStart(3)}   │`);
  console.log(`│ Identify Pain      │ ${String(row.identify_pain_score).padStart(3)}   │`);
  console.log(`│ Champion           │ ${String(row.champion_score).padStart(3)}   │`);
  console.log("└────────────────────┴───────┘");

  // Dimensions 詳細
  const dimensions = row.dimensions as any;
  if (dimensions) {
    console.log("\n維度詳細分析:");
    for (const [key, dim] of Object.entries(dimensions)) {
      const d = dim as any;
      console.log(`\n  ${d.name || key}:`);
      if (d.evidence?.length > 0) {
        console.log(`    證據: ${d.evidence.slice(0, 2).join('; ')}`);
      }
      if (d.gaps?.length > 0) {
        console.log(`    缺口: ${d.gaps.slice(0, 2).join('; ')}`);
      }
      if (d.recommendations?.length > 0) {
        console.log(`    建議: ${d.recommendations.slice(0, 2).join('; ')}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n【PDCM → MEDDIC 映射邏輯】\n");
  console.log("PDCM (4維度)              →    MEDDIC (6維度)");
  console.log("─────────────────────────────────────────────");
  console.log("P (Pain)                  →    Identify Pain");
  console.log("D (Decision)              →    Decision Process + Economic Buyer");
  console.log("C (Champion)              →    Champion + Decision Criteria");
  console.log("M (Metrics)               →    Metrics");
  console.log("");
  console.log("Economic Buyer 特殊邏輯: has_authority ? 80 : 40");
}

main().catch(console.error);
