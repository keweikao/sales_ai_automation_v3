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
  console.log(`[Event] Received event type: ${event.type}`);

  try {
    switch (event.type) {
      case "message":
        console.log(
          `[Event] Processing message event, bot_id: ${event.bot_id}, subtype: ${event.subtype}`
        );

        // 忽略 bot 訊息
        if (event.bot_id) {
          console.log("[Event] Ignoring bot message");
          break;
        }

        // 處理檔案分享訊息
        if (event.subtype === "file_share") {
          console.log(
            "[Event] Detected file_share subtype, processing as file upload"
          );
          // 檔案資訊在 message event 的 files 欄位中
          if (event.files && event.files.length > 0) {
            console.log(
              `[Event] Found ${event.files.length} file(s) in message`
            );
            // 處理第一個檔案 (通常使用者一次上傳一個音檔)
            const file = event.files[0];
            if (file) {
              await handleFileSharedEvent(
                {
                  type: "file_shared",
                  file_id: file.id,
                  user: event.user,
                  channel: event.channel,
                  ts: event.ts,
                  event_ts: event.ts,
                },
                env
              );
            }
          } else {
            console.log("[Event] file_share subtype but no files found");
          }
          break;
        }

        // 忽略其他子類型訊息（如編輯、刪除等）
        if (event.subtype) {
          console.log(
            `[Event] Ignoring message with subtype: ${event.subtype}`
          );
          break;
        }

        // 處理一般訊息
        await handleMessageEvent(event, env);
        break;

      case "file_shared":
        console.log(
          `[Event] Processing file_shared event, file_id: ${event.file_id}`
        );
        await handleFileSharedEvent(event, env);
        break;

      case "app_mention":
        console.log("[Event] Processing app_mention event");
        // 處理 @bot 提及
        await handleAppMention(event, env);
        break;

      default:
        console.log(`[Event] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Event] Error handling event ${event.type}:`, error);
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
