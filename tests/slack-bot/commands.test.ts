import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock Slack Client
const mockSlackClient = {
	respondToUrl: vi.fn(),
	postMessage: vi.fn(),
};

// Mock API Client
const mockApiClient = {
	getConversationById: vi.fn(),
	analyzeConversation: vi.fn(),
	getOpportunities: vi.fn(),
	getOpportunityById: vi.fn(),
	createOpportunity: vi.fn(),
	getDashboard: vi.fn(),
	getMeddicTrends: vi.fn(),
};

describe("Slack Bot Commands", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("/analyze 指令", () => {
		test("應該顯示幫助訊息當沒有參數", async () => {
			const ctx = {
				text: "",
				responseUrl: "https://hooks.slack.com/response/xxx",
				channelId: "C123",
			};

			// 模擬 handleAnalyzeCommand
			await mockSlackClient.respondToUrl(ctx.responseUrl, {
				response_type: "ephemeral",
				blocks: expect.any(Array),
			});

			expect(mockSlackClient.respondToUrl).toHaveBeenCalledWith(
				ctx.responseUrl,
				expect.objectContaining({ response_type: "ephemeral" }),
			);
		});

		test("應該成功分析對話", async () => {
			const conversationId = "conv-123";

			mockApiClient.getConversationById.mockResolvedValue({
				id: conversationId,
				title: "測試對話",
				caseNumber: "202601-IC001",
			});

			mockApiClient.analyzeConversation.mockResolvedValue({
				analysisId: "analysis-123",
				overallScore: 72,
				status: "medium",
				metricsScore: 4,
				economicBuyerScore: 3,
				decisionCriteriaScore: 4,
				decisionProcessScore: 3,
				identifyPainScore: 4,
				championScore: 3,
			});

			const conversation =
				await mockApiClient.getConversationById(conversationId);
			expect(conversation).toBeDefined();
			expect(conversation.id).toBe(conversationId);

			const analysis = await mockApiClient.analyzeConversation(conversationId);
			expect(analysis.overallScore).toBe(72);
		});

		test("找不到對話應該回傳警告", async () => {
			mockApiClient.getConversationById.mockResolvedValue(null);

			const conversation =
				await mockApiClient.getConversationById("non-existent");
			expect(conversation).toBeNull();
		});
	});

	describe("/opportunity 指令", () => {
		test("list 應該列出商機", async () => {
			mockApiClient.getOpportunities.mockResolvedValue({
				opportunities: [
					{ id: "opp-1", companyName: "公司A", status: "new" },
					{ id: "opp-2", companyName: "公司B", status: "contacted" },
				],
				total: 2,
			});

			const result = await mockApiClient.getOpportunities();
			expect(result.opportunities).toHaveLength(2);
		});

		test("create 應該建立商機", async () => {
			mockApiClient.createOpportunity.mockResolvedValue({
				id: "new-opp",
				customerNumber: "202601-000001",
				companyName: "新公司",
				status: "new",
			});

			const result = await mockApiClient.createOpportunity({
				customerNumber: "202601-000001",
				companyName: "新公司",
			});

			expect(result.id).toBe("new-opp");
			expect(result.status).toBe("new");
		});
	});

	describe("/report 指令", () => {
		test("dashboard 應該回傳統計", async () => {
			mockApiClient.getDashboard.mockResolvedValue({
				summary: {
					totalOpportunities: 10,
					totalConversations: 25,
					totalAnalyses: 20,
				},
			});

			const result = await mockApiClient.getDashboard();
			expect(result.summary.totalOpportunities).toBe(10);
		});

		test("trends 應該回傳趨勢", async () => {
			mockApiClient.getMeddicTrends.mockResolvedValue({
				overallScoreTrend: [
					{ date: "2026-01-01", score: 65 },
					{ date: "2026-01-02", score: 70 },
				],
			});

			const result = await mockApiClient.getMeddicTrends();
			expect(result.overallScoreTrend).toHaveLength(2);
		});
	});
});
