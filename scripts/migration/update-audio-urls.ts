// scripts/migration/update-audio-urls.ts
/**
 * 音檔 URL 更新腳本
 * 更新 PostgreSQL conversations.audio_url 從 GCS URL 到 R2 URL
 */

import { eq, like } from "drizzle-orm";
import { conversations, db } from "../../packages/db/src/index";
import { migrationConfig } from "./config";

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

interface UpdateStats {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

async function updateAudioUrls() {
  console.log("🔗 更新音檔 URLs (GCS → R2)...\n");

  // 載入 URL 對應檔案
  const mappingPath = "scripts/migration/data/audio-url-mapping.json";
  const mappingFile = Bun.file(mappingPath);

  if (!(await mappingFile.exists())) {
    console.error("❌ 找不到 URL 對應檔案");
    console.error("   請先執行: bun run scripts/migration/migrate-audio.ts");
    process.exit(1);
  }

  const mappingData: UrlMappingFile = await mappingFile.json();
  console.log(`📋 載入 ${mappingData.totalMappings} 筆 URL 對應\n`);

  const stats: UpdateStats = {
    total: mappingData.totalMappings,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // 建立 conversationId -> r2Url 的 Map
  const urlMap = new Map<string, string>();
  for (const mapping of mappingData.mappings) {
    urlMap.set(mapping.conversationId, mapping.r2Url);
  }

  console.log("🔗 Updating audio URLs in PostgreSQL...\n");

  // 分批處理
  const batchSize = migrationConfig.batchSize;
  const conversationIds = Array.from(urlMap.keys());

  for (let i = 0; i < conversationIds.length; i += batchSize) {
    const batch = conversationIds.slice(i, i + batchSize);

    for (const conversationId of batch) {
      const r2Url = urlMap.get(conversationId);
      if (!r2Url) {
        continue;
      }

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

        // 如果已經是 R2 URL，跳過
        if (current.audioUrl && !current.audioUrl.startsWith("gs://")) {
          console.log(`   ⏭️ 已是 R2 URL: ${conversationId}`);
          stats.skipped++;
          continue;
        }

        if (migrationConfig.dryRun) {
          console.log(`[DRY RUN] Would update: ${conversationId}`);
          console.log(`          ${current.audioUrl || "(null)"} → ${r2Url}`);
          stats.updated++;
          continue;
        }

        // 更新 URL
        await db
          .update(conversations)
          .set({
            audioUrl: r2Url,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));

        console.log(
          `   ✓ ${conversationId}: ${current.audioUrl?.slice(0, 30) || "(null)"}... → ${r2Url.split("/").pop()}`
        );
        stats.updated++;
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

  // 額外檢查：更新資料庫中有 GCS URL 但不在 mapping 中的記錄
  console.log("\n檢查其他 GCS URLs...");

  const gcsConversations = await db
    .select({
      id: conversations.id,
      audioUrl: conversations.audioUrl,
    })
    .from(conversations)
    .where(like(conversations.audioUrl, "gs://%"));

  if (gcsConversations.length > 0) {
    console.log(`⚠️ 發現 ${gcsConversations.length} 筆仍有 GCS URL 的記錄:`);
    for (const conv of gcsConversations.slice(0, 10)) {
      console.log(`   - ${conv.id}: ${conv.audioUrl}`);
    }
    if (gcsConversations.length > 10) {
      console.log(`   ... 還有 ${gcsConversations.length - 10} 筆`);
    }
    console.log("\n   這些記錄可能需要手動處理或重新執行音檔遷移。");
  } else {
    console.log("✅ 沒有殘留的 GCS URLs");
  }

  // 輸出結果
  console.log(
    "\n═══════════════════════════════════════════════════════════════\n"
  );
  console.log("✅ URL Update Complete");
  console.log(`   Total: ${stats.total}`);
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Failed: ${stats.failed}`);
  console.log("");

  // 儲存更新報告
  const reportPath = "scripts/migration/logs/url-update-report.json";
  await Bun.write("scripts/migration/logs/.gitkeep", "");
  await Bun.write(
    reportPath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        dryRun: migrationConfig.dryRun,
        stats,
        remainingGcsUrls: gcsConversations.length,
      },
      null,
      2
    )
  );

  console.log(`📄 更新報告已儲存: ${reportPath}`);

  return stats;
}

// 執行
updateAudioUrls().catch((error) => {
  console.error("❌ 更新失敗:", error);
  process.exit(1);
});
