/**
 * 檢查 meddic_analyses 表是否包含 competitor_analysis 欄位
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  console.log("🔍 檢查資料庫 Schema...\n");

  // 讀取 DATABASE_URL
  const envPath = join(process.cwd(), "apps/server/.env");
  const envContent = readFileSync(envPath, "utf-8");
  const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);

  if (!databaseUrlMatch) {
    throw new Error("找不到 DATABASE_URL");
  }

  const databaseUrl = databaseUrlMatch[1].trim();
  const sql = neon(databaseUrl);

  // 查詢 meddic_analyses 表結構
  console.log("📊 查詢 meddic_analyses 表結構...");
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'meddic_analyses'
    ORDER BY ordinal_position;
  `;

  console.log("\n✅ meddic_analyses 表欄位:");
  console.log("=".repeat(70));
  columns.forEach((col) => {
    const mark = col.column_name === "competitor_analysis" ? "🎯" : "  ";
    console.log(
      `${mark} ${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${col.is_nullable}`
    );
  });

  // 檢查是否有 competitor_analysis 欄位
  const hasCompetitorAnalysis = columns.some(
    (col) => col.column_name === "competitor_analysis"
  );

  console.log("\n" + "=".repeat(70));
  if (hasCompetitorAnalysis) {
    console.log("✅ competitor_analysis 欄位已存在\n");
  } else {
    console.log("❌ competitor_analysis 欄位不存在");
    console.log("💡 需要執行 migration 新增此欄位\n");
  }

  // 檢查 competitor_info 表
  console.log("\n📊 查詢 competitor_info 表結構...");
  const competitorColumns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'competitor_info'
    ORDER BY ordinal_position;
  `;

  if (competitorColumns.length > 0) {
    console.log("✅ competitor_info 表已存在");
    console.log("欄位:");
    competitorColumns.forEach((col) => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
  } else {
    console.log("❌ competitor_info 表不存在\n");
  }
}

main().catch((error) => {
  console.error("❌ 執行失敗:", error);
  process.exit(1);
});
