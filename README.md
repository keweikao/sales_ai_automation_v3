# Sales AI Automation V3

> AI 驅動的 B2B 銷售自動化系統，使用 MEDDIC 方法論分析銷售對話，提供即時洞察與教練建議

這是從 [V2 Python 版本](https://github.com/keweikao/sales-ai-automation-V2) 遷移到 V3 TypeScript 全端的系統架構重組專案。採用 [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack) 現代化技術棧，實現端對端類型安全與零冷啟動部署。

## 專案概述

**核心功能**：
- 🎯 **MEDDIC 六維度分析**：Metrics、Economic Buyer、Decision Criteria、Decision Process、Identify Pain、Champion
- 🎙️ **語音轉文字**：Groq Whisper Large v3 Turbo（228x 實時速度）
- 🤖 **Multi-Agent 系統**：6 個專門 AI Agent 協作分析（Context、Buyer、Seller、Summary、CRM、Coach）
- 💬 **Slack Bot 整合**：即時警示、Thread 對話、Manager 通知
- 📊 **CRM 自動萃取**：Salesforce 欄位自動提取
- 📈 **Analytics Dashboard**：Lead 管理、趨勢分析、評分追蹤

**V2 → V3 遷移目標**：
- ✅ **開發效率**：TypeScript 全端類型安全，減少 runtime 錯誤
- ✅ **部署速度**：Cloudflare Workers 邊緣部署，0ms 冷啟動
- ✅ **維護成本**：統一技術棧，從雙語言（Python + TypeScript）簡化為單一 TypeScript
- ✅ **擴展性**：Monorepo 架構，更好的程式碼重用與類型共享

**生產環境指標**（V2）：
- 📊 處理量：~300 cases/月
- ⚡ 效能：端對端 <2 分鐘（37.5 分鐘音檔）
- 💰 成本：月成本 $15 USD → V3 預估 $13.50（降低 13%）

## 技術棧

### 前端
- **React 19** - 使用最新 React features（ref as prop）
- **TanStack Router** - 檔案式路由，完整類型安全
- **TailwindCSS** - Utility-first CSS 快速開發
- **shadcn/ui** - 可重用的 UI 元件庫
- **Recharts** - MEDDIC 雷達圖視覺化

### 後端
- **Hono** - 輕量高效的 server framework
- **oRPC** - 端對端類型安全 API + OpenAPI 整合
- **Cloudflare Workers** - 邊緣運算，0ms 冷啟動
- **Drizzle ORM** - TypeScript-first ORM
- **Neon PostgreSQL** - Serverless 資料庫

### AI & External Services
- **Google Gemini 2.0 Flash** - LLM 分析引擎
- **Groq Whisper Large v3 Turbo** - 語音轉文字（$0.04/hr）
- **Cloudflare R2** - 音檔儲存（S3 相容）
- **Slack SDK** - Bot 整合

### 開發工具
- **Bun** - 快速的 JavaScript runtime & package manager
- **Turborepo** - Monorepo 建置系統
- **Ultracite (Biome)** - 程式碼格式化與 linting
- **Better-Auth** - 認證系統

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## Deployment (Cloudflare via Alchemy)

- Dev: bun run dev
- Deploy: bun run deploy
- Destroy: bun run destroy

For more details, see the guide on [Deploying to Cloudflare with Alchemy](https://www.better-t-stack.dev/docs/guides/cloudflare-alchemy).

## 專案結構

```
Sales_ai_automation_v3/
├── apps/
│   ├── web/              # 前端應用（React + TanStack Router）
│   ├── server/           # 後端 API（Hono + oRPC）
│   └── slack-bot/        # Slack Bot（Cloudflare Workers）[待開發]
├── packages/
│   ├── api/              # API 層 / 業務邏輯
│   ├── auth/             # 認證設定與邏輯（Better-Auth）
│   ├── db/               # 資料庫 schema & queries（Drizzle）
│   └── services/         # 外部服務整合 [待開發]
│       ├── llm/          # Gemini SDK + Multi-Agent Orchestrator
│       ├── transcription/# Groq Whisper 轉錄服務
│       ├── storage/      # Cloudflare R2 檔案儲存
│       └── prompts/      # MEDDIC Prompts（從 V2 遷移）
├── scripts/              # 工具腳本
│   └── migrate-firestore-to-postgres.ts  # V2 資料遷移 [待開發]
└── .doc/                 # 專案文件
    └── v3-parallel-development-strategy.md  # 平行開發策略
```

## 可用指令

### 開發
- `bun run dev` - 啟動所有應用（web + server）
- `bun run dev:web` - 僅啟動前端（port 3001）
- `bun run dev:server` - 僅啟動後端 API（port 3000）
- `bun run build` - 建置所有應用

### 資料庫
- `bun run db:push` - 推送 schema 變更到資料庫
- `bun run db:generate` - 產生 migration 檔案
- `bun run db:studio` - 開啟 Drizzle Studio UI

### 程式碼品質
- `bun run check-types` - 檢查 TypeScript 類型
- `bun x ultracite check` - 檢查程式碼品質（linting + formatting）
- `bun x ultracite fix` - 自動修正程式碼問題

### 部署（Cloudflare）
- `bun run deploy` - 部署到 Cloudflare
- `bun run destroy` - 銷毀 Cloudflare 部署

## 開發狀態

### ✅ 已完成（Better-T-Stack 基礎）
- [x] 專案初始化（Turborepo monorepo）
- [x] Better-Auth 認證系統設定
- [x] 基礎前端架構（React + TanStack Router）
- [x] 基礎後端架構（Hono + oRPC）
- [x] Drizzle ORM 設定
- [x] Ultracite 程式碼標準設定

### 🚧 進行中（Phase 1: 基礎建設）
- [ ] **Workflow A**: Database Schema（Lead, Conversation, MEDDIC）
- [ ] **Workflow B**: UI Components（13 個 React 元件）
- [ ] **Workflow C**: External Services（Groq Whisper, Gemini, R2）+ V2 Prompts 遷移

### 📋 待開發（Phase 2-5）
- [ ] **Phase 2**: 核心功能（API Routes, Frontend Pages, Slack Bot）
- [ ] **Phase 3**: 整合測試
- [ ] **Phase 4**: 資料遷移（Firestore → PostgreSQL）
- [ ] **Phase 5**: 生產部署

詳細開發策略請參考：[.doc/v3-parallel-development-strategy.md](.doc/v3-parallel-development-strategy.md)

## V2 遷移重點

### 必須保留的核心邏輯
- ✅ **Multi-Agent Orchestrator**：七階段執行流程（並行 + 序列混合）
- ✅ **品質迴圈（Quality Loop）**：最多 2 次 refine
- ✅ **MEDDIC Prompts**：7 個生產驗證的 prompt（逐字複製）
- ✅ **Groq Whisper Pipeline**：228x 實時速度，自動分塊邏輯

### 技術決策變更
| 項目 | V2 | V3 | 原因 |
|------|----|----|------|
| 語言 | Python + TypeScript | TypeScript | 統一技術棧 |
| 資料庫 | Firestore | PostgreSQL (Neon) | 更好的關聯查詢 |
| 運算平台 | Cloud Run | Cloudflare Workers | 0ms 冷啟動 |
| 儲存 | Google Cloud Storage | Cloudflare R2 | 無出站流量費用 |
| 轉錄 | Groq Whisper | Groq Whisper | 保留（已驗證） |

## 相關連結

- **V2 專案**: [sales-ai-automation-V2](https://github.com/keweikao/sales-ai-automation-V2)
- **開發策略**: [平行開發策略文件](.doc/v3-parallel-development-strategy.md)
- **Better-T-Stack**: [官方文件](https://www.better-t-stack.dev/)
- **Groq API**: [Groq Console](https://console.groq.com/docs/)
- **Gemini API**: [Google AI Studio](https://ai.google.dev/gemini-api/docs)

## 授權

MIT License

---

**開發團隊**：iCHEF Sales Engineering Team
**專案狀態**：🚧 開發中（Phase 1）
**預計完成**：3-4 週（5 人團隊並行開發）
