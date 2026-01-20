import { describe, expect, it } from "vitest";
import {
  buildAudioUploadModal,
  parseAudioUploadFormValues,
} from "../form-builder";
import { resolveProductLine } from "../product-line-resolver";
import type { Env, PendingAudioFile } from "../../types";

/**
 * 向後相容性測試
 * 確保在沒有配置環境變數的情況下，系統行為與之前完全相同
 */
describe("Backward Compatibility", () => {
  const mockFile: PendingAudioFile = {
    fileId: "F12345",
    fileName: "test.mp3",
    channelId: "C12345",
    userId: "U12345",
    userName: "testuser",
    threadTs: "1234567890.123456",
    downloadUrl: "https://files.slack.com/test.mp3",
  };

  describe("Without PRODUCT_LINE_CHANNELS configured", () => {
    it("should default to ichef for any channel", () => {
      const env: Partial<Env> = {};
      expect(resolveProductLine("C12345", env as Env)).toBe("ichef");
      expect(resolveProductLine("C67890", env as Env)).toBe("ichef");
      expect(resolveProductLine("CTEST", env as Env)).toBe("ichef");
    });

    it("should build iCHEF modal with original fields", () => {
      const modal = buildAudioUploadModal(mockFile, "ichef");

      // 檢查標題
      expect(modal.title.text).toContain("iCHEF");

      // 檢查欄位包含 iCHEF 特有的欄位
      const blockIds = modal.blocks
        .filter((b: unknown) => (b as { type: string }).type === "input")
        .map((b: unknown) => (b as { block_id: string }).block_id);

      // 必須包含原有的 iCHEF 欄位
      expect(blockIds).toContain("customer_number");
      expect(blockIds).toContain("customer_name");
      expect(blockIds).toContain("store_type");
      expect(blockIds).toContain("service_type"); // iCHEF 特有
      expect(blockIds).toContain("current_system");
      expect(blockIds).toContain("decision_maker_present");

      // 不應包含 Beauty 特有欄位
      expect(blockIds).not.toContain("staff_count");
    });

    it("should parse iCHEF form values correctly", () => {
      const values = {
        customer_number: { customer_number: { value: "CUST-001" } },
        customer_name: { customer_name: { value: "Coffee Shop" } },
        store_type: { store_type: { selected_option: { value: "cafe" } } },
        service_type: {
          service_type: { selected_option: { value: "dine_in_main" } },
        },
        current_system: {
          current_system: { selected_option: { value: "none" } },
        },
        decision_maker_present: {
          decision_maker_present: { selected_option: { value: "yes" } },
        },
      };

      const metadata = parseAudioUploadFormValues(values, "ichef");

      expect(metadata.productLine).toBe("ichef");
      expect(metadata.customerNumber).toBe("CUST-001");
      expect(metadata.customerName).toBe("Coffee Shop");
      expect(metadata.storeType).toBe("cafe");
      expect(metadata.serviceType).toBe("dine_in_main");
      expect(metadata.currentSystem).toBe("none");
      expect(metadata.decisionMakerPresent).toBe("yes");
      expect(metadata.staffCount).toBeUndefined();
    });
  });

  describe("Error handling - graceful degradation", () => {
    it("should default to ichef on invalid JSON", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: "not valid json",
      };
      expect(resolveProductLine("C12345", env as Env)).toBe("ichef");
    });

    it("should default to ichef for unconfigured channel", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: '{"C99999":"ichef"}',
      };
      expect(resolveProductLine("C12345", env as Env)).toBe("ichef");
    });

    it("should default to ichef on array instead of object", () => {
      const env: Partial<Env> = {
        PRODUCT_LINE_CHANNELS: '["ichef","beauty"]',
      };
      expect(resolveProductLine("C12345", env as Env)).toBe("ichef");
    });
  });

  describe("Data structure compatibility", () => {
    it("should preserve all required fields in metadata", () => {
      const values = {
        customer_number: { customer_number: { value: "C001" } },
        customer_name: { customer_name: { value: "Test" } },
        store_type: { store_type: { selected_option: { value: "cafe" } } },
        service_type: {
          service_type: { selected_option: { value: "dine_in_main" } },
        },
        current_system: { current_system: { selected_option: { value: "none" } } },
        decision_maker_present: {
          decision_maker_present: { selected_option: { value: "yes" } },
        },
      };

      const metadata = parseAudioUploadFormValues(values, "ichef");

      // 所有舊欄位都應存在
      expect(metadata).toHaveProperty("customerNumber");
      expect(metadata).toHaveProperty("customerName");
      expect(metadata).toHaveProperty("storeType");
      expect(metadata).toHaveProperty("serviceType");
      expect(metadata).toHaveProperty("currentSystem");
      expect(metadata).toHaveProperty("decisionMakerPresent");
      expect(metadata).toHaveProperty("productLine");
    });
  });
});
