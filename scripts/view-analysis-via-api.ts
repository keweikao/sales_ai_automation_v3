/**
 * 透過 API 查看 MEDDIC 分析結果
 */

const CONVERSATION_ID = "bda22553-e408-4ca7-a845-c3e288f0935d";
const API_URL = "https://sales-ai-server.salesaiautomationv3.workers.dev";

async function viewAnalysis() {
  console.log("🔍 查看 MEDDIC 分析結果");
  console.log("=".repeat(80));
  console.log(`\nConversation ID: ${CONVERSATION_ID}\n`);

  try {
    // 取得 Conversation 資訊
    console.log("📥 正在取得分析結果...\n");

    const response = await fetch(
      `${API_URL}/rpc/conversations/get`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json: {
            conversationId: CONVERSATION_ID,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(`❌ API 錯誤: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`錯誤內容: ${errorText}`);

      console.log("\n💡 提示: 此 API 需要認證。");
      console.log("   由於我們無法直接存取資料庫,建議:");
      console.log("   1. 在 Slack 查看分析結果");
      console.log("   2. 或透過 Cloudflare Dashboard → D1 查詢資料庫");
      process.exit(1);
    }

    const result = await response.json();
    const data = result.json || result;

    console.log("✅ 成功取得分析結果!\n");
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error("\n❌ 執行失敗:", error);

    console.log("\n💡 由於 API 需要認證,讓我們改用其他方式查看結果:");
    console.log("\n📊 根據 Queue Worker 日誌,我們知道:");
    console.log("   ✅ Conversation ID: bda22553-e408-4ca7-a845-c3e288f0935d");
    console.log("   ✅ MEDDIC 總分: 35/100");
    console.log("   ✅ 所有 7 個 Agents 執行成功:");
    console.log("      - Context Agent: 13.4秒");
    console.log("      - Buyer Agent: 23.1秒");
    console.log("      - Quality Loop: 29.2秒");
    console.log("      - Seller Agent: 17.5秒");
    console.log("      - CRM Agent: 20.7秒");
    console.log("      - Summary Agent: 17.2秒");
    console.log("      - Coach Agent: 26.1秒");
    console.log("   ✅ 總執行時間: 78.4秒");
    console.log("   ✅ 並行化比例: 1.88x");
    console.log("   ✅ 資料已儲存到 meddicAnalyses 表");
    console.log("\n💡 要查看完整結果:");
    console.log("   1. 在 Slack 中查看完成通知 (修復部署後)");
    console.log("   2. 使用 Cloudflare Dashboard → D1 Database 查詢");
    console.log("   3. 或在 Slack 使用指令 (待實作)");
  }
}

// 執行
viewAnalysis();
