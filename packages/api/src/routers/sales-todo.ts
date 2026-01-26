/**
 * Sales Todo API Router
 * 業務待辦事項 CRUD 操作
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  type CompletionRecord,
  type PostponeRecord,
  salesTodos,
  userProfiles,
} from "@Sales_ai_automation_v3/db/schema";
import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, between, desc, eq, gte, lte, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const createTodoSchema = z.object({
  opportunityId: z.string().optional(),
  conversationId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string(), // ISO string
  source: z.string(),
});

const completeTodoSchema = z.object({
  todoId: z.string(),
  result: z.string().min(1),
  completedVia: z.enum(["slack", "web"]),
});

const postponeTodoSchema = z.object({
  todoId: z.string(),
  newDate: z.string(), // ISO string
  reason: z.string().optional(),
});

const cancelTodoSchema = z.object({
  todoId: z.string(),
  reason: z.string().min(1),
});

const listTodosSchema = z.object({
  status: z.enum(["pending", "completed", "postponed", "cancelled"]).optional(),
  dateFrom: z.string().optional(), // ISO string
  dateTo: z.string().optional(), // ISO string
  userId: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const getTodoSchema = z.object({
  todoId: z.string(),
});

const getTodaysTodosSchema = z.object({
  includeOverdue: z.boolean().default(false),
});

// ============================================================
// Helper: Check Permission
// ============================================================

async function checkTodoAccess(
  todoId: string,
  userId: string
): Promise<{
  todo: typeof salesTodos.$inferSelect;
  canAccess: boolean;
}> {
  const todo = await db.query.salesTodos.findFirst({
    where: eq(salesTodos.id, todoId),
  });

  if (!todo) {
    throw new ORPCError("NOT_FOUND");
  }

  // 自己的待辦
  if (todo.userId === userId) {
    return { todo, canAccess: true };
  }

  // 檢查是否為經理或 admin
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!userProfile) {
    return { todo, canAccess: false };
  }

  // Admin 可看全部
  if (userProfile.role === "admin" && userProfile.department === "all") {
    return { todo, canAccess: true };
  }

  // Manager 可看同 department
  if (userProfile.role === "manager") {
    const todoOwnerProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, todo.userId),
    });
    if (todoOwnerProfile?.department === userProfile.department) {
      return { todo, canAccess: true };
    }
  }

  return { todo, canAccess: false };
}

// ============================================================
// Create Todo
// ============================================================

export const createTodo = protectedProcedure
  .input(createTodoSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const dueDate = new Date(input.dueDate);

    const result = await db
      .insert(salesTodos)
      .values({
        id: randomUUID(),
        userId,
        opportunityId: input.opportunityId,
        conversationId: input.conversationId,
        title: input.title,
        description: input.description,
        dueDate,
        originalDueDate: dueDate,
        source: input.source,
        status: "pending",
        postponeHistory: [],
      })
      .returning();

    const todo = result[0];
    if (!todo) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      dueDate: todo.dueDate,
      originalDueDate: todo.originalDueDate,
      status: todo.status,
      source: todo.source,
      createdAt: todo.createdAt,
    };
  });

// ============================================================
// Complete Todo
// ============================================================

export const completeTodo = protectedProcedure
  .input(completeTodoSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const { todoId, result, completedVia } = input;
    const { todo, canAccess } = await checkTodoAccess(todoId, userId);

    if (!canAccess) {
      throw new ORPCError("FORBIDDEN");
    }

    if (todo.status !== "pending") {
      throw new ORPCError("BAD_REQUEST", {
        message: "只能完成狀態為 pending 的待辦",
      });
    }

    const completionRecord: CompletionRecord = {
      result,
      completedVia,
      completedAt: new Date().toISOString(),
    };

    const updateResult = await db
      .update(salesTodos)
      .set({
        status: "completed",
        completionRecord,
        updatedAt: new Date(),
      })
      .where(eq(salesTodos.id, todoId))
      .returning();

    const updatedTodo = updateResult[0];
    if (!updatedTodo) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      success: true,
      todo: {
        id: updatedTodo.id,
        status: updatedTodo.status,
        completionRecord: updatedTodo.completionRecord,
      },
    };
  });

// ============================================================
// Postpone Todo
// ============================================================

export const postponeTodo = protectedProcedure
  .input(postponeTodoSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const { todoId, newDate, reason } = input;
    const { todo, canAccess } = await checkTodoAccess(todoId, userId);

    if (!canAccess) {
      throw new ORPCError("FORBIDDEN");
    }

    if (todo.status !== "pending") {
      throw new ORPCError("BAD_REQUEST", {
        message: "只能改期狀態為 pending 的待辦",
      });
    }

    const postponeRecord: PostponeRecord = {
      fromDate: todo.dueDate.toISOString(),
      toDate: newDate,
      reason,
      postponedAt: new Date().toISOString(),
    };

    const existingHistory = (todo.postponeHistory as PostponeRecord[]) || [];
    const newHistory = [...existingHistory, postponeRecord];

    const updateResult = await db
      .update(salesTodos)
      .set({
        dueDate: new Date(newDate),
        postponeHistory: newHistory,
        updatedAt: new Date(),
      })
      .where(eq(salesTodos.id, todoId))
      .returning();

    const updatedTodo = updateResult[0];
    if (!updatedTodo) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      success: true,
      todo: {
        id: updatedTodo.id,
        dueDate: updatedTodo.dueDate,
        status: updatedTodo.status,
        postponeHistory: updatedTodo.postponeHistory,
      },
    };
  });

// ============================================================
// Cancel Todo
// ============================================================

export const cancelTodo = protectedProcedure
  .input(cancelTodoSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const { todoId, reason } = input;
    const { todo, canAccess } = await checkTodoAccess(todoId, userId);

    if (!canAccess) {
      throw new ORPCError("FORBIDDEN");
    }

    if (todo.status !== "pending") {
      throw new ORPCError("BAD_REQUEST", {
        message: "只能取消狀態為 pending 的待辦",
      });
    }

    const updateResult = await db
      .update(salesTodos)
      .set({
        status: "cancelled",
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(salesTodos.id, todoId))
      .returning();

    const updatedTodo = updateResult[0];
    if (!updatedTodo) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      success: true,
      todo: {
        id: updatedTodo.id,
        status: updatedTodo.status,
        cancellationReason: updatedTodo.cancellationReason,
      },
    };
  });

// ============================================================
// List Todos
// ============================================================

export const listTodos = protectedProcedure
  .input(listTodosSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const {
      status,
      dateFrom,
      dateTo,
      userId: targetUserId,
      limit,
      offset,
    } = input;

    // 檢查使用者權限
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    const isAdmin =
      userProfile?.role === "admin" && userProfile?.department === "all";
    const isManager = userProfile?.role === "manager";

    // 建立查詢條件
    const conditions: ReturnType<typeof eq>[] = [];

    // 權限控制
    if (targetUserId) {
      // 如果指定了特定用戶
      if (targetUserId !== userId && !isAdmin && !isManager) {
        throw new ORPCError("FORBIDDEN", {
          message: "無權查看其他用戶的待辦",
        });
      }

      // Manager 只能看同 department 的用戶
      if (isManager && targetUserId !== userId) {
        const targetProfile = await db.query.userProfiles.findFirst({
          where: eq(userProfiles.userId, targetUserId),
        });
        if (targetProfile?.department !== userProfile?.department) {
          throw new ORPCError("FORBIDDEN", {
            message: "無權查看其他部門用戶的待辦",
          });
        }
      }

      conditions.push(eq(salesTodos.userId, targetUserId));
    } else {
      // 沒有指定用戶時的預設行為
      if (!isAdmin) {
        if (isManager && userProfile?.department) {
          // Manager 看同 department 的所有用戶
          const departmentUsers = await db
            .select({ userId: userProfiles.userId })
            .from(userProfiles)
            .where(eq(userProfiles.department, userProfile.department));

          const userIds = departmentUsers.map((u) => u.userId);
          if (userIds.length > 0) {
            conditions.push(
              or(...userIds.map((id) => eq(salesTodos.userId, id)))!
            );
          } else {
            conditions.push(eq(salesTodos.userId, userId));
          }
        } else {
          // 一般業務只能看自己的
          conditions.push(eq(salesTodos.userId, userId));
        }
      }
    }

    // 狀態篩選
    if (status) {
      conditions.push(eq(salesTodos.status, status));
    }

    // 日期篩選
    if (dateFrom) {
      conditions.push(gte(salesTodos.dueDate, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(salesTodos.dueDate, new Date(dateTo)));
    }

    // 查詢待辦
    const todos = await db.query.salesTodos.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        opportunity: {
          columns: {
            id: true,
            companyName: true,
            customerNumber: true,
          },
        },
        conversation: {
          columns: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
      },
      orderBy: [desc(salesTodos.dueDate)],
      limit,
      offset,
    });

    return {
      todos: todos.map((todo) => ({
        id: todo.id,
        title: todo.title,
        description: todo.description,
        dueDate: todo.dueDate,
        originalDueDate: todo.originalDueDate,
        status: todo.status,
        source: todo.source,
        postponeHistory: todo.postponeHistory,
        completionRecord: todo.completionRecord,
        cancellationReason: todo.cancellationReason,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        opportunity: todo.opportunity,
        conversation: todo.conversation,
      })),
      total: todos.length,
      limit,
      offset,
    };
  });

// ============================================================
// Get Todo by ID
// ============================================================

export const getTodo = protectedProcedure
  .input(getTodoSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const { todoId } = input;
    const { canAccess } = await checkTodoAccess(todoId, userId);

    if (!canAccess) {
      throw new ORPCError("FORBIDDEN");
    }

    // 取得關聯資料
    const todoWithRelations = await db.query.salesTodos.findFirst({
      where: eq(salesTodos.id, todoId),
      with: {
        opportunity: true,
        conversation: true,
      },
    });

    return todoWithRelations;
  });

// ============================================================
// Get Today's Todos (for Cron)
// ============================================================

export const getTodaysTodos = protectedProcedure
  .input(getTodaysTodosSchema)
  .handler(async ({ input }) => {
    const { includeOverdue } = input;

    // 取得今天的日期範圍 (Asia/Taipei timezone)
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // 建立查詢條件
    let dateCondition;
    if (includeOverdue) {
      // 包含過期的（今天及之前）
      dateCondition = lte(salesTodos.dueDate, todayEnd);
    } else {
      // 只有今天的
      dateCondition = between(salesTodos.dueDate, todayStart, todayEnd);
    }

    // 查詢所有 pending 狀態的今日待辦
    const todos = await db.query.salesTodos.findMany({
      where: and(eq(salesTodos.status, "pending"), dateCondition),
      with: {
        opportunity: {
          columns: {
            id: true,
            companyName: true,
            customerNumber: true,
          },
        },
        conversation: {
          columns: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
      },
      orderBy: [desc(salesTodos.dueDate)],
    });

    // 按用戶分組
    const todosByUser = todos.reduce(
      (acc, todo) => {
        const key = todo.userId;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({
          id: todo.id,
          title: todo.title,
          description: todo.description,
          dueDate: todo.dueDate,
          originalDueDate: todo.originalDueDate,
          source: todo.source,
          postponeHistory: todo.postponeHistory,
          opportunity: todo.opportunity,
          conversation: todo.conversation,
          isOverdue: todo.dueDate < todayStart,
        });
        return acc;
      },
      {} as Record<
        string,
        Array<{
          id: string;
          title: string;
          description: string | null;
          dueDate: Date;
          originalDueDate: Date;
          source: string;
          postponeHistory: unknown;
          opportunity: {
            id: string;
            companyName: string;
            customerNumber: string;
          } | null;
          conversation: {
            id: string;
            title: string | null;
            caseNumber: string | null;
          } | null;
          isOverdue: boolean;
        }>
      >
    );

    return {
      todosByUser,
      totalCount: todos.length,
      userCount: Object.keys(todosByUser).length,
    };
  });

// ============================================================
// Router Export
// ============================================================

export const salesTodoRouter = {
  create: createTodo,
  complete: completeTodo,
  postpone: postponeTodo,
  cancel: cancelTodo,
  list: listTodos,
  get: getTodo,
  getTodaysTodos,
};
