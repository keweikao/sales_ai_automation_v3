import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanupTestUser, createTestUser } from "../fixtures/auth-helpers";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";

describe("Analytics API", () => {
  let authCookie: string;
  let testUserId: string;
  let testOpportunityId: string;

  beforeAll(async () => {
    // 建立測試用戶
    const { userId, cookie } = await createTestUser();
    testUserId = userId;
    authCookie = cookie;

    // 建立測試用商機
    const response = await fetch(`${API_BASE}/api/opportunities.create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
      },
      body: JSON.stringify({
        customerNumber: `analytics-test-${Date.now()}`,
        companyName: "分析測試公司",
      }),
    });
    const data = (await response.json()) as { id: string };
    testOpportunityId = data.id;
  });

  afterAll(async () => {
    await cleanupTestUser(testUserId);
  });

  describe("GET /api/analytics.dashboard", () => {
    test("應該取得 Dashboard 統計", async () => {
      const response = await fetch(`${API_BASE}/api/analytics.dashboard`, {
        headers: { Cookie: authCookie },
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as {
        summary: {
          totalOpportunities: number;
          totalConversations: number;
          totalAnalyses: number;
        };
        statusDistribution: unknown;
        recentAnalyses: unknown[];
      };

      // 驗證摘要統計
      expect(data.summary).toBeDefined();
      expect(data.summary.totalOpportunities).toBeGreaterThanOrEqual(0);
      expect(data.summary.totalConversations).toBeGreaterThanOrEqual(0);
      expect(data.summary.totalAnalyses).toBeGreaterThanOrEqual(0);

      // 驗證狀態分佈
      expect(data.statusDistribution).toBeDefined();

      // 驗證最近分析
      expect(data.recentAnalyses).toBeInstanceOf(Array);
    });

    test("應該支援日期篩選", async () => {
      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 1);

      const response = await fetch(
        `${API_BASE}/api/analytics.dashboard?dateFrom=${dateFrom.toISOString()}&dateTo=${new Date().toISOString()}`,
        { headers: { Cookie: authCookie } }
      );

      expect(response.ok).toBe(true);
    });

    test("未認證應該回傳 401", async () => {
      const response = await fetch(`${API_BASE}/api/analytics.dashboard`);
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/analytics.opportunityAnalytics", () => {
    test("應該取得商機分析統計", async () => {
      const response = await fetch(
        `${API_BASE}/api/analytics.opportunityAnalytics?opportunityId=${testOpportunityId}`,
        { headers: { Cookie: authCookie } }
      );

      expect(response.ok).toBe(true);
      const data = (await response.json()) as {
        opportunityId: string;
        totalAnalyses: number;
        analyses: unknown[];
      };
      expect(data.opportunityId).toBe(testOpportunityId);
      expect(data.totalAnalyses).toBeGreaterThanOrEqual(0);
      expect(data.analyses).toBeInstanceOf(Array);
    });

    test("不存在的商機應該回傳 404", async () => {
      const response = await fetch(
        `${API_BASE}/api/analytics.opportunityAnalytics?opportunityId=non-existent`,
        { headers: { Cookie: authCookie } }
      );

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/analytics.meddicTrends", () => {
    test("應該取得 MEDDIC 趨勢", async () => {
      const response = await fetch(`${API_BASE}/api/analytics.meddicTrends`, {
        headers: { Cookie: authCookie },
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as {
        overallScoreTrend?: unknown;
        trends?: unknown;
        dimensionTrends?: unknown[];
      };

      // 驗證趨勢資料結構
      expect(data.overallScoreTrend || data.trends).toBeDefined();

      // 如果有維度趨勢
      if (data.dimensionTrends) {
        expect(data.dimensionTrends).toBeInstanceOf(Array);
      }
    });

    test("應該支援維度篩選", async () => {
      const response = await fetch(
        `${API_BASE}/api/analytics.meddicTrends?dimension=metrics`,
        { headers: { Cookie: authCookie } }
      );

      expect(response.ok).toBe(true);
    });
  });
});
