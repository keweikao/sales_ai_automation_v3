/**
 * tRPC vs oRPC Performance Benchmark
 * 測試類型推導、編譯時間、bundle size
 */

import type { ConversationRouter } from "./routers/conversation.js";

// ============================================================
// 類型推導測試
// ============================================================

// tRPC 類型推導
type TRPCConversationCreate = Parameters<
  ConversationRouter["create"]
>[0]["input"];
type TRPCConversationGet = Parameters<ConversationRouter["get"]>[0]["input"];
type TRPCConversationList = Parameters<ConversationRouter["list"]>[0]["input"];

// tRPC 返回類型推導
type TRPCConversationCreateOutput = Awaited<
  ReturnType<ConversationRouter["create"]>
>;
type TRPCConversationGetOutput = Awaited<ReturnType<ConversationRouter["get"]>>;

// ============================================================
// 編譯時間測試 (手動測試)
// ============================================================

/**
 * 測試步驟:
 * 1. 清除 dist 和 tsconfig.tsbuildinfo
 * 2. 記錄 tRPC 編譯時間: bun run build
 * 3. 對比 oRPC 編譯時間
 *
 * 預期結果:
 * - tRPC: 較快的編譯速度(類型推導更直接)
 * - oRPC: 可能稍慢(需要處理 OpenAPI schema)
 */

// ============================================================
// Bundle Size 分析
// ============================================================

/**
 * 測試步驟:
 * 1. 構建 tRPC POC: bun run build
 * 2. 檢查 dist 大小: du -sh dist
 * 3. 對比 oRPC bundle size
 *
 * 預期結果:
 * - tRPC: 更小的 bundle size
 * - oRPC: 包含 OpenAPI schema,bundle 較大
 */

// ============================================================
// 類型安全測試
// ============================================================

// 測試 1: 輸入驗證
const _testInput: TRPCConversationCreate = {
  opportunityId: "opp_123",
  type: "discovery_call",
  title: "Test Conversation",
};

// 測試 2: 錯誤的輸入類型(應該報錯)
// const invalidInput: TRPCConversationCreate = {
//   opportunityId: 123, // Error: Type 'number' is not assignable to type 'string'
//   type: "invalid_type", // Error: Type is not assignable
// };

// 測試 3: 嵌套類型推導
type NestedType = TRPCConversationGetOutput["transcript"]["segments"][number];

// ============================================================
// 性能測試結果記錄
// ============================================================

export interface BenchmarkResult {
  framework: "tRPC" | "oRPC";
  compileTimeMs: number;
  bundleSizeKB: number;
  typeInferenceDepth: number;
  typeCheckTimeMs: number;
}

export const benchmarkResults: Record<string, BenchmarkResult> = {
  tRPC: {
    framework: "tRPC",
    compileTimeMs: 0, // 待測試
    bundleSizeKB: 0, // 待測試
    typeInferenceDepth: 5, // 估算
    typeCheckTimeMs: 0, // 待測試
  },
  oRPC: {
    framework: "oRPC",
    compileTimeMs: 0, // 待測試
    bundleSizeKB: 0, // 待測試
    typeInferenceDepth: 4, // 估算
    typeCheckTimeMs: 0, // 待測試
  },
};

console.log("tRPC POC Benchmark Ready");
console.log("Run: bun run build && du -sh dist");
