import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

// 測試環境變數
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// 全域測試設定
beforeAll(async () => {
  console.log("🧪 Setting up test environment...");
});

afterAll(async () => {
  console.log("🧹 Cleaning up test environment...");
});

// 每個測試前後的清理
beforeEach(async () => {
  // 重置所有 mock
  vi.clearAllMocks();
});

afterEach(async () => {
  // 清理測試資料（可選：使用事務回滾）
});

// 全域錯誤處理
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection in test:", error);
});
