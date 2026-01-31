/**
 * 查詢 M 開頭案件編號的對話狀態
 * Usage: bun run scripts/check-m-cases.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { conversations } from "../packages/db/src/schema/conversation";
import { like, or, desc, ne } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log("=== 查詢 M 開頭案件 ===\n");

  // 查詢 legacy_case_id 以 M 開頭的對話
  const mCases = await db
    .select({
      id: conversations.id,
      caseNumber: conversations.caseNumber,
      legacyCaseId: conversations.legacyCaseId,
      title: conversations.title,
      status: conversations.status,
      errorMessage: conversations.errorMessage,
      audioUrl: conversations.audioUrl,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(like(conversations.legacyCaseId, "M%"))
    .orderBy(desc(conversations.createdAt));

  console.log(`找到 ${mCases.length} 個 M 開頭案件\n`);

  // 按狀態分類
  const byStatus: Record<string, typeof mCases> = {};
  for (const c of mCases) {
    const status = c.status || "unknown";
    if (!byStatus[status]) {
      byStatus[status] = [];
    }
    byStatus[status].push(c);
  }

  // 顯示統計
  console.log("=== 狀態統計 ===");
  for (const [status, cases] of Object.entries(byStatus)) {
    console.log(`${status}: ${cases.length} 個`);
  }

  // 顯示未完成的案件詳情
  const incompleteStatuses = ["pending", "failed", "transcribing"];
  const incomplete = mCases.filter((c) =>
    incompleteStatuses.includes(c.status || "")
  );

  if (incomplete.length > 0) {
    console.log("\n=== 未完成的案件詳情 ===");
    for (const c of incomplete) {
      console.log(`\n案件: ${c.legacyCaseId} (${c.caseNumber})`);
      console.log(`  狀態: ${c.status}`);
      console.log(`  標題: ${c.title}`);
      console.log(`  錯誤: ${c.errorMessage || "無"}`);
      console.log(`  音檔: ${c.audioUrl ? "有" : "無"}`);
      console.log(`  建立: ${c.createdAt}`);
    }
  } else {
    console.log("\n✅ 所有 M 開頭案件都已完成處理");
  }

  // 輸出可重試的案件編號
  const retryable = incomplete.filter(
    (c) => c.audioUrl && ["pending", "failed"].includes(c.status || "")
  );
  if (retryable.length > 0) {
    console.log("\n=== 可重試的案件編號 ===");
    for (const c of retryable) {
      console.log(c.caseNumber);
    }
  }
}

main().catch(console.error);
