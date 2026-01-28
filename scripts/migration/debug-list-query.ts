#!/usr/bin/env bun
// 模擬 listOpportunities API 的查詢邏輯

import { db, opportunities, userProfiles } from "./config";
import { sql, eq, desc, and } from "drizzle-orm";

async function debug() {
  console.log("🔍 Debug listOpportunities 查詢邏輯");
  console.log("=".repeat(60));

  // 1. 列出所有 userProfiles
  const profiles = await db.select().from(userProfiles);
  console.log("\n👤 所有 userProfiles:");
  for (const p of profiles) {
    const isAdmin = p.role === "admin" && p.department === "all";
    const isManager = p.role === "manager";
    console.log(`   ${p.userId.substring(0, 12)}... | role: ${p.role?.padEnd(10)} | dept: ${p.department?.padEnd(10) || "NULL".padEnd(10)} | isAdmin: ${isAdmin} | isManager: ${isManager}`);
  }

  // 2. 模擬 admin 用戶查詢（canViewAll = true）
  console.log("\n📊 模擬 Admin 查詢 (無權限過濾):");
  const adminResults = await db
    .select({
      id: opportunities.id,
      companyName: opportunities.companyName,
      userId: opportunities.userId,
      source: opportunities.source,
    })
    .from(opportunities)
    .orderBy(desc(opportunities.createdAt))
    .limit(10);

  console.log(`   查詢到 ${adminResults.length} 筆（前 10 筆）:`);
  for (const r of adminResults) {
    console.log(`   ${r.companyName?.substring(0, 20)?.padEnd(20)} | userId: ${r.userId?.substring(0, 15)?.padEnd(15)} | source: ${r.source}`);
  }

  // 3. 統計 source 分布
  const bySource = await db
    .select({
      source: opportunities.source,
      count: sql<number>`count(*)`,
    })
    .from(opportunities)
    .groupBy(opportunities.source);

  console.log("\n📊 按 source 分組:");
  for (const r of bySource) {
    console.log(`   ${r.source?.padEnd(10) || "NULL".padEnd(10)} | ${r.count} 筆`);
  }

  // 4. 檢查 admin 用戶 ID
  const adminProfile = profiles.find(p => p.role === "admin" && p.department === "all");
  if (adminProfile) {
    console.log(`\n🔑 Admin 用戶 ID: ${adminProfile.userId}`);

    // 檢查這個 admin 擁有多少 opportunities
    const adminOpps = await db
      .select({ count: sql<number>`count(*)` })
      .from(opportunities)
      .where(eq(opportunities.userId, adminProfile.userId));
    console.log(`   Admin 擁有的 opportunities: ${adminOpps[0].count}`);
  }

  // 5. 檢查總數
  const total = await db.select({ count: sql<number>`count(*)` }).from(opportunities);
  console.log(`\n📊 Opportunities 總數: ${total[0].count}`);

  // 6. 檢查 import source 的資料
  const importOpps = await db
    .select({
      id: opportunities.id,
      companyName: opportunities.companyName,
      customerNumber: opportunities.customerNumber,
      userId: opportunities.userId,
    })
    .from(opportunities)
    .where(eq(opportunities.source, "import"))
    .orderBy(desc(opportunities.createdAt))
    .limit(5);

  console.log("\n📋 遷移資料抽樣 (source=import, 前 5 筆):");
  for (const r of importOpps) {
    console.log(`   ${r.companyName?.substring(0, 15)?.padEnd(15)} | ${r.customerNumber?.padEnd(15)} | userId: ${r.userId?.substring(0, 15)}`);
  }

  console.log("\n" + "=".repeat(60));
  process.exit(0);
}

debug().catch((e) => {
  console.error(e);
  process.exit(1);
});
