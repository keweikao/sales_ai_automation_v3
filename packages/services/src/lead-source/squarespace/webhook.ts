/**
 * Squarespace Webhook Handler
 * 處理 Squarespace 表單提交的 webhook
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  opportunities,
  leadSources,
  formSubmissions,
  utmCampaigns,
} from "@sales_ai_automation_v3/db";
import type { WebhookResult, FieldMapping } from "../types";
import type {
  SquarespaceFormPayload,
  SignatureVerificationResult,
} from "./types";
import {
  parseSquarespaceForm,
  generateDeduplicationKey,
  validateFormData,
} from "./mapper";
import { trackUTMCampaign } from "../utm/tracker";

/**
 * 驗證 Squarespace webhook 簽名
 */
export function verifySquarespaceSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): SignatureVerificationResult {
  if (!signature) {
    return { valid: false, error: "Missing signature header" };
  }

  try {
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // 使用 timingSafeEqual 防止時序攻擊
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: "Invalid signature length" };
    }

    const valid = timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!valid) {
      return { valid: false, error: "Signature mismatch" };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Signature verification failed",
    };
  }
}

/**
 * 產生 Opportunity ID
 */
function generateOpportunityId(): string {
  return `opp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 產生 Customer Number
 */
function generateCustomerNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${year}${month}-${random}`;
}

/**
 * 處理 Squarespace webhook
 */
export async function handleSquarespaceWebhook(options: {
  payload: SquarespaceFormPayload;
  rawPayload: string;
  signature?: string;
  sourceId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<WebhookResult> {
  const {
    payload,
    rawPayload,
    signature,
    sourceId,
    userId,
    ipAddress,
    userAgent,
  } = options;

  // 取得來源設定
  const [source] = await db
    .select()
    .from(leadSources)
    .where(eq(leadSources.id, sourceId))
    .limit(1);

  if (!source) {
    return { success: false, message: "Invalid source ID" };
  }

  // 驗證簽名（如果有設定 secret）
  if (source.webhookSecret) {
    const verification = verifySquarespaceSignature(
      rawPayload,
      signature,
      source.webhookSecret
    );

    if (!verification.valid) {
      return {
        success: false,
        message: `Signature verification failed: ${verification.error}`,
      };
    }
  }

  // 建立表單提交記錄
  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  await db.insert(formSubmissions).values({
    id: submissionId,
    sourceId,
    sourceType: "squarespace",
    rawPayload: payload as unknown as Record<string, unknown>,
    status: "pending",
    ipAddress,
    userAgent,
    submittedAt: new Date(),
    createdAt: new Date(),
  });

  try {
    // 解析表單資料
    const fieldMapping = source.fieldMapping as FieldMapping | null;
    const parsedData = parseSquarespaceForm(payload, fieldMapping || undefined);

    // 驗證必填欄位
    const validation = validateFormData(parsedData);
    if (!validation.valid) {
      await db
        .update(formSubmissions)
        .set({
          status: "failed",
          errorMessage: validation.errors.join(", "),
          processedAt: new Date(),
        })
        .where(eq(formSubmissions.id, submissionId));

      return {
        success: false,
        message: `Validation failed: ${validation.errors.join(", ")}`,
      };
    }

    // 檢查重複
    const dedupeKey = generateDeduplicationKey(parsedData);
    const existingOpportunity = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.contactEmail, parsedData.contactEmail || ""))
      .limit(1);

    if (existingOpportunity.length > 0 && parsedData.contactEmail) {
      await db
        .update(formSubmissions)
        .set({
          status: "duplicate",
          opportunityId: existingOpportunity[0].id,
          processedAt: new Date(),
        })
        .where(eq(formSubmissions.id, submissionId));

      return {
        success: true,
        opportunityId: existingOpportunity[0].id,
        message: "Duplicate submission - linked to existing opportunity",
        isDuplicate: true,
      };
    }

    // 建立新的 Opportunity
    const opportunityId = generateOpportunityId();
    const customerNumber = generateCustomerNumber();

    await db.insert(opportunities).values({
      id: opportunityId,
      userId,
      customerNumber,
      companyName: parsedData.companyName,
      contactName: parsedData.contactName,
      contactEmail: parsedData.contactEmail,
      contactPhone: parsedData.contactPhone,
      notes: parsedData.notes,
      source: "squarespace",
      sourceId,
      status: "new",
      utmSource: parsedData.utm.utmSource,
      utmMedium: parsedData.utm.utmMedium,
      utmCampaign: parsedData.utm.utmCampaign,
      utmTerm: parsedData.utm.utmTerm,
      utmContent: parsedData.utm.utmContent,
      firstTouchAt: new Date(),
      rawFormData: parsedData.rawData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 更新表單提交狀態
    await db
      .update(formSubmissions)
      .set({
        status: "processed",
        parsedData: parsedData as unknown as Record<string, unknown>,
        opportunityId,
        processedAt: new Date(),
      })
      .where(eq(formSubmissions.id, submissionId));

    // 更新來源統計
    await db
      .update(leadSources)
      .set({
        totalLeads: (source.totalLeads || 0) + 1,
        lastLeadAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadSources.id, sourceId));

    // 追蹤 UTM Campaign
    if (parsedData.utm.utmSource) {
      await trackUTMCampaign({
        userId,
        utm: parsedData.utm,
        isConversion: false,
      });
    }

    return {
      success: true,
      opportunityId,
      message: "Opportunity created successfully",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await db
      .update(formSubmissions)
      .set({
        status: "failed",
        errorMessage,
        processedAt: new Date(),
      })
      .where(eq(formSubmissions.id, submissionId));

    return {
      success: false,
      message: `Processing failed: ${errorMessage}`,
    };
  }
}
