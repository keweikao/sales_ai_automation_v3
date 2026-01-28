/**
 * 刪除孤立的 opportunities（已沒有任何 conversations）
 *
 * ⚠️ 警告：此操作將永久刪除資料，無法恢復！
 *
 * 使用方式：
 *   bun run scripts/delete-orphaned-opportunities.ts
 */

import * as dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: "apps/server/.env" });

async function deleteOrphanedOpportunities() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('⚠️  開始刪除孤立的 opportunities（沒有任何 conversations）\n');

    // 1. 先查詢要刪除的孤立 opportunities
    const findResult = await client.query(`
      SELECT
        o.id,
        o.customer_number,
        o.company_name,
        o.contact_name,
        o.status
      FROM opportunities o
      LEFT JOIN conversations c ON c.opportunity_id = o.id
      GROUP BY o.id, o.customer_number, o.company_name, o.contact_name, o.status
      HAVING COUNT(c.id) = 0
    `);

    if (findResult.rows.length === 0) {
      console.log('✅ 沒有孤立的 opportunities 需要刪除');
      await client.end();
      return;
    }

    console.log(`找到 ${findResult.rows.length} 個孤立的 opportunities:\n`);
    findResult.rows.forEach((opp, idx) => {
      console.log(`  ${idx + 1}. ${opp.customer_number} - ${opp.company_name || '(無公司名稱)'}`);
    });

    const opportunityIds = findResult.rows.map(o => o.id);

    console.log('\n⏳ 開始刪除...\n');

    // 2. 刪除關聯的 sales_todos（如果有 opportunityId 關聯）
    const todosResult = await client.query(
      `DELETE FROM sales_todos WHERE opportunity_id = ANY($1) RETURNING id, title`,
      [opportunityIds]
    );
    console.log(`✅ 刪除 ${todosResult.rowCount || 0} 筆關聯的 sales_todos`);
    if (todosResult.rows.length > 0) {
      console.log('   已刪除的待辦事項:');
      todosResult.rows.slice(0, 5).forEach((todo, idx) => {
        console.log(`   ${idx + 1}. ${todo.title}`);
      });
      if (todosResult.rows.length > 5) {
        console.log(`   ... 還有 ${todosResult.rows.length - 5} 筆`);
      }
    }

    // 3. 刪除關聯的 alerts（如果有 opportunityId 關聯）
    const alertsResult = await client.query(
      `DELETE FROM alerts WHERE opportunity_id = ANY($1) RETURNING id`,
      [opportunityIds]
    );
    console.log(`✅ 刪除 ${alertsResult.rowCount || 0} 筆關聯的 alerts`);

    // 4. 刪除 opportunities
    const deleteResult = await client.query(
      `DELETE FROM opportunities WHERE id = ANY($1) RETURNING id, customer_number, company_name`,
      [opportunityIds]
    );

    console.log(`\n✅ 成功刪除 ${deleteResult.rowCount || 0} 筆 opportunities\n`);
    console.log('已刪除的客戶記錄:');
    deleteResult.rows.forEach((opp, idx) => {
      console.log(`  ${idx + 1}. ${opp.customer_number} - ${opp.company_name || '(無公司名稱)'}`);
    });

    console.log('\n🎉 刪除完成！');

    await client.end();
  } catch (error) {
    console.error('\n❌ 刪除失敗:', error);
    await client.end();
    process.exit(1);
  }
}

deleteOrphanedOpportunities()
  .then(() => {
    console.log('\n程式執行完畢');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 執行過程發生錯誤:', error);
    process.exit(1);
  });
