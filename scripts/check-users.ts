import { db } from "../packages/db/src/index.ts";
import { user, userProfiles } from "../packages/db/src/schema/index.ts";
import { desc } from "drizzle-orm";

const users = await db
  .select({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  })
  .from(user)
  .orderBy(desc(user.createdAt))
  .limit(10);

console.log("=== 最近註冊的用戶 ===");
for (const u of users) {
  const date = u.createdAt ? u.createdAt.toISOString() : "N/A";
  console.log(`${date} | ${u.email} | ${u.name}`);
}

const profiles = await db.select().from(userProfiles).limit(20);
console.log(`\n=== User Profiles (共 ${profiles.length} 筆) ===`);
for (const p of profiles) {
  console.log(`userId: ${p.userId} | role: ${p.role} | dept: ${p.department} | slack: ${p.slackUserId}`);
}

process.exit(0);
