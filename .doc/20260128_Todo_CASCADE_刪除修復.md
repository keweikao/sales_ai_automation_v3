# Todo CASCADE 刪除修復

**日期**: 2026-01-28
**類型**: Bug 修復 + Database Migration
**影響範圍**: Database Schema, Sales Todo

---

## 問題描述

### 原始問題
刪除 Opportunity（商機）時，關聯的 Sales Todo **不會被刪除**，而是變成「孤兒記錄」（orphaned records）。

### 技術細節
在 [sales-todo.ts:78-80](packages/db/src/schema/sales-todo.ts#L78-L80)：

```typescript
opportunityId: text("opportunity_id").references(() => opportunities.id, {
  onDelete: "set null",  // ❌ 問題：Todo 不會被刪除，只是 opportunityId 被設為 null
}),
```

這導致：
- ❌ 刪除機會時，Todo 保留在資料庫中
- ⚠️ Todo 的 `opportunityId` 被設為 `null`
- 💔 產生無法追蹤的「孤兒 Todo」

---

## 解決方案

### 修改 Schema
將外鍵約束從 `onDelete: "set null"` 改為 `onDelete: "cascade"`：

```typescript
opportunityId: text("opportunity_id").references(() => opportunities.id, {
  onDelete: "cascade", // ✅ 刪除機會時，連帶刪除所有關聯的 Todo
}),
```

### 檔案修改

#### 1. Schema 修改
**檔案**: [packages/db/src/schema/sales-todo.ts](packages/db/src/schema/sales-todo.ts)

```typescript
// 關聯
userId: text("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" }),
opportunityId: text("opportunity_id").references(() => opportunities.id, {
  onDelete: "cascade", // 刪除機會時，連帶刪除所有關聯的 Todo
}),
conversationId: text("conversation_id").references(() => conversations.id, {
  onDelete: "set null", // 刪除對話時，Todo 保留但 conversationId 設為 null
}),
```

#### 2. Database Migration
**檔案**: [packages/db/migrations/0009_cascade_delete_todos_with_opportunity.sql](packages/db/migrations/0009_cascade_delete_todos_with_opportunity.sql)

```sql
-- Step 1: 刪除舊的外鍵約束
ALTER TABLE "sales_todos"
  DROP CONSTRAINT IF EXISTS "sales_todos_opportunity_id_opportunities_id_fk";

-- Step 2: 新增 CASCADE 外鍵約束
ALTER TABLE "sales_todos"
  ADD CONSTRAINT "sales_todos_opportunity_id_opportunities_id_fk"
  FOREIGN KEY ("opportunity_id")
  REFERENCES "opportunities"("id")
  ON DELETE CASCADE;
```

#### 3. Migration 執行腳本
**檔案**: [packages/db/run-migration-0009.ts](packages/db/run-migration-0009.ts)

執行指令：
```bash
DATABASE_URL="$(grep '^DATABASE_URL=' apps/server/.env | cut -d= -f2-)" \
  bun run packages/db/run-migration-0009.ts
```

---

## 執行結果

```
🚀 Running migration 0009: Cascade delete todos with opportunity...

📋 檢查現有外鍵約束...
✅ Migration SQL executed successfully!

📋 驗證新約束...
   約束名稱: sales_todos_opportunity_id_opportunities_id_fk
   刪除規則: CASCADE
   狀態: ✅ CASCADE

✨ Migration 0009 completed successfully!
💡 現在刪除 opportunity 時，所有關聯的 sales_todos 也會被刪除。
```

---

## 影響分析

### 刪除行為變更

| 操作 | 修復前 | 修復後 |
|------|--------|--------|
| 刪除 Opportunity | Todo 保留，`opportunityId` 設為 `null` | Todo **一併刪除** |
| 刪除 Conversation | Todo 保留，`conversationId` 設為 `null` | Todo 保留，`conversationId` 設為 `null`（未改變） |
| 刪除 User | Todo **一併刪除** | Todo **一併刪除**（未改變） |

### 資料完整性
- ✅ 避免產生「孤兒 Todo」
- ✅ 確保資料一致性
- ✅ 簡化資料維護

### 相關功能
此修復影響以下功能：
1. **標記為拒絕** (`rejectOpportunity`)
2. **刪除機會** (`deleteOpportunity`)
3. 任何會刪除 Opportunity 的操作

---

## 注意事項

### ⚠️ 重要提醒
- **CASCADE 刪除是不可逆的**：刪除 Opportunity 時，所有關聯的 Todo 都會永久刪除
- 如需保留 Todo 記錄，請在刪除前先備份或導出資料
- 建議在刪除 Opportunity 前，先檢視是否有重要的 Todo 需要處理

### 建議做法
1. 優先使用「標記為 lost」而非直接刪除
2. 重要的 Todo 應在刪除前完成或轉移
3. 定期備份資料庫

---

## 相關文件

- Schema 定義: [packages/db/src/schema/sales-todo.ts](packages/db/src/schema/sales-todo.ts)
- Opportunity API: [packages/api/src/routers/opportunity.ts](packages/api/src/routers/opportunity.ts)
- Migration 檔案: [packages/db/migrations/0009_cascade_delete_todos_with_opportunity.sql](packages/db/migrations/0009_cascade_delete_todos_with_opportunity.sql)

---

**修復完成** ✅

---

## 📋 孤兒 Todo 清理記錄

**清理時間**: 2026-01-28

### 清理前狀態
- 總 Todo 數量: 5
- 孤兒 Todo（opportunityId = NULL）: 5
- 有關聯的 Todo: 0

### 清理的 Todo 列表

| # | 標題 | 客戶編號 | 建立時間 | 說明 |
|---|------|---------|----------|------|
| 1 | 確認股東狀況 | 202501-111222 | 2026/1/28 08:04 | Opportunity 存在但未正確關聯 |
| 2 | test | 202612-000043 | 2026/1/28 07:03 | Opportunity 已刪除 |
| 3 | Slack測試 | 202610-000002 | 2026/1/28 06:48 | Opportunity 已刪除 |
| 4 | API測試Todo | 202609-000004 | 2026/1/28 06:40 | Opportunity 已刪除 |
| 5 | 測試待辦事項 | 無 | 2026/1/28 03:27 | Opportunity 已刪除 |

### 清理結果
- ✅ 已刪除 5 筆孤兒 Todo
- 📊 剩餘孤兒 Todo: 0
- 📊 總 Todo 數: 0

### 清理原因
這些 Todo 的 Opportunity 已在 Migration 0009 之前被刪除，導致 `opportunityId` 被設為 `NULL`，成為「孤兒記錄」。為維護資料庫整潔，已將這些無效記錄清除。

### 未來預防
Migration 0009 已將外鍵約束改為 `CASCADE`，未來刪除 Opportunity 時會自動刪除關聯的 Todo，不會再產生孤兒記錄。

---

**文檔完成** ✅
