/**
 * Slack 事件處理器入口
 */

import type { Env, SlackEvent } from "../types";
import { handleFileSharedEvent } from "./file";
import { handleMessageEvent } from "./message";

/**
 * 處理 Slack 事件
 */
export async function handleSlackEvent(
  event: SlackEvent,
  env: Env
): Promise<void> {
  try {
    switch (event.type) {
      case "message":
        // 忽略 bot 訊息和子類型訊息（如編輯、刪除等）
        if (!(event.bot_id || event.subtype)) {
          await handleMessageEvent(event, env);
        }
        break;

      case "file_shared":
        await handleFileSharedEvent(event, env);
        break;

      case "app_mention":
        // 處理 @bot 提及
        await handleAppMention(event, env);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error handling event ${event.type}:`, error);
  }
}

/**
 * 處理 @bot 提及事件
 */
async function handleAppMention(event: SlackEvent, env: Env): Promise<void> {
  const { SlackClient } = await import("../utils/slack-client");
  const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);

  const helpText = `嗨！我是 Sales AI Bot 👋

我可以幫助你分析銷售對話和管理商機。

*可用指令:*
• \`/analyze <conversation_id>\` - 對銷售對話進行 MEDDIC 分析
• \`/opportunity list\` - 列出所有商機
• \`/opportunity <id>\` - 查看特定商機詳情
• \`/opportunity create <公司名稱>\` - 建立新商機
• \`/report dashboard\` - 查看銷售儀表板
• \`/report trends\` - 查看 MEDDIC 趨勢

你也可以直接上傳音檔，我會自動進行轉錄和分析！`;

  await slackClient.postMessage({
    channel: event.channel,
    text: helpText,
    thread_ts: event.ts,
  });
}
