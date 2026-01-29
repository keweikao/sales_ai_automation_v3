# Staging 環境設置指南

> 建立日期：2026-01-28

本文件說明如何在 Cloudflare 上設置完整的 Staging 環境。

---

## 架構概覽

```
                    Staging 環境
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ┌─────────────────┐      ┌─────────────────────┐     │
│   │  Web (Staging)  │ ───▶ │  Server (Staging)   │     │
│   │  Pages: staging │      │  sales-ai-server-   │     │
│   │                 │      │  staging            │     │
│   └─────────────────┘      └──────────┬──────────┘     │
│                                       │                 │
│                                       ▼                 │
│                            ┌─────────────────────┐     │
│                            │  Queue Worker       │     │
│                            │  (Staging)          │     │
│                            └──────────┬──────────┘     │
│                                       │                 │
│                                       ▼                 │
│                            ┌─────────────────────┐     │
│                            │  Neon DB (Branch)   │     │
│                            │  或獨立測試資料庫    │     │
│                            └─────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: 建立 Staging Queue

在 Cloudflare Dashboard 建立 Staging 用的 Queue：

```bash
# 建立 Staging 轉錄隊列
cd apps/server
bunx wrangler queues create transcription-queue-staging
```

記下 Queue ID，更新 `apps/server/wrangler.toml` 和 `apps/queue-worker/wrangler.toml` 中的配置。

---

## Step 2: 設置 Server Staging 環境

### 2.1 部署 Staging Worker

```bash
cd apps/server
bunx wrangler deploy --env staging
```

### 2.2 設置 Staging Secrets

```bash
cd apps/server

# 資料庫連線 (建議使用 Neon branch 或獨立測試資料庫)
bunx wrangler secret put DATABASE_URL --env staging
bunx wrangler secret put DATABASE_URL_DIRECT --env staging

# 認證
bunx wrangler secret put BETTER_AUTH_SECRET --env staging

# AI API Keys (可共用 production 的 keys)
bunx wrangler secret put GEMINI_API_KEY --env staging
bunx wrangler secret put GROQ_API_KEY --env staging

# R2 Storage (建議使用獨立的 staging bucket)
bunx wrangler secret put CLOUDFLARE_R2_ACCESS_KEY --env staging
bunx wrangler secret put CLOUDFLARE_R2_SECRET_KEY --env staging
bunx wrangler secret put CLOUDFLARE_R2_BUCKET --env staging
bunx wrangler secret put CLOUDFLARE_R2_ENDPOINT --env staging

# Slack (使用測試頻道的 token，或共用)
bunx wrangler secret put SLACK_BOT_TOKEN --env staging
```

---

## Step 3: 設置 Queue Worker Staging 環境

### 3.1 部署 Staging Worker

```bash
cd apps/queue-worker
bunx wrangler deploy --env staging
```

### 3.2 設置 Staging Secrets

```bash
cd apps/queue-worker

# 資料庫連線
bunx wrangler secret put DATABASE_URL --env staging
bunx wrangler secret put DATABASE_URL_DIRECT --env staging

# AI API Keys
bunx wrangler secret put GEMINI_API_KEY --env staging
bunx wrangler secret put GROQ_API_KEY --env staging

# Slack
bunx wrangler secret put SLACK_BOT_TOKEN --env staging
bunx wrangler secret put SLACK_SIGNING_SECRET --env staging
```

---

## Step 4: 設置 Web Staging 環境

Web 前端使用 Cloudflare Pages，透過 branch 來區分環境。

### 4.1 手動部署到 Staging

```bash
cd apps/web

# 使用 staging 環境變數建置
VITE_SERVER_URL=https://sales-ai-server-staging.salesaiautomationv3.workers.dev bun run build

# 部署到 staging branch
bunx wrangler pages deploy dist --project-name=sales-ai-web --branch=staging
```

### 4.2 自動部署設定（GitHub）

在 Cloudflare Pages 設定：
1. 進入 **Cloudflare Dashboard** → **Pages** → **sales-ai-web**
2. **Settings** → **Builds & deployments**
3. **Branch deployments** 設定：
   - Production branch: `main`
   - Preview branches: 包含 `staging`, `develop`, `feature/*`

### 4.3 環境變數設定

在 Cloudflare Pages Dashboard 設定：

| 變數名稱 | Production 值 | Preview 值 |
|----------|---------------|------------|
| `VITE_SERVER_URL` | `https://sales-ai-server.salesaiautomationv3.workers.dev` | `https://sales-ai-server-staging.salesaiautomationv3.workers.dev` |

---

## Step 5: 資料庫設置

### 方案 A: 使用 Neon Branch（推薦）

Neon 支援資料庫分支，可以從 production 建立獨立的 staging 分支：

1. 登入 Neon Console
2. 選擇你的專案
3. **Branches** → **Create branch**
4. 命名為 `staging`
5. 複製連線字串，用於 staging 環境

優點：
- 資料結構與 production 一致
- 可隨時從 production 同步資料
- 隔離性好，不影響 production

### 方案 B: 使用獨立資料庫

建立完全獨立的測試資料庫：

```bash
# 執行 migration
DATABASE_URL=<staging-db-url> bun run db:push

# 執行 seed（如果需要測試資料）
DATABASE_URL=<staging-db-url> bun run db:seed
```

---

## Step 6: 驗證 Staging 環境

### 6.1 檢查服務狀態

```bash
# Server health check
curl https://sales-ai-server-staging.salesaiautomationv3.workers.dev/health

# Web 前端
open https://staging.sales-ai-web.pages.dev
```

### 6.2 測試完整流程

1. 開啟 Staging Web: `https://staging.sales-ai-web.pages.dev`
2. 登入測試帳號
3. 測試核心功能：
   - 建立對話記錄
   - 上傳音檔轉錄
   - 查看分析結果
   - 確認 Slack 通知（如有配置）

---

## 使用方式

### 部署到 Staging

```bash
# 部署所有服務到 Staging
./scripts/deploy-staging.sh all

# 只部署特定服務
./scripts/deploy-staging.sh server
./scripts/deploy-staging.sh queue-worker
./scripts/deploy-staging.sh web
```

### 部署到 Production（經過 Staging 驗證後）

```bash
# 部署所有服務到 Production
./scripts/deploy-production.sh all

# 只部署特定服務
./scripts/deploy-production.sh server
```

### 緊急回滾

```bash
# 回滾 Staging
./scripts/rollback.sh server staging

# 回滾 Production
./scripts/rollback.sh server production

# 回滾所有服務
./scripts/rollback.sh all production
```

---

## URL 總覽

| 環境 | 服務 | URL |
|------|------|-----|
| **Production** | Web | https://sales-ai-web.pages.dev |
| **Production** | Server | https://sales-ai-server.salesaiautomationv3.workers.dev |
| **Staging** | Web | https://staging.sales-ai-web.pages.dev |
| **Staging** | Server | https://sales-ai-server-staging.salesaiautomationv3.workers.dev |

---

## 部署流程圖

```
開發完成
    │
    ▼
┌──────────────────┐
│ git push         │
│ (feature branch) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ PR Review        │
│ CI 檢查通過       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 合併到 develop   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────┐
│ ./scripts/deploy-staging.sh all │
│ 部署到 Staging 環境              │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Staging 驗證     │
│ - 功能測試       │
│ - 回歸測試       │
└────────┬─────────┘
         │
    驗證通過?
    ├── No ──▶ 修復後重新部署 Staging
    │
    ▼ Yes
┌──────────────────────────────────────┐
│ ./scripts/deploy-production.sh all  │
│ 部署到 Production 環境               │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Production 監控  │
│ 5-10 分鐘        │
└────────┬─────────┘
         │
    發現問題?
    ├── Yes ──▶ ./scripts/rollback.sh all production
    │
    ▼ No
┌──────────────────┐
│ 部署完成 ✓       │
└──────────────────┘
```

---

## 常見問題

### Q: Staging 和 Production 共用同一個資料庫安全嗎？

**不建議**。Staging 環境應該使用獨立的資料庫，避免：
- 測試資料污染 production
- 意外刪除或修改 production 資料
- Schema 變更影響 production

### Q: 如何同步 Production 資料到 Staging？

如果使用 Neon：
1. 建立新的 branch 從 production
2. 更新 Staging 的 `DATABASE_URL`
3. 重新部署 Staging 服務

### Q: Staging 環境需要獨立的 Slack Bot 嗎？

建議使用獨立的測試頻道，而非獨立的 Bot：
1. 在 Slack 建立 `#staging-alerts` 頻道
2. Staging 環境的通知發送到這個頻道
3. 這樣可以避免測試通知干擾 production 頻道

---

## 維護清單

- [ ] 每月檢查 Staging 資料庫大小
- [ ] 定期清理 Staging 測試資料
- [ ] 確保 Staging secrets 與 Production 同步（除了資料庫）
- [ ] 檢查 Staging 服務的錯誤率
