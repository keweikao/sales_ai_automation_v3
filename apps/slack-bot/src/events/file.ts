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
  CurrentPosSystem,
  Env,
  PendingAudioFile,
  ServiceType,
  SlackEvent,
  StoreType,
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
  const fileId = event.file_id;

  if (!fileId) {
    console.log("No file_id in file_shared event");
    return;
  }

  const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);

  // 取得檔案資訊
  const fileInfo = await slackClient.getFileInfo(fileId);

  if (!(fileInfo.ok && fileInfo.file)) {
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

  // 檢查是否有下載 URL
  const downloadUrl = file.url_private_download;
  if (!downloadUrl) {
    await slackClient.postMessage({
      channel: event.channel,
      text: `:warning: 無法取得檔案「${file.name}」的下載連結。`,
      thread_ts: event.event_ts ?? event.ts,
    });
    return;
  }

  // 準備暫存的檔案資訊（將透過按鈕 value 傳遞）
  const pendingFile: PendingAudioFile = {
    fileId: file.id,
    fileName: file.name,
    channelId: event.channel,
    userId: event.user ?? "",
    threadTs: event.event_ts ?? event.ts,
    downloadUrl,
  };

  // 發送帶按鈕的訊息，請用戶填寫資訊
  await slackClient.postMessage({
    channel: event.channel,
    text: `偵測到音檔「${file.name}」，請點擊按鈕填寫客戶資訊以開始分析。`,
    thread_ts: event.event_ts ?? event.ts,
    blocks: buildAudioDetectedBlocks(file.name, file.size, pendingFile),
  });
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

/**
 * 建立音檔上傳 Modal 的表單
 */
export function buildAudioUploadModal(pendingFile: PendingAudioFile): object {
  return {
    type: "modal",
    callback_id: "audio_upload_form",
    private_metadata: JSON.stringify(pendingFile),
    title: {
      type: "plain_text",
      text: "填寫客戶資訊",
    },
    submit: {
      type: "plain_text",
      text: "開始分析",
    },
    close: {
      type: "plain_text",
      text: "取消",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:microphone: 音檔：*${pendingFile.fileName}*\n\n請填寫以下客戶資訊：`,
        },
      },
      {
        type: "divider",
      },
      // 客戶編號
      {
        type: "input",
        block_id: "customer_number_block",
        element: {
          type: "plain_text_input",
          action_id: "customer_number",
          placeholder: {
            type: "plain_text",
            text: "例如：C001、A0123",
          },
        },
        label: {
          type: "plain_text",
          text: "客戶編號 *",
        },
      },
      // 客戶名稱
      {
        type: "input",
        block_id: "customer_name_block",
        element: {
          type: "plain_text_input",
          action_id: "customer_name",
          placeholder: {
            type: "plain_text",
            text: "例如：王小明咖啡店",
          },
        },
        label: {
          type: "plain_text",
          text: "客戶名稱 *",
        },
      },
      // 店型
      {
        type: "input",
        block_id: "store_type_block",
        element: {
          type: "static_select",
          action_id: "store_type",
          placeholder: {
            type: "plain_text",
            text: "請選擇店型",
          },
          options: [
            { text: { type: "plain_text", text: "☕ 咖啡廳" }, value: "cafe" },
            {
              text: { type: "plain_text", text: "🧋 飲料店" },
              value: "beverage",
            },
            {
              text: { type: "plain_text", text: "🍲 火鍋店" },
              value: "hotpot",
            },
            { text: { type: "plain_text", text: "🍖 燒烤店" }, value: "bbq" },
            { text: { type: "plain_text", text: "🍿 小吃店" }, value: "snack" },
            {
              text: { type: "plain_text", text: "🍽️ 餐廳" },
              value: "restaurant",
            },
            { text: { type: "plain_text", text: "🍺 酒吧" }, value: "bar" },
            {
              text: { type: "plain_text", text: "🍔 速食店" },
              value: "fastfood",
            },
            { text: { type: "plain_text", text: "📦 其他" }, value: "other" },
          ],
        },
        label: {
          type: "plain_text",
          text: "店型 *",
        },
      },
      // 營運型態
      {
        type: "input",
        block_id: "service_type_block",
        element: {
          type: "static_select",
          action_id: "service_type",
          placeholder: {
            type: "plain_text",
            text: "請選擇營運型態",
          },
          options: [
            {
              text: { type: "plain_text", text: "🪑 純內用" },
              value: "dine_in_only",
            },
            {
              text: { type: "plain_text", text: "📦 純外帶/外送" },
              value: "takeout_only",
            },
            {
              text: { type: "plain_text", text: "🍽️ 內用為主" },
              value: "dine_in_main",
            },
            {
              text: { type: "plain_text", text: "🛵 外帶/外送為主" },
              value: "takeout_main",
            },
          ],
        },
        label: {
          type: "plain_text",
          text: "營運型態 *",
        },
      },
      // 現有 POS 系統
      {
        type: "input",
        block_id: "current_pos_block",
        element: {
          type: "static_select",
          action_id: "current_pos",
          placeholder: {
            type: "plain_text",
            text: "請選擇現有 POS 系統",
          },
          options: [
            {
              text: { type: "plain_text", text: "🆕 無（新開店）" },
              value: "none",
            },
            {
              text: { type: "plain_text", text: "📱 iCHEF 舊版" },
              value: "ichef_old",
            },
            {
              text: { type: "plain_text", text: "🔵 肚肚 DUDU" },
              value: "dudu",
            },
            {
              text: { type: "plain_text", text: "🟠 EZTABLE" },
              value: "eztable",
            },
            {
              text: { type: "plain_text", text: "💻 其他 POS 系統" },
              value: "other_pos",
            },
            {
              text: { type: "plain_text", text: "🧮 傳統收銀機" },
              value: "traditional",
            },
            {
              text: { type: "plain_text", text: "📝 手寫單" },
              value: "manual",
            },
          ],
        },
        label: {
          type: "plain_text",
          text: "現有 POS 系統 *",
        },
      },
      // 老闆本人在場
      {
        type: "input",
        block_id: "decision_maker_block",
        element: {
          type: "static_select",
          action_id: "decision_maker_onsite",
          placeholder: {
            type: "plain_text",
            text: "請選擇",
          },
          options: [
            {
              text: { type: "plain_text", text: "✅ 是，老闆本人在場" },
              value: "true",
            },
            {
              text: { type: "plain_text", text: "❌ 否，非決策者" },
              value: "false",
            },
          ],
        },
        label: {
          type: "plain_text",
          text: "老闆/決策者本人在場 *",
        },
      },
    ],
  };
}

/**
 * 從 Modal 提交結果解析業務資訊
 */
export function parseAudioUploadFormValues(
  values: Record<
    string,
    Record<string, { value?: string; selected_option?: { value: string } }>
  >
): AudioUploadMetadata {
  const customerNumber =
    values.customer_number_block?.customer_number?.value ?? "";
  const customerName = values.customer_name_block?.customer_name?.value ?? "";
  const storeType =
    (values.store_type_block?.store_type?.selected_option
      ?.value as StoreType) ?? "other";
  const serviceType =
    (values.service_type_block?.service_type?.selected_option
      ?.value as ServiceType) ?? "dine_in_main";
  const currentPos =
    (values.current_pos_block?.current_pos?.selected_option
      ?.value as CurrentPosSystem) ?? "none";
  const decisionMakerOnsite =
    values.decision_maker_block?.decision_maker_onsite?.selected_option
      ?.value === "true";

  return {
    customerNumber,
    customerName,
    storeType,
    serviceType,
    currentPos,
    decisionMakerOnsite,
  };
}

/**
 * 處理音檔上傳（包含業務資訊）
 */
export async function processAudioWithMetadata(
  pendingFile: PendingAudioFile,
  metadata: AudioUploadMetadata,
  env: Env
): Promise<void> {
  const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);

  // 發送處理中訊息
  const processingMsg = await slackClient.postMessage({
    channel: pendingFile.channelId,
    text: `:hourglass_flowing_sand: 正在處理音檔「${pendingFile.fileName}」...\n客戶：${metadata.customerName}\n轉錄和 MEDDIC 分析可能需要幾分鐘的時間。`,
    thread_ts: pendingFile.threadTs,
  });

  try {
    // 下載檔案
    const audioData = await slackClient.downloadFile(pendingFile.downloadUrl);

    // 呼叫 API 進行轉錄和分析
    const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);
    const result = await processAudioFile(
      apiClient,
      pendingFile.fileName,
      audioData,
      metadata
    );

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
  } catch (error) {
    console.error("Error processing audio file:", error);

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
  metadata?: AudioUploadMetadata
): Promise<ProcessingResult> {
  console.log(
    `Processing audio file: ${fileName}, size: ${audioData.byteLength}`
  );
  if (metadata) {
    console.log(
      `Customer: ${metadata.customerName}, Store: ${metadata.storeType}`
    );
  }

  // 如果有提供客戶名稱，嘗試找對應的商機或建立新商機
  let opportunity;

  if (metadata?.customerName) {
    // 先搜尋是否有相同名稱的商機
    const opportunitiesResult = await apiClient.getOpportunities({
      limit: 100,
    });
    opportunity = opportunitiesResult.opportunities.find(
      (opp) =>
        opp.companyName.toLowerCase() === metadata.customerName.toLowerCase()
    );

    // 如果沒找到，建立新商機
    if (!opportunity) {
      try {
        const createResult = await apiClient.createOpportunity({
          customerNumber: metadata.customerNumber,
          companyName: metadata.customerName,
          source: "slack",
          notes: formatMetadataNotes(metadata),
        });
        opportunity = createResult;
      } catch (createError) {
        console.error("Failed to create opportunity:", createError);
        // 如果建立失敗，嘗試使用最近的商機
        const fallbackResult = await apiClient.getOpportunities({ limit: 1 });
        opportunity = fallbackResult.opportunities[0];
      }
    }
  } else {
    // 沒有提供 metadata，使用最近的商機
    const opportunitiesResult = await apiClient.getOpportunities({ limit: 5 });
    opportunity = opportunitiesResult.opportunities[0];
  }

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
  });

  // 取得轉錄預覽
  const transcriptPreview = uploadResult.transcript
    ? uploadResult.transcript.slice(0, 200) +
      (uploadResult.transcript.length > 200 ? "..." : "")
    : "轉錄中...";

  // 嘗試執行 MEDDIC 分析（如果轉錄已完成）
  let analysisResult: ProcessingResult["analysisResult"];

  if (
    uploadResult.status === "transcribed" ||
    uploadResult.status === "completed"
  ) {
    try {
      const analysis = await apiClient.analyzeConversation(
        uploadResult.conversationId
      );
      analysisResult = {
        overallScore: analysis.overallScore,
        status: analysis.status as "strong" | "medium" | "weak" | "at_risk",
        dimensions: {
          metrics: analysis.dimensions.metrics.score,
          economicBuyer: analysis.dimensions.economicBuyer.score,
          decisionCriteria: analysis.dimensions.decisionCriteria.score,
          decisionProcess: analysis.dimensions.decisionProcess.score,
          identifyPain: analysis.dimensions.identifyPain.score,
          champion: analysis.dimensions.champion.score,
        },
        keyFindings: analysis.keyFindings,
        risks: analysis.risks,
        recommendedActions: analysis.nextSteps, // 使用 nextSteps 作為建議行動
        executiveSummary: analysis.keyFindings.slice(0, 2).join(" "), // 使用關鍵發現組成摘要
        nextSteps: analysis.nextSteps.map((step) => ({ action: step })),
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
    contactPhone: opportunity.contactPhone,
    contactEmail: opportunity.contactEmail,
    analysisResult,
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
