/**
 * 建立 Live Demo 測試資料
 *
 * 建立 3 個測試機會、對話（含案件編號）和待辦事項，用於演示：
 * 1. 完成待辦
 * 2. 拒絕（輸單）
 * 3. 成交（贏單）
 *
 * 使用方式：
 * export DATABASE_URL="..." && bun run scripts/create-demo-data.ts
 *
 * 清理方式：
 * export DATABASE_URL="..." && bun run scripts/delete-demo-data.ts
 */

import { Client } from "pg";
import { randomUUID } from "node:crypto";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Demo 資料前綴，方便識別和清理
const DEMO_CUSTOMER_PREFIX = "999999-";

interface DemoCase {
  name: string;
  customerNumber: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  todoTitle: string;
  todoDescription: string;
  caseNumber: string;
}

// 產生隨機案件編號 (格式: 202601-ICDEMO + 隨機3位數)
function generateCaseNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 900) + 100); // 100-999
  return `${year}${month}-ICDEMO${random}`;
}

// 三個演示案例
const demoCases: DemoCase[] = [
  {
    name: "完成待辦",
    customerNumber: `${DEMO_CUSTOMER_PREFIX}${randomUUID().slice(0, 6)}`,
    companyName: "鼎泰豐信義店",
    contactName: "楊老闆",
    contactPhone: "0912-345-678",
    todoTitle: "跟進鼎泰豐導入進度",
    todoDescription: "確認系統安裝時間，準備教育訓練資料",
    caseNumber: generateCaseNumber(),
  },
  {
    name: "拒絕輸單",
    customerNumber: `${DEMO_CUSTOMER_PREFIX}${randomUUID().slice(0, 6)}`,
    companyName: "麥當勞西門店",
    contactName: "陳經理",
    contactPhone: "0923-456-789",
    todoTitle: "跟進麥當勞評估結果",
    todoDescription: "了解客戶最終決策，收集競品資訊",
    caseNumber: generateCaseNumber(),
  },
  {
    name: "成交贏單",
    customerNumber: `${DEMO_CUSTOMER_PREFIX}${randomUUID().slice(0, 6)}`,
    companyName: "星巴克南港店",
    contactName: "林總監",
    contactPhone: "0934-567-890",
    todoTitle: "跟進星巴克簽約事宜",
    todoDescription: "準備合約文件，確認付款方式",
    caseNumber: generateCaseNumber(),
  },
];

async function main() {
  await client.connect();
  console.log("🚀 開始建立 Demo 測試資料...\n");

  // 1. 取得用於 Demo 的 user（使用第一個管理員或任意用戶）
  const adminEmail = process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
  let userResult;

  if (adminEmail) {
    userResult = await client.query(
      `SELECT id, name, email FROM "user" WHERE email = $1 LIMIT 1`,
      [adminEmail]
    );
  }

  if (!userResult?.rows[0]) {
    // Fallback: 使用第一個用戶
    userResult = await client.query(
      `SELECT id, name, email FROM "user" LIMIT 1`
    );
  }

  const demoUser = userResult.rows[0];
  if (!demoUser) {
    console.error("❌ 找不到任何用戶，請先建立用戶");
    process.exit(1);
  }

  console.log(`📌 使用用戶: ${demoUser.name || demoUser.email} (${demoUser.id})\n`);

  let createdOpportunities = 0;
  let createdConversations = 0;
  let createdTodos = 0;

  // 使用資料庫的 NOW() 取得 UTC 時間，然後計算台北時間的今天
  const now = new Date();
  const dbTimeResult = await client.query(`SELECT NOW() as db_now`);
  const dbNow = dbTimeResult.rows[0].db_now as Date;

  // 計算台北時間（加 8 小時）
  const taipeiTime = new Date(dbNow.getTime() + 8 * 60 * 60 * 1000);

  // 取台北的今天日期（使用 UTC methods 因為我們手動加了 8 小時）
  const year = taipeiTime.getUTCFullYear();
  const month = taipeiTime.getUTCMonth();
  const day = taipeiTime.getUTCDate();

  // 設定 due_date 為這一天的 06:00 UTC (= 14:00 Taipei)
  const dueDate = new Date(Date.UTC(year, month, day, 6, 0, 0, 0));

  console.log(`📅 資料庫時間 (UTC): ${dbNow.toISOString()}`);
  console.log(`📅 台北時間: ${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(taipeiTime.getUTCHours()).padStart(2, '0')}:${String(taipeiTime.getUTCMinutes()).padStart(2, '0')}`);
  console.log(`📅 待辦日期設定: ${dueDate.toISOString()} (台北 14:00)`);
  console.log("");


  // 2. 建立三個機會、對話和待辦
  for (const demoCase of demoCases) {
    console.log(`📝 建立案例: ${demoCase.name}`);

    // 檢查是否已存在
    const existing = await client.query(
      `SELECT id FROM opportunities WHERE customer_number = $1`,
      [demoCase.customerNumber]
    );

    if (existing.rows[0]) {
      console.log(`   ⚠️ 已存在，跳過: ${demoCase.companyName}`);
      continue;
    }

    // 建立機會
    const opportunityId = randomUUID();

    await client.query(
      `INSERT INTO opportunities (
        id, user_id, customer_number, company_name, contact_name, contact_phone,
        source, status, product_line, industry, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        opportunityId,
        demoUser.id,
        demoCase.customerNumber,
        demoCase.companyName,
        demoCase.contactName,
        demoCase.contactPhone,
        "manual",
        "qualified",
        "ichef",
        "餐飲業",
        `Live Demo 測試資料 - ${demoCase.name}`,
        now,
        now,
      ]
    );
    createdOpportunities++;
    console.log(`   ✅ 機會: ${demoCase.companyName} (${demoCase.customerNumber})`);

    // 建立對話（含案件編號）
    const conversationId = randomUUID();

    await client.query(
      `INSERT INTO conversations (
        id, opportunity_id, case_number, store_name, title, type, status,
        conversation_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        conversationId,
        opportunityId,
        demoCase.caseNumber,
        demoCase.companyName,
        `${demoCase.companyName} - Demo 對話`,
        "discovery_call",
        "completed",
        now,
        now,
        now,
      ]
    );
    createdConversations++;
    console.log(`   ✅ 對話: ${demoCase.caseNumber}`);

    // 建立待辦
    const todoId = randomUUID();

    await client.query(
      `INSERT INTO sales_todos (
        id, user_id, opportunity_id, conversation_id, customer_number, title, description,
        due_date, original_due_date, status, source, remind_days, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        todoId,
        demoUser.id,
        opportunityId,
        conversationId,
        demoCase.customerNumber,
        demoCase.todoTitle,
        demoCase.todoDescription,
        dueDate,
        dueDate,
        "pending",
        "web",
        1,
        now,
        now,
      ]
    );
    createdTodos++;
    console.log(`   ✅ 待辦: ${demoCase.todoTitle}`);
    console.log("");
  }

  // 3. 輸出摘要
  console.log("=".repeat(60));
  console.log("📊 建立完成摘要:");
  console.log(`   機會數量: ${createdOpportunities}`);
  console.log(`   對話數量: ${createdConversations}`);
  console.log(`   待辦數量: ${createdTodos}`);
  console.log("");
  console.log("🎯 演示說明:");
  console.log("   1. 鼎泰豐信義店 → 演示「完成」待辦");
  console.log("   2. 麥當勞西門店 → 演示「拒絕」（輸單）");
  console.log("   3. 星巴克南港店 → 演示「成交」（贏單）");
  console.log("");
  console.log("📋 案件編號:");
  for (const demoCase of demoCases) {
    console.log(`   ${demoCase.companyName}: ${demoCase.caseNumber}`);
  }
  console.log("");
  console.log("🗑️ 演示完成後執行清理:");
  console.log("   bun run scripts/delete-demo-data.ts");
  console.log("");

  await client.end();
}

main().catch((error) => {
  console.error("❌ 發生錯誤:", error);
  process.exit(1);
});
