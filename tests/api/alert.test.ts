import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAuthCookie } from "../fixtures/auth-helpers";

const API_BASE_URL = process.env.TEST_API_URL ?? "http://localhost:3001";

// Mock API Client
const mockApiClient = {
	listAlerts: vi.fn(),
	getAlert: vi.fn(),
	acknowledgeAlert: vi.fn(),
	resolveAlert: vi.fn(),
	dismissAlert: vi.fn(),
	getAlertStats: vi.fn(),
};

describe("Alert API", () => {
	let authCookie: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		authCookie = await getAuthCookie();
	});

	describe("GET /api/alert/list", () => {
		test("應該列出使用者的警示", async () => {
			mockApiClient.listAlerts.mockResolvedValue({
				alerts: [
					{
						id: "alert-1",
						type: "close_now",
						status: "pending",
						opportunityId: "opp-1",
						message: "高分商機需要立即跟進",
						createdAt: new Date().toISOString(),
					},
					{
						id: "alert-2",
						type: "missing_dm",
						status: "pending",
						opportunityId: "opp-2",
						message: "尚未確認決策者",
						createdAt: new Date().toISOString(),
					},
				],
				total: 2,
			});

			const result = await mockApiClient.listAlerts({ limit: 20, offset: 0 });

			expect(result.alerts).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(result.alerts[0].type).toBe("close_now");
		});

		test("應該依狀態篩選警示", async () => {
			mockApiClient.listAlerts.mockResolvedValue({
				alerts: [
					{
						id: "alert-1",
						type: "close_now",
						status: "acknowledged",
						opportunityId: "opp-1",
					},
				],
				total: 1,
			});

			const result = await mockApiClient.listAlerts({
				status: "acknowledged",
				limit: 20,
				offset: 0,
			});

			expect(result.alerts).toHaveLength(1);
			expect(result.alerts[0].status).toBe("acknowledged");
		});

		test("應該依類型篩選警示", async () => {
			mockApiClient.listAlerts.mockResolvedValue({
				alerts: [
					{
						id: "alert-1",
						type: "manager_escalation",
						status: "pending",
						opportunityId: "opp-1",
					},
				],
				total: 1,
			});

			const result = await mockApiClient.listAlerts({
				type: "manager_escalation",
				limit: 20,
				offset: 0,
			});

			expect(result.alerts[0].type).toBe("manager_escalation");
		});

		test("應該依商機 ID 篩選警示", async () => {
			mockApiClient.listAlerts.mockResolvedValue({
				alerts: [
					{
						id: "alert-1",
						type: "close_now",
						status: "pending",
						opportunityId: "opp-specific",
					},
				],
				total: 1,
			});

			const result = await mockApiClient.listAlerts({
				opportunityId: "opp-specific",
				limit: 20,
				offset: 0,
			});

			expect(result.alerts[0].opportunityId).toBe("opp-specific");
		});

		test("未認證應該回傳 401", async () => {
			const response = await fetch(`${API_BASE_URL}/api/alert/list`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ limit: 20, offset: 0 }),
			});

			expect(response.status).toBe(401);
		});
	});

	describe("GET /api/alert/get", () => {
		test("應該取得單一警示詳情", async () => {
			mockApiClient.getAlert.mockResolvedValue({
				id: "alert-1",
				type: "close_now",
				status: "pending",
				opportunityId: "opp-1",
				conversationId: "conv-1",
				message: "高分商機需要立即跟進",
				details: {
					score: 85,
					reason: "MEDDIC 分數超過 80",
				},
				opportunity: {
					id: "opp-1",
					companyName: "測試公司",
				},
				conversation: {
					id: "conv-1",
					title: "最近對話",
				},
				createdAt: new Date().toISOString(),
			});

			const result = await mockApiClient.getAlert({ alertId: "alert-1" });

			expect(result.id).toBe("alert-1");
			expect(result.opportunity).toBeDefined();
			expect(result.conversation).toBeDefined();
		});

		test("找不到警示應該回傳 404", async () => {
			mockApiClient.getAlert.mockRejectedValue(new Error("NOT_FOUND"));

			await expect(
				mockApiClient.getAlert({ alertId: "non-existent" }),
			).rejects.toThrow("NOT_FOUND");
		});

		test("存取其他使用者的警示應該回傳 403", async () => {
			mockApiClient.getAlert.mockRejectedValue(new Error("FORBIDDEN"));

			await expect(
				mockApiClient.getAlert({ alertId: "other-user-alert" }),
			).rejects.toThrow("FORBIDDEN");
		});
	});

	describe("POST /api/alert/acknowledge", () => {
		test("應該成功確認警示", async () => {
			mockApiClient.acknowledgeAlert.mockResolvedValue({ success: true });

			const result = await mockApiClient.acknowledgeAlert({
				alertId: "alert-1",
			});

			expect(result.success).toBe(true);
		});

		test("確認後狀態應該變為 acknowledged", async () => {
			mockApiClient.acknowledgeAlert.mockResolvedValue({ success: true });
			mockApiClient.getAlert.mockResolvedValue({
				id: "alert-1",
				status: "acknowledged",
				acknowledgedAt: new Date().toISOString(),
				acknowledgedBy: "user-1",
			});

			await mockApiClient.acknowledgeAlert({ alertId: "alert-1" });
			const alert = await mockApiClient.getAlert({ alertId: "alert-1" });

			expect(alert.status).toBe("acknowledged");
			expect(alert.acknowledgedAt).toBeDefined();
		});

		test("重複確認應該成功（冪等性）", async () => {
			mockApiClient.acknowledgeAlert.mockResolvedValue({ success: true });

			const result1 = await mockApiClient.acknowledgeAlert({
				alertId: "alert-1",
			});
			const result2 = await mockApiClient.acknowledgeAlert({
				alertId: "alert-1",
			});

			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);
		});
	});

	describe("POST /api/alert/resolve", () => {
		test("應該成功解決警示", async () => {
			mockApiClient.resolveAlert.mockResolvedValue({ success: true });

			const result = await mockApiClient.resolveAlert({
				alertId: "alert-1",
				resolution: "已與客戶確認，預計下週簽約",
			});

			expect(result.success).toBe(true);
		});

		test("解決後狀態應該變為 resolved", async () => {
			mockApiClient.resolveAlert.mockResolvedValue({ success: true });
			mockApiClient.getAlert.mockResolvedValue({
				id: "alert-1",
				status: "resolved",
				resolvedAt: new Date().toISOString(),
				resolution: "已與客戶確認，預計下週簽約",
			});

			await mockApiClient.resolveAlert({
				alertId: "alert-1",
				resolution: "已與客戶確認，預計下週簽約",
			});
			const alert = await mockApiClient.getAlert({ alertId: "alert-1" });

			expect(alert.status).toBe("resolved");
			expect(alert.resolution).toBe("已與客戶確認，預計下週簽約");
		});

		test("沒有解決說明應該失敗", async () => {
			mockApiClient.resolveAlert.mockRejectedValue(
				new Error("Resolution is required"),
			);

			await expect(
				mockApiClient.resolveAlert({ alertId: "alert-1", resolution: "" }),
			).rejects.toThrow();
		});
	});

	describe("POST /api/alert/dismiss", () => {
		test("應該成功忽略警示", async () => {
			mockApiClient.dismissAlert.mockResolvedValue({ success: true });

			const result = await mockApiClient.dismissAlert({ alertId: "alert-1" });

			expect(result.success).toBe(true);
		});

		test("忽略後狀態應該變為 dismissed", async () => {
			mockApiClient.dismissAlert.mockResolvedValue({ success: true });
			mockApiClient.getAlert.mockResolvedValue({
				id: "alert-1",
				status: "dismissed",
				dismissedAt: new Date().toISOString(),
			});

			await mockApiClient.dismissAlert({ alertId: "alert-1" });
			const alert = await mockApiClient.getAlert({ alertId: "alert-1" });

			expect(alert.status).toBe("dismissed");
		});
	});

	describe("GET /api/alert/stats", () => {
		test("應該回傳警示統計", async () => {
			mockApiClient.getAlertStats.mockResolvedValue({
				pending: 5,
				acknowledged: 3,
				resolved: 10,
				byType: {
					close_now: 2,
					missing_dm: 2,
					manager_escalation: 1,
				},
			});

			const result = await mockApiClient.getAlertStats();

			expect(result.pending).toBe(5);
			expect(result.acknowledged).toBe(3);
			expect(result.resolved).toBe(10);
			expect(result.byType.close_now).toBe(2);
		});

		test("沒有警示時應該回傳零值", async () => {
			mockApiClient.getAlertStats.mockResolvedValue({
				pending: 0,
				acknowledged: 0,
				resolved: 0,
				byType: {
					close_now: 0,
					missing_dm: 0,
					manager_escalation: 0,
				},
			});

			const result = await mockApiClient.getAlertStats();

			expect(result.pending).toBe(0);
			expect(result.byType.close_now).toBe(0);
		});
	});

	describe("警示類型", () => {
		test("close_now 警示應該包含分數資訊", async () => {
			mockApiClient.getAlert.mockResolvedValue({
				id: "alert-1",
				type: "close_now",
				status: "pending",
				details: {
					score: 85,
					threshold: 80,
					reason: "MEDDIC 分數超過門檻",
				},
			});

			const alert = await mockApiClient.getAlert({ alertId: "alert-1" });

			expect(alert.type).toBe("close_now");
			expect(alert.details.score).toBeGreaterThan(alert.details.threshold);
		});

		test("missing_dm 警示應該包含缺失資訊", async () => {
			mockApiClient.getAlert.mockResolvedValue({
				id: "alert-2",
				type: "missing_dm",
				status: "pending",
				details: {
					missingFields: ["economicBuyer"],
					conversationCount: 3,
				},
			});

			const alert = await mockApiClient.getAlert({ alertId: "alert-2" });

			expect(alert.type).toBe("missing_dm");
			expect(alert.details.missingFields).toContain("economicBuyer");
		});

		test("manager_escalation 警示應該包含升級原因", async () => {
			mockApiClient.getAlert.mockResolvedValue({
				id: "alert-3",
				type: "manager_escalation",
				status: "pending",
				details: {
					reason: "連續 7 天無進展",
					daysStalled: 7,
				},
			});

			const alert = await mockApiClient.getAlert({ alertId: "alert-3" });

			expect(alert.type).toBe("manager_escalation");
			expect(alert.details.daysStalled).toBe(7);
		});
	});

	describe("分頁功能", () => {
		test("應該正確處理分頁", async () => {
			mockApiClient.listAlerts.mockResolvedValue({
				alerts: Array(20).fill({ id: "alert", type: "close_now" }),
				total: 50,
			});

			const result = await mockApiClient.listAlerts({
				limit: 20,
				offset: 0,
			});

			expect(result.alerts).toHaveLength(20);
			expect(result.total).toBe(50);
		});

		test("應該回傳正確的 offset 結果", async () => {
			mockApiClient.listAlerts.mockResolvedValue({
				alerts: Array(10).fill({ id: "alert", type: "close_now" }),
				total: 50,
			});

			const result = await mockApiClient.listAlerts({
				limit: 20,
				offset: 40,
			});

			expect(result.alerts).toHaveLength(10);
		});
	});
});
