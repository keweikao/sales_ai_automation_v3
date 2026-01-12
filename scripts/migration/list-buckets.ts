// scripts/migration/list-buckets.ts
/**
 * 列出 GCS 專案中所有可用的 buckets
 */

import { gcsStorage } from "./config";

async function listBuckets() {
  console.log("🔍 列出 GCS Buckets...\n");
  console.log("Project ID:", process.env.FIREBASE_PROJECT_ID);
  console.log("");

  try {
    const [buckets] = await gcsStorage.getBuckets();
    if (buckets.length === 0) {
      console.log("⚠️ 沒有找到任何 bucket");
      console.log("   可能原因:");
      console.log("   - Service Account 沒有 storage.buckets.list 權限");
      console.log("   - 專案中沒有建立任何 bucket");
    } else {
      console.log(`✅ 找到 ${buckets.length} 個 bucket:\n`);
      for (const bucket of buckets) {
        // 取得 bucket 的基本資訊
        try {
          const [metadata] = await bucket.getMetadata();
          const location = metadata.location || "unknown";
          const storageClass = metadata.storageClass || "unknown";
          console.log(`  📦 ${bucket.name}`);
          console.log(`     Location: ${location}, Storage Class: ${storageClass}`);
        } catch {
          console.log(`  📦 ${bucket.name}`);
        }
      }
      console.log("");
      console.log("💡 請將正確的 bucket 名稱更新到 .env.migration:");
      console.log("   FIREBASE_STORAGE_BUCKET=<bucket-name>");
    }
  } catch (error) {
    const err = error as Error;
    console.error("❌ 列出 buckets 失敗:", err.message);
    console.error("");
    console.error("💡 可能原因:");
    console.error("   - Service Account 需要 'Storage Admin' 或 'Storage Object Viewer' 角色");
    console.error("   - 前往 Google Cloud Console → IAM → 為 Service Account 新增角色");
  }
}

listBuckets().catch((error) => {
  console.error("❌ 執行失敗:", error);
  process.exit(1);
});
