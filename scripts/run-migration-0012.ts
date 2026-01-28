/**
 * 執行 Migration 0012: 新增 competitor_analysis 欄位到 meddic_analyses 表
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  console.log("🚀 開始執行 Migration 0012...\n");

  // 讀取 .env 檔案取得 DATABASE_URL
  const envPath = join(process.cwd(), "apps/server/.env");
  const envContent = readFileSync(envPath, "utf-8");
  const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);

  if (!databaseUrlMatch) {
    throw new Error("找不到 DATABASE_URL");
  }

  const databaseUrl = databaseUrlMatch[1].trim();
  console.log("📡 連接資料庫...\n");

  const sql = neon(databaseUrl);

  const sqlPath = join(
    process.cwd(),
    "packages/db/migrations/0012_add_competitor_analysis_to_meddic.sql"
  );
  const sqlContent = readFileSync(sqlPath, "utf-8");

  console.log("📄 執行 SQL:\n");
  console.log(sqlContent);
  console.log("\n" + "=".repeat(50) + "\n");

  try {
    // 使用 neon 的 query 方法執行原始 SQL
    // 分割多個 SQL 語句並逐一執行
    const statements = sqlContent
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--") && s.length > 0);

    for (const statement of statements) {
      // 使用 sql.query() 而不是 sql()
      await (sql as any).query(statement, [], {
        fullResults: false,
      });
    }

    console.log("✅ Migration 執行成功！");
    console.log("✅ competitor_analysis 欄位已新增到 meddic_analyses 表\n");
  } catch (error) {
    console.error("❌ Migration 執行失敗:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
