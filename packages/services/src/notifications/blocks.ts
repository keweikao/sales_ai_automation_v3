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
 * 構建處理完成通知 Blocks (簡要版)
 * 專為 Slack 推播設計，聚焦關鍵資訊：
 * - PDCM 快速診斷（4 維度分數）
 * - 關鍵痛點
 * - 建議策略與下一步行動
 * - 戰術建議話術
 * - PDCM+SPIN 警示
 */
export function buildProcessingCompletedBlocks(
  caseNumber: string,
  conversationId: string,
  analysisResult: MEDDICAnalysisResult,
  processingTimeMs: number,
  shareToken?: string
): KnownBlock[] {
  const processingTimeSec = (processingTimeMs / 1000).toFixed(1);
  const webAppUrl = process.env.WEB_APP_URL || "https://sales-ai-web.pages.dev";

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "✅ 分析完成",
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📋 案件編號: *${caseNumber}* | ⏱️ 處理時間: ${processingTimeSec}秒`,
        },
      ],
    },
  ];

  // ==========================================
  // Block: PDCM 快速診斷 (核心區塊)
  // ==========================================
  if (analysisResult.pdcmQuickDiagnosis) {
    const pdcm = analysisResult.pdcmQuickDiagnosis;
    const probabilityEmoji = getDealProbabilityEmoji(pdcm.dealProbability);
    const probabilityText = getDealProbabilityText(pdcm.dealProbability);

    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*📊 PDCM 快速診斷*\n" +
          `${probabilityEmoji} *成交機率: ${probabilityText}* (總分 ${pdcm.totalScore}/100)\n\n` +
          `${getScoreBar(pdcm.pain)} *P 痛點* ${pdcm.pain}/100\n` +
          `${getScoreBar(pdcm.decision)} *D 決策* ${pdcm.decision}/100\n` +
          `${getScoreBar(pdcm.champion)} *C 支持* ${pdcm.champion}/100\n` +
          `${getScoreBar(pdcm.metrics)} *M 量化* ${pdcm.metrics}/100`,
      },
    });
  } else {
    // 向下相容：使用舊的 overallScore
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*📊 MEDDIC 分數:*\n*${analysisResult.overallScore}/100*`,
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
    });
  }

  // ==========================================
  // Block: PDCM+SPIN 警示 (高優先級顯示)
  // ==========================================
  if (analysisResult.pdcmSpinAlerts) {
    const alerts = analysisResult.pdcmSpinAlerts;
    const triggeredAlerts: string[] = [];

    if (alerts.noMetrics.triggered) {
      triggeredAlerts.push(`⚠️ *Metrics 不足*: ${alerts.noMetrics.message}`);
    }
    if (alerts.shallowDiscovery.triggered) {
      triggeredAlerts.push(`⚠️ *挖掘不足*: ${alerts.shallowDiscovery.message}`);
    }
    if (alerts.noUrgency.triggered) {
      triggeredAlerts.push(`⚠️ *痛點不痛*: ${alerts.noUrgency.message}`);
    }

    if (triggeredAlerts.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: triggeredAlerts.join("\n"),
        },
      });
    }
  } else if (analysisResult.alerts && analysisResult.alerts.length > 0) {
    // 向下相容：使用舊的 alerts
    const alertsText = analysisResult.alerts
      .map((alert) => `⚠️ ${alert}`)
      .join("\n");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: alertsText,
      },
    });
  }

  // ==========================================
  // Block: 關鍵痛點
  // ==========================================
  const painPoints =
    analysisResult.keyPainPoints || analysisResult.painPoints || [];
  if (painPoints.length > 0) {
    blocks.push({ type: "divider" });
    const painPointsText = painPoints
      .slice(0, 3) // 最多顯示 3 個
      .map((point) => `• ${point}`)
      .join("\n");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*😟 關鍵痛點*\n${painPointsText}`,
      },
    });
  }

  // ==========================================
  // Block: 建議策略與下一步行動
  // ==========================================
  if (analysisResult.recommendedStrategy || analysisResult.nextAction) {
    blocks.push({ type: "divider" });

    let strategyText = "*🎯 建議策略*\n";

    if (analysisResult.recommendedStrategy) {
      const strategyEmoji = getStrategyEmoji(
        analysisResult.recommendedStrategy
      );
      const strategyLabel = getStrategyLabel(
        analysisResult.recommendedStrategy
      );
      strategyText += `${strategyEmoji} *${strategyLabel}*`;

      if (analysisResult.strategyReason) {
        strategyText += `\n_${analysisResult.strategyReason}_`;
      }
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: strategyText,
      },
    });

    if (analysisResult.nextAction) {
      const action = analysisResult.nextAction;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*✅ 下一步行動*\n" +
            `*${action.action}*\n` +
            `⏰ 時效: ${action.deadline}\n\n` +
            `💬 建議話術:\n>${action.suggestedScript}`,
        },
      });
    }
  }

  // ==========================================
  // Block: 戰術建議 (最重要的一個)
  // ==========================================
  if (analysisResult.topTacticalSuggestion) {
    const tactic = analysisResult.topTacticalSuggestion;
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*💡 戰術建議*\n" +
          `當客戶說「${tactic.trigger}」時:\n` +
          `*${tactic.suggestion}*\n\n` +
          `💬 話術:\n>${tactic.talkTrack}`,
      },
    });
  }

  // ==========================================
  // Block: 建議 SMS 跟進訊息
  // ==========================================
  if (analysisResult.smsText) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📱 *SMS 跟進訊息*\n>${analysisResult.smsText}`,
      },
    });
  }

  // ==========================================
  // Block: 操作按鈕
  // ==========================================
  blocks.push({ type: "divider" });

  const actionButtons: any[] = [
    {
      type: "button",
      text: {
        type: "plain_text",
        text: "📊 查看完整分析",
        emoji: true,
      },
      url: `${webAppUrl}/conversations/${conversationId}`,
      style: "primary",
    },
  ];

  // 如果有客戶電話和分享 token，新增「發送 SMS」按鈕
  if (analysisResult.contactPhone && shareToken) {
    actionButtons.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "📱 發送 SMS",
        emoji: true,
      },
      action_id: "send_customer_sms",
      value: JSON.stringify({
        conversationId,
        phoneNumber: analysisResult.contactPhone,
        shareToken,
      }),
    });
  }

  // 分享連結按鈕
  if (shareToken) {
    actionButtons.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "🔗 分享連結",
        emoji: true,
      },
      url: `${webAppUrl}/share/${shareToken}`,
    });
  }

  blocks.push({
    type: "actions",
    elements: actionButtons,
  });

  return blocks;
}

/**
 * 生成分數進度條視覺化
 */
function getScoreBar(score: number): string {
  if (score >= 80) return "🟢";
  if (score >= 60) return "🟡";
  if (score >= 40) return "🟠";
  return "🔴";
}

/**
 * 取得成交機率對應的 emoji
 */
function getDealProbabilityEmoji(
  probability: "high" | "medium" | "low"
): string {
  const emojiMap: Record<string, string> = {
    high: "🔥",
    medium: "🤔",
    low: "❄️",
  };
  return emojiMap[probability] || "❓";
}

/**
 * 取得成交機率對應的文字
 */
function getDealProbabilityText(
  probability: "high" | "medium" | "low"
): string {
  const textMap: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };
  return textMap[probability] || "未知";
}

/**
 * 取得建議策略對應的 emoji
 */
function getStrategyEmoji(
  strategy: "CloseNow" | "SmallStep" | "MaintainRelationship" | string
): string {
  const emojiMap: Record<string, string> = {
    CloseNow: "🔥",
    SmallStep: "👆",
    MaintainRelationship: "🤝",
  };
  return emojiMap[strategy] || "📋";
}

/**
 * 取得建議策略對應的標籤
 */
function getStrategyLabel(
  strategy: "CloseNow" | "SmallStep" | "MaintainRelationship" | string
): string {
  const labelMap: Record<string, string> = {
    CloseNow: "立即成交",
    SmallStep: "小步前進",
    MaintainRelationship: "維持關係",
  };
  return labelMap[strategy] || strategy;
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
