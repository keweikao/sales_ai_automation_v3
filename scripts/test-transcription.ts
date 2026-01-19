/**
 * 測試 Whisper 轉錄功能
 *
 * 這個腳本會:
 * 1. 讀取本機音檔
 * 2. 使用 Groq Whisper API 進行轉錄
 * 3. 顯示轉錄結果
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// 從環境變數讀取 API Key
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

if (!GROQ_API_KEY) {
  console.error("❌ 錯誤: 請設定 GROQ_API_KEY 環境變數");
  console.error("   執行方式: GROQ_API_KEY=your_key bun run scripts/test-transcription.ts");
  process.exit(1);
}

async function testTranscription() {
  console.log("🧪 測試 Whisper 轉錄功能");
  console.log("=".repeat(60));

  try {
    // 步驟 1: 讀取音檔 (壓縮版)
    console.log("\n📁 步驟 1: 讀取音檔...");
    const audioPath = resolve(__dirname, "../知事官邸-梁明凱-compressed.mp3");
    console.log(`   路徑: ${audioPath}`);

    const audioBuffer = await readFile(audioPath);
    const fileSizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);

    console.log(`   ✓ 音檔大小: ${fileSizeMB} MB`);

    // 步驟 2: 準備 FormData
    console.log("\n🔄 步驟 2: 準備上傳到 Groq Whisper API...");

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([audioBuffer], { type: "audio/mpeg" }),
      "知事官邸 - 梁明凱.mp3"
    );
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "verbose_json");
    formData.append("language", "zh"); // 中文

    // 步驟 3: 發送請求
    console.log("\n🚀 步驟 3: 開始轉錄...");
    console.log("   API: https://api.groq.com/openai/v1/audio/transcriptions");
    console.log("   模型: whisper-large-v3-turbo");

    const startTime = Date.now();

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      }
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`轉錄失敗 (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // 步驟 4: 顯示結果
    console.log(`\n✅ 轉錄完成! (耗時: ${elapsed} 秒)`);
    console.log("=".repeat(60));

    console.log("\n📝 轉錄文字:");
    console.log(result.text);

    if (result.segments && result.segments.length > 0) {
      console.log(`\n📊 詳細片段 (共 ${result.segments.length} 個):`);
      console.log("=".repeat(60));

      result.segments.slice(0, 5).forEach((segment: any, index: number) => {
        const startTime = segment.start.toFixed(2);
        const endTime = segment.end.toFixed(2);
        console.log(`\n片段 ${index + 1} [${startTime}s - ${endTime}s]:`);
        console.log(`  ${segment.text}`);
      });

      if (result.segments.length > 5) {
        console.log(`\n... 還有 ${result.segments.length - 5} 個片段`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ 測試完成!");

    // 儲存完整結果到檔案
    const outputPath = resolve(__dirname, "../transcription-compressed.json");
    await Bun.write(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 完整結果已儲存至: ${outputPath}`);
  } catch (error) {
    console.error("\n❌ 測試失敗:");
    console.error(error);
    process.exit(1);
  }
}

// 執行測試
testTranscription();
