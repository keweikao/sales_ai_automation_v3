/**
 * File 事件處理器
 *
 * 監聽音檔上傳事件，自動進行轉錄和 MEDDIC 分析
 */

import type { ConversationType, Env, SlackEvent } from "../types";
import { SlackClient } from "../utils/slack-client";
import { ApiClient } from "../api-client";

// 支援的音檔格式
const SUPPORTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
];

/**
 * 處理檔案分享事件
 */
export async function handleFileSharedEvent(
  event: SlackEvent,
  env: Env
): Promise<void> {
  const fileId = event.file_id;

  if (!fileId) {
    console.log("No file_id in file_shared event");
    return;
  }

  const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);

  // 取得檔案資訊
  const fileInfo = await slackClient.getFileInfo(fileId);

  if (!fileInfo.ok || !fileInfo.file) {
    console.error("Failed to get file info:", fileInfo.error);
    return;
  }

  const file = fileInfo.file;

  // 檢查是否為音檔
  if (!SUPPORTED_AUDIO_TYPES.includes(file.mimetype)) {
    console.log(`Ignoring non-audio file: ${file.mimetype}`);
    return;
  }

  // 檢查檔案大小（最大 100MB）
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    await slackClient.postMessage({
      channel: event.channel,
      text: `:warning: 檔案「${file.name}」太大（${formatFileSize(file.size)}），請上傳小於 100MB 的音檔。`,
      thread_ts: event.event_ts ?? event.ts,
    });
    return;
  }

  // 發送處理中訊息
  const processingMsg = await slackClient.postMessage({
    channel: event.channel,
    text: `:hourglass_flowing_sand: 正在處理音檔「${file.name}」...\n轉錄和 MEDDIC 分析可能需要幾分鐘的時間。`,
    thread_ts: event.event_ts ?? event.ts,
  });

  try {
    // 下載檔案
    const downloadUrl = file.url_private_download;
    if (!downloadUrl) {
      throw new Error("No download URL available");
    }
    const audioData = await slackClient.downloadFile(downloadUrl);

    // 呼叫 API 進行轉錄和分析
    const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);
    const result = await processAudioFile(apiClient, file.name, audioData);

    // 更新訊息顯示結果
    if (processingMsg.ts) {
      await slackClient.updateMessage({
        channel: event.channel,
        ts: processingMsg.ts,
        text: `:white_check_mark: 音檔「${file.name}」處理完成！`,
        blocks: buildProcessingResultBlocks(file.name, result),
      });
    }
  } catch (error) {
    console.error("Error processing audio file:", error);

    // 更新訊息顯示錯誤
    if (processingMsg.ts) {
      await slackClient.updateMessage({
        channel: event.channel,
        ts: processingMsg.ts,
        text: `:x: 處理音檔「${file.name}」時發生錯誤: ${error instanceof Error ? error.message : "未知錯誤"}`,
      });
    }
  }
}

interface ProcessingResult {
  conversationId: string;
  caseNumber: string;
  transcriptPreview: string;
  opportunityId?: string;
  opportunityName?: string;
  meddicScore?: {
    overallScore: number;
    status: string;
  };
}

/**
 * 處理音檔檔案
 */
async function processAudioFile(
  apiClient: ApiClient,
  fileName: string,
  audioData: ArrayBuffer
): Promise<ProcessingResult> {
  console.log(
    `Processing audio file: ${fileName}, size: ${audioData.byteLength}`
  );

  // 取得最近的商機列表
  const opportunitiesResult = await apiClient.getOpportunities({ limit: 5 });
  const opportunity = opportunitiesResult.opportunities[0];

  if (!opportunity) {
    throw new Error(
      "尚無商機資料，請先使用 `/opportunity create <公司名稱>` 建立商機"
    );
  }

  // 將音檔轉換為 base64
  const base64 = arrayBufferToBase64(audioData);

  // 從檔名取得格式
  const format = getAudioFormat(fileName);

  // 上傳對話
  const uploadResult = await apiClient.uploadConversation({
    opportunityId: opportunity.id,
    audioBase64: base64,
    title: `Slack 上傳: ${fileName}`,
    type: "discovery_call" as ConversationType,
    metadata: {
      format,
      conversationDate: new Date().toISOString().split("T")[0],
    },
  });

  // 取得轉錄預覽
  const transcriptPreview = uploadResult.transcript
    ? uploadResult.transcript.slice(0, 200) +
      (uploadResult.transcript.length > 200 ? "..." : "")
    : "轉錄中...";

  // 嘗試執行 MEDDIC 分析（如果轉錄已完成）
  let meddicScore: ProcessingResult["meddicScore"];

  if (
    uploadResult.status === "transcribed" ||
    uploadResult.status === "completed"
  ) {
    try {
      const analysis = await apiClient.analyzeConversation(
        uploadResult.conversationId
      );
      meddicScore = {
        overallScore: analysis.overallScore,
        status: analysis.status,
      };
    } catch (analysisError) {
      console.log("MEDDIC analysis not ready yet:", analysisError);
    }
  }

  return {
    conversationId: uploadResult.conversationId,
    caseNumber: uploadResult.caseNumber,
    transcriptPreview,
    opportunityId: opportunity.id,
    opportunityName: opportunity.companyName,
    meddicScore,
  };
}

/**
 * 建立處理結果的 Block UI
 */
function buildProcessingResultBlocks(
  fileName: string,
  result: ProcessingResult
): object[] {
  const blocks: object[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:white_check_mark: *音檔處理完成*\n檔案: ${fileName}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*案件編號*\n${result.caseNumber}`,
        },
        {
          type: "mrkdwn",
          text: `*關聯商機*\n${result.opportunityName ?? "未指定"}`,
        },
      ],
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*轉錄預覽:*\n>${result.transcriptPreview}`,
      },
    },
  ];

  if (result.meddicScore) {
    const scoreEmoji = getScoreEmoji(result.meddicScore.overallScore);

    blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*MEDDIC 評分:* ${result.meddicScore.overallScore}/100 ${scoreEmoji}\n*狀態:* ${formatStatus(result.meddicScore.status)}`,
        },
      }
    );
  }

  blocks.push(
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📊 執行 MEDDIC 分析",
            emoji: true,
          },
          action_id: "run_meddic_analysis",
          value: result.conversationId,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📝 查看完整轉錄",
            emoji: true,
          },
          action_id: "view_full_transcript",
          value: result.conversationId,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `對話 ID: \`${result.conversationId}\` | 使用 \`/analyze ${result.conversationId}\` 執行分析`,
        },
      ],
    }
  );

  return blocks;
}

// Helper functions
function getScoreEmoji(score: number): string {
  if (score >= 70) {
    return "🟢";
  }
  if (score >= 40) {
    return "🟡";
  }
  return "🔴";
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    strong: "🟢 強勁",
    medium: "🟡 中等",
    weak: "🟠 薄弱",
    at_risk: "🔴 風險",
  };

  return statusMap[status.toLowerCase()] ?? status;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function getAudioFormat(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "mp3";
  const formatMap: Record<string, string> = {
    mp3: "mp3",
    wav: "wav",
    m4a: "m4a",
    ogg: "ogg",
    webm: "webm",
    mp4: "mp4",
  };
  return formatMap[ext] ?? "mp3";
}
