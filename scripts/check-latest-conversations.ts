/**
 * 檢查資料庫中最新的 conversations 記錄
 */

import { db } from "../packages/db/src/index.js";
import { conversations, meddicAnalyses } from "../packages/db/src/schema/index.js";
import { desc, eq } from "drizzle-orm";

async function checkLatestConversations() {
  console.log("🔍 檢查最新的 Conversations 記錄\n");
  console.log("=".repeat(80));

  try {
    // 查詢最新的 5 筆 conversations
    const latestConversations = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(5);

    if (latestConversations.length === 0) {
      console.log("\n⚠️  資料庫中沒有任何 conversation 記錄");
      console.log("\n可能的原因:");
      console.log("  1. Slack Bot 尚未成功接收到音檔");
      console.log("  2. 上傳過程中發生錯誤");
      console.log("  3. 資料庫連線問題");
      return;
    }

    console.log(`\n✅ 找到 ${latestConversations.length} 筆記錄:\n`);

    for (const conv of latestConversations) {
      console.log(`📝 Conversation ID: ${conv.id}`);
      console.log(`   Opportunity ID: ${conv.opportunityId}`);
      console.log(`   標題: ${conv.title || "無標題"}`);
      console.log(`   狀態: ${conv.transcriptionStatus}`);
      console.log(`   音檔 URL: ${conv.audioUrl?.substring(0, 60)}...`);
      console.log(`   建立時間: ${conv.createdAt}`);
      console.log(`   更新時間: ${conv.updatedAt}`);

      // 檢查是否有 MEDDIC 分析結果
      const analysis = await db
        .select()
        .from(meddicAnalyses)
        .where(eq(meddicAnalyses.conversationId, conv.id))
        .limit(1);

      if (analysis.length > 0) {
        console.log(`   ✅ MEDDIC 分析: 已完成`);
        console.log(`      - 總分: ${analysis[0].overallScore}`);
        console.log(`      - 狀態: ${analysis[0].qualificationStatus}`);
      } else {
        console.log(`   ⏳ MEDDIC 分析: 處理中或失敗`);
      }

      console.log("");
    }

    // 統計資訊
    const pendingCount = latestConversations.filter(
      (c) => c.transcriptionStatus === "pending"
    ).length;
    const processingCount = latestConversations.filter(
      (c) => c.transcriptionStatus === "processing"
    ).length;
    const completedCount = latestConversations.filter(
      (c) => c.transcriptionStatus === "completed"
    ).length;
    const failedCount = latestConversations.filter(
      (c) => c.transcriptionStatus === "failed"
    ).length;

    console.log("=".repeat(80));
    console.log("\n📊 狀態統計 (最近 5 筆):");
    console.log(`   ⏸️  待處理: ${pendingCount}`);
    console.log(`   🔄 處理中: ${processingCount}`);
    console.log(`   ✅ 已完成: ${completedCount}`);
    console.log(`   ❌ 失敗: ${failedCount}`);

    if (processingCount > 0) {
      console.log("\n💡 提示: 有記錄正在處理中，請稍後再查詢");
    }

    if (failedCount > 0) {
      console.log("\n⚠️  警告: 有記錄處理失敗，請檢查 Queue Worker 日誌");
    }
  } catch (error) {
    console.error("\n❌ 查詢失敗:", error);
    console.error("\n可能的原因:");
    console.error("  1. 資料庫連線失敗 (檢查 DATABASE_URL)");
    console.error("  2. Schema 不匹配 (執行 bun run db:push)");
    process.exit(1);
  }
}

// 執行檢查
checkLatestConversations();
