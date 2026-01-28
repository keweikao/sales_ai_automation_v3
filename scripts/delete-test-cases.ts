#!/usr/bin/env bun
/**
 * 測試案件刪除工具
 *
 * ⚠️ 警告：此操作將永久刪除資料，無法恢復！
 *
 * 使用方式：
 *   bun scripts/delete-test-cases.ts 202601-IC010 202601-IC011
 *   bun scripts/delete-test-cases.ts 202601-IC010~202601-IC020  # 範圍刪除
 *   bun scripts/delete-test-cases.ts --all-orphaned               # 刪除所有孤立的 opportunities
 *   bun scripts/delete-test-cases.ts --help                       # 顯示幫助
 *
 * 選項：
 *   --cleanup-opportunities    刪除完案件後，自動清理孤立的 opportunities
 *   --dry-run                  預覽模式，不實際執行刪除
 *   --yes                      跳過確認，直接執行
 */

import * as dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: "apps/server/.env" });

// ============================================================
// 工具函數
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    caseNumbers: [] as string[],
    cleanupOpportunities: false,
    allOrphaned: false,
    dryRun: false,
    skipConfirm: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--cleanup-opportunities') {
      options.cleanupOpportunities = true;
    } else if (arg === '--all-orphaned') {
      options.allOrphaned = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.skipConfirm = true;
    } else if (arg.includes('~')) {
      // 範圍刪除：202601-IC010~202601-IC020
      const [start, end] = arg.split('~');
      const startMatch = start.match(/(\d{6})-IC(\d+)/);
      const endMatch = end.match(/(\d{6})-IC(\d+)/);

      if (startMatch && endMatch) {
        const prefix = startMatch[1];
        const startNum = parseInt(startMatch[2]);
        const endNum = parseInt(endMatch[2]);

        for (let i = startNum; i <= endNum; i++) {
          options.caseNumbers.push(`${prefix}-IC${String(i).padStart(3, '0')}`);
        }
      }
    } else if (arg.match(/^\d{6}-IC\d{3}$/)) {
      // 單一案件編號
      options.caseNumbers.push(arg);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
📦 測試案件刪除工具

使用方式：
  bun scripts/delete-test-cases.ts <案件編號...> [選項]

範例：
  bun scripts/delete-test-cases.ts 202601-IC010
  bun scripts/delete-test-cases.ts 202601-IC010 202601-IC011 202601-IC012
  bun scripts/delete-test-cases.ts 202601-IC010~202601-IC020
  bun scripts/delete-test-cases.ts --all-orphaned

選項：
  --cleanup-opportunities   刪除完案件後，自動清理孤立的 opportunities
  --all-orphaned           只清理孤立的 opportunities（不刪除案件）
  --dry-run                預覽模式，不實際執行刪除
  --yes, -y                跳過確認，直接執行
  --help, -h               顯示此幫助訊息

說明：
  - 案件編號格式：YYYYMM-IC###（如 202601-IC046）
  - 範圍刪除：使用 ~ 符號（如 202601-IC010~202601-IC020）
  - 刪除順序：alerts → sms_logs → meddic_analyses → sales_todos → conversations
  - 孤立 opportunities：沒有任何 conversations 的客戶記錄
`);
}

async function confirmDeletion(message: string): Promise<boolean> {
  console.log(`\n⚠️  ${message}`);
  console.log('是否繼續？輸入 "yes" 確認：');

  // 簡單的同步輸入（在 Bun 環境）
  const answer = prompt('> ');
  return answer?.toLowerCase() === 'yes';
}

// ============================================================
// 刪除功能
// ============================================================

async function deleteCases(
  client: Client,
  caseNumbers: string[],
  dryRun: boolean
): Promise<{ deleted: number; opportunities: string[] }> {
  console.log('🔍 查詢要刪除的案件...');
  const conversationsQuery = await client.query(
    `SELECT id, case_number, title, opportunity_id FROM conversations WHERE case_number = ANY($1)`,
    [caseNumbers]
  );

  const conversations = conversationsQuery.rows;
  console.log(`\n找到 ${conversations.length} 個案件：`);
  conversations.forEach((c, idx) => {
    console.log(`  ${idx + 1}. ${c.case_number} - ${c.title || '(無標題)'}`);
  });

  if (conversations.length === 0) {
    console.log('\n沒有找到任何案件。');
    return { deleted: 0, opportunities: [] };
  }

  if (dryRun) {
    console.log('\n🔍 預覽模式：不會實際執行刪除');
    return {
      deleted: conversations.length,
      opportunities: [...new Set(conversations.map(c => c.opportunity_id))],
    };
  }

  console.log('\n⏳ 開始刪除關聯資料...\n');

  const conversationIds = conversations.map(c => c.id);
  const opportunityIds = [...new Set(conversations.map(c => c.opportunity_id))];

  // 1. 刪除 alerts
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

  // 2. 刪除 sms_logs
  try {
    const smsLogsResult = await client.query(
      `DELETE FROM sms_logs WHERE conversation_id = ANY($1) RETURNING id`,
      [conversationIds]
    );
    console.log(`✅ 刪除 ${smsLogsResult.rowCount || 0} 筆 sms_logs`);
  } catch (error: any) {
    if (error.code === '42P01' || error.code === '42703') {
      console.log(`⚠️  sms_logs 表問題，跳過`);
    } else {
      throw error;
    }
  }

  // 3. 刪除 meddic_analyses
  const meddicResult = await client.query(
    `DELETE FROM meddic_analyses WHERE conversation_id = ANY($1) RETURNING id`,
    [conversationIds]
  );
  console.log(`✅ 刪除 ${meddicResult.rowCount || 0} 筆 meddic_analyses`);

  // 4. 刪除 sales_todos
  const todosResult = await client.query(
    `DELETE FROM sales_todos WHERE conversation_id = ANY($1) RETURNING id, title`,
    [conversationIds]
  );
  console.log(`✅ 刪除 ${todosResult.rowCount || 0} 筆 sales_todos`);
  if (todosResult.rows.length > 0 && todosResult.rows.length <= 5) {
    console.log('   已刪除的待辦事項:');
    todosResult.rows.forEach((todo, idx) => {
      console.log(`   ${idx + 1}. ${todo.title}`);
    });
  }

  // 5. 刪除 conversations
  console.log('\n⏳ 刪除案件主記錄...');
  const conversationsResult = await client.query(
    `DELETE FROM conversations WHERE case_number = ANY($1) RETURNING id, case_number, title`,
    [caseNumbers]
  );

  console.log(`\n✅ 成功刪除 ${conversationsResult.rowCount || 0} 筆 conversations`);

  return {
    deleted: conversationsResult.rowCount || 0,
    opportunities: opportunityIds,
  };
}

async function deleteOrphanedOpportunities(
  client: Client,
  dryRun: boolean
): Promise<number> {
  console.log('\n🔍 查詢孤立的 opportunities...');

  const findResult = await client.query(`
    SELECT
      o.id,
      o.customer_number,
      o.company_name,
      o.contact_name
    FROM opportunities o
    LEFT JOIN conversations c ON c.opportunity_id = o.id
    GROUP BY o.id, o.customer_number, o.company_name, o.contact_name
    HAVING COUNT(c.id) = 0
  `);

  if (findResult.rows.length === 0) {
    console.log('✅ 沒有孤立的 opportunities');
    return 0;
  }

  console.log(`找到 ${findResult.rows.length} 個孤立的 opportunities:\n`);
  findResult.rows.forEach((opp, idx) => {
    console.log(`  ${idx + 1}. ${opp.customer_number} - ${opp.company_name || '(無公司名稱)'}`);
  });

  if (dryRun) {
    console.log('\n🔍 預覽模式：不會實際執行刪除');
    return findResult.rows.length;
  }

  const opportunityIds = findResult.rows.map(o => o.id);

  console.log('\n⏳ 開始刪除孤立的 opportunities...\n');

  // 1. 刪除關聯的 sales_todos
  const todosResult = await client.query(
    `DELETE FROM sales_todos WHERE opportunity_id = ANY($1) RETURNING id`,
    [opportunityIds]
  );
  console.log(`✅ 刪除 ${todosResult.rowCount || 0} 筆關聯的 sales_todos`);

  // 2. 刪除關聯的 alerts
  const alertsResult = await client.query(
    `DELETE FROM alerts WHERE opportunity_id = ANY($1) RETURNING id`,
    [opportunityIds]
  );
  console.log(`✅ 刪除 ${alertsResult.rowCount || 0} 筆關聯的 alerts`);

  // 3. 刪除 opportunities
  const deleteResult = await client.query(
    `DELETE FROM opportunities WHERE id = ANY($1) RETURNING id, customer_number, company_name`,
    [opportunityIds]
  );

  console.log(`\n✅ 成功刪除 ${deleteResult.rowCount || 0} 筆 opportunities`);

  return deleteResult.rowCount || 0;
}

// ============================================================
// 主程式
// ============================================================

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.allOrphaned && options.caseNumbers.length === 0) {
    console.error('❌ 錯誤：請提供至少一個案件編號，或使用 --all-orphaned 選項\n');
    showHelp();
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    if (options.dryRun) {
      console.log('🔍 預覽模式（不會實際執行刪除）\n');
    }

    // 模式 1: 只清理孤立的 opportunities
    if (options.allOrphaned) {
      if (!options.skipConfirm && !options.dryRun) {
        const confirmed = await confirmDeletion(
          '即將刪除所有孤立的 opportunities（沒有任何 conversations 的客戶記錄）'
        );
        if (!confirmed) {
          console.log('❌ 已取消');
          await client.end();
          process.exit(0);
        }
      }

      const deleted = await deleteOrphanedOpportunities(client, options.dryRun);
      console.log(`\n🎉 完成！${options.dryRun ? '預覽' : '刪除'} ${deleted} 個孤立的 opportunities`);
    }
    // 模式 2: 刪除指定案件
    else {
      console.log('⚠️  即將刪除以下案件：');
      console.log('案件編號:', options.caseNumbers);
      console.log('');

      if (!options.skipConfirm && !options.dryRun) {
        const confirmed = await confirmDeletion(
          `即將刪除 ${options.caseNumbers.length} 個案件及其所有關聯資料`
        );
        if (!confirmed) {
          console.log('❌ 已取消');
          await client.end();
          process.exit(0);
        }
      }

      const result = await deleteCases(client, options.caseNumbers, options.dryRun);
      console.log(`\n🎉 完成！${options.dryRun ? '預覽' : '刪除'} ${result.deleted} 個案件`);

      // 自動清理孤立的 opportunities
      if (options.cleanupOpportunities && !options.dryRun) {
        console.log('\n' + '='.repeat(50));
        const deletedOpps = await deleteOrphanedOpportunities(client, options.dryRun);
        if (deletedOpps > 0) {
          console.log(`\n🎉 額外清理 ${deletedOpps} 個孤立的 opportunities`);
        }
      } else if (!options.dryRun) {
        console.log('\n💡 提示：如需清理孤立的 opportunities，請使用 --cleanup-opportunities 選項');
      }
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 執行失敗:', error);
    await client.end();
    process.exit(1);
  }
}

main();
