/**
 * Run Migration 0008: Add wonAt and lostAt timestamps
 * Usage: bun run packages/db/run-migration-0008.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log("🚀 Running migration 0008...");

    const sqlPath = path.join(
      __dirname,
      "migrations",
      "0008_add_won_lost_timestamps.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf-8");

    await pool.query(sql);

    console.log("✅ Migration 0008 completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
