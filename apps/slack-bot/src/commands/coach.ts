/**
 * /coach 指令處理器
 *
 * 用法:
 *   /coach <conversation_id> - 取得對話的銷售教練建議
 *   /coach ask <conversation_id> <question> - 針對對話提問
 *   /coach tracks [category] - 查詢話術範本
 *   /coach followup <opportunity_id> <timing> - 排程跟進提醒
 *   /coach help - 顯示幫助訊息
 */

import { ApiClient } from "../api-client";
import type { Env } from "../types";
import type { SlackClient } from "../utils/slack-client";
import type { CommandContext } from "./index";

/**
 * 處理 /coach 指令
 */
export async function handleCoachCommand(
  ctx: CommandContext,
  env: Env,
  slackClient: SlackClient
): Promise<void> {
  const args = ctx.text.trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase() ?? "";

  // 顯示幫助
  if (subcommand === "help" || subcommand === "") {
    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      blocks: buildCoachHelpBlocks(),
    });
    return;
  }

  const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);

  try {
    switch (subcommand) {
      case "ask":
        await handleAskSubcommand(args.slice(1), ctx, apiClient, slackClient);
        break;

      case "tracks":
        await handleTracksSubcommand(
          args.slice(1),
          ctx,
          apiClient,
          slackClient
        );
        break;

      case "followup":
        await handleFollowupSubcommand(
          args.slice(1),
          ctx,
          apiClient,
          slackClient
        );
        break;

      default:
        // 預設為分析對話
        await handleAnalyzeSubcommand(subcommand, ctx, apiClient, slackClient);
    }
  } catch (error) {
    console.error("Error in coach command:", error);

    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:x: 執行失敗: ${error instanceof Error ? error.message : "未知錯誤"}`,
    });
  }
}

/**
 * 處理對話分析子指令
 */
async function handleAnalyzeSubcommand(
  conversationId: string,
  ctx: CommandContext,
  _apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "ephemeral",
    text: ":hourglass_flowing_sand: 正在分析對話並產生教練建議...",
  });

  // TODO: 呼叫 agent.analyze API
  // const result = await apiClient.analyzeWithCoach(conversationId);

  await slackClient.postMessage({
    channel: ctx.channelId,
    text: "Sales Coach 分析結果",
    blocks: buildCoachAnalysisBlocks(conversationId),
  });
}

/**
 * 處理提問子指令
 */
async function handleAskSubcommand(
  args: string[],
  ctx: CommandContext,
  _apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  if (args.length < 2) {
    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: ":warning: 用法: `/coach ask <conversation_id> <question>`",
    });
    return;
  }

  const conversationId = args[0];
  const question = args.slice(1).join(" ");

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "ephemeral",
    text: ":thinking_face: 正在思考您的問題...",
  });

  // TODO: 呼叫 agent.ask API
  // const answer = await apiClient.askCoach(conversationId, question);

  await slackClient.postMessage({
    channel: ctx.channelId,
    text: "Sales Coach 回答",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🎯 Sales Coach 回答",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*您的問題:*\n${question}`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*回答:*\nSales Coach 問答功能開發中，敬請期待！\n\n_對話 ID: ${conversationId}_`,
        },
      },
    ],
  });
}

/**
 * 處理話術查詢子指令
 */
async function handleTracksSubcommand(
  args: string[],
  ctx: CommandContext,
  _apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  const category = args[0] ?? "all";

  // TODO: 呼叫 agent.talkTracks API
  // const tracks = await apiClient.getTalkTracks({ category });

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📝 話術範本",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*分類:* ${category}\n\n話術知識庫功能開發中，敬請期待！`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*可用分類:*\n• `objection_handling` - 異議處理\n• `discovery` - 需求探索\n• `closing` - 成交話術\n• `follow_up` - 跟進話術\n• `value_prop` - 價值主張",
        },
      },
    ],
  });
}

/**
 * 處理跟進排程子指令
 */
async function handleFollowupSubcommand(
  args: string[],
  ctx: CommandContext,
  _apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  if (args.length < 2) {
    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: ":warning: 用法: `/coach followup <opportunity_id> <timing>`\n\n*時間選項:*\n• `2h` - 2 小時後\n• `tomorrow` - 明天早上 9 點\n• `3d` - 3 天後\n• `1w` - 1 週後",
    });
    return;
  }

  const opportunityId = args[0] ?? "";
  const timing = args[1] ?? "";

  // 驗證 timing 參數
  const validTimings = ["2h", "tomorrow", "3d", "1w"];
  if (!(timing && validTimings.includes(timing))) {
    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:warning: 無效的時間參數: ${timing}\n\n*有效選項:* ${validTimings.join(", ")}`,
    });
    return;
  }

  // TODO: 呼叫 agent.scheduleFollowUp API
  // const result = await apiClient.scheduleFollowUp({ opportunityId, timing });

  const timingMap: Record<string, string> = {
    "2h": "2 小時後",
    tomorrow: "明天早上 9 點",
    "3d": "3 天後",
    "1w": "1 週後",
  };

  const timingLabel = timing ? timingMap[timing] : "未指定";

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "ephemeral",
    text: `:white_check_mark: 已排程跟進提醒\n\n*商機 ID:* ${opportunityId}\n*時間:* ${timingLabel}\n\n_跟進排程功能開發中，此為模擬訊息_`,
  });
}

/**
 * 建立教練分析結果 blocks
 */
function buildCoachAnalysisBlocks(conversationId: string): object[] {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🎯 Sales Coach 分析結果",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*對話 ID:* ${conversationId}`,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📋 建議行動:*\nSales Coach 分析功能開發中，敬請期待！",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*💬 推薦話術:*\n話術推薦功能開發中，敬請期待！",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*⚠️ 警示:*\n暫無警示",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:bulb: 使用 \`/coach ask ${conversationId} <問題>\` 可以針對此對話提問`,
        },
      ],
    },
  ];
}

/**
 * 建立 /coach 指令的幫助訊息
 */
function buildCoachHelpBlocks(): object[] {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🎯 /coach 指令說明",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "使用 `/coach` 指令獲得 AI 銷售教練的即時建議和話術指導。",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*基本用法:*\n• `/coach <conversation_id>` - 分析對話並取得建議\n• `/coach help` - 顯示此幫助訊息",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*進階功能:*\n• `/coach ask <conversation_id> <問題>` - 針對對話提問\n• `/coach tracks [category]` - 查詢話術範本\n• `/coach followup <opportunity_id> <timing>` - 排程跟進提醒",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*話術分類:*\n• `objection_handling` - 異議處理\n• `discovery` - 需求探索\n• `closing` - 成交話術\n• `follow_up` - 跟進話術\n• `value_prop` - 價值主張",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*跟進時間:*\n• `2h` - 2 小時後\n• `tomorrow` - 明天早上 9 點\n• `3d` - 3 天後\n• `1w` - 1 週後",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: ":bulb: 提示: Sales Coach 會根據 MEDDIC 分析結果提供個人化建議",
        },
      ],
    },
  ];
}
