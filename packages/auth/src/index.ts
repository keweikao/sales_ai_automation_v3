import { db } from "@Sales_ai_automation_v3/db";
import { userProfiles } from "@Sales_ai_automation_v3/db/schema";
import * as schema from "@Sales_ai_automation_v3/db/schema/auth";
import { env } from "@Sales_ai_automation_v3/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

/**
 * Email 到 Slack User ID 的映射表
 * 用於新用戶註冊時自動填入 slack_user_id
 */
const EMAIL_TO_SLACK_ID: Record<string, string> = {
  "stephen.kao@ichef.com.tw": "U0BU3PESX",
  "solo.chung@ichef.com.tw": "UCPDC51A4",
  "kevin.chen@ichef.com.tw": "UEVG3HUF4",
  "belle.chen@ichef.com.tw": "U07K188QJFQ",
  "eileen.lee@ichef.com.tw": "U8TC4Q7HB",
  "ariel.liu@ichef.com.tw": "U06U7HUEZFT",
  "kim.liang@ichef.com.tw": "U028Q69EKF1",
  "bonnie.liu@ichef.com.tw": "U01FS5DQT0T",
  "anna.yang@ichef.com.tw": "U015SA8USQ1",
  "eddie.chan@ichef.com.tw": "U0MATRQ2U",
  "joy.wu@ichef.com.tw": "U041VGKJGA1",
  "mai.chang@ichef.com.tw": "US97EGHJ5",
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",

    schema,
  }),
  trustedOrigins: [env.CORS_ORIGIN, env.WEB_APP_URL].filter(
    (origin): origin is string => Boolean(origin)
  ),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/google`,
    },
  },
  // cookieCache setting for Cloudflare deployment using *.workers.dev domains
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    },
    useSecureCookies: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // 當新用戶創建時，自動建立 user_profile
          // 如果 email 在映射表中，同時填入 slack_user_id
          const slackUserId = EMAIL_TO_SLACK_ID[user.email] || null;

          // 檢查是否已有 profile（避免重複建立）
          const existingProfile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.userId, user.id),
          });

          if (!existingProfile) {
            await db.insert(userProfiles).values({
              userId: user.id,
              role: "sales_rep",
              slackUserId,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else if (slackUserId && !existingProfile.slackUserId) {
            // 如果 profile 存在但沒有 slackUserId，更新它
            await db
              .update(userProfiles)
              .set({ slackUserId, updatedAt: new Date() })
              .where(eq(userProfiles.userId, user.id));
          }
        },
      },
    },
  },
});
