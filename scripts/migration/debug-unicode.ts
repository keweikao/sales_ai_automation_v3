// scripts/migration/debug-unicode.ts
/**
 * 調試 Unicode 破折號問題
 */

import { sql } from "drizzle-orm";
import { db, firestore } from "./config";
import { parseV2Case } from "./types-v2";

function normalizeCustomerId(customerId: string): string {
  if (!customerId) return customerId;
  return customerId.replace(/[\u2010-\u2014\u2212\uFE58\uFE63\uFF0D]/g, "-");
}

function hasUnicodeDash(str: string): boolean {
  return /[\u2010-\u2014\u2212\uFE58\uFE63\uFF0D]/.test(str);
}

async function main() {
  console.log("調試 Unicode 破折號問題...\n");

  // 讀取 Firestore cases
  const casesSnapshot = await firestore.collection("cases").get();

  console.log(`找到 ${casesSnapshot.size} 筆 cases\n`);

  // 找出有 Unicode 破折號的 customerId
  const unicodeIds: string[] = [];
  const normalIds: string[] = [];

  for (const doc of casesSnapshot.docs) {
    const v2Case = parseV2Case(doc.id, doc.data());
    const customerId = v2Case.customerId;

    if (hasUnicodeDash(customerId)) {
      unicodeIds.push(customerId);
    } else {
      normalIds.push(customerId);
    }
  }

  console.log(`\n=== Unicode 破折號 customerId (${unicodeIds.length} 筆) ===`);
  for (const id of unicodeIds.slice(0, 10)) {
    const normalized = normalizeCustomerId(id);
    console.log(`  原始: "${id}" → 正規化: "${normalized}"`);
    // 顯示字元碼
    for (let i = 0; i < id.length; i++) {
      const char = id[i];
      const code = id.charCodeAt(i);
      if (code > 127) {
        console.log(`    字元 [${i}]: "${char}" = U+${code.toString(16).toUpperCase().padStart(4, "0")}`);
      }
    }
  }

  console.log(`\n=== 正常 customerId (${normalIds.length} 筆) ===`);
  for (const id of normalIds.slice(0, 5)) {
    console.log(`  "${id}"`);
  }

  // 檢查資料庫中的 opportunities
  console.log("\n=== 資料庫中的 opportunities ===");
  const oppsResult = await db.execute(
    sql`SELECT id FROM opportunities ORDER BY id LIMIT 10`
  );
  for (const row of oppsResult.rows) {
    const r = row as { id: string };
    console.log(`  "${r.id}"`);
    for (let i = 0; i < r.id.length; i++) {
      const code = r.id.charCodeAt(i);
      if (code > 127) {
        console.log(`    字元 [${i}]: "${r.id[i]}" = U+${code.toString(16).toUpperCase().padStart(4, "0")}`);
      }
    }
  }

  // 檢查有問題的 customerId 是否在 opportunities 中
  console.log("\n=== 檢查有問題的 customerId 是否在 opportunities 中 ===");
  const problematicIds = ["202512-122778", "202512-123026", "202511-122521"];
  for (const id of problematicIds) {
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM opportunities WHERE id = ${id}`
    );
    const count = (result.rows[0] as { count: number }).count;
    console.log(`  "${id}": ${count > 0 ? "存在" : "不存在"}`);
  }
}

main();
