---
name: architecture-check
description: 當新增或修改 API 路由、Service 層時，自動檢查是否遵循模組化架構原則。確保 Service 層分離、錯誤處理標準化、結構化日誌使用、依賴注入正確設定。
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(bun x ultracite check)
---

# Architecture Check - 架構品質檢查

## 自動觸發時機

Claude 會在以下情況**自動執行**此 skill：

| 觸發情境 | 說明 |
|---------|------|
| 新增 API 路由 | 在 `packages/api/src/routers/` 新增檔案 |
| 修改 API 路由 | 修改現有的路由邏輯 |
| 新增 Service | 在 `packages/services/src/` 新增服務 |
| 重構架構 | 進行架構層面的重構 |
| 用戶要求 | 用戶說「檢查架構」、「architecture check」 |

## 檢查項目

### 1. Service 層分離

**原則**：API 路由不應直接操作資料庫

```typescript
// ❌ 違規模式 - 路由直接操作 DB
export const createOpportunity = protectedProcedure
  .handler(async ({ input, context }) => {
    await db.insert(opportunities).values({...});  // 直接 DB 操作
  });

// ✅ 正確模式 - 透過 Service 層
export const createOpportunity = protectedProcedure
  .handler(async ({ input, context }) => {
    return context.services.opportunity.create(input, context.userId);
  });
```

**搜尋違規模式**：
```bash
# 在路由層搜尋直接 DB 操作
grep -r "await db\." packages/api/src/routers/
grep -r "\.insert(" packages/api/src/routers/
grep -r "\.update(" packages/api/src/routers/
grep -r "\.delete(" packages/api/src/routers/
grep -r "\.select(" packages/api/src/routers/
```

### 2. 錯誤處理標準化

**原則**：使用 `AppError` 和 `errors` 工廠

```typescript
// ❌ 違規模式
throw new Error("找不到商機");
return { error: "something went wrong" };

// ✅ 正確模式
import { errors, AppError } from "@sales_ai_automation_v3/shared";
throw errors.OPPORTUNITY_NOT_FOUND(id);
throw new AppError("VALIDATION_ERROR", "欄位驗證失敗", 400);
```

**搜尋違規模式**：
```bash
# 搜尋原生 Error
grep -r "throw new Error" packages/api/ packages/services/
grep -r "return.*error:" packages/api/src/routers/
```

### 3. 結構化日誌

**原則**：使用 Logger 而非 console

```typescript
// ❌ 違規模式
console.log("Creating opportunity...");
console.error("Failed:", error);

// ✅ 正確模式
logger.info("Creating opportunity", { userId, customerNumber });
logger.error("Failed to create opportunity", error, { userId });
```

**搜尋違規模式**：
```bash
# 搜尋 console 使用（排除 logger 實作檔）
grep -r "console\.(log|error|warn|info)" packages/api/ packages/services/ \
  --include="*.ts" | grep -v "logger"
```

### 4. 依賴注入

**原則**：服務應透過 Container 註冊和解析

```typescript
// ❌ 違規模式 - 直接實例化
const gemini = createGeminiClient();
const service = new OpportunityService(gemini);

// ✅ 正確模式 - 透過 Container
container.register(ServiceKeys.GEMINI, () => createGeminiClient(env.API_KEY));
container.register(ServiceKeys.OPPORTUNITY_SERVICE, (c) =>
  createOpportunityService({
    gemini: c.resolve(ServiceKeys.GEMINI),
  })
);
```

**檢查項目**：
- 新服務是否在 Container 註冊
- 依賴是否透過參數注入而非內部建立

## 執行流程

### 步驟 1: 識別變更範圍

```bash
# 查看變更的檔案
git diff --name-only HEAD~1 | grep -E "(api|services)"
```

### 步驟 2: 分類檢查

```
變更類型          → 檢查項目
─────────────────────────────────
API 路由變更      → Service 層分離 + 錯誤處理
Service 變更      → 依賴注入 + 日誌使用
全部              → 錯誤處理 + 日誌使用
```

### 步驟 3: 逐項檢查

對每個違規項目：
1. 標記違規位置（檔案:行號）
2. 說明違規原因
3. 提供修正建議

## 輸出格式

```markdown
## 架構檢查報告

### 📊 摘要
- **檢查範圍**: X 個檔案
- **違規數量**: 🔴 嚴重 X | 🟡 警告 X
- **架構評分**: ⭐⭐⭐⭐☆ (4/5)

---

### 1. Service 層分離

| 狀態 | 檔案 | 問題 |
|------|------|------|
| 🔴 | `packages/api/src/routers/opportunity.ts:45` | 直接操作 db.insert() |
| 🔴 | `packages/api/src/routers/conversation.ts:78` | 直接操作 db.update() |

**修正建議**：
```typescript
// opportunity.ts:45 修正
// Before
await db.insert(opportunities).values({...});

// After
return context.services.opportunity.create(input, context.userId);
```

---

### 2. 錯誤處理

| 狀態 | 檔案 | 問題 |
|------|------|------|
| ✅ | 全部通過 | - |

---

### 3. 結構化日誌

| 狀態 | 檔案 | 問題 |
|------|------|------|
| 🟡 | `packages/services/src/llm/gemini.ts:123` | 使用 console.error |

**修正建議**：
```typescript
// Before
console.error("Gemini API failed:", error);

// After
logger.error("Gemini API failed", error, { prompt: prompt.slice(0, 100) });
```

---

### 4. 依賴注入

| 狀態 | 檔案 | 問題 |
|------|------|------|
| ✅ | 全部通過 | - |

---

### ✅ 下一步行動

1. [ ] 修復 Service 層分離違規（2 處）
2. [ ] 修復日誌使用警告（1 處）
3. [ ] 執行測試確認無副作用
```

## 專案特定規則

### 此專案的額外檢查

1. **oRPC 路由**
   - `protectedProcedure` 應使用 `context.services.xxx`
   - 不應直接 import `db` 或 `drizzle`

2. **快取邏輯**
   - 快取失效應在 Service 層處理
   - 路由層不應直接操作 `KVCacheService`

3. **多產品線**
   - `productLine` 參數應傳遞到 Service 層
   - 不應在路由層做產品線判斷邏輯

4. **外部服務**
   - Gemini、Groq、R2 等應透過 Container 取得
   - 不應在業務邏輯中直接 `createXxxService()`

## 豁免規則

以下情況可豁免檢查：

| 情況 | 原因 |
|------|------|
| `apps/server/src/index.ts` | 進入點，可直接設定 |
| `packages/services/src/*/index.ts` | 工廠函數所在處 |
| `**/test/**` | 測試檔案 |
| `**/__tests__/**` | 測試檔案 |

## 相關 Skills

- `/code-review` - 程式碼品質審查
- `/typescript-quality` - TypeScript 型別檢查
- `/security-audit` - 安全性審查
