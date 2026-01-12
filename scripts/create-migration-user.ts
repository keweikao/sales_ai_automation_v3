import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("Creating migration user...");

  try {
    const result = await sql`
      INSERT INTO "user" (id, name, email, created_at, updated_at)
      VALUES (
        'migration-user-' || gen_random_uuid(),
        'Migration User',
        'migration@sales-ai.local',
        NOW(),
        NOW()
      )
      RETURNING id, name, email
    `;

    if (result.length > 0) {
      const user = result[0];
      console.log("\n✅ Migration user created successfully!\n");
      console.log("User details:");
      console.log(`  ID:    ${user.id}`);
      console.log(`  Name:  ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log("\n📋 Copy the ID above and set it in .env.migration:");
      console.log(`   MIGRATION_USER_ID=${user.id}`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error creating user:", err.message);
  }
}

main().catch(console.error);
