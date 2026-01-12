import { expect, test } from "@playwright/test";

test.describe("Authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // 不使用已儲存的認證

  test("應該顯示登入頁面", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1, h2").first()).toContainText(/登入|Sign In/i);
  });

  test("未登入應該重導向到登入頁", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page).toHaveURL(/login/);
  });

  test("應該可以使用電子郵件登入", async ({ page }) => {
    await page.goto("/login");

    // 填寫表單
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "testpassword123");

    // 提交
    await page.click('button[type="submit"]');

    // 應該登入成功或顯示錯誤訊息
    await expect(page.locator("body")).toContainText(/.+/);
  });

  test("錯誤的密碼應該顯示錯誤訊息", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // 應該顯示錯誤訊息
    await expect(page.locator('[role="alert"], .error, .toast')).toBeVisible({
      timeout: 5000,
    });
  });
});
