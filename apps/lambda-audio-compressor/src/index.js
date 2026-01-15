/**
 * AWS Lambda - Audio Compression Function
 *
 * 功能: 接收音檔並使用 FFmpeg 壓縮為適合 Whisper 轉錄的格式
 *
 * 輸入格式:
 * {
 *   audioBase64: string,  // Base64 編碼的音檔
 *   audioUrl?: string     // 或提供音檔 URL
 * }
 *
 * 輸出格式:
 * {
 *   compressedAudioBase64: string,
 *   originalSize: number,
 *   compressedSize: number,
 *   compressionRatio: number
 * }
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const https = require("node:https");
const http = require("node:http");
const { promisify } = require("node:util");
const { pipeline } = require("node:stream");
const _streamPipeline = promisify(pipeline);

/**
 * 從 URL 下載音檔
 */
function downloadAudio(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * 執行 FFmpeg 壓縮
 */
function compressAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // 使用內嵌的 FFmpeg 二進位檔案
    // Lambda 的 /var/task 是唯讀的,需要複製到 /tmp
    const sourceFfmpeg = `${__dirname}/ffmpeg`;
    const ffmpegPath = "/tmp/ffmpeg";

    // 如果 /tmp/ffmpeg 不存在,複製過去
    if (!fs.existsSync(ffmpegPath)) {
      fs.copyFileSync(sourceFfmpeg, ffmpegPath);
      fs.chmodSync(ffmpegPath, 0o755);
      console.log("Copied ffmpeg to /tmp and set permissions");
    }

    const ffmpeg = spawn(ffmpegPath, [
      "-i",
      inputPath,
      "-ab",
      "32k", // 位元率 32kbps
      "-ar",
      "16000", // 採樣率 16kHz
      "-ac",
      "1", // 單聲道
      "-f",
      "mp3", // 輸出格式 MP3
      "-y", // 覆寫輸出檔案
      outputPath,
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log("FFmpeg compression successful");
        resolve();
      } else {
        console.error("FFmpeg stderr:", stderr);
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });

    ffmpeg.on("error", (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });
  });
}

/**
 * Lambda Handler
 */
exports.handler = async (event) => {
  const startTime = Date.now();

  // 解析 Function URL 格式 (event.body 是 JSON string)
  let requestData = event;
  if (event.body) {
    try {
      requestData = JSON.parse(event.body);
    } catch (_e) {
      requestData = event;
    }
  }

  console.log("Lambda invoked with event:", {
    hasAudioBase64: !!requestData.audioBase64,
    hasAudioUrl: !!requestData.audioUrl,
  });

  try {
    // 1. 接收音檔資料
    let audioData;

    if (requestData.audioBase64) {
      // 從 Base64 解碼
      audioData = Buffer.from(requestData.audioBase64, "base64");
      console.log(`Received audio from base64: ${audioData.length} bytes`);
    } else if (requestData.audioUrl) {
      // 從 URL 下載
      console.log(`Downloading audio from: ${requestData.audioUrl}`);
      audioData = await downloadAudio(requestData.audioUrl);
      console.log(`Downloaded audio: ${audioData.length} bytes`);
    } else {
      throw new Error("Missing audioBase64 or audioUrl in request");
    }

    const originalSize = audioData.length;
    console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // 2. 寫入暫存檔案
    const inputPath = "/tmp/input.mp3";
    const outputPath = "/tmp/output.mp3";

    fs.writeFileSync(inputPath, audioData);
    console.log("Written input file to /tmp/input.mp3");

    // 3. 執行 FFmpeg 壓縮
    console.log("Starting FFmpeg compression...");
    const compressionStartTime = Date.now();

    await compressAudio(inputPath, outputPath);

    const compressionTime = Date.now() - compressionStartTime;
    console.log(`Compression completed in ${compressionTime}ms`);

    // 4. 讀取壓縮後檔案
    const compressedData = fs.readFileSync(outputPath);
    const compressedSize = compressedData.length;
    console.log(
      `Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`
    );

    // 5. 計算壓縮率
    const compressionRatio = (
      (1 - compressedSize / originalSize) *
      100
    ).toFixed(2);
    console.log(`Compression ratio: ${compressionRatio}%`);

    // 6. 清理暫存檔案
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    console.log("Cleaned up temporary files");

    // 7. 回傳結果
    const totalTime = Date.now() - startTime;
    console.log(`Total execution time: ${totalTime}ms`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        compressedAudioBase64: compressedData.toString("base64"),
        originalSize,
        compressedSize,
        compressionRatio: Number.parseFloat(compressionRatio),
        processingTime: totalTime,
        compressionTime,
      }),
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
    };
  }
};
