import { ORPCError } from "@orpc/server";
import { db } from "@sales_ai_automation_v3/db";
import { conversations, shareTokens } from "@sales_ai_automation_v3/db/schema";
import {
  generateShareToken,
  getTokenExpiry,
} from "@sales_ai_automation_v3/services";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../index";

/**
 * 生成公開分享 Token (需要登入)
 */
const createShareToken = protectedProcedure
  .input(
    z.object({
      conversationId: z.string(),
    })
  )
  .handler(async ({ input, context }) => {
    const { conversationId } = input;

    // 檢查 conversation 是否存在
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND", { message: "Conversation not found" });
    }

    // 檢查是否已有有效的 token
    const existingToken = await db.query.shareTokens.findFirst({
      where: and(
        eq(shareTokens.conversationId, conversationId),
        eq(shareTokens.isRevoked, false)
      ),
    });

    if (existingToken && new Date(existingToken.expiresAt) > new Date()) {
      // 返回現有 token
      return {
        token: existingToken.token,
        expiresAt: existingToken.expiresAt,
      };
    }

    // 生成新 token
    const secret = context.env.SHARE_TOKEN_SECRET || "default-secret"; // 從環境變數取得
    const token = generateShareToken(conversationId, secret);
    const expiresAt = getTokenExpiry(14); // 14 天有效

    // 儲存到資料庫
    const [newToken] = await db
      .insert(shareTokens)
      .values({
        id: nanoid(),
        conversationId,
        token,
        expiresAt,
        isRevoked: false,
        viewCount: "0",
      })
      .returning();

    if (!newToken) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create share token",
      });
    }

    return {
      token: newToken.token,
      expiresAt: newToken.expiresAt,
    };
  });

/**
 * 透過 Token 取得 Conversation 詳情（公開 API，不需登入）
 */
const getConversationByToken = publicProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { token } = input;

    // 查詢 token
    const shareToken = await db.query.shareTokens.findFirst({
      where: eq(shareTokens.token, token),
    });

    if (!shareToken) {
      throw new ORPCError("NOT_FOUND", {
        message: "Invalid or expired share link",
      });
    }

    // 檢查是否過期
    if (new Date(shareToken.expiresAt) < new Date()) {
      throw new ORPCError("FORBIDDEN", { message: "Share link has expired" });
    }

    // 檢查是否被撤銷
    if (shareToken.isRevoked) {
      throw new ORPCError("FORBIDDEN", {
        message: "Share link has been revoked",
      });
    }

    // 更新查看次數和最後查看時間
    await db
      .update(shareTokens)
      .set({
        viewCount: String(Number(shareToken.viewCount) + 1),
        lastViewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shareTokens.id, shareToken.id));

    // 查詢完整的 conversation 資料
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, shareToken.conversationId),
      with: {
        opportunity: true,
        meddicAnalyses: true,
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND", { message: "Conversation not found" });
    }

    // 取得最新的 MEDDIC 分析
    const latestMeddicAnalysis = conversation.meddicAnalyses?.[0];

    // 返回公開可見的資料（移除敏感資訊）
    return {
      id: conversation.id,
      caseNumber: conversation.caseNumber,
      status: conversation.status,
      companyName: conversation.opportunity?.companyName || "",
      conversationDate: conversation.conversationDate,
      duration: conversation.duration,
      transcript: conversation.transcript,
      summary: conversation.summary, // Agent 4 生成的會議摘要
      meddicAnalysis: conversation.meddicAnalysis
        ? {
            overallScore: conversation.meddicAnalysis.overallScore,
            status: conversation.meddicAnalysis.status,
            dimensions: conversation.meddicAnalysis.dimensions,
          }
        : latestMeddicAnalysis
          ? {
              overallScore: latestMeddicAnalysis.overallScore,
              status: latestMeddicAnalysis.status,
              dimensions: latestMeddicAnalysis.dimensions,
            }
          : null,
      opportunity: conversation.opportunity
        ? {
            customerNumber: conversation.opportunity.customerNumber,
            companyName: conversation.opportunity.companyName,
          }
        : null,
      slackUser: conversation.slackUserId
        ? {
            slackUsername: conversation.slackUsername,
          }
        : null,
      createdAt: conversation.createdAt,
    };
  });

export const shareRouter = {
  create: createShareToken,
  getByToken: getConversationByToken,
};
