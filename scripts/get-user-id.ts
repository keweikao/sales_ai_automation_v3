import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("Connecting to database...");

  // Check if users table exists and get users
  try {
    const users =
      await sql`SELECT id, name, email, created_at FROM "user" LIMIT 5`;

    if (users.length === 0) {
      console.log("\n⚠️  No users found in database.");
      console.log("\nTo create a user for migration, you have two options:");
      console.log("\n1. Start the V3 server and login via Google OAuth");
      console.log(
        "2. Or use Neon Console (https://console.neon.tech) SQL Editor to insert a user:\n"
      );
      console.log(
        `   INSERT INTO "user" (id, name, email, created_at, updated_at)`
      );
      console.log("   VALUES (");
      console.log(`     'migration-user-' || gen_random_uuid(),`);
      console.log(`     'Migration User',`);
      console.log(`     'migration@example.com',`);
      console.log("     NOW(),");
      console.log("     NOW()");
      console.log("   ) RETURNING id;");
    } else {
      console.log("\n✅ Found users in database:\n");
      console.log("ID\t\t\t\t\t\tName\t\t\tEmail");
      console.log("-".repeat(80));
      for (const user of users) {
        console.log(
          `${user.id}\t${user.name || "N/A"}\t\t${user.email || "N/A"}`
        );
      }
      console.log(
        "\n📋 Copy one of the IDs above and set it as MIGRATION_USER_ID in .env.migration"
      );
    }
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.includes("does not exist")) {
      console.log("\n⚠️  The 'user' table does not exist yet.");
      console.log("Please run database migrations first: bun run db:push");
    } else {
      console.error("Database error:", err.message);
    }
  }
}

main().catch(console.error);
