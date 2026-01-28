---
name: code-review
description: 當完成一段開發工作、修復 bug、或用戶要求 review 時，自動執行程式碼審查。檢查可讀性、維護性、潛在 bug、效能問題，並提供簡化建議。適用於：完成功能開發後、修復 bug 後、重構前、PR 準備前。
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(bun x ultracite check)
  - Bash(bun run typecheck)
---

# Code Review - 程式碼審查與簡化

## 自動觸發時機

Claude 會在以下情況**自動執行**此 skill：

| 觸發情境 | 說明 |
|---------|------|
| 完成功能開發 | 當一個功能實作完成後 |
| 修復 Bug | 當修復完 bug 後確認沒有引入新問題 |
| 重構代碼 | 重構前後進行審查 |
| 準備 PR | 在建立 PR 前進行自我審查 |
| 用戶要求 | 用戶說「review」、「檢查」、「看看有沒有問題」 |

## 審查清單

### 1. 程式碼品質

```markdown
□ 命名清晰（變數、函數、類別）
□ 函數長度適中（< 50 行）
□ 單一職責原則
□ 沒有重複代碼（DRY）
□ 適當的錯誤處理
□ 沒有 magic numbers/strings
```

### 2. TypeScript 特定

```markdown
□ 型別定義完整（避免 any）
□ 使用 strict mode 特性
□ 適當使用 generics
□ 介面定義清晰
□ 沒有 @ts-ignore（除非必要並有註解）
```

### 3. 安全性

```markdown
□ 沒有硬編碼的敏感資訊
□ SQL 查詢使用參數化
□ 用戶輸入有驗證
□ API 端點有適當的權限檢查
```

### 4. 效能

```markdown
□ 沒有 N+1 查詢問題
□ 大型資料集有分頁
□ 適當使用快取
□ 沒有不必要的 re-render（React）
```

### 5. 可維護性

```markdown
□ 有適當的註解（複雜邏輯）
□ 模組化適當
□ 依賴注入而非硬編碼
□ 測試覆蓋關鍵路徑
```

## 執行流程

### 步驟 1: 識別變更範圍

```bash
# 查看已修改的檔案
git diff --name-only HEAD~1
# 或查看 staged 檔案
git diff --cached --name-only
```

### 步驟 2: 執行靜態分析

```bash
# Lint 檢查
bun x ultracite check

# 型別檢查
bun run typecheck
```

### 步驟 3: 逐檔審查

對每個變更的檔案：

1. **讀取檔案內容**
2. **檢查審查清單各項目**
3. **記錄問題和建議**

### 步驟 4: 簡化建議

尋找可以簡化的地方：

| 簡化類型 | 範例 |
|---------|------|
| 提取重複代碼 | 相同邏輯出現 2+ 次 |
| 簡化條件判斷 | 巢狀 if/else → early return |
| 使用內建方法 | for loop → map/filter/reduce |
| 移除死代碼 | 未使用的變數/函數 |
| 合併相似函數 | 參數化差異 |

## 輸出格式

```markdown
## Code Review 報告

### 📊 摘要
- **審查範圍**: X 個檔案
- **問題數量**: 🔴 嚴重 X | 🟡 建議 X | 🟢 良好 X
- **整體評分**: ⭐⭐⭐⭐☆ (4/5)

### 🔴 必須修復

#### [檔案路徑:行號]
**問題**: [描述]
**原因**: [為什麼這是問題]
**建議**:
\`\`\`typescript
// 修改前
[原代碼]

// 修改後
[建議代碼]
\`\`\`

### 🟡 建議改進

#### [檔案路徑:行號]
**建議**: [描述]
**好處**: [改進後的好處]

### 🟢 做得好的地方
- [正面回饋 1]
- [正面回饋 2]

### 📝 簡化建議
1. **[簡化項目]**: [說明]
2. **[簡化項目]**: [說明]

### ✅ 下一步行動
1. [ ] 修復嚴重問題
2. [ ] 考慮建議改進
3. [ ] 執行測試確認
```

## 整合的工具

| 工具 | 用途 |
|------|------|
| `Read` | 讀取檔案內容 |
| `Grep` | 搜尋特定模式 |
| `Glob` | 找出相關檔案 |
| `Bash(ultracite)` | 執行 lint 檢查 |
| `Bash(typecheck)` | 執行型別檢查 |

## 專案特定規則

### 此專案的額外檢查

1. **oRPC 路由**: 確保有適當的輸入驗證（Zod schema）
2. **Drizzle 查詢**: 檢查 N+1 問題，使用 `with` 做 eager loading
3. **React 元件**: 確保 hooks 依賴正確，避免不必要的 re-render
4. **Cloudflare Workers**: 注意 CPU 時間限制，避免阻塞操作

## 相關 Skills

- `/test` - Review 後執行測試確認
- `/security-audit` - 深度安全檢查
- `/tdd-guard` - 確保有測試覆蓋
