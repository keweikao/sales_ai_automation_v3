/**
 * /talktrack 指令處理器
 *
 * 用法:
 *   /talktrack 價格 - 查看價格異議相關話術
 *   /talktrack 老闆 - 查看需要老闆決定相關話術
 *   /talktrack 轉換 - 查看擔心轉換麻煩相關話術
 *   /talktrack 競品 - 查看已有其他系統相關話術
 *   /talktrack 考慮 - 查看要再考慮相關話術
 *   /talktrack 搜尋 [關鍵字] - 關鍵字搜尋話術
 *   /talktrack help - 顯示幫助訊息
 */

import { ApiClient } from "../api-client";
import type { Env } from "../types";
import type { SlackClient } from "../utils/slack-client";
import type { CommandContext } from "./index";

interface TalkTrack {
  id: string;
  situation: string;
  customerType: string | null;
  storeType: string | null;
  talkTrack: string;
  context: string | null;
  expectedOutcome: string | null;
  successRate: number | null;
  usageCount: number | null;
  tags: string[] | null;
}

// 情境關鍵字對應表
const SITUATION_KEYWORDS: Record<string, string> = {
  價格: "價格異議",
  太貴: "價格異議",
  成本: "價格異議",
  老闆: "需要老闆決定",
  決策: "需要老闆決定",
  做不了主: "需要老闆決定",
  轉換: "擔心轉換麻煩",
  麻煩: "擔心轉換麻煩",
  換系統: "擔心轉換麻煩",
  競品: "已有其他系統",
  其他系統: "已有其他系統",
  已經用: "已有其他系統",
  考慮: "要再考慮",
  想想: "要再考慮",
  再說: "要再考慮",
};

/**
 * 處理 /talktrack 指令
 */
export async function handleTalkTrackCommand(
  ctx: CommandContext,
  env: Env,
  slackClient: SlackClient
): Promise<void> {
  const args = ctx.text.trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase() ?? "";
  const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);

  try {
    // 處理 help
    if (subcommand === "help" || subcommand === "") {
      await slackClient.respondToUrl(ctx.responseUrl, {
        response_type: "ephemeral",
        blocks: buildHelpBlocks(),
      });
      return;
    }

    // 處理搜尋
    if (subcommand === "搜尋" || subcommand === "search") {
      const keyword = args.slice(1).join(" ");
      if (!keyword) {
        await slackClient.respondToUrl(ctx.responseUrl, {
          response_type: "ephemeral",
          text: ":warning: 請輸入搜尋關鍵字。例如: `/talktrack 搜尋 ROI`",
        });
        return;
      }
      await handleSearch(ctx, keyword, apiClient, slackClient);
      return;
    }

    // 嘗試匹配情境關鍵字
    const situation = matchSituation(ctx.text);
    if (situation) {
      await handleGetBySituation(ctx, situation, apiClient, slackClient);
      return;
    }

    // 未匹配到，嘗試搜尋
    await handleSearch(ctx, ctx.text, apiClient, slackClient);
  } catch (error) {
    console.error("Error handling talktrack command:", error);

    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:x: 執行指令時發生錯誤: ${error instanceof Error ? error.message : "未知錯誤"}`,
    });
  }
}

/**
 * 匹配情境關鍵字
 */
function matchSituation(text: string): string | null {
  const normalizedText = text.toLowerCase();

  for (const [keyword, situation] of Object.entries(SITUATION_KEYWORDS)) {
    if (normalizedText.includes(keyword)) {
      return situation;
    }
  }

  return null;
}

/**
 * 依情境取得話術
 */
async function handleGetBySituation(
  ctx: CommandContext,
  situation: string,
  apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  const talkTracks = await apiClient.getTalkTracksBySituation(situation);

  if (talkTracks.length === 0) {
    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:mag: 找不到「${situation}」相關的話術。`,
    });
    return;
  }

  const blocks = buildTalkTracksBlocks(situation, talkTracks);

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "ephemeral",
    blocks,
  });
}

/**
 * 搜尋話術
 */
async function handleSearch(
  ctx: CommandContext,
  keyword: string,
  apiClient: ApiClient,
  slackClient: SlackClient
): Promise<void> {
  const talkTracks = await apiClient.searchTalkTracks(keyword);

  if (talkTracks.length === 0) {
    await slackClient.respondToUrl(ctx.responseUrl, {
      response_type: "ephemeral",
      text: `:mag: 找不到包含「${keyword}」的話術。\n\n可用的情境關鍵字: 價格、老闆、轉換、競品、考慮`,
    });
    return;
  }

  const blocks = buildSearchResultBlocks(keyword, talkTracks);

  await slackClient.respondToUrl(ctx.responseUrl, {
    response_type: "ephemeral",
    blocks,
  });
}

/**
 * 建立話術列表 Block UI
 */
function buildTalkTracksBlocks(
  situation: string,
  talkTracks: TalkTrack[]
): object[] {
  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🎯 ${situation}`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `共 ${talkTracks.length} 筆話術`,
        },
      ],
    },
    {
      type: "divider",
    },
  ];

  for (const track of talkTracks.slice(0, 3)) {
    blocks.push(...buildSingleTalkTrackBlocks(track));
  }

  if (talkTracks.length > 3) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `...還有 ${talkTracks.length - 3} 筆話術，使用更精確的關鍵字查看更多`,
        },
      ],
    });
  }

  return blocks;
}

/**
 * 建立搜尋結果 Block UI
 */
function buildSearchResultBlocks(
  keyword: string,
  talkTracks: TalkTrack[]
): object[] {
  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🔍 搜尋結果: ${keyword}`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `找到 ${talkTracks.length} 筆相關話術`,
        },
      ],
    },
    {
      type: "divider",
    },
  ];

  for (const track of talkTracks.slice(0, 3)) {
    blocks.push(...buildSingleTalkTrackBlocks(track));
  }

  return blocks;
}

/**
 * 建立單一話術 Block
 */
function buildSingleTalkTrackBlocks(track: TalkTrack): object[] {
  const customerTypeLabel = track.customerType
    ? ` - ${track.customerType}`
    : "";

  // 截斷話術內容（Slack 有字數限制）
  const truncatedContent =
    track.talkTrack.length > 500
      ? `${track.talkTrack.slice(0, 500)}...`
      : track.talkTrack;

  const blocks: object[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${track.situation}${customerTypeLabel}*`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: truncatedContent,
      },
    },
  ];

  // 加入使用情境和預期效果
  const metaFields: { type: string; text: string }[] = [];

  if (track.context) {
    metaFields.push({
      type: "mrkdwn",
      text: `💡 *情境*: ${track.context.slice(0, 100)}`,
    });
  }

  if (track.expectedOutcome) {
    metaFields.push({
      type: "mrkdwn",
      text: `✅ *效果*: ${track.expectedOutcome.slice(0, 100)}`,
    });
  }

  if (metaFields.length > 0) {
    blocks.push({
      type: "context",
      elements: metaFields,
    });
  }

  // 加入統計資訊
  const statsText: string[] = [];
  if (track.usageCount !== null && track.usageCount > 0) {
    statsText.push(`使用 ${track.usageCount} 次`);
  }
  if (track.successRate !== null) {
    statsText.push(`成功率 ${track.successRate}%`);
  }

  if (statsText.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📊 ${statsText.join(" | ")}`,
        },
      ],
    });
  }

  blocks.push({
    type: "divider",
  });

  return blocks;
}

/**
 * 建立幫助訊息 Block UI
 */
function buildHelpBlocks(): object[] {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🎯 /talktrack 話術查詢指令",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "快速查詢銷售話術，應對各種客戶異議。",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*情境查詢:*\n• `/talktrack 價格` - 價格異議話術\n• `/talktrack 老闆` - 需要老闆決定話術\n• `/talktrack 轉換` - 擔心轉換麻煩話術\n• `/talktrack 競品` - 已有其他系統話術\n• `/talktrack 考慮` - 要再考慮話術",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*關鍵字搜尋:*\n• `/talktrack 搜尋 ROI` - 搜尋包含 ROI 的話術\n• `/talktrack 搜尋 試用` - 搜尋包含試用的話術",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "💡 話術會根據成功率和使用次數排序，最有效的話術會優先顯示",
        },
      ],
    },
  ];
}
