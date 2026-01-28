#!/usr/bin/env bun
import { db, opportunities } from "./config";
import { sql } from "drizzle-orm";

async function check() {
  const byProductLine = await db
    .select({
      productLine: opportunities.productLine,
      source: opportunities.source,
      count: sql<number>`count(*)`,
    })
    .from(opportunities)
    .groupBy(opportunities.productLine, opportunities.source);

  console.log("📊 按 productLine 和 source 分組:");
  for (const r of byProductLine) {
    console.log(`   ${r.productLine?.padEnd(10) || "NULL".padEnd(10)} | ${r.source?.padEnd(10) || "NULL".padEnd(10)} | ${r.count} 筆`);
  }
  process.exit(0);
}
check();
