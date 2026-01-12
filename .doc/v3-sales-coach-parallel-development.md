# Sales Coach Agent 系統 - 3 Agent 平行開發規劃

> 基於 v3-sales-coach-agent-development.md 的 22 個任務拆分
> 最後更新：2026-01-12

---

## 總覽

將 22 個任務拆分為 **3 個 Agent** 同步執行，最大化開發效率並避免重疊。

| Agent | 角色 | 任務數 | 核心產出 |
|-------|------|--------|----------|
| **Agent A** | 話術知識庫專家 | 6 個 | S1, T1, T2, A1, A4, SC1 |
| **Agent B** | 績效與警示專家 | 7 個 | S2, S3, T3, T4, T7, SC2, SC3 |
| **Agent C** | 框架與整合專家 | 9 個 | S4, T5, T6, A2, A3, I1, I2, I3, I4 |

---

## Agent A：話術知識庫專家

### 任務清單

| 順序 | 任務 ID | 名稱 | 檔案路徑 |
|------|---------|------|----------|
| 1 | S1 | 話術知識庫 Schema | `packages/db/src/schema/talk-tracks.ts` |
| 2 | T1 | query-similar-cases Tool | `packages/services/src/mcp/tools/query-similar-cases.ts` |
| 3 | T2 | get-talk-tracks Tool | `packages/services/src/mcp/tools/get-talk-tracks.ts` |
| 4 | A1 | Agent 基礎架構 | `packages/services/src/agent/sales-coach-agent.ts` |
| 5 | A4 | 型別定義 | `packages/services/src/agent/types.ts` |
| 6 | SC1 | Demo 後教練場景 | `packages/services/src/agent/scenarios/post-demo-coach.ts` |

### 執行順序與依賴

```
S1 ──► T1 ──► T2 ──► A1 ──► A4 ──► SC1
                      │
                      └── 等待 Agent C 完成 T6 (MCP Server)
```

### 與其他 Agent 的配合

1. **提供給 Agent B/C**：
   - `A4 types.ts` 定義所有共用型別（`SalesCoachInput`, `SalesCoachOutput`, `TalkTrack` 等）
   - Agent B 的 SC2/SC3 依賴 A1/A4 完成

2. **需要從 Agent C 取得**：
   - T6 的 `MCPTool` 介面定義，用於實作 T1/T2
   - T6 完成後才能開始 A1

### 產出介面定義

```typescript
// packages/services/src/agent/types.ts (A4)
export interface SalesCoachInput {
  conversationId: string;
  transcript: TranscriptSegment[];
  metadata: ConversationMetadata;
  repId: string;
}

export interface SalesCoachOutput {
  analysis: MeddicAnalysis;
  recommendations: Recommendation[];
  talkTracks: TalkTrack[];
  alerts: Alert[];
  followUps: FollowUp[];
}

export interface TalkTrack {
  id: string;
  situation: string;
  content: string;
  successRate: number;
}
```

---

## Agent B：績效與警示專家

### 任務清單

| 順序 | 任務 ID | 名稱 | 檔案路徑 |
|------|---------|------|----------|
| 1 | S2 | 業務技能 Schema | `packages/db/src/schema/rep-skills.ts` |
| 2 | S3 | 競品資訊 Schema | `packages/db/src/schema/competitor-info.ts` |
| 3 | T3 | get-rep-performance Tool | `packages/services/src/mcp/tools/get-rep-performance.ts` |
| 4 | T4 | send-alert Tool | `packages/services/src/mcp/tools/send-alert.ts` |
| 5 | T7 | get-competitor-info Tool | `packages/services/src/mcp/tools/get-competitor-info.ts` |
| 6 | SC2 | Close Now 警示場景 | `packages/services/src/agent/scenarios/close-now-alert.ts` |
| 7 | SC3 | 主管週報場景 | `packages/services/src/agent/scenarios/manager-report.ts` |

### 執行順序與依賴

```
S2 ──► T3 ──┐
            ├──► SC2 ──► SC3
S3 ──► T7 ──┤
            │
T4 ─────────┘
     │
     └── 等待 Agent C 完成 T6 (MCP Server)
     └── 等待 Agent A 完成 A1/A4 (才能開始 SC2/SC3)
```

### 與其他 Agent 的配合

1. **需要從 Agent C 取得**：
   - T6 的 `MCPTool` 介面定義，用於實作 T3/T4/T7

2. **需要從 Agent A 取得**：
   - A1 `SalesCoachAgent` 類別（SC2/SC3 繼承或組合使用）
   - A4 `types.ts` 共用型別定義

3. **提供給 Agent C**：
   - SC2/SC3 完成後通知 Agent C 可以開始 I1-I4 整合

### 獨立性說明

- S2/S3 可與 Agent A 的 S1、Agent C 的 S4 **完全平行**開發
- T3/T4/T7 僅依賴 T6 介面，不依賴 Agent A 的 Tools
- SC2/SC3 與 SC1 **完全平行**，只要 A1/A4 完成即可開始

---

## Agent C：框架與整合專家

### 任務清單

| 順序 | 任務 ID | 名稱 | 檔案路徑 |
|------|---------|------|----------|
| 1 | S4 | 跟進排程 Schema | `packages/db/src/schema/follow-ups.ts` |
| 2 | T6 | MCP Server 框架 | `packages/services/src/mcp/server.ts` |
| 3 | T5 | schedule-follow-up Tool | `packages/services/src/mcp/tools/schedule-follow-up.ts` |
| 4 | A2 | Tool Executor | `packages/services/src/agent/tool-executor.ts` |
| 5 | A3 | Result Parser | `packages/services/src/agent/result-parser.ts` |
| 6 | I1 | Slack Bot 整合 | `apps/slack-bot/src/events/file.ts` (修改) |
| 7 | I2 | API Router | `packages/api/src/routers/agent.ts` |
| 8 | I3 | 單元測試 | `tests/agent/*.test.ts` |
| 9 | I4 | E2E 測試 | `tests/e2e/agent.spec.ts` |

### 執行順序與依賴

```
S4 ──► T5 ──┐
            │
T6 ─────────┼──► A2 ──► A3 ──► I1 ──► I2 ──► I3 ──► I4
            │    │
            │    └── 等待 Agent A 完成 A1
            │    └── 等待 Agent A/B 完成 T1-T7
            │
            └── 優先完成！供 Agent A/B 使用
```

### 與其他 Agent 的配合

1. **必須優先提供給 Agent A/B**：
   - **T6 MCP Server 框架**：定義 `MCPTool` 介面，讓 Agent A/B 可以實作各自的 Tools
   - 建議 Day 1 先完成 T6 的介面定義

2. **需要從 Agent A 取得**：
   - A1 `SalesCoachAgent` 類別（A2 需要呼叫）
   - A4 `types.ts` 型別定義

3. **需要等待所有任務完成才能開始**：
   - I1-I4 整合測試需要等 SC1/SC2/SC3 全部完成

### 提供的核心介面

```typescript
// packages/services/src/mcp/server.ts (T6)
export interface MCPTool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput, context: ExecutionContext) => Promise<TOutput>;
}

export interface MCPServer {
  registerTool<TInput, TOutput>(tool: MCPTool<TInput, TOutput>): void;
  executeTool(name: string, input: unknown): Promise<unknown>;
  listTools(): ToolDefinition[];
}

export function createMCPServer(): MCPServer;
```

---

## 同步點（Sync Points）

### Sync Point 1：Schema 完成

**時間點**：Day 1 結束
**條件**：S1, S2, S3, S4 全部完成

**驗證**：
```bash
bun run db:generate && bun run db:push
```

**協調**：
- Agent A 負責更新 `packages/db/src/schema/index.ts`
- 所有 Agent 同時提交 Schema PR

---

### Sync Point 2：MCP 框架就緒

**時間點**：Day 2 開始前
**條件**：T6 介面定義完成

**協調**：
- Agent C 優先完成 T6 的型別定義
- Agent A/B 可以開始實作 Tools

---

### Sync Point 3：Tools 完成

**時間點**：Day 3 結束
**條件**：T1-T7 全部完成

**驗證**：
```bash
bun run test:unit -- --grep "mcp/tools"
```

---

### Sync Point 4：Agent Core 完成

**時間點**：Day 4 結束
**條件**：A1, A2, A3, A4 全部完成

**驗證**：
```typescript
const agent = createSalesCoachAgent({ mcpServer });
const result = await agent.analyze(mockInput);
expect(result.recommendations).toBeDefined();
```

---

### Sync Point 5：Scenarios 完成

**時間點**：Day 5 結束
**條件**：SC1, SC2, SC3 全部完成

**協調**：
- Agent A (SC1) 和 Agent B (SC2, SC3) 可完全平行
- 完成後通知 Agent C 開始整合

---

### Sync Point 6：整合完成

**時間點**：Day 6 結束
**條件**：I1, I2, I3, I4 全部完成

**驗證**：
```bash
bun run test:all
bun run test:e2e
```

---

## 資料流依賴圖

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent A                              │
│  ┌───┐     ┌───┐     ┌───┐     ┌───┐     ┌───┐     ┌────┐  │
│  │S1 │────►│T1 │────►│T2 │     │A1 │────►│A4 │────►│SC1 │  │
│  └───┘     └───┘     └───┘     └─┬─┘     └───┘     └────┘  │
└──────────────────────────────────┼──────────────────────────┘
                                   │ 依賴 T6
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                        Agent C                               │
│  ┌───┐     ┌───┐     ┌───┐     ┌───┐     ┌───┐     ┌─────┐  │
│  │S4 │────►│T5 │     │T6 │────►│A2 │────►│A3 │────►│I1-I4│  │
│  └───┘     └───┘     └─┬─┘     └─┬─┘     └───┘     └─────┘  │
└────────────────────────┼─────────┼───────────────────────────┘
                         │         │ 依賴 A1 + T1-T7
                         ▼         │
┌────────────────────────────────────────────────────────────┐
│                        Agent B                             │
│  ┌───┐     ┌───┐                      ┌────┐     ┌────┐   │
│  │S2 │────►│T3 │──────────────────────►│SC2 │────►│SC3 │   │
│  └───┘     └───┘                      └────┘     └────┘   │
│  ┌───┐     ┌───┐     ┌───┐               ▲                │
│  │S3 │────►│T7 │     │T4 │───────────────┘                │
│  └───┘     └───┘     └───┘                                │
│                        ▲ 依賴 T6                           │
└────────────────────────┴───────────────────────────────────┘
```

---

## 關鍵檔案參考

開發時請參考現有的程式碼模式：

| 類型 | 參考檔案 |
|------|----------|
| Schema | `packages/db/src/schema/opportunity.ts` |
| 服務模式 | `packages/services/src/llm/orchestrator.ts` |
| API Router | `packages/api/src/routers/alert.ts` |
| Slack 事件 | `apps/slack-bot/src/events/file.ts` |
| 測試模式 | `tests/api/alert.test.ts` |

---

## Git 分支策略

```
main
├── feat/sales-coach-schema       # Sync Point 1: 所有 Schema
├── feat/agent-a-talk-tracks      # Agent A 專屬
├── feat/agent-b-performance      # Agent B 專屬
├── feat/agent-c-mcp-framework    # Agent C 框架
└── feat/sales-coach-integration  # 最終整合
```

**合併順序**：
1. `feat/sales-coach-schema` → main
2. `feat/agent-c-mcp-framework` → main（T6 完成後）
3. `feat/agent-a-talk-tracks` → main
4. `feat/agent-b-performance` → main
5. `feat/sales-coach-integration` → main

---

## 驗證計劃

### 最終 E2E 測試場景

```
1. 上傳音檔 → 轉錄 → Agent 分析 → 產出話術建議
2. 觸發 Close Now 條件 → Slack 收到警示
3. /report weekly 指令 → 收到主管週報
```

### 執行驗證指令

```bash
# Layer 0 驗證
bun run db:generate && bun run db:push

# Layer 1 驗證
bun run test:unit -- --grep "mcp/tools"

# Layer 2-3 驗證
bun run test:unit -- --grep "agent"

# Layer 4 驗證
bun run test:all
bun run test:e2e
```

---

## 快速啟動指令

### Agent A 啟動

```bash
# 1. 建立分支
git checkout -b feat/agent-a-talk-tracks

# 2. 開發 S1
# 建立 packages/db/src/schema/talk-tracks.ts

# 3. 驗證 Schema
cd packages/db && bun run db:generate
```

### Agent B 啟動

```bash
# 1. 建立分支
git checkout -b feat/agent-b-performance

# 2. 開發 S2, S3
# 建立 packages/db/src/schema/rep-skills.ts
# 建立 packages/db/src/schema/competitor-info.ts

# 3. 驗證 Schema
cd packages/db && bun run db:generate
```

### Agent C 啟動

```bash
# 1. 建立分支
git checkout -b feat/agent-c-mcp-framework

# 2. 優先開發 T6 介面
# 建立 packages/services/src/mcp/server.ts
# 建立 packages/services/src/mcp/types.ts

# 3. 通知 Agent A/B 可以開始 Tools 開發
```
