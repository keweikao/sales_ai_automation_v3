// scripts/migration/migrate-single-audio.ts
/**
 * 單一音檔遷移腳本
 * 用於手動遷移特定的音檔（除錯或重試用）
 *
 * 使用方式:
 *   bun run scripts/migration/migrate-single-audio.ts gs://bucket/path/to/file.mp3
 *   bun run scripts/migration/migrate-single-audio.ts gs://bucket/path/to/file.mp3 --conversation-id abc123
 */

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { gcsStorage, r2Config } from "./config";

// GCS URI 解析
const GCS_URI_REGEX = /^gs:\/\/([^/]+)\/(.+)$/;

function parseGcsUri(gcsUri: string): { bucket: string; path: string } | null {
  const match = gcsUri.match(GCS_URI_REGEX);
  if (!match) {
    return null;
  }
  return { bucket: match[1], path: match[2] };
}

// 從檔案路徑提取 conversation ID
function extractConversationId(filePath: string): string | undefined {
  const filename = filePath.split("/").pop();
  if (!filename) return undefined;
  return filename.replace(/\.(mp3|wav|m4a|ogg|webm)$/i, "");
}

// 格式化檔案大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 產生 R2 key
function generateR2Key(conversationId: string, createdAt?: string): string {
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `audio/${year}/${month}/${conversationId}.mp3`;
}

// 解析命令列參數
function parseArgs(): {
  gcsUri: string;
  conversationId?: string;
  force: boolean;
} {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0].startsWith("-")) {
    console.log("使用方式:");
    console.log(
      "  bun run scripts/migration/migrate-single-audio.ts <gcs-uri> [options]"
    );
    console.log("");
    console.log("參數:");
    console.log("  <gcs-uri>                  GCS 檔案 URI (例: gs://bucket/audio/file.mp3)");
    console.log("  --conversation-id <id>     指定 conversation ID（預設從檔名提取）");
    console.log("  --force                    強制覆蓋已存在的檔案");
    console.log("");
    console.log("範例:");
    console.log(
      "  bun run scripts/migration/migrate-single-audio.ts gs://my-bucket/audio/abc123.mp3"
    );
    console.log(
      "  bun run scripts/migration/migrate-single-audio.ts gs://my-bucket/audio/file.mp3 --conversation-id abc123"
    );
    process.exit(1);
  }

  const gcsUri = args[0];
  const convIdIdx = args.indexOf("--conversation-id");
  const conversationId =
    convIdIdx !== -1 ? args[convIdIdx + 1] : undefined;
  const force = args.includes("--force");

  return { gcsUri, conversationId, force };
}

async function migrateSingleAudio() {
  const { gcsUri, conversationId: providedConvId, force } = parseArgs();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("            🎵 Single Audio Migration: GCS → R2");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 解析 GCS URI
  const parsed = parseGcsUri(gcsUri);
  if (!parsed) {
    console.error("❌ 無效的 GCS URI 格式");
    console.error("   預期格式: gs://bucket-name/path/to/file.mp3");
    process.exit(1);
  }

  // 決定 conversation ID
  const conversationId =
    providedConvId || extractConversationId(parsed.path);
  if (!conversationId) {
    console.error("❌ 無法從檔案路徑提取 conversation ID");
    console.error("   請使用 --conversation-id 參數指定");
    process.exit(1);
  }

  console.log("📋 遷移設定:");
  console.log(`   - Source: ${gcsUri}`);
  console.log(`   - Bucket: ${parsed.bucket}`);
  console.log(`   - Path: ${parsed.path}`);
  console.log(`   - Conversation ID: ${conversationId}`);
  console.log(`   - Force overwrite: ${force}`);
  console.log("");

  // 建立 R2 客戶端
  const r2Client = new S3Client({
    region: "auto",
    endpoint: r2Config.endpoint,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
    },
  });

  // 檢查 GCS 檔案是否存在
  console.log("1️⃣ 檢查 GCS 來源檔案...");
  const bucket = gcsStorage.bucket(parsed.bucket);
  const file = bucket.file(parsed.path);

  const [exists] = await file.exists();
  if (!exists) {
    console.error(`   ❌ GCS 檔案不存在: ${gcsUri}`);
    process.exit(1);
  }

  const [metadata] = await file.getMetadata();
  const fileSize = Number(metadata.size) || 0;
  const contentType = metadata.contentType || "audio/mpeg";
  const createdAt = metadata.timeCreated
    ? new Date(metadata.timeCreated).toISOString()
    : undefined;

  console.log(`   ✅ 檔案存在`);
  console.log(`      大小: ${formatSize(fileSize)}`);
  console.log(`      類型: ${contentType}`);
  if (createdAt) {
    console.log(`      建立時間: ${createdAt}`);
  }
  console.log("");

  // 產生 R2 key
  const r2Key = generateR2Key(conversationId, createdAt);
  const r2Url = `${r2Config.publicUrl}/${r2Key}`;

  console.log("2️⃣ 檢查 R2 目標位置...");
  console.log(`   - R2 Key: ${r2Key}`);
  console.log(`   - R2 URL: ${r2Url}`);

  // 檢查 R2 是否已存在
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: r2Config.bucket,
        Key: r2Key,
      })
    );

    if (!force) {
      console.log(`   ⚠️ R2 檔案已存在`);
      console.log(`      使用 --force 參數來覆蓋`);
      console.log("");
      console.log(`   ✅ 現有 R2 URL: ${r2Url}`);
      return;
    }

    console.log(`   ⚠️ R2 檔案已存在，將覆蓋...`);
  } catch {
    console.log(`   ✅ R2 檔案不存在，可以上傳`);
  }
  console.log("");

  // 下載 GCS 檔案
  console.log("3️⃣ 從 GCS 下載檔案...");
  const startDownload = Date.now();
  const [buffer] = await file.download();
  const downloadTime = Date.now() - startDownload;
  console.log(`   ✅ 下載完成 (${downloadTime}ms, ${formatSize(buffer.length)})\n`);

  // 上傳到 R2
  console.log("4️⃣ 上傳到 R2...");
  const startUpload = Date.now();

  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: r2Key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    })
  );

  const uploadTime = Date.now() - startUpload;
  console.log(`   ✅ 上傳完成 (${uploadTime}ms)\n`);

  // 驗證上傳
  console.log("5️⃣ 驗證 R2 檔案...");
  try {
    const response = await fetch(r2Url, { method: "HEAD" });
    if (response.ok) {
      const contentLength = Number(response.headers.get("content-length") || 0);
      console.log(`   ✅ R2 檔案可存取`);
      console.log(`      大小: ${formatSize(contentLength)}`);
      console.log(`      狀態: ${response.status} ${response.statusText}`);
    } else {
      console.log(`   ⚠️ R2 檔案存取回應: ${response.status} ${response.statusText}`);
      console.log("      可能需要設定 R2 Public Access 或 Custom Domain");
    }
  } catch (error) {
    const err = error as Error;
    console.log(`   ⚠️ R2 URL 測試失敗: ${err.message}`);
    console.log("      檔案已上傳，但 Public Access 可能尚未啟用");
  }
  console.log("");

  // 輸出結果
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("✅ 音檔遷移完成！");
  console.log("");
  console.log("📋 詳情:");
  console.log(`   - Source: ${gcsUri}`);
  console.log(`   - Target: ${r2Url}`);
  console.log(`   - Conversation ID: ${conversationId}`);
  console.log(`   - Size: ${formatSize(buffer.length)}`);
  console.log(`   - Total time: ${downloadTime + uploadTime}ms`);
  console.log("");
  console.log("💡 下一步:");
  console.log("   1. 更新資料庫中的 audio_url:");
  console.log(`      UPDATE conversations SET audio_url = '${r2Url}' WHERE id = '${conversationId}';`);
  console.log("");
  console.log("   2. 或使用 update-audio-urls.ts 批次更新:");
  console.log("      bun run scripts/migration/update-audio-urls.ts");
}

// 執行
migrateSingleAudio().catch((error) => {
  console.error("❌ 遷移失敗:", error);
  process.exit(1);
});
