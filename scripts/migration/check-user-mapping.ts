#!/usr/bin/env bun
// 檢查用戶映射和 opportunities 歸屬

import { db, userProfiles, opportunities } from "./config";
import { sql, eq, ne } from "drizzle-orm";

async function check() {
  console.log("📊 用戶與 Opportunities 歸屬分析");
  console.log("=".repeat(60));

  // 1. 查詢所有用戶的角色
  const users = await db.select().from(userProfiles);
  console.log("\n👤 已註冊用戶列表:");
  for (const u of users) {
    console.log(`   ${u.userId.substring(0, 12)}... | role: ${u.role?.padEnd(10) || "N/A".padEnd(10)} | dept: ${u.department || "N/A"}`);
  }

  // 2. 查詢 service-account 的 opportunities 數量
  const serviceAcct = await db.select({ count: sql<number>`count(*)` })
    .from(opportunities)
    .where(eq(opportunities.userId, "service-account"));
  console.log(`\n📊 service-account 擁有的 opportunities: ${serviceAcct[0].count}`);

  // 3. 查詢有多少 opportunities 歸屬給真實用戶
  const realUsers = await db.select({ count: sql<number>`count(*)` })
    .from(opportunities)
    .where(ne(opportunities.userId, "service-account"));
  console.log(`📊 真實用戶擁有的 opportunities: ${realUsers[0].count}`);

  // 4. 查詢每個 userId 的 opportunities 數量
  const byUser = await db
    .select({
      userId: opportunities.userId,
      count: sql<number>`count(*)`,
    })
    .from(opportunities)
    .groupBy(opportunities.userId);

  console.log("\n📋 按用戶分組的 opportunities:");
  for (const row of byUser) {
    const userIdDisplay = row.userId === "service-account"
      ? "service-account"
      : row.userId?.substring(0, 12) + "...";
    console.log(`   ${userIdDisplay?.padEnd(20) || "NULL".padEnd(20)} | ${row.count} 筆`);
  }

  // 5. 檢查遷移的資料（source=import）
  const importedByUser = await db
    .select({
      userId: opportunities.userId,
      count: sql<number>`count(*)`,
    })
    .from(opportunities)
    .where(eq(opportunities.source, "import"))
    .groupBy(opportunities.userId);

  console.log("\n📋 遷移資料按用戶分組 (source=import):");
  for (const row of importedByUser) {
    const userIdDisplay = row.userId === "service-account"
      ? "service-account"
      : row.userId?.substring(0, 12) + "...";
    console.log(`   ${userIdDisplay?.padEnd(20) || "NULL".padEnd(20)} | ${row.count} 筆`);
  }

  console.log("\n" + "=".repeat(60));
  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
