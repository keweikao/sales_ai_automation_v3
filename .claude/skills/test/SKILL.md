---
name: test
description: 執行專案測試。支援單元測試、整合測試、E2E 測試。可指定特定測試檔案或測試套件。
allowed-tools:
  - Bash(bun *)
  - Bash(npx *)
  - Read
  - Glob
  - Grep
---

# /test - 執行測試

## 描述
統一的測試執行入口，支援單元測試、整合測試、E2E 測試。可指定特定測試檔案或測試套件。

## 使用方式
```
/test                          # 執行所有測試
/test unit                     # 只執行單元測試
/test integration              # 只執行整合測試
/test e2e                      # 只執行 E2E 測試
/test api                      # 只測試 API 相關
/test --watch                  # 監看模式
/test --coverage               # 產生覆蓋率報告
/test path/to/test.ts          # 執行特定測試檔案
/test --filter "opportunity"   # 篩選測試名稱
```

## 測試架構

### 測試類型

| 類型 | 位置 | 框架 | 說明 |
|------|------|------|------|
| Unit | `**/*.test.ts` | Vitest | 單元測試 |
| Integration | `**/*.integration.test.ts` | Vitest | 整合測試 |
| E2E | `apps/web/e2e/**/*.spec.ts` | Playwright | 端對端測試 |

### 測試目錄結構

```
packages/
  api/
    src/
      routers/
        __tests__/
          opportunity.test.ts
          sales-todo.test.ts
  services/
    src/
      __tests__/
          transcription.test.ts
          meddic-analyzer.test.ts
apps/
  web/
    e2e/
      auth.spec.ts
      opportunity.spec.ts
      todo.spec.ts
```

## 執行流程

### 步驟 1: 解析參數

| 參數 | 說明 |
|------|------|
| (無) | 執行所有測試 |
| unit | 只執行單元測試 |
| integration | 只執行整合測試 |
| e2e | 只執行 E2E 測試 |
| api | 只測試 packages/api |
| services | 只測試 packages/services |
| --watch | 監看模式，檔案變更自動重跑 |
| --coverage | 產生測試覆蓋率報告 |
| --filter | 篩選測試名稱 |
| [path] | 執行特定測試檔案 |

### 步驟 2: 執行前置檢查

**2.1 檢查依賴是否安裝：**
```bash
bun install --frozen-lockfile
```

**2.2 檢查 TypeScript 編譯：**
```bash
bun run check-types
```

### 步驟 3: 執行測試

**3.1 單元測試（Vitest）：**
```bash
# 所有單元測試
bun run test:unit

# 特定套件
bun run test:unit --filter "packages/api"

# 監看模式
bun run test:unit --watch

# 覆蓋率
bun run test:unit --coverage
```

**3.2 整合測試：**
```bash
# 需要資料庫連線
DATABASE_URL="..." bun run test:integration
```

**3.3 E2E 測試（Playwright）：**
```bash
# 執行所有 E2E 測試
npx playwright test

# 特定測試檔案
npx playwright test e2e/auth.spec.ts

# 指定瀏覽器
npx playwright test --project=chromium

# UI 模式（除錯用）
npx playwright test --ui

# 顯示測試過程
npx playwright test --headed
```

### 步驟 4: 輸出結果

---

## 輸出格式

### 測試通過

```markdown
## 測試結果 ✅

### 執行摘要
| 類型 | 通過 | 失敗 | 跳過 | 耗時 |
|------|------|------|------|------|
| Unit | 45 | 0 | 2 | 3.2s |
| Integration | 12 | 0 | 0 | 8.5s |
| E2E | 8 | 0 | 0 | 25s |
| **總計** | **65** | **0** | **2** | **36.7s** |

### 覆蓋率（如有）
| 套件 | 行數 | 分支 | 函數 |
|------|------|------|------|
| packages/api | 85% | 78% | 90% |
| packages/services | 72% | 65% | 80% |
| packages/db | 45% | 40% | 50% |

### 跳過的測試
- `opportunity.test.ts` - "should handle large dataset" (slow)
- `transcription.test.ts` - "should retry on timeout" (flaky)
```

### 測試失敗

```markdown
## 測試結果 ❌

### 執行摘要
| 類型 | 通過 | 失敗 | 跳過 | 耗時 |
|------|------|------|------|------|
| Unit | 43 | 2 | 2 | 3.5s |
| Integration | 11 | 1 | 0 | 9.2s |
| **總計** | **54** | **3** | **2** | **12.7s** |

### 失敗的測試

#### ❌ packages/api/src/routers/__tests__/opportunity.test.ts
**測試名稱**: should create opportunity with valid data
**錯誤訊息**:
```
Expected: { status: "success" }
Received: { status: "error", message: "Invalid customer number" }
```
**位置**: `opportunity.test.ts:45:12`

#### ❌ packages/api/src/routers/__tests__/sales-todo.test.ts
**測試名稱**: should complete todo and create next
**錯誤訊息**:
```
TypeError: Cannot read property 'id' of undefined
```
**位置**: `sales-todo.test.ts:120:8`

#### ❌ packages/services/src/__tests__/meddic.integration.test.ts
**測試名稱**: should analyze conversation with Gemini
**錯誤訊息**:
```
Error: GEMINI_API_KEY not set
```
**位置**: `meddic.integration.test.ts:35:5`

### 建議修復步驟
1. **opportunity.test.ts:45** - 檢查客戶編號驗證邏輯
2. **sales-todo.test.ts:120** - 確認 todo 建立回傳值
3. **meddic.integration.test.ts** - 設定測試環境變數
```

### E2E 測試結果

```markdown
## E2E 測試結果 ✅

### 執行摘要
| 瀏覽器 | 通過 | 失敗 | 耗時 |
|--------|------|------|------|
| Chromium | 8 | 0 | 18s |
| Firefox | 8 | 0 | 22s |
| WebKit | 8 | 0 | 20s |

### 測試案例
| 檔案 | 測試 | 結果 | 耗時 |
|------|------|------|------|
| auth.spec.ts | 登入流程 | ✅ | 2.1s |
| auth.spec.ts | 登出流程 | ✅ | 1.8s |
| opportunity.spec.ts | 建立機會 | ✅ | 3.2s |
| opportunity.spec.ts | 編輯機會 | ✅ | 2.5s |
| todo.spec.ts | 完成待辦 | ✅ | 2.8s |
| todo.spec.ts | 改期待辦 | ✅ | 2.3s |
| ... | ... | ... | ... |

### 截圖（失敗時）
如有失敗，截圖保存於: `apps/web/test-results/`
```

---

## 測試命令參考

### Vitest 命令

```bash
# 基本執行
bun run test

# 監看模式
bun run test --watch

# 只執行特定檔案
bun run test path/to/file.test.ts

# 篩選測試名稱
bun run test --filter "opportunity"

# 產生覆蓋率
bun run test --coverage

# 更新快照
bun run test --update-snapshots

# 顯示詳細輸出
bun run test --reporter=verbose
```

### Playwright 命令

```bash
# 基本執行
npx playwright test

# 特定檔案
npx playwright test e2e/auth.spec.ts

# 特定瀏覽器
npx playwright test --project=chromium

# UI 模式
npx playwright test --ui

# 顯示瀏覽器
npx playwright test --headed

# 除錯模式
npx playwright test --debug

# 產生報告
npx playwright show-report
```

---

## 環境變數

測試可能需要的環境變數：

| 變數 | 用途 | 測試類型 |
|------|------|----------|
| DATABASE_URL | 測試資料庫連線 | Integration |
| GEMINI_API_KEY | Gemini API | Integration |
| GROQ_API_KEY | Groq API | Integration |
| BASE_URL | E2E 測試網址 | E2E |

**設定測試環境：**
```bash
# 建立 .env.test
cp .env.example .env.test

# 執行時指定
DATABASE_URL="..." bun run test:integration
```

---

## 整合的工具

| 工具 | 用途 |
|------|------|
| `Bash` | 執行測試命令 |
| `Read` | 查看測試檔案 |
| `Grep` | 搜尋測試相關代碼 |

## 相關 Skills

- `/smart-deploy` - 部署前會執行測試
- `/diagnose` - 問題診斷可能需要查看測試

## 注意事項

1. **測試隔離** - 每個測試應該獨立，不依賴其他測試的執行順序
2. **Mock 外部服務** - 單元測試應 mock 外部 API（Gemini、Groq 等）
3. **測試資料庫** - 整合測試使用獨立的測試資料庫
4. **CI/CD** - 所有測試在 PR merge 前必須通過
