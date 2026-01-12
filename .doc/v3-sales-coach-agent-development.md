# Sales Coach Agent 系統 - 多開發者平行開發計劃

> 最後更新：2026-01-12

## 概述

將 Sales Coach Agent + MCP 架構拆分為 **22 個任務**，分佈在 **5 個層級**，支援 2-6 人平行開發。

---

## 層級總覽

```
Layer 0: Schema（完全平行）      → 4 任務，8 小時
Layer 1: Services/Tools（部分平行）→ 7 任務，29 小時
Layer 2: Agent Core（序列）      → 4 任務，17 小時
Layer 3: Scenarios（完全平行）   → 3 任務，14 小時
Layer 4: Integration（序列）     → 4 任務，18 小時
────────────────────────────────────────────────
總計：22 任務，86 小時
```

---

## Layer 0: Database Schema（完全平行，無依賴）

| 任務 ID | 任務名稱 | 檔案 | 預估 |
|---------|----------|------|------|
| S1 | 話術知識庫 Schema | `packages/db/src/schema/talk-tracks.ts` | 2h |
| S2 | 業務技能 Schema | `packages/db/src/schema/rep-skills.ts` | 2h |
| S3 | 競品資訊 Schema | `packages/db/src/schema/competitor-info.ts` | 2h |
| S4 | 跟進排程 Schema | `packages/db/src/schema/follow-ups.ts` | 2h |

**產出物**：4 個 Schema + Migration + 註冊到 `index.ts`

**驗證方式**：`bun run db:generate && bun run db:push` 成功

---

## Layer 1: Services & MCP Tools（部分平行）

依賴 Layer 0 Schema 完成。

| 任務 ID | 任務名稱 | 檔案 | 依賴 | 預估 |
|---------|----------|------|------|------|
| T1 | query_similar_cases | `packages/services/src/mcp/tools/query-similar-cases.ts` | S1 | 5h |
| T2 | get_talk_tracks | `packages/services/src/mcp/tools/get-talk-tracks.ts` | S1 | 4h |
| T3 | get_rep_performance | `packages/services/src/mcp/tools/get-rep-performance.ts` | S2 | 4h |
| T4 | send_alert | `packages/services/src/mcp/tools/send-alert.ts` | 無 | 4h |
| T5 | schedule_follow_up | `packages/services/src/mcp/tools/schedule-follow-up.ts` | S4 | 4h |
| T6 | MCP Server 框架 | `packages/services/src/mcp/server.ts` | 無 | 4h |
| T7 | 競品查詢服務 | `packages/services/src/mcp/tools/get-competitor-info.ts` | S3 | 4h |

**並行策略**：
- T1, T2 由同一人負責（都依賴 S1）
- T3, T4, T5, T6, T7 可完全平行

**驗證方式**：每個 Tool 有獨立單元測試通過

---

## Layer 2: Agent Core（序列，核心路徑）

依賴 Layer 1 至少完成 T6（MCP Server）。

| 任務 ID | 任務名稱 | 檔案 | 依賴 | 預估 |
|---------|----------|------|------|------|
| A1 | Agent 基礎架構 | `packages/services/src/agent/sales-coach-agent.ts` | T6 | 6h |
| A2 | Tool Use 整合 | `packages/services/src/agent/tool-executor.ts` | A1, T1-T7 | 4h |
| A3 | 結果解析器 | `packages/services/src/agent/result-parser.ts` | A1 | 3h |
| A4 | 型別定義 | `packages/services/src/agent/types.ts` | A1 | 4h |

**關鍵路徑**：A1 → A2 → A3（必須序列執行）

**驗證方式**：Agent 可以正確呼叫 Tools 並解析結果

---

## Layer 3: Scenarios（完全平行）

依賴 Layer 2 完成。

| 任務 ID | 任務名稱 | 檔案 | 預估 |
|---------|----------|------|------|
| SC1 | Demo 後教練 | `packages/services/src/agent/scenarios/post-demo-coach.ts` | 5h |
| SC2 | Close Now 警示 | `packages/services/src/agent/scenarios/close-now-alert.ts` | 4h |
| SC3 | 主管週報 | `packages/services/src/agent/scenarios/manager-report.ts` | 5h |

**產出物**：3 個獨立場景實作

**驗證方式**：三個場景各自產出正確格式

---

## Layer 4: Integration（序列）

依賴 Layer 3 完成。

| 任務 ID | 任務名稱 | 檔案 | 預估 |
|---------|----------|------|------|
| I1 | Slack Bot 整合 | `apps/slack-bot/src/events/file.ts` 修改 | 5h |
| I2 | API Router 整合 | `packages/api/src/routers/agent.ts` | 4h |
| I3 | 單元測試 | `tests/agent/*.test.ts` | 5h |
| I4 | E2E 測試 | `tests/e2e/agent.test.ts` | 4h |

**驗證方式**：完整 E2E 流程測試通過

---

## 開發者配置建議

### 配置 A：2 人團隊（3 週）

```
Week 1: Layer 0-1
├── Dev A: S1, S2, T1, T2, T3
└── Dev B: S3, S4, T4, T5, T6, T7

Week 2: Layer 2-3
├── Dev A: A1, A2, A3, A4
└── Dev B: SC1, SC2, SC3（等待 Layer 2）

Week 3: Layer 4
├── Dev A: I1, I2
└── Dev B: I3, I4
```

### 配置 B：4 人團隊（2 週）

```
Week 1:
├── Dev A: S1, T1, T2
├── Dev B: S2, S3, T3, T7
├── Dev C: S4, T4, T5
└── Dev D: T6, A1, A2

Week 2:
├── Dev A: A3, A4, SC1
├── Dev B: SC2, I1
├── Dev C: SC3, I2
└── Dev D: I3, I4
```

### 配置 C：6 人團隊（1.5 週）

```
Week 1:
├── Dev A: S1, T1, T2
├── Dev B: S2, T3
├── Dev C: S3, T7
├── Dev D: S4, T4, T5
├── Dev E: T6
└── Lead: A1, A2, A3, A4

Week 1.5:
├── Dev A: SC1, I1
├── Dev B: SC2, I2
├── Dev C: SC3
└── Dev D-F: I3, I4, 文件
```

---

## 檔案結構

```
packages/
├── db/src/schema/
│   ├── talk-tracks.ts      # S1 - 話術知識庫
│   ├── rep-skills.ts       # S2 - 業務技能
│   ├── competitor-info.ts  # S3 - 競品資訊
│   └── follow-ups.ts       # S4 - 跟進排程
│
├── services/src/
│   ├── mcp/
│   │   ├── server.ts       # T6 - MCP Server 框架
│   │   └── tools/
│   │       ├── query-similar-cases.ts   # T1
│   │       ├── get-talk-tracks.ts       # T2
│   │       ├── get-rep-performance.ts   # T3
│   │       ├── send-alert.ts            # T4
│   │       ├── schedule-follow-up.ts    # T5
│   │       └── get-competitor-info.ts   # T7
│   │
│   └── agent/
│       ├── sales-coach-agent.ts  # A1 - Agent 核心
│       ├── tool-executor.ts      # A2 - Tool Use 整合
│       ├── result-parser.ts      # A3 - 結果解析
│       ├── types.ts              # A4 - 型別定義
│       └── scenarios/
│           ├── post-demo-coach.ts   # SC1
│           ├── close-now-alert.ts   # SC2
│           └── manager-report.ts    # SC3
│
└── api/src/routers/
    └── agent.ts              # I2 - API 整合

apps/slack-bot/src/
└── events/file.ts            # I1 - 修改整合

tests/
├── agent/*.test.ts           # I3 - 單元測試
└── e2e/agent.test.ts         # I4 - E2E 測試
```

---

## 任務依賴圖

```
Layer 0 (Schema)          Layer 1 (Tools)           Layer 2 (Agent)        Layer 3 (Scenarios)    Layer 4 (Integration)
================          ===============           ===============        ===================    =====================

    S1 ─────────────┬──────► T1 ─────────────┐
    │               │                        │
    │               └──────► T2 ─────────────┤
    │                                        │
    S2 ─────────────────────► T3 ─────────────┤
                                             │
    (none) ─────────────────► T4 ─────────────┼───────► A1 ──────► A2 ──────► A3 ───────┬──► SC1 ──────┬──► I1
                                             │         │                    │          │             │
    S4 ─────────────────────► T5 ─────────────┤         └────────► A4       │          ├──► SC2 ──────┼──► I2
                                             │                              │          │             │
    (none) ─────────────────► T6 ─────────────┤                              │          └──► SC3 ──────┼──► I3
                                             │                              │                        │
    S3 ─────────────────────► T7 ─────────────┘                              │                        └──► I4
```

---

## 驗證計劃

### 每層完成驗證

1. **Layer 0 完成**：`bun run db:generate && bun run db:push` 成功
2. **Layer 1 完成**：每個 Tool 有獨立單元測試通過
3. **Layer 2 完成**：Agent 可以正確呼叫 Tools 並解析結果
4. **Layer 3 完成**：三個場景各自產出正確格式
5. **Layer 4 完成**：完整 E2E 流程測試通過

### E2E 測試場景

```
1. 上傳音檔 → 轉錄 → Agent 分析 → 產出建議
2. 觸發 Close Now 條件 → Slack 收到警示
3. /report weekly 指令 → 收到週報
```

---

## Schema 詳細設計

### S1: 話術知識庫 (talk-tracks.ts)

```typescript
export const talkTracks = pgTable("talk_tracks", {
  id: text("id").primaryKey(),

  // 情境分類
  situation: text("situation").notNull(),        // "價格異議", "需要老闆決定", "轉換顧慮"
  customerType: text("customer_type"),           // "衝動型", "精算型", "保守觀望型"
  storeType: text("store_type"),                 // "cafe", "restaurant", "beverage"

  // 話術內容
  talkTrack: text("talk_track").notNull(),       // 「王老闆，關於價格...」
  context: text("context"),                      // 什麼情況下使用
  expectedOutcome: text("expected_outcome"),     // 預期效果

  // 來源和效果
  sourceConversationId: text("source_conversation_id"),
  successRate: integer("success_rate"),          // 使用這句話後的成交率
  usageCount: integer("usage_count"),            // 被使用次數

  createdAt: timestamp("created_at").defaultNow(),
});
```

### S2: 業務技能 (rep-skills.ts)

```typescript
export const repSkills = pgTable("rep_skills", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),

  // 技能評估
  skillArea: text("skill_area").notNull(),       // "異議處理", "價值呈現", "收尾技巧"
  score: integer("score"),                       // 1-100
  trend: text("trend"),                          // "improving", "stable", "declining"

  // 弱點和建議
  weakness: text("weakness"),
  recommendation: text("recommendation"),

  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### S3: 競品資訊 (competitor-info.ts)

```typescript
export const competitorInfo = pgTable("competitor_info", {
  id: text("id").primaryKey(),
  competitorName: text("competitor_name").notNull(),

  // 比較資訊
  strengths: jsonb("strengths"),
  weaknesses: jsonb("weaknesses"),
  ourAdvantages: jsonb("our_advantages"),

  // 應對話術
  counterTalkTracks: jsonb("counter_talk_tracks"),
  switchingCases: jsonb("switching_cases"),

  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### S4: 跟進排程 (follow-ups.ts)

```typescript
export const followUps = pgTable("follow_ups", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  opportunityId: text("opportunity_id"),

  // 排程
  scheduledAt: timestamp("scheduled_at").notNull(),
  channel: text("channel").notNull(),            // "slack_dm", "slack_channel"
  status: text("status").default("pending"),     // "pending", "sent", "cancelled"

  // 內容
  message: text("message").notNull(),
  talkTrack: text("talk_track"),

  createdAt: timestamp("created_at").defaultNow(),
  sentAt: timestamp("sent_at"),
});
```

---

## MCP Tools 詳細設計

### T1: query_similar_cases

```typescript
// 輸入
{
  customerType: "衝動型" | "精算型" | "保守觀望型",
  concern: string,      // "價格", "轉換難度", "員工訓練"
  storeType?: string    // "cafe", "restaurant", "beverage"
}

// 輸出
{
  cases: Array<{
    conversationId: string,
    storeName: string,
    outcome: "won" | "lost",
    meddicScore: number,
    keyInsight: string,
    winningTactic: string
  }>,
  avgFollowUps: number,
  successRate: number
}
```

### T2: get_talk_tracks

```typescript
// 輸入
{
  situation: "價格異議" | "需要老闆決定" | "擔心轉換麻煩" | "已有其他系統" | "要再考慮",
  customerType?: string
}

// 輸出
{
  talkTracks: Array<{
    id: string,
    content: string,
    context: string,
    successRate: number,
    usageCount: number
  }>,
  bestPractice: string
}
```

### T3: get_rep_performance

```typescript
// 輸入
{
  repId: string,
  period: "last_7_days" | "last_30_days" | "last_quarter"
}

// 輸出
{
  demos: number,
  avgMeddicScore: number,
  conversionRate: number,
  trend: "improving" | "stable" | "declining",
  strengths: string[],
  weaknesses: string[],
  recommendations: string[]
}
```

### T4: send_alert

```typescript
// 輸入
{
  type: "close_now" | "missing_dm" | "manager_escalation",
  severity: "high" | "medium" | "low",
  message: string,
  suggestedAction: string,
  conversationId?: string
}

// 輸出
{
  success: boolean,
  alertId: string,
  sentTo: string[]
}
```

### T5: schedule_follow_up

```typescript
// 輸入
{
  timing: "2_hours" | "tomorrow_9am" | "3_days" | "1_week",
  channel: "slack_dm" | "slack_channel",
  message: string,
  talkTrack?: string
}

// 輸出
{
  success: boolean,
  followUpId: string,
  scheduledAt: string
}
```

---

## 資源優先級

| 優先級 | 資源 | 理由 |
|--------|------|------|
| P0 | 話術知識庫 | 直接提升話術品質，ROI 最高 |
| P1 | V2 歷史資料遷移 | 有資料才能查詢相似案例 |
| P2 | 業務技能標籤 | 讓建議更個人化 |
| P3 | 競爭對手資訊庫 | 處理競品情境 |
| P4 | 外部工具整合 | 自動化跟進流程 |
| P5 | 即時分析 | 技術複雜，可後做 |
