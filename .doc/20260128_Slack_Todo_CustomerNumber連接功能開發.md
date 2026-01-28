# Slack Todo CustomerNumber 連接功能開發

> 開發日期：2026-01-28
> 狀態：✅ 已完成並部署

## 一、需求背景

### 問題描述

音檔上傳後，業務需要選擇「建立 Follow-up」或「客戶拒絕」，但當時 `opportunityId` 尚未存在（因為 opportunity 是非同步建立的），導致 Todo 無法正確關聯到商機。

### 核心需求

1. 音檔上傳後，讓業務選擇兩個選項之一：
   - **建立 Follow-up**：填寫 Todo 表單
   - **客戶已拒絕**：填寫結案表單
2. Todo 使用 `customerNumber` 連接，不再依賴 `opportunityId`

### 技術方案

Todo 直接用 `customerNumber` 連接，在表單提交時就已確定，不需要等待 opportunity 建立。

## 二、為什麼用 customerNumber 連接更好？

| 優勢 | 說明 |
|------|------|
| **更簡潔** | 不需要延遲關聯邏輯 |
| **更穩定** | `customerNumber` 是業務上的唯一識別碼，在上傳表單時就已確定 |
| **不依賴時序** | 不需要等 opportunity 建立後再更新 Todo |
| **向後相容** | 現有 Todo 的 `opportunityId` 仍然有效 |

## 三、新流程設計

```
1. 用戶提交音檔上傳表單（包含 customerNumber）
   ↓
2. 立即 push 選擇 Modal（兩個按鈕）
   ├── 📅 建立 Follow-up  ──→  填寫 Todo 表單
   │      - 幾天後提醒 (1/3/5/7/14)
   │      - Follow 事項
   │      - 詳細描述（選填）
   │      ↓
   │   提交時建立 Todo（使用 customerNumber 連接）
   │
   └── 👋 客戶已拒絕  ──→  填寫結案表單
          - 拒絕原因
          - 競品資訊（選填）
          ↓
       提交時建立 lost Todo（使用 customerNumber 連接）
   ↓
3. 非同步處理音檔（同時進行，獨立於 Todo 建立）
   - 建立 opportunity
   - 轉錄、分析
```

**關鍵改變**：所有 Modal 都傳遞 `customerNumber`，Todo 建立時用 `customerNumber` 連接

## 四、資料庫 Schema 修改

### 新增欄位

**檔案**: `packages/db/src/schema/sales-todo.ts`

```typescript
// 在 salesTodos 表定義中新增
// customerNumber - 用於連接 opportunity（不依賴 opportunityId）
customerNumber: text("customer_number"),
```

### Migration SQL

```sql
ALTER TABLE sales_todos ADD COLUMN customer_number TEXT;
CREATE INDEX idx_sales_todos_customer_number ON sales_todos(customer_number);
```

### 保留 opportunityId

向後相容，現有資料不受影響。

## 五、查詢方式變更

### 舊方式（使用 opportunityId）

```sql
SELECT * FROM sales_todos WHERE opportunity_id = ?
```

### 新方式（使用 customerNumber JOIN）

```sql
SELECT t.*, o.company_name, o.contact_name
FROM sales_todos t
LEFT JOIN opportunities o ON t.customer_number = o.customer_number
WHERE t.customer_number = ?
```

### Drizzle ORM 查詢範例

```typescript
// 查詢 Todo 並關聯 Opportunity 資訊
const todos = await db
  .select({
    todo: salesTodos,
    opportunity: opportunities,
  })
  .from(salesTodos)
  .leftJoin(
    opportunities,
    eq(salesTodos.customerNumber, opportunities.customerNumber)
  )
  .where(eq(salesTodos.userId, userId));
```

## 六、修改計劃

### 6.1 資料庫 Schema

**檔案**: `packages/db/src/schema/sales-todo.ts`

**修改內容**: 新增 `customerNumber` 欄位

```typescript
// 在 conversationId 之後新增
// customerNumber - 用於連接 opportunity（不依賴 opportunityId）
customerNumber: text("customer_number"),
```

**狀態**: ✅ 已完成

### 6.2 API - createTodo

**檔案**: `packages/api/src/routers/sales-todo.ts`

**修改內容**:
1. 在 `createTodoSchema` 新增 `customerNumber` 欄位
2. 建立 Todo 時直接存 `customerNumber`
3. 新增 Log 記錄

**狀態**: ✅ 已完成

### 6.3 Slack Bot - 音檔上傳流程

**檔案**: `apps/slack-bot/src/index.ts` (Line 807-818)

**修改內容**: 傳遞 `customerNumber` 到選擇 Modal

**狀態**: ✅ 已完成

### 6.4 Modal 定義

**檔案**: `apps/slack-bot/src/blocks/follow-up-modal.ts`

**修改內容**:
1. 在 `FollowUpModalData` interface 新增 `customerNumber`
2. 在所有 Modal 函數中將 `customerNumber` 存入 `private_metadata` 和按鈕 value

**狀態**: ✅ 已完成

### 6.5 Follow-up 表單提交處理

**檔案**: `apps/slack-bot/src/index.ts` (Line 914-922)

**修改內容**: 使用 `customerNumber` 作為主要連接欄位

**狀態**: ✅ 已完成

### 6.6 ApiClient

**檔案**: `apps/slack-bot/src/api-client.ts` (Line 287-299)

**修改內容**: 新增 `customerNumber` 參數

**狀態**: ✅ 已完成

## 七、檔案清單

| 檔案 | 修改類型 | 說明 | 狀態 |
|------|----------|------|------|
| `packages/db/src/schema/sales-todo.ts` | 修改 | 新增 `customerNumber` 欄位 | ✅ |
| `packages/api/src/routers/sales-todo.ts` | 修改 | createTodoSchema 新增 customerNumber、插入時存 customerNumber、新增 log 記錄 | ✅ |
| `apps/slack-bot/src/blocks/follow-up-modal.ts` | 修改 | FollowUpModalData 新增 customerNumber、所有 Modal 函數傳遞 customerNumber | ✅ |
| `apps/slack-bot/src/index.ts` | 修改 | 傳遞 customerNumber 到選擇 Modal (Line 807-818)、傳遞 customerNumber 給 API (Line 914-922)、結案表單也傳遞 customerNumber (Line 979-986) | ✅ |
| `apps/slack-bot/src/api-client.ts` | 修改 | createTodo 新增 customerNumber 參數 | ✅ |

## 八、Logging 與錯誤處理機制

### 8.1 資料儲存確認

- 所有 Todo 操作都會記錄到 `todo_logs` 表
- 包含 `create`、`complete`、`postpone`、`won`、`lost`、`cancel` 操作
- 每筆 log 記錄：
  - 操作類型
  - 操作來源（slack/web）
  - 變更前後資料
  - 時間戳

### 8.2 錯誤代碼（API 層）

| Error Code | HTTP Status | 說明 |
|------------|-------------|------|
| `UNAUTHORIZED` | 401 | 未登入/Token 無效 |
| `FORBIDDEN` | 403 | 無權限存取 |
| `NOT_FOUND` | 404 | 找不到指定資源 |
| `BAD_REQUEST` | 400 | 請求格式錯誤（附帶詳細 message） |
| `INTERNAL_SERVER_ERROR` | 500 | 伺服器內部錯誤 |

### 8.3 錯誤處理流程

```
Slack Bot 呼叫 API
    ↓
API 返回錯誤？
├── 是 → console.error 記錄錯誤詳情
│        - error.message
│        - error.stack
│        - HTTP status code
│        ↓
│        返回 response_action: "errors" 給 Slack
│        用戶在 Modal 看到錯誤訊息
│
└── 否 → console.log 記錄成功
         - todoId
         - title
         - dueDate
         ↓
         記錄到 todo_logs 表
```

### 8.4 查詢歷程

```sql
-- 查詢特定 Todo 的操作歷程
SELECT * FROM todo_logs
WHERE todo_id = 'xxx'
ORDER BY created_at DESC;

-- 查詢特定 customerNumber 相關的 Todo 和歷程
SELECT t.*, o.company_name, l.*
FROM sales_todos t
LEFT JOIN opportunities o ON t.customer_number = o.customer_number
LEFT JOIN todo_logs l ON t.id = l.todo_id
WHERE t.customer_number = '201700-000001'
ORDER BY l.created_at DESC;
```

### 8.5 Cloudflare Workers Logs

- Slack Bot 的 API 呼叫都有 console.log/console.error 記錄
- 可在 Cloudflare Dashboard → Workers → Logs 查看即時 logs
- 成功格式：`[Follow-up] Created todo via API: { todoId, title, dueDate }`
- 錯誤格式：`[Follow-up] Failed to create todo: { message, stack }`

## 九、驗證步驟

1. 執行 database migration：`bun run db:push`
2. 部署 Server: `cd apps/server && npx wrangler deploy`
3. 部署 Slack Bot: `cd apps/slack-bot && npx wrangler deploy`
4. 在 Slack 上傳音檔並填寫表單（記下 customerNumber）
5. 確認表單提交後彈出選擇 Modal（兩個按鈕：建立 Follow-up / 客戶已拒絕）
6. 點擊「建立 Follow-up」，填寫 Todo 表單並提交
7. 檢查資料庫：
   - 確認 Todo 已建立
   - 確認 `customer_number` 欄位有值
8. 再次測試：選擇「客戶已拒絕」，填寫結案表單並提交
9. 確認 lost Todo 已建立，`customer_number` 欄位有值
10. 在 Web 端確認 Todo 可以正確顯示關聯的 Opportunity 資訊

## 十、注意事項

1. **向後相容**：現有的 Todo 仍可用 `opportunityId` 關聯
2. **查詢優化**：新增 `customer_number` 欄位的索引
3. **簡化邏輯**：不再需要延遲關聯或後處理更新
4. **完整追蹤**：所有操作都記錄到 `todo_logs` 表，可完整追蹤歷程

## 十一、相關文件

- Schema 定義：`packages/db/src/schema/sales-todo.ts`
- API Router：`packages/api/src/routers/sales-todo.ts`
- Slack Bot Modal：`apps/slack-bot/src/blocks/follow-up-modal.ts`
- Slack Bot 主程式：`apps/slack-bot/src/index.ts`
- API Client：`apps/slack-bot/src/api-client.ts`
