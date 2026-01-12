// scripts/migration/check-db-schema.ts
import { sql } from "drizzle-orm";
import { db } from "./config";

async function main() {
  const result = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'conversations'
    ORDER BY ordinal_position
  `);

  console.log("conversations 表欄位：");
  for (const row of result.rows) {
    const r = row as Record<string, unknown>;
    console.log(
      `  ${r.column_name}: ${r.data_type} (${r.is_nullable === "NO" ? "NOT NULL" : "nullable"}) ${r.column_default || ""}`
    );
  }
}

main();
