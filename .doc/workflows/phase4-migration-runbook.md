# Phase 4 遷移執行手冊 (Migration Runbook)

> **文件目的**: 當決定 sunset 舊系統 (V2) 時，按照此文件執行完整遷移
> **預估時間**: 約 30-60 分鐘（視資料量而定）
> **前置條件**: V3 環境已部署完成
> **最後更新**: 2026-01-12（包含所有 Agent 1/2/3 的修正）

---

## ⚠️ 重要修正記錄

以下是遷移過程中發現並已修正的問題，這些修正**已整合在腳本中**，再次執行時會自動套用：

### Schema 修正 (Agent 3)

| 問題 | 修正 | 相關檔案 |
|------|------|----------|
| `alert.ts` 引用不存在的 `users` | 改為 `user` | `packages/db/src/schema/alert.ts` |
| Workspace package 無法在遷移腳本使用 | 改用相對路徑直接引入 schema | `scripts/migration/config.ts` |
| 遷移腳本無法使用 `cloudflare:workers` | 建立獨立的 Neon 連線（使用 ws） | `scripts/migration/config.ts` |
| `drizzle-kit push` 需要互動式確認 | 使用 `expect` 自動化處理 | 見執行步驟 Step 1 |
| 缺少 `opportunity_id` 等新欄位 | 手動 ALTER TABLE 補充 | `scripts/migration/fix-schema.ts` |

### 資料映射修正 (Agent 1)

| 問題 | 修正 | 相關檔案 |
|------|------|----------|
| Unicode 破折號導致 ID 不一致 | `normalizeCustomerId()` 將 U+2010~U+2014 轉為 ASCII `-` | `scripts/migration/mappers/v2-mapper.ts` |
| V2 `customerId` 格式不一致 | 統一正規化處理 | `scripts/migration/mappers/v2-mapper.ts` |
| 同一客戶有多個 Cases | 提取唯一 Opportunities，Cases → Conversations | `scripts/migration/mappers/v2-mapper.ts` |
| `duration` 欄位需要整數 | 使用 `Math.round()` 處理 | `scripts/migration/mappers/v2-mapper.ts` |
| V2 status 與 V3 不同 | 建立狀態映射表 | `scripts/migration/mappers/v2-mapper.ts` |

### 音檔遷移修正 (Agent 2)

| 問題 | 修正 | 相關檔案 |
|------|------|----------|
| GCS bucket 名稱錯誤 | 正確設定為 `sales-ai-audio-bucket` | `.env.migration` |
| GCS 有重複格式音檔（.m4a + .mp3） | 去重處理，實際遷移 127 個唯一音檔 | 遷移腳本內建邏輯 |
| R2 endpoint 設定方式不同 | 支援 `CLOUDFLARE_R2_ENDPOINT` 或 `CLOUDFLARE_ACCOUNT_ID` | `scripts/migration/config.ts` |

---

## 遷移概覽

| 遷移項目 | 來源 (V2) | 目標 (V3) | 負責 Agent |
|----------|-----------|-----------|------------|
| 資料庫結構 | - | Neon PostgreSQL | Agent 3 |
| 商機/對話/MEDDIC | Firestore | PostgreSQL | Agent 1 |
| 音檔 | GCS | Cloudflare R2 | Agent 2 |

---

## 前置準備

### 1. 環境變數確認

確保以下檔案已正確設定：

**`apps/server/.env`** - V3 服務設定：
```env
# 資料庫
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

# Cloudflare R2
CLOUDFLARE_R2_ENDPOINT="https://xxx.r2.cloudflarestorage.com"
CLOUDFLARE_R2_ACCESS_KEY="your-access-key"
CLOUDFLARE_R2_SECRET_KEY="your-secret-key"
CLOUDFLARE_R2_BUCKET="sales-ai-audio-files"

# LLM 服務
GEMINI_API_KEY="your-gemini-key"
GROQ_API_KEY="your-groq-key"
```

**`.env.migration`** - 遷移專用設定：
```env
# Firebase / GCS 設定 (V2 來源)
FIREBASE_PROJECT_ID=sales-ai-automation-v2
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@sales-ai-automation-v2.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=sales-ai-audio-bucket

# Cloudflare 帳戶 ID
CLOUDFLARE_ACCOUNT_ID=your-account-id

# 遷移用戶 ID (從 V3 資料庫取得)
MIGRATION_USER_ID=migration-user-xxx

# 模式設定
DRY_RUN=false
VERBOSE=true
```

### 2. 取得遷移用戶 ID

如果尚未建立遷移用戶，執行以下 SQL：

```sql
-- 在 Neon SQL Editor 或 psql 執行
INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
VALUES (
  'migration-user-' || gen_random_uuid()::text,
  'Migration User',
  'migration@internal.system',
  true,
  NOW(),
  NOW()
)
RETURNING id;
```

將回傳的 ID 填入 `.env.migration` 的 `MIGRATION_USER_ID`。

---

## 執行步驟

### Step 1: 建立資料庫結構 (Agent 3)

```bash
cd /Users/stephen/Desktop/sales_ai_automation_v3

# 執行 Drizzle push（會有互動式提示，選擇 "create table"）
cd packages/db
bun run db:push

# 或使用 expect 自動化（推薦）
/usr/bin/expect -c '
set timeout 120
spawn bun run db:push
expect {
    "Is * table created or renamed" {
        send "\r"
        exp_continue
    }
    "Is * column * created or renamed" {
        send "\r"
        exp_continue
    }
    eof
}
'
```

**驗證**：
```bash
cd scripts/migration
bun run final-check.ts
```

預期看到 12 個資料表已建立。

---

### Step 2: 執行資料遷移 (Agent 1)

```bash
cd /Users/stephen/Desktop/sales_ai_automation_v3

# 乾跑模式（預覽，不實際寫入）
bun run migration:dry-run

# 確認無誤後，執行實際遷移
bun run migration:run

# 或帶詳細輸出
bun run migration:verbose
```

**遷移內容**：
- Firestore `leads` → PostgreSQL `opportunities`
- Firestore `conversations` → PostgreSQL `conversations`
- Firestore `meddic_analyses` → PostgreSQL `meddic_analyses`

**預期輸出**：
```
[Leads] Migrated 111 leads to opportunities
[Conversations] Migrated 153 conversations
[MEDDIC] Migrated XX analyses
```

---

### Step 3: 執行音檔遷移 (Agent 2)

音檔遷移已整合在 `migration:run` 中，會自動執行：
- 從 GCS bucket 下載音檔
- 上傳到 Cloudflare R2
- 更新 `conversations.audio_url` 指向新位置

**獨立執行音檔遷移**（如需）：
```bash
cd scripts/migration
bun run audio-migration.ts
```

---

### Step 4: 最終驗證

```bash
cd /Users/stephen/Desktop/sales_ai_automation_v3/scripts/migration
bun run final-check.ts
```

**預期輸出**：
```
╔════════════════════════════════════════════════════════════╗
║                        總結                                ║
╚════════════════════════════════════════════════════════════╝

  ✅ 完成  資料庫表結構 (Agent 3)
  ✅ 完成  資料遷移 (Agent 1)
  ✅ 完成  音檔遷移 (Agent 2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🎉 所有遷移任務已完成！可以進入 Phase 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 驗證清單

### 資料完整性檢查

```sql
-- 在 Neon SQL Editor 執行

-- 1. 檢查資料筆數
SELECT
  (SELECT COUNT(*) FROM opportunities) as opportunities,
  (SELECT COUNT(*) FROM conversations) as conversations,
  (SELECT COUNT(*) FROM meddic_analyses) as meddic_analyses;

-- 2. 檢查音檔 URL 是否已更新為 R2
SELECT id, audio_url
FROM conversations
WHERE audio_url IS NOT NULL
LIMIT 5;

-- 3. 檢查外鍵關聯
SELECT c.id, c.opportunity_id, o.company_name
FROM conversations c
JOIN opportunities o ON c.opportunity_id = o.id
LIMIT 5;
```

### R2 音檔檢查

```bash
cd scripts/migration
bun run check-r2.ts
```

預期：155+ 檔案，3.6+ GB

---

## 回滾程序

如果遷移失敗需要回滾：

```bash
# 1. 確認回滾
export CONFIRM_ROLLBACK=yes

# 2. 執行回滾腳本
bun run migration:rollback
```

**回滾腳本功能**：
- 刪除 PostgreSQL 中遷移的資料
- 不會刪除 R2 中的音檔（需手動清理）
- 不會影響 V2 原始資料

---

## 故障排除

### 問題 1: `relation "opportunities" does not exist`

**原因**: 資料庫表尚未建立

**解決**: 先執行 Step 1 建立表結構

### 問題 2: GCS bucket 存取失敗

**症狀**: `The specified bucket does not exist`

**解決**:
1. 確認 `FIREBASE_STORAGE_BUCKET` 名稱正確
2. 確認 Firebase Service Account 有 Storage 權限

### 問題 3: R2 上傳失敗

**症狀**: `Access Denied` 或 `InvalidAccessKeyId`

**解決**:
1. 確認 R2 API Token 權限為 `Object Read & Write`
2. 確認 Token 未過期
3. 確認 Bucket 名稱正確

### 問題 4: drizzle-kit push 卡住

**症狀**: 互動式提示無法回應

**解決**: 使用 expect 腳本自動化（見 Step 1）

---

## 遷移後確認事項

- [ ] V3 Web 可正常登入
- [ ] Dashboard 顯示正確的統計數據
- [ ] Opportunities 列表顯示遷移的資料
- [ ] Conversations 可正常播放音檔
- [ ] MEDDIC 分析結果正確顯示

---

## 附錄：快速指令總覽

```bash
# 完整遷移流程
cd /Users/stephen/Desktop/sales_ai_automation_v3

# 1. 建立表結構
cd packages/db && bun run db:push

# 2. 執行遷移
cd ../.. && bun run migration:run

# 3. 驗證結果
cd scripts/migration && bun run final-check.ts
```

---

## 版本資訊

| 項目 | 版本/日期 |
|------|-----------|
| 文件建立 | 2026-01-12 |
| 最後執行 | 2026-01-12 |
| 遷移結果 | 111 Opportunities, 153 Conversations, 155 Audio Files |
