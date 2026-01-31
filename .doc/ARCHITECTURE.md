# Sales AI Automation V3 - 專案架構文件

> **最後更新**：2026-01-31
> **維護者**：開發團隊
> **用途**：快速了解專案架構，避免每次重新探索程式碼

---

## 一、專案概述

### 1.1 產品定位

Sales AI Automation V3 是一個**智能銷售對話分析平台**，核心功能：

1. **語音轉文字**：將銷售錄音轉為逐字稿（Groq Whisper）
2. **MEDDIC 分析**：AI 分析對話品質，提供教練建議（Gemini）
3. **CRM 整合**：與 Slack Bot 整合，自動追蹤商機
4. **報表儀表板**：業績分析、團隊績效、待辦管理

### 1.2 技術棧

| 類別 | 技術 | 用途 |
|------|------|------|
| **語言** | TypeScript | 全端型別安全 |
| **前端** | React + Vite + Alchemy | SPA 儀表板 |
| **後端** | Hono + Cloudflare Workers | Edge API |
| **資料庫** | Neon PostgreSQL + Drizzle ORM | Serverless DB |
| **AI** | Google Gemini 2.0 Flash | MEDDIC 分析 |
| **轉錄** | Groq Whisper | 語音轉文字 |
| **儲存** | Cloudflare R2 | 音檔儲存 |
| **快取** | Cloudflare KV | 報表快取 |
| **佇列** | Cloudflare Queues | 異步處理 |
| **認證** | Better Auth | Session 管理 |
| **RPC** | oRPC | 型別安全 API |

### 1.3 Monorepo 結構

```
sales_ai_automation_v3/
├── apps/                    # 可部署的應用程式
│   ├── server/              # 主 API 伺服器
│   ├── web/                 # React 前端
│   ├── slack-bot/           # Slack 機器人（iCHEF）
│   ├── slack-bot-beauty/    # Slack 機器人（美妝）
│   ├── queue-worker/        # 異步轉錄處理
│   └── lambda-audio-compressor/  # AWS Lambda 音檔壓縮
│
├── packages/                # 共享套件
│   ├── api/                 # oRPC 路由定義
│   ├── services/            # 核心業務邏輯
│   ├── db/                  # 資料庫 Schema & ORM
│   ├── shared/              # 共用型別、工具、錯誤
│   ├── auth/                # Better Auth 設定
│   ├── env/                 # 環境變數管理
│   ├── claude-sdk/          # Claude Agent SDK
│   └── infra/               # 基礎設施定義
│
├── scripts/                 # 維運腳本
├── tests/                   # E2E 測試
└── .doc/                    # 專案文件
```

---

## 二、應用程式架構

### 2.1 apps/server - 主 API 伺服器

**位置**：`apps/server/src/index.ts`

**職責**：
- HTTP API 端點（oRPC）
- 認證驗證（Better Auth）
- Cron Job 排程（報表預計算、音檔修復）
- Health Check

**關鍵程式碼**：
```typescript
// apps/server/src/index.ts
const app = new Hono<{ Bindings: Env }>();

// 路由掛載
app.route("/rpc", rpcHandler);
app.route("/auth", authHandler);

// Cron 排程
export default {
  fetch: app.fetch,
  scheduled: async (event, env, ctx) => {
    // 每 15 分鐘預計算報表
    // 每小時執行音檔修復
  },
};
```

### 2.2 apps/web - React 前端

**位置**：`apps/web/`

**技術**：
- Vite + React 19
- TanStack Router（檔案路由）
- TanStack Query（資料獲取）
- Tailwind CSS + shadcn/ui

**頁面結構**：
```
apps/web/src/routes/
├── __root.tsx           # 根佈局
├── index.tsx            # 首頁（儀表板）
├── opportunities/       # 商機管理
├── conversations/       # 對話列表
├── analytics/           # 報表分析
└── settings/            # 設定
```

### 2.3 apps/slack-bot - Slack 機器人

**位置**：`apps/slack-bot/`

**功能**：
- 接收音檔上傳事件
- 傳送 MEDDIC 分析結果
- 互動式按鈕（查看詳情、重新分析）

**事件流程**：
```
Slack File Upload
    ↓
apps/slack-bot/src/events/file.ts
    ↓
下載音檔 → 上傳 R2 → 發送到 Queue
    ↓
回覆「處理中」訊息
```

### 2.4 apps/queue-worker - 異步處理

**位置**：`apps/queue-worker/src/index.ts`

**職責**：
- 消費 Transcription Queue
- 執行 Groq Whisper 轉錄
- 執行 MEDDIC Orchestrator 分析
- 建立警示、發送 Slack 通知

**處理流程**：
```
Queue Message { conversationId, audioUrl }
    ↓
1. 下載音檔
2. Groq Whisper 轉錄
3. MEDDIC DAG 分析（6 個 Agent 並行）
4. 儲存分析結果
5. 評估警示條件
6. 發送 Slack 通知
```

---

## 三、核心套件架構

### 3.1 packages/api - oRPC 路由

**位置**：`packages/api/src/routers/`

**路由列表**：

| 路由檔案 | 端點前綴 | 功能 |
|----------|----------|------|
| `conversation.ts` | `/conversations` | 對話 CRUD、上傳、重新分析 |
| `opportunity.ts` | `/opportunities` | 商機 CRUD、客戶管理 |
| `analytics/*.ts` | `/analytics` | 報表、儀表板、效能指標 |
| `alert.ts` | `/alerts` | 警示管理 |
| `sales-todo.ts` | `/sales-todos` | 待辦事項 |
| `lead-source.ts` | `/lead-sources` | 潛在客戶來源 |
| `admin.ts` | `/admin` | 管理員功能 |

**路由結構範例**：
```typescript
// packages/api/src/routers/opportunity.ts
import { protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";

export const opportunityRouter = {
  // 取得單一商機
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      // ...
    }),

  // 列出用戶商機
  list: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .handler(async ({ input, context }) => {
      // ...
    }),
};
```

### 3.2 packages/services - 核心服務

**目錄結構**：
```
packages/services/src/
├── llm/                     # LLM 整合
│   ├── gemini.ts            # Gemini API 客戶端
│   ├── orchestrator.ts      # MEDDIC DAG 協調器
│   ├── agents.ts            # 6 個 MEDDIC Agent
│   └── dag-executor.ts      # DAG 並行執行引擎
│
├── transcription/           # 轉錄服務
│   └── groq-whisper.ts      # Groq Whisper API
│
├── storage/                 # 儲存服務
│   ├── r2.ts                # Cloudflare R2
│   └── s3.ts                # AWS S3（備援）
│
├── notifications/           # 通知服務
│   ├── slack.ts             # Slack API 封裝
│   └── blocks.ts            # Block Kit 訊息建構
│
├── alerts/                  # 警示服務
│   └── evaluator.ts         # 警示條件評估
│
├── report/                  # 報表服務
│   ├── index.ts             # 報表計算邏輯
│   └── compute-reports.ts   # 預計算函數
│
├── ops/                     # 運維服務
│   ├── orchestrator.ts      # 檢查/修復協調器
│   └── notification.ts      # 運維警示
│
├── mcp/                     # MCP 工具框架
│   ├── server.ts            # MCP Server 實作
│   ├── tools/               # 70+ 運維工具
│   └── external/            # 外部服務整合
│
├── nlp/                     # NLP 處理
│   ├── voice-tagger.ts      # 客戶聲音標籤
│   └── dictionaries/        # 產品線專用詞庫
│
└── index.ts                 # 統一匯出
```

#### 3.2.1 MEDDIC Orchestrator

**核心檔案**：`packages/services/src/llm/orchestrator.ts`

**Agent 架構**：
```
                    ┌─────────────┐
                    │   Context   │
                    │   Agent     │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Buyer     │ │   Seller    │ │  Quality    │
    │   Agent     │ │   Agent     │ │  Loop Agent │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
                    ┌─────────────┐
                    │  Summary    │
                    │   Agent     │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   Coach     │
                    │   Agent     │
                    └─────────────┘
```

**DAG 執行器**：`packages/services/src/llm/dag-executor.ts`
- 並行執行無依賴的 Agent
- 減少 42% 執行時間

#### 3.2.2 MCP 工具框架

**核心檔案**：`packages/services/src/mcp/server.ts`

**工具分類**：

| 目錄 | 工具數量 | 功能 |
|------|----------|------|
| `tools/analytics/` | 4 | 導出報表、團隊儀表板 |
| `tools/ops/analysis/` | 5 | 隊列檢查、重新分析 |
| `tools/ops/slack/` | 3 | Slack 連線、檔案下載 |
| `tools/ops/storage/` | 4 | R2 清理、重新上傳 |
| `tools/ops/transcription/` | 4 | 轉錄重試、取消 |
| `tools/ops/database/` | 3 | 資料庫健康檢查 |
| `external/` | 9 | Gemini、Slack、R2、PostgreSQL |

### 3.3 packages/db - 資料庫層

**位置**：`packages/db/`

**結構**：
```
packages/db/
├── src/
│   ├── index.ts             # 連線管理（Neon/pg 自動切換）
│   ├── schema/              # Drizzle Schema 定義
│   │   ├── conversation.ts
│   │   ├── opportunity.ts
│   │   ├── meddic.ts
│   │   ├── alert.ts
│   │   ├── sales-todo.ts
│   │   ├── customer-voice-tags.ts
│   │   └── ...
│   └── migrations/          # SQL Migration 檔案
└── drizzle.config.ts        # Drizzle CLI 設定
```

**Schema 列表**（17 個表）：

| Schema 檔案 | 表名 | 用途 |
|-------------|------|------|
| `conversation.ts` | conversations | 對話記錄 |
| `opportunity.ts` | opportunities | 商機資料 |
| `meddic.ts` | meddic_analyses | MEDDIC 分析結果 |
| `alert.ts` | alerts | 警示記錄 |
| `sales-todo.ts` | sales_todos | 銷售待辦 |
| `customer-voice-tags.ts` | customer_voice_tags | 客戶聲音標籤 |
| `lead-source.ts` | lead_sources | 潛在客戶來源 |
| `user.ts` | users, profiles | 用戶與個人資料 |
| `session.ts` | sessions | 登入 Session |

### 3.4 packages/shared - 共用模組

**位置**：`packages/shared/src/`

**內容**：
```
packages/shared/src/
├── errors/
│   └── index.ts             # AppError、錯誤工廠
├── types/
│   └── index.ts             # 共用型別定義
└── utils/
    └── index.ts             # 工具函數
```

**錯誤處理**：
```typescript
// packages/shared/src/errors/index.ts
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public cause?: unknown,
    public context?: Record<string, unknown>
  ) {
    super(message);
  }
}

export const errors = {
  UNAUTHORIZED: () => new AppError("UNAUTHORIZED", "請先登入", 401),
  FORBIDDEN: (reason?: string) => new AppError("FORBIDDEN", reason ?? "權限不足", 403),
  NOT_FOUND: (resource: string) => new AppError("NOT_FOUND", `${resource} 不存在`, 404),
  // ... 更多錯誤工廠
};
```

---

## 四、資料流

### 4.1 對話上傳流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Slack Bot  │     │   Web App   │     │   API       │
│  音檔上傳   │     │  音檔上傳   │     │  直接呼叫   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
              ┌────────────────────────┐
              │  POST /rpc/conversations.upload │
              │  packages/api/routers/conversation.ts │
              └────────────┬───────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 驗證/建立   │     │ 上傳音檔   │     │ 發送 Queue  │
│ Opportunity │     │ 到 R2      │     │ 訊息        │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                              ┌────────────────────────┐
                              │  Cloudflare Queue       │
                              │  transcription-queue    │
                              └────────────┬───────────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │  apps/queue-worker     │
                              │                        │
                              │  1. 下載音檔           │
                              │  2. Groq Whisper 轉錄  │
                              │  3. MEDDIC 分析        │
                              │  4. 儲存結果           │
                              │  5. 評估警示           │
                              │  6. Slack 通知         │
                              └────────────────────────┘
```

### 4.2 報表預計算流程

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Cron Trigger                                │
│  每 15 分鐘 (*/15 * * * *)                              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  apps/server scheduled() handler                        │
│                                                         │
│  Step 0: 計算系統健康、關注機會                          │
│  Step 1: 取得所有用戶和 profiles                        │
│  Step 2: 取得所有對話（月度）                           │
│  Step 3: 計算上傳排名                                   │
│  Step 4: 逐個計算用戶報表                               │
│  Step 5: 計算團隊報表                                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare KV 快取                                     │
│                                                         │
│  system:health     → 系統健康狀態                       │
│  close:cases       → 需關注的機會                       │
│  report:rep:{uid}  → 個人報表                           │
│  report:team:{dept}→ 團隊報表                           │
│                                                         │
│  TTL: 1800 秒 (30 分鐘)                                 │
└─────────────────────────────────────────────────────────┘
```

### 4.3 OPS 健康檢查流程

```
┌─────────────────────────────────────────────────────────┐
│  OpsOrchestrator.runChecks()                            │
│  packages/services/src/ops/orchestrator.ts              │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Slack 檢查  │   │ 轉錄檢查   │   │ 儲存檢查   │
│ 連線狀態    │   │ 卡住任務   │   │ 完整性     │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  收集檢查結果                                           │
│                                                         │
│  如果 enableAutoRepair = true：                         │
│  → 根據 CHECK_TO_REPAIR_MAPPING 觸發對應修復工具       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  sendOpsAlert()                                         │
│  發送到 Slack #ops-alerts 頻道                          │
└─────────────────────────────────────────────────────────┘
```

---

## 五、外部服務整合

### 5.1 Google Gemini

**用途**：MEDDIC 對話分析

**檔案**：`packages/services/src/llm/gemini.ts`

**設定**：
```typescript
const model = "gemini-2.0-flash-exp";  // 或 gemini-2.0-flash-lite
const maxRetries = 3;
const retryDelayMs = 1000;
```

### 5.2 Groq Whisper

**用途**：語音轉文字

**檔案**：`packages/services/src/transcription/groq-whisper.ts`

**設定**：
```typescript
const model = "whisper-large-v3-turbo";
const maxAudioSize = 25 * 1024 * 1024;  // 25MB
```

### 5.3 Cloudflare R2

**用途**：音檔儲存

**檔案**：`packages/services/src/storage/r2.ts`

**Bucket 結構**：
```
sales-ai-audio/
├── {productLine}/
│   └── {YYYY-MM}/
│       └── {conversationId}.mp3
```

### 5.4 Cloudflare KV

**用途**：報表快取、Session 儲存

**命名空間**：
| KV Namespace | 用途 |
|--------------|------|
| `CACHE_KV` | 報表快取 |
| `SESSION_KV` | Better Auth Session |

**快取 Key 規範**：
```
system:health           # 系統健康狀態
close:cases             # 需關注機會
report:rep:{userId}     # 個人報表
report:team:{dept}      # 團隊報表
conversation:{id}       # 對話詳情
conversations:{userId}  # 對話列表
```

### 5.5 Cloudflare Queues

**用途**：異步轉錄處理

**Queue 名稱**：`transcription-queue`

**訊息格式**：
```typescript
interface QueueMessage {
  conversationId: string;
  audioUrl: string;
  productLine: string;
  retryCount?: number;
}
```

---

## 六、環境變數

### 6.1 必要變數

```bash
# 資料庫
DATABASE_URL=postgresql://...

# AI 服務
GEMINI_API_KEY=...
GROQ_API_KEY=...

# Cloudflare
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=sales-ai-audio

# Slack（每個 Bot 獨立）
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# 認證
BETTER_AUTH_SECRET=...
```

### 6.2 多產品線變數

```bash
# iCHEF 產品線
GROQ_API_KEY_ICHEF=...
GEMINI_API_KEY_ICHEF=...
SLACK_BOT_TOKEN_ICHEF=...

# Beauty 產品線
GROQ_API_KEY_BEAUTY=...
GEMINI_API_KEY_BEAUTY=...
SLACK_BOT_TOKEN_BEAUTY=...
```

---

## 七、部署架構

### 7.1 Cloudflare Workers

| 應用 | Worker 名稱 | 說明 |
|------|-------------|------|
| server | `sales-ai-server` | 主 API |
| queue-worker | `sales-ai-queue-worker` | 轉錄處理 |
| slack-bot | `sales-ai-slack-bot` | iCHEF Slack Bot |
| slack-bot-beauty | `sales-ai-slack-bot-beauty` | Beauty Slack Bot |

### 7.2 Cloudflare Pages

| 應用 | Project 名稱 | 說明 |
|------|-------------|------|
| web | `sales-ai-web` | React 前端 |

### 7.3 部署命令

```bash
# Server
cd apps/server && bunx wrangler deploy

# Queue Worker
cd apps/queue-worker && bunx wrangler deploy

# Slack Bot
cd apps/slack-bot && bunx wrangler deploy

# Web（需先 build）
cd apps/web && bun run build && bunx wrangler pages deploy dist
```

---

## 八、開發規範

### 8.1 程式碼風格

- **Formatter**：Biome（`bun x ultracite fix`）
- **Linter**：Biome（`bun x ultracite check`）
- **型別檢查**：TypeScript strict mode

### 8.2 Commit 規範

使用 Conventional Commits：
```
feat(api): 新增商機匯出功能
fix(queue): 修復轉錄超時問題
refactor(services): 重構 MEDDIC 分析流程
docs: 更新架構文件
```

### 8.3 測試規範

```bash
# 單元測試
bun test

# 整合測試
bun test:integration

# E2E 測試
bun test:e2e
```

### 8.4 ID 格式規範

| 類型 | 格式 | 範例 |
|------|------|------|
| 案件編號 | `YYYYMM-IC###` | `202601-IC046` |
| 客戶編號 | `YYYYMM-######` | `201700-000001` |

---

## 九、已知限制與注意事項

### 9.1 Cloudflare Workers 限制

| 限制 | 數值 | 影響 |
|------|------|------|
| CPU 時間 | 30ms (Free) / 50ms (Paid) | 複雜計算需分拆 |
| 記憶體 | 128MB | 大檔案需串流處理 |
| 請求大小 | 100MB | 音檔需先壓縮 |
| Subrequest | 50 個/請求 | 批次操作需注意 |

### 9.2 已知痛點（待改進）

1. **Router 層直接操作 DB** - 查詢邏輯無法重用
2. **日誌使用 console.log** - 無結構化、難以搜尋
3. **報表預計算在 index.ts** - 程式碼過長、難以維護
4. **Queue Worker 職責過重** - 轉錄、分析、通知都在同一處

### 9.3 效能優化已實施

- DAG Executor 並行化 Agent（減少 42% 執行時間）
- KV 快取報表（15 分鐘 TTL）
- Lambda 壓縮音檔（上傳前）
- Neon Serverless（邊緣資料庫）

---

## 十、相關文件

| 文件 | 位置 | 說明 |
|------|------|------|
| 架構改進方案 | `.doc/20260131_務實版架構改進方案.md` | 待實施的架構優化 |
| 部署清單 | `.claude/CLAUDE.md` | 部署命令與注意事項 |
| Skills 列表 | `.claude/CLAUDE.md` | Claude 自動化 Skills |

---

## 附錄：快速查詢表

### A. 我想改 XX，應該看哪個檔案？

| 我想改... | 檔案位置 |
|-----------|----------|
| API 端點 | `packages/api/src/routers/` |
| 資料庫 Schema | `packages/db/src/schema/` |
| MEDDIC 分析邏輯 | `packages/services/src/llm/orchestrator.ts` |
| 轉錄處理 | `apps/queue-worker/src/index.ts` |
| Slack 訊息格式 | `packages/services/src/notifications/blocks.ts` |
| 報表計算 | `apps/server/src/index.ts` (precomputeReports) |
| 錯誤處理 | `packages/shared/src/errors/index.ts` |
| 環境變數 | `packages/env/src/server.ts` |

### B. 我想加 XX 功能，應該加在哪？

| 功能類型 | 建議位置 |
|----------|----------|
| 新 API 端點 | `packages/api/src/routers/` 新增或擴充 |
| 新資料表 | `packages/db/src/schema/` 新增 + migration |
| 新外部服務 | `packages/services/src/` 新增模組 |
| 新 MCP 工具 | `packages/services/src/mcp/tools/` |
| 新 Slack 事件 | `apps/slack-bot/src/events/` |
| 新前端頁面 | `apps/web/src/routes/` |

### C. 常用命令

```bash
# 開發
bun dev                    # 啟動所有服務
bun dev --filter=server    # 只啟動 server

# 檢查
bun x ultracite check      # Lint 檢查
bun typecheck              # 型別檢查

# 測試
bun test                   # 執行測試

# 資料庫
bun db:generate            # 產生 migration
bun db:migrate             # 執行 migration
bun db:studio              # 開啟 Drizzle Studio

# 部署
cd apps/server && bunx wrangler deploy
```
