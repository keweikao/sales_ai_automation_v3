// scripts/migration/config.ts

import { Storage } from "@google-cloud/storage";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";

// Import schema directly
import * as schema from "../../packages/db/src/schema";

// 載入環境變數（同步）
// 優先順序：
// 1. .env.migration（遷移專用設定）
// 2. apps/server/.env（共用設定如 DATABASE_URL, R2）
const envFiles = [
  resolve(process.cwd(), ".env.migration"),
  resolve(process.cwd(), "apps/server/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    const text = readFileSync(envFile, "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // 移除引號
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // 只設定尚未定義的變數
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

// 環境變數輔助函數
function getEnvVar(name: string, required = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || "";
}

// Firebase 設定
const serviceAccount: ServiceAccount = {
  projectId: getEnvVar("FIREBASE_PROJECT_ID"),
  clientEmail: getEnvVar("FIREBASE_CLIENT_EMAIL"),
  privateKey: getEnvVar("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
};

// 初始化 Firebase Admin
const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

export const firestore = getFirestore(firebaseApp);

// Google Cloud Storage 客戶端
export const gcsStorage = new Storage({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

// R2 設定
// 支援兩種設定方式：
// 1. CLOUDFLARE_R2_ENDPOINT（apps/server/.env 使用）
// 2. CLOUDFLARE_ACCOUNT_ID（舊的遷移設定）
const r2Endpoint =
  process.env.CLOUDFLARE_R2_ENDPOINT ||
  (process.env.CLOUDFLARE_ACCOUNT_ID
    ? `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "");

export const r2Config = {
  accountId: getEnvVar("CLOUDFLARE_ACCOUNT_ID", false),
  accessKeyId: getEnvVar("CLOUDFLARE_R2_ACCESS_KEY", false),
  secretAccessKey: getEnvVar("CLOUDFLARE_R2_SECRET_KEY", false),
  bucket: getEnvVar("CLOUDFLARE_R2_BUCKET", false),
  endpoint: r2Endpoint,
  publicUrl:
    process.env.CLOUDFLARE_R2_PUBLIC_URL ||
    `https://pub-${process.env.CLOUDFLARE_ACCOUNT_ID || ""}.r2.dev`,
};

// PostgreSQL 資料庫 - 直接建立連線（不透過 workspace package）
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const sql = neon(getEnvVar("DATABASE_URL"));
export const db = drizzle(sql, { schema });

// 匯出 schema 供其他模組使用
export const { conversations, meddicAnalyses, opportunities } = schema;

// 遷移設定（支援環境變數覆蓋）
export const migrationConfig = {
  // 批次設定
  batchSize: Number(process.env.BATCH_SIZE) || 100, // 每批處理數量
  batchDelayMs: Number(process.env.BATCH_DELAY_MS) || 500, // 批次間延遲（毫秒）

  // 重試設定
  retryAttempts: Number(process.env.MAX_RETRIES) || 3, // 重試次數
  retryDelay: 1000, // 重試延遲（毫秒）

  // 音檔遷移設定
  audioConcurrency: Number(process.env.AUDIO_CONCURRENCY) || 5, // 音檔並行遷移數量

  // 模式設定
  dryRun: process.env.DRY_RUN === "true", // 乾跑模式（不實際寫入）
  verbose: process.env.VERBOSE === "true", // 詳細輸出
};

/**
 * 帶重試的執行函數
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= migrationConfig.retryAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < migrationConfig.retryAttempts) {
        console.warn(
          `[${context}] Attempt ${attempt} failed, retrying in ${migrationConfig.retryDelay}ms...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, migrationConfig.retryDelay)
        );
      }
    }
  }

  throw lastError;
}
