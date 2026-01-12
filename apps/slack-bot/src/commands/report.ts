/**
 * /report 指令處理器
 *
 * 用法:
 *   /report dashboard - 顯示整體銷售儀表板
 *   /report trends - 顯示 MEDDIC 趨勢分析
 *   /report help - 顯示幫助訊息
 */

import type { CommandContext } from "./index";
import type {
  Env,
  OpportunityStatsResponse,
  MeddicTrendsResponse,
} from "../types";
import type { SlackClient } from "../utils/slack-client";
import { ApiClient } from "../api-client";

/**
 * 處理 /report 指令
 */
export async function handleReportCommand(
  ctx: CommandContext,
  env: Env,
  slackClient: SlackClient
): Promise<void> {
  const args = ctx.text.trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase() ?? "";
  const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);

  try {
    switch (subcommand) {
      case "help":
      case "":
        await slackClient.respondToUrl(ctx.responseUrl, {
          response_type: "ephemeral",
          blocks: buildReportHelpBlocks(),
        });
        break;

      case "dashboard":
        await handleDashboard(ctx, apiClient, slackClient);
        break;

      case "trends":
        await handleTrends(ctx, apiClient, slackClient);
        break;

      default:
        await slackClient.respondToUrl(ctx.responseUrl, {
          response_type: "ephemeral",
          text: `:warning: 未知的子指令: ${subcommand}。使用 \`/report help\` 查看可用指令。`,
        });
    }
  } catch (error) {
    console.error("Error handling report command:", error);

    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:x: 執行指令時發生錯誤: ${error instanceof Error ? error.message : "未知錯誤"}`,
    });
  }
}

/**
 * 顯示銷售儀表板
 */
async function handleDashboard(
  ctx: CommandContext,
  apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  const stats = await apiClient.getOpportunityStats();

  const blocks = buildDashboardBlocks(stats);

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "in_channel",
    blocks,
  });
}

/**
 * 顯示 MEDDIC 趨勢
 */
async function handleTrends(
  ctx: CommandContext,
  apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  const trends = await apiClient.getMeddicTrends();

  const blocks = buildTrendsBlocks(trends);

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "in_channel",
    blocks,
  });
}

/**
 * 建立儀表板 Block UI
 */
function buildDashboardBlocks(stats: OpportunityStatsResponse): object[] {
  const statusText = Object.entries(stats.byStatus)
    .map(([status, count]) => `• ${formatStatus(status)}: ${count}`)
    .join("\n");

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📈 銷售儀表板",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*總商機數*\n${stats.total}`,
        },
        {
          type: "mrkdwn",
          text: `*平均 MEDDIC 分數*\n${stats.averageMeddicScore.toFixed(1)}/100`,
        },
        {
          type: "mrkdwn",
          text: `*近期活動*\n${stats.recentActivity} 筆`,
        },
        {
          type: "mrkdwn",
          text: `*分數等級*\n${getScoreGrade(stats.averageMeddicScore)}`,
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
        text: `*按狀態統計*\n${statusText}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:clock1: 更新時間: ${new Date().toLocaleString("zh-TW")}`,
        },
      ],
    },
  ];
}

/**
 * 建立趨勢分析 Block UI
 */
function buildTrendsBlocks(trends: MeddicTrendsResponse): object[] {
  const trendEmoji = getTrendEmoji(trends.trend);
  const scores = trends.averageScores;

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 MEDDIC 趨勢分析",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*期間:* ${trends.period}\n*趨勢:* ${trendEmoji} ${formatTrend(trends.trend)} (${trends.changePercent > 0 ? "+" : ""}${trends.changePercent.toFixed(1)}%)`,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*各維度平均分數:*",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*M* Metrics\n${getScoreBar(scores.metrics)} ${scores.metrics.toFixed(1)}/5`,
        },
        {
          type: "mrkdwn",
          text: `*E* Economic Buyer\n${getScoreBar(scores.economicBuyer)} ${scores.economicBuyer.toFixed(1)}/5`,
        },
        {
          type: "mrkdwn",
          text: `*D* Decision Criteria\n${getScoreBar(scores.decisionCriteria)} ${scores.decisionCriteria.toFixed(1)}/5`,
        },
        {
          type: "mrkdwn",
          text: `*D* Decision Process\n${getScoreBar(scores.decisionProcess)} ${scores.decisionProcess.toFixed(1)}/5`,
        },
        {
          type: "mrkdwn",
          text: `*I* Identify Pain\n${getScoreBar(scores.identifyPain)} ${scores.identifyPain.toFixed(1)}/5`,
        },
        {
          type: "mrkdwn",
          text: `*C* Champion\n${getScoreBar(scores.champion)} ${scores.champion.toFixed(1)}/5`,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: ":bulb: 提示: 專注於分數較低的維度以提升整體銷售效率",
        },
      ],
    },
  ];
}

/**
 * 建立 /report 指令的幫助訊息
 */
function buildReportHelpBlocks(): object[] {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 /report 指令說明",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "使用 `/report` 指令查看銷售報表和分析。",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*用法:*\n• `/report dashboard` - 顯示整體銷售儀表板\n• `/report trends` - 顯示 MEDDIC 趨勢分析\n• `/report help` - 顯示此幫助訊息",
      },
    },
  ];
}

// Helper functions
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    new: "🆕 新建",
    contacted: "📞 已聯繫",
    qualified: "✅ 已合格",
    proposal: "📝 報價中",
    negotiation: "🤝 議價中",
    won: "🎉 成交",
    lost: "❌ 流失",
  };
  return statusMap[status] ?? status;
}

function getScoreGrade(score: number): string {
  if (score >= 80) {
    return "🏆 優秀";
  }
  if (score >= 60) {
    return "👍 良好";
  }
  if (score >= 40) {
    return "📈 待提升";
  }
  return "⚠️ 需加強";
}

function getTrendEmoji(trend: "up" | "down" | "stable"): string {
  switch (trend) {
    case "up":
      return "📈";
    case "down":
      return "📉";
    default:
      return "➡️";
  }
}

function formatTrend(trend: "up" | "down" | "stable"): string {
  switch (trend) {
    case "up":
      return "上升";
    case "down":
      return "下降";
    default:
      return "持平";
  }
}

function getScoreBar(score: number): string {
  const filled = Math.round(score);
  const empty = 5 - filled;
  return "▓".repeat(filled) + "░".repeat(empty);
}
