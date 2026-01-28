// scripts/migration/user-mapping.ts

import { eq } from "drizzle-orm";
import { db, userProfiles } from "./config";

// Slack User ID → PostgreSQL User ID 映射快取
const userIdCache = new Map<string, string>();

/**
 * 解析 Slack User ID 為 PostgreSQL User ID
 *
 * 查詢優先順序:
 * 1. 快取查詢
 * 2. 資料庫 user_profiles.slackUserId 查詢
 * 3. 後備方案: "service-account"
 */
export async function resolveUserId(slackUserId: string): Promise<string> {
  if (!slackUserId) {
    return "service-account";
  }

  // 快取命中
  if (userIdCache.has(slackUserId)) {
    return userIdCache.get(slackUserId)!;
  }

  try {
    // 資料庫查詢
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.slackUserId, slackUserId),
      columns: { userId: true },
    });

    const userId = profile?.userId || "service-account";

    // 更新快取
    userIdCache.set(slackUserId, userId);

    return userId;
  } catch (error) {
    console.warn(`⚠️  無法查詢 Slack User ID ${slackUserId}:`, error);
    userIdCache.set(slackUserId, "service-account");
    return "service-account";
  }
}

/**
 * 預載所有用戶映射到快取
 * 建議在遷移開始前調用
 */
export async function preloadUserMappings(): Promise<void> {
  try {
    const profiles = await db.query.userProfiles.findMany({
      columns: { slackUserId: true, userId: true },
    });

    for (const profile of profiles) {
      if (profile.slackUserId) {
        userIdCache.set(profile.slackUserId, profile.userId);
      }
    }

    console.log(`✅ 預載 ${userIdCache.size} 個用戶映射`);
  } catch (error) {
    console.error("❌ 預載用戶映射失敗:", error);
    throw error;
  }
}

/**
 * 取得映射統計
 */
export function getUserMappingStats() {
  return {
    totalCached: userIdCache.size,
    mappings: Array.from(userIdCache.entries()),
  };
}

/**
 * 清空快取
 */
export function clearUserMappingCache(): void {
  userIdCache.clear();
}
