/**
 * Opportunity API Router
 * CRUD operations for sales opportunities
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
  salesTodos,
  todoLogs,
  user,
  userProfiles,
} from "@Sales_ai_automation_v3/db/schema";
import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const createOpportunitySchema = z.object({
  customerNumber: z.string().min(1), // Required: Salesforce UUID
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  source: z
    .enum(["manual", "import", "api", "referral", "slack"])
    .default("manual"),
  status: z
    .enum([
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ])
    .default("new"),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  notes: z.string().optional(),
  // 產品線（可選，預設為 'ichef'）
  productLine: z.enum(["ichef", "beauty"]).optional(),

  // Product-Specific Business Context
  storeType: z.string().optional(),
  serviceType: z.string().optional(),
  staffCount: z.string().optional(),
  currentSystem: z.string().optional(),
  decisionMakerPresent: z.enum(["yes", "no", "unknown"]).optional(),
});

const updateOpportunitySchema = z.object({
  opportunityId: z.string(),
  customerNumber: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  source: z.enum(["manual", "import", "api", "referral", "slack"]).optional(),
  status: z
    .enum([
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ])
    .optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  notes: z.string().optional(),
  productLine: z.enum(["ichef", "beauty"]).optional(),

  // Product-Specific Business Context
  storeType: z.string().optional(),
  serviceType: z.string().optional(),
  staffCount: z.string().optional(),
  currentSystem: z.string().optional(),
  decisionMakerPresent: z.enum(["yes", "no", "unknown"]).optional(),
});

const deleteOpportunitySchema = z.object({
  opportunityId: z.string(),
});

const listOpportunitiesSchema = z.object({
  status: z
    .enum([
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ])
    .optional(),
  source: z.enum(["manual", "import", "api", "referral"]).optional(),
  search: z.string().optional(),
  productLine: z.enum(["ichef", "beauty"]).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const getOpportunitySchema = z.object({
  opportunityId: z.string(),
});

const getOpportunityByCustomerNumberSchema = z.object({
  customerNumber: z.string(),
});

// ============================================================
// Create Opportunity
// ============================================================

export const createOpportunity = protectedProcedure
  .input(createOpportunitySchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const result = await db
      .insert(opportunities)
      .values({
        id: randomUUID(),
        userId,
        customerNumber: input.customerNumber,
        companyName: input.companyName,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        source: input.source,
        status: input.status,
        industry: input.industry,
        companySize: input.companySize,
        notes: input.notes,
        productLine: input.productLine || "ichef",

        // Product-Specific Business Context
        storeType: input.storeType,
        serviceType: input.serviceType,
        staffCount: input.staffCount,
        currentSystem: input.currentSystem,
        decisionMakerPresent: input.decisionMakerPresent,
      })
      .returning();

    const opportunity = result[0];
    if (!opportunity) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      id: opportunity.id,
      customerNumber: opportunity.customerNumber,
      companyName: opportunity.companyName,
      contactName: opportunity.contactName,
      contactEmail: opportunity.contactEmail,
      contactPhone: opportunity.contactPhone,
      source: opportunity.source,
      status: opportunity.status,
      industry: opportunity.industry,
      companySize: opportunity.companySize,
      notes: opportunity.notes,
      productLine: opportunity.productLine,

      // Product-Specific Business Context
      storeType: opportunity.storeType,
      serviceType: opportunity.serviceType,
      staffCount: opportunity.staffCount,
      currentSystem: opportunity.currentSystem,
      decisionMakerPresent: opportunity.decisionMakerPresent,

      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
    };
  });

// ============================================================
// Update Opportunity
// ============================================================

export const updateOpportunity = protectedProcedure
  .input(updateOpportunitySchema)
  .handler(async ({ input, context }) => {
    const { opportunityId, ...updates } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const existingOpportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.userId, userId)
      ),
    });

    if (!existingOpportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    const updateResult = await db
      .update(opportunities)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, opportunityId))
      .returning();

    const updatedOpportunity = updateResult[0];
    if (!updatedOpportunity) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      id: updatedOpportunity.id,
      customerNumber: updatedOpportunity.customerNumber,
      companyName: updatedOpportunity.companyName,
      contactName: updatedOpportunity.contactName,
      contactEmail: updatedOpportunity.contactEmail,
      contactPhone: updatedOpportunity.contactPhone,
      source: updatedOpportunity.source,
      status: updatedOpportunity.status,
      industry: updatedOpportunity.industry,
      companySize: updatedOpportunity.companySize,
      notes: updatedOpportunity.notes,
      productLine: updatedOpportunity.productLine,

      // Product-Specific Business Context
      storeType: updatedOpportunity.storeType,
      serviceType: updatedOpportunity.serviceType,
      staffCount: updatedOpportunity.staffCount,
      currentSystem: updatedOpportunity.currentSystem,
      decisionMakerPresent: updatedOpportunity.decisionMakerPresent,

      createdAt: updatedOpportunity.createdAt,
      updatedAt: updatedOpportunity.updatedAt,
    };
  });

// ============================================================
// Delete Opportunity
// ============================================================

export const deleteOpportunity = protectedProcedure
  .input(deleteOpportunitySchema)
  .handler(async ({ input, context }) => {
    const { opportunityId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const existingOpportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.userId, userId)
      ),
    });

    if (!existingOpportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    await db.delete(opportunities).where(eq(opportunities.id, opportunityId));

    return {
      success: true,
      message: "Opportunity deleted successfully",
    };
  });

// ============================================================
// List Opportunities
// ============================================================

export const listOpportunities = protectedProcedure
  .input(listOpportunitiesSchema)
  .handler(async ({ input, context }) => {
    const { status, source, search, productLine, limit, offset } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // Check user role and permissions
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });
    const isAdmin =
      userProfile?.role === "admin" && userProfile?.department === "all";
    const isManager = userProfile?.role === "manager";
    const managerProductLine = userProfile?.department; // ichef, beauty, or null

    // Determine access level:
    // - Service account or admin: see all opportunities
    // - Manager: see opportunities for their product line only
    // - Sales rep: see only their own opportunities
    const isServiceAccount = context.isServiceAccount === true;
    const canViewAll = isServiceAccount || isAdmin;

    const conditions: ReturnType<typeof eq>[] = [];

    if (!canViewAll) {
      if (isManager && managerProductLine) {
        // Manager can only see their product line
        conditions.push(eq(opportunities.productLine, managerProductLine));
      } else {
        // Regular user can only see their own opportunities
        conditions.push(eq(opportunities.userId, userId));
      }
    }

    if (status) {
      conditions.push(eq(opportunities.status, status));
    }

    if (source) {
      conditions.push(eq(opportunities.source, source));
    }

    if (productLine) {
      conditions.push(eq(opportunities.productLine, productLine));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(opportunities.companyName, searchPattern),
          ilike(opportunities.contactName, searchPattern),
          ilike(opportunities.contactEmail, searchPattern),
          ilike(opportunities.customerNumber, searchPattern)
        )!
      );
    }

    const results = await db
      .select()
      .from(opportunities)
      .where(and(...conditions))
      .orderBy(desc(opportunities.createdAt))
      .limit(limit)
      .offset(offset);

    // 獲取每個 opportunity 的 SPIN 分數和業務名稱
    const opportunitiesWithExtras = await Promise.all(
      results.map(async (opportunity) => {
        // 獲取最新的 conversation（用於 SPIN 分數和 slack 用戶名 fallback）
        const latestConversation = await db.query.conversations.findFirst({
          where: eq(conversations.opportunityId, opportunity.id),
          orderBy: (conversations, { desc }) => [desc(conversations.createdAt)],
          columns: { id: true, slackUsername: true },
        });

        // 獲取最新的 MEDDIC 分析（含 SPIN 分數）
        let spinScore: number | null = null;
        if (latestConversation?.id) {
          const latestAnalysis = await db.query.meddicAnalyses.findFirst({
            where: eq(meddicAnalyses.conversationId, latestConversation.id),
            orderBy: (meddicAnalyses, { desc }) => [
              desc(meddicAnalyses.createdAt),
            ],
            columns: { agentOutputs: true },
          });

          // 提取 SPIN 完成率 (agent3.spin_analysis.spin_completion_rate)
          if (latestAnalysis?.agentOutputs) {
            const agent3 = (
              latestAnalysis.agentOutputs as Record<string, unknown>
            )?.agent3 as Record<string, unknown> | undefined;
            const spinAnalysis = agent3?.spin_analysis as
              | Record<string, unknown>
              | undefined;
            const completionRate = spinAnalysis?.spin_completion_rate;
            if (typeof completionRate === "number") {
              spinScore = Math.round(completionRate * 100);
            }
          }
        }

        // 獲取業務名稱：優先使用 user.name，fallback 到 slackUsername
        let ownerName: string | null = null;
        if (opportunity.userId && opportunity.userId !== "service-account") {
          const ownerUser = await db.query.user.findFirst({
            where: eq(user.id, opportunity.userId),
            columns: { name: true },
          });
          ownerName = ownerUser?.name || null;
        }
        // Fallback 到 Slack 用戶名
        if (!ownerName && latestConversation?.slackUsername) {
          ownerName = latestConversation.slackUsername;
        }

        return {
          id: opportunity.id,
          customerNumber: opportunity.customerNumber,
          companyName: opportunity.companyName,
          contactName: opportunity.contactName,
          contactEmail: opportunity.contactEmail,
          contactPhone: opportunity.contactPhone,
          source: opportunity.source,
          status: opportunity.status,
          industry: opportunity.industry,
          companySize: opportunity.companySize,
          notes: opportunity.notes,
          opportunityScore: opportunity.opportunityScore,
          meddicScore: opportunity.meddicScore,
          createdAt: opportunity.createdAt,
          updatedAt: opportunity.updatedAt,
          spinScore,
          ownerName, // 業務名稱
        };
      })
    );

    return {
      opportunities: opportunitiesWithExtras,
      total: results.length,
      limit,
      offset,
    };
  });

// ============================================================
// 權限控制 - 三級權限：管理者、主管、一般業務
// ============================================================

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const MANAGER_EMAILS = (process.env.MANAGER_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

function getUserRole(
  userEmail: string | null | undefined
): "admin" | "manager" | "sales" {
  if (!userEmail) {
    return "sales";
  }
  if (ADMIN_EMAILS.includes(userEmail)) {
    return "admin";
  }
  if (MANAGER_EMAILS.includes(userEmail)) {
    return "manager";
  }
  return "sales";
}

// ============================================================
// Get Opportunity Details
// ============================================================

export const getOpportunity = protectedProcedure
  .input(getOpportunitySchema)
  .handler(async ({ input, context }) => {
    const { opportunityId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 先查詢 opportunity（不限制 userId）
    const opportunity = await db.query.opportunities.findFirst({
      where: eq(opportunities.id, opportunityId),
      with: {
        conversations: {
          orderBy: (conversations, { desc }) => [
            desc(conversations.conversationDate),
          ],
          limit: 10,
          with: {
            meddicAnalyses: {
              orderBy: (meddicAnalyses, { desc }) => [
                desc(meddicAnalyses.createdAt),
              ],
              limit: 1,
            },
          },
        },
      },
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    // 檢查權限：所有者、管理員/主管、或 Slack 建立的商機
    const userEmail = context.session?.user.email;
    const userRole = getUserRole(userEmail);
    const isOwner = opportunity.userId === userId;
    const isSlackGenerated =
      !opportunity.userId || opportunity.userId === "service-account";
    const hasAdminAccess = userRole === "admin" || userRole === "manager";

    if (!(isOwner || isSlackGenerated || hasAdminAccess)) {
      throw new ORPCError("FORBIDDEN");
    }

    // Fetch related salesTodos
    const todos = await db.query.salesTodos.findMany({
      where: eq(salesTodos.opportunityId, opportunityId),
      orderBy: [desc(salesTodos.createdAt)],
    });

    // Fetch related todoLogs
    const logs = await db.query.todoLogs.findMany({
      where: eq(todoLogs.opportunityId, opportunityId),
      orderBy: [desc(todoLogs.createdAt)],
    });

    return {
      id: opportunity.id,
      customerNumber: opportunity.customerNumber,
      companyName: opportunity.companyName,
      contactName: opportunity.contactName,
      contactEmail: opportunity.contactEmail,
      contactPhone: opportunity.contactPhone,
      source: opportunity.source,
      status: opportunity.status,
      industry: opportunity.industry,
      companySize: opportunity.companySize,
      notes: opportunity.notes,
      opportunityScore: opportunity.opportunityScore,
      meddicScore: opportunity.meddicScore,
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
      lastContactedAt: opportunity.lastContactedAt,
      conversations: opportunity.conversations.map((conv) => ({
        id: conv.id,
        caseNumber: conv.caseNumber,
        title: conv.title,
        type: conv.type,
        status: conv.status,
        audioUrl: conv.audioUrl,
        duration: conv.duration,
        conversationDate: conv.conversationDate,
        createdAt: conv.createdAt,
        latestAnalysis: conv.meddicAnalyses[0] || null,
      })),
      // 新增 Sales Pipeline 資料
      salesTodos: todos.map((todo) => ({
        id: todo.id,
        title: todo.title,
        description: todo.description,
        dueDate: todo.dueDate,
        originalDueDate: todo.originalDueDate,
        status: todo.status,
        source: todo.source,
        postponeHistory: todo.postponeHistory,
        completionRecord: todo.completionRecord,
        wonRecord: todo.wonRecord,
        lostRecord: todo.lostRecord,
        nextTodoId: todo.nextTodoId,
        prevTodoId: todo.prevTodoId,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
      })),
      todoLogs: logs.map((log) => ({
        id: log.id,
        todoId: log.todoId,
        action: log.action,
        actionVia: log.actionVia,
        changes: log.changes,
        note: log.note,
        createdAt: log.createdAt,
      })),
    };
  });

// ============================================================
// Get Opportunity by Customer Number
// ============================================================

export const getOpportunityByCustomerNumber = protectedProcedure
  .input(getOpportunityByCustomerNumberSchema)
  .handler(async ({ input, context }) => {
    const { customerNumber } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const opportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.customerNumber, customerNumber),
        eq(opportunities.userId, userId)
      ),
      with: {
        conversations: {
          orderBy: (conversations, { desc }) => [
            desc(conversations.conversationDate),
          ],
          limit: 10,
        },
      },
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    return {
      id: opportunity.id,
      customerNumber: opportunity.customerNumber,
      companyName: opportunity.companyName,
      contactName: opportunity.contactName,
      status: opportunity.status,
      opportunityScore: opportunity.opportunityScore,
      meddicScore: opportunity.meddicScore,
      conversationCount: opportunity.conversations.length,
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
    };
  });

// ============================================================
// Router Export
// ============================================================

export const opportunityRouter = {
  create: createOpportunity,
  update: updateOpportunity,
  delete: deleteOpportunity,
  list: listOpportunities,
  get: getOpportunity,
  getByCustomerNumber: getOpportunityByCustomerNumber,
};
