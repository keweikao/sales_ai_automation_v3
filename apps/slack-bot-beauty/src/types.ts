// Slack Bot 環境變數類型
export interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_ALERT_CHANNEL?: string; // 預設警示通知頻道
  API_BASE_URL: string;
  API_TOKEN?: string;
  ENVIRONMENT: string;
  // EVERY8D SMS 簡訊服務
  EVERY8D_UID?: string; // EVERY8D 帳號
  EVERY8D_PWD?: string; // EVERY8D 密碼
  EVERY8D_API_URL?: string; // EVERY8D API URL (預設: https://api.e8d.tw/API21/HTTP/sendSMS.ashx)
  EVERY8D_SITE_URL?: string; // EVERY8D API URL (舊版命名，向下相容)

  // 新增: 產品線 Channel 配置
  PRODUCT_LINE_CHANNELS?: string; // JSON string: {"C12345":"ichef","C67890":"beauty"}

  // 產品線設定
  PRODUCT_LINE?: string; // 'ichef' | 'beauty'
}

// Slack 請求類型
export interface SlackRequestBody {
  type?: string;
  challenge?: string;
  token?: string;
  event?: SlackEvent;
  command?: string;
  text?: string;
  user_id?: string;
  user_name?: string;
  channel_id?: string;
  channel_name?: string;
  response_url?: string;
  trigger_id?: string;
}

export interface SlackEvent {
  type: string;
  user?: string;
  channel: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  event_ts?: string;
  files?: SlackFile[];
  file_id?: string;
  bot_id?: string;
  subtype?: string;
}

export interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  filetype: string;
  url_private_download?: string;
  size: number;
}

// API 回應類型 - V3 Opportunity 架構
export interface OpportunityResponse {
  id: string;
  customerNumber: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: OpportunityStatus;
  source: OpportunitySource;
  industry: string | null;
  companySize: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  conversationCount?: number;
  latestMeddicScore?: number | null;
}

export type OpportunityStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type OpportunitySource =
  | "manual"
  | "import"
  | "api"
  | "referral"
  | "slack";

export interface MeddicScoreResponse {
  overallScore: number;
  metrics: number;
  economicBuyer: number;
  decisionCriteria: number;
  decisionProcess: number;
  identifyPain: number;
  champion: number;
}

export interface ConversationResponse {
  id: string;
  opportunityId: string;
  caseNumber: string;
  title: string | null;
  type: ConversationType;
  status: ConversationStatus;
  audioUrl: string | null;
  transcript: string | null;
  summary: string | null;
  duration: number | null;
  conversationDate: string | null;
  createdAt: string;
  updatedAt: string;
  hasAnalysis?: boolean;
  opportunityCompanyName?: string;
  customerNumber?: string;
}

export type ConversationType =
  | "discovery_call"
  | "demo"
  | "follow_up"
  | "negotiation"
  | "closing"
  | "support";

export type ConversationStatus =
  | "pending"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "completed"
  | "failed";

export interface MeddicAnalysisResponse {
  id: string;
  conversationId: string;
  opportunityId: string;
  overallScore: number;
  status: MeddicStatus;
  dimensions: {
    metrics: DimensionDetail;
    economicBuyer: DimensionDetail;
    decisionCriteria: DimensionDetail;
    decisionProcess: DimensionDetail;
    identifyPain: DimensionDetail;
    champion: DimensionDetail;
  };
  keyFindings: string[];
  nextSteps: string[];
  risks: string[];
  coachingTips?: string[];
  createdAt: string;
}

export type MeddicStatus = "strong" | "medium" | "weak" | "at_risk";

export interface DimensionDetail {
  score: number;
  evidence: string[];
  gaps: string[];
  recommendations: string[];
}

// API 統計類型
export interface DashboardStatsResponse {
  totalOpportunities: number;
  totalConversations: number;
  totalAnalyses: number;
  averageMeddicScore: number | null;
  statusDistribution: Array<{ status: MeddicStatus; count: number }>;
  recentAnalyses: Array<{
    id: string;
    conversationId: string;
    opportunityId: string;
    overallScore: number;
    status: MeddicStatus;
    createdAt: string;
    companyName: string;
  }>;
}

export interface OpportunityStatsResponse {
  total: number;
  byStatus: Record<string, number>;
  averageMeddicScore: number;
  recentActivity: number;
}

export interface MeddicTrendsResponse {
  period: string;
  averageScores: {
    metrics: number;
    economicBuyer: number;
    decisionCriteria: number;
    decisionProcess: number;
    identifyPain: number;
    champion: number;
  };
  trend: "up" | "down" | "stable";
  changePercent: number;
  history: Array<{
    date: string;
    overallScore: number;
  }>;
}

// Upload 相關類型
export interface UploadConversationRequest {
  opportunityId: string;
  audioBase64: string;
  title?: string;
  type: ConversationType;
  metadata?: {
    format?: string;
    conversationDate?: string;
  };
}

export interface UploadConversationResponse {
  conversationId: string;
  caseNumber: string;
  status: ConversationStatus;
  audioUrl: string;
  message?: string; // 處理狀態訊息
  transcript: {
    fullText: string;
    segmentCount: number;
    language: string;
  } | null; // null 表示轉錄尚未完成(pending 狀態)
  createdAt: Date;
}

// Alert 相關類型
export interface AlertResponse {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  opportunityId: string;
  conversationId?: string;
  context: AlertContext;
  slackNotified: boolean;
  createdAt: string;
}

export type AlertType = "close_now" | "missing_dm" | "manager_escalation";
export type AlertSeverity = "high" | "medium" | "low";
export type AlertStatus = "pending" | "acknowledged" | "resolved" | "dismissed";

export interface AlertContext {
  meddicScore?: number;
  triggerReason: string;
  suggestedAction: string;
}

export interface AlertStatsResponse {
  pending: number;
  acknowledged: number;
  resolved: number;
  byType: {
    close_now: number;
    missing_dm: number;
    manager_escalation: number;
  };
}

// 音檔上傳業務資訊表單類型
export type StoreType =
  | "cafe"
  | "beverage"
  | "hotpot"
  | "bbq"
  | "snack"
  | "restaurant"
  | "bar"
  | "fastfood"
  | "other";

export type ServiceType =
  | "dine_in_only"
  | "takeout_only"
  | "dine_in_main"
  | "takeout_main";

export type CurrentPosSystem =
  | "none"
  | "ichef_old"
  | "dudu"
  | "eztable"
  | "other_pos"
  | "traditional"
  | "manual";

export interface AudioUploadMetadata {
  customerNumber: string;
  customerName: string;
  storeType: StoreType;
  serviceType: ServiceType;
  currentPos: CurrentPosSystem;
  decisionMakerOnsite: boolean;

  // 新增: 產品線支援
  productLine?: string; // 'ichef' | 'beauty'
  staffCount?: string; // Beauty only
  currentSystem?: string; // 統一的現有系統欄位名稱
  decisionMakerPresent?: string; // 新版欄位名稱 (yes/no/unknown)

  // 客戶聯絡資訊
  contactPhone?: string; // 客戶電話
}

// Slack Modal 相關類型
export interface SlackViewSubmission {
  type: "view_submission";
  user: {
    id: string;
    name: string;
  };
  view: {
    id: string;
    callback_id: string;
    private_metadata: string;
    state: {
      values: Record<string, Record<string, SlackInputValue>>;
    };
  };
}

export interface SlackInputValue {
  type: string;
  value?: string;
  selected_option?: {
    value: string;
  };
  selected_options?: Array<{
    value: string;
  }>;
}

// 暫存的檔案資訊（用於 Modal 提交後處理）
export interface PendingAudioFile {
  fileId: string;
  fileName: string;
  channelId: string;
  userId: string; // Slack User ID
  userName?: string; // Slack Username
  threadTs?: string;
  downloadUrl: string;
}

// Talk Track 相關類型
export interface TalkTrackResponse {
  id: string;
  situation: string;
  customerType: string | null;
  storeType: string | null;
  talkTrack: string;
  context: string | null;
  expectedOutcome: string | null;
  sourceType: string | null;
  sourceConversationId: string | null;
  successRate: number | null;
  usageCount: number | null;
  version: number | null;
  isActive: boolean | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}
