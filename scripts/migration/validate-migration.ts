#!/usr/bin/env bun
// scripts/migration/validate-migration.ts
// 驗證 Firestore → Neon 遷移結果

import { db, opportunities, conversations, meddicAnalyses } from "./config";
import { sql, like, isNotNull, eq } from "drizzle-orm";

async function validate() {
  console.log("📊 遷移結果驗證");
  console.log("=".repeat(60));

  // 1. 統計總數
  const oppCount = await db.select({ count: sql<number>`count(*)` }).from(opportunities);
  const convCount = await db.select({ count: sql<number>`count(*)` }).from(conversations);
  const meddicCount = await db.select({ count: sql<number>`count(*)` }).from(meddicAnalyses);

  console.log("\n📈 資料庫總計:");
  console.log(`   Opportunities: ${oppCount[0].count}`);
  console.log(`   Conversations: ${convCount[0].count}`);
  console.log(`   MEDDIC Analyses: ${meddicCount[0].count}`);

  // 2. 檢查遷移的案件（M 前綴）
  const migratedConvs = await db.select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(like(conversations.caseNumber, "M%"));

  console.log(`\n📋 遷移案件統計 (M 前綴):`);
  console.log(`   M 前綴案件數: ${migratedConvs[0].count}`);

  // 3. 檢查有 legacyCaseId 的案件
  const withLegacy = await db.select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(isNotNull(conversations.legacyCaseId));

  console.log(`   有 legacyCaseId: ${withLegacy[0].count}`);

  // 4. 檢查有 transcript 的案件
  const withTranscript = await db.select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(isNotNull(conversations.transcript));

  console.log(`   有 transcript: ${withTranscript[0].count}`);

  // 5. 抽樣檢查幾筆遷移資料
  const sampleConvs = await db.select({
    caseNumber: conversations.caseNumber,
    legacyCaseId: conversations.legacyCaseId,
    storeName: conversations.storeName,
    slackUsername: conversations.slackUsername,
    hasTranscript: sql<boolean>`${conversations.transcript} IS NOT NULL`,
  }).from(conversations)
    .where(like(conversations.caseNumber, "M%"))
    .limit(5);

  console.log(`\n📝 抽樣資料 (前 5 筆遷移案件):`);
  for (const conv of sampleConvs) {
    console.log(`   ${conv.caseNumber} | ${conv.legacyCaseId} | ${conv.storeName} | ${conv.slackUsername} | transcript: ${conv.hasTranscript}`);
  }

  // 6. 檢查 source=import 的 opportunities
  const importedOpps = await db.select({ count: sql<number>`count(*)` })
    .from(opportunities)
    .where(eq(opportunities.source, "import"));

  console.log(`\n🎯 Opportunities 來源統計:`);
  console.log(`   source=import: ${importedOpps[0].count}`);

  // 7. 檢查業務歸屬
  const serviceAccountOpps = await db.select({ count: sql<number>`count(*)` })
    .from(opportunities)
    .where(eq(opportunities.userId, "service-account"));

  console.log(`\n👤 業務歸屬統計:`);
  console.log(`   歸屬 service-account: ${serviceAccountOpps[0].count}`);
  console.log(`   已正確歸屬: ${Number(importedOpps[0].count) - Number(serviceAccountOpps[0].count)}`);

  // 8. 驗證結果
  console.log("\n" + "=".repeat(60));
  console.log("✅ 驗證完成！");

  const expectedMigrated = 234;
  const actualMigrated = Number(migratedConvs[0].count);

  if (actualMigrated === expectedMigrated) {
    console.log(`✅ 遷移數量正確: ${actualMigrated} 筆`);
  } else {
    console.log(`⚠️  遷移數量不符: 預期 ${expectedMigrated}，實際 ${actualMigrated}`);
  }

  process.exit(0);
}

validate().catch((error) => {
  console.error("❌ 驗證失敗:", error);
  process.exit(1);
});
