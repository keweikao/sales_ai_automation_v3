/**
 * Lead Source API Router
 * 潛客來源管理與 Webhook 處理
 */

import { db } from "@Sales_ai_automation_v3/db";
import type {
  FormSubmission,
  LeadSource,
  UTMCampaign,
} from "@Sales_ai_automation_v3/db/schema";
import {
  formSubmissions,
  leadSources,
  utmCampaigns,
} from "@Sales_ai_automation_v3/db/schema";
import {
  getCampaignStats,
  getSourceAttribution,
  handleSquarespaceWebhook,
} from "@Sales_ai_automation_v3/services";
import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const createLeadSourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["squarespace", "manual", "import", "api", "referral"]),
  description: z.string().optional(),
  webhookSecret: z.string().optional(),
  fieldMapping: z
    .object({
      companyName: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

const updateLeadSourceSchema = z.object({
  sourceId: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  webhookSecret: z.string().optional(),
  fieldMapping: z
    .object({
      companyName: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

const squarespaceWebhookSchema = z.object({
  sourceId: z.string(),
  payload: z.any(),
  signature: z.string().optional(),
});

const getStatsSchema = z.object({
  sourceId: z.string().optional(),
});

const getCampaignSchema = z.object({
  campaignId: z.string(),
});

// ============================================================
// Create Lead Source
// ============================================================

export const createLeadSource = protectedProcedure
  .input(createLeadSourceSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const sourceId = `src_${randomUUID()}`;

    const result = await db
      .insert(leadSources)
      .values({
        id: sourceId,
        userId,
        name: input.name,
        type: input.type,
        description: input.description,
        webhookSecret: input.webhookSecret,
        fieldMapping: input.fieldMapping,
        isActive: "true",
        totalLeads: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const source = result[0];
    if (!source) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // 產生 webhook URL
    const webhookUrl =
      input.type === "squarespace"
        ? `/api/webhooks/squarespace/${sourceId}`
        : undefined;

    return {
      id: source.id,
      name: source.name,
      type: source.type,
      description: source.description,
      webhookUrl,
      isActive: source.isActive === "true",
      totalLeads: source.totalLeads || 0,
      createdAt: source.createdAt,
    };
  });

// ============================================================
// Update Lead Source
// ============================================================

export const updateLeadSource = protectedProcedure
  .input(updateLeadSourceSchema)
  .handler(async ({ input, context }) => {
    const { sourceId, ...updates } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const existing = await db.query.leadSources.findFirst({
      where: and(eq(leadSources.id, sourceId), eq(leadSources.userId, userId)),
    });

    if (!existing) {
      throw new ORPCError("NOT_FOUND");
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive ? "true" : "false";
    }
    if (updates.webhookSecret !== undefined) {
      updateData.webhookSecret = updates.webhookSecret;
    }
    if (updates.fieldMapping !== undefined) {
      updateData.fieldMapping = updates.fieldMapping;
    }

    const result = await db
      .update(leadSources)
      .set(updateData)
      .where(eq(leadSources.id, sourceId))
      .returning();

    const source = result[0];
    if (!source) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      id: source.id,
      name: source.name,
      type: source.type,
      description: source.description,
      isActive: source.isActive === "true",
      totalLeads: source.totalLeads || 0,
      updatedAt: source.updatedAt,
    };
  });

// ============================================================
// List Lead Sources
// ============================================================

export const listLeadSources = protectedProcedure.handler(
  async ({ context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const sources = await db
      .select()
      .from(leadSources)
      .where(eq(leadSources.userId, userId))
      .orderBy(desc(leadSources.createdAt));

    return {
      sources: sources.map((s: LeadSource) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        description: s.description,
        isActive: s.isActive === "true",
        totalLeads: s.totalLeads || 0,
        lastLeadAt: s.lastLeadAt,
        webhookUrl:
          s.type === "squarespace"
            ? `/api/webhooks/squarespace/${s.id}`
            : undefined,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
  }
);

// ============================================================
// Get Source Stats
// ============================================================

export const getSourceStats = protectedProcedure
  .input(getStatsSchema)
  .handler(async ({ context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 取得來源歸因分析
    const attribution = await getSourceAttribution(userId);

    // 取得所有來源
    const sources = await db
      .select()
      .from(leadSources)
      .where(eq(leadSources.userId, userId));

    // 計算統計
    const totalLeads = sources.reduce(
      (sum: number, s: LeadSource) => sum + (s.totalLeads || 0),
      0
    );

    return {
      totalLeads,
      totalSources: sources.length,
      bySource: attribution.bySource,
      byMedium: attribution.byMedium,
      topCampaigns: attribution.topCampaigns,
      sources: sources.map((s: LeadSource) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        leads: s.totalLeads || 0,
        lastLeadAt: s.lastLeadAt,
      })),
    };
  });

// ============================================================
// Get UTM Campaign Stats
// ============================================================

export const getUTMCampaignStats = protectedProcedure
  .input(getCampaignSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const stats = await getCampaignStats(userId, input.campaignId);

    if (stats.length === 0) {
      throw new ORPCError("NOT_FOUND");
    }

    return stats[0];
  });

// ============================================================
// List UTM Campaigns
// ============================================================

export const listUTMCampaigns = protectedProcedure.handler(
  async ({ context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const campaigns = await db
      .select()
      .from(utmCampaigns)
      .where(eq(utmCampaigns.userId, userId))
      .orderBy(desc(utmCampaigns.lastSeenAt));

    return {
      campaigns: campaigns.map((c: UTMCampaign) => ({
        id: c.id,
        name: c.name,
        utmSource: c.utmSource,
        utmMedium: c.utmMedium,
        utmCampaign: c.utmCampaign,
        totalLeads: c.totalLeads || 0,
        totalConversions: c.totalConversions || 0,
        conversionRate: Number.parseFloat(c.conversionRate || "0"),
        firstSeenAt: c.firstSeenAt,
        lastSeenAt: c.lastSeenAt,
      })),
    };
  }
);

// ============================================================
// Squarespace Webhook Handler (Public)
// ============================================================

export const handleSquarespaceWebhookRoute = publicProcedure
  .input(squarespaceWebhookSchema)
  .handler(async ({ input }) => {
    const { sourceId, payload, signature } = input;

    // 取得來源設定
    const [source] = await db
      .select()
      .from(leadSources)
      .where(eq(leadSources.id, sourceId))
      .limit(1);

    if (!source) {
      throw new ORPCError("NOT_FOUND", { message: "Invalid source ID" });
    }

    if (source.isActive !== "true") {
      throw new ORPCError("FORBIDDEN", { message: "Source is inactive" });
    }

    if (!source.userId) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Source has no associated user",
      });
    }

    // 處理 webhook
    const result = await handleSquarespaceWebhook({
      payload,
      rawPayload: JSON.stringify(payload),
      signature,
      sourceId,
      userId: source.userId,
    });

    if (!result.success) {
      throw new ORPCError("BAD_REQUEST", { message: result.message });
    }

    return {
      success: true,
      opportunityId: result.opportunityId,
      isDuplicate: result.isDuplicate,
      message: result.message,
    };
  });

// ============================================================
// Get Form Submissions
// ============================================================

export const listFormSubmissions = protectedProcedure
  .input(
    z.object({
      sourceId: z.string().optional(),
      status: z
        .enum(["pending", "processed", "failed", "duplicate"])
        .optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    })
  )
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 取得用戶的來源 ID 列表
    const userSources = await db
      .select({ id: leadSources.id })
      .from(leadSources)
      .where(eq(leadSources.userId, userId));

    const sourceIds = userSources.map((s: { id: string }) => s.id);

    if (sourceIds.length === 0) {
      return { submissions: [], total: 0 };
    }

    // 構建查詢條件
    const conditions = [
      sql`${formSubmissions.sourceId} IN (${sql.join(
        sourceIds.map((id: string) => sql`${id}`),
        sql`, `
      )})`,
    ];

    if (input.sourceId) {
      conditions.push(eq(formSubmissions.sourceId, input.sourceId));
    }

    if (input.status) {
      conditions.push(eq(formSubmissions.status, input.status));
    }

    const submissions = await db
      .select()
      .from(formSubmissions)
      .where(and(...conditions))
      .orderBy(desc(formSubmissions.submittedAt))
      .limit(input.limit)
      .offset(input.offset);

    return {
      submissions: submissions.map((s: FormSubmission) => ({
        id: s.id,
        sourceId: s.sourceId,
        sourceType: s.sourceType,
        status: s.status,
        errorMessage: s.errorMessage,
        opportunityId: s.opportunityId,
        submittedAt: s.submittedAt,
        processedAt: s.processedAt,
      })),
      total: submissions.length,
    };
  });

// ============================================================
// Router Export
// ============================================================

export const leadSourceRouter = {
  create: createLeadSource,
  update: updateLeadSource,
  list: listLeadSources,
  stats: getSourceStats,
  utmCampaigns: listUTMCampaigns,
  utmCampaign: getUTMCampaignStats,
  submissions: listFormSubmissions,
  squarespaceWebhook: handleSquarespaceWebhookRoute,
};
