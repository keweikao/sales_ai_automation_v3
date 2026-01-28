/**
 * Migration 0009: Cascade delete todos when opportunity is deleted
 * 修改 sales_todos.opportunity_id 外鍵約束，從 SET NULL 改為 CASCADE
 * 執行方式: bun run packages/db/run-migration-0009.ts
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
      "🚀 Running migration 0009: Cascade delete todos with opportunity...\n"
    );

    // 檢查現有外鍵約束
    console.log("📋 檢查現有外鍵約束...");
    const existingConstraints = await pool.query(`
      SELECT constraint_name, delete_rule
      FROM information_schema.referential_constraints
      WHERE constraint_name = 'sales_todos_opportunity_id_opportunities_id_fk'
    `);

    if (existingConstraints.rows.length > 0) {
      console.log(
        `   當前約束: ${existingConstraints.rows[0].constraint_name}`
      );
      console.log(`   刪除規則: ${existingConstraints.rows[0].delete_rule}\n`);
    }

    // 執行 migration SQL
    const sqlPath = path.join(
      __dirname,
      "migrations",
      "0009_cascade_delete_todos_with_opportunity.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf-8");

    await pool.query(sql);

    console.log("✅ Migration SQL executed successfully!\n");

    // 驗證
    console.log("📋 驗證新約束...");
    const newConstraints = await pool.query(`
      SELECT constraint_name, delete_rule
      FROM information_schema.referential_constraints
      WHERE constraint_name = 'sales_todos_opportunity_id_opportunities_id_fk'
    `);

    if (newConstraints.rows.length > 0) {
      console.log(`   約束名稱: ${newConstraints.rows[0].constraint_name}`);
      console.log(`   刪除規則: ${newConstraints.rows[0].delete_rule}`);
      console.log(
        `   狀態: ${newConstraints.rows[0].delete_rule === "CASCADE" ? "✅ CASCADE" : "❌ 未設定為 CASCADE"}`
      );
    } else {
      console.log("   ❌ 約束不存在");
    }

    console.log("\n✨ Migration 0009 completed successfully!");
    console.log(
      "💡 現在刪除 opportunity 時，所有關聯的 sales_todos 也會被刪除。"
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
