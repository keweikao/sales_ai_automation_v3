/**
 * 資料庫連線模組
 *
 * 根據執行環境自動選擇適合的 PostgreSQL driver：
 * - 測試環境 (NODE_ENV=test)：使用標準 pg driver，相容於 CI 的 PostgreSQL container
 * - Production 環境：使用 Neon serverless driver，針對 Cloudflare Workers 優化
 */

import * as schema from "./schema";

// 動態判斷是否為測試環境
const isTestEnv = process.env.NODE_ENV === "test";

// 定義資料庫型別
type DatabaseClient = ReturnType<
  typeof import("drizzle-orm/neon-http").drizzle<typeof schema>
>;

// 建立資料庫連線
let _db: DatabaseClient;
let _dbInitialized = false;

/**
 * 初始化測試環境的資料庫連線
 * 使用標準 pg driver
 */
async function initTestDb(): Promise<DatabaseClient> {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Pool } = await import("pg");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "",
  });

  // 型別斷言：drizzle-orm 的不同 adapter 返回相容的介面
  return drizzle(pool, { schema }) as unknown as DatabaseClient;
}

/**
 * 初始化 Production 環境的資料庫連線
 * 使用 Neon serverless driver (針對 Cloudflare Workers 優化)
 */
function initProductionDb(): DatabaseClient {
  // 動態 require 以避免在測試環境中載入 cloudflare:workers
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { env } = require("@Sales_ai_automation_v3/env/server");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { neon } = require("@neondatabase/serverless");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/neon-http");

  const sql = neon(env.DATABASE_URL || "");
  return drizzle(sql, { schema });
}

/**
 * 取得資料庫連線（非同步版本）
 * 這個函數會快取連線，確保只建立一次
 */
export async function getDb(): Promise<DatabaseClient> {
  if (_dbInitialized) {
    return _db;
  }

  if (isTestEnv) {
    _db = await initTestDb();
  } else {
    _db = initProductionDb();
  }

  _dbInitialized = true;
  return _db;
}

// 為了向後相容，提供同步的 db export
// 注意：在測試環境中，請改用 getDb() 函數
if (!isTestEnv) {
  // Production 環境：立即初始化
  _db = initProductionDb();
  _dbInitialized = true;
}

/**
 * 同步的資料庫連線物件
 * 警告：在測試環境中，此物件可能未初始化，請使用 getDb() 代替
 */
export const db: DatabaseClient = new Proxy({} as DatabaseClient, {
  get(_, prop) {
    if (!_dbInitialized) {
      throw new Error(
        "在測試環境中，請使用 getDb() 取得資料庫連線，而非直接存取 db 物件。" +
          "例如：const db = await getDb(); await db.select()..."
      );
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Re-export all schema tables for convenience
export * from "./schema";
// Export utilities
export * from "./utils/id-generator";
