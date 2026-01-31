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
- **MCP 工具框架** - 70+ 運維工具，自動化健康檢查與修復

## 快速開始

### 安裝依賴

```bash
bun install
```

### 資料庫設定

```bash
# 設定環境變數
cp apps/server/.env.example apps/server/.env
# 編輯 DATABASE_URL

# 推送 Schema
bun run db:push
```

### 啟動開發伺服器

```bash
bun run dev
```

- Web：http://localhost:3001
- API：http://localhost:3000

---

## 專案文件

> **重要**：完整的架構說明請參閱 [.doc/ARCHITECTURE.md](.doc/ARCHITECTURE.md)

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](.doc/ARCHITECTURE.md) | 完整專案架構說明（目錄結構、資料流、服務整合） |
| [務實版架構改進方案](.doc/20260131_務實版架構改進方案.md) | 待實施的架構優化計畫 |
| [CLAUDE.md](.claude/CLAUDE.md) | Claude Code 開發指引與 Skills |

---

## 系統架構

```
sales_ai_automation_v3/
├── apps/                           # 可部署應用程式
│   ├── web/                        # React Dashboard (Cloudflare Pages)
│   ├── server/                     # Hono API (Cloudflare Workers)
│   ├── slack-bot/                  # iCHEF Slack Bot
│   ├── slack-bot-beauty/           # Beauty Slack Bot
│   ├── queue-worker/               # 異步轉錄處理
│   └── lambda-audio-compressor/    # AWS Lambda 音檔壓縮
│
├── packages/                       # 共享套件
│   ├── api/                        # oRPC 路由定義
│   ├── services/                   # 核心業務邏輯（LLM、轉錄、儲存、MCP）
│   ├── db/                         # Drizzle ORM Schema
│   ├── shared/                     # 共用型別、錯誤處理
│   ├── auth/                       # Better-Auth 認證
│   ├── env/                        # 環境變數管理
│   └── claude-sdk/                 # Claude Agent SDK
│
├── scripts/                        # 維運腳本
├── tests/                          # E2E 測試
└── .doc/                           # 專案文件（架構、設計、報告）
```

### 核心資料流

```
Slack/Web 音檔上傳
        ↓
   API Server (oRPC)
        ↓
  ┌─────┴─────┐
  ↓           ↓
 R2 儲存   Queue 訊息
              ↓
       Queue Worker
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
Groq Whisper      Gemini MEDDIC
   轉錄           DAG 分析 (6 Agent)
    ↓                   ↓
    └─────────┬─────────┘
              ↓
      儲存分析結果
              ↓
      Slack 通知
```

---

## 技術棧

### 核心

| 類別 | 技術 | 說明 |
|------|------|------|
| Runtime | Bun 1.3.5 | 快速 JS 執行環境 |
| Monorepo | Turborepo | 增量建置 |
| 語言 | TypeScript 5.x | 全端型別安全 |

### 前端

| 技術 | 用途 |
|------|------|
| React 19 | UI 框架 |
| TanStack Router | 檔案式路由 |
| TanStack Query | 資料同步 |
| TailwindCSS 4 | 樣式框架 |
| shadcn/ui | UI 元件庫 |
| Recharts | MEDDIC 雷達圖 |

### 後端

| 技術 | 用途 |
|------|------|
| Hono | HTTP 框架 |
| oRPC | 端對端類型安全 API |
| Drizzle ORM | TypeScript-first ORM |
| Better-Auth | 認證系統 |

### 雲端服務

| 服務 | 用途 |
|------|------|
| Cloudflare Workers | API、Slack Bot、Queue Worker |
| Cloudflare Pages | Web 前端 |
| Cloudflare R2 | 音檔儲存 |
| Cloudflare Queues | 異步任務佇列 |
| Cloudflare KV | 報表快取 |
| Neon PostgreSQL | Serverless 資料庫 |
| AWS Lambda | 音檔壓縮 (FFmpeg) |

### AI 服務

| 服務 | 用途 | 成本 |
|------|------|------|
| Google Gemini 2.0 Flash | MEDDIC 分析 | - |
| Groq Whisper Large v3 | 語音轉文字 | $0.04/hr |

---

## 常用指令

### 開發

```bash
bun run dev              # 啟動所有應用
bun run dev:web          # 僅啟動前端 (port 3001)
bun run dev:server       # 僅啟動後端 (port 3000)
bun run build            # 建置所有應用
```

### 資料庫

```bash
bun run db:push          # 推送 Schema 變更
bun run db:generate      # 產生 Migration
bun run db:migrate       # 執行 Migration
bun run db:studio        # 開啟 Drizzle Studio
```

### 測試

```bash
bun run test             # 執行所有測試
bun run test:unit        # 單元測試
bun run test:integration # 整合測試
bun run test:e2e         # E2E 測試
```

### 程式碼品質

```bash
bun run check-types      # TypeScript 類型檢查
bun x ultracite check    # Linting 檢查
bun x ultracite fix      # 自動修正
```

---

## 部署

> **重要**：部署前請確認環境變數正確設定

### Web 前端

```bash
# 確保 apps/web/.env.production 存在
# VITE_SERVER_URL=https://sales-ai-server.salesaiautomationv3.workers.dev

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

---

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
# apps/web/.env.production
VITE_SERVER_URL=https://sales-ai-server.salesaiautomationv3.workers.dev
```

### Slack Bot 必要變數

```env
SLACK_BOT_TOKEN=...
SLACK_SIGNING_SECRET=...
API_BASE_URL=...
API_TOKEN=...
```

---

## 專案狀態

### ✅ 已完成

- Multi-Agent MEDDIC 分析系統（6 個 Agent + DAG 並行化）
- 多產品線支援（iCHEF + Beauty）
- Web Dashboard 部署
- Slack Bot 整合（音檔上傳、警示通知）
- Queue Worker 異步處理
- KV 快取系統（報表預計算）
- MCP 工具框架（70+ 運維工具）
- 待辦管理與提醒
- Claude Agent SDK 整合

### 🚧 進行中

- 架構優化（Query Layer、結構化日誌）
- 監控體系建立
- 話術知識庫
- 競品追蹤系統

---

## ID 格式規範

| 類型 | 格式 | 範例 |
|------|------|------|
| 案件編號 | `YYYYMM-IC###` | `202601-IC046` |
| 客戶編號 | `YYYYMM-######` | `201700-000001` |

---

## 相關連結

- [V2 專案](https://github.com/keweikao/sales-ai-automation-V2)
- [Groq API](https://console.groq.com/docs/)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [oRPC](https://orpc.dev/)

---

## 授權

MIT License

---

**開發團隊**：iCHEF Sales Engineering Team
