import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function checkUserReferences(userId: string) {
  console.log(`Checking references for user: ${userId}\n`);

  // Check all tables that might reference the user
  const tables = [
    { name: "alerts", column: "user_id" },
    { name: "team_members (manager)", column: "manager_id" },
    { name: "team_members (member)", column: "member_id" },
    { name: "user_profiles", column: "user_id" },
    { name: "session", column: "user_id" },
    { name: "account", column: "user_id" },
    { name: "opportunities", column: "user_id" },
    { name: "follow_ups", column: "user_id" },
    { name: "rep_skills", column: "user_id" },
    { name: "lead_sources", column: "user_id" },
    { name: "conversations", column: "user_id" },
  ];

  for (const table of tables) {
    try {
      let query;
      if (table.name.includes("team_members")) {
        const column = table.column;
        query = `SELECT COUNT(*) as count FROM team_members WHERE ${column} = $1`;
      } else {
        query = `SELECT COUNT(*) as count FROM ${table.name} WHERE ${table.column} = $1`;
      }

      const result = await sql(query, [userId]);
      const count = Number(result[0]?.count || 0);

      if (count > 0) {
        console.log(`✓ ${table.name}: ${count} record(s)`);
      }
    } catch (error) {
      // Table might not exist or column might not exist
      console.log(`⚠ ${table.name}: ${error instanceof Error ? error.message : "error"}`);
    }
  }
}

const userId = process.argv[2] || "service-account";
checkUserReferences(userId).catch(console.error);
