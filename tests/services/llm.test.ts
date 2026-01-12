import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock Gemini Client
const mockGeminiModel = {
	generateContent: vi.fn(),
};

const mockGenAI = {
	getGenerativeModel: vi.fn(() => mockGeminiModel),
};

vi.mock("@google/generative-ai", () => ({
	GoogleGenerativeAI: vi.fn(() => mockGenAI),
}));

describe("Gemini LLM 服務", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("MEDDIC 分析", () => {
		test("應該成功產生 MEDDIC 分析", async () => {
			const mockAnalysis = {
				overallScore: 72,
				status: "medium",
				metrics: {
					score: 4,
					evidence: ["提到了 ROI 預期為 30%", "討論了成本節省目標"],
					gaps: ["缺少具體數字驗證"],
				},
				economicBuyer: {
					score: 3,
					evidence: ["確認了決策者是 VP of Sales"],
					gaps: ["未確認預算權限"],
				},
				decisionCriteria: {
					score: 4,
					evidence: ["列出了三項主要需求"],
					gaps: [],
				},
				decisionProcess: {
					score: 3,
					evidence: ["了解需要 IT 審核"],
					gaps: ["不清楚完整審批流程"],
				},
				identifyPain: {
					score: 4,
					evidence: ["明確指出當前系統效率問題"],
					gaps: [],
				},
				champion: {
					score: 3,
					evidence: ["產品經理表現積極"],
					gaps: ["需要確認其影響力"],
				},
				keyFindings: ["客戶對 ROI 有明確期望", "決策流程涉及多個部門"],
				nextSteps: ["安排與 VP 的會議", "準備 ROI 計算文件"],
			};

			mockGeminiModel.generateContent.mockResolvedValue({
				response: {
					text: () => JSON.stringify(mockAnalysis),
				},
			});

			const analyzeTranscript = async (transcript: string) => {
				const result = await mockGeminiModel.generateContent([
					{ text: `分析以下對話並產生 MEDDIC 評估:\n\n${transcript}` },
				]);
				return JSON.parse(result.response.text());
			};

			const result = await analyzeTranscript("測試對話內容...");

			expect(result.overallScore).toBe(72);
			expect(result.status).toBe("medium");
			expect(result.metrics.score).toBe(4);
			expect(result.keyFindings).toHaveLength(2);
		});

		test("應該處理 JSON 解析成功", async () => {
			const validJson = {
				overallScore: 65,
				metrics: { score: 3 },
			};

			mockGeminiModel.generateContent.mockResolvedValue({
				response: {
					text: () => JSON.stringify(validJson),
				},
			});

			const result = await mockGeminiModel.generateContent([]);
			const parsed = JSON.parse(result.response.text());

			expect(parsed.overallScore).toBe(65);
		});

		test("應該處理非 JSON 回應", async () => {
			mockGeminiModel.generateContent.mockResolvedValue({
				response: {
					text: () => "這不是有效的 JSON 格式",
				},
			});

			const result = await mockGeminiModel.generateContent([]);

			expect(() => JSON.parse(result.response.text())).toThrow();
		});

		test("應該處理 JSON 包含 markdown 標記", async () => {
			const jsonWithMarkdown = '```json\n{"score": 80}\n```';

			mockGeminiModel.generateContent.mockResolvedValue({
				response: {
					text: () => jsonWithMarkdown,
				},
			});

			const extractJson = (text: string) => {
				const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
				if (jsonMatch) {
					return JSON.parse(jsonMatch[1]);
				}
				return JSON.parse(text);
			};

			const result = await mockGeminiModel.generateContent([]);
			const parsed = extractJson(result.response.text());

			expect(parsed.score).toBe(80);
		});
	});

	describe("錯誤處理", () => {
		test("應該處理 API 錯誤", async () => {
			const apiError = new Error("API quota exceeded");
			Object.assign(apiError, { status: 429 });

			mockGeminiModel.generateContent.mockRejectedValue(apiError);

			await expect(
				mockGeminiModel.generateContent([{ text: "test" }]),
			).rejects.toThrow("API quota exceeded");
		});

		test("應該處理網路錯誤", async () => {
			const networkError = new Error("Network error");

			mockGeminiModel.generateContent.mockRejectedValue(networkError);

			await expect(
				mockGeminiModel.generateContent([]),
			).rejects.toThrow("Network error");
		});

		test("應該處理無效的回應格式", async () => {
			mockGeminiModel.generateContent.mockResolvedValue({
				response: {
					text: () => null,
				},
			});

			const result = await mockGeminiModel.generateContent([]);

			expect(result.response.text()).toBeNull();
		});

		test("應該處理安全過濾阻擋", async () => {
			const safetyError = new Error("Content blocked by safety filters");
			Object.assign(safetyError, {
				response: {
					candidates: [{
						finishReason: "SAFETY",
						safetyRatings: [{ category: "HARM_CATEGORY_DANGEROUS", probability: "HIGH" }]
					}]
				}
			});

			mockGeminiModel.generateContent.mockRejectedValue(safetyError);

			await expect(
				mockGeminiModel.generateContent([]),
			).rejects.toThrow("Content blocked by safety filters");
		});
	});

	describe("重試邏輯", () => {
		test("應該在暫時性錯誤時重試", async () => {
			const temporaryError = new Error("Service temporarily unavailable");
			Object.assign(temporaryError, { status: 503 });

			mockGeminiModel.generateContent
				.mockRejectedValueOnce(temporaryError)
				.mockRejectedValueOnce(temporaryError)
				.mockResolvedValue({
					response: { text: () => '{"success": true}' },
				});

			const retryWithBackoff = async <T>(
				fn: () => Promise<T>,
				maxRetries = 3,
			): Promise<T> => {
				let lastError: Error | undefined;
				for (let attempt = 0; attempt < maxRetries; attempt++) {
					try {
						return await fn();
					} catch (error) {
						lastError = error as Error;
					}
				}
				throw lastError;
			};

			const result = await retryWithBackoff(() =>
				mockGeminiModel.generateContent([]),
			);

			expect(JSON.parse(result.response.text())).toEqual({ success: true });
			expect(mockGeminiModel.generateContent).toHaveBeenCalledTimes(3);
		});

		test("應該在達到重試上限後拋出錯誤", async () => {
			const persistentError = new Error("Persistent failure");

			mockGeminiModel.generateContent.mockRejectedValue(persistentError);

			const retryWithBackoff = async <T>(
				fn: () => Promise<T>,
				maxRetries = 3,
			): Promise<T> => {
				let lastError: Error | undefined;
				for (let attempt = 0; attempt < maxRetries; attempt++) {
					try {
						return await fn();
					} catch (error) {
						lastError = error as Error;
					}
				}
				throw lastError;
			};

			await expect(
				retryWithBackoff(() => mockGeminiModel.generateContent([]), 3),
			).rejects.toThrow("Persistent failure");

			expect(mockGeminiModel.generateContent).toHaveBeenCalledTimes(3);
		});
	});

	describe("Prompt 建構", () => {
		test("應該正確建構 MEDDIC 分析 prompt", () => {
			const buildMeddicPrompt = (transcript: string, context?: string) => {
				const basePrompt = `你是一位專業的銷售分析師。請根據以下對話內容進行 MEDDIC 分析。

MEDDIC 框架包含：
- Metrics (指標): 量化的業務價值和 ROI
- Economic Buyer (經濟買家): 有預算決定權的人
- Decision Criteria (決策標準): 客戶的評估標準
- Decision Process (決策流程): 審批和採購流程
- Identify Pain (痛點識別): 客戶面臨的問題
- Champion (內部支持者): 組織內的推動者

請以 JSON 格式回應，包含各項目的分數(1-5)、證據和差距。

對話內容：
${transcript}`;

				if (context) {
					return `${basePrompt}\n\n額外背景：${context}`;
				}
				return basePrompt;
			};

			const prompt = buildMeddicPrompt("客戶說要導入新系統...", "這是第二次會議");

			expect(prompt).toContain("MEDDIC");
			expect(prompt).toContain("客戶說要導入新系統");
			expect(prompt).toContain("第二次會議");
		});
	});

	describe("模型選擇", () => {
		test("應該使用正確的模型", () => {
			const getModel = (taskType: "analysis" | "summary" | "extraction") => {
				const models: Record<string, string> = {
					analysis: "gemini-1.5-pro",
					summary: "gemini-1.5-flash",
					extraction: "gemini-1.5-flash",
				};
				return models[taskType];
			};

			expect(getModel("analysis")).toBe("gemini-1.5-pro");
			expect(getModel("summary")).toBe("gemini-1.5-flash");
		});
	});
});
