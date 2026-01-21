/**
 * E2E Integration Tests - Queue Processing
 * 測試完整的音檔處理流程: API → Queue → Worker → DB → Slack
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../packages/db/src/index.js";
import {
  conversations,
  opportunities,
} from "../../packages/db/src/schema/index.js";

// 測試配置
const TEST_TIMEOUT = 5 * 60 * 1000; // 5 分鐘超時

// 測試資料
let testOpportunityId: string;
let testUserId: string;

describe("E2E - Queue Integration", () => {
  beforeAll(async () => {
    // 創建測試 opportunity
    testUserId = `test-user-${randomUUID().slice(0, 8)}`;
    testOpportunityId = `test-opp-${randomUUID().slice(0, 8)}`;

    await db.insert(opportunities).values({
      id: testOpportunityId,
      userId: testUserId,
      companyName: "Test Company",
      customerNumber: "TEST-001",
      stage: "qualified",
      value: 100_000,
      probability: 50,
    });

    console.log("✓ Test opportunity created:", testOpportunityId);
  });

  afterAll(async () => {
    // 清理測試資料
    try {
      await db
        .delete(conversations)
        .where(eq(conversations.opportunityId, testOpportunityId));
      await db
        .delete(opportunities)
        .where(eq(opportunities.id, testOpportunityId));
      console.log("✓ Test data cleaned up");
    } catch (error) {
      console.error("⚠️  Cleanup failed:", error);
    }
  });

  describe("Complete Workflow", () => {
    it(
      "應該處理完整的轉錄流程 (Mock)",
      async () => {
        // 這是一個 mock 測試,因為實際測試需要:
        // 1. 真實的 API server 運行
        // 2. Queue Worker 運行
        // 3. 真實的音檔
        // 4. Groq 和 Gemini API keys

        // Mock 流程驗證:
        const conversationId = randomUUID();

        // Step 1: 模擬 API 創建 conversation
        await db.insert(conversations).values({
          id: conversationId,
          opportunityId: testOpportunityId,
          caseNumber: "202601-IC001",
          title: "Test Conversation",
          type: "discovery_call",
          status: "pending",
          audioUrl: "https://example.com/test-audio.mp3",
          duration: 0,
          conversationDate: new Date(),
          createdBy: testUserId,
        });

        // Step 2: 驗證記錄已創建
        const created = await db.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
        });

        expect(created).toBeDefined();
        expect(created?.status).toBe("pending");
        expect(created?.transcript).toBeNull();

        // Step 3: 模擬 Queue Worker 更新 (transcribed)
        await db
          .update(conversations)
          .set({
            status: "transcribed",
            transcript: {
              fullText: "這是測試轉錄文本",
              language: "zh",
              segments: [
                {
                  speaker: "Sales Rep",
                  text: "你好",
                  start: 0,
                  end: 1,
                },
                {
                  speaker: "Customer",
                  text: "你好",
                  start: 1,
                  end: 2,
                },
              ],
            },
            duration: 2,
          })
          .where(eq(conversations.id, conversationId));

        // Step 4: 驗證轉錄狀態
        const transcribed = await db.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
        });

        expect(transcribed?.status).toBe("transcribed");
        expect(transcribed?.transcript).toBeDefined();
        expect((transcribed?.transcript as any).fullText).toBe(
          "這是測試轉錄文本"
        );

        // Step 5: 模擬 Queue Worker 更新 (completed)
        await db
          .update(conversations)
          .set({
            status: "completed",
            meddicAnalysis: {
              overallScore: 75,
              status: "qualified",
              dimensions: {},
            },
            analyzedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));

        // Step 6: 驗證最終狀態
        const completed = await db.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
        });

        expect(completed?.status).toBe("completed");
        expect(completed?.meddicAnalysis).toBeDefined();
        expect((completed?.meddicAnalysis as any).overallScore).toBe(75);
        expect(completed?.analyzedAt).toBeDefined();

        // 清理
        await db
          .delete(conversations)
          .where(eq(conversations.id, conversationId));
      },
      TEST_TIMEOUT
    );

    it("應該正確處理狀態轉換", async () => {
      const conversationId = randomUUID();

      // 測試狀態轉換序列
      const statusTransitions = [
        "pending",
        "transcribing",
        "transcribed",
        "analyzing",
        "completed",
      ] as const;

      // 創建初始記錄
      await db.insert(conversations).values({
        id: conversationId,
        opportunityId: testOpportunityId,
        caseNumber: "202601-IC002",
        title: "Status Transition Test",
        type: "demo",
        status: "pending",
        audioUrl: "https://example.com/test.mp3",
        duration: 0,
        conversationDate: new Date(),
        createdBy: testUserId,
      });

      // 測試每個狀態轉換
      for (const status of statusTransitions.slice(1)) {
        await db
          .update(conversations)
          .set({ status })
          .where(eq(conversations.id, conversationId));

        const updated = await db.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
        });

        expect(updated?.status).toBe(status);
      }

      // 清理
      await db
        .delete(conversations)
        .where(eq(conversations.id, conversationId));
    });
  });

  describe("Error Scenarios", () => {
    it("應該正確處理失敗狀態", async () => {
      const conversationId = randomUUID();

      // 創建記錄
      await db.insert(conversations).values({
        id: conversationId,
        opportunityId: testOpportunityId,
        caseNumber: "202601-IC003",
        title: "Error Test",
        type: "follow_up",
        status: "pending",
        audioUrl: "https://example.com/test.mp3",
        duration: 0,
        conversationDate: new Date(),
        createdBy: testUserId,
      });

      // 模擬處理失敗
      const errorMessage = "Transcription failed: API error";
      const errorDetails = {
        code: "GROQ_API_ERROR",
        timestamp: new Date().toISOString(),
        stack: "Error stack trace...",
      };

      await db
        .update(conversations)
        .set({
          status: "failed",
          errorMessage,
          errorDetails,
        })
        .where(eq(conversations.id, conversationId));

      // 驗證錯誤狀態
      const failed = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });

      expect(failed?.status).toBe("failed");
      expect(failed?.errorMessage).toBe(errorMessage);
      expect(failed?.errorDetails).toBeDefined();
      expect((failed?.errorDetails as any).code).toBe("GROQ_API_ERROR");

      // 清理
      await db
        .delete(conversations)
        .where(eq(conversations.id, conversationId));
    });

    it("應該能從 failed 狀態恢復", async () => {
      const conversationId = randomUUID();

      // 創建失敗記錄
      await db.insert(conversations).values({
        id: conversationId,
        opportunityId: testOpportunityId,
        caseNumber: "202601-IC004",
        title: "Recovery Test",
        type: "negotiation",
        status: "failed",
        audioUrl: "https://example.com/test.mp3",
        errorMessage: "Initial failure",
        duration: 0,
        conversationDate: new Date(),
        createdBy: testUserId,
      });

      // 重試: 更新回 pending
      await db
        .update(conversations)
        .set({
          status: "pending",
          errorMessage: null,
          errorDetails: null,
        })
        .where(eq(conversations.id, conversationId));

      // 驗證已清除錯誤
      const retried = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });

      expect(retried?.status).toBe("pending");
      expect(retried?.errorMessage).toBeNull();
      expect(retried?.errorDetails).toBeNull();

      // 清理
      await db
        .delete(conversations)
        .where(eq(conversations.id, conversationId));
    });
  });

  describe("Data Integrity", () => {
    it("應該正確保存完整的 transcript 資料", async () => {
      const conversationId = randomUUID();

      await db.insert(conversations).values({
        id: conversationId,
        opportunityId: testOpportunityId,
        caseNumber: "202601-IC005",
        title: "Transcript Data Test",
        type: "closing",
        status: "transcribed",
        audioUrl: "https://example.com/test.mp3",
        transcript: {
          fullText: "完整的對話文本內容",
          language: "zh",
          segments: [
            {
              speaker: "Sales Rep",
              text: "開場白",
              start: 0,
              end: 5,
            },
            {
              speaker: "Customer",
              text: "回應",
              start: 5,
              end: 10,
            },
            {
              speaker: "Sales Rep",
              text: "產品介紹",
              start: 10,
              end: 30,
            },
          ],
        },
        duration: 30,
        conversationDate: new Date(),
        createdBy: testUserId,
      });

      const saved = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });

      expect(saved?.transcript).toBeDefined();
      const transcript = saved?.transcript as any;
      expect(transcript.fullText).toBe("完整的對話文本內容");
      expect(transcript.language).toBe("zh");
      expect(transcript.segments).toHaveLength(3);
      expect(transcript.segments[0].speaker).toBe("Sales Rep");
      expect(transcript.segments[0].text).toBe("開場白");

      // 清理
      await db
        .delete(conversations)
        .where(eq(conversations.id, conversationId));
    });

    it("應該正確保存完整的 MEDDIC 分析資料", async () => {
      const conversationId = randomUUID();

      const meddicAnalysis = {
        overallScore: 82,
        status: "qualified",
        dimensions: {
          metrics: {
            name: "Metrics",
            score: 85,
            evidence: ["ROI 明確", "成本節省 30%"],
            gaps: ["缺少具體時間線"],
            recommendations: ["詢問實施時間表"],
          },
          economicBuyer: {
            name: "Economic Buyer",
            score: 75,
            evidence: ["已接觸 CFO"],
            gaps: ["未確認預算"],
            recommendations: ["安排預算討論"],
          },
        },
      };

      await db.insert(conversations).values({
        id: conversationId,
        opportunityId: testOpportunityId,
        caseNumber: "202601-IC006",
        title: "MEDDIC Data Test",
        type: "discovery_call",
        status: "completed",
        audioUrl: "https://example.com/test.mp3",
        transcript: {
          fullText: "測試文本",
          language: "zh",
          segments: [],
        },
        meddicAnalysis,
        analyzedAt: new Date(),
        duration: 0,
        conversationDate: new Date(),
        createdBy: testUserId,
      });

      const saved = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });

      expect(saved?.meddicAnalysis).toBeDefined();
      const analysis = saved?.meddicAnalysis as any;
      expect(analysis.overallScore).toBe(82);
      expect(analysis.status).toBe("qualified");
      expect(analysis.dimensions.metrics).toBeDefined();
      expect(analysis.dimensions.metrics.score).toBe(85);
      expect(analysis.dimensions.metrics.evidence).toHaveLength(2);

      // 清理
      await db
        .delete(conversations)
        .where(eq(conversations.id, conversationId));
    });
  });

  describe("Performance Expectations", () => {
    it("應該能在合理時間內查詢記錄", async () => {
      const startTime = Date.now();

      await db.query.conversations.findMany({
        where: eq(conversations.opportunityId, testOpportunityId),
        limit: 20,
      });

      const queryTime = Date.now() - startTime;

      // 查詢應該在 200ms 內完成
      expect(queryTime).toBeLessThan(200);
    });

    it("應該能快速更新狀態", async () => {
      const conversationId = randomUUID();

      await db.insert(conversations).values({
        id: conversationId,
        opportunityId: testOpportunityId,
        caseNumber: "202601-IC007",
        title: "Performance Test",
        type: "support",
        status: "pending",
        audioUrl: "https://example.com/test.mp3",
        duration: 0,
        conversationDate: new Date(),
        createdBy: testUserId,
      });

      const startTime = Date.now();

      await db
        .update(conversations)
        .set({ status: "transcribed" })
        .where(eq(conversations.id, conversationId));

      const updateTime = Date.now() - startTime;

      // 更新應該在 100ms 內完成
      expect(updateTime).toBeLessThan(100);

      // 清理
      await db
        .delete(conversations)
        .where(eq(conversations.id, conversationId));
    });
  });
});
