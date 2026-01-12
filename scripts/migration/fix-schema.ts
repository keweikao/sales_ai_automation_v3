// scripts/migration/fix-schema.ts
/**
 * 修正 conversations 表 schema
 * - 將 lead_id 改為 nullable（或移除）
 * - 確保 opportunity_id 是 NOT NULL
 */

import { sql } from "drizzle-orm";
import { db } from "./config";

async function main() {
  console.log("修正 conversations 表 schema...\n");

  try {
    // 1. 將 lead_id 改為 nullable
    console.log("1. 將 lead_id 改為 nullable...");
    await db.execute(sql`
      ALTER TABLE conversations
      ALTER COLUMN lead_id DROP NOT NULL
    `);
    console.log("   ✅ lead_id 已改為 nullable\n");

    // 2. 將 opportunity_id 改為 NOT NULL
    console.log("2. 將 opportunity_id 改為 NOT NULL...");
    await db.execute(sql`
      ALTER TABLE conversations
      ALTER COLUMN opportunity_id SET NOT NULL
    `);
    console.log("   ✅ opportunity_id 已改為 NOT NULL\n");

    console.log("🎉 Schema 修正完成！");
  } catch (error) {
    console.error("❌ 修正失敗:", error);
  }
}

main();
