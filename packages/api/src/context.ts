import { auth } from "@Sales_ai_automation_v3/auth";
import { env } from "@Sales_ai_automation_v3/env/server";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
  context: HonoContext;
}

// Service Account session for internal API calls
const SERVICE_ACCOUNT_SESSION = {
  user: {
    id: "service-account",
    name: "Service Account",
    email: "service@internal.system",
  },
  session: {
    id: "service-session",
    userId: "service-account",
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  },
};

export async function createContext({ context }: CreateContextOptions) {
  // 1. First, check for Bearer Token authentication (Service Account)
  const authHeader = context.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    // Validate against API_TOKEN or SERVICE_API_TOKEN environment variable
    const envRecord = env as Record<string, unknown>;
    const apiToken = (envRecord.API_TOKEN || envRecord.SERVICE_API_TOKEN) as
      | string
      | undefined;
    if (apiToken && token === apiToken) {
      return {
        session: SERVICE_ACCOUNT_SESSION,
        isServiceAccount: true,
        honoContext: context, // 傳遞 Hono context 以訪問 executionCtx
        env, // 加入環境變數
      };
    }
  }

  // 2. Fall back to BetterAuth session authentication
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    session,
    isServiceAccount: false,
    honoContext: context, // 傳遞 Hono context 以訪問 executionCtx
    env, // 加入環境變數
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
