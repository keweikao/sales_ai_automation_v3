import { describe, expect, test } from "vitest";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";

describe("Authentication API", () => {
  const testEmail = `auth-test-${Date.now()}@example.com`;
  const testPassword = "testpassword123";
  let sessionCookie: string;

  describe("POST /api/auth/sign-up/email", () => {
    test("應該成功註冊新用戶", async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: "Auth Test User",
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as { user: { email: string } };
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
    });

    test("重複註冊應該回傳錯誤", async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: "Duplicate User",
        }),
      });

      expect(response.ok).toBe(false);
    });

    test("缺少必填欄位應該回傳 400", async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "incomplete@example.com",
          // 缺少 password
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/auth/sign-in/email", () => {
    test("應該成功登入並回傳 session cookie", async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(response.ok).toBe(true);

      // 驗證 session cookie
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain("better-auth");

      sessionCookie = setCookie!;

      const data = (await response.json()) as {
        user: unknown;
        session: unknown;
      };
      expect(data.user).toBeDefined();
      expect(data.session).toBeDefined();
    });

    test("錯誤密碼應該回傳 401", async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "wrongpassword",
        }),
      });

      expect(response.status).toBe(401);
    });

    test("不存在的用戶應該回傳 401", async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "anypassword",
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/auth/session", () => {
    test("有效 session 應該回傳用戶資訊", async () => {
      const response = await fetch(`${API_BASE}/api/auth/session`, {
        headers: { Cookie: sessionCookie },
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as { user: { email: string } };
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
    });

    test("無 session 應該回傳 null 或 401", async () => {
      const response = await fetch(`${API_BASE}/api/auth/session`);

      // Better Auth 可能回傳 200 with null 或 401
      if (response.ok) {
        const data = (await response.json()) as { user: unknown };
        expect(data.user).toBeNull();
      } else {
        expect(response.status).toBe(401);
      }
    });
  });

  describe("POST /api/auth/sign-out", () => {
    test("應該成功登出並清除 cookie", async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-out`, {
        method: "POST",
        headers: { Cookie: sessionCookie },
      });

      expect(response.ok).toBe(true);

      // 驗證登出後 session 無效
      const sessionResponse = await fetch(`${API_BASE}/api/auth/session`, {
        headers: { Cookie: sessionCookie },
      });

      if (sessionResponse.ok) {
        const data = (await sessionResponse.json()) as { user: unknown };
        expect(data.user).toBeNull();
      }
    });
  });

  describe("受保護端點測試", () => {
    test("無認證存取 privateData 應該回傳 401", async () => {
      const response = await fetch(`${API_BASE}/api/privateData`);
      expect(response.status).toBe(401);
    });

    test("有認證存取 privateData 應該成功", async () => {
      // 重新登入
      const signInResponse = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });
      const newCookie = signInResponse.headers.get("set-cookie")!;

      const response = await fetch(`${API_BASE}/api/privateData`, {
        headers: { Cookie: newCookie },
      });

      expect(response.ok).toBe(true);
    });
  });
});
