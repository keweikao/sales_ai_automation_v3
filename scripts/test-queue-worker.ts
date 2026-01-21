/**
 * 測試 Queue Worker - 直接推送訊息到 Transcription Queue
 *
 * 這個腳本會模擬 Server 推送訊息到 Queue,測試完整的轉錄和分析流程
 */

interface TranscriptionMessage {
  conversationId: string;
  audioUrl: string;
  opportunityId: string;
  channelId: string;
}

async function testQueueWorker() {
  console.log("🧪 開始測試 Queue Worker");
  console.log("=".repeat(60));

  // 你需要先手動創建一個測試 conversation 和 opportunity
  const testMessage: TranscriptionMessage = {
    conversationId: "test-conversation-1",
    audioUrl: "https://example.com/test-audio.mp3", // 這會被替換為實際的 R2 URL
    opportunityId: "test-opportunity-1",
    channelId: "C12345678", // Slack channel ID
  };

  console.log("\n📝 測試訊息:");
  console.log(JSON.stringify(testMessage, null, 2));

  console.log("\n⚠️  注意:");
  console.log("1. 由於 Cloudflare Queues 只能在 Workers 環境內部使用");
  console.log("2. 我們無法從本機直接推送訊息到 Queue");
  console.log("3. 建議使用以下替代方案測試:");
  console.log("");
  console.log("   方案 A: 透過 API Server 的 /test/queue endpoint 推送");
  console.log("   方案 B: 上傳真實音檔到 R2,然後手動觸發 Queue Worker");
  console.log("   方案 C: 等待 Slack App 批准後進行完整流程測試");

  console.log(`\n${"=".repeat(60)}`);
}

testQueueWorker();
