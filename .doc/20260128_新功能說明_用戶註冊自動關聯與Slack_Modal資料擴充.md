# 2026-01-28 新功能說明：用戶註冊自動關聯與 Slack Modal 資料擴充

**日期**: 2026-01-28
**版本**: v3.2.0

---

## 目錄

1. [功能一：用戶註冊自動建立 User Profile 並關聯 Slack ID](#功能一用戶註冊自動建立-user-profile-並關聯-slack-id)
2. [功能二：Slack Modal 資料欄位擴充](#功能二slack-modal-資料欄位擴充)
3. [資料庫遷移記錄](#資料庫遷移記錄)
4. [部署清單](#部署清單)

---

# 功能一：用戶註冊自動建立 User Profile 並關聯 Slack ID

## 功能描述

當新用戶透過 Google OAuth 註冊系統時，系統會自動：
1. 建立 `user_profiles` 記錄
2. 如果用戶的 email 在預設的映射表中，自動填入 `slack_user_id`
3. 設定預設角色為 `sales_rep`

## 業務價值

- **自動化用戶設定**：減少手動設定 Slack ID 的工作
- **即時生效**：用戶註冊後立即能在機會管理頁面正確顯示業務名稱
- **資料一致性**：確保 Slack 上傳與 Web 註冊的資料能正確關聯

## 技術實作

### 架構圖

```
用戶點擊 Google 登入
    ↓
Better Auth 處理 OAuth
    ↓
建立 user 記錄
    ↓
觸發 databaseHooks.user.create.after
    ↓
檢查 EMAIL_TO_SLACK_ID 映射表
    ↓
建立 user_profile 記錄
├─ userId: 新用戶 ID
├─ slackUserId: 映射的 Slack ID（或 null）
├─ role: "sales_rep"
└─ timestamps
```

### 核心代碼

**檔案**: `packages/auth/src/index.ts`

```typescript
import { db } from "@Sales_ai_automation_v3/db";
import { userProfiles } from "@Sales_ai_automation_v3/db/schema";
import { eq } from "drizzle-orm";

/**
 * Email 到 Slack User ID 的映射表
 * 用於新用戶註冊時自動填入 slack_user_id
 */
const EMAIL_TO_SLACK_ID: Record<string, string> = {
  "stephen.kao@ichef.com.tw": "U0BU3PESX",
  "solo.chung@ichef.com.tw": "UCPDC51A4",
  "kevin.chen@ichef.com.tw": "UEVG3HUF4",
  "belle.chen@ichef.com.tw": "U07K188QJFQ",
  "eileen.lee@ichef.com.tw": "U8TC4Q7HB",
  "ariel.liu@ichef.com.tw": "U06U7HUEZFT",
  "kim.liang@ichef.com.tw": "U028Q69EKF1",
  "bonnie.liu@ichef.com.tw": "U01FS5DQT0T",
  "anna.yang@ichef.com.tw": "U015SA8USQ1",
  "eddie.chan@ichef.com.tw": "U0MATRQ2U",
  "joy.wu@ichef.com.tw": "U041VGKJGA1",
  "mai.chang@ichef.com.tw": "US97EGHJ5",
};

export const auth = betterAuth({
  // ... 其他設定 ...

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // 查找對應的 Slack User ID
          const slackUserId = EMAIL_TO_SLACK_ID[user.email] || null;

          // 檢查是否已有 profile
          const existingProfile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.userId, user.id),
          });

          if (!existingProfile) {
            // 建立新的 user_profile
            await db.insert(userProfiles).values({
              userId: user.id,
              role: "sales_rep",
              slackUserId,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else if (slackUserId && !existingProfile.slackUserId) {
            // 如果 profile 存在但沒有 slackUserId，更新它
            await db
              .update(userProfiles)
              .set({ slackUserId, updatedAt: new Date() })
              .where(eq(userProfiles.userId, user.id));
          }
        },
      },
    },
  },
});
```

### 相關資料表

```sql
-- user_profiles 表結構
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id),
  slack_user_id TEXT,  -- 關聯到 Slack 的 User ID
  role TEXT DEFAULT 'sales_rep',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## 維護說明

### 新增業務人員

當有新業務加入公司時，需要更新映射表：

**步驟 1**: 取得新員工的 Slack User ID
- 在 Slack 中點擊員工頭像 → 查看 Profile → 複製 Member ID

**步驟 2**: 更新映射表
- 編輯 `packages/auth/src/index.ts`
- 在 `EMAIL_TO_SLACK_ID` 中新增一行

```typescript
const EMAIL_TO_SLACK_ID: Record<string, string> = {
  // ... 現有映射 ...
  "new.employee@ichef.com.tw": "UXXXXXXXXXX",  // 新增這行
};
```

**步驟 3**: 同步更新另一處映射表
- 編輯 `packages/api/src/routers/conversation.ts`
- 在 `SLACK_ID_TO_EMAIL` 中新增反向映射

```typescript
const SLACK_ID_TO_EMAIL: Record<string, string> = {
  // ... 現有映射 ...
  "UXXXXXXXXXX": "new.employee@ichef.com.tw",  // 新增這行
};
```

**步驟 4**: 部署
```bash
cd apps/server
bunx wrangler deploy
```

### 未來改進建議

考慮將映射表從 hardcode 改為資料庫管理：
- 建立 `slack_email_mappings` 資料表
- 透過 Admin UI 管理映射關係
- 減少代碼部署需求

---

# 功能二：Slack Modal 資料欄位擴充

## 功能描述

擴充資料庫 schema 以支援 Slack Modal 收集的額外資料：
- 待辦事項的提醒天數
- 結案時的拒絕原因
- 結案時的競品選擇
- 成交記錄的預計付款日期

## 業務價值

- **完整記錄銷售互動**：保存所有 Slack Modal 收集的資料
- **分析拒絕原因**：了解客戶為何選擇競品
- **追蹤付款進度**：記錄預計付款日期便於後續追蹤

## 新增欄位詳細說明

### 1. sales_todos.remind_days

| 屬性 | 值 |
|------|-----|
| 欄位名稱 | `remind_days` |
| 資料類型 | `INTEGER` |
| 用途 | 儲存用戶選擇的提醒天數 |
| 可能值 | `1`, `3`, `5`, `7`, `14` |
| 來源 | Slack「新增待辦」Modal |

**Schema 定義**:
```typescript
// packages/db/src/schema/sales-todo.ts
export const salesTodos = pgTable("sales_todos", {
  // ... 其他欄位 ...
  remindDays: integer("remind_days"), // 用戶選擇的提醒天數 (1/3/5/7/14)
});
```

**使用場景**:
當業務在 Slack 中設定待辦事項時，可選擇幾天後提醒：
- 1 天後提醒
- 3 天後提醒
- 5 天後提醒
- 7 天後提醒
- 14 天後提醒

### 2. opportunities.rejection_reason

| 屬性 | 值 |
|------|-----|
| 欄位名稱 | `rejection_reason` |
| 資料類型 | `TEXT` |
| 用途 | 儲存客戶拒絕/案件失敗的原因 |
| 來源 | Slack「Close Case」Modal |

**Schema 定義**:
```typescript
// packages/db/src/schema/opportunity.ts
export const opportunities = pgTable("opportunities", {
  // ... 其他欄位 ...
  rejectionReason: text("rejection_reason"), // 拒絕/失敗原因
});
```

**使用場景**:
當業務將案件標記為「Lost」時，記錄失敗原因：
- 價格太高
- 功能不符合需求
- 客戶選擇競品
- 預算不足
- 時機不對
- 其他

### 3. opportunities.selected_competitor

| 屬性 | 值 |
|------|-----|
| 欄位名稱 | `selected_competitor` |
| 資料類型 | `TEXT` |
| 用途 | 儲存客戶選擇的競爭對手 |
| 來源 | Slack「Close Case」Modal |

**Schema 定義**:
```typescript
// packages/db/src/schema/opportunity.ts
export const opportunities = pgTable("opportunities", {
  // ... 其他欄位 ...
  selectedCompetitor: text("selected_competitor"), // 客戶選擇的競品
});
```

**使用場景**:
當客戶選擇競品時，記錄是哪家競爭對手：
- 競品 A
- 競品 B
- 競品 C
- 其他（自填）

### 4. WonRecord.paymentDate

| 屬性 | 值 |
|------|-----|
| 欄位名稱 | `paymentDate` |
| 資料類型 | `string` (ISO 8601 日期格式) |
| 用途 | 儲存預計付款日期 |
| 來源 | Slack「成交」Modal |

**TypeScript 介面定義**:
```typescript
// packages/db/src/schema/sales-todo.ts
export interface WonRecord {
  amount?: number;
  currency?: string;
  product?: string;
  paymentDate?: string;  // 新增：預計付款日期
  note?: string;
  wonAt: string;
  wonVia: "slack" | "web";
}
```

**使用場景**:
當業務標記案件為「Won」時，可填入預計收款日期，便於財務追蹤。

---

# 資料庫遷移記錄

## Migration 0006: add_modal_missing_fields

**檔案位置**: `packages/db/migrations/0006_add_modal_missing_fields.sql`

### SQL 內容

```sql
-- Migration: 0006_add_modal_missing_fields
-- 新增 Slack Modal 缺少的資料庫欄位
-- Date: 2026-01-28

-- ============================================================
-- 1. salesTodos 新增 remind_days 欄位
-- ============================================================
ALTER TABLE sales_todos
ADD COLUMN IF NOT EXISTS remind_days INTEGER;

COMMENT ON COLUMN sales_todos.remind_days IS '用戶選擇的提醒天數 (1/3/5/7/14)';

-- ============================================================
-- 2. opportunities 新增 rejection_reason 欄位
-- ============================================================
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN opportunities.rejection_reason IS '拒絕/失敗原因';

-- ============================================================
-- 3. opportunities 新增 selected_competitor 欄位
-- ============================================================
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS selected_competitor TEXT;

COMMENT ON COLUMN opportunities.selected_competitor IS '客戶選擇的競品';
```

### 執行腳本

**檔案位置**: `packages/db/run-migration-0006.ts`

```bash
# 執行方式
DATABASE_URL=<your-database-url> bun run packages/db/run-migration-0006.ts
```

### 執行結果

```
🚀 開始執行 Migration 0006...

1️⃣ 新增 sales_todos.remind_days 欄位...
   ✅ 完成

2️⃣ 新增 opportunities.rejection_reason 欄位...
   ✅ 完成

3️⃣ 新增 opportunities.selected_competitor 欄位...
   ✅ 完成

📋 驗證欄位...

   sales_todos.remind_days: ✅ 存在
   opportunities 新欄位: ✅ 全部存在

✨ Migration 0006 完成！
```

---

# 部署清單

## 已部署項目

| 服務 | 部署時間 | 狀態 |
|------|----------|------|
| Server (apps/server) | 2026-01-28 | ✅ 已部署 |
| Web (apps/web) | 2026-01-28 | ✅ 已部署 |
| Database Migration 0006 | 2026-01-28 | ✅ 已執行 |

## 部署命令參考

```bash
# Server 部署
cd apps/server
bunx wrangler deploy

# Web 部署
cd apps/web
bun run build
bunx wrangler pages deploy dist --project-name=sales-ai-web --branch=main --commit-dirty=true --commit-message="feat: user registration auto-link and modal fields"

# 資料庫遷移
DATABASE_URL=<connection-string> bun run packages/db/run-migration-0006.ts
```

---

## 相關文件

- [Bug 修復報告](.doc/20260128_Bug修復報告.md)
- [Slack Bot 問題排查手冊](.doc/20260113_Slack_Bot問題排查手冊.md)
- [Google OAuth 登入設定說明](.doc/20260120_Google_OAuth登入設定說明.md)

---

## 變更摘要

| 類別 | 項目 | 說明 |
|------|------|------|
| 新功能 | User Profile 自動建立 | 用戶註冊時自動建立 profile 並關聯 Slack ID |
| Schema | sales_todos.remind_days | 儲存提醒天數選擇 |
| Schema | opportunities.rejection_reason | 儲存拒絕原因 |
| Schema | opportunities.selected_competitor | 儲存競品選擇 |
| TypeScript | WonRecord.paymentDate | 儲存預計付款日期 |
