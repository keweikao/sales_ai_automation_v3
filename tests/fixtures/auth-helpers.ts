import { randomUUID } from "node:crypto";

const API_BASE = process.env.TEST_API_URL || "http://localhost:3001";

interface AuthResult {
  userId: string;
  cookie: string;
}

/**
 * 建立測試用戶並取得認證 cookie
 */
export async function createTestUser(): Promise<AuthResult> {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "testpassword123";

  // 透過 API 註冊用戶
  const signUpResponse = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: "Test User",
    }),
  });

  if (!signUpResponse.ok) {
    throw new Error(
      `Failed to create test user: ${await signUpResponse.text()}`
    );
  }

  // 登入取得 cookie
  const signInResponse = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });

  if (!signInResponse.ok) {
    throw new Error(
      `Failed to sign in test user: ${await signInResponse.text()}`
    );
  }

  const setCookieHeader = signInResponse.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("No session cookie returned");
  }

  const userData = (await signInResponse.json()) as { user: { id: string } };

  return {
    userId: userData.user.id,
    cookie: setCookieHeader,
  };
}

/**
 * 取得現有用戶的認證 cookie
 */
export async function getAuthCookie(
  email: string,
  password: string
): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sign in: ${await response.text()}`);
  }

  const setCookieHeader = response.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("No session cookie returned");
  }

  return setCookieHeader;
}

/**
 * 清理測試用戶
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  try {
    // 透過 API 刪除用戶（如果有實作的話）
    // 或者直接在資料庫層級清理
    console.log(`Cleanup test user: ${userId}`);
  } catch (error) {
    console.warn("Failed to cleanup test user:", error);
  }
}

/**
 * 建立 mock session（用於單元測試）
 */
export function createMockSession(userId: string = randomUUID()) {
  return {
    user: {
      id: userId,
      email: "test@example.com",
      name: "Test User",
    },
    session: {
      id: randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  };
}
