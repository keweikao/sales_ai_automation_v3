/**
 * Slack 指令處理器入口
 */

import type { Env } from "../types";
import { SlackClient } from "../utils/slack-client";
import { handleAnalyzeCommand } from "./analyze";
import { handleCoachCommand } from "./coach";
import { handleOpportunityCommand } from "./opportunity";
import { handleReportCommand } from "./report";
import { handleTalkTrackCommand } from "./talk-track";

export interface CommandContext {
  command: string;
  text: string;
  userId: string;
  channelId: string;
  responseUrl: string;
  triggerId: string;
}

/**
 * 處理 Slack 指令
 */
export async function handleSlackCommand(
  ctx: CommandContext,
  env: Env
): Promise<void> {
  const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);

  try {
    switch (ctx.command) {
      case "/analyze":
        await handleAnalyzeCommand(ctx, env, slackClient);
        break;

      case "/opportunity":
        await handleOpportunityCommand(ctx, env, slackClient);
        break;

      case "/report":
        await handleReportCommand(ctx, env, slackClient);
        break;

      case "/coach":
        await handleCoachCommand(ctx, env, slackClient);
        break;

      case "/talktrack":
        await handleTalkTrackCommand(ctx, env, slackClient);
        break;

      // 保留舊的 /lead 指令以向後兼容，重定向到 /opportunity
      case "/lead":
        await slackClient.respondToUrl(ctx.responseUrl, {
          response_type: "ephemeral",
          text: `:information_source: \`/lead\` 指令已更名為 \`/opportunity\`。請使用 \`/opportunity ${ctx.text}\` 來執行相同操作。`,
        });
        break;

      default:
        await slackClient.respondToUrl(ctx.responseUrl, {
          response_type: "ephemeral",
          text: `未知的指令: ${ctx.command}\n\n可用指令:\n• \`/analyze\` - MEDDIC 分析\n• \`/opportunity\` - 商機管理\n• \`/report\` - 報表查詢\n• \`/coach\` - AI 銷售教練\n• \`/talktrack\` - 話術查詢`,
        });
    }
  } catch (error) {
    console.error(`Error handling command ${ctx.command}:`, error);

    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:x: 執行指令時發生錯誤: ${error instanceof Error ? error.message : "未知錯誤"}`,
    });
  }
}
