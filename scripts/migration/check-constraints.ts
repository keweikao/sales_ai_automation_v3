// scripts/migration/check-constraints.ts
import { sql } from "drizzle-orm";
import { db } from "./config";

async function main() {
  // 檢查外鍵約束
  const fkResult = await db.execute(sql`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'conversations'
      AND tc.constraint_type = 'FOREIGN KEY'
  `);

  console.log("conversations 表外鍵約束：");
  for (const row of fkResult.rows) {
    const r = row as Record<string, unknown>;
    console.log(
      `  ${r.column_name} → ${r.foreign_table_name}.${r.foreign_column_name} (${r.constraint_name})`
    );
  }

  // 檢查 NOT NULL 欄位
  console.log("\n\nNOT NULL 欄位：");
  const nnResult = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'conversations'
      AND is_nullable = 'NO'
  `);
  for (const row of nnResult.rows) {
    console.log(`  ${(row as { column_name: string }).column_name}`);
  }
}

main();
