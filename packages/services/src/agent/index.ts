/**
 * AI Agent Module Index
 * 匯出 AI 教練相關的類型、工具和場景
 */

// ============================================================
// Sales Coach Agent
// ============================================================

export {
  createSalesCoachAgent,
  SalesCoachAgent,
} from "./sales-coach-agent.js";

// ============================================================
// Tool Executor
// ============================================================

export type {
  BatchExecutionOptions,
  ExecutionStats,
  ToolExecutorOptions,
} from "./tool-executor.js";
export { createToolExecutor, ToolExecutor } from "./tool-executor.js";

// ============================================================
// Result Parser
// ============================================================

export type { ParseResult, ParserOptions } from "./result-parser.js";
export { createResultParser, ResultParser } from "./result-parser.js";

// ============================================================
// Types
// ============================================================

export type {
  AgentConfig,
  AgentContext,
  AgentMessage,
  AgentResponse,
  AgentToolCall,
  AgentToolResult,
  CoachingAdvice,
  ConversationHistory,
  ConversationMessage,
  MeddicContext,
  OpportunityContext,
  RepContext,
  ToolDefinition,
} from "./types.js";

// ============================================================
// Scenarios
// ============================================================

export * from "./scenarios/index.js";
