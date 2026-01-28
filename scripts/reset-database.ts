#!/usr/bin/env bun
/**
 * 資料庫清空腳本
 * 清空所有業務資料，保留用戶帳號
 *
 * 用法: bun run scripts/reset-database.ts
 *
 * 注意：此腳本會清空以下資料：
 * - 所有商機 (opportunities)
 * - 所有對話記錄 (conversations)
 * - 所有 MEDDIC 分析 (meddic_analyses)
 * - 所有待辦事項 (sales_todos, todo_logs)
 * - 所有跟進排程 (follow_ups)
 * - 所有警示 (alerts)
 * - 所有 SMS 記錄 (sms_logs)
 * - 所有分享令牌 (share_tokens)
 * - 其他業務資料
 *
 * 保留的資料：
 * - 用戶帳號 (user, session, account, verification, user_profiles)
 */

import * as dotenv from "dotenv";
import pg from "pg";
import * as readline from "readline";
import * as path from "path";

// 載入環境變數（從 apps/server/.env）
dotenv.config({ path: path.resolve(import.meta.dir, "../apps/server/.env") });

// 需要清空的資料表（按外鍵依賴順序，從最深的依賴開始）
const TABLES_TO_TRUNCATE = [
  // 第一層：依賴最深的表
  "todo_logs",
  "sms_logs",
  "share_tokens",
  "meddic_analyses",
  // 第二層
  "sales_todos",
  "alerts",
  "follow_ups",
  // 第三層
  "conversations",
  // 第四層
  "opportunities",
  // 獨立表
  "form_submissions",
  "lead_sources",
  "team_members",
  "talk_tracks",
  "rep_skills",
  "competitor_info",
  "utm_campaigns",
];

async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n⚠️  警告：此操作將清空所有業務資料！");
    console.log("   以下資料將被刪除：");
    console.log("   - 所有商機和客戶資料");
    console.log("   - 所有對話記錄和音檔連結");
    console.log("   - 所有 MEDDIC 分析結果");
    console.log("   - 所有待辦事項和日誌");
    console.log("\n   用戶帳號將被保留。\n");

    rl.question("確定要繼續嗎？輸入 'YES' 確認: ", (answer) => {
      rl.close();
      resolve(answer === "YES");
    });
  });
}

async function resetDatabase() {
  console.log("🔄 資料庫清空腳本\n");
  console.log("=".repeat(60));

  // 確認操作
  const confirmed = await confirmReset();
  if (!confirmed) {
    console.log("\n❌ 操作已取消");
    process.exit(0);
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("\n✅ 資料庫連線成功\n");

    // 開始清空
    console.log("🗑️  開始清空資料表...\n");

    let successCount = 0;
    let skipCount = 0;

    for (const table of TABLES_TO_TRUNCATE) {
      try {
        // 先檢查表是否存在
        const checkResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          )
        `, [table]);

        if (!checkResult.rows[0]?.exists) {
          console.log(`   ⏭️  ${table} (表不存在，跳過)`);
          skipCount++;
          continue;
        }

        // 取得清空前的記錄數
        const countResult = await client.query(`SELECT COUNT(*) FROM "${table}"`);
        const count = parseInt(countResult.rows[0]?.count || "0", 10);

        // 使用 TRUNCATE CASCADE 清空表
        await client.query(`TRUNCATE TABLE "${table}" CASCADE`);

        console.log(`   ✅ ${table} (刪除 ${count} 筆記錄)`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ ${table} 清空失敗:`, error instanceof Error ? error.message : error);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`\n📊 清空結果：`);
    console.log(`   ✅ 成功清空 ${successCount} 個資料表`);
    if (skipCount > 0) {
      console.log(`   ⏭️  跳過 ${skipCount} 個不存在的資料表`);
    }

    // 驗證結果
    console.log("\n🔍 驗證清空結果...\n");

    const verifyTables = ["opportunities", "conversations", "meddic_analyses", "sales_todos"];
    for (const table of verifyTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM "${table}"`);
        const count = parseInt(result.rows[0]?.count || "0", 10);
        const status = count === 0 ? "✅" : "⚠️";
        console.log(`   ${status} ${table}: ${count} 筆記錄`);
      } catch {
        console.log(`   ⏭️  ${table}: 表不存在`);
      }
    }

    // 確認用戶帳號保留
    console.log("\n👤 確認用戶帳號保留...\n");

    const userResult = await client.query(`SELECT COUNT(*) FROM "user"`);
    const userCount = parseInt(userResult.rows[0]?.count || "0", 10);
    console.log(`   ✅ user: ${userCount} 筆記錄 (已保留)`);

    const profileResult = await client.query(`SELECT COUNT(*) FROM "user_profiles"`);
    const profileCount = parseInt(profileResult.rows[0]?.count || "0", 10);
    console.log(`   ✅ user_profiles: ${profileCount} 筆記錄 (已保留)`);

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ 資料庫清空完成！");
    console.log("\n📝 下一步：");
    console.log("   1. 清空 KV 快取: bunx wrangler kv key list --namespace-id=066c8705db6f4f39955d7050ac12fe03");
    console.log("   2. 清空 R2 音檔: 請至 Cloudflare Dashboard 手動刪除");
    console.log("   3. 新案件編號將從 202701-IC001 開始（依當月計算）");

  } catch (error) {
    console.error("\n❌ 執行失敗:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 執行
resetDatabase();
