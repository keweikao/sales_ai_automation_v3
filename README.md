# Sales AI Automation V3

> AI 驅動的 B2B 銷售自動化系統，使用 MEDDIC 方法論分析銷售對話，支援多產品線（iCHEF 餐飲 + Beauty 美業）

從 [V2 Python 版本](https://github.com/keweikao/sales-ai-automation-V2) 遷移至 TypeScript 全端架構。採用 Cloudflare Workers 邊緣部署，實現端對端類型安全與零冷啟動。

## 核心功能

- **Multi-Agent MEDDIC 分析** - 6 個專門 AI Agent 協作（Context、Buyer、Seller、Summary、CRM、Coach）
- **語音轉文字** - Groq Whisper Large v3 Turbo（228x 實時速度，$0.04/hr）
- **Slack Bot 整合** - 即時警示、Thread 對話、Manager 通知、音檔上傳
- **多產品線支援** - iCHEF 餐飲 + Beauty 美業，獨立配置與 Prompts
- **CRM 自動萃取** - Salesforce 欄位自動提取
- **待辦管理** - Follow-up 設定、每日 Slack 提醒

## 系統架構

```text
sales_ai_automation_v3/
├── apps/
│   ├── web/                     # React 前端 Dashboard
│   ├── server/                  # Hono API 後端
│   ├── slack-bot/               # iCHEF Slack Bot
│   ├── slack-bot-beauty/        # Beauty Slack Bot
│   ├── queue-worker/            # 異步轉錄處理
│   └── lambda-audio-compressor/ # AWS Lambda 音檔壓縮
├── packages/
│   ├── api/                     # API 層 + 業務邏輯
│   ├── db/                      # Drizzle ORM Schema
│   ├── services/                # 外部服務整合（LLM、轉錄、儲存）
│   ├── shared/                  # 共享類型與 Zod Schemas
│   ├── auth/                    # Better-Auth 認證
│   ├── env/                     # 環境變數管理
│   ├── config/                  # 共享配置（Biome）
│   └── infra/                   # 基礎設施配置
├── scripts/                     # 工具腳本（資料遷移等）
├── tests/                       # Vitest + Playwright 測試
└── .doc/                        # 專案文件
```

## 技術棧

### 核心技術

| 類別 | 技術 | 版本 |
|------|------|------|
| Runtime | Bun | 1.3.5 |
| Monorepo | Turborepo | 2.6.3 |
| 語言 | TypeScript | 5.x |

### 前端

| 技術 | 版本 | 用途 |
|------|------|------|
| React | 19.2.3 | UI 框架 |
| TanStack Router | 1.141.1 | 檔案式路由 |
| TanStack Query | 5.90 | 資料同步 |
| TailwindCSS | 4.0.15 | 樣式框架 |
| Recharts | 3.6 | MEDDIC 雷達圖 |
| shadcn/ui | - | UI 元件庫 |

### 後端

| 技術 | 版本 | 用途 |
|------|------|------|
| Hono | 4.8.2 | HTTP 框架 |
| oRPC | 1.12.2 | 端對端類型安全 API |
| Drizzle ORM | 0.45.1 | TypeScript-first ORM |
| Better-Auth | 1.4.9 | 認證系統 |

### 雲端服務

| 服務 | 用途 |
|------|------|
| Cloudflare Workers | API 後端、Slack Bot、Queue Worker |
| Cloudflare Pages | Web 前端靜態部署 |
| Cloudflare R2 | 音檔儲存（S3 相容） |
| Cloudflare Queues | 異步轉錄任務隊列 |
| Cloudflare KV | 快取層 |
| Neon PostgreSQL | Serverless 資料庫 |
| AWS Lambda | 音檔壓縮（FFmpeg） |

### AI 服務

| 服務 | 用途 | 成本 |
|------|------|------|
| Google Gemini 2.0 Flash | MEDDIC 分析引擎 | - |
| Groq Whisper Large v3 Turbo | 語音轉文字 | $0.04/hr |

### 開發工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Biome (Ultracite) | 2.3.11 | Linting & Formatting |
| Vitest | 3.1 | 單元/整合測試 |
| Playwright | 1.50 | E2E 測試 |
| Wrangler | 4.59 | Cloudflare CLI |
| Lefthook | 2.0 | Git Hooks |

## 應用程式

| 應用 | 說明 | 部署目標 |
|------|------|----------|
| **web** | React 前端 Dashboard，MEDDIC 視覺化、機會管理 | Cloudflare Pages |
| **server** | Hono + oRPC API，認證、業務邏輯、隊列生產者 | Cloudflare Workers |
| **slack-bot** | iCHEF 產線 Slack Bot，音檔上傳、警示管理 | Cloudflare Workers |
| **slack-bot-beauty** | Beauty 產線 Slack Bot | Cloudflare Workers |
| **queue-worker** | 異步轉錄與 MEDDIC 分析處理 | Cloudflare Workers |
| **lambda-audio-compressor** | FFmpeg 音檔壓縮，支援 Base64/S3 輸出 | AWS Lambda |

## Getting Started

### 安裝依賴

```bash
bun install
```

### 資料庫設定

1. 設定 PostgreSQL 連線（Neon 或本地）
2. 更新 `apps/server/.env` 的 `DATABASE_URL`
3. 推送 Schema：

```bash
bun run db:push
```

### 啟動開發伺服器

```bash
bun run dev
```

- Web：<http://localhost:3001>
- API：<http://localhost:3000>

## 常用指令

### 開發

```bash
bun run dev           # 啟動所有應用（web + server）
bun run dev:web       # 僅啟動前端（port 3001）
bun run dev:server    # 僅啟動後端（port 3000）
bun run build         # 建置所有應用
```

### 資料庫

```bash
bun run db:push       # 推送 Schema 變更
bun run db:generate   # 產生 Migration 檔案
bun run db:migrate    # 執行 Migration
bun run db:studio     # 開啟 Drizzle Studio UI
bun run db:seed       # 執行種子資料
```

### 測試

```bash
bun run test          # 執行所有測試
bun run test:watch    # 監控模式
bun run test:unit     # 單元測試
bun run test:integration  # 整合測試
bun run test:e2e      # E2E 測試
bun run test:e2e:ui   # E2E UI 模式
```

### 程式碼品質

```bash
bun run check-types       # TypeScript 類型檢查
bun x ultracite check     # Linting 檢查
bun x ultracite fix       # 自動修正
```

## 部署

### Web 前端

> **重要**：確保 `apps/web/.env.production` 存在且正確設定 `VITE_SERVER_URL`

```bash
cd apps/web
bun run build
bunx wrangler pages deploy dist --project-name=sales-ai-web --branch=main
```

### Server API

```bash
cd apps/server
bunx wrangler deploy
```

### Slack Bot

```bash
cd apps/slack-bot
bunx wrangler deploy

# Beauty 產線
cd apps/slack-bot-beauty
bunx wrangler deploy
```

### Queue Worker

```bash
cd apps/queue-worker
bunx wrangler deploy
```

## 環境變數

### Server 必要變數

```env
DATABASE_URL=postgresql://...
DATABASE_URL_DIRECT=postgresql://...
BETTER_AUTH_SECRET=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
SLACK_BOT_TOKEN=...
```

### Web 必要變數

```env
# .env.production
VITE_SERVER_URL=https://sales-ai-server.salesaiautomationv3.workers.dev
```

### Slack Bot 必要變數

```env
SLACK_BOT_TOKEN=...
SLACK_SIGNING_SECRET=...
API_BASE_URL=...
API_TOKEN=...
```

## 專案狀態

### ✅ 已完成

- Multi-Agent MEDDIC 分析系統（6 個 Agent）
- 多產品線支援（iCHEF + Beauty）
- Web Dashboard 部署
- Slack Bot 基礎設施
- Queue Worker 異步處理
- KV 快取系統
- 待辦管理與提醒

### 🚧 進行中

- 監控體系建立
- 話術知識庫
- 競品追蹤系統

## 相關連結

- [V2 專案](https://github.com/keweikao/sales-ai-automation-V2)
- [Groq API](https://console.groq.com/docs/)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Drizzle ORM](https://orm.drizzle.team/)

## 授權

MIT License

---

**開發團隊**：iCHEF Sales Engineering Team
