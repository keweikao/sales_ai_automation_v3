/**
 * 立即發送 Daily Health Report 和 Weekly Report 到指定 Slack 頻道
 *
 * 執行方式：
 * SLACK_BOT_TOKEN=xoxb-xxx bun run scripts/send-reports-now.ts
 *
 * 或設定環境變數後執行：
 * export SLACK_BOT_TOKEN=xoxb-xxx
 * bun run scripts/send-reports-now.ts
 */

import { neon } from "@neondatabase/serverless";
import { WebClient } from "@slack/web-api";
import "dotenv/config";

// 載入 apps/server/.env 的 DATABASE_URL
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_ZkASu5qnc9vB@ep-sparkling-band-a130c5ks-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const TARGET_CHANNEL = "C0A7C2HUXRR";

if (!SLACK_BOT_TOKEN) {
  console.error("❌ ERROR: SLACK_BOT_TOKEN is not set");
  console.error("");
  console.error("請設定 SLACK_BOT_TOKEN 環境變數後再執行：");
  console.error("  SLACK_BOT_TOKEN=xoxb-xxx bun run scripts/send-reports-now.ts");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const slackClient = new WebClient(SLACK_BOT_TOKEN);

async function sendDailyHealthReport() {
  console.log("📊 正在生成 Daily Health Report...");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const stats = await sql`
    SELECT
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
      AVG(
        CASE WHEN status = 'completed' AND updated_at IS NOT NULL AND created_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (updated_at - created_at))
        END
      ) as avg_processing_time
    FROM conversations
    WHERE created_at >= ${yesterday.toISOString()}
  `;

  const result = stats[0] || {
    completed_count: 0,
    failed_count: 0,
    avg_processing_time: null,
  };

  const total =
    Number(result.completed_count) + Number(result.failed_count) || 1;
  const successRate = Math.round(
    (Number(result.completed_count) / total) * 100
  );

  const healthEmoji =
    successRate >= 95 ? "🟢" : successRate >= 80 ? "🟡" : "🔴";

  const message = [
    `${healthEmoji} *每日系統健康報告*`,
    `📅 ${new Date().toLocaleDateString("zh-TW")}`,
    "",
    "*過去 24 小時處理統計*",
    `• 完成: ${result.completed_count} 筆`,
    `• 失敗: ${result.failed_count} 筆`,
    `• 成功率: ${successRate}%`,
    result.avg_processing_time
      ? `• 平均處理時間: ${Math.round(Number(result.avg_processing_time))}s`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  await slackClient.chat.postMessage({
    channel: TARGET_CHANNEL,
    text: message,
  });

  console.log("✅ Daily Health Report 已發送");
}

async function sendWeeklyReport() {
  console.log("📊 正在生成 Weekly Report...");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // MTD 開始日期（本月1號）
  const mtdStart = new Date(year, month - 1, 1);

  // 本週開始日期（週日）
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // 本週結束日期（週六）
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // 查詢各業務上傳統計
  const repStats = await sql`
    SELECT
      u.name as user_name,
      COUNT(*) FILTER (WHERE c.created_at >= ${mtdStart.toISOString()}) as mtd_count,
      COUNT(*) FILTER (WHERE c.created_at >= ${weekStart.toISOString()}) as week_count
    FROM conversations c
    JOIN "user" u ON c.created_by = u.id
    WHERE c.created_at >= ${mtdStart.toISOString()}
      AND c.status = 'completed'
    GROUP BY u.id, u.name
    ORDER BY mtd_count DESC, week_count DESC
  `;

  // 總計
  const totals = await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= ${mtdStart.toISOString()}) as mtd_total,
      COUNT(*) FILTER (WHERE created_at >= ${weekStart.toISOString()}) as week_total
    FROM conversations
    WHERE created_at >= ${mtdStart.toISOString()}
      AND status = 'completed'
  `;

  const totalResult = totals[0] || { mtd_total: 0, week_total: 0 };

  // 格式化日期
  const weekStartStr = `${String(weekStart.getMonth() + 1).padStart(2, "0")}/${String(weekStart.getDate()).padStart(2, "0")}`;
  const weekEndStr = `${String(weekEnd.getMonth() + 1).padStart(2, "0")}/${String(weekEnd.getDate()).padStart(2, "0")}`;

  // 組裝訊息
  const rankEmojis = ["🥇", "🥈", "🥉"];
  const repLines = repStats.map((rep, index) => {
    const rank = index < 3 ? rankEmojis[index] : `${index + 1}.`;
    return `${rank} ${rep.user_name}: MTD ${rep.mtd_count} / 本週 ${rep.week_count}`;
  });

  const WEB_APP_URL = "https://sales-ai-web.pages.dev";

  const message = [
    `📊 *音檔上傳週報 (${year}/${String(month).padStart(2, "0")})*`,
    "",
    `📅 MTD 上傳總數: ${totalResult.mtd_total} 筆`,
    `📆 本週上傳 (${weekStartStr}-${weekEndStr}): ${totalResult.week_total} 筆`,
    "",
    "👥 *各業務上傳統計*",
    ...repLines,
    "",
    `🔗 <${WEB_APP_URL}/reports/mtd-uploads|查看詳細列表>`,
  ].join("\n");

  await slackClient.chat.postMessage({
    channel: TARGET_CHANNEL,
    text: message,
  });

  console.log("✅ Weekly Report 已發送");
}

async function main() {
  console.log("🚀 開始發送報告到 Slack 頻道:", TARGET_CHANNEL);
  console.log("");

  try {
    await sendDailyHealthReport();
    console.log("");
    await sendWeeklyReport();
    console.log("");
    console.log("✨ 所有報告已成功發送！");
  } catch (error) {
    console.error("❌ 發送失敗:", error);
    process.exit(1);
  }
}

main();
