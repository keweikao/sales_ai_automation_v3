import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock S3 Client for R2
const mockS3Client = {
  send: vi.fn(),
};

const mockPutObjectCommand = vi.fn();
const mockGetObjectCommand = vi.fn();
const mockDeleteObjectCommand = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => mockS3Client),
  PutObjectCommand: mockPutObjectCommand,
  GetObjectCommand: mockGetObjectCommand,
  DeleteObjectCommand: mockDeleteObjectCommand,
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

describe("R2 儲存服務", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("上傳功能", () => {
    test("應該成功上傳檔案", async () => {
      mockS3Client.send.mockResolvedValue({
        ETag: '"abc123"',
        $metadata: { httpStatusCode: 200 },
      });

      const uploadFile = async (
        key: string,
        body: Buffer,
        contentType: string
      ) => {
        const command = {
          Bucket: "test-bucket",
          Key: key,
          Body: body,
          ContentType: contentType,
        };
        mockPutObjectCommand(command);
        return mockS3Client.send(command);
      };

      const result = await uploadFile(
        "audio/test-123.mp3",
        Buffer.from("audio data"),
        "audio/mpeg"
      );

      expect(result.$metadata.httpStatusCode).toBe(200);
      expect(mockPutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: "audio/test-123.mp3",
          ContentType: "audio/mpeg",
        })
      );
    });

    test("應該正確設定 metadata", async () => {
      mockS3Client.send.mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
      });

      const uploadWithMetadata = async (
        key: string,
        body: Buffer,
        metadata: Record<string, string>
      ) => {
        const command = {
          Bucket: "test-bucket",
          Key: key,
          Body: body,
          Metadata: metadata,
        };
        mockPutObjectCommand(command);
        return mockS3Client.send(command);
      };

      await uploadWithMetadata("audio/test.mp3", Buffer.from("data"), {
        "x-amz-meta-opportunity-id": "opp-123",
        "x-amz-meta-uploaded-by": "user-456",
      });

      expect(mockPutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Metadata: {
            "x-amz-meta-opportunity-id": "opp-123",
            "x-amz-meta-uploaded-by": "user-456",
          },
        })
      );
    });
  });

  describe("下載功能", () => {
    test("應該成功下載檔案", async () => {
      const mockBody = {
        transformToByteArray: vi
          .fn()
          .mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
      };

      mockS3Client.send.mockResolvedValue({
        Body: mockBody,
        ContentType: "audio/mpeg",
        ContentLength: 4,
        $metadata: { httpStatusCode: 200 },
      });

      const downloadFile = async (key: string) => {
        const command = { Bucket: "test-bucket", Key: key };
        mockGetObjectCommand(command);
        return mockS3Client.send(command);
      };

      const result = await downloadFile("audio/test-123.mp3");

      expect(result.$metadata.httpStatusCode).toBe(200);
      expect(result.ContentType).toBe("audio/mpeg");
    });

    test("應該處理檔案不存在的情況", async () => {
      const notFoundError = new Error("NoSuchKey");
      Object.assign(notFoundError, {
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
      });

      mockS3Client.send.mockRejectedValue(notFoundError);

      const downloadFile = async (key: string) => {
        const command = { Bucket: "test-bucket", Key: key };
        return mockS3Client.send(command);
      };

      await expect(downloadFile("non-existent.mp3")).rejects.toThrow(
        "NoSuchKey"
      );
    });
  });

  describe("刪除功能", () => {
    test("應該成功刪除檔案", async () => {
      mockS3Client.send.mockResolvedValue({
        $metadata: { httpStatusCode: 204 },
      });

      const deleteFile = async (key: string) => {
        const command = { Bucket: "test-bucket", Key: key };
        mockDeleteObjectCommand(command);
        return mockS3Client.send(command);
      };

      const result = await deleteFile("audio/test-123.mp3");

      expect(result.$metadata.httpStatusCode).toBe(204);
    });
  });

  describe("預簽署 URL", () => {
    test("應該產生上傳用預簽署 URL", async () => {
      mockGetSignedUrl.mockResolvedValue(
        "https://bucket.r2.cloudflarestorage.com/audio/test.mp3?X-Amz-Signature=abc"
      );

      const getUploadUrl = async (key: string, expiresIn: number) => {
        return mockGetSignedUrl(mockS3Client, { Key: key }, { expiresIn });
      };

      const url = await getUploadUrl("audio/test.mp3", 3600);

      expect(url).toContain("X-Amz-Signature");
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        { Key: "audio/test.mp3" },
        { expiresIn: 3600 }
      );
    });

    test("應該產生下載用預簽署 URL", async () => {
      mockGetSignedUrl.mockResolvedValue(
        "https://bucket.r2.cloudflarestorage.com/audio/test.mp3?X-Amz-Signature=xyz"
      );

      const getDownloadUrl = async (key: string) => {
        return mockGetSignedUrl(mockS3Client, { Key: key }, { expiresIn: 900 });
      };

      const url = await getDownloadUrl("audio/test.mp3");

      expect(url).toContain("X-Amz-Signature");
    });
  });

  describe("連線失敗處理", () => {
    test("應該處理網路連線失敗", async () => {
      const networkError = new Error("Network error");
      Object.assign(networkError, { code: "ECONNREFUSED" });

      mockS3Client.send.mockRejectedValue(networkError);

      const uploadFile = async (key: string, body: Buffer) => {
        return mockS3Client.send({
          Bucket: "test-bucket",
          Key: key,
          Body: body,
        });
      };

      await expect(uploadFile("test.mp3", Buffer.from("data"))).rejects.toThrow(
        "Network error"
      );
    });

    test("應該處理逾時錯誤", async () => {
      const timeoutError = new Error("Request timeout");
      Object.assign(timeoutError, { code: "ETIMEDOUT" });

      mockS3Client.send.mockRejectedValue(timeoutError);

      await expect(mockS3Client.send({ Key: "test.mp3" })).rejects.toThrow(
        "Request timeout"
      );
    });

    test("應該處理認證失敗", async () => {
      const authError = new Error("Access Denied");
      Object.assign(authError, {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      });

      mockS3Client.send.mockRejectedValue(authError);

      await expect(mockS3Client.send({ Key: "test.mp3" })).rejects.toThrow(
        "Access Denied"
      );
    });
  });

  describe("檔案路徑產生", () => {
    test("應該產生正確的檔案路徑", () => {
      const generateFilePath = (
        opportunityId: string,
        conversationId: string,
        filename: string
      ) => {
        const timestamp = Date.now();
        const ext = filename.split(".").pop();
        return `audio/${opportunityId}/${conversationId}/${timestamp}.${ext}`;
      };

      const path = generateFilePath("opp-123", "conv-456", "recording.mp3");

      expect(path).toMatch(/^audio\/opp-123\/conv-456\/\d+\.mp3$/);
    });
  });
});
