#!/usr/bin/env bun
import { db, conversations, opportunities } from "./config";
import { eq, or, like, desc } from "drizzle-orm";

async function check() {
  console.log("🔍 檢查特定案件和 API 查詢邏輯");
  console.log("=".repeat(60));

  // 1. 查詢 M202601-IC189 和 M202601-IC190
  const targetCases = await db
    .select({
      caseNumber: conversations.caseNumber,
      opportunityId: conversations.opportunityId,
      storeName: conversations.storeName,
    })
    .from(conversations)
    .where(
      or(
        eq(conversations.caseNumber, "M202601-IC189"),
        eq(conversations.caseNumber, "M202601-IC190")
      )
    );

  console.log("\n📋 M202601-IC189 和 M202601-IC190:");
  for (const c of targetCases) {
    console.log(`   ${c.caseNumber} | oppId: ${c.opportunityId?.substring(0, 12)}... | ${c.storeName}`);

    // 查詢對應的 opportunity
    if (c.opportunityId) {
      const opp = await db.query.opportunities.findFirst({
        where: eq(opportunities.id, c.opportunityId),
      });
      if (opp) {
        console.log(`      → userId: ${opp.userId} | source: ${opp.source} | company: ${opp.companyName}`);
      }
    }
  }

  // 2. 模擬 admin 用戶查詢（EcVY4mP1Jqaqr0IzO4H3No4wEUhq5q05）
  const adminUserId = "EcVY4mP1Jqaqr0IzO4H3No4wEUhq5q05";

  // 無過濾條件的查詢（admin 應該看到的）
  const allOpps = await db
    .select()
    .from(opportunities)
    .orderBy(desc(opportunities.createdAt))
    .limit(20);

  console.log(`\n📊 無過濾條件查詢（admin 應該看到的，前 20 筆）:`);
  for (const o of allOpps) {
    console.log(`   ${o.companyName?.substring(0, 15)?.padEnd(15)} | userId: ${o.userId?.substring(0, 15)?.padEnd(15)} | source: ${o.source}`);
  }

  // 3. 檢查 listOpportunities 返回的 latestCaseNumber
  console.log("\n🔗 檢查 latestCaseNumber 邏輯:");
  for (const o of allOpps.slice(0, 5)) {
    const latestConv = await db.query.conversations.findFirst({
      where: eq(conversations.opportunityId, o.id),
      orderBy: (conversations, { desc }) => [desc(conversations.createdAt)],
      columns: { caseNumber: true, slackUsername: true },
    });
    console.log(`   ${o.companyName?.substring(0, 15)?.padEnd(15)} | caseNumber: ${latestConv?.caseNumber || "NULL"}`);
  }

  // 4. 總數確認
  const totalOpps = await db.select().from(opportunities);
  console.log(`\n📈 總數: ${totalOpps.length} 筆 opportunities`);

  // 過濾 source=import 的數量
  const importOpps = totalOpps.filter(o => o.source === "import");
  console.log(`   source=import: ${importOpps.length} 筆`);

  console.log("\n" + "=".repeat(60));
  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
