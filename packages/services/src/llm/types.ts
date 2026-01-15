/**
 * Type definitions for LLM and Multi-Agent Orchestrator
 * Aligned with V2 structure for seamless migration
 */

// TODO: Add @sales_ai_automation_v3/shared to package.json dependencies
// Temporarily using local type definitions
export type TranscriptSegment = {
  speaker: string;
  text: string;
  timestamp?: number;
  start: number;  // Start time in seconds
  end: number;    // End time in seconds
};

export type Transcript = {
  fullText: string;
  segments: TranscriptSegment[];
  language?: string;
  duration?: number;
};

export type MeddicScores = {
  metrics: number;
  economicBuyer: number;
  decisionCriteria: number;
  decisionProcess: number;
  identifyPain: number;
  champion: number;
};

export type DimensionAnalysis = {
  score: number;
  confidence: number;
  evidence: string[];
  suggestions: string[];
};

export type MeddicDimensions = "metrics" | "economicBuyer" | "decisionCriteria" | "decisionProcess" | "identifyPain" | "champion";

// ============================================================
// Agent Output Types (V2 compatibility)
// ============================================================

/**
 * Agent 1: Context Agent
 * Analyzes meeting background and constraints
 */
export interface Agent1Output {
  meetingType: string;
  decisionMakers: Array<{
    name: string;
    role: string;
    present: boolean;
  }>;
  constraints: {
    budget?: string;
    timeline?: string;
    technicalRequirements?: string[];
  };
  storeInfo?: {
    name: string;
    type: string;
    size?: string;
  };
  competitorMentions: string[];
}

/**
 * Agent 2: Buyer Agent
 * Core MEDDIC analysis - most important agent
 */
export interface Agent2Output {
  meddicScores: MeddicScores;
  dimensions: MeddicDimensions;
  overallScore: number; // 1-100
  qualificationStatus: "Strong" | "Medium" | "Weak" | "At Risk";
  needsIdentified: boolean;
  painPoints: string[];
  trustAssessment: {
    level: "High" | "Medium" | "Low";
    indicators: string[];
  };
}

/**
 * Agent 3: Seller Agent
 * Sales strategy and performance assessment
 */
export interface Agent3Output {
  salesPerformance: {
    strengths: string[];
    weaknesses: string[];
    missedOpportunities: string[];
  };
  recommendedActions: Array<{
    action: string;
    priority: "High" | "Medium" | "Low";
    rationale: string;
  }>;
  competitivePositioning?: {
    advantages: string[];
    vulnerabilities: string[];
  };
}

/**
 * Agent 4: Summary Agent
 * Customer-oriented meeting summary
 */
export interface Agent4Output {
  executiveSummary: string; // 2-3 sentences
  keyFindings: string[]; // 3-5 most important insights
  nextSteps: Array<{
    action: string;
    owner?: string;
    deadline?: string;
  }>;
  hookPoint?: string; // Customer's strongest interest
}

/**
 * Agent 5: CRM Extractor
 * Structured data for CRM/Salesforce integration
 */
export interface Agent5Output {
  leadData: {
    companyName?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    industry?: string;
    companySize?: string;
  };
  opportunityData: {
    dealValue?: number;
    expectedCloseDate?: string;
    probability?: number;
    stage: string;
  };
  customFields: Record<string, unknown>;
}

/**
 * Agent 6: Coach Agent
 * Real-time coaching and alerts
 */
export interface Agent6Output {
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
  suggestedTalkTracks: string[];
  managerAlert?: boolean; // True if 3+ consecutive low scores
}

// ============================================================
// Analysis State (Orchestrator)
// ============================================================

export interface AnalysisMetadata {
  leadId: string;
  conversationId?: string;
  salesRep: string;
  conversationDate: Date;
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
  nextSteps: Agent4Output["nextSteps"];

  // Risk assessment
  risks: Array<{
    risk: string;
    severity: string;
    mitigation?: string;
  }>;

  // Coaching
  coachingNotes: string;
  alerts: Agent6Output["alerts"];

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
