// scripts/migration/cleanup-unicode-opps.ts
/**
 * 清理有 Unicode 破折號的重複 opportunities
 */

import { sql } from "drizzle-orm";
import { db } from "./config";

async function main() {
  console.log("清理 Unicode 破折號的重複 opportunities...\n");

  // 找出有 Unicode 破折號的 opportunities
  // U+2010 是 ‐ (HYPHEN)
  const result = await db.execute(
    sql`SELECT id FROM opportunities WHERE id LIKE '%‐%'`
  );

  console.log(
    `找到 ${result.rows.length} 筆有 Unicode 破折號的 opportunities\n`
  );

  for (const row of result.rows) {
    const id = (row as { id: string }).id;
    console.log(`  刪除: "${id}"`);
  }

  if (result.rows.length > 0) {
    // 刪除這些重複的 opportunities
    await db.execute(sql`DELETE FROM opportunities WHERE id LIKE '%‐%'`);
    console.log(`\n✅ 已刪除 ${result.rows.length} 筆重複 opportunities`);
  }

  // 確認結果
  const countResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM opportunities`
  );
  console.log(
    `\n現在總共有 ${(countResult.rows[0] as { count: number }).count} 筆 opportunities`
  );
}

main();
