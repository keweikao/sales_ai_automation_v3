import { createContext } from "@Sales_ai_automation_v3/api/context";
import { appRouter } from "@Sales_ai_automation_v3/api/routers/index";
import { auth } from "@Sales_ai_automation_v3/auth";
import { db } from "@Sales_ai_automation_v3/db";
import { env } from "@Sales_ai_automation_v3/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const startTime = Date.now();

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
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

export default app;
