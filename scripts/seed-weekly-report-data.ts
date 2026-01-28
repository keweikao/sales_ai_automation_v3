/**
 * Seed 週報測試資料
 * 建立多筆不同日期的 Conversations，用於測試週報呈現
 */

import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function generateId(): string {
  return crypto.randomUUID();
}

// Stephen 的 User ID
const STEPHEN_ID = "EcVY4mP1Jqaqr0IzO4H3No4wEUhq5q05";
const WADE_ID = "YMcgrMitq9WlJMl5eHlziEr2ERKqqKQX";

// ============================================================
// Main
// ============================================================
async function main() {
  console.log("🌱 建立週報測試資料...\n");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 本月第一天
  const mtdStart = new Date(year, month - 1, 1);

  // 本週開始（週日）
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  console.log(`📅 MTD 開始: ${mtdStart.toLocaleDateString("zh-TW")}`);
  console.log(`📅 本週開始: ${weekStart.toLocaleDateString("zh-TW")}`);
  console.log(`📅 今天: ${now.toLocaleDateString("zh-TW")}\n`);

  // 清除舊的測試資料
  console.log("🗑️  清除舊的測試資料...");
  await sql`DELETE FROM conversations WHERE title LIKE '【週報測試】%'`;
  await sql`DELETE FROM opportunities WHERE company_name LIKE '【週報測試】%'`;

  // ============================================================
  // 建立測試 Opportunities
  // ============================================================
  console.log("\n📦 建立 Opportunities...");

  const opportunities = [
    { id: generateId(), userId: STEPHEN_ID, customerNumber: "202601-WK001", companyName: "【週報測試】火鍋達人", contactName: "王大明" },
    { id: generateId(), userId: STEPHEN_ID, customerNumber: "202601-WK002", companyName: "【週報測試】咖啡時光", contactName: "李小華" },
    { id: generateId(), userId: STEPHEN_ID, customerNumber: "202601-WK003", companyName: "【週報測試】日式料理亭", contactName: "張建國" },
    { id: generateId(), userId: STEPHEN_ID, customerNumber: "202601-WK004", companyName: "【週報測試】早午餐專賣", contactName: "陳美玲" },
    { id: generateId(), userId: STEPHEN_ID, customerNumber: "202601-WK005", companyName: "【週報測試】義式餐廳", contactName: "林志明" },
    { id: generateId(), userId: WADE_ID, customerNumber: "202601-WK006", companyName: "【週報測試】韓式烤肉", contactName: "金正浩" },
    { id: generateId(), userId: WADE_ID, customerNumber: "202601-WK007", companyName: "【週報測試】泰式料理", contactName: "帕妮" },
  ];

  for (const opp of opportunities) {
    await sql`
      INSERT INTO opportunities (id, user_id, customer_number, company_name, contact_name, status, product_line, source, created_at, updated_at)
      VALUES (${opp.id}, ${opp.userId}, ${opp.customerNumber}, ${opp.companyName}, ${opp.contactName}, 'qualified', 'ichef', 'manual', NOW(), NOW())
    `;
  }
  console.log(`  ✅ 建立 ${opportunities.length} 筆 Opportunities`);

  // ============================================================
  // 建立測試 Conversations
  // ============================================================
  console.log("\n🎙️ 建立 Conversations...");

  const conversationTypes = ["discovery_call", "demo", "follow_up", "negotiation", "closing"];
  const conversations: Array<{
    id: string;
    oppId: string;
    userId: string;
    title: string;
    type: string;
    status: string;
    caseNumber: string;
    createdAt: Date;
  }> = [];

  let caseCounter = 800;

  // Helper: 建立指定日期的 conversation
  function createConversation(
    oppIndex: number,
    userId: string,
    daysAgo: number,
    hour: number,
    title: string,
    type: string,
    status: string = "completed"
  ) {
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

    conversations.push({
      id: generateId(),
      oppId: opportunities[oppIndex].id,
      userId,
      title: `【週報測試】${title}`,
      type,
      status,
      caseNumber: `202601-IC${caseCounter++}`,
      createdAt,
    });
  }

  // ============================================================
  // Stephen 的資料 - 模擬真實業務活動
  // ============================================================

  // === 本週資料 (會顯示在「本週」欄位) ===

  // 今天
  createConversation(0, STEPHEN_ID, 0, 10, "火鍋達人 - 初次拜訪", "discovery_call", "completed");
  createConversation(1, STEPHEN_ID, 0, 14, "咖啡時光 - 系統展示", "demo", "completed");
  createConversation(2, STEPHEN_ID, 0, 16, "日式料理亭 - 報價討論", "negotiation", "completed");

  // 昨天
  createConversation(3, STEPHEN_ID, 1, 9, "早午餐專賣 - 需求確認", "discovery_call", "completed");
  createConversation(4, STEPHEN_ID, 1, 11, "義式餐廳 - 功能展示", "demo", "completed");
  createConversation(0, STEPHEN_ID, 1, 15, "火鍋達人 - 功能細節", "follow_up", "completed");

  // 2天前
  createConversation(1, STEPHEN_ID, 2, 10, "咖啡時光 - 初次聯繫", "discovery_call", "completed");
  createConversation(2, STEPHEN_ID, 2, 14, "日式料理亭 - Demo", "demo", "completed");

  // 3天前
  createConversation(3, STEPHEN_ID, 3, 11, "早午餐專賣 - 現場勘查", "discovery_call", "completed");
  createConversation(4, STEPHEN_ID, 3, 15, "義式餐廳 - 需求訪談", "discovery_call", "completed");

  // 4天前
  createConversation(0, STEPHEN_ID, 4, 9, "火鍋達人 - 電話跟進", "follow_up", "completed");
  createConversation(1, STEPHEN_ID, 4, 14, "咖啡時光 - 報價說明", "negotiation", "completed");

  // 5天前
  createConversation(2, STEPHEN_ID, 5, 10, "日式料理亭 - 合約討論", "negotiation", "completed");
  createConversation(3, STEPHEN_ID, 5, 16, "早午餐專賣 - Demo", "demo", "completed");

  // 6天前
  createConversation(4, STEPHEN_ID, 6, 11, "義式餐廳 - 跟進電話", "follow_up", "completed");

  // === 本月其他資料 (會顯示在「MTD」但不在「本週」) ===

  // 8-15 天前的資料
  for (let i = 8; i <= 15; i++) {
    const oppIndex = i % 5;
    createConversation(oppIndex, STEPHEN_ID, i, 10 + (i % 6), `歷史記錄 Day-${i}`, conversationTypes[i % 5], "completed");
  }

  // 加入一些失敗的案例（測試成功率）
  createConversation(0, STEPHEN_ID, 2, 17, "火鍋達人 - 通話中斷", "follow_up", "failed");
  createConversation(1, STEPHEN_ID, 4, 18, "咖啡時光 - 轉錄失敗", "discovery_call", "failed");

  // ============================================================
  // Wade 的資料 - 較少但也有活動
  // ============================================================

  // 本週
  createConversation(5, WADE_ID, 0, 10, "韓式烤肉 - 初次拜訪", "discovery_call", "completed");
  createConversation(6, WADE_ID, 1, 14, "泰式料理 - Demo", "demo", "completed");
  createConversation(5, WADE_ID, 2, 11, "韓式烤肉 - 跟進", "follow_up", "completed");
  createConversation(6, WADE_ID, 4, 15, "泰式料理 - 需求確認", "discovery_call", "completed");

  // 本月其他
  createConversation(5, WADE_ID, 10, 10, "韓式烤肉 - 電話聯繫", "discovery_call", "completed");
  createConversation(6, WADE_ID, 12, 14, "泰式料理 - 首次接觸", "discovery_call", "completed");

  // ============================================================
  // 寫入資料庫
  // ============================================================

  for (const conv of conversations) {
    await sql`
      INSERT INTO conversations (
        id, opportunity_id, title, type, status, product_line,
        case_number, created_by, created_at, updated_at
      ) VALUES (
        ${conv.id}, ${conv.oppId}, ${conv.title}, ${conv.type},
        ${conv.status}, 'ichef', ${conv.caseNumber},
        ${conv.userId}, ${conv.createdAt.toISOString()}, NOW()
      )
    `;
  }

  // ============================================================
  // 統計與預覽
  // ============================================================
  console.log(`  ✅ 建立 ${conversations.length} 筆 Conversations\n`);

  // 計算週報預覽
  const stephenMtd = conversations.filter(c => c.userId === STEPHEN_ID && c.status === "completed" && c.createdAt >= mtdStart).length;
  const stephenWeek = conversations.filter(c => c.userId === STEPHEN_ID && c.status === "completed" && c.createdAt >= weekStart).length;
  const wadeMtd = conversations.filter(c => c.userId === WADE_ID && c.status === "completed" && c.createdAt >= mtdStart).length;
  const wadeWeek = conversations.filter(c => c.userId === WADE_ID && c.status === "completed" && c.createdAt >= weekStart).length;

  console.log("=".repeat(60));
  console.log("📊 週報預覽\n");

  console.log(`📅 MTD 上傳總數: ${stephenMtd + wadeMtd} 筆`);
  console.log(`📆 本週上傳: ${stephenWeek + wadeWeek} 筆\n`);

  console.log("👥 各業務上傳統計:");
  console.log(`🥇 Stephen Kao: MTD ${stephenMtd} / 本週 ${stephenWeek}`);
  console.log(`🥈 Wade Lin: MTD ${wadeMtd} / 本週 ${wadeWeek}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ 週報測試資料建立完成！");
  console.log("\n📅 週報會在週一 08:00 (UTC+8) 自動發送到 Slack 頻道");
}

main().catch(console.error);
