/**
 * 測試音檔上傳 API - 完整流程測試
 *
 * 這個腳本會:
 * 1. 讀取本機音檔
 * 2. 轉換為 base64
 * 3. 透過 API 上傳並觸發轉錄 + 分析
 * 4. 監控處理狀態
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const API_BASE_URL = "https://sales-ai-server.salesaiautomationv3.workers.dev";
const API_TOKEN = "your-api-token"; // 需要從環境變數或 .env 取得

interface UploadConversationRequest {
  opportunityId: string;
  audioBase64: string;
  title?: string;
  type?: string;
  metadata?: {
    customerNumber?: string;
    customerName?: string;
    storeType?: string;
    serviceType?: string;
    currentPos?: string;
    decisionMakerOnsite?: boolean;
  };
}

async function testAudioUpload() {
  console.log("🧪 測試音檔上傳與處理流程");
  console.log("=".repeat(60));

  try {
    // 步驟 1: 讀取音檔
    console.log("\n📁 步驟 1: 讀取音檔...");
    const audioPath = resolve(__dirname, "../知事官邸 - 梁明凱.mp3");
    console.log(`   路徑: ${audioPath}`);

    const audioBuffer = await readFile(audioPath);
    const audioBase64 = audioBuffer.toString("base64");
    const fileSizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);

    console.log(`   ✓ 音檔大小: ${fileSizeMB} MB`);
    console.log(`   ✓ Base64 長度: ${audioBase64.length} 字元`);

    // 步驟 2: 準備上傳資料
    console.log("\n📤 步驟 2: 準備上傳資料...");

    const uploadData: UploadConversationRequest = {
      opportunityId: `test-opportunity-${Date.now()}`,
      audioBase64,
      title: "測試會議 - 知事官邸",
      type: "discovery_call",
      metadata: {
        customerNumber: "TEST001",
        customerName: "知事官邸",
        storeType: "fine_dining",
        serviceType: "dine_in",
        currentPos: "none",
        decisionMakerOnsite: true,
      },
    };

    console.log("   ✓ Opportunity ID:", uploadData.opportunityId);
    console.log("   ✓ 標題:", uploadData.title);
    console.log("   ✓ 客戶:", uploadData.metadata?.customerName);

    // 步驟 3: 發送請求
    console.log("\n🚀 步驟 3: 上傳音檔到 API Server...");
    console.log(`   API URL: ${API_BASE_URL}/api/conversations/upload`);

    const response = await fetch(`${API_BASE_URL}/api/conversations/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify(uploadData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`上傳失敗 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log("\n✅ 上傳成功!");
    console.log("   結果:", JSON.stringify(result, null, 2));

    // 步驟 4: 監控處理狀態
    if (result.conversationId) {
      console.log("\n⏳ 步驟 4: 監控處理狀態...");
      console.log("   Conversation ID:", result.conversationId);
      console.log("   您可以透過以下方式監控:");
      console.log(
        "   1. Queue Worker Logs: npx wrangler tail (在 apps/queue-worker 目錄)"
      );
      console.log("   2. Database: bun run db:studio (檢查 conversations 表)");
      console.log(
        "   3. R2 Storage: Cloudflare Dashboard → R2 → sales-ai-audio-files"
      );
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("✅ 測試完成!");
  } catch (error) {
    console.error("\n❌ 測試失敗:");
    console.error(error);
    process.exit(1);
  }
}

// 執行測試
testAudioUpload();
