import { expect, test as setup } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, "../.auth/user.json");

setup("authenticate", async ({ page }) => {
	// 前往登入頁面
	await page.goto("/login");

	// 使用測試帳號登入
	const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
	const testPassword = process.env.TEST_USER_PASSWORD || "testpassword123";

	// 填寫登入表單
	await page.fill('input[name="email"], input[type="email"]', testEmail);
	await page.fill('input[name="password"], input[type="password"]', testPassword);

	// 點擊登入按鈕
	await page.click('button[type="submit"]');

	// 等待登入成功（重導向到首頁或 dashboard）
	await expect(page).toHaveURL(/\/(dashboard|opportunities|$)/);

	// 儲存認證狀態
	await page.context().storageState({ path: authFile });
});
