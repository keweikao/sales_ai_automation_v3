# 監控設定指南

本文件說明如何設定 Sales AI Automation 系統的部署監控與 Slack 通知功能。

## 目錄

1. [Slack Webhook 設定](#slack-webhook-設定)
2. [環境變數配置](#環境變數配置)
3. [Cloudflare 監控設定](#cloudflare-監控設定)
4. [警報閾值設定](#警報閾值設定)
5. [腳本使用指南](#腳本使用指南)

---

## Slack Webhook 設定

### 1. 建立 Slack App

1. 前往 [Slack API](https://api.slack.com/apps) 並登入
2. 點擊 **Create New App** > **From scratch**
3. 輸入 App 名稱（例如：`Sales AI 部署通知`）
4. 選擇要安裝的 Workspace

### 2. 啟用 Incoming Webhooks

1. 在 App 設定頁面，點擊左側選單的 **Incoming Webhooks**
2. 開啟 **Activate Incoming Webhooks**
3. 點擊 **Add New Webhook to Workspace**
4. 選擇要接收通知的頻道（例如：`#deployments`）
5. 點擊 **Allow**
6. 複製生成的 **Webhook URL**

### 3. 建立警報專用頻道（可選）

建議建立獨立的警報頻道以區分一般部署通知和緊急警報：

1. 在 Slack 建立新頻道（例如：`#alerts`）
2. 在 Slack App 中新增另一個 Webhook 指向此頻道
3. 將此 Webhook URL 設定為 `SLACK_WEBHOOK_URL_ALERTS`

### 4. Webhook URL 格式

```
https://hooks.slack.com/services/TXXXXX/BXXXXX/your-webhook-token-here
```

---

## 環境變數配置

### 本地開發環境

在 Shell 配置檔案中設定（例如 `~/.bashrc` 或 `~/.zshrc`）：

```bash
# Slack 部署通知 Webhook
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Slack 警報專用 Webhook（可選，若未設定則使用 SLACK_WEBHOOK_URL）
export SLACK_WEBHOOK_URL_ALERTS="https://hooks.slack.com/services/YOUR/ALERTS/WEBHOOK"
```

設定後重新載入：

```bash
source ~/.bashrc  # 或 source ~/.zshrc
```

### CI/CD 環境

#### GitHub Actions

在 Repository Settings > Secrets and variables > Actions 中新增：

- `SLACK_WEBHOOK_URL`
- `SLACK_WEBHOOK_URL_ALERTS`

在 workflow 中使用：

```yaml
env:
  SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
  SLACK_WEBHOOK_URL_ALERTS: ${{ secrets.SLACK_WEBHOOK_URL_ALERTS }}
```

---

## Cloudflare 監控設定

### 1. Cloudflare Analytics

Cloudflare Workers 內建提供基本監控：

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 選擇 Workers & Pages
3. 選擇對應的 Worker
4. 查看 **Analytics** 標籤頁

可監控指標：
- 請求數量
- 錯誤率
- CPU 時間
- 持續時間分佈

### 2. Cloudflare Notifications

設定 Cloudflare 原生警報：

1. 在 Cloudflare Dashboard 點擊 **Notifications**
2. 點擊 **Add** 新增通知
3. 選擇通知類型：
   - **Workers Health Alert**: Worker 錯誤率異常
   - **Workers Usage Alert**: 使用量超過閾值
4. 設定通知目標（Email、Webhook 等）

### 3. Workers Observability（付費功能）

啟用進階監控功能：

```toml
# wrangler.toml
[observability]
enabled = true
```

可獲得：
- 詳細的請求追蹤
- 錯誤堆疊追蹤
- 效能指標

---

## 警報閾值設定

### 建議的警報閾值

| 指標 | 警告閾值 | 危險閾值 | 說明 |
|------|----------|----------|------|
| 錯誤率 | > 1% | > 5% | 5xx 錯誤佔總請求比例 |
| 回應時間 P95 | > 1000ms | > 3000ms | 95% 請求的回應時間 |
| 回應時間 P99 | > 2000ms | > 5000ms | 99% 請求的回應時間 |
| CPU 時間 | > 30ms | > 50ms | 平均 CPU 執行時間 |

### 健康檢查設定

在 `scripts/health-check.sh` 中可調整的參數：

```bash
TIMEOUT=10          # 請求超時秒數
RETRY_COUNT=3       # 重試次數
RETRY_DELAY=2       # 重試間隔秒數
```

持續監控模式設定：

```bash
# 連續失敗 3 次才發送警報
MAX_CONSECUTIVE_FAILURES=3

# 預設檢查間隔 60 秒
INTERVAL=60
```

---

## 腳本使用指南

### 部署通知腳本

檔案位置：`scripts/notify-deployment.sh`

#### 直接使用

```bash
# 部署成功通知
./scripts/notify-deployment.sh deploy server production success

# 部署失敗通知
./scripts/notify-deployment.sh deploy web staging failure "Build 失敗"

# 回滾通知
./scripts/notify-deployment.sh rollback server production "API 錯誤率異常"

# 健康檢查通知
./scripts/notify-deployment.sh health production health_fail "Server: DOWN"
```

#### 整合到部署流程

通知腳本已整合到以下部署腳本：

- `scripts/deploy-staging.sh` - 部署後自動發送成功/失敗通知
- `scripts/deploy-production.sh` - 部署後自動發送成功/失敗通知
- `scripts/rollback.sh` - 回滾後自動發送緊急通知

### 健康檢查腳本

檔案位置：`scripts/health-check.sh`

#### 基本使用

```bash
# 檢查 Production 環境
./scripts/health-check.sh production

# 檢查 Staging 環境
./scripts/health-check.sh staging

# 檢查並發送 Slack 通知
./scripts/health-check.sh production --notify
```

#### 持續監控模式

```bash
# 每 60 秒檢查一次（預設）
./scripts/health-check.sh production --continuous

# 每 30 秒檢查一次，失敗時發送通知
./scripts/health-check.sh production --continuous --interval 30 --notify
```

#### 結合 cron 使用

設定定期執行健康檢查：

```bash
# 編輯 crontab
crontab -e

# 每 5 分鐘執行一次健康檢查
*/5 * * * * SLACK_WEBHOOK_URL="your-webhook-url" /path/to/scripts/health-check.sh production --notify >> /var/log/health-check.log 2>&1
```

---

## 通知訊息範例

### 部署成功

```
:white_check_mark: [PRODUCTION] server 部署成功

服務: server
環境: PRODUCTION
時間: 2026-01-28 12:30:00
部署者: stephen

URL: https://sales-ai-server.salesaiautomationv3.workers.dev
```

### 部署失敗

```
:x: [PRODUCTION] web 部署失敗

服務: web
環境: PRODUCTION
時間: 2026-01-28 12:35:00
部署者: stephen

URL: https://sales-ai-web.pages.dev

備註: Build 失敗
```

### 緊急回滾

```
:rotating_light: [PRODUCTION] server 緊急回滾

服務: server
環境: PRODUCTION
時間: 2026-01-28 12:40:00
執行者: stephen

原因: API 錯誤率異常

:warning: 請立即確認服務狀態並調查回滾原因
```

### 健康檢查失敗

```
:broken_heart: [PRODUCTION] 健康檢查失敗

環境: PRODUCTION
時間: 2026-01-28 12:45:00

詳細資訊:
Server API: FAILED
Web 前端: OK
```

---

## 故障排除

### Slack 通知未發送

1. 確認環境變數已設定：
   ```bash
   echo $SLACK_WEBHOOK_URL
   ```

2. 測試 Webhook 是否有效：
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"測試訊息"}' \
     $SLACK_WEBHOOK_URL
   ```

3. 檢查網路連線：
   ```bash
   curl -I https://hooks.slack.com
   ```

### 健康檢查失敗

1. 手動測試端點：
   ```bash
   curl -v https://sales-ai-server.salesaiautomationv3.workers.dev/health
   ```

2. 檢查 Cloudflare 狀態：
   - [Cloudflare Status](https://www.cloudflarestatus.com/)

3. 查看 Worker 日誌：
   ```bash
   cd apps/server
   bunx wrangler tail
   ```

---

## 相關文件

- `scripts/notify-deployment.sh` - 部署通知腳本
- `scripts/health-check.sh` - 健康檢查腳本
- `scripts/deploy-staging.sh` - Staging 部署腳本
- `scripts/deploy-production.sh` - Production 部署腳本
- `scripts/rollback.sh` - 回滾腳本
