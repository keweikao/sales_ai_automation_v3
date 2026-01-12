// scripts/migration/generate-audio-report.ts
/**
 * 音檔遷移報告產生器
 * 彙整所有遷移相關的資訊並產生最終報告
 */

import { sql, like, isNotNull, not } from "drizzle-orm";
import { db, conversations } from "../../packages/db/src/index";
import { r2Config } from "./config";

interface AudioMigrationReport {
  migrationId: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  summary: {
    totalFiles: number;
    successfulMigrations: number;
    failedMigrations: number;
    skippedMigrations: number;
    totalSizeMigrated: string;
    averageSpeed: string;
  };
  sourceStats: {
    bucket: string;
    totalOriginalFiles: number;
    retainedForBackup: boolean;
  };
  targetStats: {
    bucket: string;
    region: string;
    publicUrl: string;
  };
  databaseStats: {
    totalConversations: number;
    conversationsWithR2Url: number;
    conversationsWithGcsUrl: number;
    conversationsWithoutAudio: number;
  };
  failedFiles: Array<{
    gcsUri: string;
    error: string;
    conversationId: string;
    retryCount: number;
  }>;
  urlUpdateStats: {
    totalUpdated: number;
    allAccessible: boolean;
  };
  recommendations: string[];
}

// 格式化檔案大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function generateAudioReport() {
  console.log("📊 產生音檔遷移報告...\n");

  const now = new Date();
  const migrationId = `audio-migration-${now.toISOString().split("T")[0].replace(/-/g, "")}`;

  // 載入各個進度/報告檔案
  const progressFile = Bun.file("scripts/migration/progress/audio-progress.json");
  const manifestFile = Bun.file("scripts/migration/data/gcs-audio-manifest.json");
  const urlMappingFile = Bun.file("scripts/migration/data/audio-url-mapping.json");

  let progress: {
    startedAt: string;
    updatedAt: string;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    failedFiles: Array<{
      gcsUri: string;
      conversationId: string;
      error: string;
      retryCount: number;
    }>;
    urlMappings: Array<{ conversationId: string; gcsUri: string; r2Url: string }>;
  } | null = null;

  let manifest: {
    bucket: string;
    totalFiles: number;
    totalSizeBytes: number;
    files: Array<{ gcsUri: string; sizeBytes: number }>;
  } | null = null;

  let urlMapping: {
    totalMappings: number;
    mappings: Array<{ conversationId: string }>;
  } | null = null;

  // 嘗試載入各檔案
  if (await progressFile.exists()) {
    progress = await progressFile.json();
  }

  if (await manifestFile.exists()) {
    manifest = await manifestFile.json();
  }

  if (await urlMappingFile.exists()) {
    urlMapping = await urlMappingFile.json();
  }

  // 查詢資料庫統計
  const dbStats = await Promise.all([
    // 總對話數
    db
      .select({ count: sql<number>`count(*)` })
      .from(conversations),
    // 有 R2 URL 的對話
    db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        sql`${conversations.audioUrl} IS NOT NULL AND ${conversations.audioUrl} NOT LIKE 'gs://%'`
      ),
    // 有 GCS URL 的對話
    db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(like(conversations.audioUrl, "gs://%")),
    // 沒有音檔的對話
    db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(sql`${conversations.audioUrl} IS NULL`),
  ]);

  const totalConversations = Number(dbStats[0][0]?.count || 0);
  const conversationsWithR2Url = Number(dbStats[1][0]?.count || 0);
  const conversationsWithGcsUrl = Number(dbStats[2][0]?.count || 0);
  const conversationsWithoutAudio = Number(dbStats[3][0]?.count || 0);

  // 計算遷移統計
  const totalFiles = manifest?.totalFiles || 0;
  const successfulMigrations = progress?.successCount || urlMapping?.totalMappings || conversationsWithR2Url;
  const failedMigrations = progress?.failedCount || 0;
  const skippedMigrations = progress?.skippedCount || 0;
  const totalSizeBytes = manifest?.totalSizeBytes || 0;

  // 計算遷移時間和速度
  const startedAt = progress?.startedAt || now.toISOString();
  const completedAt = progress?.updatedAt || now.toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const durationSec = Math.max(durationMs / 1000, 1);
  const speedBytesPerSec = totalSizeBytes / durationSec;

  // 建立建議清單
  const recommendations: string[] = [];

  if (conversationsWithGcsUrl > 0) {
    recommendations.push(
      `仍有 ${conversationsWithGcsUrl} 筆對話使用 GCS URL，建議重新執行遷移腳本`
    );
  }

  if (failedMigrations > 0) {
    recommendations.push(
      `有 ${failedMigrations} 個檔案遷移失敗，建議執行 --retry-failed 重試`
    );
  }

  if (conversationsWithR2Url > 0 && conversationsWithGcsUrl === 0) {
    recommendations.push("建議 30 天後刪除 GCS 備份以節省儲存成本");
  }

  if (recommendations.length === 0) {
    recommendations.push("遷移完成，所有音檔已成功遷移至 R2");
  }

  // 建立報告
  const report: AudioMigrationReport = {
    migrationId,
    startedAt,
    completedAt,
    duration: Math.round(durationSec),
    summary: {
      totalFiles,
      successfulMigrations,
      failedMigrations,
      skippedMigrations,
      totalSizeMigrated: formatSize(totalSizeBytes),
      averageSpeed: `${formatSize(speedBytesPerSec)}/s`,
    },
    sourceStats: {
      bucket: manifest?.bucket || process.env.FIREBASE_STORAGE_BUCKET || "unknown",
      totalOriginalFiles: totalFiles,
      retainedForBackup: true,
    },
    targetStats: {
      bucket: r2Config.bucket || "sales-ai-audio",
      region: "auto",
      publicUrl: r2Config.publicUrl || "https://pub-xxx.r2.dev",
    },
    databaseStats: {
      totalConversations,
      conversationsWithR2Url,
      conversationsWithGcsUrl,
      conversationsWithoutAudio,
    },
    failedFiles: progress?.failedFiles || [],
    urlUpdateStats: {
      totalUpdated: urlMapping?.totalMappings || conversationsWithR2Url,
      allAccessible: conversationsWithGcsUrl === 0,
    },
    recommendations,
  };

  // 輸出報告
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    音檔遷移報告");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log(`Migration ID: ${report.migrationId}`);
  console.log(`Started: ${report.startedAt}`);
  console.log(`Completed: ${report.completedAt}`);
  console.log(`Duration: ${report.duration} seconds\n`);

  console.log("📊 Summary:");
  console.log(`   Total files: ${report.summary.totalFiles}`);
  console.log(`   Successful: ${report.summary.successfulMigrations}`);
  console.log(`   Failed: ${report.summary.failedMigrations}`);
  console.log(`   Skipped: ${report.summary.skippedMigrations}`);
  console.log(`   Total size: ${report.summary.totalSizeMigrated}`);
  console.log(`   Average speed: ${report.summary.averageSpeed}\n`);

  console.log("🗄️ Source (GCS):");
  console.log(`   Bucket: ${report.sourceStats.bucket}`);
  console.log(`   Retained for backup: ${report.sourceStats.retainedForBackup}\n`);

  console.log("☁️ Target (R2):");
  console.log(`   Bucket: ${report.targetStats.bucket}`);
  console.log(`   Region: ${report.targetStats.region}`);
  console.log(`   Public URL: ${report.targetStats.publicUrl}\n`);

  console.log("📦 Database:");
  console.log(`   Total conversations: ${report.databaseStats.totalConversations}`);
  console.log(`   With R2 URL: ${report.databaseStats.conversationsWithR2Url}`);
  console.log(`   With GCS URL: ${report.databaseStats.conversationsWithGcsUrl}`);
  console.log(`   Without audio: ${report.databaseStats.conversationsWithoutAudio}\n`);

  if (report.failedFiles.length > 0) {
    console.log("❌ Failed Files:");
    for (const file of report.failedFiles.slice(0, 10)) {
      console.log(`   - ${file.conversationId}: ${file.error}`);
    }
    if (report.failedFiles.length > 10) {
      console.log(`   ... 還有 ${report.failedFiles.length - 10} 筆`);
    }
    console.log("");
  }

  console.log("💡 Recommendations:");
  for (const rec of report.recommendations) {
    console.log(`   • ${rec}`);
  }
  console.log("");

  // 儲存報告
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = `scripts/migration/reports/audio-migration-report-${timestamp}.json`;
  await Bun.write("scripts/migration/reports/.gitkeep", "");
  await Bun.write(reportPath, JSON.stringify(report, null, 2));

  console.log(`📄 報告已儲存: ${reportPath}`);

  // 產生 GCS 清理計畫
  if (conversationsWithGcsUrl === 0 && conversationsWithR2Url > 0) {
    const cleanupPlan = `# GCS 清理計畫

**建議保留期間**: 30 天

**清理前確認清單**:
- [ ] V3 系統已穩定運行 2 週以上
- [ ] 所有音檔播放功能正常
- [ ] 無使用者回報音檔問題
- [ ] 已確認沒有其他系統依賴 GCS 音檔

**清理指令（30 天後執行）**:
\`\`\`bash
# 列出要刪除的檔案（乾跑）
gsutil ls gs://${report.sourceStats.bucket}/audio/**

# 刪除音檔（請謹慎）
# gsutil -m rm -r gs://${report.sourceStats.bucket}/audio/
\`\`\`

**備份建議**:
- 下載完整備份到本地或其他雲端儲存
- 至少保留 1 份完整備份

---
產生時間: ${now.toISOString()}
`;

    const cleanupPath = "scripts/migration/reports/gcs-cleanup-plan.md";
    await Bun.write(cleanupPath, cleanupPlan);
    console.log(`📄 GCS 清理計畫已儲存: ${cleanupPath}`);
  }

  return report;
}

// 執行
generateAudioReport().catch((error) => {
  console.error("❌ 報告產生失敗:", error);
  process.exit(1);
});
