/**
 * /opportunity 指令處理器
 *
 * 用法:
 *   /opportunity list - 列出所有商機
 *   /opportunity <opportunity_id> - 查看特定商機詳情
 *   /opportunity create <公司名稱> - 建立新商機
 *   /opportunity help - 顯示幫助訊息
 */

import type { CommandContext } from "./index";
import type { Env } from "../types";
import type { SlackClient } from "../utils/slack-client";
import { ApiClient } from "../api-client";
import {
  buildOpportunityCardBlocks,
  buildOpportunityListBlocks,
} from "../blocks/opportunity-card";

/**
 * 處理 /opportunity 指令
 */
export async function handleOpportunityCommand(
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
          blocks: buildOpportunityHelpBlocks(),
        });
        break;

      case "list":
        await handleOpportunityList(ctx, apiClient, slackClient);
        break;

      case "create":
        await handleOpportunityCreate(
          ctx,
          args.slice(1),
          apiClient,
          slackClient
        );
        break;

      default:
        // 假設是 opportunity_id
        await handleOpportunityDetail(ctx, subcommand, apiClient, slackClient);
    }
  } catch (error) {
    console.error("Error handling opportunity command:", error);

    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:x: 執行指令時發生錯誤: ${error instanceof Error ? error.message : "未知錯誤"}`,
    });
  }
}

/**
 * 列出所有商機
 */
async function handleOpportunityList(
  ctx: CommandContext,
  apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  const result = await apiClient.getOpportunities({ limit: 10 });

  if (result.opportunities.length === 0) {
    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: ":information_source: 目前沒有商機資料",
    });
    return;
  }

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "in_channel",
    blocks: buildOpportunityListBlocks(result.opportunities),
  });
}

/**
 * 查看特定商機詳情
 */
async function handleOpportunityDetail(
  ctx: CommandContext,
  opportunityId: string,
  apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  const opportunity = await apiClient.getOpportunityById(opportunityId);

  if (!opportunity) {
    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:warning: 找不到商機 ID: ${opportunityId}`,
    });
    return;
  }

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "in_channel",
    blocks: buildOpportunityCardBlocks(opportunity),
  });
}

/**
 * 建立新商機
 */
async function handleOpportunityCreate(
  ctx: CommandContext,
  args: string[],
  apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  const companyName = args.join(" ").trim();

  if (!companyName) {
    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: ":warning: 請提供公司名稱。用法: `/opportunity create <公司名稱>`",
    });
    return;
  }

  // 自動產生客戶編號
  const now = new Date();
  const customerNumber = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getTime()).slice(-6)}`;

  const newOpportunity = await apiClient.createOpportunity({
    customerNumber,
    companyName,
    status: "new",
    source: "slack",
  });

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "in_channel",
    text: `:white_check_mark: 已建立新商機: *${newOpportunity.companyName}*\n客戶編號: \`${newOpportunity.customerNumber}\`\nID: \`${newOpportunity.id}\``,
  });
}

/**
 * 建立 /opportunity 指令的幫助訊息
 */
function buildOpportunityHelpBlocks(): object[] {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🏢 /opportunity 指令說明",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "使用 `/opportunity` 指令管理銷售商機。",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*用法:*\n• `/opportunity list` - 列出所有商機\n• `/opportunity <id>` - 查看特定商機詳情\n• `/opportunity create <公司名稱>` - 建立新商機\n• `/opportunity help` - 顯示此幫助訊息",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*範例:*\n• `/opportunity list`\n• `/opportunity abc123`\n• `/opportunity create 台積電`",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: ":bulb: 提示: 建立商機後可以上傳對話音檔進行 MEDDIC 分析",
        },
      ],
    },
  ];
}
