// Mock data for UI component development
// This file provides sample data matching the database schema

export interface Lead {
  id: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: string;
  status: string;
  leadScore: number | null;
  meddicScore: {
    overall: number;
    dimensions: {
      metrics: number;
      economicBuyer: number;
      decisionCriteria: number;
      decisionProcess: number;
      identifyPain: number;
      champion: number;
    };
  } | null;
  industry: string | null;
  companySize: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt: Date | null;
}

export interface Conversation {
  id: string;
  leadId: string;
  title: string | null;
  type: string;
  status: string;
  audioUrl: string | null;
  transcript: {
    segments: Array<{
      speaker: string;
      text: string;
      start: number;
      end: number;
    }>;
    fullText: string;
    language: string;
  } | null;
  summary: string | null;
  meddicAnalysis: {
    overallScore: number;
    status: string;
    dimensions: Record<string, unknown>;
  } | null;
  extractedData: unknown;
  sentiment: string | null;
  progressScore: number | null;
  coachingNotes: string | null;
  urgencyLevel: string | null;
  storeName: string | null;
  duration: number | null;
  conversationDate: Date | null;
  createdAt: Date;
  analyzedAt: Date | null;
  updatedAt: Date;
  participants: Array<{
    name: string;
    role: string;
    company?: string;
  }> | null;
  createdBy: string | null;
}

export interface MeddicAnalysis {
  id: string;
  conversationId: string;
  leadId: string;
  metricsScore: number | null;
  economicBuyerScore: number | null;
  decisionCriteriaScore: number | null;
  decisionProcessScore: number | null;
  identifyPainScore: number | null;
  championScore: number | null;
  overallScore: number | null;
  status: string | null;
  dimensions: Record<
    string,
    {
      evidence: string[];
      gaps: string[];
      recommendations: string[];
    }
  > | null;
  keyFindings: string[] | null;
  nextSteps: Array<{
    action: string;
    priority: string;
    owner?: string;
  }> | null;
  risks: Array<{
    risk: string;
    severity: string;
    mitigation?: string;
  }> | null;
  agentOutputs: {
    agent1?: Record<string, unknown>;
    agent2?: Record<string, unknown>;
    agent3?: Record<string, unknown>;
    agent4?: Record<string, unknown>;
    agent5?: Record<string, unknown>;
    agent6?: Record<string, unknown>;
  } | null;
  createdAt: Date;
}

// Mock Leads
export const mockLeads: Lead[] = [
  {
    id: "lead-001",
    companyName: "ABC 餐廳",
    contactName: "張大明",
    contactEmail: "david@abc-restaurant.com",
    contactPhone: "0912-345-678",
    source: "referral",
    status: "qualified",
    leadScore: 85,
    meddicScore: {
      overall: 82,
      dimensions: {
        metrics: 4,
        economicBuyer: 5,
        decisionCriteria: 4,
        decisionProcess: 3,
        identifyPain: 5,
        champion: 4,
      },
    },
    industry: "餐飲業",
    companySize: "50-100",
    notes: "對 POS 系統有高度興趣，預計下季度導入",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-02-20"),
    lastContactedAt: new Date("2024-02-18"),
  },
  {
    id: "lead-002",
    companyName: "好味道連鎖餐飲",
    contactName: "李美華",
    contactEmail: "mei@goodtaste.tw",
    contactPhone: "0923-456-789",
    source: "manual",
    status: "proposal",
    leadScore: 72,
    meddicScore: {
      overall: 68,
      dimensions: {
        metrics: 3,
        economicBuyer: 4,
        decisionCriteria: 3,
        decisionProcess: 4,
        identifyPain: 4,
        champion: 3,
      },
    },
    industry: "餐飲業",
    companySize: "100-500",
    notes: "需要多店整合方案",
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-02-15"),
    lastContactedAt: new Date("2024-02-14"),
  },
  {
    id: "lead-003",
    companyName: "星光咖啡",
    contactName: "王小明",
    contactEmail: "xm.wang@starlight.coffee",
    contactPhone: "0934-567-890",
    source: "import",
    status: "new",
    leadScore: 45,
    meddicScore: null,
    industry: "餐飲業",
    companySize: "10-50",
    notes: "初次接觸",
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-02-01"),
    lastContactedAt: null,
  },
  {
    id: "lead-004",
    companyName: "快樂火鍋",
    contactName: "陳建國",
    contactEmail: "jg.chen@happyhotpot.com",
    contactPhone: "0945-678-901",
    source: "api",
    status: "negotiation",
    leadScore: 90,
    meddicScore: {
      overall: 88,
      dimensions: {
        metrics: 5,
        economicBuyer: 5,
        decisionCriteria: 4,
        decisionProcess: 4,
        identifyPain: 5,
        champion: 5,
      },
    },
    industry: "餐飲業",
    companySize: "50-100",
    notes: "已進入議價階段",
    createdAt: new Date("2023-12-10"),
    updatedAt: new Date("2024-02-20"),
    lastContactedAt: new Date("2024-02-19"),
  },
  {
    id: "lead-005",
    companyName: "海鮮大王",
    contactName: "林志偉",
    contactEmail: "zw.lin@seafoodking.tw",
    contactPhone: "0956-789-012",
    source: "referral",
    status: "contacted",
    leadScore: 55,
    meddicScore: {
      overall: 52,
      dimensions: {
        metrics: 2,
        economicBuyer: 3,
        decisionCriteria: 3,
        decisionProcess: 2,
        identifyPain: 3,
        champion: 2,
      },
    },
    industry: "餐飲業",
    companySize: "10-50",
    notes: "對價格敏感",
    createdAt: new Date("2024-01-25"),
    updatedAt: new Date("2024-02-10"),
    lastContactedAt: new Date("2024-02-08"),
  },
];

// Mock Conversations
export const mockConversations: Conversation[] = [
  {
    id: "conv-001",
    leadId: "lead-001",
    title: "ABC 餐廳 - 初次需求訪談",
    type: "discovery_call",
    status: "completed",
    audioUrl: "https://storage.example.com/audio/conv-001.mp3",
    transcript: {
      segments: [
        {
          speaker: "銷售",
          text: "您好，張先生，感謝您今天抽空與我通話。",
          start: 0,
          end: 3.5,
        },
        {
          speaker: "客戶",
          text: "沒問題，我正在尋找一套好用的 POS 系統。",
          start: 3.5,
          end: 7.2,
        },
        {
          speaker: "銷售",
          text: "太好了，可以請您分享一下目前遇到的痛點嗎？",
          start: 7.2,
          end: 11.0,
        },
        {
          speaker: "客戶",
          text: "我們現在的系統很慢，結帳要等很久，客人常常抱怨。而且報表功能很弱，我很難追蹤每日營收。",
          start: 11.0,
          end: 20.5,
        },
        {
          speaker: "銷售",
          text: "了解，這確實是很常見的問題。我們的系統可以在 3 秒內完成結帳，而且有即時的營收儀表板。",
          start: 20.5,
          end: 28.0,
        },
      ],
      fullText:
        "您好，張先生，感謝您今天抽空與我通話。沒問題，我正在尋找一套好用的 POS 系統。太好了，可以請您分享一下目前遇到的痛點嗎？我們現在的系統很慢，結帳要等很久，客人常常抱怨。而且報表功能很弱，我很難追蹤每日營收。了解，這確實是很常見的問題。我們的系統可以在 3 秒內完成結帳，而且有即時的營收儀表板。",
      language: "zh-TW",
    },
    summary:
      "客戶對現有 POS 系統的速度和報表功能不滿意，對我們的解決方案表現出高度興趣。",
    meddicAnalysis: {
      overallScore: 82,
      status: "Strong",
      dimensions: {},
    },
    extractedData: null,
    sentiment: "positive",
    progressScore: 75,
    coachingNotes: "建議下次通話時展示報表功能 demo",
    urgencyLevel: "high",
    storeName: "ABC 餐廳",
    duration: 1250,
    conversationDate: new Date("2024-02-15"),
    createdAt: new Date("2024-02-15"),
    analyzedAt: new Date("2024-02-15"),
    updatedAt: new Date("2024-02-15"),
    participants: [
      { name: "張大明", role: "決策者", company: "ABC 餐廳" },
      { name: "王銷售", role: "銷售代表", company: "iCHEF" },
    ],
    createdBy: "user-001",
  },
  {
    id: "conv-002",
    leadId: "lead-001",
    title: "ABC 餐廳 - 產品 Demo",
    type: "demo",
    status: "completed",
    audioUrl: "https://storage.example.com/audio/conv-002.mp3",
    transcript: {
      segments: [
        {
          speaker: "銷售",
          text: "今天我會為您展示我們的完整系統功能。",
          start: 0,
          end: 4.0,
        },
        {
          speaker: "客戶",
          text: "太好了，我最想看報表功能。",
          start: 4.0,
          end: 7.0,
        },
      ],
      fullText:
        "今天我會為您展示我們的完整系統功能。太好了，我最想看報表功能。",
      language: "zh-TW",
    },
    summary: "成功展示產品功能，客戶對報表功能印象深刻。",
    meddicAnalysis: {
      overallScore: 85,
      status: "Strong",
      dimensions: {},
    },
    extractedData: null,
    sentiment: "positive",
    progressScore: 85,
    coachingNotes: "客戶準備進入報價階段",
    urgencyLevel: "high",
    storeName: "ABC 餐廳",
    duration: 2400,
    conversationDate: new Date("2024-02-18"),
    createdAt: new Date("2024-02-18"),
    analyzedAt: new Date("2024-02-18"),
    updatedAt: new Date("2024-02-18"),
    participants: [
      { name: "張大明", role: "決策者", company: "ABC 餐廳" },
      { name: "王銷售", role: "銷售代表", company: "iCHEF" },
    ],
    createdBy: "user-001",
  },
  {
    id: "conv-003",
    leadId: "lead-004",
    title: "快樂火鍋 - 議價討論",
    type: "negotiation",
    status: "completed",
    audioUrl: "https://storage.example.com/audio/conv-003.mp3",
    transcript: {
      segments: [
        {
          speaker: "客戶",
          text: "我們很滿意產品，但希望價格能更優惠一些。",
          start: 0,
          end: 5.0,
        },
        {
          speaker: "銷售",
          text: "了解您的考量，讓我看看我們能提供什麼方案。",
          start: 5.0,
          end: 9.0,
        },
      ],
      fullText:
        "我們很滿意產品，但希望價格能更優惠一些。了解您的考量，讓我看看我們能提供什麼方案。",
      language: "zh-TW",
    },
    summary: "客戶對產品滿意，進入價格協商階段。",
    meddicAnalysis: {
      overallScore: 88,
      status: "Strong",
      dimensions: {},
    },
    extractedData: null,
    sentiment: "neutral",
    progressScore: 90,
    coachingNotes: "Close Now 機會！建議準備最終報價",
    urgencyLevel: "high",
    storeName: "快樂火鍋",
    duration: 1800,
    conversationDate: new Date("2024-02-19"),
    createdAt: new Date("2024-02-19"),
    analyzedAt: new Date("2024-02-19"),
    updatedAt: new Date("2024-02-19"),
    participants: [
      { name: "陳建國", role: "決策者", company: "快樂火鍋" },
      { name: "王銷售", role: "銷售代表", company: "iCHEF" },
    ],
    createdBy: "user-001",
  },
];

// Mock MEDDIC Analyses
export const mockMeddicAnalyses: MeddicAnalysis[] = [
  {
    id: "meddic-001",
    conversationId: "conv-001",
    leadId: "lead-001",
    metricsScore: 4,
    economicBuyerScore: 5,
    decisionCriteriaScore: 4,
    decisionProcessScore: 3,
    identifyPainScore: 5,
    championScore: 4,
    overallScore: 82,
    status: "Strong",
    dimensions: {
      metrics: {
        evidence: ["提到結帳速度是關鍵指標", "需要即時營收追蹤"],
        gaps: ["尚未確認具體 ROI 期望"],
        recommendations: ["下次會議準備 ROI 計算表"],
      },
      economicBuyer: {
        evidence: ["張大明是餐廳老闆，有最終決策權"],
        gaps: [],
        recommendations: ["維持與決策者的直接溝通"],
      },
      decisionCriteria: {
        evidence: ["速度和報表是主要需求"],
        gaps: ["需確認其他評估標準"],
        recommendations: ["詢問是否有其他考量因素"],
      },
      decisionProcess: {
        evidence: ["老闆獨立決策"],
        gaps: ["不確定採購流程時程"],
        recommendations: ["確認決策時間表"],
      },
      identifyPain: {
        evidence: ["現有系統慢", "報表功能弱", "客人抱怨"],
        gaps: [],
        recommendations: ["持續強調我們如何解決這些問題"],
      },
      champion: {
        evidence: ["張老闆積極尋找解決方案"],
        gaps: ["需確認是否有內部反對者"],
        recommendations: ["建立更深的信任關係"],
      },
    },
    keyFindings: [
      "客戶有明確的痛點（速度慢、報表弱）",
      "決策者直接參與溝通",
      "對我們的解決方案表現高度興趣",
      "預計下季度導入",
    ],
    nextSteps: [
      { action: "安排產品 Demo", priority: "high", owner: "王銷售" },
      { action: "準備 ROI 分析報告", priority: "medium", owner: "王銷售" },
      { action: "發送報價單", priority: "low", owner: "王銷售" },
    ],
    risks: [
      {
        risk: "預算可能有限制",
        severity: "medium",
        mitigation: "準備彈性付款方案",
      },
    ],
    agentOutputs: null,
    createdAt: new Date("2024-02-15"),
  },
  {
    id: "meddic-002",
    conversationId: "conv-003",
    leadId: "lead-004",
    metricsScore: 5,
    economicBuyerScore: 5,
    decisionCriteriaScore: 4,
    decisionProcessScore: 4,
    identifyPainScore: 5,
    championScore: 5,
    overallScore: 88,
    status: "Strong",
    dimensions: {
      metrics: {
        evidence: ["已確認 ROI 預期", "清楚量化效益"],
        gaps: [],
        recommendations: ["持續追蹤實施後的效益"],
      },
      economicBuyer: {
        evidence: ["陳建國是決策者且有預算權限"],
        gaps: [],
        recommendations: [],
      },
      decisionCriteria: {
        evidence: ["價格、功能、服務三項已確認"],
        gaps: [],
        recommendations: ["準備最終報價"],
      },
      decisionProcess: {
        evidence: ["決策流程清晰，預計一週內簽約"],
        gaps: [],
        recommendations: [],
      },
      identifyPain: {
        evidence: ["痛點明確且急迫"],
        gaps: [],
        recommendations: [],
      },
      champion: {
        evidence: ["陳老闆是強力支持者"],
        gaps: [],
        recommendations: [],
      },
    },
    keyFindings: [
      "客戶準備好簽約",
      "價格是最後的障礙",
      "Close Now 機會",
      "高度成交可能性",
    ],
    nextSteps: [
      { action: "提交最終報價", priority: "high", owner: "王銷售" },
      { action: "準備合約", priority: "high", owner: "法務" },
    ],
    risks: [
      {
        risk: "競爭對手可能提供更低價格",
        severity: "medium",
        mitigation: "強調產品價值和服務品質",
      },
    ],
    agentOutputs: null,
    createdAt: new Date("2024-02-19"),
  },
];

// Lead status options
export const leadStatusOptions = [
  { value: "new", label: "新建立", color: "gray" },
  { value: "contacted", label: "已聯繫", color: "blue" },
  { value: "qualified", label: "已合格", color: "green" },
  { value: "proposal", label: "報價中", color: "yellow" },
  { value: "negotiation", label: "議價中", color: "orange" },
  { value: "won", label: "成交", color: "emerald" },
  { value: "lost", label: "流失", color: "red" },
] as const;

// Conversation type options
export const conversationTypeOptions = [
  { value: "discovery_call", label: "需求訪談" },
  { value: "demo", label: "產品展示" },
  { value: "follow_up", label: "跟進電話" },
  { value: "negotiation", label: "議價討論" },
  { value: "closing", label: "成交會議" },
  { value: "support", label: "客服支援" },
] as const;

// Conversation status options
export const conversationStatusOptions = [
  { value: "pending", label: "待處理" },
  { value: "transcribing", label: "轉錄中" },
  { value: "analyzing", label: "分析中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失敗" },
] as const;

// MEDDIC dimension labels
export const meddicDimensionLabels = {
  metrics: "量化指標 (M)",
  economicBuyer: "經濟決策者 (E)",
  decisionCriteria: "決策標準 (D)",
  decisionProcess: "決策流程 (D)",
  identifyPain: "痛點識別 (I)",
  champion: "內部支持者 (C)",
} as const;

// MEDDIC status options
export const meddicStatusOptions = [
  { value: "Strong", label: "強勢", color: "green", minScore: 70 },
  { value: "Medium", label: "中等", color: "yellow", minScore: 40 },
  { value: "Weak", label: "弱勢", color: "orange", minScore: 20 },
  { value: "At Risk", label: "風險", color: "red", minScore: 0 },
] as const;

// Helper function to get status info
export function getLeadStatusInfo(status: string) {
  return (
    leadStatusOptions.find((s) => s.value === status) || {
      value: status,
      label: status,
      color: "gray",
    }
  );
}

export function getMeddicStatusInfo(score: number) {
  for (const status of meddicStatusOptions) {
    if (score >= status.minScore) {
      return status;
    }
  }
  return meddicStatusOptions[meddicStatusOptions.length - 1];
}

// Format duration helper
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
