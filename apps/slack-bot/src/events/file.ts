/**
 * File 事件處理器
 *
 * 監聯音檔上傳事件，要求業務填寫客戶資訊後再進行轉錄和 MEDDIC 分析
 */

import { ApiClient } from "../api-client";
import {
  buildAnalysisResultBlocks,
  buildSummaryBlocks,
} from "../blocks/analysis-result";
import type {
  AudioUploadMetadata,
  ConversationType,
  Env,
  PendingAudioFile,
  SlackEvent,
} from "../types";
import { SlackClient } from "../utils/slack-client";

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
 * 偵測到音檔後，發送帶按鈕的訊息，讓用戶點擊填寫資訊
 */
export async function handleFileSharedEvent(
  event: SlackEvent,
  env: Env
): Promise<void> {
  console.log(
    `[FileEvent] Starting handleFileSharedEvent for file_id: ${event.file_id}`
  );

  const fileId = event.file_id;

  if (!fileId) {
    console.log("[FileEvent] No file_id in file_shared event");
    return;
  }

  console.log(
    `[FileEvent] Creating SlackClient with token: ${env.SLACK_BOT_TOKEN?.substring(0, 10)}...`
  );
  const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);

  // 取得檔案資訊
  console.log(`[FileEvent] Fetching file info for: ${fileId}`);
  const fileInfo = await slackClient.getFileInfo(fileId);

  if (!(fileInfo.ok && fileInfo.file)) {
    console.error(`[FileEvent] Failed to get file info: ${fileInfo.error}`);
    return;
  }

  console.log(
    `[FileEvent] File info retrieved: ${fileInfo.file.name}, type: ${fileInfo.file.mimetype}`
  );
  const file = fileInfo.file;

  // 檢查是否為音檔 - 同時檢查 mimetype 和副檔名
  console.log(
    `[FileEvent] Checking if file is audio. Mimetype: ${file.mimetype}, filename: ${file.name}`
  );

  const isSupportedMimetype =
    file.mimetype && SUPPORTED_AUDIO_TYPES.includes(file.mimetype);
  const audioExtensions = [
    ".mp3",
    ".wav",
    ".m4a",
    ".webm",
    ".ogg",
    ".mp4",
    ".mpeg",
  ];
  const hasAudioExtension = audioExtensions.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );

  const isAudioFile = isSupportedMimetype || hasAudioExtension;

  console.log(
    `[FileEvent] Audio check result: mimetype=${isSupportedMimetype}, extension=${hasAudioExtension}, isAudio=${isAudioFile}`
  );

  if (!isAudioFile) {
    console.log(
      `[FileEvent] Ignoring non-audio file: ${file.mimetype}, name: ${file.name}`
    );
    return;
  }

  console.log(`[FileEvent] File is audio, checking size: ${file.size} bytes`);
  // 檢查檔案大小（最大 150MB）
  const maxSize = 150 * 1024 * 1024;
  if (file.size > maxSize) {
    console.log(`[FileEvent] File too large: ${file.size} bytes`);
    await slackClient.postMessage({
      channel: event.channel,
      text: `:warning: 檔案「${file.name}」太大（${formatFileSize(file.size)}），請上傳小於 150MB 的音檔。`,
      thread_ts: event.event_ts ?? event.ts,
    });
    return;
  }

  // 檢查是否有下載 URL
  console.log(
    `[FileEvent] Checking download URL: ${file.url_private_download ? "exists" : "missing"}`
  );
  const downloadUrl = file.url_private_download;
  if (!downloadUrl) {
    console.log("[FileEvent] No download URL available");
    await slackClient.postMessage({
      channel: event.channel,
      text: `:warning: 無法取得檔案「${file.name}」的下載連結。`,
      thread_ts: event.event_ts ?? event.ts,
    });
    return;
  }

  // 取得上傳者的使用者名稱
  console.log(`[FileEvent] Fetching user info for: ${event.user ?? "unknown"}`);
  let userName = "";
  if (event.user) {
    try {
      const userInfo = await slackClient.getUserInfo(event.user);
      if (userInfo.ok && userInfo.user) {
        userName = userInfo.user.name;
        console.log(`[FileEvent] User name retrieved: ${userName}`);
      }
    } catch (err) {
      console.error("[FileEvent] Failed to get user info:", err);
    }
  }

  // 準備暫存的檔案資訊（將透過按鈕 value 傳遞）
  const pendingFile: PendingAudioFile = {
    fileId: file.id,
    fileName: file.name,
    channelId: event.channel,
    userId: event.user ?? "",
    userName,
    threadTs: event.event_ts ?? event.ts,
    downloadUrl,
  };

  console.log(
    "[FileEvent] Prepared pending file data:",
    JSON.stringify(pendingFile, null, 2)
  );

  // 發送帶按鈕的訊息，請用戶填寫資訊
  console.log(
    `[FileEvent] Sending message with button to channel: ${event.channel}`
  );
  try {
    const result = await slackClient.postMessage({
      channel: event.channel,
      text: `偵測到音檔「${file.name}」，請點擊按鈕填寫客戶資訊以開始分析。`,
      thread_ts: event.event_ts ?? event.ts,
      blocks: buildAudioDetectedBlocks(file.name, file.size, pendingFile),
    });
    console.log(
      "[FileEvent] Message sent successfully:",
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    console.error("[FileEvent] Failed to send message:", error);
    throw error;
  }
}

/**
 * 建立偵測到音檔後的訊息 Blocks（簡化版）
 */
function buildAudioDetectedBlocks(
  fileName: string,
  _fileSize: number,
  pendingFile: PendingAudioFile
): object[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:microphone: 收到音檔 *${fileName}*`,
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "填寫資訊並分析",
          emoji: true,
        },
        style: "primary",
        action_id: "open_audio_upload_modal",
        value: JSON.stringify(pendingFile),
      },
    },
  ];
}

// Note: buildAudioUploadModal and parseAudioUploadFormValues have been moved to
// /utils/form-builder.ts to support dynamic multi-product-line forms

/**
 * 處理音檔上傳（包含業務資訊）
 */
export async function processAudioWithMetadata(
  pendingFile: PendingAudioFile,
  metadata: AudioUploadMetadata,
  env: Env
): Promise<void> {
  const processingId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  console.log(`[SlackBot:${processingId}] 🎬 Started processing audio file`);
  console.log(`[SlackBot:${processingId}] Details:`, {
    fileName: pendingFile.fileName,
    customer: metadata.customerName,
    channel: pendingFile.channelId,
  });

  const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);

  // 發送處理中訊息
  console.log(
    `[SlackBot:${processingId}] 💬 Posting processing message to Slack...`
  );
  const processingMsg = await slackClient.postMessage({
    channel: pendingFile.channelId,
    text: `:hourglass_flowing_sand: 正在處理音檔「${pendingFile.fileName}」...\n客戶：${metadata.customerName}\n轉錄和 MEDDIC 分析可能需要幾分鐘的時間。`,
    thread_ts: pendingFile.threadTs,
  });
  console.log(`[SlackBot:${processingId}] ✓ Processing message posted`);

  try {
    // 不在 Slack Bot 下載檔案,改為傳遞 URL 給 Server 下載
    // 這樣可以避免 Slack Bot Worker 的 CPU 超時問題
    console.log(`[SlackBot:${processingId}] 🌐 Creating API client...`);
    console.log(`[SlackBot:${processingId}] API_BASE_URL: ${env.API_BASE_URL}`);
    const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);

    console.log(
      `[SlackBot:${processingId}] 📤 Calling processAudioFile with Slack URL...`
    );
    console.log(
      `[SlackBot:${processingId}] Download URL: ${pendingFile.downloadUrl.substring(0, 50)}...`
    );
    const apiCallStartTime = Date.now();

    // 創建一個空的 ArrayBuffer(不會實際使用)
    const dummyAudioData = new ArrayBuffer(0);

    const result = await processAudioFile(
      apiClient,
      pendingFile.fileName,
      dummyAudioData, // 不會使用,因為有 slackFileUrl
      metadata,
      // 傳遞 Slack 業務資訊
      pendingFile.userId
        ? { id: pendingFile.userId, username: pendingFile.userName ?? "" }
        : undefined,
      // 傳遞 Slack 檔案 URL 和 token 讓 Server 下載
      pendingFile.downloadUrl,
      env.SLACK_BOT_TOKEN
    );
    console.log(
      `[SlackBot:${processingId}] ✓ processAudioFile completed in ${Date.now() - apiCallStartTime}ms`
    );
    console.log(`[SlackBot:${processingId}] Result:`, {
      conversationId: result.conversationId,
      caseNumber: result.caseNumber,
      hasAnalysis: !!result.analysisResult,
    });

    // 更新處理中訊息為簡短確認
    if (processingMsg.ts) {
      await slackClient.updateMessage({
        channel: pendingFile.channelId,
        ts: processingMsg.ts,
        text: `:white_check_mark: 音檔「${pendingFile.fileName}」處理完成！`,
      });
    }

    // 如果有分析結果，發送兩則訊息
    if (result.analysisResult) {
      // 訊息 1: Agent 1-3 合併分析報告
      await slackClient.postMessage({
        channel: pendingFile.channelId,
        text: `MEDDIC 分析完成 - ${result.opportunityName}`,
        thread_ts: pendingFile.threadTs,
        blocks: buildAnalysisResultBlocks({
          conversationId: result.conversationId,
          caseNumber: result.caseNumber,
          companyName: result.opportunityName ?? metadata.customerName,
          overallScore: result.analysisResult.overallScore,
          status: result.analysisResult.status,
          dimensions: result.analysisResult.dimensions,
          keyFindings: result.analysisResult.keyFindings,
          risks: result.analysisResult.risks,
          recommendedActions: result.analysisResult.recommendedActions,
          executiveSummary: result.analysisResult.executiveSummary,
          nextSteps: result.analysisResult.nextSteps,
        }),
      });

      // 訊息 2: Agent 4 Summary（含編輯/寄送按鈕）
      await slackClient.postMessage({
        channel: pendingFile.channelId,
        text: `會議摘要 - ${result.opportunityName}`,
        thread_ts: pendingFile.threadTs,
        blocks: buildSummaryBlocks(
          result.conversationId,
          result.analysisResult.executiveSummary,
          result.analysisResult.nextSteps,
          {
            phone: result.contactPhone,
            email: result.contactEmail,
          }
        ),
      });
    } else {
      // 沒有分析結果時，顯示舊版結果（含按鈕讓使用者手動觸發分析）
      await slackClient.postMessage({
        channel: pendingFile.channelId,
        text: `音檔處理完成 - ${pendingFile.fileName}`,
        thread_ts: pendingFile.threadTs,
        blocks: buildProcessingResultBlocks(
          pendingFile.fileName,
          result,
          metadata
        ),
      });
    }

    const totalDuration = Date.now() - startTime;
    console.log(
      `[SlackBot:${processingId}] ✅ Processing completed successfully in ${totalDuration}ms`
    );
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    console.error(
      `[SlackBot:${processingId}] ❌ Error processing audio file after ${errorDuration}ms:`,
      error
    );
    console.error(`[SlackBot:${processingId}] Error details:`, {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // 更新訊息顯示錯誤
    if (processingMsg.ts) {
      await slackClient.updateMessage({
        channel: pendingFile.channelId,
        ts: processingMsg.ts,
        text: `:x: 處理音檔「${pendingFile.fileName}」時發生錯誤: ${error instanceof Error ? error.message : "未知錯誤"}`,
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

  // Opportunity 聯絡資訊（用於發送通知）
  contactPhone?: string | null;
  contactEmail?: string | null;

  // 完整分析結果（如有）
  analysisResult?: {
    overallScore: number;
    status: "strong" | "medium" | "weak" | "at_risk";
    dimensions: {
      metrics: number;
      economicBuyer: number;
      decisionCriteria: number;
      decisionProcess: number;
      identifyPain: number;
      champion: number;
    };
    keyFindings: string[];
    risks: string[];
    recommendedActions: string[];
    executiveSummary: string;
    nextSteps: Array<{
      action: string;
      owner?: string;
      deadline?: string;
    }>;
  };
}

/**
 * 處理音檔檔案（包含業務資訊）
 */
async function processAudioFile(
  apiClient: ApiClient,
  fileName: string,
  audioData: ArrayBuffer,
  metadata?: AudioUploadMetadata,
  slackUser?: { id: string; username: string },
  slackFileUrl?: string,
  slackBotToken?: string
): Promise<ProcessingResult> {
  const fileProcessingId = `FILE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  console.log(`[${fileProcessingId}] 🎵 processAudioFile started`);
  console.log(
    `[${fileProcessingId}] File: ${fileName}, size: ${audioData.byteLength} bytes`
  );
  if (metadata) {
    console.log(
      `[${fileProcessingId}] Customer: ${metadata.customerName}, Store: ${metadata.storeType}`
    );
  }

  // 如果有提供客戶名稱，嘗試找對應的商機或建立新商機
  let opportunity;

  if (metadata?.customerName) {
    // 先搜尋是否有相同名稱的商機
    console.log(
      `[${fileProcessingId}] 🔍 Fetching opportunities for customer: ${metadata.customerName}`
    );
    try {
      const opportunitiesResult = await apiClient.getOpportunities({
        limit: 100,
      });
      console.log(
        `[${fileProcessingId}] ✓ Got ${opportunitiesResult.opportunities.length} opportunities`
      );
      opportunity = opportunitiesResult.opportunities.find(
        (opp) =>
          opp.companyName.toLowerCase() === metadata.customerName.toLowerCase()
      );

      if (opportunity) {
        console.log(
          `[${fileProcessingId}] ✓ Found existing opportunity: ${opportunity.companyName}`
        );
      } else {
        console.log(
          `[${fileProcessingId}] ⚠️ No existing opportunity found, creating new one`
        );
      }
    } catch (fetchError) {
      console.error(
        `[${fileProcessingId}] ❌ Failed to fetch opportunities:`,
        fetchError
      );
      throw fetchError;
    }

    // 如果沒找到，建立新商機
    if (!opportunity) {
      try {
        console.log(`[${fileProcessingId}] 🆕 Creating new opportunity...`);
        const createResult = await apiClient.createOpportunity({
          customerNumber: metadata.customerNumber,
          companyName: metadata.customerName,
          contactPhone: metadata.contactPhone, // 新增客戶電話
          source: "slack",
          notes: formatMetadataNotes(metadata),
        });
        opportunity = createResult;
        console.log(
          `[${fileProcessingId}] ✓ Created opportunity: ${opportunity.id}`
        );
      } catch (createError) {
        console.error(
          `[${fileProcessingId}] ❌ Failed to create opportunity:`,
          createError
        );
        // 如果建立失敗，嘗試使用最近的商機
        console.log(
          `[${fileProcessingId}] 🔄 Falling back to most recent opportunity`
        );
        const fallbackResult = await apiClient.getOpportunities({ limit: 1 });
        opportunity = fallbackResult.opportunities[0];
      }
    }
  } else {
    // 沒有提供 metadata，使用最近的商機
    console.log(
      `[${fileProcessingId}] 📋 No metadata provided, using most recent opportunity`
    );
    const opportunitiesResult = await apiClient.getOpportunities({ limit: 5 });
    opportunity = opportunitiesResult.opportunities[0];
    console.log(
      `[${fileProcessingId}] ✓ Using opportunity: ${opportunity?.companyName || "N/A"}`
    );
  }

  if (!opportunity) {
    console.error(`[${fileProcessingId}] ❌ No opportunity available`);
    throw new Error(
      "尚無商機資料，請先使用 `/opportunity create <公司名稱>` 建立商機"
    );
  }

  // 從檔名取得格式
  const format = getAudioFormat(fileName);
  console.log(`[${fileProcessingId}] 🎧 Audio format: ${format}`);

  // 上傳對話
  console.log(`[${fileProcessingId}] 📤 Uploading conversation to server...`);
  console.log(`[${fileProcessingId}] Upload details:`, {
    opportunityId: opportunity.id,
    audioSize: audioData.byteLength,
    format,
    hasSlackUser: !!slackUser,
    usingSlackUrl: !!slackFileUrl,
  });

  let uploadResult; // 宣告在 try 外部,讓後續代碼可以訪問
  try {
    const uploadStartTime = Date.now();
    uploadResult = await apiClient.uploadConversation({
      opportunityId: opportunity.id,
      // 優先使用 Slack 檔案 URL,避免 base64 轉換的 CPU 開銷
      slackFileUrl,
      slackBotToken,
      // 只有在沒有 Slack URL 時才轉換 base64(向後兼容)
      audioBase64: slackFileUrl ? undefined : arrayBufferToBase64(audioData),
      title: metadata?.customerName
        ? `${metadata.customerName} - Slack 上傳`
        : `Slack 上傳: ${fileName}`,
      type: "discovery_call" as ConversationType,
      metadata: {
        format,
        conversationDate: new Date().toISOString().split("T")[0],
        // 將業務資訊存入 metadata
        ...(metadata && {
          storeType: metadata.storeType,
          serviceType: metadata.serviceType,
          currentPos: metadata.currentPos,
          decisionMakerOnsite: metadata.decisionMakerOnsite,
        }),
      },
      // 傳遞 Slack 業務資訊
      slackUser,
    });

    const uploadDuration = Date.now() - uploadStartTime;
    console.log(
      `[${fileProcessingId}] ✅ Upload successful in ${uploadDuration}ms`
    );
    console.log(`[${fileProcessingId}] Upload result:`, {
      conversationId: uploadResult.conversationId,
      caseNumber: uploadResult.caseNumber,
      status: uploadResult.status,
      hasTranscript: !!uploadResult.transcript,
    });
  } catch (uploadError) {
    console.error(`[${fileProcessingId}] ❌ Upload failed:`, uploadError);
    console.error(`[${fileProcessingId}] Error details:`, {
      name: uploadError instanceof Error ? uploadError.name : "Unknown",
      message:
        uploadError instanceof Error
          ? uploadError.message
          : String(uploadError),
    });
    throw uploadError;
  }

  // Queue 架構:立即返回,不等待轉錄完成
  // Queue Worker 會在完成後發送 Slack 通知
  console.log(`[${fileProcessingId}] ✅ Audio file queued for processing`);
  console.log(`[${fileProcessingId}] Status: ${uploadResult.status}`);
  console.log(
    `[${fileProcessingId}] Message: ${uploadResult.message || "Processing..."}`
  );

  return {
    conversationId: uploadResult.conversationId,
    caseNumber: uploadResult.caseNumber,
    transcriptPreview:
      uploadResult.message ||
      "音檔已接收,正在處理轉錄和 MEDDIC 分析,完成後會通知您...",
    opportunityId: opportunity.id,
    opportunityName: opportunity.companyName,
    contactPhone: opportunity.contactPhone,
    contactEmail: opportunity.contactEmail,
    analysisResult: undefined, // 將由 Queue Worker 完成後通知
  };
}

/**
 * 格式化業務資訊為備註
 */
function formatMetadataNotes(metadata: AudioUploadMetadata): string {
  const storeTypeLabels: Record<string, string> = {
    cafe: "咖啡廳",
    beverage: "飲料店",
    hotpot: "火鍋店",
    bbq: "燒烤店",
    snack: "小吃店",
    restaurant: "餐廳",
    bar: "酒吧",
    fastfood: "速食店",
    other: "其他",
  };

  const serviceTypeLabels: Record<string, string> = {
    dine_in_only: "純內用",
    takeout_only: "純外帶/外送",
    dine_in_main: "內用為主",
    takeout_main: "外帶/外送為主",
  };

  const posLabels: Record<string, string> = {
    none: "無（新開店）",
    ichef_old: "iCHEF 舊版",
    dudu: "肚肚 DUDU",
    eztable: "EZTABLE",
    other_pos: "其他 POS",
    traditional: "傳統收銀機",
    manual: "手寫單",
  };

  return [
    `店型: ${storeTypeLabels[metadata.storeType] ?? metadata.storeType}`,
    `營運型態: ${serviceTypeLabels[metadata.serviceType] ?? metadata.serviceType}`,
    `現有 POS: ${posLabels[metadata.currentPos] ?? metadata.currentPos}`,
    `決策者在場: ${metadata.decisionMakerOnsite ? "是" : "否"}`,
    "來源: Slack 音檔上傳",
  ].join("\n");
}

/**
 * 建立處理結果的 Block UI
 */
function buildProcessingResultBlocks(
  fileName: string,
  result: ProcessingResult,
  metadata?: AudioUploadMetadata
): object[] {
  const storeTypeLabels: Record<string, string> = {
    cafe: "☕ 咖啡廳",
    beverage: "🧋 飲料店",
    hotpot: "🍲 火鍋店",
    bbq: "🍖 燒烤店",
    snack: "🍿 小吃店",
    restaurant: "🍽️ 餐廳",
    bar: "🍺 酒吧",
    fastfood: "🍔 速食店",
    other: "📦 其他",
  };

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
  ];

  // 如果有業務資訊，顯示客戶詳細資料
  if (metadata) {
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*店型*\n${storeTypeLabels[metadata.storeType] ?? metadata.storeType}`,
        },
        {
          type: "mrkdwn",
          text: `*決策者在場*\n${metadata.decisionMakerOnsite ? "✅ 是" : "❌ 否"}`,
        },
      ],
    });
  }

  blocks.push(
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*轉錄預覽:*\n>${result.transcriptPreview}`,
      },
    }
  );

  if (result.analysisResult) {
    const scoreEmoji = getScoreEmoji(result.analysisResult.overallScore);

    blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*MEDDIC 評分:* ${result.analysisResult.overallScore}/100 ${scoreEmoji}\n*狀態:* ${formatStatus(result.analysisResult.status)}`,
        },
      }
    );
  } else {
    // 轉錄已完成,MEDDIC 分析將在背景自動執行
    blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🤖 *MEDDIC 分析*\n自動分析中,完成後會通知您...",
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
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
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
