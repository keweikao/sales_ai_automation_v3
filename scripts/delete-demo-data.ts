/**
 * 清理 Live Demo 測試資料
 *
 * 刪除所有 Demo 測試機會、對話和待辦事項
 *
 * 使用方式：
 * export DATABASE_URL="..." && bun run scripts/delete-demo-data.ts
 */

import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Demo 資料前綴
const DEMO_CUSTOMER_PREFIX = "999999-";

async function main() {
  await client.connect();
  console.log("🗑️ 開始清理 Demo 測試資料...\n");

  // 1. 查詢 Demo 機會
  const demoOpportunities = await client.query(
    `SELECT id, company_name, customer_number FROM opportunities WHERE customer_number LIKE $1`,
    [`${DEMO_CUSTOMER_PREFIX}%`]
  );

  if (demoOpportunities.rows.length === 0) {
    console.log("ℹ️ 沒有找到 Demo 測試資料\n");
    await client.end();
    process.exit(0);
  }

  console.log(`📌 找到 ${demoOpportunities.rows.length} 個 Demo 機會:\n`);
  for (const opp of demoOpportunities.rows) {
    console.log(`   - ${opp.company_name} (${opp.customer_number})`);
  }
  console.log("");

  const opportunityIds = demoOpportunities.rows.map((o: { id: string }) => o.id);

  // 2. 刪除對應的待辦
  const deletedTodos = await client.query(
    `DELETE FROM sales_todos WHERE customer_number LIKE $1 RETURNING id`,
    [`${DEMO_CUSTOMER_PREFIX}%`]
  );
  console.log(`✅ 已刪除 ${deletedTodos.rowCount} 個待辦事項`);

  // 3. 刪除對應的對話
  const deletedConversations = await client.query(
    `DELETE FROM conversations WHERE opportunity_id = ANY($1) RETURNING id`,
    [opportunityIds]
  );
  console.log(`✅ 已刪除 ${deletedConversations.rowCount} 個對話`);

  // 4. 刪除機會
  const deletedOpportunities = await client.query(
    `DELETE FROM opportunities WHERE customer_number LIKE $1 RETURNING id`,
    [`${DEMO_CUSTOMER_PREFIX}%`]
  );
  console.log(`✅ 已刪除 ${deletedOpportunities.rowCount} 個機會`);

  console.log("\n🎉 Demo 測試資料清理完成！\n");

  await client.end();
}

main().catch((error) => {
  console.error("❌ 發生錯誤:", error);
  process.exit(1);
});
