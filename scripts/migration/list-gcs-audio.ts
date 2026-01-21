// scripts/migration/list-gcs-audio.ts
/**
 * GCS 音檔清單匯出腳本
 * 掃描 GCS bucket 中的所有音檔，匯出清單供遷移使用
 */

import { gcsStorage } from "./config";

// 音檔清單介面
interface AudioFileInfo {
  gcsUri: string;
  path: string;
  sizeBytes: number;
  contentType: string;
  createdAt: string;
  conversationId?: string;
}

interface AudioManifest {
  exportedAt: string;
  bucket: string;
  totalFiles: number;
  totalSizeBytes: number;
  oldestFile?: string;
  newestFile?: string;
  formatSummary: Record<string, number>;
  files: AudioFileInfo[];
}

// 從檔案路徑提取 conversation ID
function extractConversationId(filePath: string): string | undefined {
  // 支援的路徑格式:
  // - audio/conversationId.mp3
  // - audio/2024/01/conversationId.mp3
  // - recordings/conversationId.mp3
  const filename = filePath.split("/").pop();
  if (!filename) {
    return undefined;
  }

  // 移除副檔名
  const nameWithoutExt = filename.replace(/\.(mp3|wav|m4a|ogg|webm)$/i, "");
  return nameWithoutExt;
}

// 取得檔案格式
function getFileFormat(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext || "unknown";
}

// 格式化檔案大小
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function listGcsAudio() {
  console.log("📋 掃描 GCS bucket 中的音檔...\n");

  // 檢查環境變數
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    console.error("❌ 缺少 FIREBASE_STORAGE_BUCKET 環境變數");
    process.exit(1);
  }

  console.log(`Bucket: ${bucketName}`);
  console.log("");

  const bucket = gcsStorage.bucket(bucketName);
  const audioFiles: AudioFileInfo[] = [];
  const formatSummary: Record<string, number> = {};

  let oldestDate: Date | null = null;
  let newestDate: Date | null = null;
  let totalSize = 0;

  try {
    // 列出所有檔案（假設音檔在 audio/ 目錄下）
    const prefixes = ["audio/", "recordings/", ""];

    for (const prefix of prefixes) {
      console.log(`掃描路徑: ${prefix || "(根目錄)"}...`);

      const [files] = await bucket.getFiles({
        prefix,
        maxResults: 10_000,
      });

      for (const file of files) {
        const name = file.name;

        // 只處理音檔
        if (!/\.(mp3|wav|m4a|ogg|webm)$/i.test(name)) {
          continue;
        }

        const [metadata] = await file.getMetadata();
        const size = Number(metadata.size) || 0;
        const contentType = metadata.contentType || "audio/mpeg";
        const createdAt = metadata.timeCreated
          ? new Date(metadata.timeCreated)
          : new Date();

        // 追蹤日期範圍
        if (!oldestDate || createdAt < oldestDate) {
          oldestDate = createdAt;
        }
        if (!newestDate || createdAt > newestDate) {
          newestDate = createdAt;
        }

        // 統計格式
        const format = getFileFormat(name);
        formatSummary[format] = (formatSummary[format] || 0) + 1;

        totalSize += size;

        audioFiles.push({
          gcsUri: `gs://${bucketName}/${name}`,
          path: name,
          sizeBytes: size,
          contentType,
          createdAt: createdAt.toISOString(),
          conversationId: extractConversationId(name),
        });
      }
    }

    // 移除重複項（如果同一檔案在多個前綴下被掃描到）
    const uniqueFiles = Array.from(
      new Map(audioFiles.map((f) => [f.gcsUri, f])).values()
    );

    console.log("");
    console.log(
      "═══════════════════════════════════════════════════════════════"
    );
    console.log("");
    console.log(
      `Found ${uniqueFiles.length} audio files in gs://${bucketName}/`
    );
    console.log("");
    console.log("Summary:");
    console.log(`  - Total files: ${uniqueFiles.length}`);
    console.log(`  - Total size: ${formatSize(totalSize)}`);
    if (oldestDate) {
      console.log(`  - Oldest file: ${oldestDate.toISOString().split("T")[0]}`);
    }
    if (newestDate) {
      console.log(`  - Newest file: ${newestDate.toISOString().split("T")[0]}`);
    }
    console.log(
      `  - Formats: ${Object.entries(formatSummary)
        .map(([f, c]) => `${f} (${c})`)
        .join(", ")}`
    );
    console.log("");

    // 建立 manifest
    const manifest: AudioManifest = {
      exportedAt: new Date().toISOString(),
      bucket: bucketName,
      totalFiles: uniqueFiles.length,
      totalSizeBytes: totalSize,
      oldestFile: oldestDate?.toISOString().split("T")[0],
      newestFile: newestDate?.toISOString().split("T")[0],
      formatSummary,
      files: uniqueFiles,
    };

    // 確保 data 目錄存在
    const dataDir = "scripts/migration/data";
    await Bun.write(`${dataDir}/.gitkeep`, "");

    // 儲存 manifest
    const outputPath = `${dataDir}/gcs-audio-manifest.json`;
    await Bun.write(outputPath, JSON.stringify(manifest, null, 2));

    console.log(`Exporting to: ${outputPath}`);
    console.log("✅ Manifest exported successfully");
    console.log("");

    // 顯示前 5 筆範例
    if (uniqueFiles.length > 0) {
      console.log("範例檔案:");
      for (const file of uniqueFiles.slice(0, 5)) {
        console.log(`  - ${file.path} (${formatSize(file.sizeBytes)})`);
      }
      if (uniqueFiles.length > 5) {
        console.log(`  ... 還有 ${uniqueFiles.length - 5} 個檔案`);
      }
    }
  } catch (error) {
    console.error("❌ 掃描 GCS 失敗:", error);
    process.exit(1);
  }
}

// 執行
listGcsAudio().catch((error) => {
  console.error("❌ 執行失敗:", error);
  process.exit(1);
});
