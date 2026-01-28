---
name: tdd-guard
description: TDD 守護。當修改程式碼但沒有對應測試變更時自動提醒。檢查測試覆蓋、確保新功能有測試、修復 bug 有回歸測試。鼓勵測試驅動開發。
allowed-tools:
  - Bash(git diff *)
  - Bash(bun run test *)
  - Read
  - Grep
  - Glob
---

# TDD Guard - 測試驅動開發守護

## 自動觸發時機

Claude 會在以下情況**自動執行**此 skill：

| 觸發情境 | 說明 |
|---------|------|
| 修改程式碼 | 檢查是否有對應測試變更 |
| 新增功能 | 確保有新測試覆蓋 |
| 修復 Bug | 確保有回歸測試 |
| 準備 Commit | Commit 前的測試覆蓋檢查 |
| 重構代碼 | 確保測試仍然通過 |

## TDD 原則

### 紅-綠-重構

```
1. 🔴 紅：先寫一個失敗的測試
2. 🟢 綠：寫最少的代碼讓測試通過
3. 🔵 重構：改善代碼品質，保持測試通過
```

### 測試金字塔

```
        /\
       /E2E\        <- 少量，慢
      /------\
     /Integration\  <- 適中
    /--------------\
   /   Unit Tests   \ <- 大量，快
  /------------------\
```

## 執行流程

### 步驟 1: 識別變更

```bash
# 查看變更的檔案
git diff --name-only HEAD

# 分類檔案
# - 原始碼: *.ts (非 test)
# - 測試: *.test.ts, *.spec.ts
```

### 步驟 2: 配對檢查

對每個變更的原始碼檔案，檢查是否有對應的測試：

| 原始碼 | 對應測試 |
|--------|---------|
| `src/foo.ts` | `src/__tests__/foo.test.ts` 或 `tests/foo.test.ts` |
| `routers/opportunity.ts` | `routers/__tests__/opportunity.test.ts` |
| `services/llm.ts` | `services/__tests__/llm.test.ts` |

### 步驟 3: 測試覆蓋分析

```bash
# 執行測試並產生覆蓋率
bun run test --coverage

# 檢查特定檔案的覆蓋率
```

### 步驟 4: 輸出報告

## 輸出格式

### 發現問題

```markdown
## ⚠️ TDD Guard 警告

### 缺少測試的變更

| 原始碼 | 變更類型 | 建議的測試 |
|--------|---------|-----------|
| `packages/api/src/routers/opportunity.ts` | 新增函數 `batchUpdate` | `packages/api/src/routers/__tests__/opportunity.test.ts` |
| `packages/services/src/llm.ts` | 修改 `analyzeConversation` | `packages/services/src/__tests__/llm.test.ts` |

### 建議的測試案例

#### packages/api/src/routers/opportunity.ts - batchUpdate

\`\`\`typescript
describe('batchUpdate', () => {
  it('should update multiple opportunities', async () => {
    // Arrange
    const opportunities = [{ id: '1', status: 'won' }, { id: '2', status: 'lost' }];

    // Act
    const result = await batchUpdate(opportunities);

    // Assert
    expect(result.updated).toBe(2);
  });

  it('should reject invalid opportunity ids', async () => {
    // Arrange
    const opportunities = [{ id: 'invalid', status: 'won' }];

    // Act & Assert
    await expect(batchUpdate(opportunities)).rejects.toThrow();
  });

  it('should require authentication', async () => {
    // 測試未認證的請求
  });
});
\`\`\`

### ⛔ 行動要求
1. 為 `batchUpdate` 新增單元測試
2. 為 `analyzeConversation` 的變更新增測試案例
3. 執行 `bun run test` 確認測試通過
```

### 檢查通過

```markdown
## ✅ TDD Guard 通過

### 測試配對檢查
| 原始碼 | 測試 | 狀態 |
|--------|------|------|
| `packages/api/src/routers/opportunity.ts` | `__tests__/opportunity.test.ts` | ✅ 有變更 |
| `packages/services/src/llm.ts` | `__tests__/llm.test.ts` | ✅ 有變更 |

### 測試結果
- **總測試數**: 45
- **通過**: 45
- **失敗**: 0
- **覆蓋率**: 78%

### 變更的測試
- `opportunity.test.ts` - 新增 2 個測試案例
- `llm.test.ts` - 更新 1 個測試案例

**結論**: 所有變更都有對應的測試 ✅
```

## 專案測試結構

### 測試位置對應

```
packages/
  api/
    src/
      routers/
        opportunity.ts        → __tests__/opportunity.test.ts
        sales-todo.ts         → __tests__/sales-todo.test.ts
  services/
    src/
      llm.ts                  → __tests__/llm.test.ts
      transcription.ts        → __tests__/transcription.test.ts

apps/
  web/
    src/
      components/
        Button.tsx            → Button.test.tsx
    e2e/
      opportunity.spec.ts     (E2E 測試)
```

### 測試命名規範

```typescript
describe('模組/函數名稱', () => {
  describe('方法名稱', () => {
    it('should [預期行為] when [條件]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## 例外情況

以下情況可以不需要測試變更：

| 情況 | 原因 |
|------|------|
| 只修改註解 | 不影響邏輯 |
| 只修改型別定義 | TypeScript 編譯時檢查 |
| 重構（不改邏輯） | 現有測試應該覆蓋 |
| 設定檔變更 | 依情況判斷 |
| 文件變更 | 非程式碼 |

## 整合的工具

| 工具 | 用途 |
|------|------|
| `Bash(git)` | 識別變更檔案 |
| `Bash(test)` | 執行測試 |
| `Glob` | 尋找對應測試檔案 |
| `Read` | 分析測試內容 |

## 相關 Skills

- `/test` - 執行測試
- `/code-review` - 程式碼審查
- `/commit` - Commit 前檢查
