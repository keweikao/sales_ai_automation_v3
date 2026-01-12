# Workflow Instruction: Phase 4 Agent 1 - 資料遷移執行

> **任務類型**: 資料遷移執行
> **預估時間**: 1.5 工作日
> **依賴條件**: Phase 3 遷移腳本已完成

---

## 任務目標

執行 Firestore → PostgreSQL 的完整資料遷移，包含 Leads → Opportunities、Conversations、MEDDIC Analyses，並驗證資料完整性。

---

## 前置條件

確認以下項目已完成：
- [ ] Firebase Admin SDK 憑證已取得（`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`）
- [ ] V2 Firestore 存取權限已確認
- [ ] Neon PostgreSQL Production 資料庫已建立（`DATABASE_URL`）
- [ ] V3 Database Schema 已部署（執行過 `bun run db:push`）
- [ ] 遷移用戶 ID 已確定（`MIGRATION_USER_ID`）
- [ ] 🔑 **Firestore 資料備份已完成**（參見下方「資料備份步驟」）

---

## 🔑 專案負責人需完成項目

> **重要**: 以下項目需要由**專案負責人（您）**完成，無法由 AI Agent 代為執行。

### 1. Firebase Admin SDK 憑證取得

**需要的環境變數**:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`

**取得步驟**:
1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 選擇 V2 專案
3. 點擊 **專案設定** (齒輪圖示) → **服務帳戶**
4. 點擊 **產生新的私密金鑰** → 下載 JSON 檔案
5. 從 JSON 檔案中提取：
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
6. 儲存空間名稱：`專案設定` → `一般` → `預設 GCS 儲存空間` → `FIREBASE_STORAGE_BUCKET`

**權限需求**:
- 您必須是 Firebase 專案的 **Owner** 或 **Editor** 角色
- Service Account 需要 `Firebase Admin SDK Administrator Service Agent` 角色

---

### 2. Neon PostgreSQL 資料庫建立

**需要的環境變數**:
- `DATABASE_URL`

**取得步驟**:
1. 前往 [Neon Console](https://console.neon.tech/)
2. 建立新專案或選擇現有專案
3. 點擊 **Connection Details**
4. 選擇 **Connection string** → 複製 PostgreSQL URL
5. 格式：`postgresql://user:password@host/database?sslmode=require`

**權限需求**:
- Neon 帳戶需有建立資料庫的權限
- 建議使用 **Pro Plan** 以獲得更高的連線數上限（遷移需要較多連線）

---

### 3. 遷移用戶 ID 確認

**需要的環境變數**:
- `MIGRATION_USER_ID`

**取得步驟**:
1. 先確保 V3 系統已部署且認證功能正常
2. 使用您的帳號登入 V3 系統
3. 從 Better Auth session 或資料庫中取得 `user.id`
4. 或執行：
   ```sql
   SELECT id, email FROM "user" WHERE email = 'your-email@example.com';
   ```

**注意**: 此 ID 將作為遷移資料的擁有者，所有遷移的商機/對話都會關聯到此用戶

---

### 4. 資料備份（強烈建議）

**在執行遷移前，請完成 Firestore 備份**:

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇 Firebase 專案
3. 導航至 **Firestore Database** → **匯入/匯出**
4. 點擊 **匯出** → 選擇 Cloud Storage bucket
5. 匯出 collections：`leads`, `sales_cases`
6. 記錄匯出位置：`gs://your-bucket/firestore-backup-YYYYMMDD/`

**或使用 gcloud CLI**:
```bash
# 安裝 gcloud CLI (如尚未安裝)
# https://cloud.google.com/sdk/docs/install

# 登入
gcloud auth login

# 設定專案
gcloud config set project YOUR_FIREBASE_PROJECT_ID

# 執行備份
gcloud firestore export gs://YOUR_BACKUP_BUCKET/backup-$(date +%Y%m%d)
```

**保留期限**: 建議保留備份至少 **30 天**，直到確認 V3 系統穩定運行

---

## 進階設定

### 批次大小調整

遷移腳本預設使用 100 筆/批次，可透過環境變數調整：

```bash
# .env.migration 追加設定

# 批次大小（預設：100）
BATCH_SIZE=100

# 批次間延遲（毫秒，預設：500）
BATCH_DELAY_MS=500

# 最大重試次數（預設：3）
MAX_RETRIES=3
```

**建議設定**:

| 資料量 | 批次大小 | 批次延遲 | 說明 |
|--------|----------|----------|------|
| < 500 筆 | 100 | 500ms | 預設值，適合大部分情況 |
| 500-2000 筆 | 50 | 1000ms | 降低批次大小，避免記憶體壓力 |
| > 2000 筆 | 25 | 2000ms | 大量資料遷移，需要更保守的設定 |

---

### 並行執行控制

> ⚠️ **重要**: 請勿同時執行多個遷移腳本，以避免資料衝突。

**並行限制說明**:

- 同一時間只能執行 **一個** 遷移 Agent
- Phase 1 (Leads) 必須在 Phase 2 (Conversations) 之前完成
- Phase 2 必須在 Phase 3 (MEDDIC) 之前完成
- Agent 2 (音檔遷移) 可在 Agent 1 完成後**並行**執行

**鎖定機制**:

遷移腳本會自動建立鎖定檔案，防止重複執行：

```bash
# 鎖定檔案位置
scripts/migration/progress/.migration-lock

# 如果遷移異常中斷，需手動刪除鎖定檔案
rm scripts/migration/progress/.migration-lock
```

---

### 效能監控

遷移過程中建議監控以下指標：

**1. PostgreSQL 連線數**

```sql
-- 在 Neon Console 或 psql 執行
SELECT count(*) FROM pg_stat_activity WHERE datname = 'sales_ai_automation_v3';
```

**2. 寫入速度監控**

遷移腳本會輸出即時統計：

```
📊 Migration Progress:
   Processed: 150/250 (60%)
   Speed: 45 records/sec
   ETA: 2m 13s
   Memory: 128MB / 512MB
```

**3. Neon Dashboard 監控**

- 前往 [Neon Console](https://console.neon.tech/) → 選擇專案 → **Monitoring**
- 觀察：CPU Usage、Memory、Active Connections、Query Duration

**效能問題處理**:

| 問題 | 症狀 | 解決方案 |
|------|------|----------|
| 連線耗盡 | `too many connections` | 降低 `BATCH_SIZE`，增加 `BATCH_DELAY_MS` |
| 記憶體不足 | `JavaScript heap out of memory` | 降低 `BATCH_SIZE` 至 25 |
| 寫入緩慢 | < 10 records/sec | 檢查網路延遲，考慮使用更近的 Neon region |

---

### Dry Run 模式說明

Dry Run 模式用於測試遷移邏輯，**不會寫入任何資料**：

```bash
DRY_RUN=true bun run scripts/migration/index.ts
```

**Dry Run vs 正式執行的差異**:

| 項目 | Dry Run | 正式執行 |
|------|---------|----------|
| 讀取 Firestore | ✅ 是 | ✅ 是 |
| 資料轉換驗證 | ✅ 是 | ✅ 是 |
| 寫入 PostgreSQL | ❌ 否 | ✅ 是 |
| 產生日誌 | ✅ 是 (標記 DRY_RUN) | ✅ 是 |
| 更新進度檔案 | ❌ 否 | ✅ 是 |
| 輸出前綴 | `[DRY RUN]` | 無 |

**Dry Run 輸出範例**:

```
[DRY RUN] 📊 Phase 1: Analyzing Leads...

[DRY RUN] Would migrate 250 leads → opportunities
[DRY RUN] Sample transformation:
  - Lead ID: abc123
  - Customer Number: 202401-000001
  - Company: 台灣科技公司
  - Status: new → new (no change)

[DRY RUN] ✅ Validation passed, ready for actual migration
```

---

### 各 Phase 預估時間

| Phase | 項目 | 資料量 | 預估時間 |
|-------|------|--------|----------|
| 準備 | 環境設定 + 連線測試 | - | 15-30 分鐘 |
| 1 | Leads → Opportunities | ~250 筆 | 5-10 分鐘 |
| 2 | Conversations | ~450 筆 | 10-20 分鐘 |
| 3 | MEDDIC Analyses | ~380 筆 | 10-15 分鐘 |
| 驗證 | 完整驗證 | - | 5-10 分鐘 |
| **總計** | | | **45-85 分鐘** |

> **注意**: 實際時間取決於網路延遲、資料複雜度和批次設定。首次執行建議預留 **2 小時**。

---

## 任務清單

### Task 1: 遷移環境準備

**目標**: 設定遷移環境並驗證連線

**步驟**:

1. 建立 `.env.migration` 設定檔：

```bash
# .env.migration

# Firebase (V2)
FIREBASE_PROJECT_ID=your-v2-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-v2-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-v2-project.appspot.com

# PostgreSQL (V3)
DATABASE_URL=postgresql://user:password@your-neon-host/sales_ai_automation_v3

# 遷移設定
MIGRATION_USER_ID=user_xxxxxxxx  # V3 系統中的有效用戶 ID
DRY_RUN=false                     # 設為 true 進行乾跑測試
VERBOSE=true                      # 詳細日誌
```

2. 驗證 Firebase 連線：

```bash
# 執行連線測試
bun run scripts/migration/test-connections.ts
```

預期輸出：
```
✅ Firebase Firestore connected
   - leads collection: XX documents
   - sales_cases collection: XX documents
✅ PostgreSQL connected
   - opportunities table: ready
   - conversations table: ready
   - meddic_analyses table: ready
```

3. 執行 Dry Run 測試：

```bash
DRY_RUN=true bun run scripts/migration/index.ts
```

驗證：
- [ ] 無錯誤訊息
- [ ] 顯示預計遷移的筆數
- [ ] 無資料實際寫入

**產出**:
- `.env.migration` 設定檔
- 連線測試通過日誌

---

### Task 2: 執行 Phase 1 遷移（Leads → Opportunities）

**目標**: 將 V2 Firestore `leads` collection 遷移到 V3 PostgreSQL `opportunities` table

**步驟**:

1. 執行遷移：

```bash
# 載入遷移環境變數
export $(cat .env.migration | xargs)

# 執行 Leads 遷移
bun run scripts/migration/migrate-leads.ts
```

2. 監控輸出：

```
📊 Phase 1: Migrating Leads...

Processing batch 1/3 (100 leads)...
  ✓ Lead abc123 → Opportunity abc123
  ✓ Lead def456 → Opportunity def456
  ...

Processing batch 2/3 (100 leads)...
  ...

Processing batch 3/3 (50 leads)...
  ...

✅ Leads Migration Complete
   Total: 250
   Success: 248
   Failed: 2
   Skipped: 0
```

3. 驗證遷移結果：

```sql
-- 使用 Drizzle Studio 或 psql 執行
SELECT COUNT(*) FROM opportunities;
-- 應與 Firestore leads 數量一致

SELECT customer_number, company_name, status, created_at
FROM opportunities
LIMIT 10;
-- 驗證欄位映射正確
```

4. 處理失敗記錄（如有）：

```bash
# 查看失敗原因
cat scripts/migration/logs/leads-errors.json

# 手動修復後重新執行
bun run scripts/migration/migrate-leads.ts --retry-failed
```

**驗證清單**:
- [ ] Firestore leads 筆數 = PostgreSQL opportunities 筆數
- [ ] `customer_number` 格式正確（YYYYMM-XXXXXX）
- [ ] `status` 映射正確（new/contacted/qualified/won/lost）
- [ ] `created_at` 時間戳正確
- [ ] 無 NULL 值在必填欄位

---

### Task 3: 執行 Phase 2 遷移（Conversations）

**目標**: 將 V2 Firestore `sales_cases` collection 遷移到 V3 PostgreSQL `conversations` table

**步驟**:

1. 執行遷移：

```bash
bun run scripts/migration/migrate-conversations.ts
```

2. 監控輸出：

```
💬 Phase 2: Migrating Conversations...

Processing batch 1/5 (100 conversations)...
  ✓ Case xyz789 → Conversation xyz789 (opportunity: abc123)
  ...

Processing batch 2/5 (100 conversations)...
  ...

✅ Conversations Migration Complete
   Total: 450
   Success: 448
   Failed: 2
   Skipped: 0
```

3. 驗證遷移結果：

```sql
-- 驗證筆數
SELECT COUNT(*) FROM conversations;

-- 驗證外鍵關聯
SELECT c.id, c.case_number, c.opportunity_id, o.company_name
FROM conversations c
JOIN opportunities o ON c.opportunity_id = o.id
LIMIT 10;

-- 驗證 V2 特有欄位
SELECT id, progress_score, urgency_level, store_name, coaching_notes
FROM conversations
WHERE progress_score IS NOT NULL
LIMIT 5;

-- 驗證 transcript 結構
SELECT id,
       jsonb_array_length(transcript_segments::jsonb) as segment_count,
       duration
FROM conversations
WHERE transcript IS NOT NULL
LIMIT 5;
```

**驗證清單**:
- [ ] Firestore sales_cases 筆數 = PostgreSQL conversations 筆數
- [ ] `opportunity_id` 外鍵正確關聯
- [ ] `case_number` 格式正確（YYYYMM-ICXXX）
- [ ] `transcript_segments` JSON 結構正確
- [ ] V2 特有欄位（progress_score, urgency_level, store_name）已遷移

---

### Task 4: 執行 Phase 3 遷移（MEDDIC Analyses）

**目標**: 將 V2 `sales_cases.analysis` 遷移到 V3 PostgreSQL `meddic_analyses` table

**步驟**:

1. 執行遷移：

```bash
bun run scripts/migration/migrate-meddic.ts
```

2. 監控輸出：

```
📈 Phase 3: Migrating MEDDIC Analyses...

Processing batch 1/4 (100 analyses)...
  ✓ Analysis for xyz789 → meddic_analysis (score: 75)
  ...

✅ MEDDIC Migration Complete
   Total: 380
   Success: 380
   Failed: 0
   Skipped: 70 (no analysis data)
```

3. 驗證遷移結果：

```sql
-- 驗證筆數（只有有 analysis 的 case 才會遷移）
SELECT COUNT(*) FROM meddic_analyses;

-- 驗證六維度分數
SELECT
    id,
    metrics_score,
    economic_buyer_score,
    decision_criteria_score,
    decision_process_score,
    identify_pain_score,
    champion_score,
    overall_score,
    status
FROM meddic_analyses
LIMIT 10;

-- 驗證 agent_outputs 結構
SELECT id,
       jsonb_object_keys(agent_outputs) as agent_keys
FROM meddic_analyses
WHERE agent_outputs IS NOT NULL
LIMIT 5;

-- 抽樣比對 V2 分數
-- 選擇 conversation_id，手動比對 Firestore 原始資料
SELECT m.conversation_id, m.overall_score, c.store_name
FROM meddic_analyses m
JOIN conversations c ON m.conversation_id = c.id
ORDER BY m.created_at DESC
LIMIT 10;
```

**驗證清單**:
- [ ] 有 meddic_score 的 Firestore cases = PostgreSQL meddic_analyses 筆數
- [ ] 六維度分數正確（1-5 範圍）
- [ ] `overall_score` 與 V2 一致
- [ ] `agent_outputs` JSON 包含所有 Agent 輸出
- [ ] `status` 映射正確（Strong/Medium/Weak/At Risk）

---

### Task 5: 完整驗證

**目標**: 執行完整遷移驗證，確保資料完整性

**步驟**:

1. 執行驗證腳本：

```bash
bun run scripts/migration/validate.ts
```

2. 預期輸出（全部通過）：

```
🔍 Starting migration validation...

📋 Validation Results:

✅ Leads → Opportunities 筆數
   Expected: 250, Actual: 250

✅ Sales Cases → Conversations 筆數
   Expected: 450, Actual: 450

✅ MEDDIC Analyses 筆數
   Expected: 380, Actual: 380

✅ Orphaned Conversations（無對應商機）
   Expected: 0, Actual: 0

✅ MEDDIC 分數一致性（抽樣 10 筆）
   Expected: 90%+, Actual: 100%

✅ 商機缺少 customerNumber
   Expected: 0, Actual: 0

✅ 對話缺少 caseNumber
   Expected: 0, Actual: 0

✅ All checks passed!
```

3. 查看遷移報告：

```bash
# 報告存放位置
cat scripts/migration/reports/migration-report-YYYYMMDD-HHMMSS.json
```

報告內容範例：
```json
{
  "startedAt": "2024-01-15T10:00:00Z",
  "completedAt": "2024-01-15T10:15:30Z",
  "duration": 930,
  "leads": {
    "total": 250,
    "success": 248,
    "failed": 2,
    "skipped": 0
  },
  "conversations": {
    "total": 450,
    "success": 448,
    "failed": 2,
    "skipped": 0
  },
  "meddicAnalyses": {
    "total": 380,
    "success": 380,
    "failed": 0,
    "skipped": 70
  },
  "validationPassed": true
}
```

4. 處理驗證失敗（如有）：

```bash
# 查看詳細錯誤
cat scripts/migration/logs/validation-errors.json

# 執行修復腳本（如需要）
bun run scripts/migration/fix-orphaned.ts
bun run scripts/migration/fix-missing-fields.ts
```

---

## 回滾計畫

如果遷移失敗需要回滾：

```bash
# 執行回滾腳本
bun run scripts/migration/rollback.ts

# 這會：
# 1. 刪除 PostgreSQL 中所有遷移的資料
# 2. 清除遷移進度檔案
# 3. 保留 Firestore 原始資料（不影響）
```

**警告**: 回滾會刪除所有遷移的資料，請確認後執行。

---

## 驗收標準

完成此任務後，應達成以下標準：

- [ ] Firestore `leads` 筆數 = PostgreSQL `opportunities` 筆數
- [ ] Firestore `sales_cases` 筆數 = PostgreSQL `conversations` 筆數
- [ ] 所有 MEDDIC 分數遷移正確（抽樣驗證 10 筆，100% 一致）
- [ ] 無 orphaned conversations（外鍵完整性）
- [ ] 無 NULL 值在必填欄位
- [ ] 遷移報告已保存
- [ ] 驗證腳本全部通過（7/7 checks）

---

## 產出檔案

遷移完成後應產出：

```
scripts/migration/
├── logs/
│   ├── leads-migration-YYYYMMDD.log
│   ├── conversations-migration-YYYYMMDD.log
│   ├── meddic-migration-YYYYMMDD.log
│   └── validation-YYYYMMDD.log
├── reports/
│   └── migration-report-YYYYMMDD-HHMMSS.json
└── progress/
    └── migration-progress.json (遷移完成後清除)
```

---

## 故障排除

### 問題 1: Firebase 連線失敗

**症狀**: `Error: Failed to initialize Firebase Admin SDK`

**解決方案**:
1. 檢查 `FIREBASE_PRIVATE_KEY` 是否正確（注意 `\n` 換行符）
2. 確認 Service Account 有 Firestore 讀取權限
3. 嘗試在 `.env.migration` 中使用單引號包裹 private key

### 問題 2: PostgreSQL 連線失敗

**症狀**: `Error: Connection refused`

**解決方案**:
1. 檢查 Neon 資料庫是否啟用
2. 確認 `DATABASE_URL` 格式正確
3. 檢查 IP 白名單設定

### 問題 3: 外鍵關聯錯誤

**症狀**: `Error: Foreign key constraint violation`

**解決方案**:
1. 確保先執行 Leads 遷移再執行 Conversations
2. 檢查是否有 conversation 引用不存在的 lead
3. 使用 `--skip-orphaned` 參數跳過孤立記錄

### 問題 4: 遷移中斷後恢復

**症狀**: 遷移中斷，需要從斷點繼續

**解決方案**:
```bash
# 檢查遷移進度
cat scripts/migration/progress/migration-progress.json

# 從斷點繼續（自動跳過已完成的 phase）
bun run scripts/migration/index.ts
```

---

## 下一步

完成資料遷移後：
1. 通知 Agent 2 可以開始音檔遷移（更新 audio_url）
2. 通知 Agent 3 資料已就緒，可以進行部署驗證
3. 保留 Firestore 備份至少 30 天
