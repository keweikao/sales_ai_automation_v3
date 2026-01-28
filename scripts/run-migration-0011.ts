/**
 * 執行 Migration 0011: 建立 competitor_info 表
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

async function main() {
  console.log("🚀 開始執行 Migration 0011...\n");

  // 讀取 .env 檔案取得 DATABASE_URL
  const envPath = join(process.cwd(), "apps/server/.env");
  const envContent = readFileSync(envPath, "utf-8");
  const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);

  if (!databaseUrlMatch) {
    throw new Error("找不到 DATABASE_URL");
  }

  const databaseUrl = databaseUrlMatch[1].trim();
  console.log("📡 連接資料庫...\n");

  const sql = postgres(databaseUrl);

  const sqlPath = join(
    process.cwd(),
    "packages/db/migrations/0011_add_competitor_info.sql"
  );
  const sqlContent = readFileSync(sqlPath, "utf-8");

  console.log("📄 執行 SQL:\n");
  console.log(sqlContent);
  console.log("\n" + "=".repeat(50) + "\n");

  try {
    await sql.unsafe(sqlContent);
    console.log("✅ Migration 執行成功！");
    console.log("✅ competitor_info 表已建立\n");
  } catch (error) {
    console.error("❌ Migration 執行失敗:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
