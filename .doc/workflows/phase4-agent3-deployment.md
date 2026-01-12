# Workflow Instruction: Phase 4 Agent 3 - 部署與環境配置

> **任務類型**: 部署與 DevOps
> **預估時間**: 1 工作日
> **依賴條件**: Agent 1 & 2 完成後進行完整驗證

---

## 任務目標

完成 Cloudflare Workers + Pages 的生產環境部署，包含所有環境變數設定、服務部署與驗證。

---

## 前置條件

確認以下項目已完成：
- [ ] Cloudflare 帳號已設定
- [ ] Wrangler CLI 已安裝並登入（`wrangler login`）
- [ ] Neon PostgreSQL Production 資料庫已建立
- [ ] 所有外部服務 API Keys 已取得
- [ ] Agent 1 資料遷移已完成（或進行中）
- [ ] Agent 2 音檔遷移已完成（或進行中）

---

## Task 0: 外部服務設定（需由專案負責人完成）🔑

> **重要**: 以下標記 🔑 的項目需要由**專案負責人手動完成**，無法由 AI Agent 自動化處理。
> 請在執行 Task 1 之前完成所有外部服務的設定。

---

### 0.1 Cloudflare R2 Bucket 建立 🔑

**執行者**: 專案負責人

**建立 Bucket 步驟**:

1. 登入 Cloudflare Dashboard: https://dash.cloudflare.com/
2. 選擇你的帳號 → **R2 Object Storage**
3. 點擊「**Create bucket**」
4. 設定：
   - **Bucket name**: `sales-ai-audio`
   - **Location**: 選擇最近的區域（建議 APAC - Asia Pacific）
5. 點擊「Create bucket」完成建立

**設定 Public Access（選用，如需 CDN）**:

1. 進入剛建立的 bucket → **Settings**
2. Public Access 區塊 → 啟用「**Allow public access**」
3. 或設定 Custom Domain（見 Task 4.3）

**取得 R2 API Keys**:

1. Cloudflare Dashboard → **R2** → **Overview**
2. 右上角點擊「**Manage R2 API Tokens**」
3. 點擊「**Create API Token**」
4. 設定：
   - **Token name**: `sales-ai-r2-access`
   - **Permissions**: **Object Read & Write**
   - **Specify bucket(s)**: 選擇 `sales-ai-audio`
   - **TTL**: 選擇適當的有效期限（建議 Forever 或 1 year）
5. 點擊「Create API Token」
6. **立即複製並安全保存**：
   - **Access Key ID** → 用於 `CLOUDFLARE_R2_ACCESS_KEY`
   - **Secret Access Key** → 用於 `CLOUDFLARE_R2_SECRET_KEY`

> ⚠️ Secret Access Key 只會顯示一次，請務必立即複製保存！

---

### 0.2 Slack App 建立 🔑

**執行者**: 專案負責人

**建立 Slack App**:

1. 前往 Slack API: https://api.slack.com/apps
2. 點擊「**Create New App**」→ 選擇「**From scratch**」
3. 設定：
   - **App Name**: `Sales AI Bot`
   - **Pick a workspace**: 選擇你的 Slack workspace
4. 點擊「Create App」

**設定 Bot Permissions**:

1. 左側選單 → **OAuth & Permissions**
2. 滾動到「**Scopes**」區塊 → **Bot Token Scopes**
3. 點擊「Add an OAuth Scope」新增以下權限：

| Scope | 用途 |
|-------|------|
| `commands` | 執行 slash commands |
| `chat:write` | 傳送訊息到頻道 |
| `chat:write.public` | 傳送訊息到公開頻道（不需加入） |
| `files:read` | 讀取上傳的檔案（音檔分析用） |
| `users:read` | 讀取使用者資訊 |

**設定 Slash Commands**:

1. 左側選單 → **Slash Commands**
2. 點擊「**Create New Command**」
3. 設定：
   - **Command**: `/analyze`
   - **Request URL**: `https://your-worker.workers.dev/slack/commands`（部署後更新）
   - **Short Description**: `Analyze sales conversation with MEDDIC`
   - **Usage Hint**: `[conversation_id] or help`
4. 點擊「Save」

**設定 Event Subscriptions（選用）**:

1. 左側選單 → **Event Subscriptions**
2. 開啟「**Enable Events**」
3. **Request URL**: `https://your-worker.workers.dev/slack/events`（部署後更新）

**設定 Interactivity（選用，如需 button/modal）**:

1. 左側選單 → **Interactivity & Shortcuts**
2. 開啟「**Interactivity**」
3. **Request URL**: `https://your-worker.workers.dev/slack/interactions`（部署後更新）

**安裝到 Workspace 並取得 Token**:

1. 左側選單 → **Install App**
2. 點擊「**Install to Workspace**」
3. 授權頁面點擊「Allow」
4. 安裝成功後，複製：
   - **Bot User OAuth Token** (`xoxb-...`) → 用於 `SLACK_BOT_TOKEN`

**取得 Signing Secret**:

1. 左側選單 → **Basic Information**
2. 滾動到「**App Credentials**」區塊
3. 複製 **Signing Secret** → 用於 `SLACK_SIGNING_SECRET`

---

### 0.3 Google OAuth 設定（Better Auth 登入用）🔑

**執行者**: 專案負責人

**建立 Google Cloud 專案**:

1. 前往 Google Cloud Console: https://console.cloud.google.com/
2. 點擊頂部專案選擇器 → 「**New Project**」
3. 設定：
   - **Project name**: `sales-ai-automation`
   - **Organization**: 選擇你的組織（或無）
4. 點擊「Create」

**設定 OAuth Consent Screen**:

1. 左側選單 → **APIs & Services** → **OAuth consent screen**
2. 選擇 User Type：
   - **Internal**: 僅限組織內部使用（需 Google Workspace）
   - **External**: 任何 Google 帳號皆可使用
3. 點擊「Create」
4. 填寫基本資訊：
   - **App name**: `Sales AI Automation`
   - **User support email**: 你的 email
   - **Developer contact information**: 你的 email
5. **Authorized domains** 新增：
   - `your-domain.com`（你的網域）
6. 點擊「Save and Continue」
7. **Scopes** 頁面 → 點擊「Save and Continue」（使用預設）
8. **Test users** 頁面 → 新增測試用戶（External 類型需要）
9. 點擊「Save and Continue」

**建立 OAuth Client**:

1. 左側選單 → **APIs & Services** → **Credentials**
2. 點擊「**Create Credentials**」→ 「**OAuth client ID**」
3. 設定：
   - **Application type**: Web application
   - **Name**: `Sales AI Web Client`
4. **Authorized JavaScript origins** 新增：
   ```
   https://your-app-domain.com
   http://localhost:5173
   ```
5. **Authorized redirect URIs** 新增：
   ```
   https://api.your-domain.com/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
6. 點擊「Create」
7. 複製並保存：
   - **Client ID** → 用於 `GOOGLE_CLIENT_ID`
   - **Client Secret** → 用於 `GOOGLE_CLIENT_SECRET`

---

### 0.4 Gemini API Key 取得 🔑

**執行者**: 專案負責人

**取得步驟**:

1. 前往 Google AI Studio: https://aistudio.google.com/app/apikey
2. 登入 Google 帳號
3. 點擊「**Create API Key**」
4. 選擇專案（或使用剛建立的 `sales-ai-automation`）
5. 點擊「Create API key in existing project」
6. 複製 API Key → 用於 `GEMINI_API_KEY`

**配額與計費**:

| 方案 | RPM 限制 | 費用 |
|------|----------|------|
| 免費 | 60 RPM | 免費 |
| Pay-as-you-go | 依用量 | 見 [定價頁面](https://ai.google.dev/pricing) |

> 建議：開發階段使用免費方案，生產環境建議啟用計費以獲得更高配額。

**啟用 Gemini API（如需要）**:

1. Google Cloud Console → **APIs & Services** → **Library**
2. 搜尋「Generative Language API」
3. 點擊「Enable」

---

### 0.5 Groq API Key 取得 🔑

**執行者**: 專案負責人

**取得步驟**:

1. 前往 Groq Console: https://console.groq.com/
2. 註冊或登入帳號（支援 Google/GitHub 登入）
3. 左側選單 → **API Keys**
4. 點擊「**Create API Key**」
5. 設定：
   - **Name**: `sales-ai-transcription`
6. 複製 API Key → 用於 `GROQ_API_KEY`

**配額資訊**:

| 模型 | 免費配額 | 用途 |
|------|----------|------|
| whisper-large-v3 | 7,200 秒音檔/日 | 音檔轉錄 |
| whisper-large-v3-turbo | 28,800 秒音檔/日 | 快速轉錄 |

> 免費配額足夠一般開發使用，生產環境可申請更高配額。

---

### 0.6 Neon PostgreSQL 建立 🔑

**執行者**: 專案負責人

**建立專案**:

1. 前往 Neon Console: https://console.neon.tech/
2. 點擊「**New Project**」
3. 設定：
   - **Project name**: `sales-ai-automation-v3`
   - **Postgres version**: 16（建議最新版）
   - **Region**: 選擇最近的區域
     - 亞洲：Singapore 或 Tokyo
     - 美洲：US East 或 US West
4. 點擊「Create Project」

**取得 Connection String**:

1. 專案建立後，在 **Connection Details** 區塊
2. 選擇 **Connection string** 標籤
3. 複製完整連線字串 → 用於 `DATABASE_URL`
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

**建議設定**:

1. **Connection Pooling**（推薦）:
   - Settings → Connection Pooling → Enable
   - 使用 Pooled connection string 以獲得更好效能

2. **Auto-suspend**:
   - Settings → Compute → Auto-suspend delay
   - 開發環境：5 minutes（節省成本）
   - 生產環境：Never（避免冷啟動）

3. **Branching**（選用）:
   - 可建立 `preview` branch 用於測試
   - 主 branch 用於 production

**配額資訊**:

| 方案 | 儲存空間 | 計算時間 |
|------|----------|----------|
| Free | 0.5 GB | 191.9 小時/月 |
| Launch | 10 GB | 300 小時/月 |
| Scale | 50 GB+ | 750 小時/月+ |

---

### 0.7 API Keys 清單總覽 📋

完成上述步驟後，你應該擁有以下所有 credentials：

| 環境變數 | 來源服務 | 取得位置 | 說明 |
|----------|----------|----------|------|
| `DATABASE_URL` | Neon PostgreSQL | Neon Console → Connection Details | PostgreSQL 連線字串 |
| `BETTER_AUTH_SECRET` | 自行產生 | 終端機執行 `openssl rand -base64 32` | 認證加密金鑰 |
| `BETTER_AUTH_URL` | 自行設定 | 你的 API 網域 | 例：`https://api.your-domain.com` |
| `GOOGLE_CLIENT_ID` | Google Cloud | APIs & Services → Credentials | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud | APIs & Services → Credentials | OAuth 2.0 Client Secret |
| `GEMINI_API_KEY` | Google AI Studio | aistudio.google.com/app/apikey | LLM API 金鑰 |
| `GROQ_API_KEY` | Groq | console.groq.com → API Keys | 音檔轉錄 API 金鑰 |
| `CLOUDFLARE_R2_ACCESS_KEY` | Cloudflare | R2 → Manage R2 API Tokens | R2 存取金鑰 ID |
| `CLOUDFLARE_R2_SECRET_KEY` | Cloudflare | R2 → Manage R2 API Tokens | R2 存取密鑰 |
| `SLACK_BOT_TOKEN` | Slack | api.slack.com → OAuth & Permissions | Bot OAuth Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Slack | api.slack.com → Basic Information | App Signing Secret |

**產生 BETTER_AUTH_SECRET**:

```bash
# macOS / Linux
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 任務清單

### Task 1: 環境變數設定

**目標**: 設定所有 Cloudflare Workers 的 secrets 和 environment variables

**步驟**:

#### 1.1 Server Worker Secrets

```bash
cd apps/server

# 資料庫
wrangler secret put DATABASE_URL
# 輸入: postgresql://user:password@your-neon-host/sales_ai_automation_v3

# 認證
wrangler secret put BETTER_AUTH_SECRET
# 輸入: 一個 32+ 字元的隨機字串

# LLM 服務
wrangler secret put GEMINI_API_KEY
# 輸入: 從 Google AI Studio 取得的 API Key

# 轉錄服務
wrangler secret put GROQ_API_KEY
# 輸入: 從 Groq Console 取得的 API Key

# R2 儲存
wrangler secret put CLOUDFLARE_R2_ACCESS_KEY
wrangler secret put CLOUDFLARE_R2_SECRET_KEY
```

#### 1.2 Server Worker Environment Variables

建立或更新 `apps/server/wrangler.toml`：

```toml
name = "sales-ai-server"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"
CORS_ORIGIN = "https://your-app-domain.com"
BETTER_AUTH_URL = "https://api.your-domain.com"
CLOUDFLARE_R2_BUCKET = "sales-ai-audio"
CLOUDFLARE_R2_PUBLIC_URL = "https://audio.your-domain.com"

# R2 Bucket 綁定
[[r2_buckets]]
binding = "AUDIO_BUCKET"
bucket_name = "sales-ai-audio"

[observability]
enabled = true

[env.preview]
name = "sales-ai-server-preview"
vars = { ENVIRONMENT = "preview" }
```

#### 1.3 Slack Bot Worker Secrets

```bash
cd apps/slack-bot

# Slack 認證
wrangler secret put SLACK_BOT_TOKEN
# 輸入: xoxb-...

wrangler secret put SLACK_SIGNING_SECRET
# 輸入: 從 Slack App 設定頁面取得

# 內部 API 認證
wrangler secret put API_TOKEN
# 輸入: 用於呼叫 Server API 的內部 token

wrangler secret put API_BASE_URL
# 輸入: https://api.your-domain.com
```

#### 1.4 驗證 Secrets 設定

```bash
# 列出所有 secrets（不會顯示值）
wrangler secret list

# 預期輸出
# ├── DATABASE_URL
# ├── BETTER_AUTH_SECRET
# ├── GEMINI_API_KEY
# ├── GROQ_API_KEY
# ├── CLOUDFLARE_R2_ACCESS_KEY
# └── CLOUDFLARE_R2_SECRET_KEY
```

**產出**:
- 所有 Worker secrets 已設定
- `wrangler.toml` 設定檔已更新

---

### Task 2: 資料庫設定

**目標**: 設定 Neon PostgreSQL 生產環境

**步驟**:

#### 2.1 建立 Production Branch（如使用 Neon branching）

```bash
# 使用 Neon CLI（選用）
neon branches create --name production

# 或在 Neon Dashboard 建立
# https://console.neon.tech -> Your Project -> Branches -> Create Branch
```

#### 2.2 執行 Database Migration

```bash
# 確保 DATABASE_URL 指向 production
export DATABASE_URL="postgresql://..."

# 執行 Drizzle migration
cd packages/db
bun run db:push

# 驗證表結構
bun run db:studio
```

#### 2.3 驗證資料庫狀態

```sql
-- 連接到 production database
-- 使用 Neon SQL Editor 或 psql

-- 檢查所有表
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- 預期結果
-- opportunities
-- conversations
-- meddic_analyses
-- alert_rules
-- alert_history
-- user (Better Auth)
-- session (Better Auth)
-- account (Better Auth)
-- verification (Better Auth)

-- 檢查資料筆數（在 Agent 1 完成後）
SELECT
  (SELECT COUNT(*) FROM opportunities) as opportunities,
  (SELECT COUNT(*) FROM conversations) as conversations,
  (SELECT COUNT(*) FROM meddic_analyses) as meddic_analyses;
```

**產出**:
- Production database 已建立
- 所有表結構已部署
- 資料已遷移（Agent 1 完成後驗證）

---

### Task 3: 部署執行

**目標**: 部署所有服務到 Cloudflare

#### 3.1 部署 Server Worker

```bash
# 方式 A: 使用 Alchemy（推薦）
cd packages/infra
bun run alchemy.run.ts

# 方式 B: 直接使用 wrangler
cd apps/server
wrangler deploy
```

預期輸出：
```
✅ Deployed sales-ai-server
   URL: https://sales-ai-server.your-account.workers.dev
   Routes: api.your-domain.com/*
```

#### 3.2 部署 Web（Cloudflare Pages）

```bash
cd apps/web

# 建置
bun run build

# 部署到 Cloudflare Pages
wrangler pages deploy dist --project-name=sales-ai-web
```

預期輸出：
```
✅ Deployed sales-ai-web
   URL: https://sales-ai-web.pages.dev
   Production: https://your-app-domain.com
```

設定環境變數（Pages）：
```bash
# 在 Cloudflare Dashboard -> Pages -> sales-ai-web -> Settings -> Environment variables

VITE_SERVER_URL=https://api.your-domain.com
```

#### 3.3 部署 Slack Bot Worker

```bash
cd apps/slack-bot
wrangler deploy
```

預期輸出：
```
✅ Deployed sales-ai-slack-bot
   URL: https://sales-ai-slack-bot.your-account.workers.dev
```

更新 Slack App 設定：
```markdown
1. 前往 Slack App Dashboard (api.slack.com)
2. 更新 Request URL:
   - Slash Commands: https://sales-ai-slack-bot.your-account.workers.dev/slack/commands
   - Event Subscriptions: https://sales-ai-slack-bot.your-account.workers.dev/slack/events
   - Interactivity: https://sales-ai-slack-bot.your-account.workers.dev/slack/interactions
```

#### 3.4 驗證所有部署

```bash
# 檢查所有 Workers 狀態
wrangler deployments list

# 預期輸出
# sales-ai-server: Active (1 hour ago)
# sales-ai-slack-bot: Active (30 minutes ago)
```

**產出**:
- Server Worker 已部署
- Web 已部署到 Cloudflare Pages
- Slack Bot Worker 已部署
- Slack App Request URLs 已更新

---

### Task 4: DNS 與 SSL 設定

**目標**: 設定自訂網域與 SSL

#### 4.1 設定 Custom Domain（Server Worker）

```bash
# 在 Cloudflare Dashboard -> Workers -> sales-ai-server -> Settings -> Domains & Routes

# 添加 Custom Domain
api.your-domain.com
```

或使用 wrangler：
```bash
wrangler route create "api.your-domain.com/*" --zone your-zone-id
```

#### 4.2 設定 Custom Domain（Web Pages）

```bash
# 在 Cloudflare Dashboard -> Pages -> sales-ai-web -> Custom domains

# 添加 Custom Domain
your-app-domain.com
www.your-app-domain.com
```

#### 4.3 設定 Custom Domain（R2 Audio）

```bash
# 在 Cloudflare Dashboard -> R2 -> sales-ai-audio -> Settings -> Custom Domain

# 添加 Custom Domain
audio.your-domain.com
```

#### 4.4 驗證 SSL

```bash
# 檢查 SSL 憑證
curl -I https://api.your-domain.com
curl -I https://your-app-domain.com
curl -I https://audio.your-domain.com

# 預期：HTTP/2 200，包含 SSL 憑證資訊
```

#### 4.5 設定 CORS

確認 Server Worker 的 CORS 設定正確：

```typescript
// apps/server/src/index.ts
// 確認 CORS 設定
app.use(cors({
  origin: ['https://your-app-domain.com'],
  credentials: true,
}));
```

**產出**:
- 所有 Custom Domain 已設定
- SSL 憑證有效
- CORS 設定正確

---

### Task 5: 服務驗證

**目標**: 驗證所有服務正常運作

#### 5.1 API 健康檢查

```bash
# 基本健康檢查
curl https://api.your-domain.com/api/health

# 預期回應
{
  "status": "healthy",
  "version": "3.0.0",
  "services": {
    "database": "connected",
    "r2": "connected"
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
```

#### 5.2 Auth 流程驗證

```bash
# 1. 開啟瀏覽器
# 2. 前往 https://your-app-domain.com
# 3. 點擊「登入」
# 4. 使用 Google 登入
# 5. 驗證成功登入後看到 Dashboard

# API 驗證
curl -X POST https://api.your-domain.com/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

#### 5.3 Slack Bot 驗證

```bash
# 1. 在 Slack workspace 執行
/analyze help

# 預期回應：顯示使用說明

# 2. 測試分析指令（使用已遷移的 conversation）
/analyze conv_abc123

# 預期回應：顯示 MEDDIC 分析結果
```

#### 5.4 前端頁面驗證

```markdown
驗證清單：
- [ ] 首頁載入正常（https://your-app-domain.com）
- [ ] 登入功能正常
- [ ] Dashboard 顯示統計資料
- [ ] Opportunities 列表顯示資料
- [ ] Conversations 列表顯示資料
- [ ] MEDDIC 雷達圖顯示正確
- [ ] 音檔可以播放
- [ ] Alert 設定頁面正常
```

#### 5.5 端對端流程測試

```markdown
完整流程測試：
1. [ ] 登入系統
2. [ ] 查看 Opportunities 列表
3. [ ] 點擊進入 Opportunity 詳情
4. [ ] 查看 Conversations
5. [ ] 點擊 Conversation 查看轉錄文字
6. [ ] 播放音檔
7. [ ] 查看 MEDDIC 分析結果
8. [ ] 在 Slack 使用 /analyze 指令
9. [ ] 確認 Alert 通知功能
```

**產出**:
- 健康檢查報告
- 服務驗證清單（全部通過）

---

### Task 6: 監控設定

**目標**: 設定生產環境監控

#### 6.1 Cloudflare Analytics

```markdown
在 Cloudflare Dashboard 確認：
- [ ] Workers Analytics 已啟用
- [ ] Pages Analytics 已啟用
- [ ] R2 Analytics 已啟用
```

#### 6.2 錯誤通知（Slack Webhook）

```bash
# 1. 在 Slack 建立 Incoming Webhook
# Slack App -> Features -> Incoming Webhooks -> Create

# 2. 設定 Worker 錯誤通知
# 使用 Cloudflare Notifications
# Dashboard -> Notifications -> Create -> Select: Workers

# 通知類型：
# - Worker 錯誤率超過 1%
# - Worker 回應時間超過 1000ms
# - Worker CPU 時間超過限制
```

#### 6.3 Uptime 監控

```markdown
推薦使用：
- UptimeRobot（免費）
- Better Uptime
- Cloudflare Health Checks（Pro 方案）

監控端點：
1. https://api.your-domain.com/api/health (每 5 分鐘)
2. https://your-app-domain.com (每 5 分鐘)
3. https://sales-ai-slack-bot.your-account.workers.dev/health (每 10 分鐘)

Alert 通知：
- Email
- Slack channel (#ops-alerts)
```

#### 6.4 日誌設定

```bash
# 啟用 Workers Logpush（需要 Workers Paid）
# 或使用 wrangler tail 即時查看日誌
wrangler tail sales-ai-server

# 日誌輸出到 R2（選用）
# Dashboard -> Analytics & Logs -> Logpush
```

**產出**:
- Cloudflare Analytics 已啟用
- 錯誤通知已設定
- Uptime 監控已設定
- 日誌收集已設定

---

### Task 7: Preview 環境部署（選用）

**目標**: 設定 Preview/Staging 環境用於測試

#### 7.1 Neon Preview Branch

```bash
# 使用 Neon CLI 建立 preview branch
neon branches create --name preview --parent main

# 或在 Neon Dashboard
# Console -> Branches -> Create Branch
# - Branch name: preview
# - Parent: main
```

取得 Preview Database URL：
```
postgresql://user:password@ep-xxx-preview.region.aws.neon.tech/neondb?sslmode=require
```

#### 7.2 Preview Worker 部署

更新 `apps/server/wrangler.toml`：

```toml
# 在現有設定後新增
[env.preview]
name = "sales-ai-server-preview"
vars = { ENVIRONMENT = "preview", CORS_ORIGIN = "https://preview.your-domain.com" }
```

部署 Preview Worker：

```bash
cd apps/server

# 設定 preview secrets
wrangler secret put DATABASE_URL --env preview
# 輸入 preview branch 的 connection string

wrangler secret put BETTER_AUTH_SECRET --env preview
wrangler secret put GEMINI_API_KEY --env preview
wrangler secret put GROQ_API_KEY --env preview

# 部署
wrangler deploy --env preview
```

#### 7.3 Preview Pages 部署

```bash
cd apps/web

# 建置 preview 版本
VITE_SERVER_URL=https://sales-ai-server-preview.your-account.workers.dev bun run build

# 部署到 preview
wrangler pages deploy dist --project-name=sales-ai-web --branch=preview
```

或設定 Cloudflare Pages 自動 Preview：

1. Cloudflare Dashboard → Pages → sales-ai-web → Settings
2. Builds & deployments → Preview branches
3. 啟用 **Automatic preview deployments**
4. 設定 Preview environment variables：
   - `VITE_SERVER_URL` = `https://sales-ai-server-preview.your-account.workers.dev`

#### 7.4 Preview 環境驗證

```bash
# 驗證 Preview API
curl https://sales-ai-server-preview.your-account.workers.dev/api/health

# 驗證 Preview Web
# 開啟瀏覽器前往 preview URL
```

**產出**:
- Preview database branch 已建立
- Preview Worker 已部署
- Preview Pages 已設定
- Preview 環境可用於測試

---

### Task 8: CI/CD 整合（選用）

**目標**: 設定 GitHub Actions 自動化部署

#### 8.1 GitHub Secrets 設定 🔑

**執行者**: 專案負責人

前往 GitHub Repository → Settings → Secrets and variables → Actions

新增以下 Repository Secrets：

| Secret Name | 說明 | 取得方式 |
|-------------|------|----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | Cloudflare Dashboard → My Profile → API Tokens → Create Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | Cloudflare Dashboard → 任意頁面 URL 中的 account ID |
| `DATABASE_URL` | Production DB URL | Neon Console |
| `BETTER_AUTH_SECRET` | Auth Secret | 已產生的 secret |
| `GEMINI_API_KEY` | Gemini API Key | Google AI Studio |
| `GROQ_API_KEY` | Groq API Key | Groq Console |

**建立 Cloudflare API Token**:

1. Cloudflare Dashboard → My Profile → API Tokens
2. 點擊「Create Token」
3. 選擇「Custom token」
4. 設定權限：
   - **Account** - Workers Scripts: Edit
   - **Account** - Workers R2 Storage: Edit
   - **Account** - Cloudflare Pages: Edit
   - **Zone** - Zone: Read（如需 custom domain）
5. 點擊「Continue to summary」→「Create Token」
6. 複製 Token → 用於 `CLOUDFLARE_API_TOKEN`

#### 8.2 GitHub Actions Workflow

建立 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

jobs:
  # 測試
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun run typecheck

      - name: Lint
        run: bun x ultracite check

      - name: Test
        run: bun test

  # 部署 Server Worker
  deploy-server:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Deploy Server Worker
        working-directory: apps/server
        run: bunx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  # 部署 Web (Pages)
  deploy-web:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Build Web
        working-directory: apps/web
        run: bun run build
        env:
          VITE_SERVER_URL: ${{ vars.VITE_SERVER_URL }}

      - name: Deploy to Cloudflare Pages
        working-directory: apps/web
        run: bunx wrangler pages deploy dist --project-name=sales-ai-web
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  # 部署 Slack Bot
  deploy-slack-bot:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Deploy Slack Bot Worker
        working-directory: apps/slack-bot
        run: bunx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  # Preview 部署（PR）
  deploy-preview:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Deploy Server Preview
        working-directory: apps/server
        run: bunx wrangler deploy --env preview
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Build Web Preview
        working-directory: apps/web
        run: bun run build
        env:
          VITE_SERVER_URL: ${{ vars.VITE_PREVIEW_SERVER_URL }}

      - name: Deploy Web Preview
        working-directory: apps/web
        run: bunx wrangler pages deploy dist --project-name=sales-ai-web --branch=${{ github.head_ref }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Comment Preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deployed!\n\n- Web: https://${{ github.head_ref }}.sales-ai-web.pages.dev\n- API: https://sales-ai-server-preview.your-account.workers.dev'
            })
```

#### 8.3 GitHub Variables 設定

前往 GitHub Repository → Settings → Secrets and variables → Actions → Variables

新增以下 Repository Variables：

| Variable Name | 值 |
|---------------|-----|
| `VITE_SERVER_URL` | `https://api.your-domain.com` |
| `VITE_PREVIEW_SERVER_URL` | `https://sales-ai-server-preview.your-account.workers.dev` |

#### 8.4 驗證 CI/CD

1. 推送一個 commit 到 `main` branch
2. 前往 GitHub → Actions 檢查 workflow 執行狀態
3. 確認所有 jobs 成功完成
4. 驗證服務已更新

**產出**:
- GitHub Secrets 已設定
- GitHub Actions workflow 已建立
- 自動化部署流程已驗證

---

## 驗收標準

完成此任務後，應達成以下標準：

- [ ] 所有 Worker secrets 已設定
- [ ] Production database 已建立且 schema 正確
- [ ] Server Worker 部署成功，回應 < 500ms
- [ ] Web 部署成功，頁面載入正常
- [ ] Slack Bot 部署成功，指令回應正常
- [ ] 所有 Custom Domain 已設定
- [ ] SSL 憑證有效
- [ ] CORS 設定正確
- [ ] Auth 流程正常（登入/登出）
- [ ] 端對端測試通過
- [ ] 監控已設定

---

## 產出檔案

部署完成後應產出：

```
.doc/deployment/
├── production-checklist.md       # 部署檢查清單
├── service-urls.md               # 所有服務 URL
├── secrets-inventory.md          # Secrets 清單（不含值）
└── monitoring-setup.md           # 監控設定文件
```

### service-urls.md 範例

```markdown
# Sales AI Automation V3 - Service URLs

## Production

| Service | URL | Description |
|---------|-----|-------------|
| Web App | https://your-app-domain.com | 前端應用 |
| API | https://api.your-domain.com | 後端 API |
| Slack Bot | https://sales-ai-slack-bot.xxx.workers.dev | Slack Bot |
| Audio CDN | https://audio.your-domain.com | 音檔儲存 |

## Cloudflare Dashboard

| Service | Dashboard URL |
|---------|---------------|
| Workers | https://dash.cloudflare.com/.../workers/sales-ai-server |
| Pages | https://dash.cloudflare.com/.../pages/sales-ai-web |
| R2 | https://dash.cloudflare.com/.../r2/sales-ai-audio |

## External Services

| Service | Dashboard URL |
|---------|---------------|
| Neon PostgreSQL | https://console.neon.tech/... |
| Google AI Studio | https://makersuite.google.com/... |
| Groq Console | https://console.groq.com/... |
| Slack App | https://api.slack.com/apps/... |
```

---

## 故障排除

### 問題 1: Worker 部署失敗

**症狀**: `Error: Failed to publish worker`

**解決方案**:
1. 檢查 `wrangler.toml` 語法
2. 確認已登入 `wrangler login`
3. 檢查 Worker 大小限制（免費方案 1MB）

### 問題 2: Database 連線失敗

**症狀**: `Error: Connection refused`

**解決方案**:
1. 確認 Neon database 已啟動（非 suspended）
2. 檢查 DATABASE_URL 格式
3. 確認 IP 白名單（Neon 預設允許所有）

### 問題 3: Slack Bot 無回應

**症狀**: Slack 指令沒有回應

**解決方案**:
1. 檢查 Slack App Request URL 設定
2. 驗證 SLACK_SIGNING_SECRET 正確
3. 查看 Worker 日誌 `wrangler tail sales-ai-slack-bot`

### 問題 4: CORS 錯誤

**症狀**: 瀏覽器 console 顯示 CORS error

**解決方案**:
1. 確認 CORS_ORIGIN 設定正確
2. 檢查是否包含 protocol（https://）
3. 確認沒有 trailing slash

### 問題 5: Auth 失敗

**症狀**: 登入後無法取得 session

**解決方案**:
1. 確認 BETTER_AUTH_SECRET 已設定
2. 確認 BETTER_AUTH_URL 正確
3. 檢查 cookie domain 設定

---

## 回滾計畫

如果部署後發現問題需要回滾：

```bash
# 1. 回滾 Worker 到上一個版本
wrangler rollback sales-ai-server --version previous

# 2. 回滾 Pages 到上一個版本
# Cloudflare Dashboard -> Pages -> Deployments -> 選擇上一個 -> Rollback

# 3. 資料庫回滾（謹慎）
# 使用 Neon 的 Point-in-time restore
# 或執行 rollback migration
```

---

## 下一步

完成部署後：
1. 通知團隊部署完成
2. 發送服務 URL 給相關人員
3. 進行 UAT（用戶驗收測試）
4. 開始 Phase 5（完整銷售模組開發）
5. 設定提醒：7 天後評估是否關閉 V2 系統
