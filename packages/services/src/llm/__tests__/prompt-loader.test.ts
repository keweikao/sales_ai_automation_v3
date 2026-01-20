/**
 * PromptLoader 測試
 */

import { describe, expect, it } from "bun:test";
import {
  buildAgentPrompt,
  getAvailableProductLines,
  isProductLineSupported,
  loadMeddicPrompts,
} from "../prompt-loader";

describe("PromptLoader", () => {
  describe("loadMeddicPrompts", () => {
    it("應該載入 iCHEF 提示詞", () => {
      const prompts = loadMeddicPrompts("ichef");

      // Shared prompts
      expect(prompts.system).toBeDefined();
      expect(prompts.system).toContain("MEDDIC");
      expect(prompts.analysisFramework).toBeDefined();
      expect(prompts.outputFormat).toBeDefined();

      // iCHEF specific prompts
      expect(prompts.metricsFocus).toBeDefined();
      expect(prompts.metricsFocus).toContain("餐飲業");
      expect(prompts.decisionProcess).toBeDefined();
      expect(prompts.economicBuyer).toBeDefined();
      expect(prompts.decisionCriteria).toBeDefined();
      expect(prompts.identifyPain).toBeDefined();
      expect(prompts.champion).toBeDefined();
    });

    it("應該載入美業提示詞", () => {
      const prompts = loadMeddicPrompts("beauty");

      // Shared prompts
      expect(prompts.system).toBeDefined();
      expect(prompts.analysisFramework).toBeDefined();
      expect(prompts.outputFormat).toBeDefined();

      // Beauty specific prompts
      expect(prompts.metricsFocus).toBeDefined();
      expect(prompts.metricsFocus).toContain("美業");
      expect(prompts.decisionProcess).toBeDefined();
      expect(prompts.economicBuyer).toBeDefined();
      expect(prompts.decisionCriteria).toBeDefined();
      expect(prompts.identifyPain).toBeDefined();
      expect(prompts.champion).toBeDefined();
    });

    it("應該預設為 iCHEF", () => {
      const defaultPrompts = loadMeddicPrompts();
      const ichefPrompts = loadMeddicPrompts("ichef");

      expect(defaultPrompts.metricsFocus).toBe(ichefPrompts.metricsFocus);
      expect(defaultPrompts.decisionProcess).toBe(ichefPrompts.decisionProcess);
    });

    it("iCHEF 和美業提示詞應該不同", () => {
      const ichefPrompts = loadMeddicPrompts("ichef");
      const beautyPrompts = loadMeddicPrompts("beauty");

      // Shared prompts should be the same
      expect(ichefPrompts.system).toBe(beautyPrompts.system);
      expect(ichefPrompts.analysisFramework).toBe(
        beautyPrompts.analysisFramework
      );

      // Product-specific prompts should be different
      expect(ichefPrompts.metricsFocus).not.toBe(beautyPrompts.metricsFocus);
      expect(ichefPrompts.decisionProcess).not.toBe(
        beautyPrompts.decisionProcess
      );
    });
  });

  describe("buildAgentPrompt", () => {
    it("應該正確組合 iCHEF Metrics Agent 提示詞", () => {
      const prompt = buildAgentPrompt("metricsFocus", "ichef");

      // Should contain all parts
      expect(prompt).toContain("MEDDIC"); // system
      expect(prompt).toContain("分析步驟"); // analysisFramework
      expect(prompt).toContain("餐飲業"); // metricsFocus (iCHEF)
      expect(prompt).toContain("輸出格式要求"); // outputFormat
    });

    it("應該正確組合美業 Decision Process Agent 提示詞", () => {
      const prompt = buildAgentPrompt("decisionProcess", "beauty");

      expect(prompt).toContain("MEDDIC");
      expect(prompt).toContain("美業");
      expect(prompt).toContain("輸出格式要求");
    });

    it("應該預設為 iCHEF", () => {
      const defaultPrompt = buildAgentPrompt("metricsFocus");
      const ichefPrompt = buildAgentPrompt("metricsFocus", "ichef");

      expect(defaultPrompt).toBe(ichefPrompt);
    });

    it("所有 Agent 類型應該都能組合", () => {
      const agentTypes: Array<
        | "metricsFocus"
        | "decisionProcess"
        | "economicBuyer"
        | "decisionCriteria"
        | "identifyPain"
        | "champion"
      > = [
        "metricsFocus",
        "decisionProcess",
        "economicBuyer",
        "decisionCriteria",
        "identifyPain",
        "champion",
      ];

      for (const agentType of agentTypes) {
        const prompt = buildAgentPrompt(agentType, "ichef");
        expect(prompt).toBeDefined();
        expect(prompt.length).toBeGreaterThan(0);
        expect(prompt).toContain("MEDDIC");
      }
    });
  });

  describe("getAvailableProductLines", () => {
    it("應該返回所有可用產品線", () => {
      const lines = getAvailableProductLines();

      expect(lines).toContain("ichef");
      expect(lines).toContain("beauty");
      expect(lines).not.toContain("shared");
    });

    it("返回的陣列應該有正確長度", () => {
      const lines = getAvailableProductLines();
      expect(lines.length).toBe(2);
    });
  });

  describe("isProductLineSupported", () => {
    it("應該正確判斷支援的產品線", () => {
      expect(isProductLineSupported("ichef")).toBe(true);
      expect(isProductLineSupported("beauty")).toBe(true);
    });

    it("應該正確判斷不支援的產品線", () => {
      expect(isProductLineSupported("unknown")).toBe(false);
      expect(isProductLineSupported("shared")).toBe(false);
      expect(isProductLineSupported("")).toBe(false);
    });
  });
});
