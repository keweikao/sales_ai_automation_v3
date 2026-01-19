import { env } from "@Sales_ai_automation_v3/env/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Cloudflare Workers 專用 HTTP 配置 (預設使用連線池)
const sql = neon(env.DATABASE_URL || "");

export const db = drizzle(sql, { schema });

// Re-export all schema tables for convenience
export * from "./schema";
// Export utilities
export * from "./utils/id-generator";
