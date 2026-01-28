---
name: typescript-quality
description: TypeScript 品質檢查。當編輯 .ts/.tsx 檔案、修復型別錯誤、重構代碼、或完成功能開發時自動執行。執行 type check、lint、確保嚴格型別、檢查最佳實踐。
allowed-tools:
  - Bash(bun x ultracite check)
  - Bash(bun x ultracite fix)
  - Bash(bun run typecheck)
  - Read
  - Grep
  - Glob
---

# TypeScript Quality - TypeScript 品質檢查

## 自動觸發時機

Claude 會在以下情況**自動執行**此 skill：

| 觸發情境 | 說明 |
|---------|------|
| 編輯 TypeScript 檔案 | 任何 `.ts` 或 `.tsx` 檔案變更後 |
| 修復型別錯誤 | 處理 TypeScript 編譯錯誤 |
| 重構代碼 | 重構完成後確認型別正確 |
| 完成功能開發 | 功能完成後的品質確認 |
| 新增/修改介面 | 變更型別定義後 |

## 檢查項目

### 1. 型別正確性

```bash
# 執行型別檢查
bun run typecheck
```

### 2. Lint 檢查

```bash
# 檢查問題
bun x ultracite check

# 自動修復
bun x ultracite fix
```

### 3. TypeScript 最佳實踐

```markdown
□ 避免使用 `any` 型別
□ 使用 `unknown` 取代 `any`（需要型別守衛時）
□ 明確的函數返回型別
□ 使用 `readonly` 防止意外修改
□ 適當使用 `const assertions`
□ 避免型別斷言（除非必要）
□ 使用 discriminated unions
□ 適當使用 generics
```

### 4. 常見問題檢查

| 問題 | 檢查方式 | 建議 |
|------|---------|------|
| `any` 使用 | `grep ":\s*any"` | 改用具體型別或 `unknown` |
| `@ts-ignore` | `grep "@ts-ignore"` | 應有註解說明原因 |
| 型別斷言 | `grep "as\s+\w+"` | 優先使用型別守衛 |
| 非空斷言 | `grep "!\."` | 添加適當的 null 檢查 |

## 執行流程

### 步驟 1: 執行型別檢查

```bash
bun run typecheck
```

如果有錯誤，記錄並分析：

```markdown
## 型別錯誤

| 檔案 | 行號 | 錯誤代碼 | 說明 |
|------|------|---------|------|
| `src/foo.ts` | 42 | TS2345 | 型別不匹配 |
```

### 步驟 2: 執行 Lint

```bash
bun x ultracite check
```

### 步驟 3: 檢查最佳實踐

掃描常見問題：

```bash
# 搜尋 any 使用
grep -rn ": any" --include="*.ts" --include="*.tsx"

# 搜尋 ts-ignore
grep -rn "@ts-ignore" --include="*.ts" --include="*.tsx"

# 搜尋非空斷言
grep -rn "!\." --include="*.ts" --include="*.tsx"
```

### 步驟 4: 自動修復

```bash
# 自動修復可修復的問題
bun x ultracite fix
```

## 輸出格式

### 檢查通過

```markdown
## ✅ TypeScript Quality 通過

### 檢查結果
- **型別檢查**: ✅ 通過
- **Lint**: ✅ 通過
- **最佳實踐**: ✅ 符合

### 統計
- 檢查檔案數: X
- any 使用: 0
- ts-ignore: 0
```

### 發現問題

```markdown
## ⚠️ TypeScript Quality 問題

### 型別錯誤
| 檔案 | 行號 | 錯誤 |
|------|------|------|
| `packages/api/src/routers/opportunity.ts` | 45 | Property 'foo' does not exist on type 'Bar' |

### Lint 問題
| 檔案 | 行號 | 規則 | 說明 |
|------|------|------|------|
| `packages/services/src/llm.ts` | 23 | no-explicit-any | 避免使用 any |

### 最佳實踐建議

#### 避免 any（3 處）
- `packages/api/src/routers/search.ts:15` - 建議使用具體型別
- `packages/services/src/parser.ts:42` - 建議使用 generics

#### 建議修復
\`\`\`typescript
// ❌ 當前
function parse(data: any): any { ... }

// ✅ 建議
function parse<T>(data: unknown): T { ... }
\`\`\`

### 自動修復
執行 \`bun x ultracite fix\` 可修復 X 個問題
```

## 專案特定規則

### tsconfig 嚴格模式

此專案啟用了以下嚴格選項：

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true
  }
}
```

### 允許的例外

| 情況 | 允許 | 條件 |
|------|------|------|
| 第三方庫缺少型別 | `any` | 加上 TODO 註解 |
| 動態 JSON 處理 | `unknown` | 使用 Zod 驗證 |
| 測試檔案 | `@ts-expect-error` | 測試錯誤情況 |

## 整合的工具

| 工具 | 用途 |
|------|------|
| `Bash(typecheck)` | TypeScript 編譯檢查 |
| `Bash(ultracite)` | Lint + Format |
| `Grep` | 搜尋問題模式 |
| `Read` | 讀取檔案分析 |

## 相關 Skills

- `/code-review` - 完整程式碼審查
- `/test` - 執行測試確認
