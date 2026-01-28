# Sales AI Automation V3 - Project Guidelines

所有回覆都請用繁體中文回覆

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`

---

## Documentation Management

### File Organization Rules

- **All `.md` files (except `CLAUDE.md`) must be placed in the `.doc/` directory**
- **All files MUST start with date prefix in `YYYYMMDD_` format**
- Use descriptive names in Traditional Chinese

**Good:** `.doc/20260115_Queue_Worker_Bug修復報告.md`
**Bad:** `BUG_FIX.md` (not in .doc, no date)

---

## Project Conventions

### ID 格式規範

- **案件編號格式**：`YYYYMM-IC###`（如：`202601-IC046`）
- **客戶編號格式**：`YYYYMM-######`（如：`201700-000001`）

---

## Guardrails

- **永遠不要** 在有未提交變更時部署到 production
- 部署前務必執行測試，並先部署到 staging 環境

---

## Deployment Checklist

### Web 前端部署 (apps/web)

**⚠️ 重要：確保 `.env.production` 存在且正確！**

```bash
# apps/web/.env.production 必須包含：
VITE_SERVER_URL=https://sales-ai-server.salesaiautomationv3.workers.dev
```

如果缺少此檔案，build 時會使用 `.env` 的 `localhost:3000`，導致 production 前端連接到錯誤的後端。

**部署命令：**
```bash
cd apps/web
bun run build
bunx wrangler pages deploy dist --project-name=sales-ai-web --branch=main
```

### Server 部署 (apps/server)

```bash
cd apps/server
bunx wrangler deploy
```

### Slack Bot 部署 (apps/slack-bot)

```bash
cd apps/slack-bot
bunx wrangler deploy
```

### Queue Worker 部署 (apps/queue-worker)

```bash
cd apps/queue-worker
bunx wrangler deploy
```

---

## Business Logic Principles

### 業務教練輸出原則

- **行動優先**：不要給報告，給具體行動
- **具體話術**：不要說「建議跟進」，給出「打電話說：王老闆，昨天...」

---

## 🤖 自動化 Skills 指引

Claude 會根據情境**自動判斷並調用**以下 skills，無需手動觸發：

### 程式碼品質類（開發中自動執行）

| Skill | 自動觸發時機 | 功能 |
|-------|-------------|------|
| `code-review` | 完成功能開發、修復 bug、重構後 | 程式碼審查、簡化建議、品質評分 |
| `typescript-quality` | 編輯 .ts/.tsx 檔案後 | 型別檢查、lint、最佳實踐 |
| `tdd-guard` | 修改程式碼時 | 確保有對應的測試變更 |

### 安全類（涉及敏感資料時自動執行）

| Skill | 自動觸發時機 | 功能 |
|-------|-------------|------|
| `secret-scanner` | 準備 commit、編輯設定檔時 | 掃描 API keys、密碼等敏感資訊 |
| `security-audit` | 處理用戶輸入、資料庫操作、API 端點時 | OWASP Top 10 漏洞檢測 |

### Git 流程類（版本控制時自動執行）

| Skill | 自動觸發時機 | 功能 |
|-------|-------------|------|
| `commit` | 用戶說「commit」、功能完成準備提交時 | 分析變更、產生 Conventional Commit |
| `pr-review` | 用戶說「建立 PR」、準備 merge 時 | PR 審查、風險標記、測試確認 |
| `changelog` | 發布版本、里程碑完成時 | 自動產生變更日誌 |

### 執行優先順序

當多個 skills 可能適用時，按以下優先順序執行：

```
1. secret-scanner  （安全優先，阻止敏感資訊洩漏）
2. typescript-quality  （確保程式碼可編譯）
3. tdd-guard  （確保測試覆蓋）
4. code-review  （程式碼品質審查）
5. security-audit  （深度安全檢查，視情況）
```

### 自動執行規則

1. **完成功能開發後**：自動執行 `code-review` + `typescript-quality`
2. **準備 commit 前**：自動執行 `secret-scanner` + `tdd-guard`
3. **建立 PR 前**：自動執行 `pr-review`（包含上述所有檢查）
4. **涉及用戶輸入/資料庫**：自動執行 `security-audit`

### 手動觸發

如需手動觸發，可使用 `/skill-name` 格式：

```
/code-review          # 手動執行程式碼審查
/secret-scanner       # 手動掃描敏感資訊
/security-audit       # 手動安全審計
/pr-review            # 手動 PR 審查
```

---

## 📋 完整 Skills 列表

### 開發輔助
- `/test` - 執行測試（單元、整合、E2E）
- `/code-review` - 程式碼審查與簡化
- `/typescript-quality` - TypeScript 品質檢查
- `/tdd-guard` - TDD 守護

### 安全
- `/secret-scanner` - 敏感資訊掃描
- `/security-audit` - 深度安全審計

### Git 流程
- `/commit` - 智能提交
- `/pr-review` - PR 審查
- `/changelog` - 變更日誌產生

### 部署運維
- `/smart-deploy` - 智慧部署
- `/diagnose` - 生產問題診斷
- `/worker-logs` - Workers 日誌查詢
- `/report` - 運營報告

### 業務查詢
- `/case` - 案件進度查詢
- `/opportunity` - 機會快速查詢
- `/todo-summary` - 待辦統計總覽
