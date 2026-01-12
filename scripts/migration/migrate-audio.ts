// scripts/migration/migrate-audio.ts
/**
 * 音檔遷移腳本 (GCS → R2)
 * 支援斷點續傳、--resume 參數、並行處理
 */

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { gcsStorage, migrationConfig, r2Config } from "./config";
import type { MigrationStats } from "./types";

// 進度檔案介面
interface AudioMigrationProgress {
  lastProcessedIndex: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  failedFiles: Array<{
    gcsUri: string;
    conversationId: string;
    error: string;
    retryCount: number;
  }>;
  urlMappings: Array<{
    conversationId: string;
    gcsUri: string;
    r2Url: string;
  }>;
  startedAt: string;
  updatedAt: string;
}

// 音檔清單介面
interface AudioManifest {
  exportedAt: string;
  bucket: string;
  totalFiles: number;
  files: Array<{
    gcsUri: string;
    path: string;
    sizeBytes: number;
    contentType: string;
    conversationId?: string;
  }>;
}

// R2 客戶端
const r2Client = new S3Client({
  region: "auto",
  endpoint: r2Config.endpoint,
  credentials: {
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
  },
});

// 進度檔案路徑
const PROGRESS_FILE = "scripts/migration/progress/audio-progress.json";
const MANIFEST_FILE = "scripts/migration/data/gcs-audio-manifest.json";

// GCS URI 解析正則表達式
const GCS_URI_REGEX = /^gs:\/\/([^/]+)\/(.+)$/;

/**
 * 從 GCS URI 提取 bucket 和 path
 */
function parseGcsUri(gcsUri: string): { bucket: string; path: string } | null {
  const match = gcsUri.match(GCS_URI_REGEX);
  if (!match) {
    return null;
  }
  return { bucket: match[1], path: match[2] };
}

/**
 * 載入遷移進度
 */
async function loadAudioProgress(): Promise<AudioMigrationProgress | null> {
  try {
    const file = Bun.file(PROGRESS_FILE);
    if (await file.exists()) {
      const content = await file.text();
      if (content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (error) {
    console.warn("無法載入音檔遷移進度:", error);
  }
  return null;
}

/**
 * 儲存遷移進度
 */
async function saveAudioProgress(
  progress: AudioMigrationProgress
): Promise<void> {
  progress.updatedAt = new Date().toISOString();

  // 確保目錄存在
  await Bun.write("scripts/migration/progress/.gitkeep", "");
  await Bun.write(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * 建立新的遷移進度
 */
function createAudioProgress(): AudioMigrationProgress {
  return {
    lastProcessedIndex: -1,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    failedFiles: [],
    urlMappings: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 檢查 R2 檔案是否已存在
 */
async function r2FileExists(key: string): Promise<boolean> {
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: r2Config.bucket,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 產生 R2 key（根據日期組織目錄結構）
 */
function generateR2Key(conversationId: string, createdAt?: string): string {
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `audio/${year}/${month}/${conversationId}.mp3`;
}

/**
 * 格式化檔案大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 遷移單個音檔 GCS → R2
 */
export async function migrateAudioFile(
  gcsUri: string,
  conversationId: string,
  createdAt?: string
): Promise<string> {
  const parsed = parseGcsUri(gcsUri);
  if (!parsed) {
    throw new Error(`Invalid GCS URI: ${gcsUri}`);
  }

  const r2Key = generateR2Key(conversationId, createdAt);

  // 檢查是否已存在
  if (await r2FileExists(r2Key)) {
    console.log(`   ⏭️ 已存在: ${r2Key}`);
    return `${r2Config.publicUrl}/${r2Key}`;
  }

  // 從 GCS 下載
  const bucket = gcsStorage.bucket(parsed.bucket);
  const file = bucket.file(parsed.path);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`GCS file not found: ${gcsUri}`);
  }

  const [buffer] = await file.download();

  // 上傳到 R2
  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: r2Key,
      Body: buffer,
      ContentType: "audio/mpeg",
      CacheControl: "public, max-age=31536000", // 1 年快取
    })
  );

  const r2Url = `${r2Config.publicUrl}/${r2Key}`;
  return r2Url;
}

/**
 * 批次遷移所有音檔（支援斷點續傳）
 */
export async function migrateAllAudioFiles(options: {
  resume?: boolean;
  retryFailed?: boolean;
  batchStart?: number;
  batchEnd?: number;
}): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // 載入 manifest
  const manifestFile = Bun.file(MANIFEST_FILE);
  if (!(await manifestFile.exists())) {
    console.error("❌ 找不到音檔清單檔案");
    console.error("   請先執行: bun run scripts/migration/list-gcs-audio.ts");
    process.exit(1);
  }

  const manifest: AudioManifest = await manifestFile.json();

  // 篩選有 conversationId 的檔案
  let filesToMigrate = manifest.files.filter((f) => f.conversationId);

  // 處理 batch 範圍
  if (options.batchStart !== undefined || options.batchEnd !== undefined) {
    const start = options.batchStart ?? 0;
    const end = options.batchEnd ?? filesToMigrate.length;
    filesToMigrate = filesToMigrate.slice(start, end);
    console.log(`📋 Batch mode: ${start} to ${end}`);
  }

  stats.total = filesToMigrate.length;

  // 載入或建立進度
  let progress: AudioMigrationProgress;
  if (options.resume) {
    const existingProgress = await loadAudioProgress();
    if (existingProgress) {
      progress = existingProgress;
      console.log(`📋 從斷點繼續: index ${progress.lastProcessedIndex + 1}`);
      console.log(
        `   已成功: ${progress.successCount}, 已失敗: ${progress.failedCount}`
      );
    } else {
      progress = createAudioProgress();
      console.log("⚠️ 找不到進度檔案，從頭開始");
    }
  } else if (options.retryFailed) {
    const existingProgress = await loadAudioProgress();
    if (existingProgress && existingProgress.failedFiles.length > 0) {
      progress = existingProgress;
      console.log(`🔄 重試失敗的檔案: ${progress.failedFiles.length} 個`);
      // 重試失敗的檔案
      await retryFailedFiles(progress, stats);
      return stats;
    } else {
      console.log("✅ 沒有需要重試的檔案");
      return stats;
    }
  } else {
    progress = createAudioProgress();
  }

  console.log("\n🎵 Starting audio migration...\n");
  console.log("Configuration:");
  console.log(`  - Source: ${manifest.bucket}`);
  console.log(`  - Target: ${r2Config.bucket} (R2)`);
  console.log(`  - Concurrency: ${migrationConfig.audioConcurrency}`);
  console.log(`  - Total files: ${stats.total}`);
  console.log(`  - Dry run: ${migrationConfig.dryRun}`);
  console.log("");

  const startTime = Date.now();
  const concurrency = migrationConfig.audioConcurrency;

  // 從上次的位置繼續
  const startIndex = progress.lastProcessedIndex + 1;

  for (let i = startIndex; i < filesToMigrate.length; i += concurrency) {
    const batch = filesToMigrate.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (file) => {
        const conversationId = file.conversationId!;

        if (migrationConfig.dryRun) {
          console.log(`[DRY RUN] Would migrate: ${file.gcsUri}`);
          return {
            success: true,
            conversationId,
            r2Url: `${r2Config.publicUrl}/audio/${conversationId}.mp3`,
          };
        }

        const r2Url = await migrateAudioFile(
          file.gcsUri,
          conversationId,
          file.createdAt
        );
        return { success: true, conversationId, r2Url, gcsUri: file.gcsUri };
      })
    );

    // 處理結果
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const file = batch[j];
      const conversationId = file.conversationId!;

      if (result.status === "fulfilled") {
        stats.success++;
        progress.successCount++;

        // 記錄 URL 對應
        progress.urlMappings.push({
          conversationId,
          gcsUri: file.gcsUri,
          r2Url: result.value.r2Url,
        });

        console.log(
          `   ✓ ${conversationId} (${formatSize(file.sizeBytes)}) → ${result.value.r2Url.split("/").pop()}`
        );
      } else {
        stats.failed++;
        progress.failedCount++;

        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);

        stats.errors.push({
          id: conversationId,
          error: errorMessage,
        });

        // 記錄失敗的檔案
        const existingFailed = progress.failedFiles.find(
          (f) => f.conversationId === conversationId
        );
        if (existingFailed) {
          existingFailed.retryCount++;
          existingFailed.error = errorMessage;
        } else {
          progress.failedFiles.push({
            gcsUri: file.gcsUri,
            conversationId,
            error: errorMessage,
            retryCount: 1,
          });
        }

        console.log(`   ✗ ${conversationId}: ${errorMessage}`);
      }
    }

    // 更新進度
    progress.lastProcessedIndex = Math.min(
      i + concurrency - 1,
      filesToMigrate.length - 1
    );
    await saveAudioProgress(progress);

    // 顯示進度
    const processed = Math.min(i + concurrency, stats.total);
    const percentage = Math.round((processed / stats.total) * 100);
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = processed / elapsed;
    const remaining = (stats.total - processed) / speed;

    console.log("");
    console.log(
      `Progress: [${"█".repeat(Math.floor(percentage / 5))}${"░".repeat(20 - Math.floor(percentage / 5))}] ${percentage}% (${processed}/${stats.total})`
    );
    console.log(`  Current speed: ${speed.toFixed(1)} files/sec`);
    console.log(`  Estimated time remaining: ${formatTime(remaining)}`);
    console.log("");
  }

  // 儲存 URL 對應檔案
  const urlMappingPath = "scripts/migration/data/audio-url-mapping.json";
  await Bun.write(
    urlMappingPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalMappings: progress.urlMappings.length,
        mappings: progress.urlMappings,
      },
      null,
      2
    )
  );

  console.log(`\n📄 URL 對應已儲存: ${urlMappingPath}`);
  console.log(
    `✅ Audio migration complete: ${stats.success} success, ${stats.failed} failed, ${stats.skipped} skipped`
  );

  return stats;
}

/**
 * 重試失敗的檔案
 */
async function retryFailedFiles(
  progress: AudioMigrationProgress,
  stats: MigrationStats
): Promise<void> {
  const failedFiles = [...progress.failedFiles];
  progress.failedFiles = [];

  console.log(`\n🔄 重試 ${failedFiles.length} 個失敗的檔案...\n`);

  for (const file of failedFiles) {
    if (file.retryCount >= 3) {
      console.log(`   ⏭️ 跳過 (已重試 3 次): ${file.conversationId}`);
      progress.failedFiles.push(file);
      stats.skipped++;
      continue;
    }

    try {
      if (migrationConfig.dryRun) {
        console.log(`[DRY RUN] Would retry: ${file.gcsUri}`);
        stats.success++;
        progress.successCount++;
        continue;
      }

      const r2Url = await migrateAudioFile(file.gcsUri, file.conversationId);
      console.log(`   ✓ ${file.conversationId} → ${r2Url.split("/").pop()}`);

      stats.success++;
      progress.successCount++;
      progress.failedCount--;

      progress.urlMappings.push({
        conversationId: file.conversationId,
        gcsUri: file.gcsUri,
        r2Url,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`   ✗ ${file.conversationId}: ${errorMessage}`);

      file.retryCount++;
      file.error = errorMessage;
      progress.failedFiles.push(file);
      stats.failed++;
    }
  }

  await saveAudioProgress(progress);
}

/**
 * 格式化時間
 */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/**
 * 解析命令列參數
 */
function parseArgs(): {
  resume: boolean;
  retryFailed: boolean;
  batchStart?: number;
  batchEnd?: number;
} {
  const args = process.argv.slice(2);
  return {
    resume: args.includes("--resume"),
    retryFailed: args.includes("--retry-failed"),
    batchStart: args.includes("--batch-start")
      ? Number(args[args.indexOf("--batch-start") + 1])
      : undefined,
    batchEnd: args.includes("--batch-end")
      ? Number(args[args.indexOf("--batch-end") + 1])
      : undefined,
  };
}

// 主程式
async function main() {
  const options = parseArgs();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("            🎵 Audio Migration: GCS → R2");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 檢查環境變數
  const requiredEnvVars = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY",
    "CLOUDFLARE_R2_SECRET_KEY",
    "CLOUDFLARE_R2_BUCKET",
  ];

  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("❌ 缺少必要環境變數:");
    for (const key of missing) {
      console.error(`   - ${key}`);
    }
    process.exit(1);
  }

  await migrateAllAudioFiles(options);
}

// 執行
main().catch((error) => {
  console.error("❌ 遷移失敗:", error);
  process.exit(1);
});
