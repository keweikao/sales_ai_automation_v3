// scripts/migration/migrate-v2.ts
/**
 * V2 Cases → V3 完整遷移腳本
 *
 * 使用方式:
 *   bun run scripts/migration/migrate-v2.ts
 *
 * Dry Run:
 *   DRY_RUN=true bun run scripts/migration/migrate-v2.ts
 */

import { conversations, opportunities } from "../../packages/db/src/schema";
import { db, firestore, migrationConfig, withRetry } from "./config";
import {
  extractUniqueOpportunities,
  mapCaseToConversation,
  normalizeCustomerId,
} from "./mappers/v2-mapper";
import { createProgress, loadProgress, saveProgress } from "./progress";
import type { MigrationStats } from "./types";
import { parseV2Case, type V2Case } from "./types-v2";

function createEmptyStats(): MigrationStats {
  return {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("            V2 Cases → V3 Migration");
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (migrationConfig.dryRun) {
    console.log("⚠️  DRY RUN MODE - 不會實際寫入資料\n");
  }

  // 檢查必要環境變數
  const userId = process.env.MIGRATION_USER_ID;
  if (!userId) {
    console.error("❌ MIGRATION_USER_ID 未設定");
    process.exit(1);
  }

  const startTime = Date.now();
  const opportunityStats = createEmptyStats();
  const conversationStats = createEmptyStats();

  try {
    // 載入進度
    const progress = (await loadProgress()) || createProgress();

    // ========== Phase 1: 讀取所有 Cases ==========
    console.log("📥 Phase 1: 讀取 Firestore cases 集合...\n");

    const casesSnapshot = await firestore.collection("cases").get();
    const allCases: V2Case[] = [];

    for (const doc of casesSnapshot.docs) {
      const v2Case = parseV2Case(doc.id, doc.data());
      allCases.push(v2Case);
    }

    console.log(`   找到 ${allCases.length} 筆 cases\n`);

    // ========== Phase 2: 建立 Opportunities ==========
    console.log("📊 Phase 2: 建立 Opportunities...\n");

    const uniqueOpportunities = extractUniqueOpportunities(allCases, userId);
    opportunityStats.total = uniqueOpportunities.size;

    console.log(`   需要建立 ${uniqueOpportunities.size} 個 opportunities\n`);

    for (const [customerId, opportunity] of uniqueOpportunities) {
      try {
        if (migrationConfig.verbose) {
          console.log(`   → ${customerId}: ${opportunity.companyName}`);
        }

        if (!migrationConfig.dryRun) {
          await withRetry(
            () =>
              db
                .insert(opportunities)
                .values(opportunity)
                .onConflictDoNothing(),
            `Insert opportunity ${customerId}`
          );
        }

        opportunityStats.success++;
      } catch (error) {
        opportunityStats.failed++;
        opportunityStats.errors.push({
          id: customerId,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`   ❌ ${customerId}: ${error}`);
      }
    }

    console.log(
      `\n   ✅ Opportunities: ${opportunityStats.success} 成功, ${opportunityStats.failed} 失敗\n`
    );

    // ========== Phase 3: 建立 Conversations ==========
    console.log("💬 Phase 3: 建立 Conversations...\n");

    conversationStats.total = allCases.length;

    // 分批處理
    for (let i = 0; i < allCases.length; i += migrationConfig.batchSize) {
      const batch = allCases.slice(i, i + migrationConfig.batchSize);

      for (const v2Case of batch) {
        try {
          // 檢查是否有對應的 opportunity（使用正規化的 customerId）
          const opportunityId = normalizeCustomerId(v2Case.customerId);
          if (!opportunityId) {
            conversationStats.skipped++;
            continue;
          }

          const conversation = mapCaseToConversation(v2Case, opportunityId);

          if (migrationConfig.verbose) {
            console.log(
              `   → ${v2Case.caseId}: ${v2Case.customerName} (${v2Case.status})`
            );
          }

          if (!migrationConfig.dryRun) {
            await withRetry(
              () =>
                db
                  .insert(conversations)
                  .values(conversation)
                  .onConflictDoNothing(),
              `Insert conversation ${v2Case.caseId}`
            );
          }

          conversationStats.success++;
        } catch (error) {
          conversationStats.failed++;
          conversationStats.errors.push({
            id: v2Case.caseId,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`   ❌ ${v2Case.caseId}: ${error}`);
        }
      }

      // 顯示進度
      const processed = Math.min(i + migrationConfig.batchSize, allCases.length);
      const percent = Math.round((processed / allCases.length) * 100);
      console.log(`   進度: ${processed}/${allCases.length} (${percent}%)`);

      // 批次間延遲
      if (i + migrationConfig.batchSize < allCases.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, migrationConfig.batchDelayMs)
        );
      }
    }

    console.log(
      `\n   ✅ Conversations: ${conversationStats.success} 成功, ${conversationStats.failed} 失敗, ${conversationStats.skipped} 跳過\n`
    );

    // ========== 結果摘要 ==========
    const duration = (Date.now() - startTime) / 1000;

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                        遷移結果");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log(`📊 Opportunities:`);
    console.log(`   - 總數: ${opportunityStats.total}`);
    console.log(`   - 成功: ${opportunityStats.success}`);
    console.log(`   - 失敗: ${opportunityStats.failed}`);

    console.log(`\n💬 Conversations:`);
    console.log(`   - 總數: ${conversationStats.total}`);
    console.log(`   - 成功: ${conversationStats.success}`);
    console.log(`   - 失敗: ${conversationStats.failed}`);
    console.log(`   - 跳過: ${conversationStats.skipped}`);

    console.log(`\n⏱️  執行時間: ${duration.toFixed(1)} 秒`);

    if (migrationConfig.dryRun) {
      console.log("\n⚠️  這是 Dry Run，沒有實際寫入資料");
    }

    // 顯示錯誤
    const allErrors = [
      ...opportunityStats.errors,
      ...conversationStats.errors,
    ];
    if (allErrors.length > 0) {
      console.log(`\n❌ 錯誤清單 (${allErrors.length} 筆):`);
      for (const err of allErrors.slice(0, 10)) {
        console.log(`   - ${err.id}: ${err.error}`);
      }
      if (allErrors.length > 10) {
        console.log(`   ... 還有 ${allErrors.length - 10} 筆錯誤`);
      }
    }

    console.log("\n🎉 遷移完成！\n");
  } catch (error) {
    console.error("\n❌ 遷移失敗:", error);
    process.exit(1);
  }
}

main();
