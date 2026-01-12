// scripts/migration/check-data.ts
import { sql } from "drizzle-orm";
import { db } from "./config";

async function checkData() {
  console.log("檢查資料庫資料...\n");

  try {
    // 檢查 opportunities 表
    const oppsCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM opportunities`
    );
    console.log(
      `opportunities 表: ${(oppsCount.rows[0] as { count: number }).count} 筆`
    );

    // 檢查 conversations 表
    const convsCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM conversations`
    );
    console.log(
      `conversations 表: ${(convsCount.rows[0] as { count: number }).count} 筆`
    );

    // 檢查 meddic_analyses 表
    const meddicCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM meddic_analyses`
    );
    console.log(
      `meddic_analyses 表: ${(meddicCount.rows[0] as { count: number }).count} 筆`
    );

    // 抽樣 opportunities
    console.log("\n--- opportunities 樣本資料 ---");
    const oppsSample = await db.execute(
      sql`SELECT id, customer_number, company_name, status, created_at FROM opportunities LIMIT 3`
    );
    for (const row of oppsSample.rows) {
      console.log(row);
    }

    // 抽樣 conversations
    console.log("\n--- conversations 樣本資料 ---");
    const convsSample = await db.execute(
      sql`SELECT id, case_number, opportunity_id, duration, created_at FROM conversations LIMIT 3`
    );
    for (const row of convsSample.rows) {
      console.log(row);
    }
  } catch (error) {
    console.error("查詢失敗:", error);
  }
}

checkData();
