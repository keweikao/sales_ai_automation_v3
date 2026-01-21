#!/usr/bin/env node
// scripts/migration/cleanup-v3-database.ts

import { sql } from "drizzle-orm";
import { db } from "./config";

/**
 * 清除 V3 資料庫中的所有資料
 *
 * ⚠️ 警告: 此操作會刪除以下表的所有資料:
 * - meddic_analyses
 * - conversations
 * - opportunities
 * - 其他相關表 (如有)
 *
 * 執行前請確認這些都是測試資料!
 */

async function cleanup() {
  console.log("🚨 V3 資料庫清理工具");
  console.log("=".repeat(80));
  console.log("⚠️  警告: 此操作將刪除以下表的所有資料:");
  console.log("   - meddic_analyses");
  console.log("   - conversations");
  console.log("   - opportunities");
  console.log("=".repeat(80));

  // 安全確認機制
  const isDryRun = process.env.DRY_RUN === "true";
  const forceCleanup = process.env.FORCE_CLEANUP === "true";

  if (!forceCleanup && !isDryRun) {
    console.log("\n❌ 請設定環境變數確認清理操作:");
    console.log("   FORCE_CLEANUP=true  # 確認清理所有資料");
    console.log("   DRY_RUN=true        # 僅查看要刪除的資料數量,不實際刪除");
    console.log("\n範例:");
    console.log("   FORCE_CLEANUP=true bun run scripts/migration/cleanup-v3-database.ts");
    process.exit(1);
  }

  if (isDryRun) {
    console.log("\n📊 DRY RUN 模式 - 僅顯示統計,不實際刪除\n");
  } else {
    console.log("\n🔥 正式清理模式 - 即將刪除資料\n");
  }

  try {
    // 統計當前資料量
    console.log("📊 統計當前資料量:");

    const meddicCount = await db.execute(sql`SELECT COUNT(*) as count FROM meddic_analyses`);
    const conversationsCount = await db.execute(sql`SELECT COUNT(*) as count FROM conversations`);
    const opportunitiesCount = await db.execute(sql`SELECT COUNT(*) as count FROM opportunities`);

    const stats = {
      meddic_analyses: Number(meddicCount.rows[0]?.count || 0),
      conversations: Number(conversationsCount.rows[0]?.count || 0),
      opportunities: Number(opportunitiesCount.rows[0]?.count || 0),
    };

    console.log(`   - meddic_analyses: ${stats.meddic_analyses} 筆`);
    console.log(`   - conversations: ${stats.conversations} 筆`);
    console.log(`   - opportunities: ${stats.opportunities} 筆`);

    const totalRecords = stats.meddic_analyses + stats.conversations + stats.opportunities;
    console.log(`\n   總計: ${totalRecords} 筆資料`);

    if (totalRecords === 0) {
      console.log("\n✅ 資料庫已經是空的,無需清理");
      process.exit(0);
    }

    if (isDryRun) {
      console.log("\n✅ DRY RUN 完成 - 實際清理時請使用:");
      console.log("   FORCE_CLEANUP=true bun run scripts/migration/cleanup-v3-database.ts");
      process.exit(0);
    }

    // 執行清理 (依照外鍵關聯順序刪除)
    console.log("\n🔥 開始清理資料...");

    console.log("\n1️⃣ 刪除 meddic_analyses...");
    const deletedMeddic = await db.execute(sql`
      DELETE FROM meddic_analyses;
    `);
    console.log(`   ✅ 已刪除 ${stats.meddic_analyses} 筆 meddic_analyses`);

    console.log("\n2️⃣ 刪除 conversations...");
    const deletedConversations = await db.execute(sql`
      DELETE FROM conversations;
    `);
    console.log(`   ✅ 已刪除 ${stats.conversations} 筆 conversations`);

    console.log("\n3️⃣ 刪除 opportunities...");
    const deletedOpportunities = await db.execute(sql`
      DELETE FROM opportunities;
    `);
    console.log(`   ✅ 已刪除 ${stats.opportunities} 筆 opportunities`);

    // 驗證清理結果
    console.log("\n📊 驗證清理結果:");

    const verifyMeddic = await db.execute(sql`SELECT COUNT(*) as count FROM meddic_analyses`);
    const verifyConversations = await db.execute(sql`SELECT COUNT(*) as count FROM conversations`);
    const verifyOpportunities = await db.execute(sql`SELECT COUNT(*) as count FROM opportunities`);

    const afterStats = {
      meddic_analyses: Number(verifyMeddic.rows[0]?.count || 0),
      conversations: Number(verifyConversations.rows[0]?.count || 0),
      opportunities: Number(verifyOpportunities.rows[0]?.count || 0),
    };

    console.log(`   - meddic_analyses: ${afterStats.meddic_analyses} 筆`);
    console.log(`   - conversations: ${afterStats.conversations} 筆`);
    console.log(`   - opportunities: ${afterStats.opportunities} 筆`);

    const remainingRecords = afterStats.meddic_analyses + afterStats.conversations + afterStats.opportunities;

    if (remainingRecords === 0) {
      console.log("\n" + "=".repeat(80));
      console.log("✅ 清理完成! V3 資料庫已清空");
      console.log("=".repeat(80));
      console.log("\n📝 下一步:");
      console.log("   1. 確認 V2 Firestore 連線正常");
      console.log("   2. 執行遷移: DRY_RUN=true bun run scripts/migration/migrate-v3-cases.ts");
      console.log("   3. 確認無誤後正式遷移: DRY_RUN=false bun run scripts/migration/migrate-v3-cases.ts");
      process.exit(0);
    } else {
      console.log("\n" + "=".repeat(80));
      console.log(`⚠️  警告: 仍有 ${remainingRecords} 筆資料未清除`);
      console.log("=".repeat(80));
      process.exit(1);
    }

  } catch (error) {
    console.error("\n❌ 清理失敗:", error);
    throw error;
  }
}

cleanup().catch((error) => {
  console.error("💥 清理過程發生錯誤:", error);
  process.exit(1);
});
