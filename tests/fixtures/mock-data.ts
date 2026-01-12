export const mockOpportunity = {
	customerNumber: "202601-000001",
	companyName: "測試公司股份有限公司",
	contactName: "張小明",
	contactEmail: "test@example.com",
	contactPhone: "0912345678",
	status: "new" as const,
	source: "manual" as const,
	industry: "科技業",
	companySize: "50-200",
	notes: "這是測試商機",
};

export const mockConversation = {
	title: "首次探索會議",
	type: "discovery_call" as const,
	status: "completed" as const,
	duration: 1800, // 30 分鐘
	conversationDate: new Date().toISOString(),
};

export const mockMeddicAnalysis = {
	overallScore: 72,
	status: "medium" as const,
	metricsScore: 4,
	economicBuyerScore: 3,
	decisionCriteriaScore: 4,
	decisionProcessScore: 3,
	identifyPainScore: 4,
	championScore: 3,
	dimensions: {
		metrics: {
			evidence: ["客戶提到希望將回覆時間從 24 小時縮短到 4 小時"],
			gaps: ["尚未確認具體的 ROI 數字"],
			recommendations: ["下次會議確認預期的成本節省"],
		},
		economicBuyer: {
			evidence: ["提到需要向 CTO 報告"],
			gaps: ["尚未直接接觸 CTO"],
			recommendations: ["安排與 CTO 的會議"],
		},
	},
	keyFindings: [
		"客戶有明確的效率提升需求",
		"預算已獲得初步核准",
		"尚未接觸最終決策者",
	],
	nextSteps: [
		{ action: "安排與 CTO 的會議", owner: "業務" },
		{ action: "準備 ROI 計算報告", owner: "售前" },
		{ action: "確認競爭對手狀況", owner: "業務" },
	],
	risks: [
		{
			risk: "決策流程可能較長",
			severity: "medium",
			mitigation: "提早開始接觸各利害關係人",
		},
		{
			risk: "競爭對手已有接觸",
			severity: "high",
			mitigation: "強調差異化優勢",
		},
	],
};

export const mockTranscript = {
	fullText: `
業務：您好，請問貴公司目前在客戶管理上有遇到什麼挑戰嗎？
客戶：是的，我們目前使用的系統效率很低，常常找不到客戶資料。
業務：了解，那這個問題對您的業務造成什麼影響呢？
客戶：主要是回覆客戶的速度變慢，客戶滿意度有下降的趨勢。
業務：那您預期希望達到什麼樣的改善效果？
客戶：希望能把回覆時間從目前的 24 小時縮短到 4 小時以內。
`.trim(),
	segments: [
		{
			speaker: "業務",
			text: "您好，請問貴公司目前在客戶管理上有遇到什麼挑戰嗎？",
			start: 0,
			end: 5,
		},
		{
			speaker: "客戶",
			text: "是的，我們目前使用的系統效率很低，常常找不到客戶資料。",
			start: 5,
			end: 12,
		},
		{
			speaker: "業務",
			text: "了解，那這個問題對您的業務造成什麼影響呢？",
			start: 12,
			end: 17,
		},
		{
			speaker: "客戶",
			text: "主要是回覆客戶的速度變慢，客戶滿意度有下降的趨勢。",
			start: 17,
			end: 24,
		},
		{
			speaker: "業務",
			text: "那您預期希望達到什麼樣的改善效果？",
			start: 24,
			end: 29,
		},
		{
			speaker: "客戶",
			text: "希望能把回覆時間從目前的 24 小時縮短到 4 小時以內。",
			start: 29,
			end: 36,
		},
	],
	language: "zh-TW",
	duration: 36,
};

// 英文版本的測試資料
export const mockTranscriptEn = {
	fullText: `
Sales: Hello, what challenges are you facing with customer management?
Customer: Yes, our current system is very inefficient, we often can't find customer data.
Sales: I see, how does this problem affect your business?
Customer: Mainly, our response time has slowed down, and customer satisfaction is declining.
`.trim(),
	segments: [
		{
			speaker: "Sales",
			text: "Hello, what challenges are you facing with customer management?",
			start: 0,
			end: 5,
		},
		{
			speaker: "Customer",
			text: "Yes, our current system is very inefficient, we often can't find customer data.",
			start: 5,
			end: 12,
		},
		{
			speaker: "Sales",
			text: "I see, how does this problem affect your business?",
			start: 12,
			end: 17,
		},
		{
			speaker: "Customer",
			text: "Mainly, our response time has slowed down, and customer satisfaction is declining.",
			start: 17,
			end: 24,
		},
	],
	language: "en",
	duration: 24,
};
