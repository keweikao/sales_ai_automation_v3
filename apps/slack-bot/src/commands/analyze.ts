/**
 * /analyze 指令處理器
 *
 * 用法:
 *   /analyze <conversation_id> - 分析指定對話的 MEDDIC 評分
 *   /analyze help - 顯示幫助訊息
 */

import type { CommandContext } from "./index";
import type { Env } from "../types";
import type { SlackClient } from "../utils/slack-client";
import { ApiClient } from "../api-client";
import { buildMeddicSummaryBlocks } from "../blocks/meddic-summary";

/**
 * 處理 /analyze 指令
 */
export async function handleAnalyzeCommand(
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
      blocks: buildAnalyzeHelpBlocks(),
    });
    return;
  }

  // 分析指定對話
  const conversationId = subcommand;
  const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);

  try {
    // 先取得對話資訊
    const conversation = await apiClient.getConversationById(conversationId);

    if (!conversation) {
      await slackClient.respondToUrl(ctx.responseUrl, {
        response_type: "ephemeral",
        text: `:warning: 找不到對話 ID: ${conversationId}`,
      });
      return;
    }

    // 執行 MEDDIC 分析
    const conversationTitle =
      conversation.title ?? `對話 ${conversation.caseNumber}`;

    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:hourglass_flowing_sand: 正在分析對話「${conversationTitle}」...`,
    });

    const analysis = await apiClient.analyzeConversation(conversationId);

    // 發送分析結果到頻道
    await slackClient.postMessage({
      channel: ctx.channelId,
      text: `MEDDIC 分析結果: ${conversationTitle}`,
      blocks: buildMeddicSummaryBlocks(analysis, conversationTitle),
    });
  } catch (error) {
    console.error("Error analyzing conversation:", error);

    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:x: 分析失敗: ${error instanceof Error ? error.message : "未知錯誤"}`,
    });
  }
}

/**
 * 建立 /analyze 指令的幫助訊息
 */
function buildAnalyzeHelpBlocks(): object[] {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 /analyze 指令說明",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "使用 `/analyze` 指令對銷售對話進行 MEDDIC 分析。",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*用法:*\n• `/analyze <conversation_id>` - 分析指定對話\n• `/analyze help` - 顯示此幫助訊息",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*MEDDIC 評估維度:*\n• *M*etrics - 量化指標\n• *E*conomic Buyer - 經濟決策者\n• *D*ecision Criteria - 決策標準\n• *D*ecision Process - 決策流程\n• *I*dentify Pain - 痛點識別\n• *C*hampion - 內部支持者",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: ":bulb: 提示: 對話 ID 可以從商機詳情頁面或上傳對話後取得",
        },
      ],
    },
  ];
}
