/**
 * AWS Lambda - Audio Compression Function
 *
 * 功能: 接收音檔並使用 FFmpeg 壓縮為適合 Whisper 轉錄的格式
 *
 * 輸入格式:
 * {
 *   audioBase64: string,     // Base64 編碼的音檔
 *   audioUrl?: string,       // 或提供音檔 URL
 *   outputMode?: "base64" | "s3"  // 輸出模式 (預設: base64)
 * }
 *
 * 輸出格式 (outputMode: "base64"):
 * {
 *   outputMode: "base64",
 *   compressedAudioBase64: string,
 *   originalSize: number,
 *   compressedSize: number,
 *   compressionRatio: number
 * }
 *
 * 輸出格式 (outputMode: "s3"):
 * {
 *   outputMode: "s3",
 *   s3Key: string,
 *   s3Bucket: string,
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
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("node:crypto");

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
 * 取得 FFmpeg 路徑
 * 依序嘗試：Lambda Layer → 內嵌 bin/ 目錄 → 內嵌 src/ 目錄
 */
function getFFmpegPath() {
  const possiblePaths = [
    "/opt/bin/ffmpeg", // Lambda Layer
    "/var/task/bin/ffmpeg", // 內嵌在 bin/ 目錄
    `${__dirname}/../bin/ffmpeg`, // 相對於 src/ 的 bin/
    `${__dirname}/ffmpeg`, // 舊版內嵌位置
  ];

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      console.log(`Using FFmpeg from: ${path}`);
      return path;
    }
  }

  throw new Error(
    `FFmpeg not found! Checked paths: ${possiblePaths.join(", ")}`
  );
}

/**
 * 上傳壓縮音檔到 S3
 */
async function uploadToS3(filePath, originalFileName) {
  const s3Region = process.env.AWS_S3_REGION;
  const s3Bucket = process.env.AWS_S3_BUCKET;
  const s3Prefix = process.env.AWS_S3_PREFIX || "compressed-audio/";

  if (!(s3Region && s3Bucket)) {
    throw new Error(
      "AWS_S3_REGION and AWS_S3_BUCKET must be set for S3 output mode"
    );
  }

  // 生成唯一的 S3 key
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString("hex");
  const sanitizedFileName = originalFileName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 50);
  const s3Key = `${s3Prefix}${timestamp}-${randomId}-${sanitizedFileName}.mp3`;

  console.log(`Uploading to S3: ${s3Bucket}/${s3Key}`);

  const s3Client = new S3Client({ region: s3Region });
  const fileData = fs.readFileSync(filePath);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: fileData,
      ContentType: "audio/mpeg",
    })
  );

  console.log(`S3 upload successful: ${s3Key}`);
  return { s3Key, s3Bucket };
}

/**
 * 執行 FFmpeg 壓縮
 * @param {string} inputPath - 輸入檔案路徑
 * @param {string} outputPath - 輸出檔案路徑
 * @param {string} outputMode - 輸出模式 ("base64" | "s3")
 */
function compressAudio(inputPath, outputPath, outputMode = "base64") {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFFmpegPath();

    const inputStats = fs.statSync(inputPath);
    const inputSizeMB = inputStats.size / 1024 / 1024;

    // S3 模式：使用較高位元率 (32kbps) 以保持音質
    // Base64 模式：Lambda Function URL 回應限制 6MB，大檔案需要極低位元率
    let bitrate;
    if (outputMode === "s3") {
      // S3 模式：統一使用 32kbps，確保轉錄品質
      bitrate = "32k";
    } else {
      // Base64 模式：大於 20MB 的檔案用 8kbps（向後兼容）
      bitrate = inputSizeMB > 20 ? "8k" : "32k";
    }
    console.log(
      `File: ${inputSizeMB.toFixed(1)}MB, outputMode: ${outputMode}, using bitrate: ${bitrate}`
    );

    const ffmpeg = spawn(ffmpegPath, [
      "-i",
      inputPath,
      "-ab",
      bitrate, // 動態位元率
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

  // 解析 outputMode (預設 "base64" 以向後兼容)
  const outputMode = requestData.outputMode || "base64";
  const originalFileName = requestData.fileName || "audio";

  console.log("Lambda invoked with event:", {
    hasAudioBase64: !!requestData.audioBase64,
    hasAudioUrl: !!requestData.audioUrl,
    outputMode,
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

    await compressAudio(inputPath, outputPath, outputMode);

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

    // 6. 根據 outputMode 決定輸出方式
    let responseData;
    const totalTime = Date.now() - startTime;

    if (outputMode === "s3") {
      // S3 模式：上傳到 S3 並回傳 key
      console.log("Uploading compressed audio to S3...");
      const { s3Key, s3Bucket } = await uploadToS3(
        outputPath,
        originalFileName
      );

      responseData = {
        success: true,
        outputMode: "s3",
        s3Key,
        s3Bucket,
        originalSize,
        compressedSize,
        compressionRatio: Number.parseFloat(compressionRatio),
        processingTime: totalTime,
        compressionTime,
      };
    } else {
      // Base64 模式（預設，向後兼容）
      responseData = {
        success: true,
        outputMode: "base64",
        compressedAudioBase64: compressedData.toString("base64"),
        originalSize,
        compressedSize,
        compressionRatio: Number.parseFloat(compressionRatio),
        processingTime: totalTime,
        compressionTime,
      };
    }

    // 7. 清理暫存檔案
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    console.log("Cleaned up temporary files");

    // 8. 回傳結果
    console.log(`Total execution time: ${totalTime}ms`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(responseData),
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
