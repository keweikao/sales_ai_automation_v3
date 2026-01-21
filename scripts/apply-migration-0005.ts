import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../apps/server/.env") });

async function applyMigration0005() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // Read migration SQL file
    const migrationPath = join(
      __dirname,
      "../packages/db/migrations/0005_add_sms_sent_to_conversations.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Migration SQL:");
    console.log("─".repeat(60));
    console.log(migrationSQL);
    console.log(`${"─".repeat(60)}\n`);

    console.log("🚀 Executing migration...\n");

    // Execute migration in a transaction
    await client.query("BEGIN");

    try {
      // Execute statements in order, handling multi-line statements properly
      const lines = migrationSQL.split("\n");
      let currentStatement = "";

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip comments and empty lines
        if (trimmedLine.startsWith("--") || trimmedLine === "") {
          continue;
        }

        currentStatement += ` ${trimmedLine}`;

        // Execute when we hit a semicolon
        if (trimmedLine.endsWith(";")) {
          const statement = currentStatement.trim();
          if (statement && statement !== ";") {
            const preview = statement.substring(0, 60).replace(/\s+/g, " ");
            console.log(`   Executing: ${preview}...`);
            await client.query(statement);
          }
          currentStatement = "";
        }
      }

      await client.query("COMMIT");
      console.log("\n✅ Migration 0005 executed successfully!\n");

      // Verify
      console.log("🔍 Verifying migration...\n");

      const checkColumns = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'conversations'
          AND column_name IN ('sms_sent', 'sms_sent_at');
      `);

      if (checkColumns.rows.length > 0) {
        console.log("✅ SMS columns created:");
        for (const row of checkColumns.rows) {
          console.log(`   - ${row.column_name} (${row.data_type})`);
          if (row.column_default) {
            console.log(`     Default: ${row.column_default}`);
          }
        }
        console.log();
      }

      const checkIndexes = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'conversations' AND indexname LIKE '%sms%';
      `);

      console.log(`✅ Created ${checkIndexes.rows.length} index(es):`);
      for (const row of checkIndexes.rows) {
        console.log(`   - ${row.indexname}`);
      }

      console.log(`\n${"=".repeat(60)}`);
      console.log("✅ Migration 0005 completed successfully!");
      console.log(`${"=".repeat(60)}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.error("\nRolling back changes...");
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration0005();
