import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function removeServiceAccount() {
  console.log("Searching for service account user...\n");

  try {
    // 1. 查詢包含 "service" 關鍵字的用戶
    const users = await sql`
      SELECT id, name, email, created_at
      FROM "user"
      WHERE email ILIKE '%service%'
      ORDER BY created_at
    `;

    if (users.length === 0) {
      console.log("✅ No service account users found.");
      process.exit(0);
    }

    console.log(`Found ${users.length} service account user(s):\n`);
    for (const user of users) {
      console.log(`  User ID: ${user.id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Created: ${user.created_at}\n`);
    }

    // 2. 顯示警告並確認
    console.log("⚠️  WARNING: This will DELETE the following records:");
    console.log("   - User accounts");
    console.log("   - User profiles");
    console.log("   - Sessions");
    console.log("   - Accounts (OAuth connections)\n");

    // 由於是腳本執行,直接執行刪除
    for (const user of users) {
      console.log(`Deleting user: ${user.email}...`);

      // 刪除 user_profiles
      await sql`
        DELETE FROM user_profiles
        WHERE user_id = ${user.id}
      `;
      console.log("  ✓ Deleted user_profiles");

      // 刪除 sessions
      await sql`
        DELETE FROM session
        WHERE user_id = ${user.id}
      `;
      console.log("  ✓ Deleted sessions");

      // 刪除 accounts
      await sql`
        DELETE FROM account
        WHERE user_id = ${user.id}
      `;
      console.log("  ✓ Deleted accounts");

      // 最後刪除 user
      await sql`
        DELETE FROM "user"
        WHERE id = ${user.id}
      `;
      console.log("  ✓ Deleted user\n");
    }

    console.log("✅ Successfully removed all service account users!");
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

removeServiceAccount().catch(console.error);
