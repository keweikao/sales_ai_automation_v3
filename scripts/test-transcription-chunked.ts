/**
 * 測試 Whisper 轉錄功能 - 分段處理大檔案
 *
 * 這個腳本會:
 * 1. 將大音檔切割成多個 < 25MB 的片段
 * 2. 分別轉錄每個片段
 * 3. 合併轉錄結果
 */

import { exec } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// 從環境變數讀取 API Key
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

if (!GROQ_API_KEY) {
  console.error("❌ 錯誤: 請設定 GROQ_API_KEY 環境變數");
  process.exit(1);
}

const CHUNK_DURATION = 600; // 每段 10 分鐘
const _MAX_FILE_SIZE_MB = 20; // 目標大小 < 25MB

async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
  );
  return Number.parseFloat(stdout.trim());
}

async function splitAudio(
  audioPath: string,
  outputDir: string
): Promise<string[]> {
  console.log("\n✂️  切割音檔...");

  const duration = await getAudioDuration(audioPath);
  console.log(`   總長度: ${(duration / 60).toFixed(2)} 分鐘`);

  const numChunks = Math.ceil(duration / CHUNK_DURATION);
  console.log(
    `   將切割成 ${numChunks} 個片段 (每段 ${CHUNK_DURATION / 60} 分鐘)`
  );

  const chunkPaths: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const startTime = i * CHUNK_DURATION;
    const chunkPath = resolve(outputDir, `chunk_${i + 1}.mp3`);

    console.log(`   切割片段 ${i + 1}/${numChunks}...`);

    await execAsync(
      `ffmpeg -i "${audioPath}" -ss ${startTime} -t ${CHUNK_DURATION} -ab 32k -ar 16000 -ac 1 "${chunkPath}" -y 2>&1 | grep -v "^frame="`
    );

    chunkPaths.push(chunkPath);
  }

  console.log(`   ✓ 完成切割 ${chunkPaths.length} 個片段`);
  return chunkPaths;
}

async function transcribeChunk(
  chunkPath: string,
  chunkIndex: number
): Promise<any> {
  console.log(`\n🎤 轉錄片段 ${chunkIndex}...`);

  const audioBuffer = await readFile(chunkPath);
  const fileSizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`   大小: ${fileSizeMB} MB`);

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer], { type: "audio/mpeg" }),
    `chunk_${chunkIndex}.mp3`
  );
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("response_format", "verbose_json");
  formData.append("language", "zh");

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
  console.log(`   ✓ 完成! (耗時: ${elapsed} 秒)`);

  return result;
}

async function mergeTranscriptions(transcriptions: any[]): Promise<any> {
  console.log("\n🔗 合併轉錄結果...");

  let fullText = "";
  const allSegments: any[] = [];
  let timeOffset = 0;

  for (let i = 0; i < transcriptions.length; i++) {
    const trans = transcriptions[i];

    // 合併文字
    fullText += `${trans.text} `;

    // 合併片段,調整時間戳
    if (trans.segments) {
      for (const segment of trans.segments) {
        allSegments.push({
          ...segment,
          start: segment.start + timeOffset,
          end: segment.end + timeOffset,
        });
      }

      // 更新時間偏移
      const lastSegment = trans.segments.at(-1);
      if (lastSegment) {
        timeOffset += lastSegment.end;
      }
    }
  }

  console.log(`   ✓ 合併 ${transcriptions.length} 個片段`);
  console.log(`   ✓ 總共 ${allSegments.length} 個句子片段`);

  return {
    text: fullText.trim(),
    segments: allSegments,
  };
}

async function testChunkedTranscription() {
  console.log("🧪 測試分段 Whisper 轉錄");
  console.log("=".repeat(60));

  try {
    const audioPath = resolve(__dirname, "../知事官邸 - 梁明凱.mp3");
    const tempDir = resolve(__dirname, "../temp-chunks");

    // 創建臨時目錄
    await execAsync(`mkdir -p "${tempDir}"`);

    // 步驟 1: 切割音檔
    const chunkPaths = await splitAudio(audioPath, tempDir);

    // 步驟 2: 轉錄每個片段
    const transcriptions: any[] = [];

    for (let i = 0; i < chunkPaths.length; i++) {
      const result = await transcribeChunk(chunkPaths[i], i + 1);
      transcriptions.push(result);
    }

    // 步驟 3: 合併結果
    const finalResult = await mergeTranscriptions(transcriptions);

    // 步驟 4: 顯示結果
    console.log(`\n${"=".repeat(60)}`);
    console.log("✅ 轉錄完成!");
    console.log("=".repeat(60));

    console.log("\n📝 完整轉錄文字:");
    console.log(finalResult.text);

    console.log(`\n📊 共 ${finalResult.segments.length} 個句子片段`);

    // 顯示前 10 個片段
    console.log("\n前 10 個片段:");
    console.log("=".repeat(60));

    finalResult.segments
      .slice(0, 10)
      .forEach((segment: any, _index: number) => {
        const startTime = segment.start.toFixed(2);
        const endTime = segment.end.toFixed(2);
        console.log(`\n[${startTime}s - ${endTime}s]:`);
        console.log(`  ${segment.text}`);
      });

    // 儲存完整結果
    const outputPath = resolve(__dirname, "../transcription-result.json");
    await writeFile(outputPath, JSON.stringify(finalResult, null, 2));
    console.log(`\n💾 完整結果已儲存至: ${outputPath}`);

    // 清理臨時檔案
    console.log("\n🧹 清理臨時檔案...");
    await execAsync(`rm -rf "${tempDir}"`);

    console.log(`\n${"=".repeat(60)}`);
    console.log("✅ 測試完成!");
  } catch (error) {
    console.error("\n❌ 測試失敗:");
    console.error(error);
    process.exit(1);
  }
}

// 執行測試
testChunkedTranscription();
