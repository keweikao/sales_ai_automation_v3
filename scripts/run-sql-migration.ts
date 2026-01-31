/**
 * Run SQL migration directly
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import * as fs from "node:fs";
import * as path from "node:path";

// Load env from apps/server/.env
config({ path: "apps/server/.env" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error("Usage: bun run scripts/run-sql-migration.ts <migration-file>");
  process.exit(1);
}

const migrationPath = path.resolve(migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const migration = fs.readFileSync(migrationPath, "utf-8");

console.log("Running migration:", migrationPath);
console.log("---");
console.log(migration);
console.log("---");

try {
  // Split by semicolons and run each statement
  const statements = migration
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  for (const statement of statements) {
    if (statement) {
      console.log(`Executing: ${statement.substring(0, 80)}...`);
      await sql(statement);
    }
  }

  console.log("Migration completed successfully!");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
