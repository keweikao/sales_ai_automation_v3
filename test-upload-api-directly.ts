/**
 * 直接測試音檔上傳 API,不需要透過 Slack
 * 用於在不改變 Slack Event Subscription URL 的情況下測試
 */

import { readFileSync } from "node:fs";

const API_BASE_URL = "https://sales-ai-server.salesaiautomationv3.workers.dev";
const API_TOKEN = process.env.API_TOKEN || "";

async function testUploadAPI(audioFilePath: string, opportunityId: string) {
  console.log("🧪 Testing Upload API directly...\n");

  // 讀取音檔
  console.log(`📁 Reading audio file: ${audioFilePath}`);
  const audioBuffer = readFileSync(audioFilePath);
  const audioBase64 = audioBuffer.toString("base64");
  console.log(
    `✓ File loaded: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB\n`
  );

  // 呼叫 API
  console.log("📤 Uploading to Server...");
  const startTime = Date.now();

  try {
    const response = await fetch(`${API_BASE_URL}/rpc/conversations/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        json: {
          opportunityId,
          audioBase64,
          title: "直接 API 測試",
          type: "discovery_call",
          metadata: {
            format: "mp3",
            conversationDate: new Date().toISOString().split("T")[0],
          },
        },
      }),
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️  Request completed in ${(duration / 1000).toFixed(1)}s\n`);

    if (!response.ok) {
      console.error(`❌ Upload failed: ${response.status}`);
      const text = await response.text();
      console.error(text);
      return;
    }

    const result = await response.json();
    console.log("✅ Upload successful!\n");
    console.log("📊 Result:");
    console.log(`   Conversation ID: ${result.json.conversationId}`);
    console.log(`   Case Number: ${result.json.caseNumber}`);
    console.log(`   Status: ${result.json.status}`);

    if (result.json.transcript) {
      console.log("\n   Transcript:");
      console.log(
        `   - Length: ${result.json.transcript.fullText.length} chars`
      );
      console.log(`   - Segments: ${result.json.transcript.segmentCount}`);
      console.log(
        `   - Preview: "${result.json.transcript.fullText.substring(0, 100)}..."`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// 使用方式:
// API_TOKEN=your_token npx tsx test-upload-api-directly.ts /path/to/audio.mp3 opportunity-id

const audioFilePath = process.argv[2];
const opportunityId = process.argv[3] || "test-opportunity-id";

if (!audioFilePath) {
  console.error(
    "Usage: API_TOKEN=xxx npx tsx test-upload-api-directly.ts <audio-file-path> [opportunity-id]"
  );
  process.exit(1);
}

testUploadAPI(audioFilePath, opportunityId).catch(console.error);
