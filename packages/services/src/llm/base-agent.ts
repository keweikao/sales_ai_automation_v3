/**
 * Base Agent Interface & Registry Types
 * Hybrid Registry + DAG架構的核心型別定義
 */

import type { AnalysisState } from "./types.js";

// ============================================================
// Base Agent Interface
// ============================================================

/**
 * Base Agent Interface
 * 所有 Multi-Agent Orchestrator 中的 Agent 都必須實作此介面
 */
export interface BaseAgent {
  /** Agent 唯一識別碼 (例如: "context", "buyer", "seller") */
  readonly id: string;

  /** Agent 功能描述 (用於日誌與除錯) */
  readonly description: string;

  /**
   * 執行 Agent 的核心邏輯
   * @param state - 目前的分析狀態 (包含 transcript 與其他 Agent 的結果)
   * @returns 更新後的 AnalysisState
   */
  execute(state: AnalysisState): Promise<AnalysisState>;
}

// ============================================================
// Agent Dependency & Registration
// ============================================================

/**
 * Agent 依賴定義
 * 用於建立 DAG (Directed Acyclic Graph)
 */
export interface AgentDependency {
  /** 依賴的 Agent ID */
  agentId: string;

  /**
   * 可選的條件函數
   * 當此函數返回 false 時,即使 Agent 已註冊,依賴關係也不會被建立
   * 例如: 只有在偵測到競品時才依賴 CompetitorAgent
   */
  condition?: (state: AnalysisState) => boolean;
}

/**
 * 已註冊的 Agent
 * 包含 Agent 本體、依賴關係、適用條件與優先級
 */
export interface RegisteredAgent {
  /** Agent 唯一識別碼 */
  id: string;

  /** Agent 實例 */
  agent: BaseAgent;

  /**
   * 此 Agent 依賴的其他 Agents
   * 空陣列表示無依賴 (例如 Context Agent)
   */
  dependencies: AgentDependency[];

  /**
   * 條件函數決定此 Agent 是否應該執行
   * 例如: Competitor Agent 只在 state.hasCompetitor === true 時執行
   * @returns true 表示應該執行,false 表示跳過
   */
  isApplicable: (state: AnalysisState) => boolean;

  /**
   * 優先級 (數字越小越優先)
   * 用於在同一 level 的 Agent 中決定執行順序
   * 通常: Context=1, Buyer=2, Seller=3, ...
   */
  priority: number;
}

// ============================================================
// Execution Results
// ============================================================

/**
 * Agent 執行結果
 * 用於追蹤每個 Agent 的執行狀態與效能指標
 */
export interface AgentExecutionResult {
  /** Agent ID */
  agentId: string;

  /** 是否成功執行 */
  success: boolean;

  /** 執行時間 (毫秒) */
  executionTimeMs: number;

  /** 執行後的 State (成功時) */
  state?: AnalysisState;

  /** 錯誤訊息 (失敗時) */
  error?: string;

  /** 錯誤堆疊 (失敗時) */
  errorStack?: string;
}

/**
 * 批次執行結果
 * 包含整體執行指標
 */
export interface BatchExecutionResult {
  /** 所有 Agent 的執行結果 */
  results: AgentExecutionResult[];

  /** 總執行時間 (毫秒) */
  totalTimeMs: number;

  /** 成功執行的 Agent 數量 */
  successCount: number;

  /** 失敗的 Agent 數量 */
  failureCount: number;

  /** 跳過執行的 Agent 數量 (isApplicable === false) */
  skippedCount: number;

  /** 並行化比例 (實際並行執行 / 理論序列執行) */
  parallelizationRatio: number;

  /** 最終 State */
  finalState: AnalysisState;

  /** 執行的 Agent ID 列表 (依執行順序) */
  executionOrder: string[];
}

// ============================================================
// Error Types
// ============================================================

/**
 * Agent 執行錯誤
 */
export class AgentExecutionError extends Error {
  constructor(
    public readonly agentId: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(`[${agentId}] ${message}`);
    this.name = "AgentExecutionError";
  }
}

/**
 * Agent 註冊錯誤
 */
export class AgentRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRegistrationError";
  }
}

/**
 * DAG 循環依賴錯誤
 */
export class CyclicDependencyError extends Error {
  constructor(
    public readonly cycle: string[]
  ) {
    super(`Cyclic dependency detected: ${cycle.join(" -> ")}`);
    this.name = "CyclicDependencyError";
  }
}
