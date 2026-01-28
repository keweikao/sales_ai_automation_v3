#!/usr/bin/env bun
// 檢查 user 表和 userProfiles 的關聯

import { db, userProfiles } from "./config";
import { user } from "../../packages/db/src/schema/auth";
import { sql } from "drizzle-orm";

async function debug() {
  console.log("🔍 檢查用戶表關聯");
  console.log("=".repeat(60));

  // 1. 查詢所有 users
  const users = await db.select().from(user);
  console.log("\n👤 user 表（BetterAuth 認證）:");
  for (const u of users) {
    console.log(`   ${u.id.substring(0, 12)}... | ${u.email?.padEnd(30)} | ${u.name}`);
  }

  // 2. 查詢所有 userProfiles
  const profiles = await db.select().from(userProfiles);
  console.log("\n📋 userProfiles 表（權限設定）:");
  for (const p of profiles) {
    console.log(`   ${p.userId.substring(0, 12)}... | role: ${p.role?.padEnd(10)} | dept: ${p.department}`);
  }

  // 3. 檢查對應關係
  console.log("\n🔗 用戶與權限對應:");
  for (const u of users) {
    const profile = profiles.find(p => p.userId === u.id);
    const status = profile
      ? `✅ role: ${profile.role}, dept: ${profile.department}`
      : `❌ 無 userProfile`;
    console.log(`   ${u.email?.padEnd(30)} | ${status}`);
  }

  console.log("\n" + "=".repeat(60));
  process.exit(0);
}

debug().catch((e) => {
  console.error(e);
  process.exit(1);
});
