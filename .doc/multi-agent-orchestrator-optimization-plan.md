# Sales AI Automation V3 - Agent 系統優化計劃

> 包含 Sales Coach Agent 修復驗證 + Multi-Agent Orchestrator Agent 化優化方案

---

## ✅ 第一階段: Sales Coach Agent TypeScript 錯誤修復 (已完成)

### 修復內容

**1. 新增缺失依賴** - [packages/services/package.json](packages/services/package.json)
- 新增 `"zod-to-json-schema": "^3.23.0"`

**2. 修復 nanoid 錯誤** (22 處替換)
- [packages/services/src/agent/sales-coach-agent.ts](packages/services/src/agent/sales-coach-agent.ts) - 4 處
- [packages/services/src/agent/scenarios/post-demo-coach.ts](packages/services/src/agent/scenarios/post-demo-coach.ts) - 18 處
- 將 `nanoid(8)` 替換為 `randomUUID().slice(0, 8)`

**3. 重新啟用模組** - [packages/services/tsconfig.json](packages/services/tsconfig.json)
- 移除 `src/agent/**/*` 和 `src/mcp/**/*` 從 exclude

**4. 恢復導出** - [packages/services/src/index.ts](packages/services/src/index.ts)
- 取消註解 `export * from "./mcp/index.js"` 和 `export * from "./agent/index.js"`

### 驗證步驟

需要在 `packages/services` 目錄執行以下命令:

```bash
# 1. 安裝依賴
bun install

# 2. 型別檢查
bun run check-types

# 3. Linter 檢查
bun x ultracite check

# 4. 建置測試
bun run build

# 5. 開發伺服器測試
bun run dev
```

---

## 🎯 第二階段: Multi-Agent Orchestrator 優化方案分析

> 基於原有架構規劃的深入 Agent 化分析

## 當前架構 Agent 化程度: 3.5/10

### ✅ 已具備的 Agent 特性
- 6 個專門化 Agent (Context、Buyer、Seller、Summary、CRM、Coach)
- MCP Tools 整合能力
- LLM → Tool Enrichment → Scenario Enhancement 三階段流程
- Agent 間元資料傳遞 (AnalysisState)

### ❌ 缺乏的 Agent 特性
- 硬編碼流程控制 (七階段順序寫死)
- 無動態決策能力 (Agent 無法自主決定協作)
- 無事件驅動機制
- 無計劃-反思循環 (僅 Buyer Agent 有 Quality Loop)
- 無 Agent 註冊/發現機制
- 無依賴圖自動執行

---

## 🎯 方案 1: DAG-Based Dynamic Execution

**推薦指數**: ⭐⭐⭐⭐

**核心概念**: 將 Agent 依賴關係建模為有向無環圖 (DAG),自動計算執行順序

```typescript
interface AgentNode {
  id: string;
  agent: BaseAgent;
  dependencies: string[];
  condition?: (state) => boolean;
}

class DAGOrchestrator {
  async execute(state: AnalysisState) {
    const executionOrder = this.topologicalSort();
    const parallelGroups = this.groupByLevel(executionOrder);

    for (const group of parallelGroups) {
      await Promise.all(group.map(id => this.executeNode(id, state)));
    }
  }
}
```

**優勢**:
- 保留 V2 邏輯
- 新增 Agent 容易
- 自動並行化
- 可視化友好

**實作時間**: 3-5 天 | **V2 兼容性**: ✅ 高

---

## 🎯 方案 2: Event-Driven Architecture

**推薦指數**: ⭐⭐⭐

**核心概念**: Event Bus 讓 Agent 異步通訊,自主響應事件

```typescript
class AgentEventBus {
  emit(event: AgentEvent): void;
  subscribe(eventType: string, handler): void;
}
```

**優勢**:
- Agent 解耦
- 靈活擴展
- 支援異步
- 可追蹤性強

**實作時間**: 5-7 天 | **V2 兼容性**: ⚠️ 中

---

## 🎯 方案 3: Tool-Wrapped Agents

**推薦指數**: ⭐⭐⭐ (探索性)

**核心概念**: 將 Agent 包裝成 MCP Tool,Meta-Agent 用 LLM 決定調用

```typescript
function agentToTool(agent: BaseAgent): MCPTool {
  return {
    name: agent.id,
    handler: async (input, context) => agent.execute(input, context)
  };
}
```

**優勢**:
- 最大化自主性
- 統一介面
- 動態組合

**實作時間**: 4-6 天 | **V2 兼容性**: ⚠️ 中低

---

## 🎯 方案 4: Plan-Execute-Reflect

**推薦指數**: ⭐⭐⭐⭐

**核心概念**: Planner → Executor → Reflector 自我改進循環

```typescript
class PlannerAgent {
  async plan(transcript): Promise<AnalysisPlan> {
    return {
      steps: [
        { agent: "context", depends: [] },
        { agent: "buyer", depends: [] },
      ],
      qualityChecks: ["buyer_quality"]
    };
  }
}
```

**優勢**:
- 保留 Quality Loop
- 動態適應
- 自我改進
- 可解釋性強

**實作時間**: 5-8 天 | **V2 兼容性**: ✅ 高

---

## 🎯 方案 5: Hybrid Registry + DAG ⭐⭐⭐⭐⭐

**推薦指數**: ⭐⭐⭐⭐⭐ **(最推薦!)**

**核心概念**: Agent 註冊機制 + 條件依賴圖

```typescript
class AgentRegistry {
  private agents: Map<string, RegisteredAgent>;

  register(agent: RegisteredAgent): void;
  getAvailableAgents(state): RegisteredAgent[];
}

interface RegisteredAgent {
  id: string;
  agent: BaseAgent;
  dependencies: AgentDependency[];
  isApplicable: (state) => boolean;
  priority: number;
}
```

**註冊範例**:
```typescript
registry.register({
  id: "buyer",
  dependencies: [],
  isApplicable: () => true,
  priority: 1
});

registry.register({
  id: "competitor",
  dependencies: [
    { agentId: "context", condition: (s) => s.hasCompetitor }
  ],
  isApplicable: (s) => s.hasCompetitor,
  priority: 3
});
```

**優勢**:
- ✅ 100% 兼容 V2 邏輯
- ✅ 易於擴展
- ✅ 條件執行原生支援
- ✅ 實作複雜度可控
- ✅ 可視化友好

**實作時間**: 2-4 天 | **V2 兼容性**: ✅ 100%

---

## 📊 方案對比表

| 方案 | 時間 | V2兼容 | 擴展性 | 自主性 | 推薦 |
|------|-----|--------|-------|-------|------|
| DAG Dynamic | 3-5天 | ✅ 高 | 🌟🌟🌟🌟 | 🌟🌟 | ⭐⭐⭐⭐ |
| Event-Driven | 5-7天 | ⚠️ 中 | 🌟🌟🌟🌟🌟 | 🌟🌟🌟 | ⭐⭐⭐ |
| Tool-Wrapped | 4-6天 | ⚠️ 低 | 🌟🌟🌟🌟🌟 | 🌟🌟🌟🌟🌟 | ⭐⭐⭐ |
| Plan-Execute | 5-8天 | ✅ 高 | 🌟🌟🌟 | 🌟🌟🌟🌟 | ⭐⭐⭐⭐ |
| **Hybrid Registry** | **2-4天** | **✅ 100%** | **🌟🌟🌟🌟** | **🌟🌟** | **⭐⭐⭐⭐⭐** |

---

## 🚀 推薦實作路線圖

### 階段 1: 立即實作 (2-4 天) - 方案 5

**目標**: 建立 Agent Registry,100% 保留 V2 邏輯

**交付物**:
1. `AgentRegistry` 類別
2. `RegisteredAgent` 介面
3. 條件 DAG 執行器
4. 遷移 6 個 Agent 到 Registry
5. 單元測試

**修改檔案**:
- 新增: `packages/services/src/llm/agent-registry.ts`
- 新增: `packages/services/src/llm/base-agent.ts`
- 新增: `packages/services/src/llm/dag-executor.ts`
- 修改: `packages/services/src/llm/orchestrator.ts`

### 階段 2: 並行化優化 (同步)

**目標**: Agent 3+5、Agent 4+6 並行

**收益**: 43秒 → 25秒 (節省 42%)

### 階段 3: 增強 Quality Loop (1-2月後)

**目標**: Reflector Agent 擴展品質檢查

### 階段 4: 探索動態組合 (3-6月後)

**目標**: A/B 測試 Meta-Agent 模式

---

## 📚 參考資料

- [LangGraph Multi-Agent Orchestration](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/)
- [Microsoft Mixture of Agents](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/mixture-of-agents.html)
- [CrewAI Documentation](https://docs.crewai.com/)
- [Top 5 Agentic Frameworks 2026](https://research.aimultiple.com/agentic-frameworks/)

---

## 📋 詳細實作計劃: Hybrid Registry + DAG (推薦)

### Step 1: 建立核心介面與型別 (4-6 小時)

**新增檔案**: [packages/services/src/llm/base-agent.ts](packages/services/src/llm/base-agent.ts)

```typescript
import type { AnalysisState } from "./types.js";

export interface BaseAgent {
  readonly id: string;
  readonly description: string;
  execute(state: AnalysisState): Promise<AnalysisState>;
}

export interface AgentDependency {
  agentId: string;
  condition?: (state: AnalysisState) => boolean;
}

export interface RegisteredAgent {
  id: string;
  agent: BaseAgent;
  dependencies: AgentDependency[];
  isApplicable: (state: AnalysisState) => boolean;
  priority: number;
}

export interface AgentExecutionResult {
  agentId: string;
  success: boolean;
  executionTimeMs: number;
  error?: string;
}
```

### Step 2: 實作 Agent Registry (6-8 小時)

**新增檔案**: [packages/services/src/llm/agent-registry.ts](packages/services/src/llm/agent-registry.ts)

**核心功能**:
- `register(agent: RegisteredAgent)`: 註冊 Agent
- `unregister(id: string)`: 取消註冊
- `getAvailableAgents(state: AnalysisState)`: 根據 isApplicable 過濾
- `getDependencyGraph()`: 建立依賴關係圖
- `validateNoCycles()`: 檢測循環依賴

**錯誤處理**:
- 重複註冊錯誤
- 循環依賴錯誤
- 缺失依賴錯誤

### Step 3: 實作 DAG 執行器 (8-10 小時)

**新增檔案**: [packages/services/src/llm/dag-executor.ts](packages/services/src/llm/dag-executor.ts)

**核心演算法**:
```typescript
class DAGExecutor {
  async execute(
    registry: AgentRegistry,
    state: AnalysisState
  ): Promise<AgentExecutionResult[]> {
    // 1. 取得適用的 Agent
    const agents = registry.getAvailableAgents(state);

    // 2. 拓撲排序計算執行順序
    const executionOrder = this.topologicalSort(agents);

    // 3. 依照 level 分組 (同 level 可並行)
    const parallelGroups = this.groupByLevel(executionOrder);

    // 4. 逐層執行
    for (const group of parallelGroups) {
      await Promise.all(
        group.map(id => this.executeAgent(id, state))
      );
    }
  }

  private topologicalSort(agents: RegisteredAgent[]): string[] {
    // Kahn's Algorithm 實作
  }

  private groupByLevel(order: string[]): string[][] {
    // 依賴深度分組
  }
}
```

**並行化範例**:
```
原始順序執行 (V2):
  Context → Buyer → Seller → Summary → CRM → Quality → Coach
  (7 階段序列, 43-59 秒)

DAG 並行執行:
  Level 0: Context (3s)
  Level 1: Buyer, Seller (並行, 12s)
  Level 2: Summary (6s)
  Level 3: CRM, Quality (並行, 2s)
  Level 4: Coach (2s)

  總時間: 3 + 12 + 6 + 2 + 2 = 25 秒 ✅ (節省 42%)
```

### Step 4: 遷移現有 Orchestrator (4-6 小時)

**修改檔案**: [packages/services/src/llm/orchestrator.ts](packages/services/src/llm/orchestrator.ts)

**遷移策略**:
```typescript
// Before (V2 硬編碼)
async analyze(transcript: string) {
  let state = await this.contextAgent.execute(initialState);
  state = await this.buyerAgent.execute(state);
  state = await this.sellerAgent.execute(state);
  // ... 7 個階段
}

// After (Registry + DAG)
async analyze(transcript: string) {
  const registry = this.buildRegistry();
  const executor = new DAGExecutor();
  const results = await executor.execute(registry, initialState);
  return results;
}

private buildRegistry(): AgentRegistry {
  const registry = new AgentRegistry();

  // Agent 1: Context (無依賴, 最高優先度)
  registry.register({
    id: "context",
    agent: this.contextAgent,
    dependencies: [],
    isApplicable: () => true,
    priority: 1
  });

  // Agent 2: Buyer (依賴 Context)
  registry.register({
    id: "buyer",
    agent: this.buyerAgent,
    dependencies: [{ agentId: "context" }],
    isApplicable: () => true,
    priority: 2
  });

  // ... 註冊其餘 5 個 Agent
}
```

### Step 5: 單元測試 (6-8 小時)

**新增檔案**: `packages/services/src/llm/__tests__/`

**測試覆蓋**:
1. `agent-registry.test.ts`
   - 註冊/取消註冊
   - 循環依賴檢測
   - 條件過濾

2. `dag-executor.test.ts`
   - 拓撲排序正確性
   - 並行執行驗證
   - 錯誤處理

3. `orchestrator.test.ts`
   - E2E 整合測試
   - V2 邏輯兼容性驗證

### Step 6: 性能監控與日誌 (2-4 小時)

**新增功能**:
```typescript
interface ExecutionMetrics {
  totalTimeMs: number;
  agentResults: AgentExecutionResult[];
  parallelizationRatio: number; // 並行化比例
  qualityLoopCount: number;
}
```

**日誌格式**:
```
[DAGExecutor] Execution Plan:
  Level 0: [context] (3 agents)
  Level 1: [buyer, seller] (並行)
  Level 2: [summary]
  Level 3: [crm, quality] (並行)
  Level 4: [coach]

[DAGExecutor] Execution completed in 25.3s
  - Parallelization ratio: 2.1x
  - Quality loops: 1
```

---

## 🔄 V2 兼容性保證

**向後兼容策略**:
1. 保留原始 `orchestrator.analyze()` 方法簽名
2. 內部切換到 Registry + DAG 實作
3. 執行結果格式完全相同
4. 錯誤處理行為一致

**A/B 測試**:
```typescript
// 可透過環境變數切換
const USE_DAG_EXECUTOR = process.env.ENABLE_DAG_EXECUTOR === "true";

if (USE_DAG_EXECUTOR) {
  return this.dagExecutor.execute(registry, state);
}
return this.legacyExecute(state); // V2 原始邏輯
```

---

## 📊 預期收益

| 指標 | V2 (Before) | V3 (After) | 改善幅度 |
|-----|-------------|------------|---------|
| **平均執行時間** | 43 秒 | 25 秒 | ✅ -42% |
| **Quality Loop** | 59 秒 | 33 秒 | ✅ -44% |
| **Agent 化程度** | 3.5/10 | 7/10 | ✅ +100% |
| **擴展性** | 低 (硬編碼) | 高 (註冊制) | ✅ 質變 |
| **程式碼行數** | ~800 行 | ~1200 行 | ⚠️ +50% |
| **V2 兼容性** | - | 100% | ✅ 無破壞 |

---

## 🚦 風險評估

### 低風險 ✅
- TypeScript 型別安全
- 拓撲排序算法成熟
- 完整單元測試覆蓋

### 中風險 ⚠️
- 並行執行可能引發競態條件 (需確保 Agent 間無共享狀態)
- 日誌追蹤複雜度提升 (需要 Execution ID 追蹤)

### 緩解措施
1. Agent 間透過 `AnalysisState` 不可變更新 (Immutable Update)
2. 每次執行生成唯一 `executionId` 用於日誌追蹤
3. 保留 V2 邏輯作為 Fallback 選項

---

## ✅ 完成標準 (Definition of Done)

1. [ ] 所有新增檔案通過型別檢查
2. [ ] 單元測試覆蓋率 > 80%
3. [ ] E2E 測試與 V2 結果一致
4. [ ] 執行時間降低 > 30%
5. [ ] 日誌清晰可追蹤
6. [ ] 文件更新 (README, API Docs)
7. [ ] Code Review 通過
8. [ ] 在 Staging 環境驗證 7 天無異常

---

## 🚀 進階選項: 分析內容 Agent 化 (實驗性)

> **注意**: 此為進階特性,建議在完成基礎流程 Agent 化後再評估

### 概念: Sub-Agent 架構

將每個主 Agent (如 Buyer Agent) 內部的分析邏輯拆分為多個專精的 Sub-Agent:

```typescript
// Buyer Agent 內部結構
BuyerAgent
  ├── RoleIdentificationAgent    (識別買方角色)
  ├── PainPointAnalysisAgent      (分析痛點)
  ├── BudgetEstimationAgent       (預估預算)
  ├── DecisionMakerDetectionAgent (偵測決策者)
  └── MEDDICScoreCalculator       (MEDDIC 評分)
```

### 實作策略

**新增檔案**: [packages/services/src/llm/agents/buyer/sub-agents/](packages/services/src/llm/agents/buyer/sub-agents/)

```typescript
// packages/services/src/llm/agents/buyer/buyer-agent-v3.ts
export class BuyerAgentV3 implements BaseAgent {
  private subAgents: SubAgentRegistry;
  private planner: SubAgentPlanner;

  async execute(state: AnalysisState): Promise<AnalysisState> {
    // 1. 簡單案例快速路徑 (降低成本)
    if (this.isSimpleCase(state)) {
      return this.legacyExecute(state); // 1 次 LLM 調用
    }

    // 2. 複雜案例使用 Sub-Agent
    const plan = await this.planner.plan(state.transcript);
    const results = await this.executeSubAgents(plan, state);
    return this.synthesize(state, results);
  }

  private async executeSubAgents(plan: SubAgentPlan, state: AnalysisState) {
    const activeAgents = plan.agents.map(id => this.subAgents.get(id));

    // 依據依賴關係執行 (可能並行)
    return await this.executeDependencyGraph(activeAgents, state);
  }

  private isSimpleCase(state: AnalysisState): boolean {
    // 短對話、單一主題、明確痛點 → 使用快速路徑
    return state.transcript.length < 2000 &&
           state.topicCount === 1 &&
           state.hasExplicitPainPoints;
  }
}
```

### 優勢與成本

| 指標 | 快速路徑 | Sub-Agent 路徑 |
|-----|---------|---------------|
| **LLM 調用次數** | 1 次 | 5-8 次 |
| **執行時間** | 2-3 秒 | 6-10 秒 |
| **成本** | $0.002 | $0.01 |
| **適用場景** | 70% 簡單對話 | 30% 複雜對話 |
| **分析深度** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### 實作時間估算

- **Step 1**: Sub-Agent 基礎架構 (4-6 小時)
- **Step 2**: Buyer Agent Sub-Agent 實作 (12-16 小時)
- **Step 3**: Planner Agent 實作 (6-8 小時)
- **Step 4**: 快速路徑/Sub-Agent 路由邏輯 (4-6 小時)
- **Step 5**: A/B 測試框架 (8-10 小時)
- **Step 6**: 成本監控與優化 (6-8 小時)

**總計**: 40-54 小時 (5-7 天)

### 推薦實作順序

```
Phase 1: 流程 Agent 化 (立即)
  → Hybrid Registry + DAG
  → Agent 化程度: 3.5/10 → 7/10
  → 時間: 2-4 天

Phase 2: Buyer Agent 分析 Agent 化 (1-2 月後)
  → Sub-Agent 架構 + 快速路徑
  → Agent 化程度: 7/10 → 8.5/10
  → 時間: 5-7 天
  → 成本增加: 約 30% (70% 走快速路徑)

Phase 3: 評估推廣 (3-6 月後)
  → 根據 Buyer Agent ROI 決定是否推廣到其他 Agent
  → Agent 化程度: 8.5/10 → 9.5/10
```

### 是否推薦?

**建議先完成 Phase 1**,原因:
1. ✅ 投資報酬率更高 (2-4 天獲得 42% 效能提升)
2. ✅ 無額外成本
3. ✅ 風險更低
4. ✅ 為 Phase 2 打下基礎 (Registry 架構可復用)

**Phase 2 適合啟動的時機**:
- Phase 1 穩定運行 1-2 個月
- 發現簡單分析無法滿足複雜案例
- 願意承擔 30% 成本增加換取更深入分析
- 有充足的開發時間 (5-7 天)

---

完整的原始架構規劃與技術細節請參考本計劃檔案前半部分。
