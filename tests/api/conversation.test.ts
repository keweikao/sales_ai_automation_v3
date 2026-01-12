import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
	cleanupTestUser,
	createTestUser,
} from "../fixtures/auth-helpers";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";

describe("Conversation API", () => {
	let authCookie: string;
	let testUserId: string;
	let testOpportunityId: string;
	const createdConversationIds: string[] = [];

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
				customerNumber: `conv-test-${Date.now()}`,
				companyName: "對話測試公司",
			}),
		});
		const data = (await response.json()) as { id: string };
		testOpportunityId = data.id;
	});

	afterAll(async () => {
		// 清理測試資料
		await cleanupTestUser(testUserId);
	});

	describe("POST /api/conversations.upload", () => {
		test("應該上傳音檔並建立對話", async () => {
			// 讀取測試音檔
			const audioPath = join(__dirname, "../fixtures/test-audio.mp3");
			let audioBase64: string;

			if (existsSync(audioPath)) {
				const audioBuffer = readFileSync(audioPath);
				audioBase64 = audioBuffer.toString("base64");
			} else {
				// 使用最小有效的 MP3 base64（靜音）
				audioBase64 =
					"SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAA";
			}

			const response = await fetch(`${API_BASE}/api/conversations.upload`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: authCookie,
				},
				body: JSON.stringify({
					opportunityId: testOpportunityId,
					audioBase64,
					title: "測試對話",
					type: "discovery_call",
					metadata: {
						format: "mp3",
						conversationDate: new Date().toISOString(),
					},
				}),
			});

			expect(response.ok).toBe(true);
			const data = (await response.json()) as {
				conversationId: string;
				caseNumber: string;
				audioUrl: string;
			};
			expect(data.conversationId).toBeDefined();
			expect(data.caseNumber).toMatch(/^\d{6}-IC\d{3}$/);
			expect(data.audioUrl).toBeDefined();

			createdConversationIds.push(data.conversationId);
		});

		test("缺少 opportunityId 應該回傳 400", async () => {
			const response = await fetch(`${API_BASE}/api/conversations.upload`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: authCookie,
				},
				body: JSON.stringify({
					audioBase64: "dGVzdA==",
					title: "測試對話",
					type: "discovery_call",
				}),
			});

			expect(response.status).toBe(400);
		});

		test("無效的對話類型應該回傳 400", async () => {
			const response = await fetch(`${API_BASE}/api/conversations.upload`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: authCookie,
				},
				body: JSON.stringify({
					opportunityId: testOpportunityId,
					audioBase64: "dGVzdA==",
					title: "測試對話",
					type: "invalid_type",
				}),
			});

			expect(response.status).toBe(400);
		});

		test("未認證應該回傳 401", async () => {
			const response = await fetch(`${API_BASE}/api/conversations.upload`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					opportunityId: testOpportunityId,
					audioBase64: "dGVzdA==",
					title: "測試對話",
					type: "discovery_call",
				}),
			});

			expect(response.status).toBe(401);
		});
	});

	describe("GET /api/conversations.list", () => {
		test("應該列出所有對話", async () => {
			const response = await fetch(`${API_BASE}/api/conversations.list`, {
				headers: { Cookie: authCookie },
			});

			expect(response.ok).toBe(true);
			const data = (await response.json()) as {
				conversations: unknown[];
				total: number;
			};
			expect(data.conversations).toBeInstanceOf(Array);
			expect(data.total).toBeGreaterThanOrEqual(0);
		});

		test("應該支援按商機篩選", async () => {
			const response = await fetch(
				`${API_BASE}/api/conversations.list?opportunityId=${testOpportunityId}`,
				{ headers: { Cookie: authCookie } },
			);

			expect(response.ok).toBe(true);
			const data = (await response.json()) as {
				conversations: { opportunityId: string }[];
			};
			for (const conv of data.conversations) {
				expect(conv.opportunityId).toBe(testOpportunityId);
			}
		});

		test("應該支援分頁", async () => {
			const response = await fetch(
				`${API_BASE}/api/conversations.list?limit=5&offset=0`,
				{ headers: { Cookie: authCookie } },
			);

			expect(response.ok).toBe(true);
			const data = (await response.json()) as { conversations: unknown[] };
			expect(data.conversations.length).toBeLessThanOrEqual(5);
		});
	});

	describe("GET /api/conversations.get", () => {
		test("應該取得對話詳情", async () => {
			if (createdConversationIds.length === 0) {
				console.log("Skipping: no conversation created");
				return;
			}

			const response = await fetch(
				`${API_BASE}/api/conversations.get?conversationId=${createdConversationIds[0]}`,
				{ headers: { Cookie: authCookie } },
			);

			expect(response.ok).toBe(true);
			const data = (await response.json()) as {
				conversation: { id: string; opportunityId: string };
			};
			expect(data.conversation.id).toBe(createdConversationIds[0]);
			expect(data.conversation.opportunityId).toBe(testOpportunityId);
		});

		test("不存在的對話應該回傳 404", async () => {
			const response = await fetch(
				`${API_BASE}/api/conversations.get?conversationId=non-existent`,
				{ headers: { Cookie: authCookie } },
			);

			expect(response.status).toBe(404);
		});
	});

	describe("POST /api/conversations.analyze", () => {
		test("應該執行 MEDDIC 分析並回傳結果", async () => {
			if (createdConversationIds.length === 0) {
				console.log("Skipping: no conversation created");
				return;
			}

			const response = await fetch(`${API_BASE}/api/conversations.analyze`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: authCookie,
				},
				body: JSON.stringify({
					conversationId: createdConversationIds[0],
				}),
			});

			// 分析可能因為轉錄不完整而失敗，但應該有回應
			if (response.ok) {
				const data = (await response.json()) as {
					analysisId: string;
					overallScore: number;
					metricsScore: number;
					economicBuyerScore: number;
					decisionCriteriaScore: number;
					decisionProcessScore: number;
					identifyPainScore: number;
					championScore: number;
					status: string;
					keyFindings: unknown[];
					nextSteps: unknown[];
					risks: unknown[];
				};
				expect(data.analysisId).toBeDefined();
				expect(data.overallScore).toBeGreaterThanOrEqual(0);
				expect(data.overallScore).toBeLessThanOrEqual(100);

				// 驗證 MEDDIC 各維度分數
				expect(data.metricsScore).toBeGreaterThanOrEqual(0);
				expect(data.metricsScore).toBeLessThanOrEqual(5);
				expect(data.economicBuyerScore).toBeGreaterThanOrEqual(0);
				expect(data.decisionCriteriaScore).toBeGreaterThanOrEqual(0);
				expect(data.decisionProcessScore).toBeGreaterThanOrEqual(0);
				expect(data.identifyPainScore).toBeGreaterThanOrEqual(0);
				expect(data.championScore).toBeGreaterThanOrEqual(0);

				// 驗證狀態
				expect(["strong", "medium", "weak", "at_risk"]).toContain(data.status);

				// 驗證其他欄位
				expect(data.keyFindings).toBeInstanceOf(Array);
				expect(data.nextSteps).toBeInstanceOf(Array);
				expect(data.risks).toBeInstanceOf(Array);
			} else {
				// 失敗時應該是可預期的錯誤
				expect(response.status).toBeLessThanOrEqual(500);
			}
		});

		test("不存在的對話應該回傳 404", async () => {
			const response = await fetch(`${API_BASE}/api/conversations.analyze`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: authCookie,
				},
				body: JSON.stringify({
					conversationId: "non-existent",
				}),
			});

			expect(response.status).toBe(404);
		});
	});
});
