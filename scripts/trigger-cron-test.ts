/**
 * 本地測試報告 - 直接呼叫 Slack API 發送測試報告
 * 需要設定環境變數：
 * - DATABASE_URL: Neon 資料庫連線字串
 * - SLACK_BOT_TOKEN: Slack Bot Token
 */

import { neon } from "@neondatabase/serverless";
import { WebClient } from "@slack/web-api";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || "https://sales-ai-web.pages.dev";

// Slack 頻道 ID (從 queue-worker 取得)
const SLACK_CHANNEL = "C0A7C2HUXRR";

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

if (!SLACK_BOT_TOKEN) {
  console.error("ERROR: SLACK_BOT_TOKEN is not set");
  console.error("請執行: export SLACK_BOT_TOKEN=xoxb-...");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const slackClient = new WebClient(SLACK_BOT_TOKEN);

// ============================================================
// Daily Health Report
// ============================================================
async function sendDailyHealthReport() {
  console.log("\n📊 發送每日健康報告...");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const stats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      COUNT(*) as total_count,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status = 'completed') as avg_processing_time
    FROM conversations
    WHERE created_at >= ${yesterday.toISOString()}
  `;

  const result = stats[0] || {
    completed_count: 0,
    failed_count: 0,
    total_count: 0,
    avg_processing_time: 0,
  };

  const successRate =
    Number(result.total_count) > 0
      ? Math.round(
          (Number(result.completed_count) / Number(result.total_count)) * 100
        )
      : 100;

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
    channel: SLACK_CHANNEL,
    text: message,
  });

  console.log("  ✅ 健康報告已發送");
}

// ============================================================
// Weekly Report
// ============================================================
async function sendWeeklyReport() {
  console.log("\n📊 發送每週週報...");

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
    channel: SLACK_CHANNEL,
    text: message,
  });

  console.log("  ✅ 週報已發送");
}

// ============================================================
// Daily Todo Reminder
// ============================================================
async function sendTodoReminder() {
  console.log("\n📋 發送每日 Todo 提醒...");

  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // 查詢今日 + 逾期的 pending 待辦
  const pendingTodos = await sql`
    SELECT
      t.id,
      t.user_id,
      t.title,
      t.description,
      t.due_date,
      t.opportunity_id,
      o.company_name,
      o.customer_number
    FROM sales_todos t
    LEFT JOIN opportunities o ON t.opportunity_id = o.id
    WHERE t.status = 'pending'
      AND t.due_date <= ${todayEnd.toISOString()}
  `;

  console.log(`  📝 找到 ${pendingTodos.length} 筆待處理事項`);

  if (pendingTodos.length === 0) {
    console.log("  ⚠️ 沒有待辦需要提醒");
    return;
  }

  // 查詢 userProfiles 取得 slackUserId 映射
  const userIds = [...new Set(pendingTodos.map((t) => t.user_id))];
  const profiles = await sql`
    SELECT user_id, slack_user_id
    FROM user_profiles
    WHERE user_id = ANY(${userIds})
  `;

  const userSlackMap = new Map<string, string>();
  for (const profile of profiles) {
    if (profile.slack_user_id) {
      userSlackMap.set(profile.user_id, profile.slack_user_id);
    }
  }

  // 按用戶分組
  const todosByUser = new Map<string, typeof pendingTodos>();
  for (const todo of pendingTodos) {
    const slackUserId = userSlackMap.get(todo.user_id);
    if (!slackUserId) {
      console.log(`  ⚠️ 用戶 ${todo.user_id} 沒有 Slack ID，跳過`);
      continue;
    }

    if (!todosByUser.has(slackUserId)) {
      todosByUser.set(slackUserId, []);
    }
    todosByUser.get(slackUserId)!.push(todo);
  }

  // 對每個用戶發送 Slack DM
  for (const [slackUserId, todos] of todosByUser) {
    // 分類待辦：逾期 vs 今日
    const overdueTodos = todos.filter(
      (t) => new Date(t.due_date) < todayStart
    );
    const todayTodos = todos.filter(
      (t) => new Date(t.due_date) >= todayStart
    );

    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📋 今日待辦提醒",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📅 ${now.toLocaleDateString("zh-TW")} | 共 ${todos.length} 項待處理`,
        },
      },
    ];

    // 逾期待辦
    if (overdueTodos.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `⚠️ *逾期待辦 (${overdueTodos.length} 項)*`,
        },
      });

      for (const todo of overdueTodos.slice(0, 5)) {
        const dueDate = new Date(todo.due_date);
        const daysOverdue = Math.floor(
          (todayStart.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const companyInfo = todo.company_name ? ` | ${todo.company_name}` : "";

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🔴 *${todo.title}*\n逾期 ${daysOverdue} 天${companyInfo}`,
          },
        });
      }
    }

    // 今日待辦
    if (todayTodos.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📌 *今日待辦 (${todayTodos.length} 項)*`,
        },
      });

      for (const todo of todayTodos.slice(0, 5)) {
        const companyInfo = todo.company_name ? ` | ${todo.company_name}` : "";

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🟡 *${todo.title}*${companyInfo}`,
          },
        });
      }
    }

    // 查看全部按鈕
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📋 查看所有待辦",
            emoji: true,
          },
          url: `${WEB_APP_URL}/todos`,
        },
      ],
    });

    try {
      await slackClient.chat.postMessage({
        channel: slackUserId,
        blocks,
        text: `📋 今日待辦提醒 - 您有 ${todos.length} 項待處理事項`,
      });
      console.log(`  ✅ 已發送 DM 給用戶 ${slackUserId} (${todos.length} 項)`);
    } catch (error) {
      console.error(`  ❌ 發送給 ${slackUserId} 失敗:`, error);
    }
  }

  console.log("  ✅ Todo 提醒已發送");
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log("🚀 開始測試所有報告...");
  console.log("=".repeat(60));

  try {
    await sendDailyHealthReport();
    await sendWeeklyReport();
    await sendTodoReminder();

    console.log("\n" + "=".repeat(60));
    console.log("✅ 所有報告已發送！請檢查 Slack 頻道和 DM。");
  } catch (error) {
    console.error("\n❌ 發送失敗:", error);
    process.exit(1);
  }
}

main();
