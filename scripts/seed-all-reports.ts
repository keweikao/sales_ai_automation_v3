/**
 * Seed 所有報告的假資料
 * 用於測試 Cron Job 通知功能：
 * - 每日健康報告 (08:00 UTC+8)
 * - 每週週報 (週一 08:00 UTC+8)
 * - 每日 Todo 提醒 (09:00 UTC+8)
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

// 取得日期 helper
function getDateOffset(daysOffset: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(10, 0, 0, 0); // 設定為早上 10 點
  return date;
}

// 隨機選擇
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// User Data
// ============================================================
const USERS = [
  { id: "EcVY4mP1Jqaqr0IzO4H3No4wEUhq5q05", name: "Stephen Kao" },
  { id: "YMcgrMitq9WlJMl5eHlziEr2ERKqqKQX", name: "Wade Lin" },
];

// ============================================================
// Seed Opportunities
// ============================================================
async function seedOpportunities(): Promise<string[]> {
  console.log("\n📦 建立 Opportunities 假資料...");

  const opportunities = [
    {
      id: generateId(),
      userId: USERS[0].id,
      customerNumber: `202601-TEST01`,
      companyName: "【測試】王老闆火鍋店",
      contactName: "王大明",
      contactPhone: "0912345678",
      status: "qualified",
      productLine: "ichef",
    },
    {
      id: generateId(),
      userId: USERS[0].id,
      customerNumber: `202601-TEST02`,
      companyName: "【測試】李小姐咖啡廳",
      contactName: "李小華",
      contactPhone: "0923456789",
      status: "proposal",
      productLine: "ichef",
    },
    {
      id: generateId(),
      userId: USERS[1].id,
      customerNumber: `202601-TEST03`,
      companyName: "【測試】張先生日式料理",
      contactName: "張建國",
      contactPhone: "0934567890",
      status: "negotiation",
      productLine: "ichef",
    },
    {
      id: generateId(),
      userId: USERS[1].id,
      customerNumber: `202601-TEST04`,
      companyName: "【測試】陳老闆早午餐",
      contactName: "陳美玲",
      contactPhone: "0945678901",
      status: "new",
      productLine: "ichef",
    },
  ];

  // 清除舊的測試資料
  await sql`DELETE FROM opportunities WHERE company_name LIKE '【測試】%'`;

  for (const opp of opportunities) {
    await sql`
      INSERT INTO opportunities (
        id, user_id, customer_number, company_name, contact_name,
        contact_phone, status, product_line, source, created_at, updated_at
      ) VALUES (
        ${opp.id}, ${opp.userId}, ${opp.customerNumber}, ${opp.companyName},
        ${opp.contactName}, ${opp.contactPhone}, ${opp.status}, ${opp.productLine},
        'manual', NOW(), NOW()
      )
    `;
    console.log(`  ✅ ${opp.companyName}`);
  }

  return opportunities.map((o) => o.id);
}

// ============================================================
// Seed Conversations (for Daily Health Report & Weekly Report)
// ============================================================
async function seedConversations(opportunityIds: string[]): Promise<void> {
  console.log("\n🎙️ 建立 Conversations 假資料...");

  const conversationTypes = [
    "discovery_call",
    "demo",
    "follow_up",
    "negotiation",
  ];
  const statuses = ["completed", "completed", "completed", "failed"]; // 75% 成功率

  // 清除舊的測試資料
  await sql`DELETE FROM conversations WHERE title LIKE '【測試】%'`;

  const conversations = [];

  // 建立過去 7 天的資料（用於健康報告和週報）
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    // 每天建立 2-4 筆
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const oppId = randomChoice(opportunityIds);
      const user = randomChoice(USERS);
      const status = randomChoice(statuses);
      const createdAt = getDateOffset(-daysAgo);
      createdAt.setHours(9 + Math.floor(Math.random() * 8)); // 09:00-17:00

      conversations.push({
        id: generateId(),
        opportunityId: oppId,
        title: `【測試】拜訪記錄 Day-${daysAgo} #${i + 1}`,
        type: randomChoice(conversationTypes),
        status,
        productLine: "ichef",
        caseNumber: `202601-IC${String(900 + conversations.length).padStart(3, "0")}`,
        createdBy: user.id,
        createdAt,
        errorMessage: status === "failed" ? "測試用錯誤訊息" : null,
      });
    }
  }

  for (const conv of conversations) {
    await sql`
      INSERT INTO conversations (
        id, opportunity_id, title, type, status, product_line,
        case_number, created_by, created_at, updated_at, error_message
      ) VALUES (
        ${conv.id}, ${conv.opportunityId}, ${conv.title}, ${conv.type},
        ${conv.status}, ${conv.productLine}, ${conv.caseNumber},
        ${conv.createdBy}, ${conv.createdAt.toISOString()}, NOW(),
        ${conv.errorMessage}
      )
    `;
  }

  // 統計
  const completed = conversations.filter((c) => c.status === "completed").length;
  const failed = conversations.filter((c) => c.status === "failed").length;
  console.log(`  ✅ 已建立 ${conversations.length} 筆 Conversations`);
  console.log(`     - 完成: ${completed} 筆`);
  console.log(`     - 失敗: ${failed} 筆`);
  console.log(`     - 成功率: ${Math.round((completed / conversations.length) * 100)}%`);
}

// ============================================================
// Seed Todos (for Daily Todo Reminder)
// ============================================================
async function seedTodos(opportunityIds: string[]): Promise<void> {
  console.log("\n📋 建立 Todos 假資料...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // 清除舊的測試資料
  await sql`DELETE FROM sales_todos WHERE title LIKE '【測試】%'`;

  const todos = [
    // Stephen 的待辦
    {
      id: generateId(),
      userId: USERS[0].id,
      opportunityId: opportunityIds[0],
      title: "【測試】跟進王老闆餐廳合作案",
      description: "確認報價單，討論導入時程",
      dueDate: today,
      source: "web",
    },
    {
      id: generateId(),
      userId: USERS[0].id,
      opportunityId: opportunityIds[1],
      title: "【測試】打電話給李小姐確認需求",
      description: "確認 POS 系統需要的功能模組",
      dueDate: today,
      source: "slack",
    },
    {
      id: generateId(),
      userId: USERS[0].id,
      opportunityId: null,
      title: "【測試】逾期：回覆陳老闆報價問題",
      description: "這是逾期 1 天的待辦事項",
      dueDate: yesterday,
      source: "web",
    },
    {
      id: generateId(),
      userId: USERS[0].id,
      opportunityId: null,
      title: "【測試】嚴重逾期：準備 Demo 簡報",
      description: "這是逾期 2 天的待辦事項",
      dueDate: twoDaysAgo,
      source: "slack",
    },
    // Wade 的待辦
    {
      id: generateId(),
      userId: USERS[1].id,
      opportunityId: opportunityIds[2],
      title: "【測試】拜訪張先生日式料理",
      description: "現場勘查環境，評估硬體需求",
      dueDate: today,
      source: "web",
    },
    {
      id: generateId(),
      userId: USERS[1].id,
      opportunityId: opportunityIds[3],
      title: "【測試】逾期：陳老闆早午餐報價",
      description: "這是 Wade 的逾期待辦",
      dueDate: yesterday,
      source: "slack",
    },
  ];

  for (const todo of todos) {
    await sql`
      INSERT INTO sales_todos (
        id, user_id, opportunity_id, title, description,
        due_date, original_due_date, status, source,
        reminder_sent, created_at, updated_at
      ) VALUES (
        ${todo.id}, ${todo.userId}, ${todo.opportunityId}, ${todo.title},
        ${todo.description}, ${todo.dueDate.toISOString()},
        ${todo.dueDate.toISOString()}, 'pending', ${todo.source},
        false, NOW(), NOW()
      )
    `;
  }

  const stephenTodos = todos.filter((t) => t.userId === USERS[0].id);
  const wadeTodos = todos.filter((t) => t.userId === USERS[1].id);
  console.log(`  ✅ 已建立 ${todos.length} 筆 Todos`);
  console.log(`     - Stephen: ${stephenTodos.length} 筆`);
  console.log(`     - Wade: ${wadeTodos.length} 筆`);
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log("🌱 開始建立所有報告的假資料...");
  console.log("=".repeat(60));

  try {
    // 1. 建立 Opportunities
    const opportunityIds = await seedOpportunities();

    // 2. 建立 Conversations
    await seedConversations(opportunityIds);

    // 3. 建立 Todos
    await seedTodos(opportunityIds);

    console.log("\n" + "=".repeat(60));
    console.log("✅ 所有假資料建立完成！\n");

    console.log("📅 Cron Job 排程：");
    console.log("   • 08:00 (UTC+8) - 每日健康報告");
    console.log("   • 08:00 (UTC+8) 週一 - 每週週報");
    console.log("   • 09:00 (UTC+8) - 每日 Todo 提醒\n");

    console.log("💡 手動觸發測試指令：");
    console.log("   # 健康報告");
    console.log('   curl "https://sales-ai-queue-worker.salesaiautomationv3.workers.dev/__scheduled?cron=0+0+*+*+*"');
    console.log("\n   # 週報");
    console.log('   curl "https://sales-ai-queue-worker.salesaiautomationv3.workers.dev/__scheduled?cron=0+0+*+*+1"');
    console.log("\n   # Todo 提醒");
    console.log('   curl "https://sales-ai-queue-worker.salesaiautomationv3.workers.dev/__scheduled?cron=0+1+*+*+*"');

  } catch (error) {
    console.error("\n❌ 建立失敗:", error);
    process.exit(1);
  }
}

main();
