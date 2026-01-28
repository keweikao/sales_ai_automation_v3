#!/usr/bin/env bun
import { db, conversations, opportunities } from "./config";
import { sql, like, eq } from "drizzle-orm";

async function check() {
  console.log("🔍 檢查 M 開頭的案件編號");
  console.log("=".repeat(60));

  // 1. 所有 M 開頭的 conversations
  const mConvs = await db
    .select({
      caseNumber: conversations.caseNumber,
      legacyCaseId: conversations.legacyCaseId,
      storeName: conversations.storeName,
      opportunityId: conversations.opportunityId,
    })
    .from(conversations)
    .where(like(conversations.caseNumber, "M%"))
    .orderBy(conversations.caseNumber);

  console.log(`\n📋 所有 M 開頭的案件 (共 ${mConvs.length} 筆):`);

  // 按前綴分組統計
  const prefixCounts = new Map<string, number>();
  for (const c of mConvs) {
    const prefix = c.caseNumber?.substring(0, 7) || "unknown"; // e.g., M202511
    prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
  }

  console.log("\n📊 按月份分組:");
  for (const [prefix, count] of Array.from(prefixCounts.entries()).sort()) {
    console.log(`   ${prefix}: ${count} 筆`);
  }

  // 2. 抽樣顯示
  console.log("\n📝 抽樣 (前 10 筆):");
  for (const c of mConvs.slice(0, 10)) {
    console.log(`   ${c.caseNumber?.padEnd(15)} | ${c.legacyCaseId?.padEnd(15) || "N/A".padEnd(15)} | ${c.storeName}`);
  }

  // 3. 檢查 opportunities 與 conversations 的關聯
  console.log("\n🔗 檢查 opportunities 關聯:");

  // 找出有 M 開頭 conversation 的 opportunities
  const oppsWithMConvs = await db
    .select({
      oppId: opportunities.id,
      companyName: opportunities.companyName,
      userId: opportunities.userId,
      source: opportunities.source,
    })
    .from(opportunities)
    .innerJoin(conversations, eq(conversations.opportunityId, opportunities.id))
    .where(like(conversations.caseNumber, "M%"))
    .limit(10);

  console.log(`   有 M 開頭 conversation 的 opportunities (前 10 筆):`);
  for (const o of oppsWithMConvs) {
    console.log(`   ${o.companyName?.substring(0, 15)?.padEnd(15)} | userId: ${o.userId?.substring(0, 15)?.padEnd(15)} | source: ${o.source}`);
  }

  // 4. 檢查用戶可見性
  console.log("\n👤 M 開頭案件的 userId 分佈:");
  const mByUser = await db
    .select({
      userId: opportunities.userId,
      count: sql<number>`count(distinct ${opportunities.id})`,
    })
    .from(opportunities)
    .innerJoin(conversations, eq(conversations.opportunityId, opportunities.id))
    .where(like(conversations.caseNumber, "M%"))
    .groupBy(opportunities.userId);

  for (const r of mByUser) {
    console.log(`   ${r.userId?.substring(0, 20)?.padEnd(20) || "NULL".padEnd(20)} | ${r.count} 筆`);
  }

  console.log("\n" + "=".repeat(60));
  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
