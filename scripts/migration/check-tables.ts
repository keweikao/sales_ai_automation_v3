// scripts/migration/check-tables.ts
import { sql } from "drizzle-orm";
import { db } from "./config";

async function checkTables() {
  console.log("檢查資料庫表格...\n");

  try {
    const result = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );

    console.log("現有資料表:");
    for (const row of result.rows) {
      console.log(`  - ${(row as { table_name: string }).table_name}`);
    }
  } catch (error) {
    console.error("查詢失敗:", error);
  }
}

checkTables();
