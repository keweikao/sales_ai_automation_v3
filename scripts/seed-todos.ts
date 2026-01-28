/**
 * Seed Todo 假資料
 * 用於測試每日 09:00 的 Todo 提醒功能
 */

import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// 產生 UUID
function generateId(): string {
  return crypto.randomUUID();
}

// 取得今天日期 (台灣時間 00:00:00)
function getTodayStart(): Date {
  const now = new Date();
  // 轉換為台灣時間
  const taiwanOffset = 8 * 60 * 60 * 1000;
  const taiwanNow = new Date(now.getTime() + taiwanOffset);
  taiwanNow.setUTCHours(0, 0, 0, 0);
  return taiwanNow;
}

// 取得昨天日期
function getYesterdayStart(): Date {
  const today = getTodayStart();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

async function seedTodos() {
  console.log("🌱 開始建立 Todo 假資料...\n");

  // Stephen 的 user ID
  const stephenUserId = "EcVY4mP1Jqaqr0IzO4H3No4wEUhq5q05";

  const today = getTodayStart();
  const yesterday = getYesterdayStart();

  console.log(`📅 今天日期 (UTC): ${today.toISOString()}`);
  console.log(`📅 昨天日期 (UTC): ${yesterday.toISOString()}\n`);

  // 定義假資料
  const todos = [
    {
      id: generateId(),
      userId: stephenUserId,
      title: "【測試】跟進王老闆餐廳合作案",
      description: "確認報價單，討論導入時程",
      dueDate: today,
      originalDueDate: today,
      status: "pending",
      source: "web",
    },
    {
      id: generateId(),
      userId: stephenUserId,
      title: "【測試】打電話給李先生確認需求",
      description: "確認 POS 系統需要的功能模組",
      dueDate: today,
      originalDueDate: today,
      status: "pending",
      source: "slack",
    },
    {
      id: generateId(),
      userId: stephenUserId,
      title: "【測試】逾期：回覆陳老闆報價問題",
      description: "這是逾期的待辦事項，用於測試逾期提醒",
      dueDate: yesterday,
      originalDueDate: yesterday,
      status: "pending",
      source: "web",
    },
  ];

  try {
    // 先清除舊的測試資料
    console.log("🗑️  清除舊的測試資料...");
    await sql`
      DELETE FROM sales_todos
      WHERE title LIKE '【測試】%'
    `;

    // 插入新資料
    console.log("📝 插入新的測試資料...\n");

    for (const todo of todos) {
      await sql`
        INSERT INTO sales_todos (
          id, user_id, title, description, due_date, original_due_date,
          status, source, reminder_sent, created_at, updated_at
        ) VALUES (
          ${todo.id},
          ${todo.userId},
          ${todo.title},
          ${todo.description},
          ${todo.dueDate.toISOString()},
          ${todo.originalDueDate.toISOString()},
          ${todo.status},
          ${todo.source},
          false,
          NOW(),
          NOW()
        )
      `;

      console.log(`✅ 已建立: ${todo.title}`);
      console.log(`   ID: ${todo.id}`);
      console.log(`   到期日: ${todo.dueDate.toISOString()}`);
      console.log("");
    }

    // 驗證資料
    console.log("🔍 驗證已建立的資料...\n");
    const result = await sql`
      SELECT id, title, due_date, status, reminder_sent
      FROM sales_todos
      WHERE user_id = ${stephenUserId}
        AND status = 'pending'
      ORDER BY due_date ASC
    `;

    console.log("📋 目前 pending 狀態的 Todo:");
    console.log("-".repeat(80));
    for (const row of result) {
      const dueDate = new Date(row.due_date);
      const isOverdue = dueDate < today;
      console.log(
        `${isOverdue ? "⚠️  [逾期]" : "📌"} ${row.title}`
      );
      console.log(`   到期: ${dueDate.toISOString()}`);
      console.log(`   提醒已發送: ${row.reminder_sent ? "是" : "否"}`);
      console.log("");
    }

    console.log("✅ Seed 完成！今天早上 09:00 (UTC+8) 應該會收到 Slack 通知。");
    console.log("\n💡 如果想立即測試，可以手動觸發 cron job:");
    console.log("   curl -X POST https://sales-ai-queue-worker.salesaiautomationv3.workers.dev/__scheduled?cron=0+1+*+*+*");

  } catch (error) {
    console.error("\n❌ 建立失敗:", error);
    process.exit(1);
  }
}

seedTodos();
