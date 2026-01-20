import type { OpportunityResponse } from "../types";

/**
 * 產生單一商機卡片的 Slack Block UI
 */
export function buildOpportunityCardBlocks(
  opportunity: OpportunityResponse
): object[] {
  const statusInfo = getStatusInfo(opportunity.status);

  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🏢 ${opportunity.companyName}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*客戶編號*\n${opportunity.customerNumber}`,
        },
        {
          type: "mrkdwn",
          text: `*狀態*\n${statusInfo.emoji} ${statusInfo.label}`,
        },
        {
          type: "mrkdwn",
          text: `*聯絡人*\n${opportunity.contactName ?? "未設定"}`,
        },
        {
          type: "mrkdwn",
          text: `*Email*\n${opportunity.contactEmail ?? "未設定"}`,
        },
      ],
    },
  ];

  // 額外資訊
  if (opportunity.contactPhone || opportunity.industry) {
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*電話*\n${opportunity.contactPhone ?? "未設定"}`,
        },
        {
          type: "mrkdwn",
          text: `*產業*\n${opportunity.industry ?? "未設定"}`,
        },
      ],
    });
  }

  // 如果有 MEDDIC 分數
  if (
    opportunity.latestMeddicScore !== undefined &&
    opportunity.latestMeddicScore !== null
  ) {
    blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*最新 MEDDIC 評分: ${opportunity.latestMeddicScore}/100* ${getScoreEmoji(opportunity.latestMeddicScore)}`,
        },
      }
    );
  }

  // 對話數量
  if (opportunity.conversationCount !== undefined) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*對話記錄:* ${opportunity.conversationCount} 筆`,
      },
    });
  }

  // 備註
  if (opportunity.notes) {
    blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*備註*\n${opportunity.notes}`,
        },
      }
    );
  }

  // Action buttons
  blocks.push(
    {
      type: "divider",
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📊 查看對話",
            emoji: true,
          },
          action_id: "view_opportunity_conversations",
          value: opportunity.id,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📤 上傳音檔",
            emoji: true,
          },
          action_id: "upload_conversation",
          value: opportunity.id,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `ID: \`${opportunity.id}\` | 來源: ${formatSource(opportunity.source)} | 建立於 ${formatDate(opportunity.createdAt)}`,
        },
      ],
    }
  );

  return blocks;
}

/**
 * 產生商機列表的 Slack Block UI
 */
export function buildOpportunityListBlocks(
  opportunities: OpportunityResponse[]
): object[] {
  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🏢 商機列表",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `共 ${opportunities.length} 筆商機`,
      },
    },
    {
      type: "divider",
    },
  ];

  // Add each opportunity as a compact row
  for (const opportunity of opportunities) {
    const statusInfo = getStatusInfo(opportunity.status);
    const scoreText =
      opportunity.latestMeddicScore !== undefined &&
      opportunity.latestMeddicScore !== null
        ? `MEDDIC: ${opportunity.latestMeddicScore}/100`
        : "未評分";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusInfo.emoji} *${opportunity.companyName}*\n${opportunity.customerNumber} | ${opportunity.contactName ?? "無聯絡人"} | ${scoreText}`,
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "查看詳情",
          emoji: true,
        },
        action_id: "view_opportunity_detail",
        value: opportunity.id,
      },
    });
  }

  blocks.push(
    {
      type: "divider",
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: ":bulb: 使用 `/opportunity <ID>` 查看完整詳情",
        },
      ],
    }
  );

  return blocks;
}

/**
 * 產生簡化版商機卡片（用於通知）
 */
export function buildOpportunityCompactBlocks(
  opportunity: OpportunityResponse
): object[] {
  const statusInfo = getStatusInfo(opportunity.status);

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusInfo.emoji} *${opportunity.companyName}*\n${opportunity.customerNumber} | ${opportunity.contactName ?? "無聯絡人"} | ${opportunity.contactEmail ?? ""}`,
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "查看",
          emoji: true,
        },
        action_id: "view_opportunity_detail",
        value: opportunity.id,
      },
    },
  ];
}

// Helper functions

interface StatusInfo {
  emoji: string;
  label: string;
}

function getStatusInfo(status: string): StatusInfo {
  const statusMap: Record<string, StatusInfo> = {
    new: { emoji: "🆕", label: "新建立" },
    contacted: { emoji: "📞", label: "已聯繫" },
    qualified: { emoji: "✅", label: "已合格" },
    proposal: { emoji: "📝", label: "報價中" },
    negotiation: { emoji: "🤝", label: "議價中" },
    won: { emoji: "🎉", label: "成交" },
    lost: { emoji: "❌", label: "流失" },
  };

  return statusMap[status] ?? { emoji: "⚪", label: status };
}

function formatSource(source: string): string {
  const sourceMap: Record<string, string> = {
    manual: "🖊️ 手動建立",
    import: "📥 匯入",
    api: "🔗 API",
    referral: "👋 轉介",
    slack: "💬 Slack",
  };

  return sourceMap[source] ?? source;
}

function getScoreEmoji(score: number): string {
  if (score >= 70) {
    return "🟢";
  }
  if (score >= 40) {
    return "🟡";
  }
  return "🔴";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
