/**
 * 手動觸發 MEDDIC 分析
 * 當 Queue Worker 沒有自動處理時,可以用這個腳本手動執行分析
 */

const CONVERSATION_ID = "00b95b0e-816d-416e-aacd-ceddb9886d07";
const API_URL = "https://sales-ai-server.salesaiautomationv3.workers.dev";

async function manualAnalyze() {
  console.log("🔧 手動觸發 MEDDIC 分析");
  console.log("=".repeat(80));
  console.log(`\nConversation ID: ${CONVERSATION_ID}`);
  console.log(`API URL: ${API_URL}\n`);

  try {
    // 呼叫分析 API
    console.log("📤 發送分析請求...");

    const response = await fetch(
      `${API_URL}/api/conversations/${CONVERSATION_ID}/analyze`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ 分析失敗:`);
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${errorText}`);
      process.exit(1);
    }

    const result = await response.json();

    console.log("\n✅ 分析成功!");
    console.log("\n結果:");
    console.log(JSON.stringify(result, null, 2));

    console.log("\n" + "=".repeat(80));
    console.log("✅ 完成!");
  } catch (error) {
    console.error("\n❌ 執行失敗:", error);
    process.exit(1);
  }
}

// 執行
manualAnalyze();
