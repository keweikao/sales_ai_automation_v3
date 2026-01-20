import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../apps/server/.env") });

async function checkMigrationStatus() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // Check if product_line column exists in opportunities table
    const checkOpportunities = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'opportunities' AND column_name = 'product_line';
    `);

    console.log("📊 Opportunities table - product_line column:");
    if (checkOpportunities.rows.length > 0) {
      console.log("  ✅ product_line column exists");
      console.log(
        `     Type: ${checkOpportunities.rows[0].data_type}, Default: ${checkOpportunities.rows[0].column_default}`
      );
    } else {
      console.log("  ❌ product_line column does NOT exist");
    }

    // Check conversations table
    const checkConversations = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'conversations' AND column_name = 'product_line';
    `);

    console.log("\n📊 Conversations table - product_line column:");
    if (checkConversations.rows.length > 0) {
      console.log("  ✅ product_line column exists");
      console.log(
        `     Type: ${checkConversations.rows[0].data_type}, Default: ${checkConversations.rows[0].column_default}`
      );
    } else {
      console.log("  ❌ product_line column does NOT exist");
    }

    // Check talk_tracks table
    const checkTalkTracks = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'talk_tracks' AND column_name = 'product_line';
    `);

    console.log("\n📊 Talk_tracks table - product_line column:");
    if (checkTalkTracks.rows.length > 0) {
      console.log("  ✅ product_line column exists");
      console.log(
        `     Type: ${checkTalkTracks.rows[0].data_type}, Default: ${checkTalkTracks.rows[0].column_default}`
      );
    } else {
      console.log("  ❌ product_line column does NOT exist");
    }

    // Check meddic_analyses table
    const checkMeddic = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'meddic_analyses' AND column_name = 'product_line';
    `);

    console.log("\n📊 Meddic_analyses table - product_line column:");
    if (checkMeddic.rows.length > 0) {
      console.log("  ✅ product_line column exists");
      console.log(
        `     Type: ${checkMeddic.rows[0].data_type}, Default: ${checkMeddic.rows[0].column_default}`
      );
    } else {
      console.log("  ❌ product_line column does NOT exist");
    }

    // Check indexes
    console.log("\n📊 Checking indexes:");
    const checkIndexes = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE indexname LIKE '%product_line%';
    `);

    if (checkIndexes.rows.length > 0) {
      console.log("  ✅ Product line indexes exist:");
      for (const row of checkIndexes.rows) {
        console.log(`     - ${row.indexname} on ${row.tablename}`);
      }
    } else {
      console.log("  ❌ No product_line indexes found");
    }

    console.log(`\n${"=".repeat(60)}\n`);

    // Summary
    const allColumnsExist =
      checkOpportunities.rows.length > 0 &&
      checkConversations.rows.length > 0 &&
      checkTalkTracks.rows.length > 0 &&
      checkMeddic.rows.length > 0;

    if (allColumnsExist && checkIndexes.rows.length >= 4) {
      console.log("✅ Migration 0003 已完成");
      console.log("   所有 product_line 欄位和索引都已建立\n");
      return true;
    }
    console.log("⚠️  Migration 0003 尚未完成");
    console.log("   需要執行 migration\n");
    return false;
  } catch (error) {
    console.error("❌ Error:", error);
    return false;
  } finally {
    await client.end();
  }
}

checkMigrationStatus();
