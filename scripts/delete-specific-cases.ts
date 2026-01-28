/**
 * 硬刪除特定案件及其所有關聯資料
 *
 * ⚠️ 警告：此操作將永久刪除資料，無法恢復！
 *
 * 使用方式：
 *   bun run scripts/delete-specific-cases.ts
 */

import * as dotenv from "dotenv";
import { Client } from "pg";

// 載入環境變數
dotenv.config({ path: "apps/server/.env" });

const caseNumbers = [
  '202601-IC010', '202601-IC011', '202601-IC012', '202601-IC013',
  '202601-IC015', '202601-IC016', '202601-IC017', '202601-IC018',
  '202601-IC019', '202601-IC020', '202601-IC021', '202601-IC022',
  '202601-IC023', '202601-IC024'
];

async function deleteSpecificCases() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('⚠️  開始刪除案件，此操作無法恢復！');
    console.log('目標案件:', caseNumbers);
    console.log('');

    // 1. 先查詢要刪除的 conversation IDs
    console.log('🔍 查詢要刪除的案件...');
    const conversationsQuery = await client.query(
      `SELECT id, case_number, title FROM conversations WHERE case_number = ANY($1)`,
      [caseNumbers]
    );

    console.log(`\n找到 ${conversationsQuery.rows.length} 個案件：`);
    conversationsQuery.rows.forEach((c, idx) => {
      console.log(`  ${idx + 1}. ${c.case_number} - ${c.title || '(無標題)'}`);
    });

    if (conversationsQuery.rows.length === 0) {
      console.log('\n沒有找到任何案件，結束執行。');
      await client.end();
      return;
    }

    console.log('\n⏳ 開始刪除關聯資料...\n');

    const conversationIds = conversationsQuery.rows.map(c => c.id);

    // 2. 刪除 alerts
    try {
      const alertsResult = await client.query(
        `DELETE FROM alerts WHERE conversation_id = ANY($1) RETURNING id`,
        [conversationIds]
      );
      console.log(`✅ 刪除 ${alertsResult.rowCount || 0} 筆 alerts`);
    } catch (error: any) {
      if (error.code === '42703') {
        console.log(`⚠️  alerts 表沒有 conversation_id 欄位，跳過`);
      } else {
        throw error;
      }
    }

    // 3. 刪除 sms_logs（如果表存在）
    try {
      const smsLogsResult = await client.query(
        `DELETE FROM sms_logs WHERE conversation_id = ANY($1) RETURNING id`,
        [conversationIds]
      );
      console.log(`✅ 刪除 ${smsLogsResult.rowCount || 0} 筆 sms_logs`);
    } catch (error: any) {
      if (error.code === '42P01') {
        console.log(`⚠️  sms_logs 表不存在，跳過`);
      } else if (error.code === '42703') {
        console.log(`⚠️  sms_logs 表沒有 conversation_id 欄位，跳過`);
      } else {
        throw error;
      }
    }

    // 4. 刪除 meddic_analyses
    const meddicResult = await client.query(
      `DELETE FROM meddic_analyses WHERE conversation_id = ANY($1) RETURNING id`,
      [conversationIds]
    );
    console.log(`✅ 刪除 ${meddicResult.rowCount || 0} 筆 meddic_analyses`);

    // 5. 刪除 sales_todos（使用者要求）
    const todosResult = await client.query(
      `DELETE FROM sales_todos WHERE conversation_id = ANY($1) RETURNING id, title`,
      [conversationIds]
    );
    console.log(`✅ 刪除 ${todosResult.rowCount || 0} 筆 sales_todos`);
    if (todosResult.rows.length > 0) {
      console.log('   已刪除的待辦事項:');
      todosResult.rows.forEach((todo, idx) => {
        console.log(`   ${idx + 1}. ${todo.title}`);
      });
    }

    // 6. 最後刪除 conversations
    console.log('\n⏳ 刪除案件主記錄...');
    const conversationsResult = await client.query(
      `DELETE FROM conversations WHERE case_number = ANY($1) RETURNING id, case_number, title`,
      [caseNumbers]
    );

    console.log(`\n✅ 成功刪除 ${conversationsResult.rowCount || 0} 筆 conversations`);
    console.log('\n已刪除的案件:');
    conversationsResult.rows.forEach((c, idx) => {
      console.log(`  ${idx + 1}. ${c.case_number} - ${c.title || '(無標題)'}`);
    });

    console.log('\n🎉 刪除完成！');

  } catch (error) {
    console.error('\n❌ 刪除失敗:', error);
    throw error;
  } finally {
    await client.end();
  }
}

deleteSpecificCases()
  .then(() => {
    console.log('\n程式執行完畢');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 執行過程發生錯誤:', error);
    process.exit(1);
  });
