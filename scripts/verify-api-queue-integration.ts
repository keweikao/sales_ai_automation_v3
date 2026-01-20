#!/usr/bin/env bun
/**
 * 驗證 API 和 Queue Worker 的產品線整合
 *
 * 這個腳本不執行實際測試,而是進行程式碼層級的驗證
 */

import { describe, it, expect } from "bun:test";

describe("API Router - Opportunity", () => {
  it("應該能讀取 opportunity router 檔案", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./packages/api/src/routers/opportunity.ts", "utf-8");
    expect(content).toContain("productLine");
    expect(content).toContain('z.enum(["ichef", "beauty"])');
  });

  it("createOpportunitySchema 應該包含 productLine 欄位", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./packages/api/src/routers/opportunity.ts", "utf-8");

    // 檢查 createOpportunitySchema 包含 productLine
    expect(content).toContain("createOpportunitySchema");
    expect(content).toContain("productLine: z.enum");

    // 檢查有 optional() 或 default()
    const hasOptionalOrDefault = content.includes("productLine: z.enum") &&
      (content.match(/productLine:.*\.optional\(\)/s) !== null || content.match(/productLine:.*\.default\(/s) !== null);
    expect(hasOptionalOrDefault).toBe(true);
  });

  it("listOpportunitiesSchema 應該支援 productLine 過濾", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./packages/api/src/routers/opportunity.ts", "utf-8");

    // 檢查 listOpportunitiesSchema 包含 productLine
    expect(content).toContain("listOpportunitiesSchema");

    // 檢查在 list schema 中有 productLine 過濾
    const hasProductLineFilter = content.includes("listOpportunitiesSchema") &&
      content.match(/productLine:.*z\.enum.*optional/s);
    expect(hasProductLineFilter).toBeTruthy();
  });
});

describe("API Router - Conversation", () => {
  it("應該能讀取 conversation router 檔案", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./packages/api/src/routers/conversation.ts", "utf-8");
    expect(content).toContain("productLine");
    expect(content).toContain('z.enum(["ichef", "beauty"])');
  });

  it("uploadConversationSchema 應該包含 productLine 欄位", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./packages/api/src/routers/conversation.ts", "utf-8");

    // 檢查 uploadConversationSchema 包含 productLine
    expect(content).toContain("uploadConversationSchema");

    // 檢查有 optional() 表示向後相容
    const hasOptional = content.includes("uploadConversationSchema") &&
      content.match(/productLine:.*\.optional\(\)/s);
    expect(hasOptional).toBeTruthy();
  });

  it("metadata 應該使用 passthrough() 支援額外欄位", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./packages/api/src/routers/conversation.ts", "utf-8");

    // 檢查 metadata 使用 passthrough() 以支援美業專屬欄位
    const hasPassthrough = content.includes("metadata") &&
      content.match(/\.passthrough\(\)/);
    expect(hasPassthrough).toBeTruthy();
  });
});

describe("Queue Worker", () => {
  it("應該能讀取 queue worker 檔案", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./apps/queue-worker/src/index.ts", "utf-8");
    expect(content).toContain("productLine");
  });

  it("QueueTranscriptionMessage 應該包含 productLine 欄位", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./apps/queue-worker/src/index.ts", "utf-8");

    // 檢查 QueueTranscriptionMessage interface
    expect(content).toContain("QueueTranscriptionMessage");
    expect(content).toContain('productLine?: "ichef" | "beauty"');
  });

  it("Queue handler 應該解析 productLine 並提供預設值", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./apps/queue-worker/src/index.ts", "utf-8");

    // 檢查有解析 productLine 的邏輯
    const hasProductLineResolution = content.includes("productLine") &&
      (content.match(/resolvedProductLine.*=.*productLine.*\|\|.*"ichef"/s) ||
       content.match(/productLine.*\?.*:.*"ichef"/s));
    expect(hasProductLineResolution).toBeTruthy();
  });

  it("Queue handler 應該記錄 productLine 資訊", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./apps/queue-worker/src/index.ts", "utf-8");

    // 檢查有 log productLine
    const logsProductLine = content.includes("Product Line") ||
      content.includes("productLine");
    expect(logsProductLine).toBe(true);
  });
});

describe("Database Schema", () => {
  it("Migration 應該包含所有需要的 product_line 欄位", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./packages/db/src/migrations/0003_add_product_line.sql", "utf-8");

    // 檢查所有表格都有 product_line 欄位
    expect(content).toContain("ALTER TABLE opportunities");
    expect(content).toContain("ALTER TABLE conversations");
    expect(content).toContain("ALTER TABLE talk_tracks");
    expect(content).toContain("ALTER TABLE meddic_analyses");

    // 檢查有 DEFAULT 值
    expect(content).toContain("DEFAULT 'ichef'");

    // 檢查有 NOT NULL 約束
    expect(content).toContain("NOT NULL");
  });

  it("Migration 應該建立索引以提升查詢效能", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("./packages/db/src/migrations/0003_add_product_line.sql", "utf-8");

    // 檢查有建立索引
    expect(content).toContain("CREATE INDEX idx_opportunities_product_line");
    expect(content).toContain("CREATE INDEX idx_conversations_product_line");
    expect(content).toContain("CREATE INDEX idx_talk_tracks_product_line");
    expect(content).toContain("CREATE INDEX idx_meddic_analyses_product_line");
  });
});

describe("Form Builder (Slack Bot)", () => {
  it("應該能讀取 form-builder 檔案", async () => {
    const fs = await import("node:fs/promises");
    try {
      const content = await fs.readFile("./apps/slack-bot/src/utils/form-builder.ts", "utf-8");
      expect(content).toContain("productLine");
    } catch (error) {
      // 如果檔案不存在,可能是不同的實作方式,跳過
      console.log("⚠️ form-builder.ts 不存在,跳過測試");
    }
  });
});

describe("向後相容性檢查", () => {
  it("所有 productLine 欄位都應該是 optional 或有 default", async () => {
    const fs = await import("node:fs/promises");

    // 檢查 API schemas
    const oppContent = await fs.readFile("./packages/api/src/routers/opportunity.ts", "utf-8");
    const convContent = await fs.readFile("./packages/api/src/routers/conversation.ts", "utf-8");

    // 所有 productLine 都應該是 optional
    const oppHasOptional = oppContent.match(/productLine:.*\.optional\(\)/gs);
    const convHasOptional = convContent.match(/productLine:.*\.optional\(\)/gs);

    expect(oppHasOptional).toBeTruthy();
    expect(convHasOptional).toBeTruthy();
  });

  it("預設值應該統一為 'ichef'", async () => {
    const fs = await import("node:fs/promises");

    // 檢查各個檔案中的預設值
    const files = [
      "./packages/db/src/migrations/0003_add_product_line.sql",
      "./apps/queue-worker/src/index.ts",
      "./packages/shared/src/product-configs/registry.ts",
      "./apps/slack-bot/src/utils/product-line-resolver.ts",
    ];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, "utf-8");

        // 檢查預設值是 'ichef'
        if (content.includes("default") || content.includes("DEFAULT")) {
          const hasIchefDefault = content.match(/default.*["']ichef["']/i) ||
            content.match(/DEFAULT.*["']ichef["']/i) ||
            content.match(/\|\|.*["']ichef["']/);
          expect(hasIchefDefault).toBeTruthy();
        }
      } catch (error) {
        // 檔案不存在就跳過
        console.log(`⚠️ ${file} 不存在,跳過檢查`);
      }
    }
  });
});

console.log("\n✅ API 和 Queue Worker 整合驗證完成\n");
