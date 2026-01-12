/**
 * Sales Coach Agent Type Definitions
 * 銷售教練 Agent 型別定義
 */

import type {
  CustomerType,
  TalkTrackSituation,
} from "@Sales_ai_automation_v3/db/schema";
import type {
  MeddicDimensions,
  MeddicScores,
  TranscriptSegment,
} from "../llm/types.js";

// ============================================================
// Core Input/Output Types
// ============================================================

/**
 * Conversation metadata for analysis
 */
export interface ConversationMetadata {
  opportunityId: string;
  conversationType:
    | "discovery_call"
    | "demo"
    | "follow_up"
    | "negotiation"
    | "closing";
  storeName?: string;
  storeType?: string;
  conversationDate: Date;
  duration?: number;
  participantCount?: number;
}

/**
 * Input for Sales Coach Agent
 */
export interface SalesCoachInput {
  conversationId: string;
  transcript: TranscriptSegment[];
  metadata: ConversationMetadata;
  repId: string;
}

/**
 * MEDDIC Analysis Result
 */
export interface MeddicAnalysis {
  scores: MeddicScores;
  overallScore: number;
  qualificationStatus: "Strong" | "Medium" | "Weak" | "At Risk";
  dimensions: MeddicDimensions;
  gaps: string[];
  strengths: string[];
}

/**
 * Recommendation for sales rep
 */
export interface Recommendation {
  id: string;
  type: "immediate_action" | "follow_up" | "strategy" | "skill_improvement";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  rationale: string;
  suggestedTiming?: string;
}

/**
 * Talk track suggestion
 */
export interface TalkTrack {
  id: string;
  situation: TalkTrackSituation;
  content: string;
  context: string;
  successRate: number;
  relevanceScore: number;
}

/**
 * Alert for manager or rep
 */
export interface Alert {
  id: string;
  type:
    | "close_now"
    | "missing_decision_maker"
    | "risk"
    | "opportunity"
    | "excellent_performance";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  suggestedAction?: string;
  notifyManager: boolean;
}

/**
 * Follow-up action item
 */
export interface FollowUp {
  id: string;
  action: string;
  owner: "rep" | "customer" | "manager";
  deadline?: Date;
  priority: "high" | "medium" | "low";
  status: "pending" | "completed" | "overdue";
  context?: string;
}

/**
 * Output from Sales Coach Agent
 */
export interface SalesCoachOutput {
  analysis: MeddicAnalysis;
  recommendations: Recommendation[];
  talkTracks: TalkTrack[];
  alerts: Alert[];
  followUps: FollowUp[];
  summary: CoachingSummary;
  processedAt: Date;
}

/**
 * Coaching summary
 */
export interface CoachingSummary {
  executiveSummary: string;
  keyWins: string[];
  areasForImprovement: string[];
  nextBestActions: string[];
  customerSentiment: "positive" | "neutral" | "negative";
  dealHealth: "healthy" | "at_risk" | "critical";
}

// ============================================================
// Agent Configuration Types
// ============================================================

/**
 * Agent configuration options
 */
export interface SalesCoachAgentConfig {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Maximum number of recommendations to return */
  maxRecommendations?: number;
  /** Maximum number of talk tracks to return */
  maxTalkTracks?: number;
  /** Minimum MEDDIC score threshold for alerts */
  alertThreshold?: number;
  /** Enable manager notifications for critical alerts */
  enableManagerNotifications?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_AGENT_CONFIG: Required<SalesCoachAgentConfig> = {
  verbose: false,
  maxRecommendations: 5,
  maxTalkTracks: 3,
  alertThreshold: 40,
  enableManagerNotifications: true,
};

// ============================================================
// Scenario Types
// ============================================================

/**
 * Scenario context for specialized coaching
 */
export interface ScenarioContext {
  scenarioType: ScenarioType;
  specificConcerns?: string[];
  customerType?: CustomerType;
  competitorMentioned?: boolean;
  priceDiscussed?: boolean;
  decisionMakerPresent?: boolean;
}

/**
 * Available scenario types
 */
export type ScenarioType =
  | "post_demo"
  | "price_negotiation"
  | "competitor_handling"
  | "decision_maker_engagement"
  | "closing_attempt"
  | "objection_handling"
  | "follow_up_coaching";

/**
 * Scenario handler interface
 */
export interface ScenarioHandler {
  type: ScenarioType;
  name: string;
  description: string;
  detect(input: SalesCoachInput): boolean;
  enhance(output: SalesCoachOutput, context: ScenarioContext): SalesCoachOutput;
}

// ============================================================
// Tool Integration Types
// ============================================================

/**
 * MCP Tool result wrapper
 */
export interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
}

/**
 * Available tools for the agent
 */
export interface AgentTools {
  querySimilarCases: (input: {
    customerType: CustomerType;
    concern: string;
    storeType?: string;
  }) => Promise<ToolResult<SimilarCasesResult>>;
  getTalkTracks: (input: {
    situation: TalkTrackSituation;
    customerType?: CustomerType;
  }) => Promise<ToolResult<TalkTracksResult>>;
}

/**
 * Similar cases query result
 */
export interface SimilarCasesResult {
  cases: Array<{
    conversationId: string;
    storeName: string;
    outcome: "won" | "lost";
    meddicScore: number;
    keyInsight: string;
    winningTactic: string;
  }>;
  avgFollowUps: number;
  successRate: number;
}

/**
 * Talk tracks query result
 */
export interface TalkTracksResult {
  talkTracks: Array<{
    id: string;
    content: string;
    context: string;
    successRate: number;
    usageCount: number;
  }>;
  bestPractice: string;
}

// ============================================================
// Event Types (for logging and analytics)
// ============================================================

/**
 * Agent execution event
 */
export interface AgentEvent {
  eventType:
    | "started"
    | "tool_called"
    | "analysis_complete"
    | "error"
    | "completed";
  timestamp: Date;
  conversationId: string;
  repId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Performance metrics
 */
export interface AgentMetrics {
  totalExecutionTime: number;
  llmCallCount: number;
  toolCallCount: number;
  tokensUsed?: number;
  cacheHits?: number;
}

// ============================================================
// Agent Core Types (for index.ts exports)
// ============================================================

/**
 * Agent configuration
 */
export interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  verbose?: boolean;
}

/**
 * Agent context for execution
 */
export interface AgentContext {
  conversationId: string;
  opportunityId: string;
  repId: string;
  customData?: Record<string, unknown>;
}

/**
 * Agent message structure
 */
export interface AgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: Date;
}

/**
 * Agent response
 */
export interface AgentResponse {
  success: boolean;
  message: string;
  data?: unknown;
  metrics?: AgentMetrics;
}

/**
 * Tool call request
 */
export interface AgentToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

/**
 * Tool call result
 */
export interface AgentToolResult {
  callId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Coaching advice item
 */
export interface CoachingAdvice {
  type: "tip" | "warning" | "action";
  message: string;
  priority: "high" | "medium" | "low";
}

/**
 * Conversation history for context
 */
export interface ConversationHistory {
  messages: ConversationMessage[];
  totalMessages: number;
}

/**
 * Single conversation message
 */
export interface ConversationMessage {
  role: "rep" | "customer";
  content: string;
  timestamp: Date;
}

/**
 * MEDDIC context for agent
 */
export interface MeddicContext {
  scores: MeddicScores;
  overallScore: number;
  status: string;
  gaps: string[];
}

/**
 * Opportunity context
 */
export interface OpportunityContext {
  id: string;
  companyName: string;
  stage: string;
  value?: number;
  expectedCloseDate?: Date;
}

/**
 * Rep context
 */
export interface RepContext {
  id: string;
  name: string;
  team?: string;
  skills?: string[];
}

/**
 * Tool definition for agent
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
