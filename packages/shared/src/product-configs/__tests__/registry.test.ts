import { describe, expect, it } from "vitest";
import {
  getAllProductLines,
  getDefaultProductLine,
  getProductConfig,
  isValidProductLine,
} from "../registry";

describe("ProductConfig Registry", () => {
  describe("getProductConfig", () => {
    it("should get iCHEF config", () => {
      const config = getProductConfig("ichef");
      expect(config.id).toBe("ichef");
      expect(config.displayName).toBe("iCHEF POS 系統");
      expect(config.formFields.storeType).toBeDefined();
    });

    it("should get Beauty config", () => {
      const config = getProductConfig("beauty");
      expect(config.id).toBe("beauty");
      expect(config.displayName).toBe("美業管理系統");
      expect(config.formFields.staffCount).toBeDefined();
    });

    it("should throw error for unknown product line", () => {
      // @ts-expect-error - Testing invalid input
      expect(() => getProductConfig("invalid")).toThrow();
    });
  });

  describe("getAllProductLines", () => {
    it("should return all product lines", () => {
      const lines = getAllProductLines();
      expect(lines).toHaveLength(2);
      expect(lines).toContain("ichef");
      expect(lines).toContain("beauty");
    });
  });

  describe("getDefaultProductLine", () => {
    it("should return ichef as default", () => {
      expect(getDefaultProductLine()).toBe("ichef");
    });
  });

  describe("isValidProductLine", () => {
    it("should validate product lines", () => {
      expect(isValidProductLine("ichef")).toBe(true);
      expect(isValidProductLine("beauty")).toBe(true);
      expect(isValidProductLine("invalid")).toBe(false);
    });
  });
});
