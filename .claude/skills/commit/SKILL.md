---
name: commit
description: 智能 Commit。當用戶說「commit」、「提交」、或完成一個功能/修復準備提交時自動執行。分析變更內容、產生 Conventional Commit 格式訊息、執行 pre-commit 檢查。
allowed-tools:
  - Bash(git *)
  - Bash(bun x ultracite check)
  - Bash(bun x ultracite fix)
  - Bash(bun run typecheck)
  - Read
  - Grep
  - Glob
---

# Commit - 智能提交

## 自動觸發時機

Claude 會在以下情況**自動執行**此 skill：

| 觸發情境 | 說明 |
|---------|------|
| 用戶說 commit | 「commit」、「提交」、「git commit」 |
| 功能完成 | 完成一個功能開發後 |
| Bug 修復 | 修復完 bug 後 |
| 準備推送 | 推送前的提交準備 |

## Conventional Commit 格式

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type 類型

| Type | 說明 | 範例 |
|------|------|------|
| `feat` | 新功能 | `feat(api): 新增批量更新 API` |
| `fix` | Bug 修復 | `fix(web): 修復分頁顯示問題` |
| `refactor` | 重構 | `refactor(services): 優化 LLM 呼叫邏輯` |
| `docs` | 文件 | `docs: 更新部署指南` |
| `test` | 測試 | `test(api): 新增機會 API 測試` |
| `chore` | 雜項 | `chore: 更新依賴套件` |
| `style` | 格式 | `style: 修正程式碼格式` |
| `perf` | 效能 | `perf(db): 優化查詢效能` |

### Scope 範圍（此專案）

| Scope | 說明 |
|-------|------|
| `api` | packages/api |
| `web` | apps/web |
| `server` | apps/server |
| `slack-bot` | apps/slack-bot |
| `queue-worker` | apps/queue-worker |
| `services` | packages/services |
| `db` | packages/db |
| `auth` | packages/auth |

## 執行流程

### 步驟 1: 檢查變更狀態

```bash
# 查看狀態
git status

# 查看 staged 變更
git diff --cached --name-only

# 查看 unstaged 變更
git diff --name-only
```

### 步驟 2: 執行 Pre-commit 檢查

```bash
# 格式化
bun x ultracite fix

# Lint 檢查
bun x ultracite check

# 型別檢查
bun run typecheck
```

自動調用：
- `/secret-scanner` - 掃描敏感資訊
- `/typescript-quality` - TypeScript 品質檢查

### 步驟 3: 分析變更內容

根據變更的檔案和內容，判斷：
1. **Type**: feat/fix/refactor/...
2. **Scope**: 影響的模組
3. **Description**: 變更摘要

### 步驟 4: 產生 Commit Message

```markdown
## 建議的 Commit Message

\`\`\`
feat(api): 新增機會批量更新功能

- 新增 batchUpdate endpoint
- 支援同時更新多個機會的狀態
- 包含輸入驗證和權限檢查

Closes #123
\`\`\`
```

### 步驟 5: 執行 Commit

```bash
git add [files]
git commit -m "$(cat <<'EOF'
feat(api): 新增機會批量更新功能

- 新增 batchUpdate endpoint
- 支援同時更新多個機會的狀態
- 包含輸入驗證和權限檢查

https://claude.ai/code/[session-id]
EOF
)"
```

## 輸出格式

### Pre-commit 檢查

```markdown
## 📝 Commit 準備

### 變更摘要
- **變更檔案**: 5 個
- **新增行數**: +120
- **刪除行數**: -30

### 變更的檔案
| 檔案 | 變更類型 |
|------|---------|
| `packages/api/src/routers/opportunity.ts` | 修改 |
| `packages/api/src/routers/__tests__/opportunity.test.ts` | 新增 |
| `packages/db/src/schema/opportunity.ts` | 修改 |

### Pre-commit 檢查
| 檢查項目 | 狀態 |
|---------|------|
| 格式化 | ✅ 通過 |
| Lint | ✅ 通過 |
| 型別檢查 | ✅ 通過 |
| 敏感資訊掃描 | ✅ 通過 |

### 建議的 Commit

**Type**: feat
**Scope**: api
**Description**: 新增機會批量更新功能

\`\`\`
feat(api): 新增機會批量更新功能

- 新增 batchUpdate endpoint
- 支援同時更新多個機會的狀態
- 包含輸入驗證和權限檢查
- 新增單元測試

https://claude.ai/code/[session-id]
\`\`\`

### 確認提交？
請確認上述 commit message 是否正確，或提供修改建議。
```

### 檢查失敗

```markdown
## ⚠️ Commit 檢查失敗

### 失敗的檢查
| 檢查項目 | 狀態 | 問題 |
|---------|------|------|
| Lint | ❌ | 2 個錯誤 |
| 敏感資訊 | ❌ | 發現 API key |

### 需要修復

#### Lint 錯誤
- `packages/api/src/routers/opportunity.ts:45` - 未使用的變數
- `packages/api/src/routers/opportunity.ts:67` - missing return type

#### 敏感資訊
- `packages/services/src/config.ts:12` - 硬編碼的 API key

### ⛔ 行動要求
1. 修復 Lint 錯誤
2. 移除硬編碼的敏感資訊
3. 重新執行 commit
```

## 專案特定規則

### Commit 訊息語言

- **Type/Scope**: 英文
- **Description**: 中文或英文皆可
- **Body**: 中文或英文皆可

### 必須包含 Session Link

每個 commit 必須在最後一行包含 Claude session link：
```
https://claude.ai/code/[session-id]
```

### 不要 Commit 的檔案

```
.env
.env.local
*.log
node_modules/
dist/
.wrangler/
```

## 整合的工具

| 工具 | 用途 |
|------|------|
| `Bash(git)` | Git 操作 |
| `Bash(ultracite)` | Lint + Format |
| `Bash(typecheck)` | 型別檢查 |
| `Read` | 分析變更內容 |

## 相關 Skills

- `/secret-scanner` - 敏感資訊掃描
- `/typescript-quality` - TypeScript 品質
- `/tdd-guard` - 測試覆蓋檢查
- `/code-review` - 程式碼審查
