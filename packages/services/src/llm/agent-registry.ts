/**
 * Agent Registry
 * 管理 Agent 的註冊、發現與依賴關係
 */

import type { AnalysisState } from "./types.js";
import type { RegisteredAgent } from "./base-agent.js";
import {
  AgentRegistrationError,
  CyclicDependencyError,
} from "./base-agent.js";

// ============================================================
// Agent Registry Class
// ============================================================

/**
 * Agent Registry
 * 提供 Agent 的註冊、取消註冊、查詢與依賴驗證功能
 */
export class AgentRegistry {
  private readonly agents: Map<string, RegisteredAgent>;
  private readonly enableLogging: boolean;

  constructor(options: { enableLogging?: boolean } = {}) {
    this.agents = new Map();
    this.enableLogging = options.enableLogging ?? false;
  }

  // ============================================================
  // Registration Methods
  // ============================================================

  /**
   * 註冊一個 Agent
   * @param agent - 要註冊的 Agent
   * @throws AgentRegistrationError 如果 Agent ID 已存在
   * @throws CyclicDependencyError 如果註冊後產生循環依賴
   */
  register(agent: RegisteredAgent): void {
    // 檢查重複註冊
    if (this.agents.has(agent.id)) {
      throw new AgentRegistrationError(
        `Agent "${agent.id}" is already registered`
      );
    }

    // 暫時註冊以便驗證循環依賴
    this.agents.set(agent.id, agent);

    try {
      // 驗證是否產生循環依賴
      this.validateNoCycles();

      if (this.enableLogging) {
        console.log(
          `[AgentRegistry] Registered agent: ${agent.id} (priority: ${agent.priority})`
        );
      }
    } catch (error) {
      // 驗證失敗,移除剛才的註冊
      this.agents.delete(agent.id);
      throw error;
    }
  }

  /**
   * 批次註冊多個 Agents
   * @param agents - 要註冊的 Agents 陣列
   */
  registerAll(agents: RegisteredAgent[]): void {
    for (const agent of agents) {
      this.register(agent);
    }
  }

  /**
   * 取消註冊一個 Agent
   * @param id - Agent ID
   * @returns 是否成功取消 (false 表示 Agent 不存在)
   */
  unregister(id: string): boolean {
    const result = this.agents.delete(id);

    if (result && this.enableLogging) {
      console.log(`[AgentRegistry] Unregistered agent: ${id}`);
    }

    return result;
  }

  /**
   * 清除所有已註冊的 Agents
   */
  clear(): void {
    this.agents.clear();

    if (this.enableLogging) {
      console.log("[AgentRegistry] All agents cleared");
    }
  }

  // ============================================================
  // Query Methods
  // ============================================================

  /**
   * 取得特定 Agent
   * @param id - Agent ID
   * @returns RegisteredAgent 或 undefined
   */
  get(id: string): RegisteredAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * 檢查 Agent 是否存在
   * @param id - Agent ID
   * @returns 是否存在
   */
  has(id: string): boolean {
    return this.agents.has(id);
  }

  /**
   * 取得所有已註冊的 Agent IDs
   * @returns Agent ID 陣列
   */
  getAllIds(): string[] {
    return [...this.agents.keys()];
  }

  /**
   * 取得所有已註冊的 Agents
   * @returns RegisteredAgent 陣列
   */
  getAll(): RegisteredAgent[] {
    return [...this.agents.values()];
  }

  /**
   * 根據 isApplicable 條件篩選適用的 Agents
   * @param state - 目前的 AnalysisState
   * @returns 適用的 RegisteredAgent 陣列
   */
  getAvailableAgents(state: AnalysisState): RegisteredAgent[] {
    const available: RegisteredAgent[] = [];

    for (const agent of this.agents.values()) {
      if (agent.isApplicable(state)) {
        available.push(agent);
      } else if (this.enableLogging) {
        console.log(`[AgentRegistry] Agent "${agent.id}" skipped (not applicable)`);
      }
    }

    return available;
  }

  /**
   * 取得已註冊的 Agent 數量
   */
  get size(): number {
    return this.agents.size;
  }

  // ============================================================
  // Dependency Graph Methods
  // ============================================================

  /**
   * 建立依賴關係圖 (Adjacency List 表示)
   * @param state - 目前的 AnalysisState (用於評估條件依賴)
   * @returns Map<agentId, dependsOn[]>
   */
  getDependencyGraph(
    state: AnalysisState
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const agent of this.agents.values()) {
      const dependencies: string[] = [];

      for (const dep of agent.dependencies) {
        // 檢查依賴的 Agent 是否存在
        if (!this.agents.has(dep.agentId)) {
          throw new AgentRegistrationError(
            `Agent "${agent.id}" depends on "${dep.agentId}", but it is not registered`
          );
        }

        // 評估條件依賴
        if (dep.condition) {
          if (dep.condition(state)) {
            dependencies.push(dep.agentId);
          }
        } else {
          // 無條件依賴,直接加入
          dependencies.push(dep.agentId);
        }
      }

      graph.set(agent.id, dependencies);
    }

    return graph;
  }

  /**
   * 取得指定 Agent 的直接依賴 (不考慮條件)
   * @param agentId - Agent ID
   * @returns 依賴的 Agent ID 陣列
   */
  getDirectDependencies(agentId: string): string[] {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return [];
    }

    return agent.dependencies.map((dep) => dep.agentId);
  }

  /**
   * 取得依賴於指定 Agent 的所有 Agents (反向依賴)
   * @param agentId - Agent ID
   * @returns 依賴此 Agent 的 Agent ID 陣列
   */
  getReverseDependencies(agentId: string): string[] {
    const reverseDeps: string[] = [];

    for (const [id, agent] of this.agents) {
      if (agent.dependencies.some((dep) => dep.agentId === agentId)) {
        reverseDeps.push(id);
      }
    }

    return reverseDeps;
  }

  // ============================================================
  // Validation Methods
  // ============================================================

  /**
   * 驗證依賴圖中是否存在循環依賴
   * 使用 DFS (Depth-First Search) 偵測循環
   * @throws CyclicDependencyError 如果偵測到循環
   */
  validateNoCycles(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (agentId: string): void => {
      visited.add(agentId);
      recursionStack.add(agentId);
      path.push(agentId);

      const agent = this.agents.get(agentId);
      if (!agent) {
        return;
      }

      for (const dep of agent.dependencies) {
        const depId = dep.agentId;

        if (!visited.has(depId)) {
          dfs(depId);
        } else if (recursionStack.has(depId)) {
          // 偵測到循環
          const cycleStartIndex = path.indexOf(depId);
          const cycle = [...path.slice(cycleStartIndex), depId];
          throw new CyclicDependencyError(cycle);
        }
      }

      recursionStack.delete(agentId);
      path.pop();
    };

    for (const agentId of this.agents.keys()) {
      if (!visited.has(agentId)) {
        dfs(agentId);
      }
    }
  }

  /**
   * 驗證所有依賴的 Agents 都已註冊
   * @throws AgentRegistrationError 如果有缺失的依賴
   */
  validateDependencies(): void {
    for (const agent of this.agents.values()) {
      for (const dep of agent.dependencies) {
        if (!this.agents.has(dep.agentId)) {
          throw new AgentRegistrationError(
            `Agent "${agent.id}" depends on "${dep.agentId}", but it is not registered`
          );
        }
      }
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * 產生 Mermaid 格式的依賴圖 (用於文件與可視化)
   * @returns Mermaid 圖表字串
   */
  generateMermaidDiagram(): string {
    let mermaid = "graph TD\n";

    for (const agent of this.agents.values()) {
      // 節點定義
      mermaid += `  ${agent.id}["${agent.id} (P${agent.priority})"]\n`;

      // 依賴關係
      for (const dep of agent.dependencies) {
        const label = dep.condition ? "conditional" : "";
        mermaid += `  ${dep.agentId} -->|${label}| ${agent.id}\n`;
      }
    }

    return mermaid;
  }

  /**
   * 產生 Registry 狀態摘要 (用於除錯)
   * @returns 狀態摘要字串
   */
  getSummary(): string {
    const lines = [
      `=== Agent Registry Summary ===`,
      `Total agents: ${this.agents.size}`,
      ``,
      `Registered agents:`,
    ];

    const sortedAgents = [...this.agents.values()].sort(
      (a, b) => a.priority - b.priority
    );

    for (const agent of sortedAgents) {
      const depsStr =
        agent.dependencies.length > 0
          ? agent.dependencies.map((d) => d.agentId).join(", ")
          : "none";

      lines.push(
        `  - ${agent.id} (priority: ${agent.priority}, deps: ${depsStr})`
      );
    }

    return lines.join("\n");
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 建立 Agent Registry 實例
 * @param options - 建立選項
 * @returns AgentRegistry 實例
 */
export function createAgentRegistry(options: {
  enableLogging?: boolean;
} = {}): AgentRegistry {
  return new AgentRegistry(options);
}
