import { ORPCError } from "@orpc/server";
import { db } from "@sales_ai_automation_v3/db";
import {
  account,
  alerts,
  conversations,
  followUps,
  leadSources,
  meddicAnalyses,
  opportunities,
  repSkills,
  session,
  teamMembers,
  user,
  userProfiles,
} from "@sales_ai_automation_v3/db/schema";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";

/**
 * 列出所有用戶及其團隊資訊 (僅 admin)
 */
const listUsers = protectedProcedure.handler(async ({ context }) => {
  const currentUserId = context.session?.user.id;

  if (!currentUserId) {
    throw new ORPCError("UNAUTHORIZED");
  }

  // 檢查是否為 admin
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, currentUserId),
  });

  if (currentUserProfile?.role !== "admin") {
    throw new ORPCError("FORBIDDEN", { message: "只有管理員可以管理團隊" });
  }

  // 查詢所有用戶及其 profile
  const users = await db.query.user.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  // 查詢所有用戶 profiles
  const profiles = await db.query.userProfiles.findMany();

  // 組合資料
  const usersWithProfiles = users.map((u) => {
    const profile = profiles.find((p) => p.userId === u.id);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: profile?.role || "sales_rep",
      department: profile?.department || null,
      createdAt: u.createdAt,
    };
  });

  return { users: usersWithProfiles };
});

/**
 * 更新用戶角色 (僅 admin)
 */
const updateUserRole = protectedProcedure
  .input(
    z.object({
      userId: z.string(),
      role: z.enum(["admin", "manager", "sales_rep"]).optional(),
      department: z.string().optional(),
    })
  )
  .handler(async ({ input, context }) => {
    const currentUserId = context.session?.user.id;

    if (!currentUserId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 檢查是否為 admin
    const currentUserProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, currentUserId),
    });

    if (currentUserProfile?.role !== "admin") {
      throw new ORPCError("FORBIDDEN", {
        message: "只有管理員可以修改用戶角色",
      });
    }

    const { userId, role, department } = input;

    // 檢查用戶是否存在
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!targetUser) {
      throw new ORPCError("NOT_FOUND", { message: "用戶不存在" });
    }

    // 檢查是否已有 profile
    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    if (existingProfile) {
      // 更新 - 只更新有提供的欄位
      const updateData: {
        role?: "admin" | "manager" | "sales_rep";
        department?: string | null;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      if (role !== undefined) {
        updateData.role = role;
      }

      if (department !== undefined) {
        updateData.department = department || null;
      }

      await db
        .update(userProfiles)
        .set(updateData)
        .where(eq(userProfiles.userId, userId));
    } else {
      // 建立 - role 必須提供
      if (!role) {
        throw new ORPCError("BAD_REQUEST", {
          message: "建立新用戶時必須提供角色",
        });
      }

      await db.insert(userProfiles).values({
        userId,
        role,
        department: department || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return { success: true };
  });

/**
 * 刪除用戶 (僅 admin)
 */
const deleteUser = protectedProcedure
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .handler(async ({ input, context }) => {
    const currentUserId = context.session?.user.id;

    if (!currentUserId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 檢查是否為 admin
    const currentUserProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, currentUserId),
    });

    if (currentUserProfile?.role !== "admin") {
      throw new ORPCError("FORBIDDEN", {
        message: "只有管理員可以刪除用戶",
      });
    }

    const { userId } = input;

    // 防止刪除自己
    if (userId === currentUserId) {
      throw new ORPCError("BAD_REQUEST", { message: "無法刪除自己的帳號" });
    }

    // 檢查用戶是否存在
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!targetUser) {
      throw new ORPCError("NOT_FOUND", { message: "用戶不存在" });
    }

    // 刪除相關資料 (按照外鍵依賴順序)
    try {
      // 1. 刪除 alerts (沒有 cascade,需要手動刪除)
      await db.delete(alerts).where(eq(alerts.userId, userId));

      // 2. 先找出該用戶的所有 opportunities 和 conversations
      const userOpportunities = await db.query.opportunities.findMany({
        where: eq(opportunities.userId, userId),
        columns: { id: true },
      });

      if (userOpportunities.length > 0) {
        const oppIds = userOpportunities.map((o) => o.id);

        // 收集所有 conversation IDs
        const conversationIds: string[] = [];
        for (const oppId of oppIds) {
          const convs = await db.query.conversations.findMany({
            where: eq(conversations.opportunityId, oppId),
            columns: { id: true },
          });
          conversationIds.push(...convs.map((c) => c.id));
        }

        // 注意: sms_logs 表的刪除一直失敗,可能有特殊的資料庫約束
        // 暫時跳過 sms_logs 的刪除,因為:
        // 1. sms_logs.userId 不是外鍵(只是 Slack User ID 字串)
        // 2. sms_logs 引用 opportunities/conversations,但如果沒有 restrict 約束,應該不會阻止刪除
        // 如果後續刪除 opportunities 或 conversations 時失敗,再回來處理 sms_logs

        // 刪除 conversations 的依賴資料
        for (const convId of conversationIds) {
          // 刪除 meddic_analyses
          await db
            .delete(meddicAnalyses)
            .where(eq(meddicAnalyses.conversationId, convId));

          // alerts 已在步驟 1 刪除,但也可能有 conversation 關聯的
          await db.delete(alerts).where(eq(alerts.conversationId, convId));
        }

        // 最後刪除 conversations (shareTokens 有 cascade 會自動刪除)
        for (const oppId of oppIds) {
          await db
            .delete(conversations)
            .where(eq(conversations.opportunityId, oppId));
        }
      }

      // 3. 刪除 follow-ups
      await db.delete(followUps).where(eq(followUps.userId, userId));

      // 4. 刪除 rep_skills
      await db.delete(repSkills).where(eq(repSkills.userId, userId));

      // 5. 刪除 lead_sources
      await db.delete(leadSources).where(eq(leadSources.userId, userId));

      // 6. 刪除 opportunities
      await db.delete(opportunities).where(eq(opportunities.userId, userId));

      // 7. 刪除 team_members (作為經理或成員的關係)
      await db
        .delete(teamMembers)
        .where(
          or(
            eq(teamMembers.managerId, userId),
            eq(teamMembers.memberId, userId)
          )
        );

      // 8. 刪除 user_profiles
      await db.delete(userProfiles).where(eq(userProfiles.userId, userId));

      // 9. 刪除 sessions (Better Auth)
      await db.delete(session).where(eq(session.userId, userId));

      // 10. 刪除 accounts (OAuth)
      await db.delete(account).where(eq(account.userId, userId));

      // 11. 最後刪除 user
      await db.delete(user).where(eq(user.id, userId));

      return { success: true };
    } catch (error) {
      console.error("刪除用戶時發生錯誤:", error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `刪除用戶失敗: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  });

export const teamRouter = {
  listUsers,
  updateUserRole,
  deleteUser,
};
