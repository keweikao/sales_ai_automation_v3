// scripts/migration/check-specific-opp.ts
import { sql } from "drizzle-orm";
import { db } from "./config";

async function main() {
  // 檢查具體的 opportunity_id 是否存在
  const idsToCheck = [
    "202512-122868",
    "202512-122778",
    "202512-123026",
    "202511-122521",
    "202512-000001",
    "202512-123108",
    "202512-122969",
    "202512-122860",
    "202512-123016",
    "202512-123141",
    "202512-123168",
    "202512-123163",
    "202512-122914",
    "202512-123210",
    "202601-123241",
    "202512-122978",
  ];

  console.log("檢查 opportunity IDs...\n");

  for (const id of idsToCheck) {
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM opportunities WHERE id = ${id}`
    );
    const count = (result.rows[0] as { count: number }).count;
    console.log(`  "${id}": ${count > 0 ? "✅ 存在" : "❌ 不存在"}`);
  }

  // 列出所有 202512 開頭的 opportunities
  console.log("\n\n=== 202512 開頭的 opportunities ===");
  const result = await db.execute(
    sql`SELECT id FROM opportunities WHERE id LIKE '202512%' ORDER BY id`
  );
  for (const row of result.rows) {
    console.log(`  "${(row as { id: string }).id}"`);
  }

  // 列出所有 202601 開頭的 opportunities
  console.log("\n\n=== 202601 開頭的 opportunities ===");
  const result2 = await db.execute(
    sql`SELECT id FROM opportunities WHERE id LIKE '202601%' ORDER BY id`
  );
  for (const row of result2.rows) {
    console.log(`  "${(row as { id: string }).id}"`);
  }

  // 列出 opportunities 總數
  const countResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM opportunities`
  );
  console.log(`\n總共有 ${(countResult.rows[0] as { count: number }).count} 筆 opportunities`);
}

main();
