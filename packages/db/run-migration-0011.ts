/**
 * Migration 0011: Add Customer Voice Tags tables
 * 新增客戶聲音標籤表和每日摘要表
 * 執行方式: bun run packages/db/run-migration-0011.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log(
      "🚀 Running migration 0011: Add Customer Voice Tags tables...\n"
    );

    // 執行 migration SQL
    const sqlPath = path.join(
      __dirname,
      "src",
      "migrations",
      "0011_add_customer_voice_tags.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf-8");

    await pool.query(sql);

    console.log("✅ Migration SQL executed successfully!\n");

    // 驗證表格建立
    console.log("📋 驗證表格建立...");

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('customer_voice_tags', 'daily_voice_summary')
      ORDER BY table_name
    `);

    for (const row of tables.rows) {
      console.log(`   ✅ ${row.table_name} 已建立`);
    }

    // 驗證索引建立
    console.log("\n📋 驗證索引建立...");

    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename IN ('customer_voice_tags', 'daily_voice_summary')
      ORDER BY indexname
    `);

    for (const row of indexes.rows) {
      console.log(`   ✅ ${row.indexname}`);
    }

    console.log("\n✨ Migration 0011 completed successfully!");
    console.log("💡 customer_voice_tags 和 daily_voice_summary 表格已建立。");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
