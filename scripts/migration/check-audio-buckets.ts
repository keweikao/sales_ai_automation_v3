// scripts/migration/check-audio-buckets.ts
/**
 * 檢查音檔 buckets 中的檔案
 */

import { gcsStorage } from "./config";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function checkAudioBuckets() {
  const audioBuckets = [
    "sales-ai-audio-bucket",
    "sales-ai-automation-v2-audio",
  ];

  console.log("🔍 檢查音檔 Buckets...\n");

  for (const bucketName of audioBuckets) {
    console.log(`\n📦 Bucket: ${bucketName}`);
    console.log("─".repeat(50));

    try {
      const bucket = gcsStorage.bucket(bucketName);
      const [files] = await bucket.getFiles({ maxResults: 20 });

      if (files.length === 0) {
        console.log("   (空的)");
        continue;
      }

      console.log(`   找到 ${files.length}+ 個檔案:\n`);

      let totalSize = 0;
      let audioCount = 0;

      for (const file of files.slice(0, 10)) {
        const [metadata] = await file.getMetadata();
        const size = Number(metadata.size) || 0;
        const contentType = metadata.contentType || "unknown";
        totalSize += size;

        if (
          contentType.startsWith("audio/") ||
          file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)
        ) {
          audioCount++;
        }

        console.log(`   - ${file.name}`);
        console.log(`     ${formatSize(size)} | ${contentType}`);
      }

      if (files.length > 10) {
        console.log("   ... 還有更多檔案");
      }

      console.log(`\n   音檔數量: ${audioCount}/${files.length}`);
      console.log(`   樣本總大小: ${formatSize(totalSize)}`);
    } catch (error) {
      const err = error as Error;
      console.log(`   ❌ 無法存取: ${err.message}`);
    }
  }

  console.log("\n" + "═".repeat(50));
  console.log("\n💡 請選擇包含音檔的 bucket，更新 .env.migration:");
  console.log("   FIREBASE_STORAGE_BUCKET=<bucket-name>");
}

checkAudioBuckets().catch((error) => {
  console.error("❌ 執行失敗:", error);
  process.exit(1);
});
