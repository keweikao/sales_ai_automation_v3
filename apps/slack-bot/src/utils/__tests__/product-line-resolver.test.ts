import { describe, expect, it } from "vitest";
import {
  resolveProductLine,
  validateProductLineConfig,
} from "../product-line-resolver";
import type { Env } from "../../types";

describe("ProductLineResolver", () => {
  describe("resolveProductLine", () => {
    it("should return ichef for configured channel", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: '{"C12345":"ichef"}',
      };
      expect(resolveProductLine("C12345", env as Env)).toBe("ichef");
    });

    it("should return beauty for configured channel", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: '{"C67890":"beauty"}',
      };
      expect(resolveProductLine("C67890", env as Env)).toBe("beauty");
    });

    it("should default to ichef for unconfigured channel", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: '{"C12345":"ichef"}',
      };
      expect(resolveProductLine("C99999", env as Env)).toBe("ichef");
    });

    it("should default to ichef when no config", () => {
      const env: Partial<Env> = {};
      expect(resolveProductLine("C12345", env as Env)).toBe("ichef");
    });

    it("should default to ichef on parse error", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: "invalid json",
      };
      expect(resolveProductLine("C12345", env as Env)).toBe("ichef");
    });

    it("should handle multiple channels", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS:
          '{"C12345":"ichef","C67890":"beauty","C11111":"ichef"}',
      };
      expect(resolveProductLine("C12345", env as Env)).toBe("ichef");
      expect(resolveProductLine("C67890", env as Env)).toBe("beauty");
      expect(resolveProductLine("C11111", env as Env)).toBe("ichef");
    });
  });

  describe("validateProductLineConfig", () => {
    it("should validate correct config", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: '{"C12345":"ichef","C67890":"beauty"}',
      };
      const result = validateProductLineConfig(env as Env);
      expect(result.valid).toBe(true);
      expect(result.channelCount).toBe(2);
    });

    it("should reject invalid product line", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: '{"C12345":"invalid"}',
      };
      const result = validateProductLineConfig(env as Env);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid product line");
    });

    it("should handle empty config", () => {
      const env: Partial<Env> = {};
      const result = validateProductLineConfig(env as Env);
      expect(result.valid).toBe(true);
      expect(result.channelCount).toBe(0);
    });

    it("should reject array instead of object", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: '["ichef","beauty"]',
      };
      const result = validateProductLineConfig(env as Env);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a JSON object");
    });

    it("should reject invalid JSON", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: "{invalid json",
      };
      const result = validateProductLineConfig(env as Env);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should validate single channel config", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: '{"C12345":"beauty"}',
      };
      const result = validateProductLineConfig(env as Env);
      expect(result.valid).toBe(true);
      expect(result.channelCount).toBe(1);
    });
  });
});
