/**
 * 批次重試 M 開頭案件（觸發 queue-worker 重新處理）
 *
 * Usage: SERVICE_API_TOKEN=xxx bun run scripts/batch-retry-m-cases.ts
 *
 * 環境變數:
 * - SERVICE_API_TOKEN: API 認證 Token（必須）
 * - DRY_RUN: 設為 "true" 只列出案件不實際重試
 * - DELAY_MS: 每次重試間隔（毫秒），預設 2000
 */

const serverUrl = "https://sales-ai-server.salesaiautomationv3.workers.dev";
const token = process.env.SERVICE_API_TOKEN;
const isDryRun = process.env.DRY_RUN === "true";
const delayMs = Number.parseInt(process.env.DELAY_MS || "2000", 10);

if (!token) {
  console.error("❌ 請設定 SERVICE_API_TOKEN 環境變數");
  console.error("   可從 Cloudflare Dashboard 查看 server 的 secrets");
  process.exit(1);
}

// M 開頭案件清單（需要重新分析的）
// 這些案件有 transcript 但沒有 MEDDIC analysis
const mCasesToRetry = [
  "M202601-IC163",
  "M202601-IC154",
  "M202601-IC144",
  "M202601-IC137",
  "M202601-IC127",
  "M202601-IC123",
  "M202601-IC122",
  "M202601-IC115",
  "M202601-IC111",
  "M202601-IC107",
  "M202601-IC103",
  "M202601-IC101",
  "M202601-IC097",
  "M202601-IC091",
  "M202601-IC085",
  "M202601-IC076",
  "M202601-IC070",
  "M202601-IC062",
  "M202601-IC053",
];

async function retryConversation(caseNumber: string): Promise<boolean> {
  try {
    const response = await fetch(`${serverUrl}/rpc/conversations/retry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ json: { caseNumber } }),
    });

    const text = await response.text();

    if (response.ok) {
      console.log(`   ✅ 成功: ${text}`);
      return true;
    }
    console.log(`   ❌ 失敗 (${response.status}): ${text}`);
    return false;
  } catch (error) {
    console.log(`   ❌ 錯誤: ${error}`);
    return false;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🔄 批次重試 M 開頭案件");
  console.log("=".repeat(60));
  console.log(`模式: ${isDryRun ? "🧪 DRY RUN（測試）" : "🚀 正式執行"}`);
  console.log(`案件數量: ${mCasesToRetry.length}`);
  console.log(`重試間隔: ${delayMs}ms`);
  console.log("");

  if (isDryRun) {
    console.log("📋 將重試以下案件:");
    for (const caseNumber of mCasesToRetry) {
      console.log(`   - ${caseNumber}`);
    }
    console.log("\n移除 DRY_RUN=true 以執行實際重試");
    return;
  }

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < mCasesToRetry.length; i++) {
    const caseNumber = mCasesToRetry[i];
    console.log(`[${i + 1}/${mCasesToRetry.length}] 重試 ${caseNumber}...`);

    const success = await retryConversation(caseNumber);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }

    // 等待間隔（避免 rate limit）
    if (i < mCasesToRetry.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("📊 執行結果");
  console.log("=".repeat(60));
  console.log(`成功: ${succeeded}`);
  console.log(`失敗: ${failed}`);
  console.log(`總計: ${mCasesToRetry.length}`);
}

main().catch(console.error);
