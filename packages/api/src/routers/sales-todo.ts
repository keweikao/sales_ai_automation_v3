/**
 * Sales Todo API Router
 * 業務待辦事項 CRUD 操作
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  type CompletionRecord,
  type LostRecord,
  opportunities,
  type PostponeRecord,
  salesTodos,
  todoLogs,
  userProfiles,
  type WonRecord,
} from "@Sales_ai_automation_v3/db/schema";
import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, between, count, desc, eq, gte, lte, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ============================================================
// Timezone Utilities (UTC+8)
// ============================================================

const UTC_PLUS_8_OFFSET_MS = 8 * 60 * 60 * 1000;

function nowInTaipei(): Date {
  const now = new Date();
  return new Date(now.getTime() + UTC_PLUS_8_OFFSET_MS);
}

function getTodayStartInTaipei(): Date {
  const taipeiNow = nowInTaipei();
  const year = taipeiNow.getUTCFullYear();
  const month = String(taipeiNow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(taipeiNow.getUTCDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;
  return getDateStartInTaipei(todayStr);
}

function getTodayEndInTaipei(): Date {
  const taipeiNow = nowInTaipei();
  const year = taipeiNow.getUTCFullYear();
  const month = String(taipeiNow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(taipeiNow.getUTCDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;
  return getDateEndInTaipei(todayStr);
}

function getDateStartInTaipei(dateStr: string): Date {
  // 支援 ISO 字串或 yyyy-MM-dd 格式，只取前 10 字符
  const dateOnly = dateStr.slice(0, 10);
  const parts = dateOnly.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return new Date(date.getTime() - UTC_PLUS_8_OFFSET_MS);
}

function getDateEndInTaipei(dateStr: string): Date {
  // 支援 ISO 字串或 yyyy-MM-dd 格式，只取前 10 字符
  const dateOnly = dateStr.slice(0, 10);
  const parts = dateOnly.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return new Date(date.getTime() - UTC_PLUS_8_OFFSET_MS);
}

// ============================================================
// Schemas
// ============================================================

const createTodoSchema = z.object({
  opportunityId: z.string().optional(),
  conversationId: z.string().optional(),
  customerNumber: z.string().optional(), // 主要連接欄位，用於關聯 opportunity
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string(), // ISO string
  source: z.string(),
});

const completeTodoSchema = z.object({
  todoId: z.string(),
  result: z.string().min(1),
  completedVia: z.enum(["slack", "web"]),
  nextTodo: z.object({
    title: z.string(),
    description: z.string().optional(),
    dueDate: z.string(),
  }),
});

const winTodoSchema = z.object({
  todoId: z.string(),
  expectedPaymentDate: z.string().optional(),
  amount: z.number().optional(),
  note: z.string().optional(),
  wonVia: z.enum(["slack", "web"]),
});

const loseTodoSchema = z.object({
  todoId: z.string(),
  reason: z.string().min(1),
  competitor: z.string().optional(),
  note: z.string().optional(),
  lostVia: z.enum(["slack", "web"]),
});

const postponeTodoSchema = z.object({
  todoId: z.string(),
  newDate: z.string(), // ISO string
  reason: z.string().optional(),
  postponedVia: z.enum(["slack", "web"]),
});

const cancelTodoSchema = z.object({
  todoId: z.string(),
  reason: z.string().min(1),
});

const listTodosSchema = z.object({
  status: z
    .enum(["pending", "completed", "postponed", "cancelled", "won", "lost"])
    .optional(),
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
// Helper: Create Todo Log
// ============================================================

async function createTodoLog(data: {
  todoId: string;
  opportunityId?: string | null;
  userId: string;
  action: "create" | "complete" | "postpone" | "won" | "lost";
  actionVia: "slack" | "web";
  changes: Record<string, unknown>;
  note?: string;
}) {
  await db.insert(todoLogs).values({
    id: randomUUID(),
    todoId: data.todoId,
    opportunityId: data.opportunityId,
    userId: data.userId,
    action: data.action,
    actionVia: data.actionVia,
    changes: data.changes,
    note: data.note,
  });
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
        customerNumber: input.customerNumber, // 主要連接欄位
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

    // 更新 opportunity 的 updatedAt
    if (input.opportunityId) {
      await db
        .update(opportunities)
        .set({ updatedAt: new Date() })
        .where(eq(opportunities.id, input.opportunityId));
    }

    // 記錄 create log
    await createTodoLog({
      todoId: todo.id,
      opportunityId: todo.opportunityId,
      userId,
      action: "create",
      actionVia: input.source === "slack" ? "slack" : "web",
      changes: {
        after: {
          title: todo.title,
          description: todo.description,
          dueDate: todo.dueDate?.toISOString(),
          customerNumber: todo.customerNumber,
        },
      },
    });

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

    const { todoId, result, completedVia, nextTodo } = input;
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

    // 1. 建立下一個 Todo
    const nextTodoId = randomUUID();
    const nextDueDate = new Date(nextTodo.dueDate);

    const nextTodoResult = await db
      .insert(salesTodos)
      .values({
        id: nextTodoId,
        userId: todo.userId,
        opportunityId: todo.opportunityId,
        conversationId: todo.conversationId,
        customerNumber: todo.customerNumber, // 繼承原 todo 的 customerNumber
        title: nextTodo.title,
        description: nextTodo.description,
        dueDate: nextDueDate,
        originalDueDate: nextDueDate,
        source: completedVia,
        status: "pending",
        postponeHistory: [],
        prevTodoId: todoId,
      })
      .returning();

    const createdNextTodo = nextTodoResult[0];
    if (!createdNextTodo) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // 2. 更新當前 Todo 狀態為 completed，並設定 nextTodoId
    const updateResult = await db
      .update(salesTodos)
      .set({
        status: "completed",
        completionRecord,
        nextTodoId,
        updatedAt: new Date(),
      })
      .where(eq(salesTodos.id, todoId))
      .returning();

    const updatedTodo = updateResult[0];
    if (!updatedTodo) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // 3. 寫入兩筆 todo_logs
    // 3a. Complete log
    await createTodoLog({
      todoId,
      opportunityId: todo.opportunityId,
      userId,
      action: "complete",
      actionVia: completedVia,
      changes: {
        before: { status: todo.status },
        after: { status: "completed", nextTodoId },
        completionRecord,
      },
      note: result,
    });

    // 3b. Created log for next todo
    await createTodoLog({
      todoId: nextTodoId,
      opportunityId: todo.opportunityId,
      userId,
      action: "create",
      actionVia: completedVia,
      changes: {
        title: nextTodo.title,
        description: nextTodo.description,
        dueDate: nextTodo.dueDate,
        customerNumber: todo.customerNumber,
        prevTodoId: todoId,
      },
    });

    // 更新 opportunity 的 updatedAt
    if (todo.opportunityId) {
      await db
        .update(opportunities)
        .set({ updatedAt: new Date() })
        .where(eq(opportunities.id, todo.opportunityId));
    }

    return {
      success: true,
      todo: {
        id: updatedTodo.id,
        status: updatedTodo.status,
        completionRecord: updatedTodo.completionRecord,
        nextTodoId: updatedTodo.nextTodoId,
      },
      nextTodo: {
        id: createdNextTodo.id,
        title: createdNextTodo.title,
        description: createdNextTodo.description,
        dueDate: createdNextTodo.dueDate,
        status: createdNextTodo.status,
        prevTodoId: createdNextTodo.prevTodoId,
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

    const { todoId, newDate, reason, postponedVia } = input;
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

    // 寫入 todo_logs
    await createTodoLog({
      todoId,
      opportunityId: todo.opportunityId,
      userId,
      action: "postpone",
      actionVia: postponedVia,
      changes: {
        before: { dueDate: todo.dueDate.toISOString() },
        after: { dueDate: newDate },
        postponeRecord,
      },
      note: reason,
    });

    // 更新 opportunity 的 updatedAt
    if (todo.opportunityId) {
      await db
        .update(opportunities)
        .set({ updatedAt: new Date() })
        .where(eq(opportunities.id, todo.opportunityId));
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

    // 更新 opportunity 的 updatedAt
    if (todo.opportunityId) {
      await db
        .update(opportunities)
        .set({ updatedAt: new Date() })
        .where(eq(opportunities.id, todo.opportunityId));
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
// Win Todo
// ============================================================

export const winTodo = protectedProcedure
  .input(winTodoSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const { todoId, expectedPaymentDate, amount, note, wonVia } = input;
    const { todo, canAccess } = await checkTodoAccess(todoId, userId);

    if (!canAccess) {
      throw new ORPCError("FORBIDDEN");
    }

    if (todo.status !== "pending") {
      throw new ORPCError("BAD_REQUEST", {
        message: "只能將狀態為 pending 的待辦標記為成交",
      });
    }

    const wonRecord: WonRecord = {
      amount,
      note,
      wonAt: new Date().toISOString(),
      wonVia,
    };

    const updateResult = await db
      .update(salesTodos)
      .set({
        status: "won",
        wonRecord,
        updatedAt: new Date(),
      })
      .where(eq(salesTodos.id, todoId))
      .returning();

    const updatedTodo = updateResult[0];
    if (!updatedTodo) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // 寫入 todo_logs
    await createTodoLog({
      todoId,
      opportunityId: todo.opportunityId,
      userId,
      action: "won",
      actionVia: wonVia,
      changes: {
        before: { status: todo.status },
        after: { status: "won" },
        wonRecord,
        expectedPaymentDate,
      },
      note,
    });

    // 更新 opportunity 的 updatedAt
    if (todo.opportunityId) {
      await db
        .update(opportunities)
        .set({ updatedAt: new Date() })
        .where(eq(opportunities.id, todo.opportunityId));
    }

    return {
      success: true,
      todo: {
        id: updatedTodo.id,
        status: updatedTodo.status,
        wonRecord: updatedTodo.wonRecord,
      },
    };
  });

// ============================================================
// Lose Todo
// ============================================================

export const loseTodo = protectedProcedure
  .input(loseTodoSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const { todoId, reason, competitor, note, lostVia } = input;
    const { todo, canAccess } = await checkTodoAccess(todoId, userId);

    if (!canAccess) {
      throw new ORPCError("FORBIDDEN");
    }

    if (todo.status !== "pending") {
      throw new ORPCError("BAD_REQUEST", {
        message: "只能將狀態為 pending 的待辦標記為輸單",
      });
    }

    const lostRecord: LostRecord = {
      reason,
      competitor,
      note,
      lostAt: new Date().toISOString(),
      lostVia,
    };

    const updateResult = await db
      .update(salesTodos)
      .set({
        status: "lost",
        lostRecord,
        updatedAt: new Date(),
      })
      .where(eq(salesTodos.id, todoId))
      .returning();

    const updatedTodo = updateResult[0];
    if (!updatedTodo) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // 寫入 todo_logs
    await createTodoLog({
      todoId,
      opportunityId: todo.opportunityId,
      userId,
      action: "lost",
      actionVia: lostVia,
      changes: {
        before: { status: todo.status },
        after: { status: "lost" },
        lostRecord,
      },
      note,
    });

    // 更新 opportunity 的 updatedAt
    if (todo.opportunityId) {
      await db
        .update(opportunities)
        .set({ updatedAt: new Date() })
        .where(eq(opportunities.id, todo.opportunityId));
    }

    return {
      success: true,
      todo: {
        id: updatedTodo.id,
        status: updatedTodo.status,
        lostRecord: updatedTodo.lostRecord,
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

    const isAdmin = userProfile?.role === "admin";
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
    } else if (!isAdmin) {
      // 沒有指定用戶時的預設行為
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

    // 狀態篩選
    if (status) {
      conditions.push(eq(salesTodos.status, status));
    }

    // 日期篩選（使用 UTC+8 時區）
    if (dateFrom) {
      conditions.push(gte(salesTodos.dueDate, getDateStartInTaipei(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(salesTodos.dueDate, getDateEndInTaipei(dateTo)));
    }

    // 查詢待辦
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 同時查詢資料和總數
    const [todos, totalResult] = await Promise.all([
      db.query.salesTodos.findMany({
        where: whereClause,
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
      }),
      db.select({ count: count() }).from(salesTodos).where(whereClause),
    ]);

    return {
      todos: todos.map((todo) => ({
        id: todo.id,
        userId: todo.userId,
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
        cancellationReason: todo.cancellationReason,
        nextTodoId: todo.nextTodoId,
        prevTodoId: todo.prevTodoId,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        customerNumber: todo.customerNumber,
        opportunity: todo.opportunity,
        conversation: todo.conversation,
      })),
      total: totalResult[0]?.count ?? 0,
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

    // 取得今天的日期範圍 (Asia/Taipei timezone, UTC+8)
    const todayStart = getTodayStartInTaipei();
    const todayEnd = getTodayEndInTaipei();

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
  cancel: cancelTodo, // 保留向下相容
  win: winTodo, // 新增
  lose: loseTodo, // 新增
  list: listTodos,
  get: getTodo,
  getTodaysTodos,
};
