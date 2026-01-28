/**
 * Type definitions for LLM and Multi-Agent Orchestrator
 * Aligned with V2 structure for seamless migration
 */

// TODO: Add @sales_ai_automation_v3/shared to package.json dependencies
// Temporarily using local type definitions
export interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp?: number;
  start: number; // Start time in seconds
  end: number; // End time in seconds
}

export interface Transcript {
  fullText: string;
  segments: TranscriptSegment[];
  language?: string;
  duration?: number;
}

export interface MeddicScores {
  metrics: number;
  economicBuyer: number;
  decisionCriteria: number;
  decisionProcess: number;
  identifyPain: number;
  champion: number;
}

export interface DimensionAnalysis {
  score: number;
  confidence: number;
  evidence: string[];
  suggestions: string[];
}

export type MeddicDimensions =
  | "metrics"
  | "economicBuyer"
  | "decisionCriteria"
  | "decisionProcess"
  | "identifyPain"
  | "champion";

// ============================================================
// Agent Output Types (V2 compatibility)
// ============================================================

/**
 * Agent 1: Context Agent
 * Analyzes meeting background and constraints
 */
export interface Agent1Output {
  decision_maker: "老闆本人" | "員工代表" | "只有員工";
  decision_maker_confirmed: boolean;
  urgency_level: "高" | "中" | "低";
  deadline_date: string | null; // YYYY-MM-DD
  customer_motivation: "開新店" | "系統故障" | "合約到期" | "想省錢" | "其他";
  barriers: string[];
  meta_consistent: boolean;
}

/**
 * Agent 2: Buyer Agent (PDCM Framework)
 * Customer insight analysis using SMB-optimized MEDDIC (PDCM)
 * Updated to match prompts.generated.ts output format
 */
export interface Agent2Output {
  // PDCM Scores - 核心分析結果
  pdcm_scores: {
    pain: {
      score: number;
      level: "P1_Critical" | "P2_High" | "P3_Medium" | "P4_Low";
      main_pain: string;
      urgency: "立即" | "近期" | "未來";
      quantified_loss?: string;
      evidence: string[];
    };
    decision: {
      score: number;
      contact_role: "老闆" | "店長" | "員工";
      has_authority: boolean;
      budget_awareness: "有概念" | "不清楚" | "不提";
      timeline: "急著要" | "近期" | "未定";
      risk: "低" | "中" | "高";
    };
    champion: {
      score: number;
      attitude: "主動積極" | "中立觀望" | "冷淡推託";
      customer_type: "衝動型" | "精算型" | "保守觀望型";
      primary_criteria: "價格" | "功能" | "易用性" | "服務";
      switch_concerns?: string;
      evidence: string[];
    };
    metrics: {
      score: number;
      level: "M1_Complete" | "M2_Partial" | "M3_Weak" | "M4_Missing";
      quantified_items?: Array<{
        category: "時間成本" | "人力成本" | "營收損失" | "機會成本";
        description: string;
        monthly_value: number;
        calculation?: string;
        customer_confirmed?: boolean;
      }>;
      total_monthly_impact: number;
      annual_impact: number;
      roi_message?: string;
    };
    total_score: number;
    deal_probability: "高" | "中" | "低";
  };

  // PCM State - 簡化狀態摘要
  pcm_state: {
    pain: {
      primary_pain: string;
      pain_level: "P1" | "P2" | "P3" | "P4";
      customer_quote?: string;
    };
    champion: {
      identified: boolean;
      name?: string;
      attitude: "積極" | "中立" | "消極";
    };
    metrics: {
      quantified: boolean;
      total_monthly_impact: number;
      annual_impact: number;
    };
  };

  // 未成交原因分析
  not_closed_reason: {
    type:
      | "痛點不痛"
      | "決策者不在"
      | "價格疑慮"
      | "轉換顧慮"
      | "比價中"
      | "Metrics缺失"
      | "其他";
    detail: string;
    breakthrough_suggestion: string;
  };

  // 錯過的機會
  missed_opportunities: string[];

  // 現有系統
  current_system: "無" | "其他品牌" | "舊用戶";

  // 競品偵測
  detected_competitors?: Array<{
    name: string; // 競品名稱
    customer_quote: string; // 客戶原話
    attitude: "positive" | "negative" | "neutral"; // 客戶態度
  }>;
}

/**
 * Agent 3: Seller Agent
 * Sales performance and strategy recommendations
 */
export interface Agent3Output {
  progress_score: number; // 0-100
  has_clear_ask: boolean;
  recommended_strategy: "立即成交" | "小步前進" | "維持關係";
  strategy_reason: string;
  safety_alert: boolean;
  skills_diagnosis: {
    pain_addressed: boolean;
    strengths: string[];
    improvements: string[];
  };
  next_action: {
    action: string;
    suggested_script: string;
    deadline: string;
  };
}

/**
 * Agent 4: Summary Agent
 * Customer-oriented meeting summary with SMS and Markdown output
 */
export interface Agent4Output {
  sms_text: string;
  hook_point: {
    customer_interest: string;
    customer_quote: string;
  };
  tone_used: "Casual" | "Formal";
  character_count: number;
  markdown: string;
  pain_points: string[];
  solutions: string[];
  key_decisions: string[];
  action_items: {
    ichef: string[];
    customer: string[];
  };
  /** 給客戶的下一步行動 CTA（客戶視角） */
  customer_cta?: {
    /** 行動描述，例如「預約免費試用」 */
    action: string;
    /** 上下文，引用客戶對話中提到的內容 */
    context: string;
    /** 按鈕文字，例如「預約試用」 */
    button_text: string;
    /** 急迫程度 */
    urgency: "high" | "medium" | "low";
  };
}

/**
 * Agent 5: CRM Extractor
 * Structured data for CRM/Salesforce integration
 */
export interface Agent5Output {
  stage_name: string;
  stage_confidence: "high" | "medium" | "low";
  stage_reasoning: string;
  budget: {
    range: string;
    mentioned: boolean;
    decision_maker: string;
  };
  decision_makers: Array<{
    name: string;
    role: string;
    influence: "high" | "medium" | "low";
  }>;
  pain_points: string[];
  timeline: {
    decision_date: string | null; // YYYY-MM
    urgency: "high" | "medium" | "low";
    notes: string;
  };
  next_steps: string[];
}

/**
 * Agent 6: Coach Agent
 * Real-time coaching and alerts
 */
export interface Agent6Output {
  alert_triggered: boolean;
  alert_type: "close_now" | "missed_dm" | "excellent" | "low_progress" | "none";
  alert_severity: "Critical" | "High" | "Medium" | "Low";
  alert_message: string;
  coaching_notes: string;
  strengths: string[];
  improvements: Array<{
    area: string;
    suggestion: string;
  }>;
  detected_objections: Array<{
    type: string;
    customer_quote: string;
    timestamp_hint: string;
  }>;
  objection_handling: Array<{
    objection_type: string;
    handled: boolean;
    effectiveness: "full" | "partial" | "none";
    suggestion: string;
  }>;
  suggested_talk_tracks: string[];
  follow_up: {
    timing: string;
    method: string;
    notes: string;
  };
  manager_alert: boolean;
  manager_alert_reason: string | null;

  // 競品提及摘要（資訊區塊）
  competitor_mentions?: Array<{
    competitor_name: string;
    mention_count: number;
    customer_attitude: "positive" | "negative" | "neutral";
    quotes: string[]; // 客戶原話
  }>;

  competitor_threat_level?: "high" | "medium" | "low" | "none";

  // 競品應對評估（教練區塊）
  competitor_handling_evaluation?: Array<{
    competitor_name: string;
    customer_quote: string; // 客戶說了什麼
    rep_response: string; // 業務怎麼回應
    score: number; // 1-5 分
    evaluation: {
      strengths: string[]; // 做得好的
      weaknesses: string[]; // 待改進的
    };
    recommended_response: string; // 建議的更好回應
    improvement_tips: string[]; // 改進重點
  }>;

  // ========== 對話轉折點分析 (Conversation Turning Points) ==========

  /**
   * Aha Moments - 正向轉折點
   * 客戶態度從冷淡/猶豫轉為積極/感興趣的關鍵時刻
   */
  aha_moments?: Array<{
    /** 轉折發生的時間區間描述 (e.g., "對話中段，討論到外送整合時") */
    timestamp_hint: string;
    /** 轉折前的客戶狀態 */
    before_state: "冷淡" | "猶豫" | "中立" | "質疑";
    /** 轉折後的客戶狀態 */
    after_state: "感興趣" | "認同" | "積極" | "想成交";
    /** 觸發轉折的業務話術（黃金句型） */
    trigger_phrase: string;
    /** 客戶的正面回應 */
    customer_response: string;
    /** 為什麼這句話有效 */
    why_it_worked: string;
    /** 轉折強度 (1-5，5 最強) */
    intensity: number;
  }>;

  /**
   * Deal Breakers - 負向轉折點
   * 客戶態度從積極轉為冷淡/抗拒的關鍵時刻
   */
  deal_breakers?: Array<{
    /** 轉折發生的時間區間描述 */
    timestamp_hint: string;
    /** 轉折前的客戶狀態 */
    before_state: "感興趣" | "積極" | "認同" | "中立";
    /** 轉折後的客戶狀態 */
    after_state: "猶豫" | "冷淡" | "抗拒" | "想離開";
    /** 導致轉折的原因（業務說了什麼/做了什麼） */
    trigger_cause: string;
    /** 客戶的負面反應 */
    customer_reaction: string;
    /** 問題分析：為什麼客戶反應變差 */
    problem_analysis: string;
    /** 建議的補救話術 */
    recovery_suggestion: string;
    /** 轉折強度 (1-5，5 最嚴重) */
    intensity: number;
  }>;

  /**
   * 情緒曲線摘要
   * 整體對話的情緒走向
   */
  emotional_journey?: {
    /** 開場情緒 */
    opening: "正面" | "中立" | "負面";
    /** 最高點描述 */
    peak_moment?: string;
    /** 最低點描述 */
    low_moment?: string;
    /** 結尾情緒 */
    closing: "正面" | "中立" | "負面";
    /** 整體趨勢 */
    overall_trend: "上升" | "平穩" | "下降" | "波動";
    /** 關鍵轉折數量 */
    turning_point_count: number;
  };
}

// ============================================================
// Analysis State (Orchestrator)
// ============================================================

export interface AnalysisMetadata {
  leadId: string;
  conversationId?: string;
  salesRep: string;
  conversationDate: Date;
  productLine?: "ichef" | "beauty";
}

export interface AnalysisState {
  transcript: TranscriptSegment[];
  metadata: AnalysisMetadata;

  // Agent results cache
  contextData?: Agent1Output;
  buyerData?: Agent2Output;
  sellerData?: Agent3Output;
  summaryData?: Agent4Output;
  crmData?: Agent5Output;
  coachData?: Agent6Output;

  // Quality control (V2 Quality Loop)
  refinementCount: number;
  maxRefinements: number; // Default: 2

  // Conditional execution
  hasCompetitor: boolean;
  competitorKeywords?: string[];
}

// ============================================================
// Final Analysis Result
// ============================================================

export interface AnalysisResult {
  // Core MEDDIC data
  meddicScores: MeddicScores;
  overallScore: number;
  qualificationStatus: string;
  dimensions: MeddicDimensions;

  // Summary
  executiveSummary: string;
  keyFindings: string[];
  nextSteps: Array<{
    action: string;
    owner?: string;
    deadline?: string;
  }>;

  // Risk assessment
  risks: Array<{
    risk: string;
    severity: string;
    mitigation?: string;
  }>;

  // Coaching
  coachingNotes: string;
  alerts: Array<{
    type:
      | "Close Now"
      | "Missing Decision Maker"
      | "Excellent Performance"
      | "Risk";
    severity: "Critical" | "High" | "Medium" | "Low";
    message: string;
  }>;

  // CRM data
  crmData: Agent5Output;

  // V2 compatibility: preserve all raw agent outputs
  agentOutputs: {
    agent1?: Agent1Output;
    agent2?: Agent2Output;
    agent3?: Agent3Output;
    agent4?: Agent4Output;
    agent5?: Agent5Output;
    agent6?: Agent6Output;
  };

  // Metadata
  analyzedAt: Date;
  refinementCount: number;
}

// ============================================================
// LLM Client Interface
// ============================================================

export interface LLMResponse {
  text: string;
  raw?: unknown; // Raw response from LLM provider
}

export interface LLMClient {
  generate(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPrompt?: string;
}
