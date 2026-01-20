#!/usr/bin/env bun
/**
 * 多產品線整合測試
 * 驗證 Agent A-D 的整合成果
 *
 * 注意: 這是單元測試,不需要實際資料庫連線
 */

import { describe, it, expect } from "bun:test";

// ============================================
// 測試場景 1: iCHEF 流程向後相容性驗證
// ============================================
describe("測試場景 1: iCHEF 流程向後相容性", () => {
  it("應該能導入產品線類型", async () => {
    const module = await import("../packages/shared/src/product-configs/types.js");
    expect(module).toBeDefined();
  });

  it("getDefaultProductLine 應該返回 'ichef'", async () => {
    const { getDefaultProductLine } = await import("../packages/shared/src/product-configs/registry.js");
    const defaultLine = getDefaultProductLine();
    expect(defaultLine).toBe("ichef");
  });

  it("isValidProductLine 應該接受 'ichef'", async () => {
    const { isValidProductLine } = await import("../packages/shared/src/product-configs/registry.js");
    expect(isValidProductLine("ichef")).toBe(true);
  });

  it("getProductConfig 應該能取得 iCHEF 配置", async () => {
    const { getProductConfig } = await import("../packages/shared/src/product-configs/registry.js");
    const config = getProductConfig("ichef");
    expect(config).toBeDefined();
    expect(config.id).toBe("ichef");
    expect(config.name).toBe("ichef");
  });

  it("iCHEF 配置應該包含表單欄位", async () => {
    const { getProductConfig } = await import("../packages/shared/src/product-configs/registry.js");
    const config = getProductConfig("ichef");
    expect(config.formFields).toBeDefined();
    expect(config.formFields.storeType).toBeDefined();
    expect(config.formFields.serviceType).toBeDefined();
  });
});

// ============================================
// 測試場景 2: Beauty 流程新功能驗證
// ============================================
describe("測試場景 2: Beauty 流程新功能", () => {
  it("isValidProductLine 應該接受 'beauty'", async () => {
    const { isValidProductLine } = await import("../packages/shared/src/product-configs/registry.js");
    expect(isValidProductLine("beauty")).toBe(true);
  });

  it("getProductConfig 應該能取得 Beauty 配置", async () => {
    const { getProductConfig } = await import("../packages/shared/src/product-configs/registry.js");
    const config = getProductConfig("beauty");
    expect(config).toBeDefined();
    expect(config.id).toBe("beauty");
    expect(config.name).toBe("beauty");
  });

  it("Beauty 配置應該包含美業特定表單欄位", async () => {
    const { getProductConfig } = await import("../packages/shared/src/product-configs/registry.js");
    const config = getProductConfig("beauty");
    expect(config.formFields).toBeDefined();
    expect(config.formFields.storeType).toBeDefined();
    expect(config.formFields.staffCount).toBeDefined();
    // 美業不應該有 serviceType (iCHEF 專屬)
    expect(config.formFields.serviceType).toBeUndefined();
  });

  it("Beauty 配置應該有不同的 displayName", async () => {
    const { getProductConfig } = await import("../packages/shared/src/product-configs/registry.js");
    const ichefConfig = getProductConfig("ichef");
    const beautyConfig = getProductConfig("beauty");
    expect(ichefConfig.displayName).not.toBe(beautyConfig.displayName);
  });
});

// ============================================
// 測試場景 3: 產品線解析邏輯驗證
// ============================================
describe("測試場景 3: 產品線解析", () => {
  it("resolveProductLine 未設定環境變數時應返回 'ichef'", async () => {
    const { resolveProductLine } = await import("../apps/slack-bot/src/utils/product-line-resolver.js");
    const env = {} as any;
    const result = resolveProductLine("C12345", env);
    expect(result).toBe("ichef");
  });

  it("resolveProductLine 應該能解析設定的 Channel", async () => {
    const { resolveProductLine } = await import("../apps/slack-bot/src/utils/product-line-resolver.js");
    const env = {
      PRODUCT_LINE_CHANNELS: JSON.stringify({
        "C12345": "ichef",
        "C67890": "beauty",
      }),
    } as any;

    expect(resolveProductLine("C12345", env)).toBe("ichef");
    expect(resolveProductLine("C67890", env)).toBe("beauty");
  });

  it("resolveProductLine 未配置的 Channel 應該預設為 'ichef'", async () => {
    const { resolveProductLine } = await import("../apps/slack-bot/src/utils/product-line-resolver.js");
    const env = {
      PRODUCT_LINE_CHANNELS: JSON.stringify({
        "C12345": "beauty",
      }),
    } as any;

    // 未配置的 Channel 應該預設為 ichef
    expect(resolveProductLine("C99999", env)).toBe("ichef");
  });

  it("validateProductLineConfig 應該驗證正確的配置", async () => {
    const { validateProductLineConfig } = await import("../apps/slack-bot/src/utils/product-line-resolver.js");
    const env = {
      PRODUCT_LINE_CHANNELS: JSON.stringify({
        "C12345": "ichef",
        "C67890": "beauty",
      }),
    } as any;

    const result = validateProductLineConfig(env);
    expect(result.valid).toBe(true);
    expect(result.channelCount).toBe(2);
  });

  it("validateProductLineConfig 應該拒絕無效的產品線", async () => {
    const { validateProductLineConfig } = await import("../apps/slack-bot/src/utils/product-line-resolver.js");
    const env = {
      PRODUCT_LINE_CHANNELS: JSON.stringify({
        "C12345": "invalid_product",
      }),
    } as any;

    const result = validateProductLineConfig(env);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================
// 測試場景 4: Prompts 載入功能驗證
// ============================================
describe("測試場景 4: Prompts 載入", () => {
  it("loadMeddicPrompts 應該能載入 iCHEF 提示詞", async () => {
    const { loadMeddicPrompts } = await import("../packages/services/src/llm/prompt-loader.js");
    const prompts = loadMeddicPrompts("ichef");

    expect(prompts).toBeDefined();
    expect(prompts.system).toBeDefined();
    expect(prompts.analysisFramework).toBeDefined();
    expect(prompts.outputFormat).toBeDefined();
    expect(prompts.metricsFocus).toBeDefined();
    expect(prompts.decisionProcess).toBeDefined();
  });

  it("loadMeddicPrompts 應該能載入 Beauty 提示詞", async () => {
    const { loadMeddicPrompts } = await import("../packages/services/src/llm/prompt-loader.js");
    const prompts = loadMeddicPrompts("beauty");

    expect(prompts).toBeDefined();
    expect(prompts.system).toBeDefined();
    expect(prompts.analysisFramework).toBeDefined();
    expect(prompts.outputFormat).toBeDefined();
    expect(prompts.metricsFocus).toBeDefined();
  });

  it("iCHEF 和 Beauty 應該有相同的 shared prompts", async () => {
    const { loadMeddicPrompts } = await import("../packages/services/src/llm/prompt-loader.js");
    const ichefPrompts = loadMeddicPrompts("ichef");
    const beautyPrompts = loadMeddicPrompts("beauty");

    // Shared prompts 應該相同
    expect(ichefPrompts.system).toBe(beautyPrompts.system);
    expect(ichefPrompts.analysisFramework).toBe(beautyPrompts.analysisFramework);
    expect(ichefPrompts.outputFormat).toBe(beautyPrompts.outputFormat);
  });

  it("iCHEF 和 Beauty 應該有不同的 specific prompts", async () => {
    const { loadMeddicPrompts } = await import("../packages/services/src/llm/prompt-loader.js");
    const ichefPrompts = loadMeddicPrompts("ichef");
    const beautyPrompts = loadMeddicPrompts("beauty");

    // Specific prompts 應該不同
    expect(ichefPrompts.metricsFocus).not.toBe(beautyPrompts.metricsFocus);
    expect(ichefPrompts.decisionProcess).not.toBe(beautyPrompts.decisionProcess);
  });

  it("loadMeddicPrompts 預設應該載入 iCHEF", async () => {
    const { loadMeddicPrompts } = await import("../packages/services/src/llm/prompt-loader.js");
    const defaultPrompts = loadMeddicPrompts();
    const ichefPrompts = loadMeddicPrompts("ichef");

    expect(defaultPrompts.metricsFocus).toBe(ichefPrompts.metricsFocus);
  });

  it("buildAgentPrompt 應該能組合完整提示詞", async () => {
    const { buildAgentPrompt } = await import("../packages/services/src/llm/prompt-loader.js");
    const prompt = buildAgentPrompt("metricsFocus", "ichef");

    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(100);
    // 應該包含所有部分
    expect(prompt).toContain("MEDDIC");
  });

  it("getAvailableProductLines 應該返回所有產品線", async () => {
    const { getAvailableProductLines } = await import("../packages/services/src/llm/prompt-loader.js");
    const lines = getAvailableProductLines();

    expect(lines).toContain("ichef");
    expect(lines).toContain("beauty");
    expect(lines.length).toBe(2);
  });

  it("isProductLineSupported 應該正確判斷支援狀態", async () => {
    const { isProductLineSupported } = await import("../packages/services/src/llm/prompt-loader.js");

    expect(isProductLineSupported("ichef")).toBe(true);
    expect(isProductLineSupported("beauty")).toBe(true);
    expect(isProductLineSupported("unknown")).toBe(false);
  });
});

// ============================================
// 額外測試: 類型安全性
// ============================================
describe("額外測試: 類型安全性", () => {
  it("getAllProductLines 應該返回所有產品線", async () => {
    const { getAllProductLines } = await import("../packages/shared/src/product-configs/registry.js");
    const lines = getAllProductLines();

    expect(lines).toContain("ichef");
    expect(lines).toContain("beauty");
    expect(lines.length).toBe(2);
  });

  it("getProductConfig 對於無效產品線應該拋出錯誤", async () => {
    const { getProductConfig } = await import("../packages/shared/src/product-configs/registry.js");

    expect(() => {
      getProductConfig("invalid" as any);
    }).toThrow();
  });

  it("iCHEF prompts 配置應該完整", async () => {
    const { getProductConfig } = await import("../packages/shared/src/product-configs/registry.js");
    const config = getProductConfig("ichef");

    expect(config.prompts).toBeDefined();
    expect(config.prompts.globalContext).toBeDefined();
    expect(config.prompts.productContext).toBeDefined();
    expect(config.prompts.commitmentEvents).toBeDefined();
    expect(config.prompts.commitmentEvents.length).toBeGreaterThan(0);
  });

  it("Beauty prompts 配置應該完整", async () => {
    const { getProductConfig } = await import("../packages/shared/src/product-configs/registry.js");
    const config = getProductConfig("beauty");

    expect(config.prompts).toBeDefined();
    expect(config.prompts.globalContext).toBeDefined();
    expect(config.prompts.productContext).toBeDefined();
    expect(config.prompts.commitmentEvents).toBeDefined();
    expect(config.prompts.commitmentEvents.length).toBeGreaterThan(0);
  });
});

console.log("\n✅ 所有整合測試已定義\n");
