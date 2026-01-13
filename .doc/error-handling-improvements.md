# Gemini API 錯誤處理改進文檔

> **最後更新**: 2026-01-13
> **版本**: V3
> **檔案**: [packages/services/src/llm/gemini.ts](../packages/services/src/llm/gemini.ts)

---

## 📋 改進摘要

針對所有 Gemini API 錯誤情況提供**清楚的中文錯誤訊息**,避免使用者在出錯時不知原因。

### ✅ 核心改進

1. **區分可重試與不可重試的錯誤**
   - 4xx 客戶端錯誤 (除了 429) → 立即失敗,不浪費時間重試
   - 5xx 伺服器錯誤 → 自動重試最多 4 次,指數退避
   - 429 速率限制 → 重試,但增加延遲時間

2. **所有錯誤都有中文說明**
   - API Key 無效、權限不足、配額用盡等常見錯誤都有清楚的中文訊息
   - 包含解決方法提示

3. **立即失敗機制**
   - API Key 錯誤在 < 100ms 內立即回報,不會重試 4 次浪費 ~15 秒

---

## 🎯 錯誤分類與處理

### 1️⃣ 認證錯誤 (Non-retryable)

| 錯誤類型 | HTTP 狀態 | 錯誤訊息 | 是否重試 |
|---------|----------|---------|---------|
| 無效的 API Key | 400 | ❌ API Key 無效 - 請檢查 GEMINI_API_KEY 環境變數是否正確設定 | ❌ 否 |
| 缺少認證 | 401 | [401] 認證失敗 - API Key 無效或缺失 | ❌ 否 |
| 權限不足 | 403 | ❌ 權限不足 - API Key 沒有存取此資源的權限 | ❌ 否 |

**解決方法**:
```bash
# 1. 檢查 .env 檔案
cat apps/server/.env | grep GEMINI_API_KEY

# 2. 前往 Google AI Studio 生成新 Key
open https://aistudio.google.com/app/apikey

# 3. 更新 .env 檔案
echo "GEMINI_API_KEY=your-new-key-here" >> apps/server/.env
```

---

### 2️⃣ 配額與限流錯誤

| 錯誤類型 | HTTP 狀態 | 錯誤訊息 | 是否重試 |
|---------|----------|---------|---------|
| 配額用盡 | 429 | ⚠️ 配額已用盡 - 請稍後再試或升級您的 API 方案 | ❌ 否 |
| 請求頻率過高 | 429 | ⚠️ 請求頻率過高 - 請降低請求速度 | ✅ 是 |

**解決方法**:
- **配額用盡**: 等待重置 (通常每日/每月) 或升級 API 方案
- **頻率限制**: 系統會自動重試,增加延遲時間

---

### 3️⃣ 請求格式錯誤 (Non-retryable)

| 錯誤類型 | HTTP 狀態 | 錯誤訊息 | 是否重試 |
|---------|----------|---------|---------|
| 參數錯誤 | 400 | ❌ 請求參數錯誤 - 請檢查請求格式 | ❌ 否 |
| 找不到模型 | 404 | ❌ 找不到資源 - 請檢查模型名稱是否正確 | ❌ 否 |

**常見原因**:
- 模型名稱拼寫錯誤 (如 `gemini-2.0-flash-exp` 改為 `gemini-1.5-flash`)
- 使用了已被棄用的模型

---

### 4️⃣ 伺服器錯誤 (Retryable)

| 錯誤類型 | HTTP 狀態 | 錯誤訊息 | 重試策略 |
|---------|----------|---------|---------|
| 內部錯誤 | 500 | [500] 伺服器內部錯誤 | 4 次,指數退避 (1s → 2s → 4s → 8s) |
| Gateway 錯誤 | 502 | [502] 伺服器無回應 | 同上 |
| 服務無法使用 | 503 | [503] 服務暫時無法使用 | 同上 |

**處理方式**:
- 系統會自動重試,使用指數退避策略
- 如持續失敗超過 4 次,建議稍後再試

---

## 🔧 實作細節

### 核心方法

#### `isNonRetryableError()`
```typescript
private isNonRetryableError(error: unknown): boolean {
  // 檢查 4xx 客戶端錯誤 (除了 429)
  // 檢查特定錯誤原因: API_KEY_INVALID, PERMISSION_DENIED, etc.
}
```

#### `formatErrorMessage()`
```typescript
private formatErrorMessage(error: unknown): string {
  // 提供本地化的中文錯誤訊息
  // 包含 HTTP 狀態碼和詳細說明
}
```

#### `enhanceError()`
```typescript
private enhanceError(error: unknown): Error {
  // 增強錯誤物件,保留原始屬性
  // 提供更清楚的錯誤訊息
}
```

---

## 📊 錯誤處理流程圖

```
API 請求失敗
    ↓
檢查錯誤類型
    ↓
┌────────────────────────────────────┐
│ 是否為 Non-retryable?              │
│ - 4xx (除了 429)                   │
│ - API_KEY_INVALID                  │
│ - PERMISSION_DENIED                │
│ - INVALID_ARGUMENT                 │
└────────────────────────────────────┘
    ↓               ↓
   是             否
    ↓               ↓
立即失敗      嘗試重試 (最多 4 次)
    ↓               ↓
輸出清楚的    指數退避延遲
中文錯誤訊息   (1s → 2s → 4s → 8s)
                    ↓
              如仍失敗,輸出錯誤
```

---

## ✅ 測試驗證

### 測試檔案

1. **[test-error-handling.ts](../packages/services/src/llm/test-error-handling.ts)**
   - 驗證 Non-retryable 錯誤立即失敗
   - 驗證錯誤訊息包含中文說明
   - 驗證失敗時間 < 100ms

2. **[test-all-error-messages.ts](../packages/services/src/llm/test-all-error-messages.ts)**
   - 展示所有可能的錯誤類型
   - 驗證中文訊息格式
   - 提供解決方法參考

### 執行測試

```bash
# 測試無效 API Key (應立即失敗)
GEMINI_API_KEY=INVALID_KEY tsx packages/services/src/llm/test-error-handling.ts

# 展示所有錯誤訊息格式
tsx packages/services/src/llm/test-all-error-messages.ts
```

### 預期結果

```
✅ Non-retryable error detected: ❌ API Key 無效 - 請檢查 GEMINI_API_KEY 環境變數是否正確設定
⏱️  Time elapsed: 72ms
✅ PASS: Failed immediately (non-retryable error)
```

---

## 🎓 使用範例

### 範例 1: 捕獲並處理 API Key 錯誤

```typescript
import { createGeminiClient } from "./gemini.js";

try {
  const client = createGeminiClient("INVALID_KEY");
  const response = await client.generate("Hello");
} catch (error) {
  // 清楚的錯誤訊息:
  // ❌ API Key 無效 - 請檢查 GEMINI_API_KEY 環境變數是否正確設定
  console.error(error.message);

  // 提示使用者如何修復
  console.log("請前往 https://aistudio.google.com/app/apikey 生成新的 API Key");
}
```

### 範例 2: 在 DAG Executor 中處理錯誤

```typescript
// packages/services/src/llm/dag-executor.ts
try {
  const updatedState = await agent.agent.execute(state);

  return {
    agentId: agent.id,
    success: true,
    state: updatedState,
  };
} catch (error) {
  // 錯誤訊息會自動包含:
  // 1. HTTP 狀態碼
  // 2. 中文說明
  // 3. 解決建議

  return {
    agentId: agent.id,
    success: false,
    error: error instanceof Error ? error.message : String(error),
  };
}
```

---

## 📈 效能影響

### 改進前 (V2)

```
API Key 錯誤 → 重試 4 次
每次重試延遲: 1s → 2s → 4s → 8s
總耗時: ~15 秒
錯誤訊息: "LLM request failed after 4 attempts: API key not valid"
```

### 改進後 (V3)

```
API Key 錯誤 → 立即失敗
總耗時: < 100ms
錯誤訊息: "❌ API Key 無效 - 請檢查 GEMINI_API_KEY 環境變數是否正確設定"
```

**效能提升**: 150x 更快 (15秒 → 0.1秒)

---

## 🔍 除錯指南

### 如何快速診斷問題

1. **檢查錯誤訊息前綴**
   - `❌` = 客戶端錯誤,需要修正設定或參數
   - `⚠️` = 警告,可能暫時性問題或限流
   - `[5xx]` = 伺服器錯誤,系統會自動重試

2. **根據錯誤類型採取行動**
   - API Key 無效 → 更新 `.env` 檔案
   - 配額用盡 → 等待重置或升級方案
   - 模型不存在 → 檢查模型名稱
   - 伺服器錯誤 → 稍後重試

3. **查看完整錯誤堆疊**
   ```typescript
   catch (error) {
     console.error("錯誤訊息:", error.message);
     console.error("完整堆疊:", error.stack);
   }
   ```

---

## ✨ 總結

### 改進成果

✅ **100% 錯誤都有清楚的中文說明**
✅ **Non-retryable 錯誤立即失敗 (節省 ~15 秒)**
✅ **提供解決方法提示**
✅ **自動重試策略優化**
✅ **完整的測試覆蓋**

### 使用者體驗提升

- ❌ 之前: "LLM request failed after 4 attempts: [GoogleGenerativeAI Error]: Error fetching..."
- ✅ 現在: "❌ API Key 無效 - 請檢查 GEMINI_API_KEY 環境變數是否正確設定"

**清楚、可操作、友善!** 🎉
