// scripts/migration/verify-audio-urls.ts
/**
 * 音檔 URL 存取驗證腳本
 * 抽樣測試 R2 音檔 URL 是否可正常存取
 */

import { sql } from "drizzle-orm";
import { conversations, db } from "./config";

interface VerificationResult {
  url: string;
  conversationId: string;
  status: number;
  statusText: string;
  contentLength: number;
  responseTime: number;
  accessible: boolean;
  error?: string;
}

// 解析命令列參數
function parseArgs(): { sample: number } {
  const args = process.argv.slice(2);
  const sampleIdx = args.indexOf("--sample");
  const sample = sampleIdx !== -1 ? Number(args[sampleIdx + 1]) : 10;

  return { sample: Number.isNaN(sample) ? 10 : sample };
}

// 格式化檔案大小
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function verifyAudioUrls() {
  const { sample } = parseArgs();

  console.log("🔍 驗證音檔 URL 存取性...\n");
  console.log(`抽樣數量: ${sample}\n`);

  // 查詢有 R2 URL 的 conversations（排除 GCS URL）
  const conversationsWithAudio = await db
    .select({
      id: conversations.id,
      audioUrl: conversations.audioUrl,
    })
    .from(conversations)
    .where(
      sql`${conversations.audioUrl} IS NOT NULL AND ${conversations.audioUrl} NOT LIKE 'gs://%'`
    );

  if (conversationsWithAudio.length === 0) {
    console.log("⚠️ 沒有找到使用 R2 URL 的音檔");
    console.log("   請先執行音檔遷移和 URL 更新腳本");
    return;
  }

  console.log(`找到 ${conversationsWithAudio.length} 筆有音檔 URL 的對話\n`);

  // 隨機抽樣
  const shuffled = [...conversationsWithAudio].sort(() => Math.random() - 0.5);
  const sampled = shuffled.slice(0, sample);

  console.log(`Testing ${sampled.length} random audio URLs...\n`);

  const results: VerificationResult[] = [];
  let successCount = 0;
  let totalResponseTime = 0;

  for (const conv of sampled) {
    const url = conv.audioUrl!;
    const startTime = Date.now();

    try {
      // 使用 HEAD 請求檢查 URL（不下載完整檔案）
      const response = await fetch(url, { method: "HEAD" });
      const responseTime = Date.now() - startTime;
      const contentLength = Number(response.headers.get("content-length") || 0);

      const result: VerificationResult = {
        url,
        conversationId: conv.id,
        status: response.status,
        statusText: response.statusText,
        contentLength,
        responseTime,
        accessible: response.ok,
      };

      results.push(result);

      if (response.ok) {
        successCount++;
        totalResponseTime += responseTime;
        console.log(
          `  ✓ ${url.split("/").pop()} (${response.status} OK, ${formatSize(contentLength)})`
        );
      } else {
        console.log(
          `  ✗ ${url.split("/").pop()} (${response.status} ${response.statusText})`
        );
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      results.push({
        url,
        conversationId: conv.id,
        status: 0,
        statusText: "Error",
        contentLength: 0,
        responseTime,
        accessible: false,
        error: errorMessage,
      });

      console.log(`  ✗ ${url.split("/").pop()} (Error: ${errorMessage})`);
    }
  }

  // 輸出結果
  console.log(
    "\n═══════════════════════════════════════════════════════════════\n"
  );

  if (successCount === sampled.length) {
    console.log(`✅ All ${sampled.length} URLs accessible`);
  } else {
    console.log(
      `⚠️ ${successCount}/${sampled.length} URLs accessible (${Math.round((successCount / sampled.length) * 100)}%)`
    );
  }

  if (successCount > 0) {
    const avgResponseTime = Math.round(totalResponseTime / successCount);
    console.log(`   Average response time: ${avgResponseTime}ms`);
  }

  console.log("");

  // 顯示失敗的 URL
  const failedResults = results.filter((r) => !r.accessible);
  if (failedResults.length > 0) {
    console.log("❌ Failed URLs:");
    for (const result of failedResults) {
      console.log(`   - ${result.url}`);
      console.log(`     Conversation: ${result.conversationId}`);
      console.log(
        `     Error: ${result.error || `${result.status} ${result.statusText}`}`
      );
    }
    console.log("");
  }

  // 儲存驗證報告
  const reportPath = `scripts/migration/logs/audio-verification-${new Date().toISOString().split("T")[0]}.json`;
  await Bun.write("scripts/migration/logs/.gitkeep", "");
  await Bun.write(
    reportPath,
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        totalConversationsWithAudio: conversationsWithAudio.length,
        sampleSize: sampled.length,
        successCount,
        failedCount: failedResults.length,
        averageResponseTime:
          successCount > 0 ? Math.round(totalResponseTime / successCount) : 0,
        results,
      },
      null,
      2
    )
  );

  console.log(`📄 驗證報告已儲存: ${reportPath}`);

  // 如果有失敗，提供建議
  if (failedResults.length > 0) {
    console.log("\n💡 可能的原因與解決方案:");
    console.log("   1. R2 Public Access 尚未啟用");
    console.log(
      "      → Cloudflare Dashboard → R2 → Bucket → Settings → Enable Public Access"
    );
    console.log("   2. Custom Domain 設定有誤");
    console.log("      → 檢查 DNS 設定和 R2 Custom Domain 設定");
    console.log("   3. CORS 設定問題（瀏覽器播放時）");
    console.log("      → 設定 R2 CORS 規則允許您的網域");
    console.log("   4. 檔案不存在");
    console.log("      → 重新執行音檔遷移腳本");
  }

  return { successCount, totalCount: sampled.length, results };
}

// 執行
verifyAudioUrls().catch((error) => {
  console.error("❌ 驗證失敗:", error);
  process.exit(1);
});
