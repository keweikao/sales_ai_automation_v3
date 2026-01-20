import type { MeddicAnalysisResponse } from "../types";

/**
 * 產生 MEDDIC 分析結果的 Slack Block UI
 */
export function buildMeddicSummaryBlocks(
  analysis: MeddicAnalysisResponse,
  conversationTitle: string
): object[] {
  const statusEmoji = getStatusEmoji(analysis.status);
  const scoreColor = getScoreColor(analysis.overallScore);

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 MEDDIC 分析結果",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${conversationTitle}*\n${statusEmoji} 狀態: *${analysis.status}*`,
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "查看詳情",
          emoji: true,
        },
        action_id: "view_analysis_detail",
        value: analysis.id,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*總分: ${analysis.overallScore}/100* ${scoreColor}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*M* Metrics\n${getScoreBar(analysis.dimensions.metrics.score)} ${analysis.dimensions.metrics.score}/5`,
        },
        {
          type: "mrkdwn",
          text: `*E* Economic Buyer\n${getScoreBar(analysis.dimensions.economicBuyer.score)} ${analysis.dimensions.economicBuyer.score}/5`,
        },
        {
          type: "mrkdwn",
          text: `*D* Decision Criteria\n${getScoreBar(analysis.dimensions.decisionCriteria.score)} ${analysis.dimensions.decisionCriteria.score}/5`,
        },
        {
          type: "mrkdwn",
          text: `*D* Decision Process\n${getScoreBar(analysis.dimensions.decisionProcess.score)} ${analysis.dimensions.decisionProcess.score}/5`,
        },
        {
          type: "mrkdwn",
          text: `*I* Identify Pain\n${getScoreBar(analysis.dimensions.identifyPain.score)} ${analysis.dimensions.identifyPain.score}/5`,
        },
        {
          type: "mrkdwn",
          text: `*C* Champion\n${getScoreBar(analysis.dimensions.champion.score)} ${analysis.dimensions.champion.score}/5`,
        },
      ],
    },
    {
      type: "divider",
    },
    // 關鍵發現
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🔍 關鍵發現*\n${analysis.keyFindings.map((f) => `• ${f}`).join("\n")}`,
      },
    },
    // 下一步建議
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📋 下一步行動*\n${analysis.nextSteps.map((s) => `• ${s}`).join("\n")}`,
      },
    },
    // 風險提醒
    analysis.risks.length > 0
      ? {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*⚠️ 潛在風險*\n${analysis.risks.map((r) => `• ${r}`).join("\n")}`,
          },
        }
      : null,
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `分析 ID: ${analysis.id} | 由 Sales AI 自動生成`,
        },
      ],
    },
  ].filter(Boolean) as object[];
}

/**
 * 產生簡化版的 MEDDIC 摘要（用於 Thread 回覆）
 */
export function buildMeddicCompactBlocks(
  analysis: MeddicAnalysisResponse
): object[] {
  const statusEmoji = getStatusEmoji(analysis.status);

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusEmoji} *MEDDIC 評分: ${analysis.overallScore}/100*\n\`M:${analysis.dimensions.metrics.score} E:${analysis.dimensions.economicBuyer.score} D:${analysis.dimensions.decisionCriteria.score} D:${analysis.dimensions.decisionProcess.score} I:${analysis.dimensions.identifyPain.score} C:${analysis.dimensions.champion.score}\``,
      },
    },
  ];
}

// Helper functions
function getStatusEmoji(status: string): string {
  switch (status.toLowerCase()) {
    case "strong":
      return "🟢";
    case "medium":
      return "🟡";
    case "weak":
      return "🟠";
    case "at_risk":
    case "at risk":
      return "🔴";
    default:
      return "⚪";
  }
}

function getScoreColor(score: number): string {
  if (score >= 70) {
    return "🟢";
  }
  if (score >= 40) {
    return "🟡";
  }
  return "🔴";
}

function getScoreBar(score: number): string {
  const filled = Math.round(score);
  const empty = 5 - filled;
  return "▓".repeat(filled) + "░".repeat(empty);
}
