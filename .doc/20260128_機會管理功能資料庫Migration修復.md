# 機會管理功能資料庫 Migration 修復記錄

**日期**: 2026-01-28
**狀態**: ✅ 已修復
**影響範圍**: 機會列表頁、機會詳情頁

---

## 問題描述

部署新的機會管理功能後，機會頁面無法顯示。所有機會相關的 API endpoint 都返回錯誤。

### 受影響的功能

- 機會列表頁 (`/opportunities`)
- 機會詳情頁 (`/opportunities/$id`)
- 標記為成交功能
- 標記為拒絕功能
- 機會分頁篩選（進行中/已成交/已拒絕）

---

## 根本原因

**部署順序錯誤**：代碼已部署到 production，但資料庫 migration 尚未執行。

### 技術細節

1. **已部署的代碼**包含對新欄位的查詢：
   - `packages/api/src/routers/opportunity.ts` 中的 `listOpportunities` 和 `getOpportunity` 都會返回 `wonAt` 和 `lostAt`
   - `winOpportunity` API 會嘗試設定 `wonAt` 欄位
   - `rejectOpportunity` API 會嘗試設定 `lostAt` 欄位

2. **資料庫實際狀態**：
   - `opportunities` table 中尚未新增 `won_at` 和 `lost_at` 欄位
   - 導致所有涉及這些欄位的查詢都失敗

3. **預期的 PostgreSQL 錯誤**：
   ```
   column "won_at" does not exist
   column "lost_at" does not exist
   ```

---

## 修復步驟

### 1. 準備 Migration SQL

**檔案**: `packages/db/migrations/0008_add_won_lost_timestamps.sql`

```sql
-- Migration: Add wonAt and lostAt timestamps to opportunities table
-- Date: 2026-01-28
-- Description: 新增成交時間和拒絕時間欄位，向後相容

ALTER TABLE opportunities
ADD COLUMN won_at TIMESTAMP,
ADD COLUMN lost_at TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN opportunities.won_at IS '成交時間（當 status = won 時設定）';
COMMENT ON COLUMN opportunities.lost_at IS '拒絕時間（當 status = lost 時設定）';
```

### 2. 執行 Migration

**方式 A：Neon Console（推薦 - 最快）**

1. 開啟 Neon PostgreSQL 資料庫控制台
2. 在 SQL Editor 中執行以下 SQL：

```sql
-- 新增 won_at 和 lost_at 欄位
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS won_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS lost_at TIMESTAMP;

-- 新增欄位註解
COMMENT ON COLUMN opportunities.won_at IS '成交時間（當 status = won 時設定）';
COMMENT ON COLUMN opportunities.lost_at IS '拒絕時間（當 status = lost 時設定）';
```

**方式 B：Migration 腳本**

```bash
# 需要設定 DATABASE_URL 環境變數
export DATABASE_URL="postgresql://..."
bun run packages/db/run-migration-0008.ts
```

### 3. 驗證欄位已新增

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'opportunities'
  AND column_name IN ('won_at', 'lost_at')
ORDER BY column_name;
```

**預期結果**：

| column_name | data_type                | is_nullable |
|-------------|--------------------------|-------------|
| lost_at     | timestamp without time zone | YES         |
| won_at      | timestamp without time zone | YES         |

---

## 驗證修復

### 測試 1：機會列表頁

1. 開啟 [https://sales-ai-web.pages.dev/opportunities](https://sales-ai-web.pages.dev/opportunities)
2. ✅ 頁面正常顯示
3. ✅ Tabs 可切換（進行中/已成交/已拒絕）
4. ✅ 列表資料正確載入

### 測試 2：機會詳情頁

1. 點擊任一機會進入詳情頁
2. ✅ 頁面正常顯示
3. ✅ 三個按鈕正常顯示：標記為成交、增加待辦、標記為拒絕

### 測試 3：標記為成交功能

1. 點擊「標記為成交」按鈕
2. 確認 Dialog 彈出
3. 點擊「確認成交」
4. ✅ 操作成功，機會狀態更新為 won
5. ✅ wonAt 時間戳記已記錄

### 測試 4：標記為拒絕功能

1. 點擊「標記為拒絕」按鈕
2. 填寫拒絕原因和其他資訊
3. 點擊「確認拒絕」
4. ✅ 操作成功，機會狀態更新為 lost
5. ✅ lostAt 時間戳記已記錄
6. ✅ Todo 已建立

---

## 相關檔案

### Migration 檔案
- [packages/db/migrations/0008_add_won_lost_timestamps.sql](../packages/db/migrations/0008_add_won_lost_timestamps.sql)
- [packages/db/run-migration-0008.ts](../packages/db/run-migration-0008.ts)

### Schema 更新
- [packages/db/src/schema/opportunity.ts](../packages/db/src/schema/opportunity.ts) (Lines 76-77)

### API 實作
- [packages/api/src/routers/opportunity.ts](../packages/api/src/routers/opportunity.ts)
  - Lines 131-133: winOpportunitySchema
  - Lines 334-339: Status 篩選邏輯
  - Lines 439-440, 562-563: wonAt/lostAt 返回值
  - Lines 655-769: rejectOpportunity 實作
  - Lines 775-830: winOpportunity 實作

### 前端實作
- [apps/web/src/routes/opportunities/$id.tsx](../apps/web/src/routes/opportunities/$id.tsx)
- [apps/web/src/routes/opportunities/index.tsx](../apps/web/src/routes/opportunities/index.tsx)

---

## 經驗教訓

### ❌ 錯誤的部署順序

```
1. 修改代碼（新增 wonAt/lostAt 查詢）
2. 部署代碼到 production
3. 執行 migration ❌ 太晚了
```

### ✅ 正確的部署順序

```
1. 修改代碼（新增 wonAt/lostAt 查詢）
2. 執行 migration（新增欄位）✅ 先執行
3. 驗證 migration 成功
4. 部署代碼到 production
```

### 最佳實踐

1. **向後相容的 Migration**：
   - 新欄位使用 `ADD COLUMN IF NOT EXISTS`
   - 新欄位允許 NULL，不破壞現有資料
   - 使用 `COMMENT` 記錄欄位用途

2. **部署檢查清單**：
   - [ ] 確認所有 migration 已執行
   - [ ] 驗證資料庫 schema 與代碼一致
   - [ ] 在 staging 環境測試
   - [ ] 檢查 git status（無未提交變更）
   - [ ] 部署到 production

3. **監控與回滾**：
   - 部署後立即檢查 Cloudflare Workers 日誌
   - 準備回滾計畫（保留上一版本的代碼）
   - 如發現問題，優先執行 migration 而非回滾代碼

---

## 相關文檔

- [機會管理完整功能實作計畫](../.claude/plans/tender-wishing-clarke.md)
- [Cloudflare Workers 部署指南](https://developers.cloudflare.com/workers/)
- [Neon PostgreSQL 文檔](https://neon.tech/docs)

---

## 總結

✅ **問題已完全修復**

- 資料庫 migration 已執行
- 所有新功能正常運作
- 未來將嚴格遵守「Migration 先於代碼部署」原則
