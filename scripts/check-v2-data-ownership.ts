#!/usr/bin/env bun
/**
 * 檢查 V2 遷移資料的 userId 分布
 * 用途:確認 V2 資料是否可見
 */

import { db } from "../packages/db";
import { opportunities, user } from "../packages/db/src/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("📊 檢查 V2 遷移資料的 userId 分布\n");

  // 1. 統計 opportunities 的 userId 分布
  console.log("1️⃣  Opportunities userId 分布:");
  console.log("─────────────────────────────────────────\n");

  const opportunityStats = await db
    .select({
      userId: opportunities.userId,
      count: sql<number>`count(*)::int`,
      earliestDate: sql<Date>`min(${opportunities.createdAt})`,
      latestDate: sql<Date>`max(${opportunities.createdAt})`,
    })
    .from(opportunities)
    .groupBy(opportunities.userId)
    .orderBy(sql`min(${opportunities.createdAt})`);

  for (const stat of opportunityStats) {
    // 查詢對應的用戶資訊
    let userInfo = "未知用戶";
    if (stat.userId) {
      const userRecord = await db.query.user.findFirst({
        where: (users, { eq }) => eq(users.id, stat.userId),
      });

      if (userRecord) {
        userInfo = `${userRecord.name} (${userRecord.email})`;
      } else if (stat.userId === "service-account") {
        userInfo = "Service Account (Slack Bot)";
      } else {
        userInfo = `用戶 ID: ${stat.userId} (已刪除或不存在)`;
      }
    }

    console.log(`userId: ${stat.userId || "NULL"}`);
    console.log(`   用戶: ${userInfo}`);
    console.log(`   數量: ${stat.count} 個 opportunities`);
    console.log(
      `   期間: ${new Date(stat.earliestDate).toISOString().split("T")[0]} ~ ${new Date(stat.latestDate).toISOString().split("T")[0]}`
    );
    console.log();
  }

  // 2. 檢查您的用戶資訊
  console.log("\n2️⃣  您的用戶資訊:");
  console.log("─────────────────────────────────────────\n");

  const adminEmail = process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
  if (adminEmail) {
    const adminUser = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.email, adminEmail),
    });

    if (adminUser) {
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Name: ${adminUser.name}`);

      // 檢查這個用戶擁有多少 opportunities
      const ownedCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(opportunities)
        .where(sql`${opportunities.userId} = ${adminUser.id}`);

      console.log(
        `   擁有的 Opportunities: ${ownedCount[0]?.count || 0} 個`
      );
    } else {
      console.log(`   ⚠️  找不到 email 為 ${adminEmail} 的用戶`);
    }
  } else {
    console.log("   ⚠️  ADMIN_EMAILS 環境變數未設定");
  }

  // 3. 總結
  console.log("\n3️⃣  可見性分析:");
  console.log("─────────────────────────────────────────\n");

  const totalOpps = opportunityStats.reduce((sum, s) => sum + s.count, 0);
  const serviceAccountOpps =
    opportunityStats.find((s) => s.userId === "service-account")?.count || 0;
  const nullOpps =
    opportunityStats.find((s) => !s.userId)?.count || 0;

  console.log(`   總 Opportunities: ${totalOpps} 個`);
  console.log(`   Service Account 創建: ${serviceAccountOpps} 個 (團隊共享)`);
  console.log(`   Null userId: ${nullOpps} 個 (團隊共享)`);
  console.log(`   其他用戶創建: ${totalOpps - serviceAccountOpps - nullOpps} 個`);

  console.log("\n📋 權限說明:");
  console.log("   - Admin/Manager: 可以看到所有資料");
  console.log("   - 一般業務: 可以看到自己的 + Service Account 的 + Null 的");
  console.log(
    "   - Service Account 和 Null 的資料視為團隊共享,所有人都能看到\n"
  );
}

main()
  .then(() => {
    console.log("✅ 檢查完成\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 錯誤:", error);
    process.exit(1);
  });
