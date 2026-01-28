/**
 * Migration 0006: 新增 Slack Modal 缺少的資料庫欄位
 * 執行方式: bun run packages/db/run-migration-0006.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function runMigration() {
  console.log("🚀 開始執行 Migration 0006...\n");

  try {
    // 1. salesTodos 新增 remind_days 欄位
    console.log("1️⃣ 新增 sales_todos.remind_days 欄位...");
    await sql`
      ALTER TABLE sales_todos
      ADD COLUMN IF NOT EXISTS remind_days INTEGER
    `;
    console.log("   ✅ 完成\n");

    // 2. opportunities 新增 rejection_reason 欄位
    console.log("2️⃣ 新增 opportunities.rejection_reason 欄位...");
    await sql`
      ALTER TABLE opportunities
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    `;
    console.log("   ✅ 完成\n");

    // 3. opportunities 新增 selected_competitor 欄位
    console.log("3️⃣ 新增 opportunities.selected_competitor 欄位...");
    await sql`
      ALTER TABLE opportunities
      ADD COLUMN IF NOT EXISTS selected_competitor TEXT
    `;
    console.log("   ✅ 完成\n");

    // 驗證
    console.log("📋 驗證欄位...\n");

    const todoColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sales_todos' AND column_name = 'remind_days'
    `;
    console.log(
      "   sales_todos.remind_days:",
      todoColumns.length > 0 ? "✅ 存在" : "❌ 不存在"
    );

    const oppColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'opportunities' AND column_name IN ('rejection_reason', 'selected_competitor')
    `;
    console.log(
      "   opportunities 新欄位:",
      oppColumns.length === 2 ? "✅ 全部存在" : `⚠️ 只有 ${oppColumns.length}/2`
    );

    console.log("\n✨ Migration 0006 完成！");
  } catch (error) {
    console.error("❌ Migration 失敗:", error);
    process.exit(1);
  }
}

runMigration();
