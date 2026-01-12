// scripts/migration/test-connections.ts
/**
 * 統一連線測試腳本
 * 測試 Firebase Firestore 和 PostgreSQL 的連線狀態
 *
 * 使用方式:
 *   bun run scripts/migration/test-connections.ts
 */

import { sql } from "drizzle-orm";
import {
  conversations,
  db,
  firestore,
  meddicAnalyses,
  opportunities,
} from "./config";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function addResult(result: TestResult) {
  results.push(result);
  const icon = result.passed ? "✅" : "❌";
  console.log(`${icon} ${result.name}`);
  if (result.message) {
    console.log(`   ${result.message}`);
  }
  if (result.details) {
    for (const [key, value] of Object.entries(result.details)) {
      console.log(`   - ${key}: ${value}`);
    }
  }
  console.log("");
}

async function testFirestoreConnection() {
  console.log("🔥 Testing Firebase Firestore connection...\n");

  // 測試 Firestore 連線
  try {
    // 測試 leads collection
    const leadsSnapshot = await firestore.collection("leads").count().get();
    const leadsCount = leadsSnapshot.data().count;

    addResult({
      name: "Firebase Firestore connected",
      passed: true,
      message: "Successfully connected to Firestore",
      details: {
        "leads collection": `${leadsCount} documents`,
      },
    });

    // 測試 sales_cases collection
    const salesCasesSnapshot = await firestore
      .collection("sales_cases")
      .count()
      .get();
    const salesCasesCount = salesCasesSnapshot.data().count;

    addResult({
      name: "Firestore collections accessible",
      passed: true,
      message: "Both collections are readable",
      details: {
        "leads collection": `${leadsCount} documents`,
        "sales_cases collection": `${salesCasesCount} documents`,
      },
    });

    return { leadsCount, salesCasesCount };
  } catch (error) {
    const err = error as Error;
    addResult({
      name: "Firebase Firestore connection",
      passed: false,
      message: `Failed: ${err.message}`,
    });

    console.error("\n💡 請確認:");
    console.error("   - FIREBASE_PROJECT_ID 正確");
    console.error("   - FIREBASE_CLIENT_EMAIL 正確");
    console.error("   - FIREBASE_PRIVATE_KEY 格式正確（\\n 需轉換為換行）");
    console.error("   - Service Account 有 Firestore 讀取權限\n");

    return null;
  }
}

async function testPostgreSQLConnection() {
  console.log("🐘 Testing PostgreSQL connection...\n");

  try {
    // 測試基本連線
    const result = await db.execute(sql`SELECT 1 as test`);
    if (!result) {
      throw new Error("Query returned no result");
    }

    addResult({
      name: "PostgreSQL connected",
      passed: true,
      message: "Successfully connected to database",
    });

    // 測試目標表格存在
    const tableChecks = [
      { name: "opportunities", table: opportunities },
      { name: "conversations", table: conversations },
      { name: "meddic_analyses", table: meddicAnalyses },
    ];

    const tableCounts: Record<string, number> = {};

    for (const { name, table } of tableChecks) {
      try {
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(table);
        tableCounts[name] = Number(countResult[0]?.count ?? 0);
      } catch {
        tableCounts[name] = -1; // 表示表格不存在或無法存取
      }
    }

    const allTablesReady = Object.values(tableCounts).every(
      (count) => count >= 0
    );

    addResult({
      name: "PostgreSQL tables ready",
      passed: allTablesReady,
      message: allTablesReady
        ? "All target tables are accessible"
        : "Some tables are missing or inaccessible",
      details: {
        "opportunities table": `${tableCounts.opportunities >= 0 ? "ready" : "missing"} (${tableCounts.opportunities} rows)`,
        "conversations table": `${tableCounts.conversations >= 0 ? "ready" : "missing"} (${tableCounts.conversations} rows)`,
        "meddic_analyses table": `${tableCounts.meddic_analyses >= 0 ? "ready" : "missing"} (${tableCounts.meddic_analyses} rows)`,
      },
    });

    return tableCounts;
  } catch (error) {
    const err = error as Error;
    addResult({
      name: "PostgreSQL connection",
      passed: false,
      message: `Failed: ${err.message}`,
    });

    console.error("\n💡 請確認:");
    console.error("   - DATABASE_URL 格式正確");
    console.error("   - Neon 資料庫已啟用");
    console.error("   - 已執行 bun run db:push 部署 schema\n");

    return null;
  }
}

async function checkMigrationUserId() {
  console.log("👤 Checking migration user ID...\n");

  const userId = process.env.MIGRATION_USER_ID;

  if (!userId) {
    addResult({
      name: "Migration User ID",
      passed: false,
      message:
        "MIGRATION_USER_ID 未設定。所有遷移的資料需要關聯到一個有效的用戶 ID。",
    });

    console.log("💡 取得 MIGRATION_USER_ID 的方式:");
    console.log("   1. 先登入 V3 系統建立帳號");
    console.log('   2. 從資料庫查詢: SELECT id FROM "user" LIMIT 1;');
    console.log("   3. 將 ID 設定到 .env.migration 檔案中\n");

    return false;
  }

  // 驗證 User ID 是否存在於資料庫
  try {
    const userResult = await db.execute(
      sql`SELECT id, email FROM "user" WHERE id = ${userId} LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      addResult({
        name: "Migration User ID",
        passed: false,
        message: `User ID "${userId}" 不存在於資料庫中`,
      });

      console.log("💡 請確認:");
      console.log("   - User ID 正確");
      console.log("   - 該用戶已在 V3 系統中註冊\n");

      return false;
    }

    const user = userResult.rows[0] as { id: string; email: string };
    addResult({
      name: "Migration User ID",
      passed: true,
      message: "User ID 有效",
      details: {
        "User ID": userId,
        Email: user.email || "(no email)",
      },
    });

    return true;
  } catch (error) {
    // 如果 user 表不存在，可能是 schema 尚未部署
    const err = error as Error;
    if (err.message.includes("does not exist")) {
      addResult({
        name: "Migration User ID",
        passed: false,
        message: 'User 表不存在，請先執行 "bun run db:push"',
      });
    } else {
      addResult({
        name: "Migration User ID",
        passed: false,
        message: `驗證失敗: ${err.message}`,
      });
    }
    return false;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("              Sales AI Automation V3 - 連線測試");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 顯示環境設定
  console.log("📋 環境設定:");
  console.log(`   - FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || "(not set)"}`);
  console.log(`   - DATABASE_URL: ${process.env.DATABASE_URL ? "***設定完成***" : "(not set)"}`);
  console.log(`   - MIGRATION_USER_ID: ${process.env.MIGRATION_USER_ID || "(not set)"}`);
  console.log(`   - DRY_RUN: ${process.env.DRY_RUN || "false"}`);
  console.log("");

  // 執行測試
  const firestoreResult = await testFirestoreConnection();
  const postgresResult = await testPostgreSQLConnection();
  const userIdValid = await checkMigrationUserId();

  // 總結
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                        測試結果總結");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log(`結果: ${passedCount}/${totalCount} 測試通過\n`);

  if (firestoreResult) {
    console.log("✅ Firebase Firestore connected");
    console.log(`   - leads collection: ${firestoreResult.leadsCount} documents`);
    console.log(`   - sales_cases collection: ${firestoreResult.salesCasesCount} documents`);
  } else {
    console.log("❌ Firebase Firestore: 連線失敗");
  }

  if (postgresResult) {
    console.log("✅ PostgreSQL connected");
    console.log(`   - opportunities table: ready`);
    console.log(`   - conversations table: ready`);
    console.log(`   - meddic_analyses table: ready`);
  } else {
    console.log("❌ PostgreSQL: 連線失敗");
  }

  if (userIdValid) {
    console.log("✅ Migration User ID: 已驗證");
  } else {
    console.log("❌ Migration User ID: 未設定或無效");
  }

  console.log("");

  // 決定是否可以執行遷移
  const allPassed = firestoreResult && postgresResult && userIdValid;

  if (allPassed) {
    console.log("🎉 所有連線測試通過！可以開始執行遷移。\n");
    console.log("下一步:");
    console.log("  1. 執行 Dry Run 測試:");
    console.log("     DRY_RUN=true bun run scripts/migration/index.ts\n");
    console.log("  2. 確認無誤後執行正式遷移:");
    console.log("     bun run scripts/migration/index.ts\n");
    process.exit(0);
  } else {
    console.log("❌ 部分測試未通過，請先修復問題後再執行遷移。\n");
    process.exit(1);
  }
}

// 執行測試
main().catch((error) => {
  console.error("❌ 測試執行失敗:", error);
  process.exit(1);
});
