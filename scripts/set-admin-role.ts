import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function setAdminRole(email: string) {
  console.log(`Setting admin role for ${email}...\n`);

  try {
    // 1. 查詢 user (Better Auth)
    const users = await sql`
      SELECT id, name, email
      FROM "user"
      WHERE email = ${email}
    `;

    if (users.length === 0) {
      console.log(`❌ No user found with email: ${email}`);
      console.log("Please ensure the user has logged in via Google OAuth first.");
      process.exit(1);
    }

    const user = users[0];
    console.log("✅ User found:");
    console.log(`   User ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}\n`);

    // 2. 檢查 user_profiles
    const profiles = await sql`
      SELECT user_id, role
      FROM user_profiles
      WHERE user_id = ${user.id}
    `;

    if (profiles.length === 0) {
      // 建立新的 profile
      console.log("Creating new user_profiles record...");
      await sql`
        INSERT INTO user_profiles (user_id, role, created_at, updated_at)
        VALUES (${user.id}, 'admin', NOW(), NOW())
      `;
      console.log("✅ Created user_profiles with role='admin'\n");
    } else {
      // 更新現有 profile
      const currentRole = profiles[0].role;
      console.log(`Current role: ${currentRole}`);

      if (currentRole === "admin") {
        console.log("✅ User already has admin role. No changes needed.\n");
      } else {
        console.log("Updating role to 'admin'...");
        await sql`
          UPDATE user_profiles
          SET role = 'admin', updated_at = NOW()
          WHERE user_id = ${user.id}
        `;
        console.log(`✅ Updated role from '${currentRole}' to 'admin'\n`);
      }
    }

    // 3. 驗證結果
    const finalProfile = await sql`
      SELECT user_id, role
      FROM user_profiles
      WHERE user_id = ${user.id}
    `;

    console.log("Final user_profiles record:");
    console.log(`   User ID: ${finalProfile[0].user_id}`);
    console.log(`   Role: ${finalProfile[0].role}`);
    console.log("\n✅ Successfully set admin role!");
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

// 使用方式: bun run scripts/set-admin-role.ts
const email = process.argv[2] || "stephen.kao@ichef.com.tw";
setAdminRole(email).catch(console.error);
