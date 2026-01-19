# Sales AI Automation V3 - 設定檢查清單

**日期**: 2026-01-15
**版本**: V3.0.0

---

## 📋 快速設定指南 (15 分鐘)

### 階段 1: Google Cloud Console 設定 (5 分鐘)

#### 1.1 建立專案

- [ ] 前往 [Google Cloud Console](https://console.cloud.google.com/)
- [ ] 點擊 **選擇專案** → **新增專案**
- [ ] 專案名稱: `Sales-AI-Automation-V3`
- [ ] 點擊 **建立**

#### 1.2 啟用 API

- [ ] 在專案中,前往 **API 和服務** → **程式庫**
- [ ] 搜尋並啟用: **Google Drive API**
- [ ] 搜尋並啟用: **Google Calendar API**

#### 1.3 建立 OAuth 憑證

- [ ] 前往 **API 和服務** → **憑證**
- [ ] 點擊 **建立憑證** → **OAuth 用戶端 ID**
- [ ] 應用程式類型: 選擇 **桌面應用程式**
- [ ] 名稱: `Sales AI Automation OAuth Client`
- [ ] 點擊 **建立**
- [ ] 下載 JSON 檔案 (包含 `client_id` 和 `client_secret`)

---

### 階段 2: 取得 Refresh Token (5 分鐘)

#### 2.1 設定臨時環境變數

```bash
# 從下載的 JSON 檔案中複製值
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"
```

#### 2.2 執行 OAuth 設定腳本

```bash
# Step 1: 取得授權 URL
bun run scripts/setup-google-oauth.ts
```

**輸出範例**:
```
📋 步驟 1: 授權應用程式

請在瀏覽器中開啟以下 URL 並授權:

================================================================================
https://accounts.google.com/o/oauth2/v2/auth?client_id=...
================================================================================
```

#### 2.3 授權並取得授權碼

- [ ] 複製上述 URL 並在瀏覽器開啟
- [ ] 選擇您的 Google 帳號
- [ ] 授權應用程式存取 Drive 和 Calendar
- [ ] 複製顯示的**授權碼** (例如: `4/0AY0e-g7...`)

#### 2.4 交換 Refresh Token

```bash
# Step 2: 使用授權碼換取 Refresh Token
bun run scripts/setup-google-oauth.ts "4/0AY0e-g7xxxxxxxxxxxxx"
```

**輸出範例**:
```
✅ 成功取得 Refresh Token!

================================================================================
GOOGLE_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
================================================================================
```

- [ ] 複製 `GOOGLE_REFRESH_TOKEN` 的值

---

### 階段 3: 環境變數設定 (3 分鐘)

#### 3.1 編輯 `.env` 檔案

```bash
# 在專案根目錄
nano .env
# 或使用您喜歡的編輯器
```

#### 3.2 新增 Google OAuth 憑證

```env
# Google OAuth 2.0 憑證
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 3.3 (可選) 建立 Drive 資料夾並設定 ID

**方法 1: 在 Google Drive 網頁中建立**

- [ ] 前往 [Google Drive](https://drive.google.com/)
- [ ] 建立資料夾: `Sales AI Reports`
- [ ] 開啟資料夾,複製 URL 中的資料夾 ID
  - URL 格式: `https://drive.google.com/drive/folders/FOLDER_ID`
  - 複製 `FOLDER_ID` 部分

**方法 2: 使用測試腳本建立**

```bash
# 將在後續測試中自動建立
```

**設定環境變數**:
```env
GOOGLE_DRIVE_REPORTS_FOLDER_ID=your-folder-id
```

---

### 階段 4: 測試驗證 (2 分鐘)

#### 4.1 測試 Google 整合

```bash
bun run scripts/test-google-integration.ts
```

**預期輸出**:
```
✅ Drive API 連線成功!
   使用者: Your Name
   Email: your-email@gmail.com

✅ 上傳成功!
✅ 分享設定成功!
✅ 找到 X 個檔案
✅ 成功取得行事曆事件
✅ 事件建立成功!
✅ 事件更新成功!
✅ 事件刪除成功!
```

#### 4.2 測試端到端流程

```bash
bun run scripts/test-end-to-end.ts
```

**預期輸出**:
```
✅ 報告生成成功
✅ CSV 匯出成功
✅ 上傳成功
✅ 分享設定成功
✅ 會議建立成功

🎉 所有測試完成!
```

---

## ✅ 完整環境變數檢查清單

### 核心服務 (必須)

```env
# PostgreSQL 資料庫
- [ ] DATABASE_URL=postgresql://user:pass@host/db

# Groq Whisper (語音轉文字)
- [ ] GROQ_API_KEY=gsk_xxxxx

# Google Gemini (MEDDIC 分析)
- [ ] GEMINI_API_KEY=AIzaSyxxxxx

# Cloudflare R2 (音檔儲存)
- [ ] R2_ACCOUNT_ID=xxxxx
- [ ] R2_ACCESS_KEY_ID=xxxxx
- [ ] R2_SECRET_ACCESS_KEY=xxxxx
- [ ] R2_BUCKET_NAME=sales-ai-audio

# Slack Bot
- [ ] SLACK_BOT_TOKEN=xoxb-xxxxx
- [ ] SLACK_TEAM_CHANNEL=C123456789
- [ ] SLACK_ALERTS_CHANNEL=C987654321
```

### Google 服務 (可選,用於自動化報告分享)

```env
# Google OAuth 2.0
- [ ] GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
- [ ] GOOGLE_CLIENT_SECRET=xxxxx
- [ ] GOOGLE_REFRESH_TOKEN=1//0gxxxxx

# Google Drive (可選)
- [ ] GOOGLE_DRIVE_REPORTS_FOLDER_ID=xxxxx
```

---

## 🧪 驗證測試

### 測試 1: MCP 工具註冊

```bash
bun run packages/services/scripts/verify-phase4-tools.ts
```

**檢查點**:
- [ ] Phase 1: 7 tools ✅
- [ ] Phase 2: 11 tools ✅
- [ ] Phase 3: 28 tools ✅
- [ ] Phase 4: 13 tools ✅
- [ ] **總計: 59 tools** ✅

---

### 測試 2: Analytics 工具

```bash
bun run packages/services/scripts/verify-analytics-tools.ts
```

**檢查點**:
- [ ] generate_team_dashboard ✅
- [ ] generate_rep_performance ✅
- [ ] forecast_opportunities ✅
- [ ] export_analytics_to_sheets ✅

---

### 測試 3: Google Drive 整合

```bash
bun run scripts/test-google-integration.ts
```

**檢查點**:
- [ ] OAuth 認證成功 ✅
- [ ] 上傳測試報告 ✅
- [ ] 設定公開分享 ✅
- [ ] 搜尋檔案功能 ✅

---

### 測試 4: Google Calendar 整合

**檢查點** (同上腳本):
- [ ] 列出近期事件 ✅
- [ ] 建立測試事件 ✅
- [ ] 更新事件標題 ✅
- [ ] 刪除測試事件 ✅

---

### 測試 5: 端到端工作流程

```bash
bun run scripts/test-end-to-end.ts
```

**檢查點**:
- [ ] Workflow 1: 自動化週報 ✅
  - [ ] 生成團隊報告
  - [ ] 匯出 CSV
  - [ ] 上傳 Drive
  - [ ] 設定分享
  - [ ] 建立 Calendar 事件

- [ ] Workflow 2: 高風險商機跟進 ✅
  - [ ] 商機預測
  - [ ] 識別高風險
  - [ ] 自動排程跟進

---

## 🎯 功能驗證清單

### Analytics 功能

- [ ] 團隊績效報告生成
- [ ] 業務個人績效分析
- [ ] 商機預測與風險識別
- [ ] 數據匯出為 CSV/JSON

### Google Drive 功能

- [ ] 報告自動上傳
- [ ] 資料夾組織管理
- [ ] 權限設定 (公開/特定使用者)
- [ ] 歷史報告搜尋

### Google Calendar 功能

- [ ] 自動排程後續跟進
- [ ] 建立團隊會議
- [ ] 列出近期事件
- [ ] 更新/刪除事件

---

## 🔧 常見問題排除

### 問題 1: `Failed to get access token`

**症狀**:
```
❌ Failed to get access token: invalid_grant
```

**解決方案**:
1. Refresh Token 可能已過期
2. 重新執行 OAuth 設定流程:
   ```bash
   bun run scripts/setup-google-oauth.ts
   ```
3. 確認 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 正確

---

### 問題 2: `Permission denied` (Drive/Calendar)

**症狀**:
```
❌ 403 Forbidden: Insufficient Permission
```

**解決方案**:
1. 檢查 OAuth 權限範圍是否包含:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/calendar`
2. 重新授權並取得新的 Refresh Token
3. 確認 API 已在 Google Cloud Console 中啟用

---

### 問題 3: 資料庫連線失敗

**症狀**:
```
❌ Cannot connect to database
```

**解決方案**:
1. 檢查 `DATABASE_URL` 格式:
   ```
   postgresql://user:password@host:port/database?sslmode=require
   ```
2. 測試連線:
   ```bash
   bun run check-db-connections.ts
   ```
3. 確認 Neon PostgreSQL 允許外部連線

---

### 問題 4: 測試數據不足

**症狀**:
```
⚠️ 預測失敗: No data found
```

**解決方案**:
1. 這是正常的 - 測試環境可能沒有實際數據
2. 使用模擬數據測試:
   ```typescript
   // 測試腳本會自動使用模擬數據
   ```
3. 生產環境會有實際對話和 MEDDIC 分析數據

---

## 📚 下一步

### 立即可做

- [x] Google OAuth 配置
- [x] 測試 Google 整合
- [x] 端到端流程驗證
- [ ] 檢視生成的報告
- [ ] 在 Drive 中查看上傳的檔案

### 短期 (1-2 天)

- [ ] 建立 Drive 資料夾結構:
  ```
  Sales AI Reports/
  ├── 2026-01/
  ├── 2026-02/
  └── Archive/
  ```
- [ ] 設定自動化排程 (cron job)
- [ ] 整合 Slack 命令

### 中期 (1-2 週)

- [ ] 實作 Slack 命令:
  - `/analyze team [period]`
  - `/analyze rep [user-id]`
  - `/forecast`
  - `/schedule-follow-up [opp-id]`

- [ ] 設定每週自動報告:
  ```typescript
  // 每週一上午 9:00 執行
  cron.schedule('0 9 * * 1', async () => {
    await generateAndShareWeeklyReport();
  });
  ```

---

## ✅ 最終檢查

**系統就緒確認**:

- [ ] 所有環境變數已設定
- [ ] 59 個 MCP 工具已註冊
- [ ] Google OAuth 配置成功
- [ ] 測試報告已上傳到 Drive
- [ ] 測試事件已建立在 Calendar
- [ ] 端到端測試全部通過

**準備部署**:

- [ ] `.env` 檔案已加入 `.gitignore`
- [ ] OAuth 憑證安全儲存
- [ ] 文檔已閱讀並理解
- [ ] 測試環境驗證完成

---

**檢查清單版本**: V1.0
**更新日期**: 2026-01-15
**預計完成時間**: 15 分鐘

🎉 **恭喜!設定完成後,您的 Sales AI Automation V3 系統即可投入使用!**

