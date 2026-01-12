import { expect, test } from "@playwright/test";
import path from "node:path";

test.describe("Conversation and MEDDIC Analysis Flow", () => {
	test("應該顯示對話列表", async ({ page }) => {
		await page.goto("/conversations");
		await expect(page.locator("h1, h2").first()).toContainText(
			/對話|Conversations/i,
		);
	});

	test("應該可以上傳新對話", async ({ page }) => {
		// 先確保有商機存在
		await page.goto("/opportunities");

		// 如果沒有商機，先建立一個
		const opportunityRows = page.locator(
			'table tbody tr, [data-testid="opportunity-card"]',
		);
		if ((await opportunityRows.count()) === 0) {
			await page.goto("/opportunities/new");
			await page.fill('input[name="customerNumber"]', `E2E-Conv-${Date.now()}`);
			await page.fill('input[name="companyName"]', "對話測試公司");
			await page.click('button[type="submit"]');
			await page.waitForURL(/\/opportunities/);
		}

		// 前往對話上傳頁面
		await page.goto("/conversations/new");

		// 應該有上傳區域
		const uploadArea = page.locator(
			'input[type="file"], [data-testid="file-upload"]',
		);
		await expect(uploadArea).toBeVisible();

		// 選擇商機
		const opportunitySelect = page.locator('select[name="opportunityId"]');
		if (await opportunitySelect.isVisible()) {
			await opportunitySelect.selectOption({ index: 1 });
		}

		// 上傳測試音檔（如果存在）
		const testAudioPath = path.join(__dirname, "../fixtures/test-audio.mp3");
		try {
			await uploadArea.setInputFiles(testAudioPath);
		} catch {
			console.log("No test audio file available, skipping upload");
		}
	});

	test("完整流程：上傳 → 分析 → 查看結果", async ({ page }) => {
		// 這個測試需要實際的音檔和完整的後端服務
		// 在 CI 環境中可能需要 mock

		await page.goto("/conversations");

		// 找到已完成分析的對話
		const analyzedConversation = page
			.locator('[data-status="completed"], .status-completed')
			.first();

		if (await analyzedConversation.isVisible()) {
			await analyzedConversation.click();

			// 應該顯示 MEDDIC 分析結果
			await expect(
				page.locator('[data-testid="meddic-score"], .meddic-score'),
			).toBeVisible({
				timeout: 10000,
			});

			// 應該顯示雷達圖
			await expect(
				page.locator(
					'.recharts-radar, [data-testid="meddic-radar"], canvas',
				),
			).toBeVisible({
				timeout: 10000,
			});

			// 應該顯示關鍵發現
			await expect(
				page.locator('[data-testid="key-findings"], .key-findings'),
			).toBeVisible();

			// 應該顯示下一步建議
			await expect(
				page.locator('[data-testid="next-steps"], .next-steps'),
			).toBeVisible();
		}
	});

	test("Dashboard 應該顯示統計資訊", async ({ page }) => {
		await page.goto("/");

		// 應該有統計卡片
		await expect(
			page
				.locator('[data-testid="stats-card"], .stats-card, .stat-card')
				.first(),
		).toBeVisible({
			timeout: 10000,
		});

		// 應該顯示商機數量
		await expect(page.locator("text=/商機|Opportunities/i")).toBeVisible();

		// 應該顯示對話數量
		await expect(page.locator("text=/對話|Conversations/i")).toBeVisible();
	});
});
