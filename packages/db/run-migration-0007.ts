/**
 * Migration 0007: 新增 legacy_case_id 欄位
 * 用於保留 V2 原始 caseId（遷移追溯用）
 * 執行方式: bun run packages/db/run-migration-0007.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function runMigration() {
  console.log("🚀 開始執行 Migration 0007...\n");

  try {
    // 新增 legacy_case_id 欄位
    console.log("1️⃣ 新增 conversations.legacy_case_id 欄位...");
    await sql`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS legacy_case_id TEXT
    `;
    console.log("   ✅ 完成\n");

    // 驗證
    console.log("📋 驗證欄位...\n");

    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'conversations' AND column_name = 'legacy_case_id'
    `;
    console.log(
      "   conversations.legacy_case_id:",
      columns.length > 0 ? "✅ 存在" : "❌ 不存在"
    );

    console.log("\n✨ Migration 0007 完成！");
  } catch (error) {
    console.error("❌ Migration 失敗:", error);
    process.exit(1);
  }
}

runMigration();
