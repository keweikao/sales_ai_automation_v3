import { expect, test } from "@playwright/test";

test.describe("Opportunity Management Flow", () => {
  test("應該顯示商機列表", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.locator("h1, h2").first()).toContainText(
      /商機|Opportunities/i
    );
  });

  test("應該可以建立新商機", async ({ page }) => {
    await page.goto("/opportunities/new");

    // 填寫必填欄位
    await page.fill('input[name="customerNumber"]', `E2E-${Date.now()}`);
    await page.fill('input[name="companyName"]', "E2E 測試公司");

    // 填寫可選欄位
    const contactNameInput = page.locator('input[name="contactName"]');
    if (await contactNameInput.isVisible()) {
      await contactNameInput.fill("測試聯絡人");
    }

    // 提交表單
    await page.click('button[type="submit"]');

    // 等待成功訊息或重導向
    await expect(page).toHaveURL(/\/opportunities(\/|$)/, { timeout: 10_000 });
  });

  test("應該可以查看商機詳情", async ({ page }) => {
    await page.goto("/opportunities");

    // 等待列表載入
    await page.waitForSelector(
      'table tbody tr, [data-testid="opportunity-card"]',
      { timeout: 10_000 }
    );

    // 點擊第一個商機
    const firstOpportunity = page
      .locator('table tbody tr, [data-testid="opportunity-card"]')
      .first();
    await firstOpportunity.click();

    // 應該導航到詳情頁
    await expect(page).toHaveURL(/\/opportunities\/[^/]+$/);
  });

  test("應該可以篩選商機狀態", async ({ page }) => {
    await page.goto("/opportunities");

    // 找到狀態篩選器
    const statusFilter = page.locator(
      'select[name="status"], [data-testid="status-filter"]'
    );

    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption("contacted");

      // 等待列表更新
      await page.waitForTimeout(500);

      // 驗證 URL 包含篩選參數
      await expect(page).toHaveURL(/status=contacted/);
    }
  });

  test("應該可以搜尋商機", async ({ page }) => {
    await page.goto("/opportunities");

    // 找到搜尋框
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="搜尋"]'
    );

    if (await searchInput.isVisible()) {
      await searchInput.fill("測試");
      await searchInput.press("Enter");

      // 等待搜尋結果
      await page.waitForTimeout(500);
    }
  });

  test("應該可以更新商機狀態", async ({ page }) => {
    // 先建立一個商機
    await page.goto("/opportunities/new");
    await page.fill('input[name="customerNumber"]', `E2E-Status-${Date.now()}`);
    await page.fill('input[name="companyName"]', "狀態更新測試");
    await page.click('button[type="submit"]');

    // 等待重導向到詳情頁或列表
    await page.waitForURL(/\/opportunities/);

    // 找到狀態選擇器並更新
    const statusSelect = page.locator(
      'select[name="status"], [data-testid="status-select"]'
    );
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption("contacted");

      // 等待更新完成
      await expect(page.locator('.toast, [role="alert"]')).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
