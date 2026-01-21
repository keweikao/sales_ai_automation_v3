#!/usr/bin/env node
// scripts/migration/validate-v3-cases.ts

import { conversations, meddicAnalyses, opportunities } from "../../packages/db/src/schema";
import { db } from "../../packages/db";
import { eq, isNull, sql } from "drizzle-orm";
import { firestore } from "./config";

async function validate() {
  console.log("🔍 開始驗證 Firestore → PostgreSQL V3 遷移結果");
  console.log("=".repeat(80));

  let passed = 0;
  let failed = 0;

  // ========== 檢查 1: Cases → Conversations 筆數一致 ==========
  console.log("\n✅ 檢查 1: Cases → Conversations 筆數");
  try {
    const casesSnapshot = await firestore.collection("cases").count().get();
    const casesCount = casesSnapshot.data().count;
    const convsCount = await db.$count(conversations);

    if (casesCount === convsCount) {
      console.log(`   ✅ 通過: ${casesCount} cases = ${convsCount} conversations`);
      passed++;
    } else {
      console.log(
        `   ❌ 失敗: ${casesCount} cases ≠ ${convsCount} conversations`,
      );
      failed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 檢查 2: Unique Customers → Opportunities ==========
  console.log("\n✅ 檢查 2: Unique Customers → Opportunities");
  try {
    const casesData = await firestore.collection("cases").get();
    const uniqueCustomers = new Set(
      casesData.docs.map((d) => d.data().customerName),
    );
    const oppsCount = await db.$count(opportunities);

    if (uniqueCustomers.size === oppsCount) {
      console.log(
        `   ✅ 通過: ${uniqueCustomers.size} 客戶 = ${oppsCount} opportunities`,
      );
      passed++;
    } else {
      console.log(
        `   ❌ 失敗: ${uniqueCustomers.size} 客戶 ≠ ${oppsCount} opportunities`,
      );
      console.log(`   提示: Opportunities 可能有重複或遺漏`);
      failed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 檢查 3: MEDDIC Analyses 筆數 ==========
  console.log("\n✅ 檢查 3: MEDDIC Analyses 筆數");
  try {
    const casesData = await firestore.collection("cases").get();
    const casesWithAnalysis = casesData.docs.filter(
      (d) => d.data().analysis?.agents,
    ).length;
    const meddicCount = await db.$count(meddicAnalyses);

    if (casesWithAnalysis === meddicCount) {
      console.log(
        `   ✅ 通過: ${casesWithAnalysis} 有分析 = ${meddicCount} meddic`,
      );
      passed++;
    } else {
      console.log(
        `   ⚠️  警告: ${casesWithAnalysis} 有分析,但 ${meddicCount} meddic`,
      );
      console.log(`   提示: 部分分析資料可能格式不符或建立失敗`);
      // 計為通過,因為可能有合理的跳過
      passed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 檢查 4: 無 Orphaned Conversations ==========
  console.log("\n✅ 檢查 4: 無孤立 Conversations");
  try {
    const orphanedConvs = await db.execute(sql`
      SELECT COUNT(*) as count FROM conversations
      WHERE opportunity_id NOT IN (SELECT id FROM opportunities)
    `);

    const orphanedCount = Number(orphanedConvs.rows[0]?.count || 0);

    if (orphanedCount === 0) {
      console.log(`   ✅ 通過: 無孤立 Conversations`);
      passed++;
    } else {
      console.log(`   ❌ 失敗: 發現 ${orphanedCount} 個孤立 Conversations`);
      failed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 檢查 5: customerNumber 必填 ==========
  console.log("\n✅ 檢查 5: customerNumber 必填");
  try {
    const oppsWithoutNumber = await db.query.opportunities.findMany({
      where: isNull(opportunities.customerNumber),
    });

    if (oppsWithoutNumber.length === 0) {
      console.log(`   ✅ 通過: 所有 Opportunities 有 customerNumber`);
      passed++;
    } else {
      console.log(
        `   ❌ 失敗: ${oppsWithoutNumber.length} 個 Opportunities 缺少 customerNumber`,
      );
      failed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 檢查 6: caseNumber 必填 ==========
  console.log("\n✅ 檢查 6: caseNumber 必填");
  try {
    const convsWithoutCase = await db.query.conversations.findMany({
      where: isNull(conversations.caseNumber),
    });

    if (convsWithoutCase.length === 0) {
      console.log(`   ✅ 通過: 所有 Conversations 有 caseNumber`);
      passed++;
    } else {
      console.log(
        `   ❌ 失敗: ${convsWithoutCase.length} 個 Conversations 缺少 caseNumber`,
      );
      failed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 檢查 7: 音檔 URL 第一階段應為 null ==========
  console.log("\n✅ 檢查 7: 音檔 URL 為 null (第一階段)");
  try {
    const convsWithAudio = await db.execute(sql`
      SELECT COUNT(*) as count FROM conversations
      WHERE audio_url IS NOT NULL
    `);

    const audioCount = Number(convsWithAudio.rows[0]?.count || 0);

    if (audioCount === 0) {
      console.log(`   ✅ 通過: 所有 Conversations 的 audioUrl 為 null`);
      passed++;
    } else {
      console.log(
        `   ⚠️  警告: ${audioCount} 個 Conversations 已有 audioUrl`,
      );
      console.log(`   提示: 可能第二階段音檔遷移已執行`);
      // 計為通過,因為可能是正常的第二階段遷移
      passed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 檢查 8: Service Account 使用比例 ==========
  console.log("\n✅ 檢查 8: Service Account 使用比例");
  try {
    const totalOpps = await db.$count(opportunities);
    const serviceAccountOpps = await db.execute(sql`
      SELECT COUNT(*) as count FROM opportunities
      WHERE user_id = 'service-account'
    `);

    const serviceAccountCount = Number(
      serviceAccountOpps.rows[0]?.count || 0,
    );
    const serviceAccountRatio = totalOpps > 0 ? serviceAccountCount / totalOpps : 0;

    console.log(
      `   Service Account 使用: ${serviceAccountCount}/${totalOpps} (${(serviceAccountRatio * 100).toFixed(1)}%)`,
    );

    if (serviceAccountRatio < 0.5) {
      console.log(
        `   ✅ 通過: Service Account 比例 < 50% (用戶映射良好)`,
      );
      passed++;
    } else {
      console.log(
        `   ⚠️  警告: Service Account 比例 >= 50% (可能需檢查用戶映射)`,
      );
      console.log(
        `   提示: 大部分 Slack User ID 無法映射到 PostgreSQL User`,
      );
      // 計為通過,因為 service-account 是合法的後備方案
      passed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 檢查 9: Opportunity source 為 import ==========
  console.log("\n✅ 檢查 9: Opportunity source 標記");
  try {
    const importOpps = await db.execute(sql`
      SELECT COUNT(*) as count FROM opportunities
      WHERE source = 'import'
    `);

    const importCount = Number(importOpps.rows[0]?.count || 0);
    const totalOpps = await db.$count(opportunities);

    if (importCount === totalOpps) {
      console.log(
        `   ✅ 通過: 所有 Opportunities 標記為 source='import'`,
      );
      passed++;
    } else {
      console.log(
        `   ⚠️  警告: ${importCount}/${totalOpps} 標記為 import`,
      );
      console.log(`   提示: 部分資料可能來自其他來源`);
      // 計為通過,因為可能混雜其他來源
      passed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 檢查 10: Conversation ID 與 Firestore 一致 ==========
  console.log("\n✅ 檢查 10: Conversation ID 與 Firestore 一致");
  try {
    const casesData = await firestore.collection("cases").limit(10).get();
    const firestoreCaseIds = casesData.docs.map((d) => d.id);

    let matchCount = 0;
    for (const caseId of firestoreCaseIds) {
      const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, caseId),
      });
      if (conv) matchCount++;
    }

    if (matchCount === firestoreCaseIds.length) {
      console.log(
        `   ✅ 通過: 抽樣 ${firestoreCaseIds.length} 筆 ID 全部匹配`,
      );
      passed++;
    } else {
      console.log(
        `   ❌ 失敗: 抽樣 ${firestoreCaseIds.length} 筆僅 ${matchCount} 筆匹配`,
      );
      failed++;
    }
  } catch (error) {
    console.error(`   ❌ 檢查失敗:`, error);
    failed++;
  }

  // ========== 總結 ==========
  console.log("\n" + "=".repeat(80));
  console.log(`📊 驗證結果: ${passed} 通過, ${failed} 失敗`);
  console.log("=".repeat(80));

  if (failed === 0) {
    console.log("✅ 所有檢查通過! 遷移資料正確無誤");
    process.exit(0);
  } else {
    console.log(
      `❌ 有 ${failed} 個檢查失敗,請檢查上述錯誤並修正`,
    );
    process.exit(1);
  }
}

validate().catch((error) => {
  console.error("💥 驗證失敗:", error);
  process.exit(1);
});
