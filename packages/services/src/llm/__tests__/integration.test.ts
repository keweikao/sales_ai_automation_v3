/**
 * 整合測試：驗證 PromptLoader 與 MEDDIC Prompts 的完整功能
 */

import { describe, expect, it } from "bun:test";
import {
  buildAgentPrompt,
  getAvailableProductLines,
  loadMeddicPrompts,
} from "../prompt-loader";

describe("Integration Tests", () => {
  it("應該能夠載入並組合完整的 MEDDIC 提示詞", () => {
    const productLines = getAvailableProductLines();

    for (const productLine of productLines) {
      const prompts = loadMeddicPrompts(productLine);

      // 驗證所有提示詞都已載入
      expect(prompts.system).toBeTruthy();
      expect(prompts.analysisFramework).toBeTruthy();
      expect(prompts.outputFormat).toBeTruthy();
      expect(prompts.metricsFocus).toBeTruthy();
      expect(prompts.decisionProcess).toBeTruthy();
      expect(prompts.economicBuyer).toBeTruthy();
      expect(prompts.decisionCriteria).toBeTruthy();
      expect(prompts.identifyPain).toBeTruthy();
      expect(prompts.champion).toBeTruthy();

      // 驗證內容長度合理
      expect(prompts.system.length).toBeGreaterThan(100);
      expect(prompts.metricsFocus.length).toBeGreaterThan(100);
    }
  });

  it("應該能夠為所有 Agent 類型組合提示詞", () => {
    const agentTypes = [
      "metricsFocus",
      "decisionProcess",
      "economicBuyer",
      "decisionCriteria",
      "identifyPain",
      "champion",
    ] as const;

    const productLines = getAvailableProductLines();

    for (const productLine of productLines) {
      for (const agentType of agentTypes) {
        const prompt = buildAgentPrompt(agentType, productLine);

        // 驗證提示詞包含所有必要部分
        expect(prompt).toContain("MEDDIC");
        expect(prompt).toContain("分析");
        expect(prompt).toContain("輸出格式");

        // 驗證長度合理（組合後應該很長）
        expect(prompt.length).toBeGreaterThan(500);
      }
    }
  });

  it("iCHEF 和美業的提示詞應該包含不同的產業特定內容", () => {
    // iCHEF Metrics
    const ichefMetrics = buildAgentPrompt("metricsFocus", "ichef");
    expect(ichefMetrics).toContain("餐飲業");
    expect(ichefMetrics).toContain("營業額");
    expect(ichefMetrics).toContain("POS");

    // Beauty Metrics
    const beautyMetrics = buildAgentPrompt("metricsFocus", "beauty");
    expect(beautyMetrics).toContain("美業");
    expect(beautyMetrics).toContain("客戶");
    expect(beautyMetrics).toContain("預約");

    // 應該不包含對方的內容
    expect(ichefMetrics).not.toContain("設計師");
    expect(beautyMetrics).not.toContain("POS");
  });

  it("所有產品線的 shared 提示詞應該一致", () => {
    const ichefPrompts = loadMeddicPrompts("ichef");
    const beautyPrompts = loadMeddicPrompts("beauty");

    expect(ichefPrompts.system).toBe(beautyPrompts.system);
    expect(ichefPrompts.analysisFramework).toBe(
      beautyPrompts.analysisFramework
    );
    expect(ichefPrompts.outputFormat).toBe(beautyPrompts.outputFormat);
  });

  it("提示詞應該包含繁體中文內容", () => {
    const prompt = buildAgentPrompt("metricsFocus", "ichef");

    // 驗證包含繁體中文
    expect(prompt).toMatch(/[\u4e00-\u9fa5]/);
    expect(prompt).toContain("分析");
    expect(prompt).toContain("台灣繁體中文");
  });
});
