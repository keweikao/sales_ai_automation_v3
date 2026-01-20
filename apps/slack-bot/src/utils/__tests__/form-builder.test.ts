import { describe, expect, it } from "vitest";
import {
  buildAudioUploadModal,
  parseAudioUploadFormValues,
} from "../form-builder";
import type { PendingAudioFile } from "../../types";

describe("FormBuilder", () => {
  const mockFile: PendingAudioFile = {
    fileId: "F12345",
    fileName: "test.mp3",
    channelId: "C12345",
    userId: "U12345",
    userName: "testuser",
    threadTs: "1234567890.123456",
    downloadUrl: "https://files.slack.com/test.mp3",
  };

  describe("buildAudioUploadModal", () => {
    it("should build iCHEF modal", () => {
      const modal = buildAudioUploadModal(mockFile, "ichef");
      expect(modal.title.text).toContain("iCHEF");

      // 檢查欄位
      const blockIds = modal.blocks
        .filter((b: unknown) => (b as { type: string }).type === "input")
        .map((b: unknown) => (b as { block_id: string }).block_id);

      expect(blockIds).toContain("store_type");
      expect(blockIds).toContain("service_type"); // iCHEF only
      expect(blockIds).not.toContain("staff_count"); // Beauty only
    });

    it("should build Beauty modal", () => {
      const modal = buildAudioUploadModal(mockFile, "beauty");
      expect(modal.title.text).toContain("美業");

      const blockIds = modal.blocks
        .filter((b: unknown) => (b as { type: string }).type === "input")
        .map((b: unknown) => (b as { block_id: string }).block_id);

      expect(blockIds).toContain("store_type");
      expect(blockIds).toContain("staff_count"); // Beauty only
      expect(blockIds).not.toContain("service_type"); // iCHEF only
    });

    it("should include productLine in private_metadata", () => {
      const modal = buildAudioUploadModal(mockFile, "beauty");
      const metadata = JSON.parse(modal.private_metadata);
      expect(metadata.productLine).toBe("beauty");
    });

    it("should include common fields in both modals", () => {
      const ichefModal = buildAudioUploadModal(mockFile, "ichef");
      const beautyModal = buildAudioUploadModal(mockFile, "beauty");

      const ichefBlockIds = ichefModal.blocks
        .filter((b: unknown) => (b as { type: string }).type === "input")
        .map((b: unknown) => (b as { block_id: string }).block_id);

      const beautyBlockIds = beautyModal.blocks
        .filter((b: unknown) => (b as { type: string }).type === "input")
        .map((b: unknown) => (b as { block_id: string }).block_id);

      // 通用欄位
      expect(ichefBlockIds).toContain("customer_number");
      expect(ichefBlockIds).toContain("customer_name");
      expect(ichefBlockIds).toContain("current_system");
      expect(ichefBlockIds).toContain("decision_maker_present");

      expect(beautyBlockIds).toContain("customer_number");
      expect(beautyBlockIds).toContain("customer_name");
      expect(beautyBlockIds).toContain("current_system");
      expect(beautyBlockIds).toContain("decision_maker_present");
    });

    it("should preserve file metadata in private_metadata", () => {
      const modal = buildAudioUploadModal(mockFile, "ichef");
      const metadata = JSON.parse(modal.private_metadata);

      expect(metadata.fileId).toBe(mockFile.fileId);
      expect(metadata.fileName).toBe(mockFile.fileName);
      expect(metadata.channelId).toBe(mockFile.channelId);
      expect(metadata.userId).toBe(mockFile.userId);
      expect(metadata.downloadUrl).toBe(mockFile.downloadUrl);
    });
  });

  describe("parseAudioUploadFormValues", () => {
    it("should parse iCHEF form values", () => {
      const values = {
        customer_number: { customer_number: { value: "CUST-001" } },
        customer_name: { customer_name: { value: "Test Shop" } },
        store_type: {
          store_type: { selected_option: { value: "coffee_shop" } },
        },
        service_type: {
          service_type: { selected_option: { value: "dine_in" } },
        },
        current_system: { current_system: { selected_option: { value: "none" } } },
        decision_maker_present: {
          decision_maker_present: { selected_option: { value: "yes" } },
        },
      };

      const metadata = parseAudioUploadFormValues(values, "ichef");
      expect(metadata.productLine).toBe("ichef");
      expect(metadata.customerNumber).toBe("CUST-001");
      expect(metadata.customerName).toBe("Test Shop");
      expect(metadata.storeType).toBe("coffee_shop");
      expect(metadata.serviceType).toBe("dine_in");
      expect(metadata.currentSystem).toBe("none");
      expect(metadata.decisionMakerPresent).toBe("yes");
      expect(metadata.staffCount).toBeUndefined(); // Beauty only
    });

    it("should parse Beauty form values", () => {
      const values = {
        customer_number: { customer_number: { value: "CUST-002" } },
        customer_name: { customer_name: { value: "Beauty Salon" } },
        store_type: { store_type: { selected_option: { value: "hair_salon" } } },
        staff_count: { staff_count: { selected_option: { value: "4-10" } } },
        current_system: { current_system: { selected_option: { value: "excel" } } },
        decision_maker_present: {
          decision_maker_present: { selected_option: { value: "no" } },
        },
      };

      const metadata = parseAudioUploadFormValues(values, "beauty");
      expect(metadata.productLine).toBe("beauty");
      expect(metadata.customerNumber).toBe("CUST-002");
      expect(metadata.customerName).toBe("Beauty Salon");
      expect(metadata.storeType).toBe("hair_salon");
      expect(metadata.staffCount).toBe("4-10");
      expect(metadata.currentSystem).toBe("excel");
      expect(metadata.decisionMakerPresent).toBe("no");
      expect(metadata.serviceType).toBeUndefined(); // iCHEF only
    });

    it("should handle missing optional fields", () => {
      const values = {
        customer_number: { customer_number: { value: "CUST-003" } },
        customer_name: { customer_name: { value: "Minimal Data" } },
        store_type: { store_type: { selected_option: { value: "restaurant" } } },
        current_system: { current_system: { selected_option: { value: "pos" } } },
      };

      const metadata = parseAudioUploadFormValues(values, "ichef");
      expect(metadata.productLine).toBe("ichef");
      expect(metadata.customerNumber).toBe("CUST-003");
      expect(metadata.customerName).toBe("Minimal Data");
      expect(metadata.decisionMakerPresent).toBeUndefined();
    });
  });
});
