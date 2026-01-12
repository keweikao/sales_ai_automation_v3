import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanupTestUser, createTestUser } from "../fixtures/auth-helpers";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";

describe("Opportunity API", () => {
  let authCookie: string;
  let testUserId: string;
  const createdOpportunityIds: string[] = [];

  beforeAll(async () => {
    // 建立測試用戶並取得認證 cookie
    const { userId, cookie } = await createTestUser();
    testUserId = userId;
    authCookie = cookie;
  });

  afterAll(async () => {
    // 清理測試資料
    for (const id of createdOpportunityIds) {
      try {
        await fetch(`${API_BASE}/api/opportunities.delete`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
          },
          body: JSON.stringify({ opportunityId: id }),
        });
      } catch {
        // 忽略刪除錯誤
      }
    }
    await cleanupTestUser(testUserId);
  });

  describe("POST /api/opportunities.create", () => {
    test("應該成功建立商機", async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
        },
        body: JSON.stringify({
          customerNumber: `202601-${Date.now()}`,
          companyName: "測試公司",
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as {
        id: string;
        customerNumber: string;
        companyName: string;
        status: string;
        source: string;
      };
      expect(data.id).toBeDefined();
      expect(data.customerNumber).toMatch(/^202601-/);
      expect(data.companyName).toBe("測試公司");
      expect(data.status).toBe("new");
      expect(data.source).toBe("manual");

      createdOpportunityIds.push(data.id);
    });

    test("缺少必填欄位應該回傳 400", async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
        },
        body: JSON.stringify({
          companyName: "測試公司",
          // 缺少 customerNumber
        }),
      });

      expect(response.status).toBe(400);
    });

    test("未認證應該回傳 401", async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerNumber: "202601-000001",
          companyName: "測試公司",
        }),
      });

      expect(response.status).toBe(401);
    });

    test("應該支援所有可選欄位", async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
        },
        body: JSON.stringify({
          customerNumber: `202601-${Date.now()}`,
          companyName: "完整測試公司",
          contactName: "張小明",
          contactEmail: "test@example.com",
          contactPhone: "0912345678",
          source: "referral",
          status: "contacted",
          industry: "科技業",
          companySize: "50-200",
          notes: "這是測試商機",
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as {
        id: string;
        contactName: string;
        contactEmail: string;
        source: string;
        status: string;
      };
      expect(data.contactName).toBe("張小明");
      expect(data.contactEmail).toBe("test@example.com");
      expect(data.source).toBe("referral");
      expect(data.status).toBe("contacted");

      createdOpportunityIds.push(data.id);
    });
  });

  describe("GET /api/opportunities.list", () => {
    test("應該列出所有商機", async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.list`, {
        headers: { Cookie: authCookie },
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as {
        opportunities: unknown[];
        total: number;
      };
      expect(data.opportunities).toBeInstanceOf(Array);
      expect(data.total).toBeGreaterThanOrEqual(0);
    });

    test("應該支援分頁", async () => {
      const response = await fetch(
        `${API_BASE}/api/opportunities.list?limit=5&offset=0`,
        {
          headers: { Cookie: authCookie },
        }
      );

      expect(response.ok).toBe(true);
      const data = (await response.json()) as { opportunities: unknown[] };
      expect(data.opportunities.length).toBeLessThanOrEqual(5);
    });

    test("應該支援狀態篩選", async () => {
      const response = await fetch(
        `${API_BASE}/api/opportunities.list?status=new`,
        {
          headers: { Cookie: authCookie },
        }
      );

      expect(response.ok).toBe(true);
      const data = (await response.json()) as {
        opportunities: { status: string }[];
      };
      for (const opp of data.opportunities) {
        expect(opp.status).toBe("new");
      }
    });

    test("未認證應該回傳 401", async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.list`);
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/opportunities.get", () => {
    test("應該取得指定商機", async () => {
      // 先建立一個商機
      const createResponse = await fetch(
        `${API_BASE}/api/opportunities.create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
          },
          body: JSON.stringify({
            customerNumber: `202601-${Date.now()}`,
            companyName: "取得測試公司",
          }),
        }
      );
      const created = (await createResponse.json()) as { id: string };
      createdOpportunityIds.push(created.id);

      // 取得該商機
      const response = await fetch(
        `${API_BASE}/api/opportunities.get?opportunityId=${created.id}`,
        { headers: { Cookie: authCookie } }
      );

      expect(response.ok).toBe(true);
      const data = (await response.json()) as {
        opportunity: { id: string; companyName: string };
        recentConversations: unknown[];
      };
      expect(data.opportunity.id).toBe(created.id);
      expect(data.opportunity.companyName).toBe("取得測試公司");
      expect(data.recentConversations).toBeInstanceOf(Array);
    });

    test("不存在的商機應該回傳 404", async () => {
      const response = await fetch(
        `${API_BASE}/api/opportunities.get?opportunityId=non-existent-id`,
        { headers: { Cookie: authCookie } }
      );

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/opportunities.update", () => {
    test("應該正確更新商機", async () => {
      // 先建立一個商機
      const createResponse = await fetch(
        `${API_BASE}/api/opportunities.create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
          },
          body: JSON.stringify({
            customerNumber: `202601-${Date.now()}`,
            companyName: "更新前公司",
          }),
        }
      );
      const created = (await createResponse.json()) as { id: string };
      createdOpportunityIds.push(created.id);

      // 更新商機
      const response = await fetch(`${API_BASE}/api/opportunities.update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
        },
        body: JSON.stringify({
          opportunityId: created.id,
          companyName: "更新後公司",
          status: "contacted",
          notes: "已更新",
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as {
        companyName: string;
        status: string;
        notes: string;
      };
      expect(data.companyName).toBe("更新後公司");
      expect(data.status).toBe("contacted");
      expect(data.notes).toBe("已更新");
    });
  });

  describe("DELETE /api/opportunities.delete", () => {
    test("應該正確刪除商機", async () => {
      // 先建立一個商機
      const createResponse = await fetch(
        `${API_BASE}/api/opportunities.create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
          },
          body: JSON.stringify({
            customerNumber: `202601-${Date.now()}`,
            companyName: "待刪除公司",
          }),
        }
      );
      const created = (await createResponse.json()) as { id: string };

      // 刪除商機
      const response = await fetch(`${API_BASE}/api/opportunities.delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
        },
        body: JSON.stringify({
          opportunityId: created.id,
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as { success: boolean };
      expect(data.success).toBe(true);

      // 確認已刪除
      const getResponse = await fetch(
        `${API_BASE}/api/opportunities.get?opportunityId=${created.id}`,
        { headers: { Cookie: authCookie } }
      );
      expect(getResponse.status).toBe(404);
    });
  });
});
