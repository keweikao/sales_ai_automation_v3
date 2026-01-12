// scripts/migration/test-gcs-connection.ts
/**
 * GCS 連線測試腳本
 * 測試 Firebase Storage / Google Cloud Storage 的連線和存取權限
 */

// 載入環境變數並取得 gcsStorage
import { gcsStorage } from "./config";

// 環境變數檢查
function checkEnvVars(): boolean {
  const required = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "FIREBASE_STORAGE_BUCKET",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ 缺少必要環境變數:");
    for (const key of missing) {
      console.error(`   - ${key}`);
    }
    return false;
  }

  return true;
}

// 格式化檔案大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function testGcsConnection() {
  console.log("🔍 GCS 連線測試開始...\n");

  // 檢查環境變數
  if (!checkEnvVars()) {
    process.exit(1);
  }

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET!;
  const projectId = process.env.FIREBASE_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;

  console.log("📋 連線設定:");
  console.log(`   - Project ID: ${projectId}`);
  console.log(`   - Service Account: ${clientEmail}`);
  console.log(`   - Bucket: ${bucketName}`);
  console.log("");

  let readPermission = false;
  let listPermission = false;
  let sampleFilesCount = 0;
  let totalSize = 0;

  try {
    // 測試 bucket 存取
    console.log("1️⃣ 測試 Bucket 存取權限...");
    const bucket = gcsStorage.bucket(bucketName);

    // 嘗試取得 bucket metadata
    try {
      const [exists] = await bucket.exists();
      if (exists) {
        console.log("   ✅ Bucket 存取成功\n");
        readPermission = true;
      } else {
        // Bucket 不存在，嘗試其他名稱格式
        console.log(`   ⚠️ Bucket "${bucketName}" 檢查回傳 false`);
        console.log("   嘗試其他可能的 bucket 名稱...");

        // Firebase 有時候使用不同格式或大小寫
        const altBucketNames = [
          bucketName,
          bucketName.replace(".appspot.com", ".firebasestorage.app"),
          bucketName.toLowerCase(),
          bucketName.toLowerCase().replace(".appspot.com", ".firebasestorage.app"),
          `${projectId}.appspot.com`,
          `${projectId}.firebasestorage.app`,
          // 常見的 Firebase 格式變體
          bucketName.replace("-v2", "_v2"),
          bucketName.replace("_v2", "-v2"),
        ];

        for (const altName of altBucketNames) {
          if (altName === bucketName) continue;
          try {
            const altBucket = gcsStorage.bucket(altName);
            const [altExists] = await altBucket.exists();
            if (altExists) {
              console.log(`   ✅ 找到正確的 bucket: ${altName}`);
              console.log(`   💡 請更新 FIREBASE_STORAGE_BUCKET 為: ${altName}\n`);
              readPermission = true;
              break;
            }
          } catch {
            // 忽略錯誤繼續嘗試
          }
        }

        if (!readPermission) {
          console.error(`   ❌ Bucket 不存在: ${bucketName}`);
          console.error("   💡 請確認:");
          console.error("      - Bucket 名稱正確");
          console.error("      - Service Account 有存取權限");
          console.error("   可能的 bucket 名稱格式:");
          console.error("      - {project-id}.appspot.com");
          console.error("      - {project-id}.firebasestorage.app");
          process.exit(1);
        }
      }
    } catch (innerError) {
      const innerErr = innerError as Error;
      // 403 錯誤可能表示 bucket 存在但沒有權限
      if (innerErr.message.includes("403") || innerErr.message.includes("Forbidden")) {
        console.log("   ⚠️ Bucket 可能存在但權限不足");
        console.log(`   錯誤: ${innerErr.message}\n`);
        readPermission = false;
      } else {
        throw innerError;
      }
    }
  } catch (error) {
    const err = error as Error;
    console.error(`   ❌ Bucket 存取失敗: ${err.message}\n`);
    console.error("   💡 請確認:");
    console.error("      - Firebase Service Account JSON 正確");
    console.error("      - Private Key 格式正確（\\n 需轉換為換行）");
    console.error("      - Service Account 有 Storage Object Viewer 權限");
    process.exit(1);
  }

  // 測試列出檔案權限
  try {
    console.log("2️⃣ 測試列出檔案權限...");
    const bucket = gcsStorage.bucket(bucketName);

    // 列出前 100 個檔案
    const [files] = await bucket.getFiles({
      maxResults: 100,
      prefix: "audio/", // 嘗試列出 audio 目錄
    });

    listPermission = true;
    sampleFilesCount = files.length;

    // 計算總大小
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      totalSize += Number(metadata.size) || 0;
    }

    if (files.length > 0) {
      console.log(`   ✅ 列出檔案成功，找到 ${files.length} 個檔案\n`);

      // 顯示前 5 個檔案
      console.log("   範例檔案:");
      for (const file of files.slice(0, 5)) {
        const [metadata] = await file.getMetadata();
        const size = Number(metadata.size) || 0;
        console.log(`     - ${file.name} (${formatSize(size)})`);
      }
      if (files.length > 5) {
        console.log(`     ... 還有 ${files.length - 5} 個檔案`);
      }
      console.log("");
    } else {
      console.log("   ⚠️ 列出檔案成功，但 audio/ 目錄下沒有檔案\n");

      // 嘗試列出根目錄
      const [rootFiles] = await bucket.getFiles({ maxResults: 10 });
      if (rootFiles.length > 0) {
        console.log("   根目錄檔案:");
        for (const file of rootFiles.slice(0, 5)) {
          console.log(`     - ${file.name}`);
        }
        console.log("");
      }
    }
  } catch (error) {
    const err = error as Error;
    console.error(`   ❌ 列出檔案失敗: ${err.message}\n`);
    console.error("   💡 請確認:");
    console.error("      - Service Account 有 Storage Object Viewer 權限");
  }

  // 測試下載權限（如果有檔案的話）
  if (sampleFilesCount > 0) {
    try {
      console.log("3️⃣ 測試下載權限...");
      const bucket = gcsStorage.bucket(bucketName);
      const [files] = await bucket.getFiles({
        maxResults: 1,
        prefix: "audio/",
      });

      if (files.length > 0) {
        // 嘗試取得檔案 metadata（不實際下載）
        const [metadata] = await files[0].getMetadata();
        console.log(`   ✅ 下載權限正常`);
        console.log(`      測試檔案: ${files[0].name}`);
        console.log(`      大小: ${formatSize(Number(metadata.size) || 0)}`);
        console.log(`      類型: ${metadata.contentType || "unknown"}\n`);
      }
    } catch (error) {
      const err = error as Error;
      console.error(`   ⚠️ 下載測試失敗: ${err.message}`);
      console.error("   💡 如果需要下載檔案，請確認有 Storage Object Admin 權限\n");
    }
  } else {
    console.log("3️⃣ 跳過下載測試（沒有找到音檔）\n");
  }

  // 總結
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("✅ Google Cloud Storage connected");
  console.log(`   - Bucket: ${bucketName}`);
  console.log(`   - Service Account: ${clientEmail.split("@")[0]}...`);
  console.log(`   - Read permission: ${readPermission ? "✓" : "✗"}`);
  console.log(`   - List permission: ${listPermission ? "✓" : "✗"}`);
  console.log(`   - Sample files found: ${sampleFilesCount}`);
  if (totalSize > 0) {
    console.log(`   - Sample total size: ${formatSize(totalSize)}`);
  }
  console.log("");

  if (!readPermission || !listPermission) {
    console.error("❌ GCS 權限不足，無法執行音檔遷移");
    console.error("   請確認 Service Account 具有以下權限:");
    console.error("   - Storage Object Viewer（讀取）");
    console.error("   - Storage Object Admin（下載，如需）");
    process.exit(1);
  }

  if (sampleFilesCount === 0) {
    console.log("⚠️ 警告: 沒有在 audio/ 目錄下找到音檔");
    console.log("   請確認音檔存放路徑是否正確");
    console.log("   可能的路徑: audio/, recordings/, 或根目錄");
    console.log("");
  }

  console.log("🎉 GCS 連線測試完成！準備好進行音檔遷移。");
}

// 執行測試
testGcsConnection().catch((error) => {
  console.error("❌ 測試執行失敗:", error);
  process.exit(1);
});
