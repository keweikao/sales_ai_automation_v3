/**
 * Message 事件處理器
 *
 * 監聽頻道訊息，可擴展自動觸發功能
 */

import type { Env, SlackEvent } from "../types";
import { SlackClient } from "../utils/slack-client";

// 關鍵字觸發規則
const TRIGGER_KEYWORDS = {
  meddic: ["meddic", "銷售分析", "分析對話"],
  opportunity: ["商機", "opportunity", "客戶資料", "潛在客戶"],
  report: ["報表", "report", "儀表板", "dashboard"],
};

/**
 * 處理訊息事件
 */
export async function handleMessageEvent(
  event: SlackEvent,
  env: Env
): Promise<void> {
  const text = event.text?.toLowerCase() ?? "";
  const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);

  // 檢查是否包含關鍵字並提供協助提示
  for (const [category, keywords] of Object.entries(TRIGGER_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      const suggestion = getSuggestionForCategory(category);

      if (suggestion && shouldSendSuggestion(event)) {
        await slackClient.postMessage({
          channel: event.channel,
          text: suggestion,
          thread_ts: event.ts,
          unfurl_links: false,
        });
      }

      break;
    }
  }
}

/**
 * 根據關鍵字類別取得建議訊息
 */
function getSuggestionForCategory(category: string): string | null {
  switch (category) {
    case "meddic":
      return `:bulb: 需要進行 MEDDIC 分析嗎？使用 \`/analyze <conversation_id>\` 指令來分析銷售對話。`;

    case "opportunity":
      return `:bulb: 需要查看商機資料嗎？使用 \`/opportunity list\` 查看所有商機，或 \`/opportunity <id>\` 查看特定商機。`;

    case "report":
      return `:bulb: 需要查看報表嗎？使用 \`/report dashboard\` 查看銷售儀表板，或 \`/report trends\` 查看趨勢分析。`;

    default:
      return null;
  }
}

/**
 * 判斷是否應該發送建議
 * 避免過於頻繁的提示
 */
function shouldSendSuggestion(event: SlackEvent): boolean {
  // 只在非 thread 訊息時回應
  if (event.thread_ts) {
    return false;
  }

  // 可以加入更多邏輯，如：
  // - 檢查該用戶最近是否已收到提示
  // - 檢查頻道設定是否允許 bot 主動回應
  // - 加入冷卻時間

  // 目前簡單返回 false，避免過度打擾
  // 如需啟用自動提示，改為 return true
  return false;
}
