---
name: diagnose
description: 快速診斷生產環境問題。當用戶報告 Slack bot 沒有回應、Queue worker 處理失敗、API 回傳 500 錯誤、轉錄服務失敗、MEDDIC 分析異常等問題時使用此 Skill。整合 Cloudflare Workers 日誌查詢、專案知識庫搜尋和代碼分析。
---

# /diagnose - 生產問題快速診斷

## 描述
快速診斷生產環境問題，整合 Cloudflare Workers 日誌、專案知識庫和代碼分析，提供問題定位和解決建議。

## 使用方式
```
/diagnose [症狀描述]
/diagnose slack bot 沒有回應
/diagnose queue worker 處理失敗
/diagnose API 回傳 500 錯誤
```

## 執行流程

### 步驟 1: 分析症狀並分類問題

根據用戶描述的症狀，判斷問題類別：

| 關鍵字 | 問題類別 | 相關服務 |
|--------|---------|---------|
| slack, bot, 通知, 回應 | Slack Bot | slack-bot, slack-bot-beauty |
| queue, 處理, 任務, job | Queue Worker | queue-worker |
| api, 500, 錯誤, 請求 | API Server | server |
| 轉錄, 音檔, whisper, groq | 語音服務 | services/transcription |
| 分析, gemini, meddic | AI 分析 | services/llm |
| 資料庫, db, 查詢, 連線 | 資料庫 | packages/db |

### 步驟 2: 搜尋專案知識庫

在 `.doc/` 目錄中搜尋相關的排查文件：

**優先搜尋的文件模式：**
- `*問題*`
- `*排查*`
- `*錯誤*`
- `*修復*`

**關鍵文件參考：**
- `.doc/20260113_Slack_Bot問題排查手冊.md` - Slack Bot 問題
- `.doc/20260113_Gemini_API錯誤處理改進文檔.md` - Gemini API 問題
- `.doc/20260113_Groq_Whisper錯誤處理改進文檔.md` - 轉錄服務問題
- `.doc/20260121_Share_API_500錯誤修復報告.md` - API 錯誤參考

### 步驟 3: 使用 MCP 查詢 Cloudflare Workers 日誌

**必須使用 cloudflare-observability MCP 服務器：**

1. 先列出可用的 Workers：
   ```
   mcp__cloudflare-observability__workers_list
   ```

2. 查詢特定 Worker 的日誌：
   ```
   mcp__cloudflare-observability__query_worker_observability
   ```

   參數建議：
   - 時間範圍：過去 1 小時
   - 過濾條件：status >= 400 或 outcome != "ok"

3. 查看可用的日誌鍵值：
   ```
   mcp__cloudflare-observability__observability_keys
   ```

4. 查看特定鍵的值分佈：
   ```
   mcp__cloudflare-observability__observability_values
   ```

### 步驟 4: 定位問題代碼

根據日誌中的錯誤訊息，使用 Grep 和 Read 工具定位相關代碼：

**常見代碼位置：**
- Slack Bot: `apps/slack-bot/src/`
- Queue Worker: `apps/queue-worker/src/`
- API Server: `apps/server/src/`
- 服務層: `packages/services/src/`
- API 路由: `packages/api/src/routers/`

### 步驟 5: 執行診斷腳本（如適用）

根據問題類型執行相關診斷腳本：

```bash
# 資料庫連線檢查
bun run scripts/check-db-simple.ts

# 遷移狀態檢查
bun run scripts/check-migration-status.ts

# 最新對話檢查
bun run scripts/check-latest-conversations.ts
```

### 步驟 6: 輸出診斷報告

**報告格式：**

```markdown
## 診斷報告

### 問題摘要
- **症狀**: [用戶描述]
- **問題類別**: [分類]
- **影響範圍**: [服務/功能]

### 日誌分析
- **錯誤數量**: [統計]
- **主要錯誤**: [錯誤訊息]
- **發生時間**: [時間範圍]

### 問題定位
- **相關檔案**: [檔案路徑:行號]
- **根本原因**: [分析結果]

### 建議解決方案
1. [步驟 1]
2. [步驟 2]
3. [步驟 3]

### 相關文件
- [文件名稱](路徑)
```

## 整合的工具

| 工具 | 用途 |
|------|------|
| `cloudflare-observability` MCP | 查詢 Workers 日誌和指標 |
| `Explore` subagent | 深入理解代碼結構 |
| `Grep` / `Read` | 搜尋和閱讀代碼 |
| `Glob` | 搜尋相關文件 |
| `Bash` | 執行診斷腳本 |

## 常見問題速查

### Slack Bot 無回應
1. 檢查 Event Subscriptions 配置
2. 查看 cloudflare-observability 日誌
3. 確認 Bot Token Scopes
4. 參考: `.doc/20260113_Slack_Bot問題排查手冊.md`

### Queue Worker 任務失敗
1. 查詢 queue-worker 錯誤日誌
2. 檢查 binding 配置 (KV, R2, D1)
3. 確認環境變數設定
4. 參考: `.doc/20260115_Queue架構部署指南.md`

### API 500 錯誤
1. 查詢 server worker 日誌
2. 檢查資料庫連線
3. 確認 API 路由邏輯
4. 參考: `.doc/20260121_Share_API_500錯誤修復報告.md`

### 轉錄服務失敗
1. 檢查 Groq API Key 有效性
2. 確認音檔格式支援
3. 檢查 R2 存儲狀態
4. 參考: `.doc/20260113_Groq_Whisper錯誤處理改進文檔.md`
