/**
 * Slack Block Kit 訊息構建器
 * 提供統一的訊息格式
 */

import type { KnownBlock } from "@slack/web-api";
import type { MEDDICAnalysisResult } from "./types.js";

/**
 * 構建處理開始通知 Blocks
 */
export function buildProcessingStartedBlocks(
  fileName: string,
  fileSize: number,
  conversationId: string,
  caseNumber?: string
): KnownBlock[] {
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🎬 開始處理音檔",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*檔案名稱:*\n${fileName}`,
        },
        {
          type: "mrkdwn",
          text: `*檔案大小:*\n${fileSizeMB} MB`,
        },
      ],
    },
  ];

  if (caseNumber) {
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*案件編號:*\n${caseNumber}`,
        },
        {
          type: "mrkdwn",
          text: `*對話 ID:*\n\`${conversationId}\``,
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "⏳ 正在進行轉錄和分析,請稍候...",
      },
    ],
  });

  return blocks;
}

/**
 * 構建處理完成通知 Blocks
 */
export function buildProcessingCompletedBlocks(
  caseNumber: string,
  conversationId: string,
  analysisResult: MEDDICAnalysisResult,
  processingTimeMs: number,
  shareToken?: string // 新增: 公開分享 token
): KnownBlock[] {
  const processingTimeSec = (processingTimeMs / 1000).toFixed(1);

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "✅ 音檔處理完成",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*案件編號:*\n${caseNumber}`,
        },
        {
          type: "mrkdwn",
          text: `*處理時間:*\n${processingTimeSec} 秒`,
        },
        {
          type: "mrkdwn",
          text: `*MEDDIC 分數:*\n*${analysisResult.overallScore}/100*`,
        },
        {
          type: "mrkdwn",
          text:
            "*資格狀態:*\n" +
            getStatusEmoji(analysisResult.qualificationStatus) +
            " " +
            analysisResult.qualificationStatus,
        },
      ],
    },
  ];

  // Block 2: 分隔線
  blocks.push({ type: "divider" });

  // Block 3: 高優先級警報 (僅當有 alerts 時)
  if (analysisResult.alerts && analysisResult.alerts.length > 0) {
    const alertsText = analysisResult.alerts
      .map((alert) => `• ${alert}`)
      .join("\n");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *需要注意:*\n${alertsText}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // Block 4: 客戶痛點 (從 painPoints 提取)
  if (analysisResult.painPoints && analysisResult.painPoints.length > 0) {
    const painPointsText = analysisResult.painPoints
      .map((point) => `• ${point}`)
      .join("\n");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `💡 *客戶痛點*\n${painPointsText}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // Block 5: 風險與緩解措施 (從 risks 提取)
  if (analysisResult.risks && analysisResult.risks.length > 0) {
    const risksText = analysisResult.risks
      .map((risk) => {
        const emoji = getSeverityEmoji(risk.severity);
        let text = `${emoji} *${risk.risk}*`;
        if (risk.mitigation) {
          text += `\n_緩解措施:_ ${risk.mitigation}`;
        }
        return text;
      })
      .join("\n\n");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: risksText,
      },
    });
    blocks.push({ type: "divider" });
  }

  // Block 6: 建議 SMS 跟進訊息 (顯示完整內容)
  if (analysisResult.smsText) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "📱 *建議 SMS 跟進訊息*\n" +
          analysisResult.smsText +
          "\n\n_點擊下方「編輯會議摘要與簡訊」可修改內容並發送_",
      },
    });
    blocks.push({ type: "divider" });
  }

  // Block 7: 操作按鈕 (完整分析 + 編輯摘要與簡訊)
  const webAppUrl = process.env.WEB_APP_URL || "https://sales-ai-web.pages.dev";
  const actionButtons: any[] = [
    {
      type: "button",
      text: {
        type: "plain_text",
        text: "查看完整分析",
        emoji: true,
      },
      url: `${webAppUrl}/conversations/${conversationId}`,
      style: "primary",
    },
  ];

  // 如果有客戶電話和分享 token,新增「發送 SMS」按鈕
  if (analysisResult.contactPhone && shareToken) {
    actionButtons.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "📱 發送 SMS 給客戶",
        emoji: true,
      },
      action_id: "send_customer_sms",
      value: JSON.stringify({
        conversationId,
        phoneNumber: analysisResult.contactPhone,
        shareToken,
      }),
      style: "primary",
    });
  }

  // 如果有會議摘要或 SMS,新增編輯按鈕
  if (analysisResult.summary || analysisResult.smsText) {
    actionButtons.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "編輯會議摘要與簡訊",
        emoji: true,
      },
      url: `${webAppUrl}/conversations/${conversationId}`,
    });
  }

  blocks.push({
    type: "actions",
    elements: actionButtons,
  });

  return blocks;
}

/**
 * 構建處理失敗通知 Blocks
 */
export function buildProcessingFailedBlocks(
  fileName: string,
  errorMessage: string,
  caseNumber?: string,
  retryCount?: number
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "❌ 音檔處理失敗",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*檔案名稱:*\n${fileName}`,
        },
      ],
    },
  ];

  if (caseNumber) {
    const sectionBlock = blocks[1];
    if (
      sectionBlock &&
      sectionBlock.type === "section" &&
      "fields" in sectionBlock
    ) {
      sectionBlock.fields?.push({
        type: "mrkdwn",
        text: `*案件編號:*\n${caseNumber}`,
      });
    }
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*錯誤訊息:*\n\`\`\`${errorMessage}\`\`\``,
    },
  });

  const retryInfo =
    retryCount !== undefined
      ? `目前重試次數: ${retryCount}/3`
      : "系統會自動重試最多 3 次";

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `💡 請檢查音檔格式和大小,或稍後再試。${retryInfo}`,
      },
    ],
  });

  return blocks;
}

/**
 * 根據資格狀態返回對應的 emoji
 */
function getStatusEmoji(status: string): string {
  const statusMap: Record<string, string> = {
    qualified: "🟢",
    "partially-qualified": "🟡",
    unqualified: "🔴",
    "needs-nurturing": "🟠",
  };

  return statusMap[status.toLowerCase()] || "⚪";
}

/**
 * 根據風險嚴重程度返回對應的 emoji
 */
function getSeverityEmoji(severity: string): string {
  const severityMap: Record<string, string> = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };

  return severityMap[severity.toLowerCase()] || "🟡";
}
