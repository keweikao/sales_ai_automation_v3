// scripts/migration/rollback-audio-urls.ts
/**
 * 音檔 URL 回滾腳本
 * 將 PostgreSQL conversations.audio_url 從 R2 URL 還原為 GCS URL
 */

import { eq, like, sql } from "drizzle-orm";
import { db, conversations, migrationConfig } from "./config";

interface UrlMapping {
  conversationId: string;
  gcsUri: string;
  r2Url: string;
}

interface UrlMappingFile {
  generatedAt: string;
  totalMappings: number;
  mappings: UrlMapping[];
}

interface RollbackStats {
  total: number;
  rolledBack: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

async function rollbackAudioUrls() {
  console.log("🔄 回滾音檔 URLs (R2 → GCS)...\n");

  // 確認環境變數
  const confirmEnv = process.env.CONFIRM_ROLLBACK;
  if (confirmEnv !== "yes" && !migrationConfig.dryRun) {
    console.log("⚠️  警告: 此操作將把所有 R2 URL 還原為 GCS URL");
    console.log("");
    console.log("若要執行，請設定環境變數:");
    console.log("  CONFIRM_ROLLBACK=yes bun run scripts/migration/rollback-audio-urls.ts");
    console.log("");
    console.log("或使用 dry run 模式預覽:");
    console.log("  DRY_RUN=true bun run scripts/migration/rollback-audio-urls.ts");
    process.exit(1);
  }

  // 載入 URL 對應檔案
  const mappingPath = "scripts/migration/data/audio-url-mapping.json";
  const mappingFile = Bun.file(mappingPath);

  if (!(await mappingFile.exists())) {
    console.error("❌ 找不到 URL 對應檔案");
    console.error(`   路徑: ${mappingPath}`);
    console.error("   無法執行回滾，因為沒有原始 GCS URL 的記錄");
    process.exit(1);
  }

  const mappingData: UrlMappingFile = await mappingFile.json();
  console.log(`📋 載入 ${mappingData.totalMappings} 筆 URL 對應\n`);

  const stats: RollbackStats = {
    total: mappingData.totalMappings,
    rolledBack: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // 建立 conversationId -> gcsUri 的 Map
  const urlMap = new Map<string, string>();
  for (const mapping of mappingData.mappings) {
    urlMap.set(mapping.conversationId, mapping.gcsUri);
  }

  console.log("🔄 Rolling back audio URLs in PostgreSQL...\n");

  if (migrationConfig.dryRun) {
    console.log("🏃 DRY RUN 模式 - 不會實際修改資料庫\n");
  }

  // 分批處理
  const batchSize = migrationConfig.batchSize;
  const conversationIds = Array.from(urlMap.keys());

  for (let i = 0; i < conversationIds.length; i += batchSize) {
    const batch = conversationIds.slice(i, i + batchSize);

    for (const conversationId of batch) {
      const gcsUri = urlMap.get(conversationId);
      if (!gcsUri) continue;

      try {
        // 取得目前的 audio_url
        const [current] = await db
          .select({ audioUrl: conversations.audioUrl })
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1);

        if (!current) {
          console.log(`   ⏭️ 找不到 conversation: ${conversationId}`);
          stats.skipped++;
          continue;
        }

        // 如果已經是 GCS URL，跳過
        if (current.audioUrl?.startsWith("gs://")) {
          console.log(`   ⏭️ 已是 GCS URL: ${conversationId}`);
          stats.skipped++;
          continue;
        }

        // 如果沒有 audio URL，跳過
        if (!current.audioUrl) {
          console.log(`   ⏭️ 無 audio URL: ${conversationId}`);
          stats.skipped++;
          continue;
        }

        if (migrationConfig.dryRun) {
          console.log(`[DRY RUN] Would rollback: ${conversationId}`);
          console.log(`          ${current.audioUrl.slice(0, 50)}...`);
          console.log(`          → ${gcsUri}`);
          stats.rolledBack++;
          continue;
        }

        // 更新 URL 回 GCS
        await db
          .update(conversations)
          .set({
            audioUrl: gcsUri,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));

        console.log(`   ✓ ${conversationId}: → ${gcsUri.split("/").pop()}`);
        stats.rolledBack++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log(`   ✗ ${conversationId}: ${errorMessage}`);
        stats.failed++;
        stats.errors.push({ id: conversationId, error: errorMessage });
      }
    }

    // 顯示進度
    const processed = Math.min(i + batchSize, conversationIds.length);
    console.log(
      `\nProgress: ${processed}/${conversationIds.length} (${Math.round((processed / conversationIds.length) * 100)}%)\n`
    );
  }

  // 驗證回滾結果
  console.log("\n驗證回滾結果...");

  const gcsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(like(conversations.audioUrl, "gs://%"));

  const r2Count = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(
      sql`${conversations.audioUrl} IS NOT NULL AND ${conversations.audioUrl} NOT LIKE 'gs://%'`
    );

  const gcsCountNum = Number(gcsCount[0]?.count || 0);
  const r2CountNum = Number(r2Count[0]?.count || 0);

  // 輸出結果
  console.log("\n═══════════════════════════════════════════════════════════════\n");
  console.log("✅ URL Rollback Complete");
  console.log(`   Total: ${stats.total}`);
  console.log(`   Rolled back: ${stats.rolledBack}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Failed: ${stats.failed}`);
  console.log("");
  console.log("📊 Database Status:");
  console.log(`   GCS URLs: ${gcsCountNum}`);
  console.log(`   R2 URLs: ${r2CountNum}`);
  console.log("");

  if (r2CountNum > 0) {
    console.log(`⚠️ 警告: 仍有 ${r2CountNum} 筆對話使用 R2 URL`);
    console.log("   這些可能是沒有在 mapping 檔案中的記錄");
    console.log("");
  }

  if (stats.failed > 0) {
    console.log("❌ 失敗的回滾:");
    for (const error of stats.errors.slice(0, 10)) {
      console.log(`   - ${error.id}: ${error.error}`);
    }
    if (stats.errors.length > 10) {
      console.log(`   ... 還有 ${stats.errors.length - 10} 筆`);
    }
    console.log("");
  }

  // 儲存回滾報告
  const reportPath = `scripts/migration/logs/url-rollback-report-${new Date().toISOString().split("T")[0]}.json`;
  await Bun.write("scripts/migration/logs/.gitkeep", "");
  await Bun.write(
    reportPath,
    JSON.stringify(
      {
        rolledBackAt: new Date().toISOString(),
        dryRun: migrationConfig.dryRun,
        stats,
        databaseStatus: {
          gcsUrls: gcsCountNum,
          r2Urls: r2CountNum,
        },
      },
      null,
      2
    )
  );

  console.log(`📄 回滾報告已儲存: ${reportPath}`);

  return stats;
}

// 執行
rollbackAudioUrls().catch((error) => {
  console.error("❌ 回滾失敗:", error);
  process.exit(1);
});
