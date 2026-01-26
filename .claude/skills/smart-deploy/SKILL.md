---
name: smart-deploy
description: 智慧化部署流程。自動檢測變更範圍、執行前置檢查（lint、type-check、test）、漸進式部署到 Cloudflare Workers，並在部署後進行健康檢查和監控。支援部署 server、queue-worker、slack-bot 等應用。
allowed-tools:
  - Bash(git *)
  - Bash(bun *)
  - Bash(bunx wrangler *)
  - Read
  - Glob
  - Grep
---

# /smart-deploy - 智慧部署流程

## 描述
智慧化部署流程，自動檢測變更範圍、執行前置檢查、漸進式部署，並在部署後進行健康檢查和監控。

## 使用方式
```
/smart-deploy                     # 部署所有有變更的應用
/smart-deploy server              # 只部署 API Server
/smart-deploy queue-worker        # 只部署 Queue Worker
/smart-deploy slack-bot           # 只部署 Slack Bot
/smart-deploy --all               # 強制部署所有應用
/smart-deploy --skip-tests        # 跳過測試（不建議）
```

## 可部署的應用

| 應用 | 目錄 | 部署命令 | 說明 |
|------|------|---------|------|
| server | `apps/server` | `wrangler deploy` | API Server |
| queue-worker | `apps/queue-worker` | `wrangler deploy` | 隊列處理 |
| slack-bot | `apps/slack-bot` | `wrangler deploy` | 主 Slack Bot |
| slack-bot-beauty | `apps/slack-bot-beauty` | `wrangler deploy` | 美食 Slack Bot |

## 執行流程

### 階段 1: 變更檢測

**檢查 git 狀態：**
```bash
git status --porcelain
git diff --name-only HEAD~1
```

**判斷需要部署的應用：**
- 如果 `apps/server/` 有變更 → 部署 server
- 如果 `apps/queue-worker/` 有變更 → 部署 queue-worker
- 如果 `apps/slack-bot/` 有變更 → 部署 slack-bot
- 如果 `packages/` 有變更 → 部署所有依賴該 package 的應用

**依賴關係圖：**
```
packages/shared → 所有應用
packages/api → server, slack-bot, queue-worker
packages/db → server, slack-bot, queue-worker
packages/services → server, slack-bot, queue-worker
packages/auth → server
packages/env → 所有應用
```

### 階段 2: 前置檢查

**2.1 代碼品質檢查：**
```bash
bun x ultracite check
```

**2.2 TypeScript 類型檢查：**
```bash
bun run check-types
```

**2.3 執行相關測試：**
```bash
# 單元測試
bun run test:unit

# 整合測試（如果有資料庫連線）
bun run test:integration
```

**2.4 環境變數檢查：**
確認以下環境變數已設定：
- `DATABASE_URL`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `SLACK_BOT_TOKEN`
- `CLOUDFLARE_R2_ACCESS_KEY`
- `CLOUDFLARE_R2_SECRET_KEY`

### 階段 3: 建置

**依序建置 packages：**
```bash
# 1. 建置 shared（被所有應用依賴）
bun run -F @sales_ai_automation_v3/shared build

# 2. 建置其他 packages
bun run -F @Sales_ai_automation_v3/db build
bun run -F @Sales_ai_automation_v3/services build
bun run -F @Sales_ai_automation_v3/api build

# 3. 建置要部署的應用
bun run -F @Sales_ai_automation_v3/server build
bun run -F @Sales_ai_automation_v3/queue-worker build
bun run -F slack-bot build
```

### 階段 4: 部署

**部署順序（重要）：**
1. **queue-worker** - 先部署背景處理服務
2. **server** - 再部署 API 服務
3. **slack-bot** - 最後部署前端入口

**部署命令：**
```bash
# Queue Worker
cd apps/queue-worker && bunx wrangler deploy

# Server
cd apps/server && bunx wrangler deploy

# Slack Bot
cd apps/slack-bot && bunx wrangler deploy
```

**部署時詢問用戶確認：**
```
即將部署以下應用：
- queue-worker
- server
- slack-bot

是否繼續？[y/N]
```

### 階段 5: 部署後驗證

**5.1 使用 cloudflare-observability 監控：**

```
# 列出 Workers
mcp__cloudflare-observability__workers_list

# 查詢最近 5 分鐘的日誌
mcp__cloudflare-observability__query_worker_observability
```

**5.2 健康檢查指標：**
- 錯誤率 < 1%
- 請求成功率 > 99%
- 無 500 錯誤

**5.3 使用 cloudflare-bindings 確認綁定：**

```
# 確認 KV namespace
mcp__cloudflare-bindings__kv_namespaces_list

# 確認 R2 bucket
mcp__cloudflare-bindings__r2_buckets_list

# 確認 D1 database
mcp__cloudflare-bindings__d1_databases_list
```

### 階段 6: 回滾機制

**如果部署後發現問題：**

1. 使用 Wrangler 回滾到上一版本：
```bash
cd apps/[app-name] && bunx wrangler rollback
```

2. 或使用專案回滾腳本：
```bash
bash scripts/rollback.sh
```

**回滾觸發條件：**
- 錯誤率突然上升
- 健康檢查失敗
- 關鍵功能無法使用

### 階段 7: 更新 GitHub（可選）

**如果有 PR 關聯：**

使用 github MCP 更新 PR 狀態：
```
mcp__github__add_issue_comment
```

添加部署完成的評論，包含：
- 部署的應用列表
- 部署時間
- 健康檢查結果

## 輸出格式

**部署成功：**
```markdown
## 部署報告 ✅

### 部署摘要
- **時間**: 2026-01-26 15:30:00
- **環境**: Production
- **部署者**: Claude Code

### 部署的應用
| 應用 | 狀態 | 版本 |
|------|------|------|
| queue-worker | ✅ 成功 | abc1234 |
| server | ✅ 成功 | abc1234 |
| slack-bot | ✅ 成功 | abc1234 |

### 健康檢查
- 錯誤率: 0%
- 請求成功率: 100%
- 無異常日誌

### 後續建議
1. 監控 Cloudflare Workers 日誌 15 分鐘
2. 測試關鍵功能
3. 確認 Slack 通知正常
```

**部署失敗：**
```markdown
## 部署報告 ❌

### 失敗摘要
- **失敗階段**: [階段名稱]
- **失敗應用**: [應用名稱]
- **錯誤訊息**: [錯誤內容]

### 已回滾
- [已回滾的應用列表]

### 建議行動
1. 檢查錯誤日誌
2. 修復問題後重新部署
3. 使用 /diagnose 進行問題排查
```

## 整合的工具

| 工具 | 用途 |
|------|------|
| `cloudflare-observability` MCP | 部署後監控和日誌查詢 |
| `cloudflare-bindings` MCP | 確認綁定配置正確 |
| `github` MCP | 更新 PR 狀態 |
| `Bash` | 執行部署命令 |
| `Grep` / `Read` | 檢查配置文件 |

## 安全提醒

- **永遠不要** 在有未提交變更時部署到 production
- **建議** 先部署到 staging 環境測試
- **務必** 在部署前執行測試
- **保持** 回滾腳本可用

## 相關文件

- `.doc/20260115_Queue架構部署指南.md`
- `.doc/20260119_部署完成測試指南.md`
- `.doc/20260120_Agent_A-D部署完成總結.md`
- `scripts/deploy.sh`
- `scripts/deploy-and-test.sh`
- `scripts/rollback.sh`
