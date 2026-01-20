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
 * Agent 2: Buyer Agent
 * Customer insight analysis - why not closed, switching concerns, customer type
 */
export interface Agent2Output {
  not_closed_reason:
    | "價格太高"
    | "需老闆決定"
    | "功能不符"
    | "轉換顧慮"
    | "習慣現狀";
  not_closed_detail: string;
  switch_concerns: {
    detected: boolean;
    worry_about: "菜單設定" | "員工訓練" | "資料遷移" | "無";
    complexity: "複雜" | "一般" | "簡單";
  };
  customer_type: {
    type: "衝動型" | "精算型" | "保守觀望型";
    evidence: string[];
  };
  missed_opportunities: string[];
  current_system: "無" | "其他品牌" | "iCHEF舊用戶";
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
