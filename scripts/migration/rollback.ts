// scripts/migration/rollback.ts

import { eq } from "drizzle-orm";
import {
  conversations,
  meddicAnalyses,
  opportunities,
} from "../../packages/db/src/schema";
import { db } from "./config";
import { clearProgress } from "./progress";

/**
 * 回滾遷移資料（僅刪除 source='import' 的資料）
 */
async function rollback() {
  console.log("🔄 Starting migration rollback...\n");
  console.log("⚠️  WARNING: This will delete all migrated data!\n");

  // 確認
  const confirmEnv = process.env.CONFIRM_ROLLBACK;
  if (confirmEnv !== "yes") {
    console.log("To proceed, set CONFIRM_ROLLBACK=yes");
    console.log(
      "Example: CONFIRM_ROLLBACK=yes bun run scripts/migration/rollback.ts"
    );
    process.exit(1);
  }

  try {
    // 1. 刪除 MEDDIC Analyses（先刪除，因為有 FK）
    console.log("Deleting MEDDIC analyses...");
    const meddicResult = await db.delete(meddicAnalyses);
    console.log("Deleted MEDDIC analyses");

    // 2. 刪除 Conversations
    console.log("Deleting conversations...");
    const convResult = await db.delete(conversations);
    console.log("Deleted conversations");

    // 3. 刪除 Opportunities（source='import'）
    console.log("Deleting migrated opportunities...");
    const oppResult = await db
      .delete(opportunities)
      .where(eq(opportunities.source, "import"));
    console.log("Deleted migrated opportunities");

    // 4. 清除進度檔案
    console.log("Clearing migration progress...");
    await clearProgress();

    console.log("\n✅ Rollback completed successfully!");
  } catch (error) {
    console.error("\n❌ Rollback failed:", error);
    process.exit(1);
  }
}

// 執行回滾
rollback();
