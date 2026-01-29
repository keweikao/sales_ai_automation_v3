import { db } from "@Sales_ai_automation_v3/db";
import { conversations } from "@Sales_ai_automation_v3/db/schema";
import {
  generateCustomerSMSContent,
  generateShareToken,
  sendSMS,
} from "@Sales_ai_automation_v3/services";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";

/**
 * 發送客戶 SMS
 */
const sendCustomerSMS = protectedProcedure
  .input(
    z.object({
      conversationId: z.string(),
    })
  )
  .handler(async ({ input, context }) => {
    const { conversationId } = input;

    // 查詢 conversation 和相關資料
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        opportunity: true,
        meddicAnalyses: true,
      },
    });

    if (!conversation) {
      throw new ORPCError("NOT_FOUND", { message: "Conversation not found" });
    }

    // 檢查是否有客戶電話
    const phoneNumber = conversation.opportunity?.contactPhone;
    if (!phoneNumber) {
      throw new ORPCError("BAD_REQUEST", { message: "客戶電話號碼不存在" });
    }

    // 生成 share token
    const secret = context.env.SHARE_TOKEN_SECRET || "default-secret";
    const shareToken = generateShareToken(conversationId, secret);
    const shareUrl = `${context.env.WEB_APP_URL}/share/${shareToken}`;

    // 取得 MEDDIC 分數
    const latestMeddicAnalysis = conversation.meddicAnalyses?.[0];
    const meddicScore =
      conversation.meddicAnalysis?.overallScore ||
      latestMeddicAnalysis?.overallScore ||
      0;

    // 生成 SMS 內容
    const smsContent = generateCustomerSMSContent({
      companyName: conversation.opportunity?.companyName || "",
      caseNumber: conversation.caseNumber || "",
      meddicScore,
      shareUrl,
    });

    // 發送 SMS
    const smsResult = await sendSMS(
      {
        phoneNumber,
        message: smsContent,
        subject: "iCHEF",
      },
      {
        apiUrl: context.env.EVERY8D_API_URL ?? "",
        username: context.env.EVERY8D_USERNAME ?? "",
        password: context.env.EVERY8D_PASSWORD ?? "",
      }
    );

    // 更新 conversation 的 SMS 發送狀態
    if (smsResult.success) {
      await db
        .update(conversations)
        .set({
          smsSent: true,
          smsSentAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));
    }

    return {
      success: smsResult.success,
      message: smsResult.statusMessage,
      phoneNumber,
    };
  });

export const smsRouter = {
  sendCustomer: sendCustomerSMS,
};
