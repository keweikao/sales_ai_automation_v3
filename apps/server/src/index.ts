import { createContext } from "@Sales_ai_automation_v3/api/context";
import { appRouter } from "@Sales_ai_automation_v3/api/routers/index";
import { auth } from "@Sales_ai_automation_v3/auth";
import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
} from "@Sales_ai_automation_v3/db/schema";
import { env } from "@Sales_ai_automation_v3/env/server";
import {
  computeRepReport,
  computeTeamReport,
  computeUploadRankings,
  createKVCacheService,
  extractCoachingNotes,
} from "@Sales_ai_automation_v3/services";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const startTime = Date.now();

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN ?? "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => {
  return c.text("OK");
});

// Health check endpoint for Ops Automation
app.get("/health", async (c) => {
  const checks: Record<
    string,
    { status: "healthy" | "unhealthy"; latency?: number; error?: string }
  > = {};

  // Database check
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "healthy", latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      status: "unhealthy",
      latency: Date.now() - dbStart,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Calculate overall status
  const isHealthy = Object.values(checks).every(
    (check) => check.status === "healthy"
  );
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  const response = {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime,
    version: process.env.npm_package_version ?? "unknown",
    checks,
  };

  return c.json(response, isHealthy ? 200 : 503);
});

// Readiness probe (for Kubernetes/container orchestration)
app.get("/ready", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({ ready: true }, 200);
  } catch {
    return c.json({ ready: false }, 503);
  }
});

// Liveness probe (simple check that the process is running)
app.get("/live", (c) => {
  return c.json({ alive: true }, 200);
});

// 手動觸發報表預計算（僅限管理員）
app.post("/api/admin/precompute-reports", async (c) => {
  const kv = (c.env as any).CACHE_KV as KVNamespace | undefined;
  if (!kv) {
    return c.json({ error: "CACHE_KV not configured" }, 500);
  }

  try {
    console.log("[Reports] Manual precomputation triggered...");
    await precomputeReports(kv);
    return c.json({
      success: true,
      message: "Reports precomputed successfully",
    });
  } catch (error) {
    console.error("[Reports] Manual precomputation failed:", error);
    return c.json({ error: String(error) }, 500);
  }
});

// 測試 KV Cache 讀取（完整資料）
app.get("/api/admin/test-cache/:key", async (c) => {
  const kv = (c.env as any).CACHE_KV as KVNamespace | undefined;
  if (!kv) {
    return c.json({ error: "CACHE_KV not configured" }, 500);
  }

  const key = c.req.param("key");
  try {
    const value = await kv.get(key, "json");
    return c.json({
      key,
      found: value !== null,
      data: value,
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================
// Admin API: 重試對話轉錄
// ============================================================
app.post("/api/admin/retry-conversation", async (c) => {
  // 驗證 API Token
  const authHeader = c.req.header("Authorization");
  const envRecord = c.env as Record<string, unknown>;
  const apiToken = (envRecord.API_TOKEN || env.API_TOKEN) as string | undefined;

  if (!(authHeader?.startsWith("Bearer ") && apiToken)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  if (token !== apiToken) {
    return c.json({ error: "Invalid token" }, 401);
  }

  // 獲取參數
  const body = await c.req.json<{
    conversationId?: string;
    caseNumber?: string;
  }>();

  if (!(body.conversationId || body.caseNumber)) {
    return c.json({ error: "Must provide conversationId or caseNumber" }, 400);
  }

  try {
    // 查詢對話
    let conversation;
    if (body.conversationId) {
      conversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, body.conversationId),
      });
    } else if (body.caseNumber) {
      conversation = await db.query.conversations.findFirst({
        where: eq(conversations.caseNumber, body.caseNumber),
      });
    }

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    // 檢查狀態
    if (!["failed", "pending"].includes(conversation.status)) {
      return c.json(
        {
          error: `Cannot retry conversation with status: ${conversation.status}`,
          currentStatus: conversation.status,
        },
        400
      );
    }

    // 檢查音檔
    if (!conversation.audioUrl) {
      return c.json({ error: "Conversation has no audio URL" }, 400);
    }

    // 重置狀態
    await db
      .update(conversations)
      .set({
        status: "pending",
        errorMessage: null,
        errorDetails: null,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversation.id));

    // 發送到 Queue
    const queue = envRecord.TRANSCRIPTION_QUEUE as
      | { send: (msg: unknown) => Promise<void> }
      | undefined;

    if (!queue) {
      return c.json({ error: "Queue not configured" }, 500);
    }

    const message = {
      conversationId: conversation.id,
      opportunityId: conversation.opportunityId,
      audioUrl: conversation.audioUrl,
      caseNumber: conversation.caseNumber,
      productLine: conversation.productLine || "ichef",
      metadata: {
        fileName: conversation.title || "retry-audio",
        fileSize: 0,
        format: "mp3",
      },
      slackUser: conversation.slackUserId
        ? {
            id: conversation.slackUserId,
            username: conversation.slackUsername || "unknown",
          }
        : undefined,
    };

    await queue.send(message);

    console.log(
      `[Admin] Retry conversation: ${conversation.caseNumber} (${conversation.id})`
    );

    return c.json({
      success: true,
      conversationId: conversation.id,
      caseNumber: conversation.caseNumber,
      message: "Conversation queued for reprocessing",
    });
  } catch (error) {
    console.error("[Admin] Retry conversation failed:", error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================
// Cloudflare Workers Export
// 合併 Hono fetch handler 和 Scheduled handler
// ============================================================

// Type declarations for Cloudflare Workers
interface Env {
  SLACK_BOT_TOKEN?: string;
  CACHE_KV?: KVNamespace;
  [key: string]: unknown;
}

export default {
  // HTTP 請求處理 (Hono app)
  fetch: app.fetch,

  // Cron Trigger 處理 - 定期健康檢查與報表預處理
  async scheduled(
    event: ScheduledEvent,
    cronEnv: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log("[Scheduled] Event triggered:", event.cron);

    try {
      // ============================================================
      // 報表預處理 - 每 15 分鐘更新 KV Cache
      // ============================================================
      if (cronEnv.CACHE_KV) {
        console.log("[Reports] Starting precomputation...");
        await precomputeReports(cronEnv.CACHE_KV);
        console.log("[Reports] Precomputation completed");
      } else {
        console.warn(
          "[Reports] CACHE_KV not configured, skipping precomputation"
        );
      }

      // TODO: Ops orchestrator 功能等待實作
      console.log("[Ops] Health check placeholder - ops module pending");
    } catch (error) {
      console.error("[Scheduled] Event failed:", error);
    }
  },
};

// ============================================================
// Report Precomputation
// ============================================================

async function precomputeReports(kv: KVNamespace): Promise<void> {
  const cacheService = createKVCacheService(kv);
  const TTL_SECONDS = 1800; // 30 分鐘

  // 計算日期範圍
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  try {
    // ========== Step 1: 取得所有用戶和 profiles ==========
    const allUsers = await db.query.user.findMany({
      columns: { id: true, name: true, email: true },
    });

    const allProfiles = await db.query.userProfiles.findMany();
    const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));

    // ========== Step 2: 取得所有對話（用於上傳排名）==========
    const allConversations = await db
      .select({
        id: conversations.id,
        opportunityId: conversations.opportunityId,
        createdAt: conversations.createdAt,
        createdBy: conversations.createdBy,
      })
      .from(conversations)
      .where(gte(conversations.createdAt, thisMonthStart));

    // 為對話加入用戶資訊
    const conversationsWithUser = allConversations.map((c) => {
      const creator = allUsers.find((u) => u.id === c.createdBy);
      const profile = c.createdBy ? profileMap.get(c.createdBy) : undefined;
      return {
        ...c,
        userName: creator?.name || undefined,
        userEmail: creator?.email || undefined,
        department: profile?.department || null,
      };
    });

    // ========== Step 3: 計算上傳排名 ==========
    const uploadRankingsWeekly = computeUploadRankings({
      conversations: conversationsWithUser,
      period: "weekly",
    });

    const uploadRankingsMonthly = computeUploadRankings({
      conversations: conversationsWithUser,
      period: "monthly",
    });

    // 存入 KV
    await cacheService.set(
      "report:upload-ranking:weekly",
      uploadRankingsWeekly,
      TTL_SECONDS
    );
    await cacheService.set(
      "report:upload-ranking:monthly",
      uploadRankingsMonthly,
      TTL_SECONDS
    );
    console.log("[Reports] Upload rankings cached");

    // ========== Step 4: 計算每個用戶的個人報表 ==========
    const repReports: Array<{
      userId: string;
      report: ReturnType<typeof computeRepReport>;
    }> = [];

    for (const u of allUsers) {
      // 取得用戶的 opportunities
      const userOpportunities = await db.query.opportunities.findMany({
        where: eq(opportunities.userId, u.id),
        columns: { id: true, userId: true, companyName: true },
      });

      if (userOpportunities.length === 0) {
        continue;
      }

      const oppIds = userOpportunities.map((o) => o.id);

      // 取得用戶的 conversations
      const userConversations = await db.query.conversations.findMany({
        where: inArray(conversations.opportunityId, oppIds),
        columns: {
          id: true,
          opportunityId: true,
          createdAt: true,
          createdBy: true,
        },
      });

      // 取得當期分析
      const userAnalyses = await db.query.meddicAnalyses.findMany({
        where: and(
          inArray(meddicAnalyses.opportunityId, oppIds),
          gte(meddicAnalyses.createdAt, thirtyDaysAgo)
        ),
        orderBy: desc(meddicAnalyses.createdAt),
      });

      // 取得上期分析
      const previousAnalyses = await db.query.meddicAnalyses.findMany({
        where: and(
          inArray(meddicAnalyses.opportunityId, oppIds),
          gte(meddicAnalyses.createdAt, sixtyDaysAgo),
          lte(meddicAnalyses.createdAt, thirtyDaysAgo)
        ),
      });

      // 提取教練建議
      const coachingNotes: string[] = [];
      for (const a of userAnalyses.slice(0, 5)) {
        const note = extractCoachingNotes(a.agentOutputs);
        if (note) {
          coachingNotes.push(note);
        }
      }

      // 計算所有用戶的平均分數（用於百分位計算）
      const allUserScores = repReports.map((r) => ({
        userId: r.userId,
        avgScore: r.report.summary.averagePdcmScore,
      }));

      const report = computeRepReport({
        userId: u.id,
        analyses: userAnalyses.map((a) => ({
          id: a.id,
          opportunityId: a.opportunityId,
          agentOutputs: a.agentOutputs,
          overallScore: a.overallScore,
          createdAt: a.createdAt,
        })),
        previousPeriodAnalyses: previousAnalyses.map((a) => ({
          id: a.id,
          opportunityId: a.opportunityId,
          agentOutputs: a.agentOutputs,
          overallScore: a.overallScore,
          createdAt: a.createdAt,
        })),
        opportunities: userOpportunities,
        conversations: userConversations,
        allUserScores,
        coachingNotes,
      });

      repReports.push({ userId: u.id, report });

      // 存入 KV
      await cacheService.set(`report:rep:${u.id}`, report, TTL_SECONDS);
    }

    console.log(`[Reports] ${repReports.length} rep reports cached`);

    // ========== Step 5: 計算團隊報表 ==========
    const departments = ["all", "beauty", "ichef"];

    for (const dept of departments) {
      // 篩選成員
      const members = allUsers
        .filter((u) => {
          if (dept === "all") {
            return true;
          }
          const profile = profileMap.get(u.id);
          return profile?.department === dept;
        })
        .map((u) => ({
          ...u,
          profile: profileMap.get(u.id),
        }));

      // 篩選成員報表
      const memberReports = repReports
        .filter((r) => {
          if (dept === "all") {
            return true;
          }
          const profile = profileMap.get(r.userId);
          return profile?.department === dept;
        })
        .map((r) => r.report);

      // 取得需要關注的機會
      const attentionNeeded: Array<{
        opportunityId: string;
        companyName: string;
        assignedTo: string;
        score: number;
        risk: string;
      }> = [];

      // 從成員報表中提取低分機會
      for (const report of memberReports) {
        if (report.summary.averagePdcmScore < 50) {
          const memberUser = allUsers.find((u) => u.id === report.userId);
          attentionNeeded.push({
            opportunityId: report.userId,
            companyName: "整體表現",
            assignedTo: memberUser?.name || "未知",
            score: report.summary.averagePdcmScore,
            risk: "PDCM 平均分數低於 50",
          });
        }
      }

      const teamReport = computeTeamReport({
        department: dept,
        members,
        memberReports,
        uploadRankingsWeekly,
        uploadRankingsMonthly,
        attentionNeededOpportunities: attentionNeeded.slice(0, 10),
      });

      // 存入 KV
      await cacheService.set(`report:team:${dept}`, teamReport, TTL_SECONDS);
    }

    console.log("[Reports] Team reports cached");
  } catch (error) {
    console.error("[Reports] Precomputation failed:", error);
    throw error;
  }
}
