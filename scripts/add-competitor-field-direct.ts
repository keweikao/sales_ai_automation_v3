/**
 * 直接執行 SQL 新增 competitor_analysis 欄位
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  console.log("🚀 直接新增 competitor_analysis 欄位...\n");

  // 讀取 DATABASE_URL
  const envPath = join(process.cwd(), "apps/server/.env");
  const envContent = readFileSync(envPath, "utf-8");
  const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);

  if (!databaseUrlMatch) {
    throw new Error("找不到 DATABASE_URL");
  }

  const databaseUrl = databaseUrlMatch[1].trim();
  console.log("📡 連接資料庫...\n");

  const sql = neon(databaseUrl);

  try {
    // 直接使用 tagged template 執行 ALTER TABLE
    console.log("📝 執行: ALTER TABLE meddic_analyses ADD COLUMN competitor_analysis jsonb");
    await sql`
      ALTER TABLE meddic_analyses
      ADD COLUMN IF NOT EXISTS competitor_analysis jsonb
    `;

    console.log("✅ 欄位新增成功！\n");

    // 驗證
    console.log("🔍 驗證欄位是否存在...");
    const result = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'meddic_analyses'
        AND column_name = 'competitor_analysis'
    `;

    if (result.length > 0) {
      console.log("✅ 驗證成功: competitor_analysis 欄位已存在於 meddic_analyses 表");
    } else {
      console.log("❌ 驗證失敗: 欄位仍不存在");
    }
  } catch (error) {
    console.error("❌ 執行失敗:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
