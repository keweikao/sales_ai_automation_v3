import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../apps/server/.env") });

async function applyMigration0003() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // Read migration SQL file
    const migrationPath = join(
      __dirname,
      "../packages/db/src/migrations/0003_add_product_line.sql"
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
      console.log("\n✅ Migration 0003 executed successfully!\n");

      // Verify
      console.log("🔍 Verifying migration...\n");

      const checkOpportunities = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'opportunities' AND column_name = 'product_line';
      `);

      if (checkOpportunities.rows.length > 0) {
        console.log("✅ opportunities.product_line created");
        console.log(
          `   Default: ${checkOpportunities.rows[0].column_default}\n`
        );
      }

      const checkIndexes = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE indexname LIKE '%product_line%';
      `);

      console.log(`✅ Created ${checkIndexes.rows.length} indexes:`);
      for (const row of checkIndexes.rows) {
        console.log(`   - ${row.indexname}`);
      }

      console.log(`\n${"=".repeat(60)}`);
      console.log("✅ Migration 0003 completed successfully!");
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

applyMigration0003();
