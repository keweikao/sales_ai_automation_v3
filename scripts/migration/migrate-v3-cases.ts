#!/usr/bin/env node
// scripts/migration/migrate-v3-cases.ts

import { eq } from "drizzle-orm";
import { conversations, db, firestore, meddicAnalyses, opportunities } from "./config";
import {
  isExcludedCustomerId,
  isTestData,
  mapCaseToConversation,
  mapCaseToMeddicAnalysis,
  mapCaseToOpportunity,
} from "./mappers/v3-cases-mapper";
import type { FirestoreV3Case, V3MigrationStats } from "./types-v3-cases";
import { preloadUserMappings, resolveUserId } from "./user-mapping";

const DRY_RUN = process.env.DRY_RUN === "true";
const BATCH_SIZE = 50; // 每批處理數量

async function migrate() {
  console.log("🚀 開始 Firestore Cases → PostgreSQL V3 遷移");
  console.log(`📊 模式: ${DRY_RUN ? "DRY RUN (測試模式)" : "正式遷移"}`);
  console.log("=".repeat(80));

  const stats: V3MigrationStats = {
    opportunities: { total: 0, created: 0, skipped: 0, errors: [] },
    conversations: { total: 0, success: 0, failed: 0, errors: [] },
    meddicAnalyses: { total: 0, success: 0, skipped: 0, failed: 0, errors: [] },
    duration: 0,
    startedAt: new Date(),
    completedAt: new Date(),
  };

  try {
    // ========== Phase 0: 預載用戶映射 ==========
    console.log("\n📦 Phase 0: 預載用戶映射");
    await preloadUserMappings();

    // ========== Phase 1: 讀取所有 cases ==========
    console.log("\n📖 Phase 1: 讀取 Firestore cases");
    const casesSnapshot = await firestore.collection("cases").get();
    const allCaseDocs: FirestoreV3Case[] = casesSnapshot.docs.map((doc) => ({
      ...(doc.data() as FirestoreV3Case),
      caseId: doc.id,
    }));

    console.log(`✅ 讀取 ${allCaseDocs.length} 筆 cases`);

    // 過濾測試資料和額外排除的客戶
    let testDataCount = 0;
    let excludedCustomerCount = 0;

    const filteredCaseDocs = allCaseDocs.filter((caseDoc) => {
      // 過濾測試資料（根據 customerName）
      if (isTestData(caseDoc.customerName)) {
        console.log(
          `⏭️  跳過測試資料: ${caseDoc.caseId} (${caseDoc.customerName})`,
        );
        testDataCount++;
        return false;
      }
      // 過濾額外排除的客戶編號
      if (caseDoc.customerId && isExcludedCustomerId(caseDoc.customerId)) {
        console.log(
          `⏭️  跳過排除客戶: ${caseDoc.caseId} (${caseDoc.customerId} - ${caseDoc.customerName})`,
        );
        excludedCustomerCount++;
        return false;
      }
      return true;
    });

    console.log(`📊 過濾掉 ${testDataCount} 筆測試資料`);
    console.log(`📊 過濾掉 ${excludedCustomerCount} 筆排除客戶`);
    console.log(`📊 剩餘 ${filteredCaseDocs.length} 筆待處理資料`);

    // 每個客戶只保留最新一筆案件
    console.log("\n📋 每個客戶只保留最新一筆案件...");
    const customerLatestCase = new Map<string, FirestoreV3Case>();

    for (const caseDoc of filteredCaseDocs) {
      if (!caseDoc.customerId) continue;

      const existing = customerLatestCase.get(caseDoc.customerId);
      if (!existing) {
        customerLatestCase.set(caseDoc.customerId, caseDoc);
      } else {
        // 比較 createdAt，保留最新的
        const existingDate = existing.createdAt?.toDate() || new Date(0);
        const currentDate = caseDoc.createdAt?.toDate() || new Date(0);
        if (currentDate > existingDate) {
          customerLatestCase.set(caseDoc.customerId, caseDoc);
        }
      }
    }

    const caseDocs = Array.from(customerLatestCase.values());
    const duplicatesRemoved = filteredCaseDocs.length - caseDocs.length;
    console.log(`📊 移除 ${duplicatesRemoved} 筆重複客戶的舊案件`);
    console.log(`📊 最終遷移 ${caseDocs.length} 筆資料（每客戶一筆）`);

    // ========== Phase 2: 建立 Opportunities (去重) ==========
    console.log("\n🎯 Phase 2: 建立 Opportunities (按 customerId 去重)");
    console.log("-".repeat(80));

    // 按 customerId 分組
    const customerGroups = new Map<string, FirestoreV3Case[]>();
    for (const caseDoc of caseDocs) {
      const customerId = caseDoc.customerId;
      if (!customerId) {
        console.log(`⚠️  跳過無 customerId 的 case: ${caseDoc.caseId}`);
        continue;
      }
      if (!customerGroups.has(customerId)) {
        customerGroups.set(customerId, []);
      }
      customerGroups.get(customerId)!.push(caseDoc);
    }

    stats.opportunities.total = customerGroups.size;
    console.log(`📊 發現 ${customerGroups.size} 個不重複客戶 (customerId)`);

    // 儲存 customerId → opportunityId 映射
    const customerIdToOpportunityId = new Map<string, string>();

    for (const [customerId, cases] of customerGroups.entries()) {
      try {
        // 使用第一個 case 作為代表
        const representativeCase = cases[0];
        const userId = await resolveUserId(representativeCase.salesRepSlackId);

        // 建立 Opportunity
        const newOpp = mapCaseToOpportunity(representativeCase, userId);

        // 檢查是否已存在 (根據 customerNumber)
        const existing = await db.query.opportunities.findFirst({
          where: eq(opportunities.customerNumber, newOpp.customerNumber),
        });

        if (existing) {
          customerIdToOpportunityId.set(customerId, existing.id);
          stats.opportunities.skipped++;
          console.log(
            `⏭️  跳過已存在: ${customerId} (${representativeCase.customerName}) → ${existing.id}`,
          );
          continue;
        }

        // 建立新 Opportunity
        if (!DRY_RUN) {
          const [inserted] = await db
            .insert(opportunities)
            .values(newOpp)
            .returning();
          customerIdToOpportunityId.set(customerId, inserted.id);
          console.log(
            `✅ 建立: ${customerId} (${representativeCase.customerName}) → User ${userId}`,
          );
        } else {
          // Dry run: 使用假 ID
          customerIdToOpportunityId.set(customerId, `dry-run-${customerId}`);
          console.log(
            `[DRY RUN] 建立: ${customerId} (${representativeCase.customerName}) → User ${userId}`,
          );
        }

        stats.opportunities.created++;
      } catch (error) {
        stats.opportunities.errors.push({
          customerId,
          error: String(error),
        });
        console.error(`❌ 建立 Opportunity 失敗: ${customerId}`, error);
      }
    }

    console.log("\n📊 Opportunities 統計:");
    console.log(`   總數: ${stats.opportunities.total}`);
    console.log(`   建立: ${stats.opportunities.created}`);
    console.log(`   跳過: ${stats.opportunities.skipped}`);
    console.log(`   錯誤: ${stats.opportunities.errors.length}`);

    // ========== Phase 3: 建立 Conversations ==========
    console.log("\n💬 Phase 3: 建立 Conversations");
    console.log("-".repeat(80));

    stats.conversations.total = caseDocs.length;

    for (const caseDoc of caseDocs) {
      try {
        const opportunityId = customerIdToOpportunityId.get(
          caseDoc.customerId,
        );
        if (!opportunityId) {
          throw new Error(
            `找不到 Opportunity: ${caseDoc.customerId} (case: ${caseDoc.caseId})`,
          );
        }

        const newConv = mapCaseToConversation(caseDoc, opportunityId);

        if (!DRY_RUN) {
          await db.insert(conversations).values(newConv);
          console.log(`✅ 建立: ${caseDoc.caseId} → ${opportunityId}`);
        } else {
          console.log(`[DRY RUN] 建立: ${caseDoc.caseId} → ${opportunityId}`);
        }

        stats.conversations.success++;
      } catch (error) {
        stats.conversations.failed++;
        stats.conversations.errors.push({
          caseId: caseDoc.caseId,
          error: String(error),
        });
        console.error(`❌ 建立 Conversation 失敗: ${caseDoc.caseId}`, error);
      }
    }

    console.log("\n📊 Conversations 統計:");
    console.log(`   總數: ${stats.conversations.total}`);
    console.log(`   成功: ${stats.conversations.success}`);
    console.log(`   失敗: ${stats.conversations.failed}`);

    // ========== Phase 4: MEDDIC Analyses (跳過,由 V3 重新分析) ==========
    console.log("\n📊 Phase 4: MEDDIC Analyses - 跳過 (將由 V3 系統重新分析)");
    console.log("-".repeat(80));

    const casesWithAnalysis = caseDocs.filter((c) => c.analysis?.agents);
    stats.meddicAnalyses.total = casesWithAnalysis.length;
    stats.meddicAnalyses.skipped = casesWithAnalysis.length;

    console.log(`📊 發現 ${casesWithAnalysis.length} 個有 V2 分析資料的 cases`);
    console.log(`⏭️  跳過建立 MEDDIC Analyses,transcript 已保留在 conversations 中`);
    console.log(`📝  V3 系統將在後續重新執行 MEDDIC 分析`);

    console.log("\n📊 MEDDIC Analyses 統計:");
    console.log(`   總數: ${stats.meddicAnalyses.total}`);
    console.log(`   成功: ${stats.meddicAnalyses.success}`);
    console.log(`   跳過: ${stats.meddicAnalyses.skipped}`);
    console.log(`   失敗: ${stats.meddicAnalyses.failed}`);
  } catch (error) {
    console.error("\n❌ 遷移過程中發生錯誤:", error);
    throw error;
  } finally {
    stats.completedAt = new Date();
    stats.duration =
      (stats.completedAt.getTime() - stats.startedAt.getTime()) / 1000;

    // 輸出最終統計
    console.log("\n" + "=".repeat(80));
    console.log("📊 遷移統計報告");
    console.log("=".repeat(80));
    console.log(`⏱️  總耗時: ${stats.duration.toFixed(2)} 秒`);

    console.log("\n🎯 Opportunities:");
    console.log(`  - 總數: ${stats.opportunities.total}`);
    console.log(`  - 建立: ${stats.opportunities.created}`);
    console.log(`  - 跳過: ${stats.opportunities.skipped}`);
    console.log(`  - 錯誤: ${stats.opportunities.errors.length}`);

    console.log("\n💬 Conversations:");
    console.log(`  - 總數: ${stats.conversations.total}`);
    console.log(`  - 成功: ${stats.conversations.success}`);
    console.log(`  - 失敗: ${stats.conversations.failed}`);

    console.log("\n📊 MEDDIC Analyses:");
    console.log(`  - 總數: ${stats.meddicAnalyses.total}`);
    console.log(`  - 成功: ${stats.meddicAnalyses.success}`);
    console.log(`  - 跳過: ${stats.meddicAnalyses.skipped}`);
    console.log(`  - 失敗: ${stats.meddicAnalyses.failed}`);

    // 輸出錯誤詳情
    if (stats.opportunities.errors.length > 0) {
      console.log("\n❌ Opportunity 錯誤詳情:");
      for (const err of stats.opportunities.errors) {
        console.log(`   ${err.customerId}: ${err.error}`);
      }
    }

    if (stats.conversations.errors.length > 0) {
      console.log("\n❌ Conversation 錯誤詳情:");
      for (const err of stats.conversations.errors) {
        console.log(`   ${err.caseId}: ${err.error}`);
      }
    }

    if (stats.meddicAnalyses.errors.length > 0) {
      console.log("\n❌ MEDDIC 錯誤詳情:");
      for (const err of stats.meddicAnalyses.errors) {
        console.log(`   ${err.caseId}: ${err.error}`);
      }
    }

    console.log("\n" + "=".repeat(80));
    if (DRY_RUN) {
      console.log("✅ Dry Run 完成! 實際遷移時請移除 DRY_RUN=true 環境變數");
    } else {
      console.log("✅ 遷移完成!");
    }
  }
}

migrate().catch((error) => {
  console.error("💥 遷移失敗:", error);
  process.exit(1);
});
