/**
 * Report KV Cache Types
 * 報告預計算資料結構定義
 */

// ============================================================
// Common Types
// ============================================================

export interface CaseInfo {
  caseNumber: string;
  companyName: string;
  errorMessage?: string;
}

export interface OpportunityInfo {
  customerNumber: string;
  companyName: string;
  userName: string;
}

// ============================================================
// 1. SystemHealthData
// KV Key: report:system-health
// 更新頻率: 每 15 分鐘
// ============================================================

export interface SystemHealthData {
  generatedAt: string; // ISO timestamp

  // 處理統計 (Daily Health Report)
  processing: {
    last24h: {
      completed: number;
      failed: number;
      inProgress: number;
      avgProcessingTime: number; // seconds
    };
    // 按錯誤代碼分組
    errorsByCode: Record<
      string,
      {
        count: number;
        stage: "audio" | "download" | "transcription" | "analysis" | "database";
        cases: CaseInfo[];
      }
    >;
    // 卡住的案件 (pending/transcribing/analyzing > 1hr)
    stuckCases: Array<{
      caseNumber: string;
      companyName: string;
      status: string;
      hoursStuck: number;
    }>;
  };

  // 週比較 (Weekly Report)
  weeklyComparison: {
    thisWeek: {
      uploads: number;
      avgMeddic: number;
    };
    lastWeek: {
      uploads: number;
      avgMeddic: number;
    };
    change: {
      uploadsPercent: number; // e.g., 12 means +12%
      meddicDiff: number; // e.g., 3 means +3 points
    };
  };
}

// ============================================================
// 2. CloseCaseData
// KV Key: report:close-cases
// 更新頻率: 資料變更時 (opportunity won/lost)
// ============================================================

export interface CloseCaseWon {
  customerNumber: string;
  companyName: string;
  userName: string;
  wonAt: string;
}

export interface CloseCaseLost {
  customerNumber: string;
  companyName: string;
  userName: string;
  lostAt: string;
  rejectionReason?: string;
  selectedCompetitor?: string;
}

export interface CloseCaseData {
  generatedAt: string;

  // 本週 Close Case
  thisWeek: {
    won: CloseCaseWon[];
    lost: CloseCaseLost[];
    wonCount: number;
    lostCount: number;
    winRate: number; // 0-100
  };

  // MTD 累計
  mtd: {
    wonCount: number;
    lostCount: number;
    winRate: number;
  };
}

// ============================================================
// 3. AttentionNeededData
// KV Key: report:attention-needed
// 更新頻率: 每 15 分鐘
// ============================================================

export interface StaleHighScoreOpportunity extends OpportunityInfo {
  meddicScore: number;
  daysSinceContact: number;
}

export interface NoTodoOpportunity extends OpportunityInfo {
  daysSinceCreated: number;
}

export interface InactiveRep {
  userId: string;
  userName: string;
}

export interface AttentionNeededData {
  generatedAt: string;

  // 高分但 > 7 天未跟進的機會
  staleHighScore: StaleHighScoreOpportunity[];

  // 無待辦的進行中機會 (建立 > 7 天)
  noTodos: NoTodoOpportunity[];

  // 本週未上傳的業務
  inactiveReps: InactiveRep[];
}

// ============================================================
// 4. TodoStatsData
// KV Key: report:todo-stats
// 更新頻率: 每 15 分鐘 + 資料變更時
// ============================================================

export interface TodoInfo {
  id: string;
  title: string;
  dueDate: string;
  opportunityId?: string;
  companyName?: string;
  customerNumber?: string;
}

export interface FollowUpInfo {
  id: string;
  opportunityId: string;
  companyName: string;
  customerNumber: string;
  userId: string;
  userName: string;
  slackUserId?: string;
  scheduledDate: string;
  purpose?: string;
}

export interface TodoStatsData {
  generatedAt: string;

  // 逾期待辦
  overdue: {
    total: number;
    byUser: Record<
      string,
      {
        count: number;
        userName: string;
      }
    >;
  };

  // 今日待辦 (用於提醒)
  dueToday: {
    total: number;
    byUser: Record<string, TodoInfo[]>;
  };

  // 待跟進 (pending follow-ups)
  pendingFollowUps: FollowUpInfo[];
}

// ============================================================
// 5. TeamPerformanceData (擴充)
// KV Key: report:team-performance
// 更新頻率: 每 15 分鐘
// ============================================================

export interface WeeklyRepPerformance {
  userId: string;
  userName: string;
  weekUploads: number;
  avgMeddic: number | null;
  weekWon: number;
}

export interface TeamPerformanceExtended {
  generatedAt: string;

  // 各業務本週表現
  weeklyPerformance: WeeklyRepPerformance[];
}

// ============================================================
// 6. MtdUploadsData
// KV Key: report:mtd-uploads:{year}-{month}
// 更新頻率: 資料變更時 (conversation 新增)
// ============================================================

export interface MtdUploadRecord {
  id: string;
  caseNumber: string;
  customerNumber: string;
  companyName: string;
  userName: string;
  userId: string;
  status: string;
  createdAt: string;
  meddicScore?: number;
}

export interface MtdUploadsData {
  generatedAt: string;
  year: number;
  month: number;

  // 上傳記錄
  uploads: MtdUploadRecord[];

  // 摘要統計
  summary: {
    total: number;
    byUser: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

// ============================================================
// KV Key Constants
// ============================================================

export const KV_KEYS = {
  SYSTEM_HEALTH: "report:system-health",
  CLOSE_CASES: "report:close-cases",
  ATTENTION_NEEDED: "report:attention-needed",
  TODO_STATS: "report:todo-stats",
  TEAM_PERFORMANCE: (dept: string) => `report:team:${dept}`,
  MTD_UPLOADS: (year: number, month: number) =>
    `report:mtd-uploads:${year}-${String(month).padStart(2, "0")}`,
  REP_REPORT: (userId: string) => `report:rep:${userId}`,
  UPLOAD_RANKING_WEEKLY: "report:upload-ranking:weekly",
  UPLOAD_RANKING_MONTHLY: "report:upload-ranking:monthly",
} as const;

// ============================================================
// TTL Constants (in seconds)
// ============================================================

export const KV_TTL = {
  SYSTEM_HEALTH: 3600, // 1 小時
  CLOSE_CASES: 86_400, // 24 小時
  ATTENTION_NEEDED: 3600, // 1 小時
  TODO_STATS: 3600, // 1 小時
  TEAM_PERFORMANCE: 3600, // 1 小時
  MTD_UPLOADS: 86_400, // 24 小時
  REP_REPORT: 3600, // 1 小時
} as const;

// ============================================================
// Error Stage Mapping
// ============================================================

export const ERROR_STAGE_MAP: Record<
  string,
  "audio" | "download" | "transcription" | "analysis" | "database"
> = {
  AUDIO_TOO_LARGE: "audio",
  INVALID_AUDIO_FORMAT: "audio",
  FILE_DOWNLOAD_FAILED: "download",
  TRANSCRIPTION_FAILED: "transcription",
  TRANSCRIPTION_TIMEOUT: "transcription",
  GROQ_API_ERROR: "transcription",
  GEMINI_API_ERROR: "analysis",
  DATABASE_ERROR: "database",
  RECORD_NOT_FOUND: "database",
};
