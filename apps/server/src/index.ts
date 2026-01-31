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
  computeAttentionNeeded,
  computeCloseCases,
  computeRepReport,
  computeSystemHealth,
  computeTeamReport,
  computeTodoStats,
  computeUploadRankings,
  computeWeeklyTeamPerformance,
  createKVCacheService,
  extractCoachingNotes,
  KV_KEYS,
  KV_TTL,
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

// Better Auth handler - 處理所有 /api/auth/* 請求
app.all("/api/auth/*", async (c) => {
  const url = new URL(c.req.url);
  console.log(`[Auth] ${c.req.method} ${url.pathname}`);

  try {
    const response = await auth.handler(c.req.raw);
    console.log(
      `[Auth] Response status: ${response.status}, redirect: ${response.headers.get("location") || "none"}`
    );
    return response;
  } catch (error) {
    console.error("[Auth] Error:", error);
    throw error;
  }
});

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
  const envConfig = c.env as Env;
  if (!envConfig.CACHE_KV) {
    return c.json({ error: "CACHE_KV not configured" }, 500);
  }

  try {
    console.log("[Reports] Manual precomputation triggered...");
    await precomputeReports(envConfig);
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
  // Database
  DATABASE_URL?: string;
  // Slack
  SLACK_BOT_TOKEN?: string;
  // KV Cache
  CACHE_KV?: KVNamespace;
  // R2 Storage
  CLOUDFLARE_R2_ACCESS_KEY?: string;
  CLOUDFLARE_R2_SECRET_KEY?: string;
  CLOUDFLARE_R2_ENDPOINT?: string;
  CLOUDFLARE_R2_BUCKET?: string;
  // Server API
  SERVER_URL?: string;
  API_TOKEN?: string;
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
      // 根據 cron 表達式決定執行什麼任務
      // ============================================================
      if (event.cron === "*/15 * * * *") {
        // 每 15 分鐘：報表預計算
        if (cronEnv.CACHE_KV && cronEnv.DATABASE_URL) {
          console.log("[Reports] Starting precomputation...");
          await precomputeReports(cronEnv);
          console.log("[Reports] Precomputation completed");
        } else {
          console.warn(
            "[Reports] CACHE_KV or DATABASE_URL not configured, skipping precomputation"
          );
        }
      } else if (event.cron === "0 19 * * *") {
        // 每天 19:00 UTC (03:00 UTC+8)：音檔修復 Agent
        console.log("[AudioRepairAgent] Starting daily execution...");
        await runAudioRepairAgent(cronEnv);
        console.log("[AudioRepairAgent] Daily execution completed");
      } else {
        console.log(`[Scheduled] Unknown cron: ${event.cron}`);
      }
    } catch (error) {
      console.error("[Scheduled] Event failed:", error);
    }
  },
};

// ============================================================
// Report Precomputation
// ============================================================

async function precomputeReports(cronEnv: Env): Promise<void> {
  const { neon } = await import("@neondatabase/serverless");

  const kv = cronEnv.CACHE_KV;
  if (!kv) {
    throw new Error("CACHE_KV not configured");
  }

  const cacheService = createKVCacheService(kv);
  const TTL_SECONDS = 1800; // 30 分鐘

  // 建立 raw SQL 查詢函數 (用於新版 compute 函數)
  const rawSql = neon(cronEnv.DATABASE_URL || "");

  // 計算日期範圍
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  try {
    // ========== Step 0: 新版報告預計算 ==========
    console.log("[Reports] Computing new report data...");

    // 計算系統健康資料
    const systemHealth = await computeSystemHealth(rawSql);
    await cacheService.set(
      KV_KEYS.SYSTEM_HEALTH,
      systemHealth,
      KV_TTL.SYSTEM_HEALTH
    );
    console.log("[Reports] System health cached");

    // 計算 Close Case 資料
    const closeCases = await computeCloseCases(rawSql);
    await cacheService.set(KV_KEYS.CLOSE_CASES, closeCases, KV_TTL.CLOSE_CASES);
    console.log("[Reports] Close cases cached");

    // 計算需關注資料
    const attentionNeeded = await computeAttentionNeeded(rawSql);
    await cacheService.set(
      KV_KEYS.ATTENTION_NEEDED,
      attentionNeeded,
      KV_TTL.ATTENTION_NEEDED
    );
    console.log("[Reports] Attention needed cached");

    // 計算待辦統計
    const todoStats = await computeTodoStats(rawSql);
    await cacheService.set(KV_KEYS.TODO_STATS, todoStats, KV_TTL.TODO_STATS);
    console.log("[Reports] Todo stats cached");

    // 計算團隊週表現
    const weeklyTeamPerformance = await computeWeeklyTeamPerformance(rawSql);
    await cacheService.set(
      "report:weekly-team-performance",
      weeklyTeamPerformance,
      KV_TTL.TEAM_PERFORMANCE
    );
    console.log("[Reports] Weekly team performance cached");
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

// ============================================================
// Audio Repair Agent
// ============================================================

async function runAudioRepairAgent(cronEnv: Env): Promise<void> {
  // 動態 import 以避免在未使用時載入
  const { runAudioRepairAgent: runAgent, createR2Service } = await import(
    "@Sales_ai_automation_v3/services"
  );

  // 檢查必要的環境變數
  if (
    !(
      cronEnv.CLOUDFLARE_R2_ACCESS_KEY &&
      cronEnv.CLOUDFLARE_R2_SECRET_KEY &&
      cronEnv.CLOUDFLARE_R2_ENDPOINT &&
      cronEnv.CLOUDFLARE_R2_BUCKET
    )
  ) {
    console.warn("[AudioRepairAgent] R2 not configured, skipping");
    return;
  }

  if (!cronEnv.SLACK_BOT_TOKEN) {
    console.warn("[AudioRepairAgent] SLACK_BOT_TOKEN not configured, skipping");
    return;
  }

  // 建立 R2 服務
  const r2Service = createR2Service({
    accessKeyId: cronEnv.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: cronEnv.CLOUDFLARE_R2_SECRET_KEY,
    endpoint: cronEnv.CLOUDFLARE_R2_ENDPOINT,
    bucket: cronEnv.CLOUDFLARE_R2_BUCKET,
  });

  // Server URL 和 API Token
  const serverUrl =
    cronEnv.SERVER_URL ||
    "https://sales-ai-server.salesaiautomationv3.workers.dev";
  const apiToken = cronEnv.API_TOKEN || "";

  if (!apiToken) {
    console.warn("[AudioRepairAgent] API_TOKEN not configured, skipping");
    return;
  }

  // 執行音檔修復 Agent
  const summary = await runAgent({
    db,
    r2Service,
    slackToken: cronEnv.SLACK_BOT_TOKEN,
    serverUrl,
    apiToken,
    dryRun: false,
    maxRetryAttempts: 2,
    stuckThresholdHours: 3,
  });

  console.log(
    `[AudioRepairAgent] Summary: checked=${summary.checkedCount}, retried=${summary.retriedCount}, deleted=${summary.deletedCount}`
  );
}
