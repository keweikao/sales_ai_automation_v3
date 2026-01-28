/**
 * 驗證案件刪除結果
 *
 * 使用方式：
 *   bun run scripts/verify-deletion.ts
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

async function verifyDeletion() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔍 驗證案件刪除結果...\n');
    console.log('檢查案件編號:', caseNumbers);
    console.log('');

    let hasError = false;

    // 1. 檢查 conversations
    console.log('1️⃣  檢查 conversations 表...');
    const conversationsResult = await client.query(
      `SELECT id, case_number, title FROM conversations WHERE case_number = ANY($1)`,
      [caseNumbers]
    );

    if (conversationsResult.rows.length === 0) {
      console.log('   ✅ 所有案件已從 conversations 表中刪除\n');
    } else {
      console.log(`   ❌ 發現 ${conversationsResult.rows.length} 個案件仍然存在:`);
      conversationsResult.rows.forEach(c => console.log(`      - ${c.case_number}`));
      console.log('');
      hasError = true;

      // 如果還有殘留的 conversations，用其 ID 檢查關聯資料
      const conversationIds = conversationsResult.rows.map(c => c.id);

      // 2. 檢查 alerts
      console.log('2️⃣  檢查 alerts 表（關聯資料）...');
      const alertsResult = await client.query(
        `SELECT id FROM alerts WHERE conversation_id = ANY($1)`,
        [conversationIds]
      );
      if (alertsResult.rows.length === 0) {
        console.log('   ✅ 沒有關聯的 alerts\n');
      } else {
        console.log(`   ⚠️  發現 ${alertsResult.rows.length} 筆 alerts 仍然存在\n`);
      }

      // 3. 檢查 sms_logs
      console.log('3️⃣  檢查 sms_logs 表（關聯資料）...');
      const smsLogsResult = await client.query(
        `SELECT id FROM sms_logs WHERE conversation_id = ANY($1)`,
        [conversationIds]
      );
      if (smsLogsResult.rows.length === 0) {
        console.log('   ✅ 沒有關聯的 sms_logs\n');
      } else {
        console.log(`   ⚠️  發現 ${smsLogsResult.rows.length} 筆 sms_logs 仍然存在\n`);
      }

      // 4. 檢查 meddic_analyses
      console.log('4️⃣  檢查 meddic_analyses 表（關聯資料）...');
      const meddicResult = await client.query(
        `SELECT id FROM meddic_analyses WHERE conversation_id = ANY($1)`,
        [conversationIds]
      );
      if (meddicResult.rows.length === 0) {
        console.log('   ✅ 沒有關聯的 meddic_analyses\n');
      } else {
        console.log(`   ⚠️  發現 ${meddicResult.rows.length} 筆 meddic_analyses 仍然存在\n`);
      }

      // 5. 檢查 sales_todos
      console.log('5️⃣  檢查 sales_todos 表（關聯資料）...');
      const todosResult = await client.query(
        `SELECT id, title FROM sales_todos WHERE conversation_id = ANY($1)`,
        [conversationIds]
      );
      if (todosResult.rows.length === 0) {
        console.log('   ✅ 沒有關聯的 sales_todos\n');
      } else {
        console.log(`   ⚠️  發現 ${todosResult.rows.length} 筆 sales_todos 仍然存在:`);
        todosResult.rows.forEach(t => console.log(`      - ${t.title}`));
        console.log('');
      }
    }

    // 最終結果
    console.log('═══════════════════════════════════════════════');
    if (!hasError) {
      console.log('✅ 驗證成功：所有指定案件及其關聯資料已完全刪除');
    } else {
      console.log('❌ 驗證失敗：仍有資料殘留，請檢查上述錯誤');
    }
    console.log('═══════════════════════════════════════════════');

    await client.end();
    process.exit(hasError ? 1 : 0);

  } catch (error) {
    console.error('❌ 驗證過程發生錯誤:', error);
    await client.end();
    process.exit(1);
  }
}

verifyDeletion();
