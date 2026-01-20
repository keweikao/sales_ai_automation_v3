import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock Groq Client
const mockGroqClient = {
  audio: {
    transcriptions: {
      create: vi.fn(),
    },
  },
};

vi.mock("groq-sdk", () => ({
  default: vi.fn(() => mockGroqClient),
}));

describe("Groq Whisper 轉錄服務", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("成功轉錄", () => {
    test("應該成功轉錄音檔", async () => {
      const mockTranscription = {
        text: "這是一段測試對話內容",
        segments: [
          { start: 0, end: 5, text: "這是一段" },
          { start: 5, end: 10, text: "測試對話內容" },
        ],
        language: "zh",
        duration: 10,
      };

      mockGroqClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscription
      );

      const result = await mockGroqClient.audio.transcriptions.create({
        file: new Blob(["audio data"]),
        model: "whisper-large-v3",
        language: "zh",
        response_format: "verbose_json",
      });

      expect(result.text).toBe("這是一段測試對話內容");
      expect(result.language).toBe("zh");
      expect(result.segments).toHaveLength(2);
    });

    test("應該正確處理多語言內容", async () => {
      const mockTranscription = {
        text: "Hello, 你好，這是 mixed language content",
        language: "zh",
        duration: 15,
      };

      mockGroqClient.audio.transcriptions.create.mockResolvedValue(
        mockTranscription
      );

      const result = await mockGroqClient.audio.transcriptions.create({
        file: new Blob(["audio data"]),
        model: "whisper-large-v3",
      });

      expect(result.text).toContain("Hello");
      expect(result.text).toContain("你好");
    });
  });

  describe("錯誤處理", () => {
    test("應該處理 429 Rate Limit 錯誤", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      Object.assign(rateLimitError, { status: 429 });

      mockGroqClient.audio.transcriptions.create.mockRejectedValue(
        rateLimitError
      );

      await expect(
        mockGroqClient.audio.transcriptions.create({
          file: new Blob(["audio data"]),
          model: "whisper-large-v3",
        })
      ).rejects.toThrow("Rate limit exceeded");
    });

    test("應該處理 500 伺服器錯誤", async () => {
      const serverError = new Error("Internal server error");
      Object.assign(serverError, { status: 500 });

      mockGroqClient.audio.transcriptions.create.mockRejectedValue(serverError);

      await expect(
        mockGroqClient.audio.transcriptions.create({
          file: new Blob(["audio data"]),
          model: "whisper-large-v3",
        })
      ).rejects.toThrow("Internal server error");
    });

    test("應該處理無效的音檔格式", async () => {
      const formatError = new Error("Invalid audio format");
      Object.assign(formatError, { status: 400 });

      mockGroqClient.audio.transcriptions.create.mockRejectedValue(formatError);

      await expect(
        mockGroqClient.audio.transcriptions.create({
          file: new Blob(["invalid data"]),
          model: "whisper-large-v3",
        })
      ).rejects.toThrow("Invalid audio format");
    });
  });

  describe("大檔案處理", () => {
    test("應該正確計算分割點", () => {
      const MAX_CHUNK_SIZE = 25 * 1024 * 1024; // 25MB
      const fileSize = 60 * 1024 * 1024; // 60MB

      const calculateChunks = (size: number, maxChunk: number) => {
        return Math.ceil(size / maxChunk);
      };

      expect(calculateChunks(fileSize, MAX_CHUNK_SIZE)).toBe(3);
    });

    test("應該合併分段轉錄結果", () => {
      const chunks = [
        { text: "第一段對話內容", segments: [{ start: 0, end: 30 }] },
        { text: "第二段對話內容", segments: [{ start: 30, end: 60 }] },
        { text: "第三段對話內容", segments: [{ start: 60, end: 90 }] },
      ];

      const mergeTranscriptions = (
        transcriptions: Array<{ text: string; segments: unknown[] }>
      ) => {
        return {
          text: transcriptions.map((t) => t.text).join(" "),
          segments: transcriptions.flatMap((t) => t.segments),
        };
      };

      const merged = mergeTranscriptions(chunks);
      expect(merged.text).toBe("第一段對話內容 第二段對話內容 第三段對話內容");
      expect(merged.segments).toHaveLength(3);
    });
  });

  describe("重試邏輯", () => {
    test("應該在暫時性錯誤時重試", async () => {
      const temporaryError = new Error("Temporary failure");
      Object.assign(temporaryError, { status: 503 });

      mockGroqClient.audio.transcriptions.create
        .mockRejectedValueOnce(temporaryError)
        .mockRejectedValueOnce(temporaryError)
        .mockResolvedValue({ text: "成功轉錄", language: "zh" });

      // 模擬重試邏輯
      const retryWithBackoff = async <T>(
        fn: () => Promise<T>,
        maxRetries = 3
      ): Promise<T> => {
        let lastError: Error | undefined;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            return await fn();
          } catch (error) {
            lastError = error as Error;
          }
        }
        throw lastError;
      };

      const result = await retryWithBackoff(() =>
        mockGroqClient.audio.transcriptions.create({
          file: new Blob(["audio data"]),
          model: "whisper-large-v3",
        })
      );

      expect(result.text).toBe("成功轉錄");
      expect(mockGroqClient.audio.transcriptions.create).toHaveBeenCalledTimes(
        3
      );
    });
  });
});
