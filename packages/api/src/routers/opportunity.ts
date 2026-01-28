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
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
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

const rejectOpportunitySchema = z.object({
  opportunityId: z.string(),
  rejectionReason: z.string().min(1),
  competitor: z.string().optional(),
  note: z.string().optional(),
});

const winOpportunitySchema = z.object({
  opportunityId: z.string(),
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

    // Status 篩選：如果沒指定 status，預設排除 won 和 lost（顯示進行中）
    if (status) {
      conditions.push(eq(opportunities.status, status));
    } else {
      conditions.push(sql`${opportunities.status} NOT IN ('won', 'lost')`);
    }

    if (source) {
      conditions.push(eq(opportunities.source, source));
    }

    if (productLine) {
      conditions.push(eq(opportunities.productLine, productLine));
    }

    // 處理搜尋：如果有搜尋詞，先找出符合 case_number 或 store_name 的 opportunity IDs
    let searchMatchingOppIds: string[] = [];
    if (search) {
      const searchPattern = `%${search}%`;

      const matchingConvs = await db
        .selectDistinct({ opportunityId: conversations.opportunityId })
        .from(conversations)
        .where(
          or(
            ilike(conversations.caseNumber, searchPattern),
            ilike(conversations.storeName, searchPattern)
          )!
        );

      searchMatchingOppIds = matchingConvs
        .map((c) => c.opportunityId)
        .filter((id): id is string => id !== null);
    }

    if (search) {
      const searchPattern = `%${search}%`;

      const searchConditions = [
        ilike(opportunities.companyName, searchPattern),
        ilike(opportunities.contactName, searchPattern),
        ilike(opportunities.contactEmail, searchPattern),
        ilike(opportunities.customerNumber, searchPattern),
      ];

      // 如果從 conversations 找到匹配的 opportunity IDs，加入條件
      if (searchMatchingOppIds.length > 0) {
        searchConditions.push(
          sql`${opportunities.id} IN (${sql.raw(
            searchMatchingOppIds.map((id) => `'${id}'`).join(", ")
          )})`
        );
      }

      conditions.push(or(...searchConditions)!);
    }

    // 先查詢總數（不分頁）
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(opportunities)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const totalCount = Number(countResult[0]?.count ?? 0);

    const results = await db
      .select()
      .from(opportunities)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(opportunities.updatedAt))
      .limit(limit)
      .offset(offset);

    // 獲取每個 opportunity 的 SPIN 分數和業務名稱
    const opportunitiesWithExtras = await Promise.all(
      results.map(async (opportunity) => {
        // 獲取最新的 conversation（用於 SPIN 分數、案件編號和 slack 用戶名 fallback）
        const latestConversation = await db.query.conversations.findFirst({
          where: eq(conversations.opportunityId, opportunity.id),
          orderBy: (conversations, { desc }) => [desc(conversations.createdAt)],
          columns: { id: true, slackUsername: true, caseNumber: true },
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
          wonAt: opportunity.wonAt,
          lostAt: opportunity.lostAt,
          spinScore,
          salesRepName: ownerName, // 業務名稱（前端使用 salesRepName）
          latestCaseNumber: latestConversation?.caseNumber || null, // 最新案件編號
        };
      })
    );

    return {
      opportunities: opportunitiesWithExtras,
      total: totalCount,
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
      wonAt: opportunity.wonAt,
      lostAt: opportunity.lostAt,
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
// Reject Opportunity
// ============================================================

export const rejectOpportunity = protectedProcedure
  .input(rejectOpportunitySchema)
  .handler(async ({ input, context }) => {
    const { opportunityId, rejectionReason, competitor, note } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 1. 權限檢查（複用 getOpportunity 的邏輯）
    const opportunity = await db.query.opportunities.findFirst({
      where: eq(opportunities.id, opportunityId),
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    const userEmail = context.session?.user.email;
    const userRole = getUserRole(userEmail);
    const isOwner = opportunity.userId === userId;
    const isSlackGenerated =
      !opportunity.userId || opportunity.userId === "service-account";
    const hasAdminAccess = userRole === "admin" || userRole === "manager";

    if (!(isOwner || isSlackGenerated || hasAdminAccess)) {
      throw new ORPCError("FORBIDDEN");
    }

    // 2. Transaction 確保資料一致性
    return await db.transaction(async (tx) => {
      // 2a. 建立「客戶拒絕」Todo
      const todoId = randomUUID();
      const dueDate = new Date();

      const todoResult = await tx
        .insert(salesTodos)
        .values({
          id: todoId,
          userId: opportunity.userId,
          opportunityId: opportunity.id,
          customerNumber: opportunity.customerNumber,
          title: `客戶拒絕 - ${opportunity.companyName}`,
          description: `拒絕原因: ${rejectionReason}${competitor ? `\n競品: ${competitor}` : ""}${note ? `\n備註: ${note}` : ""}`,
          dueDate,
          originalDueDate: dueDate,
          source: "web",
          status: "lost",
          postponeHistory: [],
          lostRecord: {
            reason: rejectionReason,
            competitor,
            note,
            lostAt: new Date().toISOString(),
            lostVia: "web",
          },
        })
        .returning();

      const todo = todoResult[0];
      if (!todo) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      // 2b. 建立 Todo Log（審計追蹤）
      await tx.insert(todoLogs).values({
        id: randomUUID(),
        todoId: todo.id,
        opportunityId: opportunity.id,
        userId,
        action: "lost",
        actionVia: "web",
        changes: {
          before: { status: "pending" },
          after: { status: "lost" },
          lostRecord: todo.lostRecord,
        },
        note: rejectionReason,
      });

      // 2c. 更新 Opportunity 狀態（同時設定 lostAt）
      const updateResult = await tx
        .update(opportunities)
        .set({
          rejectionReason,
          selectedCompetitor: competitor,
          status: "lost",
          lostAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(opportunities.id, opportunityId))
        .returning();

      const updatedOpportunity = updateResult[0];
      if (!updatedOpportunity) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      return {
        success: true,
        message: "機會已標記為拒絕",
        todo: {
          id: todo.id,
          status: todo.status,
          lostRecord: todo.lostRecord,
        },
        opportunity: {
          id: updatedOpportunity.id,
          status: updatedOpportunity.status,
          rejectionReason: updatedOpportunity.rejectionReason,
        },
      };
    });
  });

// ============================================================
// Win Opportunity
// ============================================================

export const winOpportunity = protectedProcedure
  .input(winOpportunitySchema)
  .handler(async ({ input, context }) => {
    const { opportunityId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 1. 權限檢查（複用 getOpportunity 的邏輯）
    const opportunity = await db.query.opportunities.findFirst({
      where: eq(opportunities.id, opportunityId),
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    const userEmail = context.session?.user.email;
    const userRole = getUserRole(userEmail);
    const isOwner = opportunity.userId === userId;
    const isSlackGenerated =
      !opportunity.userId || opportunity.userId === "service-account";
    const hasAdminAccess = userRole === "admin" || userRole === "manager";

    if (!(isOwner || isSlackGenerated || hasAdminAccess)) {
      throw new ORPCError("FORBIDDEN");
    }

    // 2. 更新 Opportunity 狀態（不建立 Todo）
    const updateResult = await db
      .update(opportunities)
      .set({
        status: "won",
        wonAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, opportunityId))
      .returning();

    const updatedOpportunity = updateResult[0];
    if (!updatedOpportunity) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      success: true,
      message: "機會已標記為成交",
      opportunity: {
        id: updatedOpportunity.id,
        status: updatedOpportunity.status,
        wonAt: updatedOpportunity.wonAt,
      },
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
  reject: rejectOpportunity,
  win: winOpportunity,
};
