# 建立 Beauty Slack App 完整指南

> **所需時間**: 2-3 分鐘
> **前置需求**: Slack Workspace 管理員權限

---

## 🚀 方法 1: 使用 App Manifest (推薦 - 30 秒完成)

### 步驟 1: 前往 Slack App 建立頁面

1. 開啟瀏覽器,前往:
   ```
   https://api.slack.com/apps?new_app=1
   ```

2. 點擊 **"From an app manifest"**

### 步驟 2: 選擇 Workspace

1. 選擇您的 Slack Workspace
2. 點擊 **"Next"**

### 步驟 3: 貼上 Manifest

1. 選擇 **YAML** 格式

2. 複製以下內容並貼上:

```yaml
display_information:
  name: Beauty Sales Bot
  description: 美業銷售助手 - 自動分析銷售對話並提供 MEDDIC 分析
  background_color: "#e91e63"
features:
  bot_user:
    display_name: Beauty Sales Bot
    always_online: true
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - channels:history
      - channels:read
      - chat:write
      - commands
      - files:read
      - files:write
      - im:history
      - im:read
      - im:write
settings:
  event_subscriptions:
    request_url: https://sales-ai-slack-bot-beauty.salesaiautomationv3.workers.dev/slack/events
    bot_events:
      - app_mention
      - file_shared
      - message.im
  interactivity:
    is_enabled: true
    request_url: https://sales-ai-slack-bot-beauty.salesaiautomationv3.workers.dev/slack/interactivity
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

3. 點擊 **"Next"**

### 步驟 4: 確認並建立

1. 檢查設定摘要
2. 點擊 **"Create"**

### 步驟 5: 安裝到 Workspace

1. 點擊左側 **"Install App"**
2. 點擊 **"Install to Workspace"**
3. 點擊 **"Allow"** 授權

### 步驟 6: 取得憑證

#### 6.1 取得 Bot Token

1. 在 **"OAuth & Permissions"** 頁面
2. 複製 **"Bot User OAuth Token"**
   - 格式: `xoxb-...`
   - **保存此 Token** ⭐

#### 6.2 取得 Signing Secret

1. 點擊左側 **"Basic Information"**
2. 找到 **"App Credentials"** 區域
3. 在 **"Signing Secret"** 右側點擊 **"Show"**
4. 複製 Signing Secret
   - **保存此 Secret** ⭐

---

## 🔧 方法 2: 手動建立 (From Scratch)

如果您偏好手動設定,以下是詳細步驟:

### 步驟 1: 建立 App

1. 前往 https://api.slack.com/apps
2. 點擊 **"Create New App"**
3. 選擇 **"From scratch"**
4. 填寫:
   - **App Name**: `Beauty Sales Bot`
   - **Workspace**: 選擇您的 Workspace
5. 點擊 **"Create App"**

### 步驟 2: 設定 OAuth Scopes

1. 左側選單點擊 **"OAuth & Permissions"**
2. 滾動到 **"Scopes"** 區域
3. 在 **"Bot Token Scopes"** 中,點擊 **"Add an OAuth Scope"**
4. 依序新增以下 Scopes:

```
✅ app_mentions:read    # 讀取 @提及
✅ channels:history     # 讀取 Channel 訊息歷史
✅ channels:read        # 讀取 Channel 資訊
✅ chat:write           # 發送訊息
✅ commands             # 使用 Slash Commands
✅ files:read           # 讀取檔案
✅ files:write          # 寫入檔案
✅ im:history           # 讀取 DM 歷史
✅ im:read              # 讀取 DM
✅ im:write             # 發送 DM
```

### 步驟 3: 安裝 App

1. 在同一頁面,滾動到最上方
2. 點擊 **"Install to Workspace"**
3. 點擊 **"Allow"**
4. 複製 **"Bot User OAuth Token"** (以 `xoxb-` 開頭)

### 步驟 4: 設定 Event Subscriptions

1. 左側選單點擊 **"Event Subscriptions"**
2. 開啟 **"Enable Events"** 開關
3. 在 **"Request URL"** 填入:
   ```
   https://sales-ai-slack-bot-beauty.salesaiautomationv3.workers.dev/slack/events
   ```
4. 等待驗證 (應該會顯示 **"Verified"** ✅)
5. 展開 **"Subscribe to bot events"**
6. 點擊 **"Add Bot User Event"**,依序新增:
   ```
   ✅ app_mention
   ✅ file_shared
   ✅ message.im
   ```
7. 點擊 **"Save Changes"**

### 步驟 5: 設定 Interactivity

1. 左側選單點擊 **"Interactivity & Shortcuts"**
2. 開啟 **"Interactivity"** 開關
3. 在 **"Request URL"** 填入:
   ```
   https://sales-ai-slack-bot-beauty.salesaiautomationv3.workers.dev/slack/interactivity
   ```
4. 點擊 **"Save Changes"**

### 步驟 6: 取得 Signing Secret

1. 左側選單點擊 **"Basic Information"**
2. 找到 **"App Credentials"** 區域
3. 在 **"Signing Secret"** 右側點擊 **"Show"**
4. 複製 Signing Secret

---

## 🔑 設定 Cloudflare Worker 環境變數

取得 Bot Token 和 Signing Secret 後,設定到 Cloudflare Workers:

```bash
cd /Users/stephen/Desktop/sales_ai_automation_v3/apps/slack-bot-beauty

# 設定 Bot Token
wrangler secret put SLACK_BOT_TOKEN
# 貼上: xoxb-... (剛才複製的 Bot Token)

# 設定 Signing Secret
wrangler secret put SLACK_SIGNING_SECRET
# 貼上: ... (剛才複製的 Signing Secret)

# 設定 API 連接 (與您的 API 相關)
wrangler secret put API_BASE_URL
# 輸入您的 API URL

wrangler secret put API_TOKEN
# 輸入您的 API Token
```

---

## ✅ 驗證設定

### 1. 測試 Worker 健康檢查

```bash
curl https://sales-ai-slack-bot-beauty.salesaiautomationv3.workers.dev
```

**預期結果**:
```json
{
  "status": "ok",
  "service": "sales-ai-slack-bot-beauty",
  "productLine": "beauty",
  "timestamp": "2026-01-20T..."
}
```

### 2. 測試 Slack Event URL

在 Slack App 設定頁面的 **"Event Subscriptions"**,確認 Request URL 顯示 **"Verified"** ✅

### 3. 測試 DM 互動

1. 在 Slack 找到 **@Beauty Sales Bot**
2. 發送 DM 給它
3. 上傳一個測試音檔 (MP3 或 M4A)
4. 應該會自動彈出 **美業表單** Modal

**預期表單欄位**:
- 店型: 美髮沙龍、美甲店、美容 SPA 等
- 員工人數: 1-2人、3-5人、6-10人 等
- 現有系統

---

## 🎨 自訂 Bot 外觀 (可選)

### 1. 上傳 Bot Icon

1. 前往 **"Basic Information"**
2. 找到 **"Display Information"**
3. 點擊 **"Add App Icon"**
4. 上傳圖片 (建議 512x512 px)

### 2. 設定顏色

在 **"Display Information"** 區域:
- **Background Color**: `#e91e63` (粉紅色,區別於 iCHEF Bot)

---

## 📊 兩個 Bot 的對比

| 項目 | iCHEF Sales Bot | Beauty Sales Bot |
|------|----------------|------------------|
| **名稱** | iCHEF Sales Bot | Beauty Sales Bot |
| **Worker URL** | sales-ai-slack-bot... | sales-ai-slack-bot-beauty... |
| **產品線** | ichef | beauty |
| **表單欄位** | 店型、服務類型 | 店型、員工人數 |
| **顏色** | 藍色 | 粉紅色 (#e91e63) |
| **使用者** | iCHEF 業務團隊 | 美業業務團隊 |

---

## 🚨 常見問題

### Q1: Request URL 驗證失敗

**症狀**: Event Subscriptions 的 Request URL 顯示錯誤

**解決方法**:
1. 確認 Worker 已部署: `wrangler whoami`
2. 測試 URL: `curl https://sales-ai-slack-bot-beauty.salesaiautomationv3.workers.dev`
3. 檢查 Worker logs: `wrangler tail sales-ai-slack-bot-beauty`

### Q2: 上傳音檔後沒有反應

**症狀**: 在 DM 上傳音檔,但沒有彈出 Modal

**解決方法**:
1. 確認已設定 `SLACK_BOT_TOKEN` 和 `SLACK_SIGNING_SECRET`
2. 檢查 Event Subscriptions 是否包含 `file_shared` 和 `message.im`
3. 查看 Worker logs 確認是否收到事件

### Q3: Modal 顯示的是 iCHEF 表單而非美業表單

**症狀**: Beauty Bot 顯示錯誤的表單欄位

**解決方法**:
1. 確認 `wrangler.toml` 中有 `PRODUCT_LINE = "beauty"`
2. 重新部署: `wrangler deploy`
3. 清除瀏覽器快取

---

## 🎯 完成檢查清單

- [ ] ✅ Beauty Slack App 已建立
- [ ] ✅ Bot Token 已取得並設定到 Worker
- [ ] ✅ Signing Secret 已取得並設定到 Worker
- [ ] ✅ Event Subscriptions URL 已驗證
- [ ] ✅ Interactivity URL 已驗證
- [ ] ✅ 已安裝到 Workspace
- [ ] ✅ 測試 DM 上傳音檔成功
- [ ] ✅ Modal 顯示美業表單欄位
- [ ] ✅ (可選) 已上傳 Bot Icon

---

## 📚 相關文件

- **App Manifest 檔案**: `.doc/beauty-slack-app-manifest.yaml`
- **雙 Bot 架構方案**: `.doc/20260119_雙Slack_Bot架構方案.md`
- **部署完成報告**: `.doc/20260119_雙Slack_Bot部署完成報告.md`

---

## 🎉 完成!

完成以上步驟後,您就有兩個功能完整的 Slack Bot:

1. **iCHEF Sales Bot** - 服務 iCHEF 業務團隊
2. **Beauty Sales Bot** - 服務美業業務團隊

業務人員只需要:
1. DM 對應的 Bot
2. 上傳音檔
3. 填寫自動彈出的表單

系統會自動:
- 根據 Bot 判斷產品線
- 使用對應的 MEDDIC Prompts 分析
- 將資料標記正確的 `product_line`

---

**文件版本**: v1.0
**建立時間**: 2026-01-20
**預計完成時間**: 2-3 分鐘
