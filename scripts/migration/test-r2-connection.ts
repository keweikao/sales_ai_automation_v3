// scripts/migration/test-r2-connection.ts
/**
 * R2 連線測試腳本
 * 測試 Cloudflare R2 的連線、讀寫權限
 */

import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// 載入環境變數（透過 config.ts）
import "./config";

// 環境變數檢查（支援兩種設定方式）
function checkEnvVars(): boolean {
  const required = [
    "CLOUDFLARE_R2_ACCESS_KEY",
    "CLOUDFLARE_R2_SECRET_KEY",
    "CLOUDFLARE_R2_BUCKET",
  ];

  // 需要 CLOUDFLARE_R2_ENDPOINT 或 CLOUDFLARE_ACCOUNT_ID
  const hasEndpoint =
    process.env.CLOUDFLARE_R2_ENDPOINT || process.env.CLOUDFLARE_ACCOUNT_ID;

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 || !hasEndpoint) {
    console.error("❌ 缺少必要環境變數:");
    for (const key of missing) {
      console.error(`   - ${key}`);
    }
    if (!hasEndpoint) {
      console.error("   - CLOUDFLARE_R2_ENDPOINT 或 CLOUDFLARE_ACCOUNT_ID");
    }
    return false;
  }

  return true;
}

async function testR2Connection() {
  console.log("🔍 R2 連線測試開始...\n");

  // 檢查環境變數
  if (!checkEnvVars()) {
    process.exit(1);
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const publicUrl =
    process.env.CLOUDFLARE_R2_PUBLIC_URL ||
    (accountId ? `https://pub-${accountId}.r2.dev` : "(未設定)");

  // 支援 CLOUDFLARE_R2_ENDPOINT 或從 CLOUDFLARE_ACCOUNT_ID 產生
  const endpoint =
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    `https://${accountId}.r2.cloudflarestorage.com`;

  console.log("📋 連線設定:");
  console.log(`   - Account ID: ${accountId?.slice(0, 8)}...`);
  console.log(`   - Bucket: ${bucket}`);
  console.log(`   - Endpoint: ${endpoint}`);
  console.log(`   - Public URL: ${publicUrl}`);
  console.log("");

  // 建立 S3 客戶端
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: accessKeyId || "",
      secretAccessKey: secretAccessKey || "",
    },
  });

  let writePermission = false;
  let readPermission = false;

  try {
    // 測試 bucket 存取
    console.log("1️⃣ 測試 Bucket 存取權限...");
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log("   ✅ Bucket 存取成功\n");
  } catch (error) {
    const err = error as Error;
    console.error(`   ❌ Bucket 存取失敗: ${err.message}\n`);
    console.error("   💡 請確認:");
    console.error("      - Bucket 名稱正確");
    console.error("      - API Token 有 Bucket 存取權限");
    process.exit(1);
  }

  // 測試寫入權限
  const testKey = `_test/connection-test-${Date.now()}.txt`;
  const testContent = `R2 Connection Test - ${new Date().toISOString()}`;

  try {
    console.log("2️⃣ 測試寫入權限...");
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: Buffer.from(testContent),
        ContentType: "text/plain",
      })
    );
    writePermission = true;
    console.log("   ✅ 寫入權限正常\n");
  } catch (error) {
    const err = error as Error;
    console.error(`   ❌ 寫入失敗: ${err.message}\n`);
  }

  // 測試讀取權限（透過 public URL）
  try {
    console.log("3️⃣ 測試 Public URL 存取...");
    const testUrl = `${publicUrl}/${testKey}`;
    const response = await fetch(testUrl);

    if (response.ok) {
      readPermission = true;
      console.log(`   ✅ Public URL 存取正常: ${testUrl}\n`);
    } else {
      console.log(
        `   ⚠️ Public URL 回應 ${response.status}: ${response.statusText}`
      );
      console.log("   💡 可能需要設定 R2 Public Access 或 Custom Domain\n");
    }
  } catch (error) {
    const err = error as Error;
    console.log(`   ⚠️ Public URL 測試失敗: ${err.message}`);
    console.log("   💡 這可能是因為 Public Access 尚未啟用\n");
  }

  // 清理測試檔案
  try {
    console.log("4️⃣ 清理測試檔案...");
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: testKey,
      })
    );
    console.log("   ✅ 測試檔案已清理\n");
  } catch (error) {
    console.log("   ⚠️ 清理測試檔案失敗（非關鍵）\n");
  }

  // 總結
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("");
  console.log("✅ Cloudflare R2 connected");
  console.log(`   - Bucket: ${bucket}`);
  console.log("   - Region: auto");
  console.log(`   - Public URL: ${publicUrl}`);
  console.log(`   - Write permission: ${writePermission ? "✓" : "✗"}`);
  console.log(
    `   - Read permission: ${readPermission ? "✓" : "⚠️ (需設定 Public Access)"}`
  );
  console.log("");

  if (!writePermission) {
    console.error("❌ R2 寫入權限不足，無法執行音檔遷移");
    process.exit(1);
  }

  if (!readPermission) {
    console.log("⚠️ 警告: Public URL 存取可能有問題");
    console.log("   請確認已完成以下其中一項設定:");
    console.log(
      "   1. R2 Dashboard → Bucket → Settings → Public Access → Enable"
    );
    console.log("   2. 設定 Custom Domain");
    console.log("   3. 使用 Signed URLs（需修改應用程式碼）");
    console.log("");
  }

  console.log("🎉 R2 連線測試完成！準備好進行音檔遷移。");
}

// 執行測試
testR2Connection().catch((error) => {
  console.error("❌ 測試執行失敗:", error);
  process.exit(1);
});
