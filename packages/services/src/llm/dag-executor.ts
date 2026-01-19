/**
 * DAG Executor
 * 使用拓撲排序 (Kahn's Algorithm) 自動計算執行順序並並行化執行
 */

import { randomUUID } from "node:crypto";
import type { AgentRegistry } from "./agent-registry.js";
import type {
  AgentExecutionResult,
  BatchExecutionResult,
  RegisteredAgent,
} from "./base-agent.js";
import { CyclicDependencyError } from "./base-agent.js";
import type { AnalysisState } from "./types.js";

// ============================================================
// DAG Executor Class
// ============================================================

/**
 * DAG Executor
 * 根據依賴關係自動計算執行順序,並將無依賴關係的 Agents 並行執行
 */
export class DAGExecutor {
  private readonly enableLogging: boolean;
  private readonly executionId: string;

  constructor(options: { enableLogging?: boolean } = {}) {
    this.enableLogging = options.enableLogging ?? false;
    this.executionId = randomUUID().slice(0, 8);
  }

  // ============================================================
  // Main Execution Methods
  // ============================================================

  /**
   * 執行 Registry 中所有適用的 Agents
   * @param registry - Agent Registry
   * @param initialState - 初始 AnalysisState
   * @returns BatchExecutionResult
   */
  async execute(
    registry: AgentRegistry,
    initialState: AnalysisState
  ): Promise<BatchExecutionResult> {
    const startTime = Date.now();

    // 1. 取得適用的 Agents
    const availableAgents = registry.getAvailableAgents(initialState);

    if (availableAgents.length === 0) {
      return this.createEmptyResult(initialState, startTime);
    }

    // 2. 建立依賴圖
    const dependencyGraph = registry.getDependencyGraph(initialState);

    // 3. 拓撲排序 + 分組
    const parallelGroups = this.groupByLevel(availableAgents, dependencyGraph);

    if (this.enableLogging) {
      this.logExecutionPlan(parallelGroups);
    }

    // 4. 逐層並行執行
    let currentState = initialState;
    const results: AgentExecutionResult[] = [];
    const executionOrder: string[] = [];

    for (const [level, group] of parallelGroups.entries()) {
      if (this.enableLogging) {
        console.log(
          `[DAGExecutor:${this.executionId}] Executing level ${level}: ${group.map((a) => a.id).join(", ")}`
        );
      }

      // 並行執行同一 level 的所有 Agents
      const groupResults = await this.executeGroup(group, currentState);

      results.push(...groupResults);

      // 合併所有成功執行的 Agent 的 state (修復並行執行時 state 覆蓋問題)
      for (const result of groupResults) {
        executionOrder.push(result.agentId);

        if (result.success && result.state) {
          // 合併 state 而不是覆蓋,保留所有 agent 的輸出
          currentState = {
            ...currentState,
            ...result.state,
          };
        }
      }
    }

    const totalTimeMs = Date.now() - startTime;

    return this.createBatchResult(
      results,
      currentState,
      executionOrder,
      totalTimeMs,
      availableAgents.length,
      registry.size
    );
  }

  // ============================================================
  // Group Execution
  // ============================================================

  /**
   * 並行執行一組 Agents
   * @param agents - 同一 level 的 Agents
   * @param state - 目前的 AnalysisState
   * @returns AgentExecutionResult 陣列
   */
  private async executeGroup(
    agents: RegisteredAgent[],
    state: AnalysisState
  ): Promise<AgentExecutionResult[]> {
    const promises = agents.map((agent) => this.executeAgent(agent, state));

    return Promise.all(promises);
  }

  /**
   * 執行單一 Agent
   * @param agent - RegisteredAgent
   * @param state - 目前的 AnalysisState
   * @returns AgentExecutionResult
   */
  private async executeAgent(
    agent: RegisteredAgent,
    state: AnalysisState
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      if (this.enableLogging) {
        console.log(
          `[DAGExecutor:${this.executionId}] Executing agent: ${agent.id}`
        );
      }

      const updatedState = await agent.agent.execute(state);

      const executionTimeMs = Date.now() - startTime;

      if (this.enableLogging) {
        console.log(
          `[DAGExecutor:${this.executionId}] Agent "${agent.id}" completed in ${executionTimeMs}ms`
        );
      }

      return {
        agentId: agent.id,
        success: true,
        executionTimeMs,
        state: updatedState,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      if (this.enableLogging) {
        console.error(
          `[DAGExecutor:${this.executionId}] Agent "${agent.id}" failed: ${errorMessage}`
        );
      }

      return {
        agentId: agent.id,
        success: false,
        executionTimeMs,
        error: errorMessage,
        errorStack,
      };
    }
  }

  // ============================================================
  // Topological Sort & Grouping
  // ============================================================

  /**
   * 使用 Kahn's Algorithm 進行拓撲排序,並依照深度分組
   * @param agents - 要排序的 Agents
   * @param dependencyGraph - 依賴關係圖
   * @returns Map<level, RegisteredAgent[]>
   */
  private groupByLevel(
    agents: RegisteredAgent[],
    dependencyGraph: Map<string, string[]>
  ): Map<number, RegisteredAgent[]> {
    // 建立 Agent ID -> Agent 的映射
    const agentMap = new Map<string, RegisteredAgent>();
    for (const agent of agents) {
      agentMap.set(agent.id, agent);
    }

    // 計算每個 Agent 的 in-degree (被依賴數)
    const inDegree = new Map<string, number>();
    for (const agent of agents) {
      inDegree.set(agent.id, 0);
    }

    for (const [agentId, deps] of dependencyGraph) {
      if (!agentMap.has(agentId)) {
        continue; // 跳過不適用的 Agents
      }

      for (const depId of deps) {
        if (!agentMap.has(depId)) {
          continue; // 跳過不適用的依賴
        }
        inDegree.set(agentId, (inDegree.get(agentId) || 0) + 1);
      }
    }

    // Kahn's Algorithm + Level Grouping
    const groups = new Map<number, RegisteredAgent[]>();
    let currentLevel = 0;

    // 初始化 queue 為 in-degree = 0 的 Agents
    let queue: RegisteredAgent[] = [];
    for (const agent of agents) {
      if (inDegree.get(agent.id) === 0) {
        queue.push(agent);
      }
    }

    // 依 priority 排序
    queue.sort((a, b) => a.priority - b.priority);

    while (queue.length > 0) {
      // 將目前 level 的所有 Agents 加入 groups
      groups.set(currentLevel, [...queue]);

      const nextQueue: RegisteredAgent[] = [];

      // 處理目前 level 的每個 Agent
      for (const agent of queue) {
        // 取得反向依賴 (依賴此 Agent 的其他 Agents)
        const reverseDeps = this.getReverseDeps(
          agent.id,
          dependencyGraph,
          agentMap
        );

        for (const depAgentId of reverseDeps) {
          const currentInDegree = inDegree.get(depAgentId) || 0;
          const newInDegree = currentInDegree - 1;
          inDegree.set(depAgentId, newInDegree);

          // 如果 in-degree 變為 0,加入下一個 level
          if (newInDegree === 0) {
            const depAgent = agentMap.get(depAgentId);
            if (depAgent) {
              nextQueue.push(depAgent);
            }
          }
        }
      }

      // 依 priority 排序
      nextQueue.sort((a, b) => a.priority - b.priority);

      queue = nextQueue;
      currentLevel++;
    }

    // 檢查是否所有 Agents 都被處理 (偵測循環依賴)
    const processedCount = Array.from(groups.values()).reduce(
      (sum, group) => sum + group.length,
      0
    );

    if (processedCount < agents.length) {
      throw new CyclicDependencyError(["Unable to resolve all dependencies"]);
    }

    return groups;
  }

  /**
   * 取得反向依賴 (依賴指定 Agent 的其他 Agents)
   * @param agentId - Agent ID
   * @param dependencyGraph - 依賴關係圖
   * @param agentMap - Agent ID -> Agent 映射
   * @returns 依賴此 Agent 的 Agent ID 陣列
   */
  private getReverseDeps(
    agentId: string,
    dependencyGraph: Map<string, string[]>,
    agentMap: Map<string, RegisteredAgent>
  ): string[] {
    const reverseDeps: string[] = [];

    for (const [id, deps] of dependencyGraph) {
      if (!agentMap.has(id)) {
        continue; // 跳過不適用的 Agents
      }

      if (deps.includes(agentId)) {
        reverseDeps.push(id);
      }
    }

    return reverseDeps;
  }

  // ============================================================
  // Result Creation
  // ============================================================

  /**
   * 建立空結果 (當無適用的 Agents 時)
   */
  private createEmptyResult(
    state: AnalysisState,
    startTime: number
  ): BatchExecutionResult {
    return {
      results: [],
      totalTimeMs: Date.now() - startTime,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      parallelizationRatio: 1.0,
      finalState: state,
      executionOrder: [],
    };
  }

  /**
   * 建立批次執行結果
   */
  private createBatchResult(
    results: AgentExecutionResult[],
    finalState: AnalysisState,
    executionOrder: string[],
    totalTimeMs: number,
    availableCount: number,
    totalCount: number
  ): BatchExecutionResult {
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const skippedCount = totalCount - availableCount;

    // 計算並行化比例
    const totalAgentTime = results.reduce(
      (sum, r) => sum + r.executionTimeMs,
      0
    );
    const parallelizationRatio =
      totalTimeMs > 0 ? totalAgentTime / totalTimeMs : 1.0;

    if (this.enableLogging) {
      console.log(
        `[DAGExecutor:${this.executionId}] Execution completed in ${totalTimeMs}ms`
      );
      console.log(
        `  - Success: ${successCount}, Failure: ${failureCount}, Skipped: ${skippedCount}`
      );
      console.log(
        `  - Parallelization ratio: ${parallelizationRatio.toFixed(2)}x`
      );
    }

    return {
      results,
      totalTimeMs,
      successCount,
      failureCount,
      skippedCount,
      parallelizationRatio,
      finalState,
      executionOrder,
    };
  }

  // ============================================================
  // Logging Utilities
  // ============================================================

  /**
   * 輸出執行計劃日誌
   */
  private logExecutionPlan(groups: Map<number, RegisteredAgent[]>): void {
    console.log(`[DAGExecutor:${this.executionId}] Execution Plan:`);

    for (const [level, agents] of groups) {
      const agentNames = agents.map((a) => a.id).join(", ");
      const parallel = agents.length > 1 ? " (parallel)" : "";
      console.log(`  Level ${level}: [${agentNames}]${parallel}`);
    }
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 建立 DAG Executor 實例
 * @param options - 建立選項
 * @returns DAGExecutor 實例
 */
export function createDAGExecutor(
  options: { enableLogging?: boolean } = {}
): DAGExecutor {
  return new DAGExecutor(options);
}
