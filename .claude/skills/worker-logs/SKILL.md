---
name: worker-logs
description: 快速查看 Cloudflare Workers 的即時日誌。比 /diagnose 更輕量，適合日常除錯和監控。支援篩選特定服務、時間範圍、錯誤類型。
---

# /worker-logs - 即時日誌查詢

## 描述
快速查看 Cloudflare Workers 的即時日誌，適合日常除錯和監控。比 `/diagnose` 更輕量，專注於日誌查看。

## 使用方式
```
/worker-logs                          # 所有服務最近 15 分鐘
/worker-logs server                   # 只看 API Server
/worker-logs queue-worker             # 只看 Queue Worker
/worker-logs slack-bot                # 只看 Slack Bot
/worker-logs --errors                 # 只看錯誤日誌
/worker-logs --last 1h                # 最近 1 小時
/worker-logs server --filter "IC918"  # 篩選特定關鍵字
```

## 可查詢的服務

| 服務名稱 | Worker 名稱 | 說明 |
|----------|-------------|------|
| server | sales-ai-server | API Server |
| queue-worker | sales-ai-queue-worker | 隊列處理 |
| slack-bot | sales-ai-slack-bot | 主 Slack Bot |
| slack-bot-beauty | sales-ai-slack-bot-beauty | 美食 Slack Bot |

## 執行流程

### 步驟 1: 解析參數

| 參數 | 預設值 | 說明 |
|------|--------|------|
| 服務 | 全部 | 指定要查看的 Worker |
| --errors | false | 只顯示錯誤（status >= 400 或 outcome != ok）|
| --last | 15m | 時間範圍（支援: 5m, 15m, 30m, 1h, 3h, 6h, 24h）|
| --filter | - | 關鍵字篩選（案件編號、錯誤訊息等）|
| --limit | 50 | 顯示筆數上限 |

### 步驟 2: 使用 cloudflare-observability MCP 查詢

**2.1 列出 Workers（如果需要確認名稱）：**
```
mcp__cloudflare-observability__workers_list
```

**2.2 查詢日誌：**
```
mcp__cloudflare-observability__query_worker_observability
```

參數設定：
- `scriptName`: 對應的 Worker 名稱
- `timeRange`: 根據 --last 參數轉換
- `filters`: 根據 --errors 和 --filter 設定

**2.3 查詢錯誤分佈（如果是 --errors）：**
```
mcp__cloudflare-observability__observability_values
```
- key: "outcome" 查看執行結果分佈
- key: "status" 查看 HTTP 狀態碼分佈

### 步驟 3: 格式化輸出

---

## 輸出格式

### 一般日誌

```markdown
## Workers 日誌
📅 2026-01-27 15:30 | 最近 15 分鐘

### server (sales-ai-server)
共 23 筆請求 | 錯誤 1 筆 (4.3%)

| 時間 | 方法 | 路徑 | 狀態 | 耗時 |
|------|------|------|------|------|
| 15:28:45 | POST | /rpc/conversation.get | 200 | 45ms |
| 15:28:30 | POST | /rpc/salesTodo.list | 200 | 32ms |
| 15:27:15 | POST | /rpc/opportunity.list | 200 | 28ms |
| 15:26:50 | POST | /rpc/meddic.get | 500 | 120ms |
| ... | ... | ... | ... | ... |

### queue-worker (sales-ai-queue-worker)
共 5 筆執行 | 錯誤 0 筆 (0%)

| 時間 | 類型 | 任務 | 結果 | 耗時 |
|------|------|------|------|------|
| 15:25:00 | queue | transcribe | ok | 45s |
| 15:20:00 | queue | analyze | ok | 12s |
| 15:15:00 | cron | daily-report | ok | 3s |
| ... | ... | ... | ... | ... |
```

### 錯誤日誌 (--errors)

```markdown
## 錯誤日誌
📅 2026-01-27 15:30 | 最近 15 分鐘

### 錯誤統計
| 服務 | 錯誤數 | 錯誤率 |
|------|--------|--------|
| server | 2 | 1.2% |
| queue-worker | 1 | 5.0% |
| slack-bot | 0 | 0% |

### 錯誤詳情

#### 🔴 15:26:50 | server
- **路徑**: POST /rpc/meddic.get
- **狀態**: 500
- **錯誤**: Database connection timeout
- **追蹤 ID**: abc123def456

#### 🔴 15:22:30 | server
- **路徑**: POST /rpc/conversation.create
- **狀態**: 400
- **錯誤**: Invalid case number format
- **追蹤 ID**: xyz789ghi012

#### 🟡 15:18:00 | queue-worker
- **任務**: transcribe
- **結果**: failed
- **錯誤**: Groq API rate limit exceeded
- **案件**: 202601-IC048
```

### 篩選結果 (--filter)

```markdown
## 日誌搜尋結果
🔍 關鍵字: "IC918" | 最近 1 小時

找到 8 筆相關日誌：

| 時間 | 服務 | 事件 | 詳情 |
|------|------|------|------|
| 15:28:45 | server | API 呼叫 | GET /rpc/conversation.get |
| 15:25:00 | queue-worker | 轉錄完成 | 時長 12:35 |
| 15:20:00 | queue-worker | 分析完成 | MEDDIC 74分 |
| 14:55:30 | slack-bot | 音檔上傳 | 大小 5.2MB |
| ... | ... | ... | ... |
```

### 無日誌

```markdown
## Workers 日誌
📅 2026-01-27 15:30 | 最近 15 分鐘

ℹ️ 指定時間範圍內無日誌記錄

可能原因：
1. 該時段沒有請求
2. Worker 尚未部署
3. 時間範圍設定過短

建議：
- 嘗試增加時間範圍: /logs --last 1h
- 檢查 Worker 狀態: /diagnose
```

---

## 時間範圍對照

| 參數 | 說明 |
|------|------|
| 5m | 5 分鐘 |
| 15m | 15 分鐘（預設）|
| 30m | 30 分鐘 |
| 1h | 1 小時 |
| 3h | 3 小時 |
| 6h | 6 小時 |
| 24h | 24 小時 |

---

## 常用查詢範例

```bash
# 查看 API Server 最近錯誤
/worker-logs server --errors

# 追蹤特定案件的處理過程
/worker-logs --filter "IC918" --last 1h

# 查看 Queue Worker 今日所有執行
/worker-logs queue-worker --last 24h

# 查看 Slack Bot 錯誤
/worker-logs slack-bot --errors --last 3h
```

---

## 整合的工具

| 工具 | 用途 |
|------|------|
| `cloudflare-observability` MCP | 查詢 Workers 日誌 |

## 相關 Skills

- `/diagnose` - 完整問題診斷（包含代碼分析和解決建議）
- `/report --errors` - 錯誤統計報告

## 注意事項

1. **日誌保留** - Cloudflare 免費方案日誌保留 24 小時
2. **即時性** - 日誌可能有 1-2 分鐘延遲
3. **敏感資訊** - 日誌可能包含敏感資料，請勿外洩
